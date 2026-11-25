// node --test supabase/functions/dev-request-push/tests/handler.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handle, commentPayload, discordCommentMessage, isAllowedEndpoint, isDiscordWebhook, requestPayload, discordRequestMessage,
  type DiscordMessage, type Store, type Subscription,
} from '../lib/handler.ts';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const APPLE = 'https://web.push.apple.com/abc';
const FCM = 'https://fcm.googleapis.com/fcm/send/xyz';

function fakeStore(overrides: Partial<Store> = {}, subs: Subscription[] = []) {
  const claimed = new Set<number>();
  const deleted: number[] = [];
  const store: Store = {
    async getRequest(id) {
      return id === 7 ? { id: 7, requester_name: '편집자 A', created_at: new Date(NOW - 60_000).toISOString() } : null;
    },
    async claimRequest(id) {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    async getComment(id) {
      return id === 21 ? {
        id: 21, request_id: 7, author_name: '편집자 C', content: '@here 확인 부탁해요',
        created_at: new Date(NOW - 30_000).toISOString(), request_content: '룰렛 결과를 방송 화면에 크게 띄울 수 있는 기능이 필요해요. 참고 링크도 같이 남깁니다.',
      } : null;
    },
    async claimComment(id) {
      if (claimed.has(-id)) return false;
      claimed.add(-id);
      return true;
    },
    async listSubscriptions() { return subs; },
    async deleteSubscription(id) { deleted.push(id); },
    async isOwnerToken(token) { return token === 'owner-token'; },
    async isOwnerUser(userId) { return userId === 'owner-uid'; },
    ...overrides,
  };
  return { store, deleted };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://x.supabase.co/functions/v1/dev-request-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const subs: Subscription[] = [
  { id: 1, endpoint: APPLE, p256dh: 'p'.repeat(40), auth_secret: 'a'.repeat(16) },
  { id: 2, endpoint: FCM, p256dh: 'p'.repeat(40), auth_secret: 'a'.repeat(16) },
  { id: 3, endpoint: 'https://evil.example.com/hook', p256dh: 'p'.repeat(40), auth_secret: 'a'.repeat(16) },
];

test('endpoint allowlist only accepts known push services', () => {
  assert.equal(isAllowedEndpoint(APPLE), true);
  assert.equal(isAllowedEndpoint(FCM), true);
  assert.equal(isAllowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  assert.equal(isAllowedEndpoint('https://evil.example.com/push.apple.com'), false);
  assert.equal(isAllowedEndpoint('http://web.push.apple.com/x'), false);
  assert.equal(isAllowedEndpoint('not a url'), false);
});

test('new request is pushed once, expired devices are removed, unknown hosts skipped', async () => {
  const { store, deleted } = fakeStore({}, subs);
  const sentTo: string[] = [];
  const deps = {
    store: () => store,
    now: () => NOW,
    send: async (s: Subscription) => { sentTo.push(s.endpoint); return s.id === 2 ? 410 : 201; },
  };
  const first = await (await handle(post({ request_id: 7 }), deps)).json();
  assert.deepEqual(first, { ok: true, devices: 3, sent: 1, removed: 1, failed: 1, discord: 'off' });
  assert.deepEqual(sentTo, [APPLE, FCM]);
  assert.deepEqual(deleted, [2]);

  const second = await (await handle(post({ request_id: 7 }), deps)).json();
  assert.equal(second.skipped, 'already sent');
  assert.equal(sentTo.length, 2);
});

test('old or missing requests are not pushed', async () => {
  const { store } = fakeStore({
    async getRequest(id) { return { id, requester_name: 'x', created_at: new Date(NOW - 11 * 60_000).toISOString() }; },
  }, subs);
  let sends = 0;
  const deps = { store: () => store, now: () => NOW, send: async () => { sends += 1; return 201; } };
  assert.equal((await (await handle(post({ request_id: 9 }), deps)).json()).skipped, 'too old');
  const missing = fakeStore({}, subs).store;
  assert.equal((await handle(post({ request_id: 8 }), { ...deps, store: () => missing })).status, 404);
  assert.equal((await handle(post({ request_id: '7' }), deps)).status, 400);
  assert.equal((await handle(post({ request_id: -1 }), deps)).status, 400);
  assert.equal(sends, 0);
});

test('test push requires the owner token', async () => {
  const { store } = fakeStore({}, subs.slice(0, 1));
  let sends = 0;
  const deps = { store: () => store, now: () => NOW, send: async () => { sends += 1; return 201; } };
  assert.equal((await handle(post({ test: true }), deps)).status, 403);
  assert.equal((await handle(post({ test: true }, { Authorization: 'Bearer other' }), deps)).status, 403);
  const ok = await (await handle(post({ test: true }, { Authorization: 'Bearer owner-token' }), deps)).json();
  assert.equal(ok.sent, 1);
  assert.equal(sends, 1);
});

test('payload keeps the lock screen preview short', () => {
  const payload = requestPayload({ id: 3, requester_name: '  아주 긴   이름'.repeat(10), created_at: '' });
  assert.equal(payload.title, '새 개발요청');
  assert.ok(payload.body.length <= 50);
  assert.equal(payload.url, '/development-requests.html');
});

test('CORS only for site origins, other methods rejected', async () => {
  const { store } = fakeStore();
  const deps = { store: () => store, send: async () => 201, allowedOrigins: ['https://beadyo.com'] };
  const pre = await handle(new Request('https://x/f', { method: 'OPTIONS', headers: { Origin: 'https://beadyo.com' } }), deps);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://beadyo.com');
  const other = await handle(new Request('https://x/f', { method: 'OPTIONS', headers: { Origin: 'https://evil.com' } }), deps);
  assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await handle(new Request('https://x/f'), deps)).status, 405);
});

