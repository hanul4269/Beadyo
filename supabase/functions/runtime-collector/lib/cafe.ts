// Port of scripts/update-cafe-posts.py. Five public, unpinned posts from
// Beadyo's Naver Cafe menu 21. No login, cookies, bodies or member data.
// The saved payload has the same schema as data/cafe-posts.json.
import { type FetchFn, CollectionError, isPlainObject, readText } from './http.ts';

export const CAFE_ID = '31098081';
export const MENU_ID = '21';
export const BOARD_TITLE = '슬요 똥글';
export const BOARD_URL = `https://cafe.naver.com/f-e/cafes/${CAFE_ID}/menus/${MENU_ID}?viewType=L`;
const API_BASE = `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${CAFE_ID}`;
export const ARTICLES_URL = `${API_BASE}/menus/${MENU_ID}/articles?page=1&perPage=15`;
export const NOTICES_URL = `${API_BASE}/notices/menus/${MENU_ID}`;
const MAX_SAFE_INTEGER = 9_007_199_254_740_991;
const KST_OFFSET_MS = 9 * 3600_000;

// Python str.split()/re \s whitespace (differs from JavaScript \s around
// U+001C–U+001F, U+0085 and U+FEFF).
const PY_SPACE = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const SPACES = new RegExp(`[${PY_SPACE}]+`, 'g');
const VISIBLE = new RegExp(`[^${PY_SPACE}\\u200c\\u200d]`);
const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;

export type CafeFetch = (url: string, contentType: string) => Promise<string>;

export function publicFetcher(fetchFn: FetchFn): CafeFetch {
  return async (url, contentType) => (await readText(fetchFn, url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BeadyoPublicBoard/1.0)',
      Accept: contentType,
      Referer: BOARD_URL,
    },
    expectType: contentType,
  })).text;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

// Numeric references and the common named ones. Unknown names stay as text.
export function unescapeHtml(value: string): string {
  return value.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(code) || code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd';
      return String.fromCodePoint(code);
    }
    return Object.hasOwn(NAMED, ref) ? NAMED[ref] : whole;
  });
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);

function classesOf(attributes: string): string[] {
  const match = attributes.match(/(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  return match ? unescapeHtml(match[1] ?? match[2] ?? match[3] ?? '').split(/\s+/).filter(Boolean) : [];
}

// Text of every <h3> inside an element whose class list has BoardHeaderTitle,
// following the original HTMLParser stack logic.
export function boardHeadings(source: string): string[] {
  const stack: [string, string[]][] = [];
  const headings: string[] = [];
  let current: string[] | null = null;
  const token = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][^\s/>]*)[^>]*>|<([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  const data = (chunk: string) => { if (current && chunk) current.push(unescapeHtml(chunk)); };
  const start = (tag: string, classes: string[]) => {
    const inHeader = classes.includes('BoardHeaderTitle') || stack.some(([, list]) => list.includes('BoardHeaderTitle'));
    if (tag === 'h3' && inHeader) current = [];
    if (!VOID_TAGS.has(tag)) stack.push([tag, classes]);
  };
  const end = (tag: string) => {
    if (tag === 'h3' && current) { headings.push(current.join('')); current = null; }
    for (let index = stack.length - 1; index >= 0; index--) {
      if (stack[index][0] === tag) { stack.splice(index); break; }
    }
  };
  for (let match = token.exec(source); match; match = token.exec(source)) {
    data(source.slice(last, match.index));
    last = token.lastIndex;
    if (match[1]) { end(match[1].toLowerCase()); continue; }
    if (!match[2]) continue; // comment, doctype, processing instruction
    const tag = match[2].toLowerCase();
    const attributes = match[3] || '';
    start(tag, classesOf(attributes));
    if (/\/\s*$/.test(attributes) && !VOID_TAGS.has(tag)) end(tag);
    else if (RAW_TEXT.has(tag)) {
      const close = new RegExp(`</${tag}\\s*>`, 'ig');
      close.lastIndex = last;
      const found = close.exec(source);
      const stop = found ? found.index : source.length;
      if (current) current.push(source.slice(last, stop));
      last = found ? close.lastIndex : source.length;
      token.lastIndex = last;
      end(tag);
    }
  }
  data(source.slice(last));
  return headings;
}

export function validateBoard(source: string): void {
  const headings = boardHeadings(source).map(value => value.split(SPACES).filter(Boolean).join(' ').replace(/^[\u{1F4A9}\ufe0f ]+|[\u{1F4A9}\ufe0f ]+$/gu, ''));
  if (headings.length !== 1 || headings[0] !== BOARD_TITLE) {
    throw new CollectionError('The expected public Cafe board title was not found');
  }
}

export function positiveId(value: unknown): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_SAFE_INTEGER) {
    throw new CollectionError('Invalid Cafe article identifier');
  }
  return String(value);
}

