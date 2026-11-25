// Port of .github/scripts/check_up.py (including the uncommitted
// "keep previous ranking on failure" rules). Plain fetch replaces curl_cffi.
//
// Safety rules kept from the original:
// - event lookup fails or is malformed → throw (nothing saved)
// - comment collection fails and a previous ranking exists → keep it
//   (only tab/title refreshed)
// - comment collection fails and the previous ranking could not be read → throw
// - comment collection fails for a new event (previous read fine) → empty ranking
import { type FetchFn, CollectionError, isPlainObject, readJson, utcSeconds } from './http.ts';

export const MAX_COMMENT_PAGES = 100; // 10,000 comments; beyond that we keep the previous ranking.

const COMMENT_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://www.sooplive.com/',
  Origin: 'https://www.sooplive.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

export interface UpEvent {
  id: number | string;
  tab_name: string;
  title: string;
  soop_url: string;
}

export interface RankingRow {
  bj_id: string;
  name: string;
  profile_url: string;
  timestamp: string;
  up_count: number;
  reply_no: string;
  rank?: number;
}

export function parseSoopUrl(url: string): [string, string] | [null, null] {
  const match = url.split('#')[0].match(/\/(?:station\/)?(\w+)\/post\/(\d+)/);
  return match ? [match[1], match[2]] : [null, null];
}

export function validateEvents(payload: unknown): UpEvent[] {
  if (!Array.isArray(payload)) throw new CollectionError('UP event response must be a list');
  for (const event of payload) {
    if (!isPlainObject(event) || !(typeof event.id === 'number' || typeof event.id === 'string') ||
        !['tab_name', 'title', 'soop_url'].every(field => typeof event[field] === 'string')) {
      throw new CollectionError('UP event response contains an invalid row');
    }
  }
  return payload as UpEvent[];
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function likeCount(value: unknown): number {
  if (value === undefined || value === null || value === 0 || value === '' || value === false) return 0;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value)) return Number(value);
  throw new CollectionError('Invalid like count');
}

function isPageCount(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
  return typeof value === 'string' && /^\d+$/.test(value);
}

// Returns null when the comments could not be collected safely.
export async function fetchReplies(fetchFn: FetchFn, bjId: string, postNo: string, log: (m: string) => void = () => {}): Promise<RankingRow[] | null> {
  try {
    const rows: RankingRow[] = [];
    for (let page = 1; ; page++) {
      if (page > MAX_COMMENT_PAGES) {
        log(`  comment pages exceed ${MAX_COMMENT_PAGES}; keeping previous ranking`);
        return null;
      }
      const url = `https://api-channel.sooplive.com/v1.1/channel/${encodeURIComponent(bjId)}/post/${postNo}` +
        `/comment?page=${page}&orderBy=reg_date&cCommentNo=0&perPage=100`;
      const body = await readJson(fetchFn, url, { headers: COMMENT_HEADERS });
      if (!isPlainObject(body)) return null;
      const data = body.data;
      const total = isPlainObject(body.meta) ? body.meta.lastPage : undefined;
      if (!Array.isArray(data) || !isPageCount(total)) return null;
      const lastPage = Number(total);
      if ((lastPage === 0 && (page !== 1 || data.length)) || (lastPage > 0 && lastPage < page) ||
          (!data.length && (page > 1 || lastPage > 1))) return null;
      for (const item of data) {
        if (!isPlainObject(item)) return null;
        if (item.pCommentNo) {
          rows.push({
            bj_id: text(item.userId),
            name: text(item.userNick),
            profile_url: text(item.profileImage),
            timestamp: text(item.regDate),
            up_count: likeCount(item.likeCnt),
            reply_no: String(item.pCommentNo),
          });
        }
      }
      log(`  page ${page}/${lastPage}, got ${data.length} items`);
      if (page >= lastPage) break;
    }
    return rows.filter(row => row.bj_id);
  } catch (error) {
    log(`  comment fetch error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export interface UpDeps {
  fetchFn: FetchFn;
  selectEvents: () => Promise<unknown>;
  readPrevious: () => Promise<Record<string, unknown> | null>;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface UpResult {
  payload: { updated: string; events: Record<string, unknown>[] };
  collectionFailures: number;
}

export async function collectUp(deps: UpDeps): Promise<UpResult> {
  const log = deps.log || (() => {});
  const now = deps.now || (() => new Date());
  const events = validateEvents(await deps.selectEvents());
  log(`Found ${events.length} active UP events`);

  let prevMap = new Map<unknown, Record<string, unknown>>();
  let prevLoaded = false;
  try {
    const prev = (await deps.readPrevious()) || { events: [] };
    const prevEvents = prev.events ?? [];
    if (!Array.isArray(prevEvents)) throw new CollectionError('previous events must be a list');
    prevMap = new Map(prevEvents.filter(event => isPlainObject(event) && 'id' in event).map(event => [
      event.id, { ...event, live_updated_at: event.live_updated_at || prev.updated },
    ]));
    prevLoaded = true;
    log(`Previous ranking loaded: ${prevMap.size} events`);
  } catch (error) {
    log(`Previous ranking unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  const out: Record<string, unknown>[] = [];
  let collectionFailures = 0;
  for (const event of events) {
    const [bjId, postNo] = parseSoopUrl(event.soop_url);
    const previous = prevMap.get(event.id);
    if (!bjId || !postNo) {
      log(`Could not parse URL (no post): ${event.soop_url}`);
      out.push({
        id: event.id, tab: event.tab_name, title: event.title, soop_url: event.soop_url,
        ranking: previous?.ranking ?? [],
        live_updated_at: previous?.live_updated_at ?? null,
      });
      continue;
    }
    log(`Processing: [${event.tab_name}] ${event.title} (${bjId}/post/${postNo})`);
    const replies = await fetchReplies(deps.fetchFn, bjId, postNo, log);
    if (replies === null) {
      collectionFailures++;
      if (previous) {
        log('  Collection failed; keeping previous ranking');
        out.push({ ...previous, tab: event.tab_name, title: event.title });
      } else if (!prevLoaded) {
        throw new CollectionError('Collection failed and previous ranking is unavailable; leaving stored ranking untouched');
      } else {
        out.push({ id: event.id, tab: event.tab_name, title: event.title, soop_url: event.soop_url, ranking: [] });
      }
      continue;
    }
    replies.sort((a, b) => b.up_count - a.up_count);
    replies.forEach((row, index) => { row.rank = index + 1; });
    out.push({
      id: event.id, tab: event.tab_name, title: event.title, soop_url: event.soop_url,
      ranking: replies, live_updated_at: utcSeconds(now()),
    });
  }
  return { payload: { updated: utcSeconds(now()), events: out }, collectionFailures };
}
