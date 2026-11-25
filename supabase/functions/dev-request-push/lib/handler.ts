// dev-request-push request handling, kept free of Deno/npm imports so it can
// be tested with `node --test`.

export interface PushRequestRow {
  id: number;
  requester_name: string;
  created_at: string;
  content?: string;
}

export interface PushCommentRow {
  id: number;
  request_id: number;
  author_id?: string;
  author_name: string;
  content: string;
  created_at: string;
  /** content of the request the comment belongs to */
  request_content?: string;
}

export interface Subscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface Store {
  getRequest(id: number): Promise<PushRequestRow | null>;
  /** true only for the first caller for this request id */
  claimRequest(id: number): Promise<boolean>;
  getComment(id: number): Promise<PushCommentRow | null>;
  /** true only for the first caller for this comment id */
  claimComment(id: number): Promise<boolean>;
  listSubscriptions(): Promise<Subscription[]>;
  deleteSubscription(id: number): Promise<void>;
  isOwnerToken(token: string): Promise<boolean>;
  /** whether this user id is a registered push owner (server-side check) */
  isOwnerUser(userId: string): Promise<boolean>;
}

/** Sends one push and returns the push service's HTTP status. */
export type SendFn = (subscription: Subscription, payload: PushPayload) => Promise<number>;

/** Posts one message to a Discord webhook and returns the HTTP status. */
export type DiscordFn = (message: DiscordMessage) => Promise<number>;

export interface DiscordMessage {
  allowed_mentions: { parse: string[] };
  embeds: Array<{
    title: string;
    description: string;
    url: string;
    color: number;
    timestamp?: string;
    author?: { name: string };
    fields?: Array<{ name: string; value: string }>;
  }>;
}

export interface Deps {
  store: () => Store;
  send: SendFn;
  /** undefined when DISCORD_WEBHOOK_URL is not set */
  discord?: DiscordFn;
  now?: () => number;
  log?: (message: string) => void;
  allowedOrigins?: string[];
}

export const MAX_REQUEST_AGE_MS = 10 * 60 * 1000;
export const BOARD_URL = '/development-requests.html';

const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some(pattern => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

export function requestPayload(row: PushRequestRow): PushPayload {
  const name = String(row.requester_name || '편집자').replace(/\s+/g, ' ').trim().slice(0, 30) || '편집자';
  return {
    title: '새 개발요청',
    body: `${name}님이 개발요청을 남겼어요.`,
    url: BOARD_URL,
    tag: `dev-request-${row.id}`,
  };
}

function displayName(value: string, limit: number): string {
  return String(value || '편집자').replace(/\s+/g, ' ').trim().slice(0, limit) || '편집자';
}

export function commentPayload(row: PushCommentRow): PushPayload {
  return {
    title: '새 댓글',
    body: `${displayName(row.author_name, 30)}님이 댓글을 남겼어요.`,
    url: BOARD_URL,
    tag: `dev-comment-${row.id}`,
  };
}

export function testPayload(now: number): PushPayload {
  return {
    title: '알림 테스트',
    body: '이 기기로 개발요청 알림이 정상적으로 와요.',
    url: BOARD_URL,
    tag: `dev-request-test-${now}`,
  };
}

export const SITE_BOARD_URL = 'https://beadyo.com/development-requests.html';
export const DISCORD_PREVIEW_CHARS = 200;

export function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
}

function preview(text: string, limit: number): string {
  const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}

export function discordRequestMessage(row: PushRequestRow): DiscordMessage {
  const name = String(row.requester_name || '편집자').replace(/\s+/g, ' ').trim().slice(0, 80) || '편집자';
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '새 개발요청',
      description: preview(row.content || '', DISCORD_PREVIEW_CHARS) || '(내용 없음)',
      url: SITE_BOARD_URL,
      color: 0x76ad39,
      timestamp: row.created_at,
      author: { name },
    }],
  };
}

export const DISCORD_REQUEST_CONTEXT_CHARS = 50;

export function discordCommentMessage(row: PushCommentRow): DiscordMessage {
  const requestPreview = preview(row.request_content || '', DISCORD_REQUEST_CONTEXT_CHARS).replace(/\n+/g, ' ');
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '새 댓글',
      description: preview(row.content || '', DISCORD_PREVIEW_CHARS) || '(내용 없음)',
      url: SITE_BOARD_URL,
      color: 0x76ad39,
      timestamp: row.created_at,
      author: { name: displayName(row.author_name, 80) },
      fields: [{ name: '요청', value: requestPreview || `#${row.request_id}` }],
    }],
  };
}

export function discordTestMessage(): DiscordMessage {
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '알림 테스트',
      description: '개발요청 알림이 이 채널로도 정상적으로 와요.',
      url: SITE_BOARD_URL,
      color: 0x76ad39,
    }],
  };
}

