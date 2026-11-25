// site_runtime_cache access with the server-side key that the Edge runtime
// injects. The key is only ever sent to this project's own REST endpoint.
import { type FetchFn, CollectionError, isPlainObject, readJson, readText } from './http.ts';

export type Mode = 'shadow' | 'live';
export const BASE_KEYS = { live: 'live_status', up: 'up_ranking', cafe: 'cafe_posts' } as const;
export type Job = keyof typeof BASE_KEYS;

// shadow mode writes beside the production rows so both can be compared.
export function cacheKey(job: Job, mode: Mode): string {
  return mode === 'live' ? BASE_KEYS[job] : `${BASE_KEYS[job]}__edge`;
}

export function keyHeaders(key: string): Record<string, string> {
  // New sb_secret_/sb_publishable_ keys are not JWTs: apikey header only.
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_secret_') && !key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export interface Store {
  read(cacheKey: string): Promise<Record<string, unknown> | null>;
  write(cacheKey: string, payload: unknown, updatedAt: string): Promise<void>;
  selectActiveUpEvents(): Promise<unknown>;
}

export function createStore(fetchFn: FetchFn, supabaseUrl: string, serviceKey: string): Store {
  const base = supabaseUrl.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base)) throw new Error('Unexpected Supabase URL');
  if (!serviceKey) throw new Error('Service key is not configured');
  const rest = `${base}/rest/v1/`;
  const url = (path: string) => {
    const full = rest + path;
    if (!full.startsWith(rest)) throw new Error('Refusing to send credentials outside the project');
    return full;
  };
  const headers = { ...keyHeaders(serviceKey), Accept: 'application/json' };

  return {
    async read(key) {
      const rows = await readJson(fetchFn, url(`site_runtime_cache?cache_key=eq.${encodeURIComponent(key)}&select=payload`), { headers });
      if (!Array.isArray(rows)) throw new CollectionError('runtime cache response must be a list');
      if (!rows.length) return null;
      const payload = isPlainObject(rows[0]) ? rows[0].payload : undefined;
      if (!isPlainObject(payload)) throw new CollectionError('runtime cache payload must be an object');
      return payload;
    },
    async write(key, payload, updatedAt) {
      await readText(fetchFn, url('site_runtime_cache?on_conflict=cache_key'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ cache_key: key, payload, updated_at: updatedAt }]),
        okStatuses: [200, 201, 204],
      });
    },
    async selectActiveUpEvents() {
      return readJson(fetchFn, url('up_events?is_active=eq.true&order=sort_order&select=*'), { headers });
    },
  };
}
