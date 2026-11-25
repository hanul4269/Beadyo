// dev-request-push request handling, kept free of Deno/npm imports so it can
// be tested with `node --test`.

export interface PushRequestRow {
  id: number;
  requester_name: string;
  created_at: string;
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
  listSubscriptions(): Promise<Subscription[]>;
  deleteSubscription(id: number): Promise<void>;
  isOwnerToken(token: string): Promise<boolean>;
}

/** Sends one push and returns the push service's HTTP status. */
export type SendFn = (subscription: Subscription, payload: PushPayload) => Promise<number>;

export interface Deps {
  store: () => Store;
  send: SendFn;
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

export function testPayload(now: number): PushPayload {
  return {
    title: '알림 테스트',
    body: '이 기기로 개발요청 알림이 정상적으로 와요.',
    url: BOARD_URL,
    tag: `dev-request-test-${now}`,
  };
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
    const result = await deliver(store, deps.send, testPayload(now()), log);
    return json(200, { ok: true, ...result });
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

  const result = await deliver(store, deps.send, requestPayload(row), log);
  log(`request ${id}: ${JSON.stringify(result)}`);
  return json(200, { ok: true, ...result });
}