async function postDiscord(discord: DiscordFn | undefined, message: DiscordMessage, log: (m: string) => void) {
  if (!discord) return 'off';
  try {
    const status = await discord(message);
    if (status >= 200 && status < 300) return 'sent';
    log(`discord failed with HTTP ${status}`);
  } catch (error) {
    log(`discord threw: ${error instanceof Error ? error.message : String(error)}`);
  }
  return 'failed';
}

function corsHeaders(request: Request, allowed: string[]): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export async function deliver(store: Store, send: SendFn, payload: PushPayload, log: (m: string) => void) {
  const subscriptions = await store.listSubscriptions();
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    if (!isAllowedEndpoint(subscription.endpoint)) {
      failed += 1;
      log(`skip subscription ${subscription.id}: endpoint host not allowed`);
      continue;
    }
    try {
      const status = await send(subscription, payload);
      if (status >= 200 && status < 300) {
        sent += 1;
      } else if (status === 404 || status === 410) {
        await store.deleteSubscription(subscription.id);
        removed += 1;
      } else {
        failed += 1;
        log(`push ${subscription.id} failed with HTTP ${status}`);
      }
    } catch (error) {
      failed += 1;
      log(`push ${subscription.id} threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { devices: subscriptions.length, sent, removed, failed };
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? Date.now;
  const cors = corsHeaders(request, deps.allowedOrigins ?? []);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid json' });
  }

  const store = deps.store();

  // 소유자가 화면의 "테스트 알림" 버튼으로 호출
  if (body.test === true) {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token || !(await store.isOwnerToken(token))) return json(403, { error: 'owner only' });
    const [result, discord] = await Promise.all([
      deliver(store, deps.send, testPayload(now()), log),
      postDiscord(deps.discord, discordTestMessage(), log),
    ]);
    return json(200, { ok: true, ...result, discord });
  }

  // DB 트리거가 새 댓글 id로 호출
  if ('comment_id' in body) {
    const commentId = body.comment_id;
    if (typeof commentId !== 'number' || !Number.isSafeInteger(commentId) || commentId <= 0) {
      return json(400, { error: 'comment_id must be a positive integer' });
    }
    const comment = await store.getComment(commentId);
    if (!comment) return json(404, { error: 'comment not found' });
    const commentAt = Date.parse(comment.created_at);
    if (!Number.isFinite(commentAt) || now() - commentAt > MAX_REQUEST_AGE_MS) {
      return json(200, { ok: true, skipped: 'too old' });
    }
    if (!(await store.claimComment(commentId))) return json(200, { ok: true, skipped: 'already sent' });
    // 소유자가 단 댓글은 본인 폰으로 보내지 않고 디스코드에만 올린다.
    let byOwner = false;
    if (comment.author_id) {
      try {
        byOwner = await store.isOwnerUser(comment.author_id);
      } catch (error) {
        log(`owner check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const [result, discord] = await fanOut(
      store, deps, byOwner ? null : commentPayload(comment), discordCommentMessage(comment), log,
    );
    log(`comment ${commentId}: ${JSON.stringify({ ...result, discord, byOwner })}`);
    return json(200, { ok: true, ...result, discord, push: byOwner ? 'skipped (owner)' : 'sent' });
  }

  // DB 트리거가 새 요청 id로 호출
  const id = body.request_id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    return json(400, { error: 'request_id must be a positive integer' });
  }

  const row = await store.getRequest(id);
  if (!row) return json(404, { error: 'request not found' });

  const createdAt = Date.parse(row.created_at);
  if (!Number.isFinite(createdAt) || now() - createdAt > MAX_REQUEST_AGE_MS) {
    return json(200, { ok: true, skipped: 'too old' });
  }

  if (!(await store.claimRequest(id))) return json(200, { ok: true, skipped: 'already sent' });

  const [result, discord] = await fanOut(store, deps, requestPayload(row), discordRequestMessage(row), log);
  log(`request ${id}: ${JSON.stringify({ ...result, discord })}`);
  return json(200, { ok: true, ...result, discord });
}

// 웹 푸시와 디스코드는 서로 독립: 한쪽이 실패해도 다른 쪽은 보낸다.
function fanOut(store: Store, deps: Deps, payload: PushPayload | null, message: DiscordMessage, log: (m: string) => void) {
  const none = { devices: 0, sent: 0, removed: 0, failed: 0 };
  return Promise.all([
    payload === null ? Promise.resolve(none) : deliver(store, deps.send, payload, log).catch(error => {
      log(`push delivery threw: ${error instanceof Error ? error.message : String(error)}`);
      return { devices: 0, sent: 0, removed: 0, failed: 0, error: true };
    }),
    postDiscord(deps.discord, message, log),
  ]);
}