function articleRows(payload: unknown): unknown[] {
  if (!isPlainObject(payload) || 'error' in payload) throw new CollectionError('Invalid public Cafe response envelope');
  const result = payload.result;
  if (!isPlainObject(result) || !Array.isArray(result.articleList)) throw new CollectionError('Public Cafe article list is unavailable');
  if (result.articleList.length > 100) throw new CollectionError('Unexpected public Cafe article list size');
  return result.articleList;
}

function pinnedIds(payload: unknown): Set<string> {
  const ids = new Set<string>();
  for (const row of articleRows(payload)) {
    if (!isPlainObject(row) || !isPlainObject(row.item)) throw new CollectionError('Invalid Cafe notice item');
    const item = row.item;
    if (positiveId(item.cafeId) !== CAFE_ID) throw new CollectionError('Cafe notice belongs to a different Cafe');
    positiveId(item.menuId); // Cafe-wide notices can belong to other menus.
    ids.add(positiveId(item.articleId));
  }
  return ids;
}

export function plainTitle(value: unknown): string {
  if (typeof value !== 'string') throw new CollectionError('Cafe article title is unavailable');
  const title = unescapeHtml(value).split(SPACES).filter(Boolean).join(' ');
  if (CONTROLS.test(title)) throw new CollectionError('Invalid control character in Cafe title');
  if (!VISIBLE.test(title) || title.length > 300) throw new CollectionError('Invalid Cafe article title');
  return title;
}

export interface CafePost { id: string; title: string; publishedAt: string; href: string }

function kstIso(stamp: number): string {
  return new Date(stamp + KST_OFFSET_MS).toISOString().replace('Z', '+09:00');
}

export function publicPosts(payload: unknown, notices: unknown, now: Date): CafePost[] {
  const rows = articleRows(payload);
  const excluded = pinnedIds(notices);
  const posts = new Map<string, [number, CafePost]>();
  for (const row of rows) {
    if (!isPlainObject(row) || typeof row.type !== 'string') throw new CollectionError('Invalid Cafe article wrapper');
    if (row.type !== 'ARTICLE') continue;
    const item = row.item;
    if (!isPlainObject(item)) throw new CollectionError('Invalid Cafe article item');
    if (positiveId(item.cafeId) !== CAFE_ID || positiveId(item.menuId) !== MENU_ID) {
      throw new CollectionError('Cafe article belongs to a different board');
    }
    const articleId = positiveId(item.articleId);
    for (const flag of ['openArticle', 'blindArticle', 'restrictMenu']) {
      if (typeof item[flag] !== 'boolean') throw new CollectionError('Cafe article visibility cannot be confirmed');
    }
    if (excluded.has(articleId) || !item.openArticle || item.blindArticle || item.restrictMenu) continue;
    const stamp = item.writeDateTimestamp;
    if (typeof stamp !== 'number' || !Number.isInteger(stamp) || stamp <= 0 || stamp > MAX_SAFE_INTEGER) {
      throw new CollectionError('Invalid Cafe article timestamp');
    }
    const published = new Date(stamp);
    if (!Number.isFinite(published.getTime()) || published.getUTCFullYear() > 9999) throw new CollectionError('Invalid Cafe article date');
    if (published.getUTCFullYear() < 2000 || published.getTime() > now.getTime()) {
      throw new CollectionError('Cafe article date is outside the confirmed range');
    }
    const post: CafePost = {
      id: articleId,
      title: plainTitle(item.subject),
      publishedAt: kstIso(stamp),
      href: `https://cafe.naver.com/f-e/cafes/${CAFE_ID}/articles/${articleId}`,
    };
    const existing = posts.get(articleId);
    if (existing && (existing[0] !== stamp || JSON.stringify(existing[1]) !== JSON.stringify(post))) {
      throw new CollectionError('Conflicting duplicate Cafe article');
    }
    posts.set(articleId, [stamp, post]);
  }
  if (rows.length && !posts.size) throw new CollectionError('No ordinary public Cafe articles could be confirmed');
  return [...posts.values()]
    .sort((a, b) => b[0] - a[0] || Number(b[1].id) - Number(a[1].id))
    .slice(0, 5)
    .map(([, post]) => post);
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { throw new CollectionError('Invalid public Cafe JSON'); }
}

export interface CafePayload {
  schemaVersion: 1; cafeId: string; menuId: string; boardTitle: string; fetchedAt: string; posts: CafePost[];
}

export async function collectCafe(fetch: CafeFetch, now?: Date): Promise<CafePayload> {
  validateBoard(await fetch(BOARD_URL, 'text/html'));
  const articles = parseJson(await fetch(ARTICLES_URL, 'application/json'));
  const notices = parseJson(await fetch(NOTICES_URL, 'application/json'));
  const at = now || new Date();
  return {
    schemaVersion: 1, cafeId: CAFE_ID, menuId: MENU_ID, boardTitle: BOARD_TITLE,
    fetchedAt: at.toISOString(),
    posts: publicPosts(articles, notices, at),
  };
}
