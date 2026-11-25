// runtime-collector: pg_cron → pg_net → this function → site_runtime_cache.
//
// Replaces the scheduled GitHub Actions jobs (live-status, up-ranking,
// cafe-posts) that were delayed for hours.
//
// Deploy with JWT verification OFF (verify_jwt = false); the caller is
// authenticated by the `x-collector-secret` header instead.
//
// Function secrets (set in the Dashboard, never committed):
//   COLLECTOR_SECRET  random 64 hex chars, same value as Vault `beadyo_collector_secret`
//   COLLECTOR_MODE    `shadow` (default; writes *_edge keys) or `live` (production keys)
// Injected by Supabase: SUPABASE_URL, SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY.
//
// Request: POST {"job": "live" | "up" | "cafe"}
import { createStore } from './lib/cache.ts';
import { handle } from './lib/handler.ts';

function serviceKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      const value = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (typeof value === 'string' && value) return value;
    } catch { /* fall back to the legacy variable */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

Deno.serve(request => handle(request, {
  secret: Deno.env.get('COLLECTOR_SECRET'),
  mode: Deno.env.get('COLLECTOR_MODE'),
  fetchFn: fetch,
  store: () => createStore(fetch, Deno.env.get('SUPABASE_URL') || '', serviceKey()),
  log: message => console.log(message),
}));
