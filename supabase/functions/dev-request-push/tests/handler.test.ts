// node --test supabase/functions/dev-request-push/tests/handler.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, isAllowedEndpoint, requestPayload, type Store, type Subscription } from '../lib/handler.ts';

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
    async listSubscriptions() { return subs; },
    async deleteSubscription(id) { deleted.push(id); },
    async isOwnerToken(token) { return token === 'owner-token'; },
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
  assert.deepEqual(first, { ok: true, devices: 3, sent: 1, removed: 1, failed: 1 });
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
