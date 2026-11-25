// Request handling, kept free of Deno globals so it can be tested offline.
import { type Job, type Mode, type Store, cacheKey } from './cache.ts';
import { type FetchFn, utcSeconds } from './http.ts';
import { collectLive } from './live.ts';
import { collectUp } from './up.ts';
import { collectCafe, publicFetcher } from './cafe.ts';

export interface HandlerConfig {
  secret: string | undefined;
  mode: string | undefined;
  fetchFn: FetchFn;
  store: () => Store; // created lazily so a bad request never touches credentials
  now?: () => Date;
  log?: (message: string) => void;
}

const JOBS = new Set<Job>(['live', 'up', 'cafe']);
const MIN_SECRET_LENGTH = 32;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

// Compare fixed-length digests so the comparison time does not depend on the secret.
export async function secretMatches(given: string | null, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given || ''), digest(expected)]);
  let difference = given ? 0 : 1;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export function resolveMode(value: string | undefined): Mode | null {
  if (value === undefined || value === '') return 'shadow';
  return value === 'shadow' || value === 'live' ? value : null;
}

export async function handle(request: Request, config: HandlerConfig): Promise<Response> {
  const log = config.log || (() => {});
  const now = config.now || (() => new Date());
  if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!config.secret || config.secret.length < MIN_SECRET_LENGTH) return json(500, { error: 'collector secret is not configured' });
  if (!(await secretMatches(request.headers.get('x-collector-secret'), config.secret))) return json(401, { error: 'unauthorized' });
  const mode = resolveMode(config.mode);
  if (!mode) return json(500, { error: 'invalid COLLECTOR_MODE' });

  let job: unknown;
  try { job = (await request.json())?.job; } catch { return json(400, { error: 'invalid body' }); }
  if (typeof job !== 'string' || !JOBS.has(job as Job)) return json(400, { error: 'unknown job' });

  const key = cacheKey(job as Job, mode);
  try {
    const store = config.store();
    if (job === 'live') {
      const payload = await collectLive(config.fetchFn, now());
      await store.write(key, payload, payload.updated);
      log(`live saved to ${key}: live=${payload.live}`);
      return json(200, { job, mode, key, saved: true });
    }
    if (job === 'up') {
      const { payload, collectionFailures } = await collectUp({
        fetchFn: config.fetchFn,
        selectEvents: () => store.selectActiveUpEvents(),
        readPrevious: () => store.read(key),
        now, log,
      });
      await store.write(key, payload, payload.updated);
      log(`up saved to ${key}: ${payload.events.length} events, ${collectionFailures} kept previous`);
      return json(200, { job, mode, key, saved: true, events: payload.events.length, collectionFailures });
    }
    const payload = await collectCafe(publicFetcher(config.fetchFn), now());
    await store.write(key, payload, utcSeconds(new Date(payload.fetchedAt)));
    log(`cafe saved to ${key}: ${payload.posts.length} posts`);
    return json(200, { job, mode, key, saved: true, posts: payload.posts.length });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`${job} not saved (existing ${key} kept): ${reason}`);
    return json(502, { job, mode, key, saved: false, reason });
  }
}