test('discord webhook URL check', () => {
  assert.equal(isDiscordWebhook('https://discord.com/api/webhooks/123/abc_DEF-1'), true);
  assert.equal(isDiscordWebhook('https://discordapp.com/api/webhooks/123/abc'), true);
  assert.equal(isDiscordWebhook('https://evil.com/api/webhooks/123/abc'), false);
  assert.equal(isDiscordWebhook('http://discord.com/api/webhooks/123/abc'), false);
});

test('discord message has preview, no mentions, links to the board', () => {
  const long = '@everyone 내용 '.repeat(40);
  const message = discordRequestMessage({ id: 5, requester_name: '편집자 B', created_at: '2026-11-26T12:00:00Z', content: long });
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  const embed = message.embeds[0];
  assert.equal(embed.title, '새 개발요청');
  assert.equal(embed.author?.name, '편집자 B');
  assert.ok(embed.description.length <= 201);
  assert.ok(embed.description.endsWith('…'));
  assert.equal(embed.url, 'https://beadyo.com/development-requests.html');
});

test('push and discord are sent together, and one failing does not stop the other', async () => {
  const messages: DiscordMessage[] = [];
  const { store } = fakeStore({
    async getRequest(id) { return { id, requester_name: '편집자 A', created_at: new Date(NOW - 1000).toISOString(), content: '룰렛 기능' }; },
  }, subs.slice(0, 1));
  let pushes = 0;
  const ok = await (await handle(post({ request_id: 11 }), {
    store: () => store, now: () => NOW,
    send: async () => { pushes += 1; return 201; },
    discord: async m => { messages.push(m); return 204; },
  })).json();
  assert.equal(ok.sent, 1);
  assert.equal(ok.discord, 'sent');
  assert.equal(messages[0].embeds[0].description, '룰렛 기능');

  const failing = await (await handle(post({ request_id: 12 }), {
    store: () => store, now: () => NOW,
    send: async () => { pushes += 1; return 201; },
    discord: async () => { throw new Error('network'); },
  })).json();
  assert.equal(failing.sent, 1);
  assert.equal(failing.discord, 'failed');

  const listFails = fakeStore({
    async getRequest(id) { return { id, requester_name: 'x', created_at: new Date(NOW).toISOString(), content: 'y' }; },
    async listSubscriptions() { throw new Error('db down'); },
  }).store;
  const pushDown = await (await handle(post({ request_id: 13 }), {
    store: () => listFails, now: () => NOW, send: async () => 201, discord: async () => 204,
  })).json();
  assert.equal(pushDown.discord, 'sent');

  const off = await (await handle(post({ request_id: 14 }), { store: () => store, now: () => NOW, send: async () => 201 })).json();
  assert.equal(off.discord, 'off');
});

