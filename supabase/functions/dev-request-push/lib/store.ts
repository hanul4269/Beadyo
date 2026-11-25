// Supabase REST access for dev-request-push. Keys are only ever sent to this
// project's own endpoints.
import type { Store, Subscription, PushRequestRow } from './handler.ts';

type FetchFn = typeof fetch;

export function keyHeaders(key: string): Record<string, string> {
  // New sb_secret_/sb_publishable_ keys are not JWTs: apikey header only.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_secret_') && !key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function createStore(fetchFn: FetchFn, supabaseUrl: string, serviceKey: string, publicKey: string): Store {
  const base = supabaseUrl.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base)) throw new Error('Unexpected Supabase URL');
  if (!serviceKey) throw new Error('Service key is not configured');
  const rest = `${base}/rest/v1/`;
  const url = (path: string) => rest + path;
  const headers = { ...keyHeaders(serviceKey), Accept: 'application/json' };

  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetchFn(url(path), { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`REST ${response.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    async getRequest(id) {
      const rows = await call(`development_requests?id=eq.${id}&select=id,requester_name,created_at`);
      return Array.isArray(rows) && rows.length ? rows[0] as PushRequestRow : null;
    },
    async claimRequest(id) {
      const rows = await call('development_request_push_log?on_conflict=request_id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify([{ request_id: id }]),
      });
      return Array.isArray(rows) && rows.length > 0;
    },
    async listSubscriptions() {
      const rows = await call('push_subscriptions?select=id,endpoint,p256dh,auth_secret&order=id');
      return Array.isArray(rows) ? rows as Subscription[] : [];
    },
    async deleteSubscription(id) {
      await call(`push_subscriptions?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async isOwnerToken(token) {
      // 사용자의 로그인 토큰으로 can_register_push RPC를 불러 소유자인지 확인
      const response = await fetchFn(url('rpc/can_register_push'), {
        method: 'POST',
        headers: {
          apikey: publicKey || serviceKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: '{}',
      });
      if (!response.ok) return false;
      return (await response.json()) === true;
    },
  };
}