test('test button also posts to discord', async () => {
  const { store } = fakeStore({}, []);
  let posted = 0;
  const res = await (await handle(post({ test: true }, { Authorization: 'Bearer owner-token' }), {
    store: () => store, send: async () => 201, discord: async () => { posted += 1; return 204; },
  })).json();
  assert.equal(res.discord, 'sent');
  assert.equal(posted, 1);
});

test('new comment goes to push and discord once, with request context', async () => {
  const messages: DiscordMessage[] = [];
  const payloads: string[] = [];
  const { store } = fakeStore({}, subs.slice(0, 1));
  const deps = {
    store: () => store, now: () => NOW,
    send: async (_s: Subscription, p: { title: string }) => { payloads.push(p.title); return 201; },
    discord: async (m: DiscordMessage) => { messages.push(m); return 204; },
  };
  const first = await (await handle(post({ comment_id: 21 }), deps)).json();
  assert.equal(first.sent, 1);
  assert.equal(first.discord, 'sent');
  assert.deepEqual(payloads, ['새 댓글']);
  const embed = messages[0].embeds[0];
  assert.equal(embed.title, '새 댓글');
  assert.equal(embed.description, '@here 확인 부탁해요');
  assert.deepEqual(messages[0].allowed_mentions, { parse: [] });
  assert.equal(embed.fields?.[0].name, '요청');
  assert.ok((embed.fields?.[0].value.length ?? 0) <= 51);

  const again = await (await handle(post({ comment_id: 21 }), deps)).json();
  assert.equal(again.skipped, 'already sent');
  assert.equal(messages.length, 1);
});

test('comment validation: bad id, missing, too old', async () => {
  const { store } = fakeStore({}, subs);
  let sends = 0;
  const deps = { store: () => store, now: () => NOW, send: async () => { sends += 1; return 201; } };
  assert.equal((await handle(post({ comment_id: 0 }), deps)).status, 400);
  assert.equal((await handle(post({ comment_id: '21' }), deps)).status, 400);
  assert.equal((await handle(post({ comment_id: 99 }), deps)).status, 404);
  const old = fakeStore({
    async getComment(id) { return { id, request_id: 1, author_name: 'x', content: 'y', created_at: new Date(NOW - 11 * 60_000).toISOString() }; },
  }, subs).store;
  assert.equal((await (await handle(post({ comment_id: 22 }), { ...deps, store: () => old })).json()).skipped, 'too old');
  assert.equal(sends, 0);
});

test('comment payload text and missing request context fallback', () => {
  const row = { id: 3, request_id: 9, author_name: '편집자 D', content: 'ok', created_at: '' };
  assert.equal(commentPayload(row).body, '편집자 D님이 댓글을 남겼어요.');
  assert.equal(discordCommentMessage(row).embeds[0].fields?.[0].value, '#9');
});

test('owner comment goes to discord only, editor comment to both', async () => {
  const comment = (id: number, author: string) => ({
    id, request_id: 7, author_id: author, author_name: '작성자', content: '답글', created_at: new Date(NOW - 1000).toISOString(),
  });
  const { store } = fakeStore({ async getComment(id) { return comment(id, id === 31 ? 'owner-uid' : 'editor-uid'); } }, subs.slice(0, 1));
  let pushes = 0;
  let posts = 0;
  const deps = {
    store: () => store, now: () => NOW,
    send: async () => { pushes += 1; return 201; },
    discord: async () => { posts += 1; return 204; },
  };
  const owner = await (await handle(post({ comment_id: 31 }), deps)).json();
  assert.equal(owner.push, 'skipped (owner)');
  assert.equal(owner.discord, 'sent');
  assert.equal(pushes, 0);
  assert.equal(posts, 1);

  const editor = await (await handle(post({ comment_id: 32 }), deps)).json();
  assert.equal(editor.push, 'sent');
  assert.equal(pushes, 1);
  assert.equal(posts, 2);
});

test('owner check failure falls back to sending the push', async () => {
  const { store } = fakeStore({
    async getComment(id) { return { id, request_id: 7, author_id: 'x', author_name: 'a', content: 'b', created_at: new Date(NOW).toISOString() }; },
    async isOwnerUser() { throw new Error('rpc missing'); },
  }, subs.slice(0, 1));
  let pushes = 0;
  const res = await (await handle(post({ comment_id: 33 }), { store: () => store, now: () => NOW, send: async () => { pushes += 1; return 201; } })).json();
  assert.equal(res.push, 'sent');
  assert.equal(pushes, 1);
});
