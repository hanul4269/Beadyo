// Offline tests: every network call goes to a fake fetch; any unexpected URL fails.
// Run: node --test supabase/functions/runtime-collector/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cacheKey, createStore, keyHeaders, type Store } from '../lib/cache.ts';
import { parseStation, collectLive, STATION_URL } from '../lib/live.ts';
import { collectUp, fetchReplies, parseSoopUrl, validateEvents, MAX_COMMENT_PAGES } from '../lib/up.ts';
import * as C from '../lib/cafe.ts';
import { handle, resolveMode, secretMatches } from '../lib/handler.ts';
import { readText, CollectionError } from '../lib/http.ts';

const FIXTURE = JSON.parse(readFileSync(new URL('../../../../scripts/fixtures/cafe-posts-public.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-10-17T14:00:00Z');
const SECRET = 'a'.repeat(64);
const clone = <T>(value: T): T => structuredClone(value);

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
function fakeFetch(route: Route) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = async (url: string, init?: RequestInit) => { calls.push({ url, init }); return route(url, init); };
  return { fn, calls };
}
const jsonResponse = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } });
const forbidden: Route = url => { throw new Error(`unexpected request ${url}`); };

// ── live ──────────────────────────────────────────────────────────
test('live: offline and live stations parse like check_live.py', () => {
  assert.deepEqual(parseStation({ station: { user_id: 'beadyo97' }, broad: null }), { live: false, title: '' });
  assert.deepEqual(parseStation({ station: { user_id: 'beadyo97' }, broad: { broad_no: 123, broad_title: '  방송 ' } }),
    { live: true, title: '방송' });
  assert.deepEqual(parseStation({ station: { user_id: 'beadyo97' }, broad: { broad_no: '7', broad_title: '' } }),
    { live: true, title: '' });
});

test('live: malformed or foreign responses are rejected (nothing saved)', () => {
  for (const data of [null, [], {}, { station: {} , broad: null }, { station: { user_id: 'other' }, broad: null },
    { station: { user_id: 'beadyo97' } }, { station: { user_id: 'beadyo97' }, broad: [] },
    { station: { user_id: 'beadyo97' }, broad: { broad_no: 0, broad_title: 'x' } },
    { station: { user_id: 'beadyo97' }, broad: { broad_no: '01', broad_title: 'x' } },
    { station: { user_id: 'beadyo97' }, broad: { broad_no: true, broad_title: 'x' } },
    { station: { user_id: 'beadyo97' }, broad: { broad_no: 5, broad_title: null } }]) {
    assert.throws(() => parseStation(data), CollectionError);
  }
});

test('live: request uses only the SOOP station URL, no credentials, no redirects', async () => {
  const { fn, calls } = fakeFetch(() => jsonResponse({ station: { user_id: 'beadyo97' }, broad: null }));
  const payload = await collectLive(fn, NOW);
  assert.deepEqual(payload, { live: false, title: '', updated: '2026-10-17T14:00:00Z' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, STATION_URL);
  assert.equal(calls[0].init?.redirect, 'manual');
  assert.equal(calls[0].init?.credentials, 'omit');
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.ok(!Object.keys(headers).some(name => /cookie|authorization|apikey/i.test(name)));
});

test('http: redirects, HTTP errors, wrong type and oversize bodies fail', async () => {
  for (const response of [new Response('', { status: 302, headers: { Location: 'https://evil.example/' } }),
    new Response('x', { status: 503 })]) {
    await assert.rejects(readText(async () => response, 'https://example.invalid/'), CollectionError);
  }
  await assert.rejects(readText(async () => new Response('<p>', { headers: { 'Content-Type': 'text/html' } }),
    'https://example.invalid/', { expectType: 'application/json' }), CollectionError);
  await assert.rejects(readText(async () => new Response('x'.repeat(11)), 'https://example.invalid/', { maxBytes: 10 }), CollectionError);
});

// ── up ────────────────────────────────────────────────────────────
const EVENT = { id: 900000001, tab_name: 'ISOLATED TEST', title: 'ISOLATED TEST', soop_url: 'https://www.sooplive.co.kr/isolated/post/1' };
const CACHED = {
  updated: '2026-02-02T00:00:00Z',
  events: [{ id: 900000001, tab: 'OLD TAB', title: 'OLD TITLE', soop_url: 'https://www.sooplive.co.kr/isolated/post/1',
    ranking: [{ bj_id: 'isolated_cached', up_count: 42, rank: 1 }], live_updated_at: '2026-02-02T00:00:00Z' }],
};
const COMMENT = { pCommentNo: 7, userId: 'isolated_fan', userNick: '[테스트용]', profileImage: '', regDate: '2026-02-03', likeCnt: 5 };
const comments = (pages: Record<number, unknown>): Route => url => {
  const page = Number(new URL(url).searchParams.get('page'));
  const body = pages[page];
  return body === undefined ? new Response('', { status: 503 }) : jsonResponse(body);
};

async function runUp(options: { events?: unknown; eventsError?: boolean; previous?: unknown; previousError?: boolean; route?: Route }) {
  const { fn, calls } = fakeFetch(options.route || comments({ 1: { data: [COMMENT], meta: { lastPage: 1 } } }));
  return { calls, result: await collectUp({
    fetchFn: fn,
    selectEvents: async () => { if (options.eventsError) throw new Error('lookup failed'); return 'events' in options ? options.events : [EVENT]; },
    readPrevious: async () => { if (options.previousError) throw new Error('cache failed'); return ('previous' in options ? options.previous : clone(CACHED)) as Record<string, unknown>; },
    now: () => NOW,
  }) };
}

test('up: soop URL parsing matches check_up.py', () => {
  assert.deepEqual(parseSoopUrl('https://www.sooplive.co.kr/beadyo97/post/160570499'), ['beadyo97', '160570499']);
  assert.deepEqual(parseSoopUrl('https://www.sooplive.com/station/gosegu2/post/199848943#x'), ['gosegu2', '199848943']);
  assert.deepEqual(parseSoopUrl('https://www.sooplive.com/station/gosegu2'), [null, null]);
});

test('up: invalid event payloads throw instead of clearing data', async () => {
  const invalid = [null, false, 0, '', {}, { message: 'temporary error' }, [null], [{}],
    [{ ...EVENT, id: null }], [{ ...EVENT, id: true }], [{ ...EVENT, soop_url: null }], [{ ...EVENT, title: [] }], [EVENT, {}]];
  for (const payload of invalid) {
    assert.throws(() => validateEvents(payload), CollectionError);
    await assert.rejects(runUp({ events: payload }), CollectionError);
  }
  await assert.rejects(runUp({ eventsError: true }), /lookup failed/);
});

test('up: an empty valid event list replaces previous events', async () => {
  const { result, calls } = await runUp({ events: [] });
  assert.deepEqual(result.payload, { updated: '2026-10-17T14:00:00Z', events: [] });
  assert.equal(calls.length, 0);
});

test('up: successful collection replaces the ranking and ranks by likes', async () => {
  const route = comments({
    1: { data: [{ ...COMMENT, likeCnt: 1 }, { ...COMMENT, pCommentNo: 8, userId: 'b', likeCnt: '9' }, { pCommentNo: 0, userId: 'reply' }], meta: { lastPage: '2' } },
    2: { data: [{ ...COMMENT, pCommentNo: 9, userId: 'c', likeCnt: null }, { ...COMMENT, pCommentNo: 10, userId: '' }], meta: { lastPage: 2 } },
  });
  const { result, calls } = await runUp({ route });
  const event = result.payload.events[0] as any;
  assert.deepEqual(event.ranking.map((row: any) => [row.bj_id, row.up_count, row.rank]), [['b', 9, 1], ['isolated_fan', 1, 2], ['c', 0, 3]]);
  assert.equal(event.live_updated_at, '2026-10-17T14:00:00Z');
  assert.equal(event.tab, EVENT.tab_name);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/api-channel\.sooplive\.com\/v1\.1\/channel\/isolated\/post\/1\/comment\?page=1&/);
  assert.equal(result.collectionFailures, 0);
});

test('up: collection failure keeps the cached ranking, URL and time; only tab/title refresh', async () => {
  for (const route of [(() => new Response('', { status: 503 })) as Route,
    (() => new Response('', { status: 403 })) as Route,
    (() => { throw new TypeError('network'); }) as Route,
    comments({ 1: { data: 'x', meta: { lastPage: 1 } } }),
    comments({ 1: { data: [], meta: { lastPage: 3 } } }),
    comments({ 1: { data: [COMMENT], meta: { lastPage: 0 } } }),
    comments({ 1: { data: [COMMENT], meta: { lastPage: true } } }),
    comments({ 1: { data: [{ ...COMMENT, likeCnt: 'many' }], meta: { lastPage: 1 } } }),
    comments({ 1: { data: [COMMENT], meta: { lastPage: 2 } } })]) {
    const { result } = await runUp({ route });
    const event = result.payload.events[0] as any;
    assert.deepEqual(event.ranking, CACHED.events[0].ranking);
    assert.equal(event.live_updated_at, CACHED.events[0].live_updated_at);
    assert.equal(event.soop_url, CACHED.events[0].soop_url);
    assert.equal(event.tab, EVENT.tab_name);
    assert.equal(result.collectionFailures, 1);
  }
});

test('up: failure with an unreadable previous ranking never writes an empty ranking', async () => {
  await assert.rejects(runUp({ previousError: true, route: () => new Response('', { status: 503 }) }), /previous ranking is unavailable/);
  await assert.rejects(runUp({ previous: { events: 'bad' }, route: () => new Response('', { status: 503 }) }), /previous ranking is unavailable/);
});

test('up: a new event without a previous value starts empty; missing cache counts as readable', async () => {
  const { result } = await runUp({ previous: null as any, route: () => new Response('', { status: 503 }) });
  assert.deepEqual((result.payload.events[0] as any).ranking, []);
});

test('up: previous live_updated_at falls back to the payload update time', async () => {
  const previous = clone(CACHED) as any; delete previous.events[0].live_updated_at;
  const { result } = await runUp({ previous, route: () => new Response('', { status: 503 }) });
  assert.equal((result.payload.events[0] as any).live_updated_at, CACHED.updated);
});

test('up: comment pages beyond the cap keep the previous ranking', async () => {
  const route = comments(Object.fromEntries(Array.from({ length: MAX_COMMENT_PAGES + 1 }, (_, index) =>
    [index + 1, { data: [{ ...COMMENT, pCommentNo: index + 1 }], meta: { lastPage: MAX_COMMENT_PAGES + 1 } }])));
  const { fn } = fakeFetch(route);
  assert.equal(await fetchReplies(fn, 'isolated', '1'), null);
});

test('up: unparsable event URL keeps previous ranking without any request', async () => {
  const { result, calls } = await runUp({ events: [{ ...EVENT, soop_url: 'https://www.sooplive.co.kr/isolated' }] });
  assert.deepEqual((result.payload.events[0] as any).ranking, CACHED.events[0].ranking);
  assert.equal(calls.length, 0);
});

// ── cafe (same fixture and cases as scripts/test-cafe-posts.py) ───
const articles = () => clone(FIXTURE.articles);
const notices = () => clone(FIXTURE.notices);

test('cafe: real public fixture normalizes five posts and Korean dates', () => {
  const result = C.publicPosts(articles(), notices(), NOW);
  assert.deepEqual(result.map(post => post.id), ['40216', '40213', '40207', '40203', '40195']);
  assert.equal(result[0].title, '일어나써');
  assert.equal(result[0].publishedAt, '2026-10-17T13:30:34.443+09:00');
  assert.equal(result[1].publishedAt, '2026-10-17T05:43:29.410+09:00');
  assert.equal(result[0].href, 'https://cafe.naver.com/f-e/cafes/31098081/articles/40216');
  assert.deepEqual(Object.keys(result[0]).sort(), ['href', 'id', 'publishedAt', 'title']);
});

test('cafe: shuffled rows sort by date and exact duplicates dedupe', () => {
  const data = articles(); const rows = data.result.articleList;
  rows.reverse(); rows.push(clone(rows[rows.length - 1]));
  assert.deepEqual(C.publicPosts(data, notices(), NOW).map(post => post.id), ['40216', '40213', '40207', '40203', '40195']);
});

test('cafe: notices and non-article rows cannot fill the five posts', () => {
  const data = articles(), pinned = notices();
  pinned.result.articleList.push(clone(data.result.articleList[0]));
  data.result.articleList.unshift({ type: 'NOTICE', item: { subject: 'not a general article' } });
  assert.deepEqual(C.publicPosts(data, pinned, NOW).map(post => post.id), ['40213', '40207', '40203', '40195', '40192']);
});

test('cafe: nonpublic, blind and restricted posts are excluded', () => {
  for (const [field, value] of [['openArticle', false], ['blindArticle', true], ['restrictMenu', true]] as const) {
    const data = articles(); data.result.articleList[0].item[field] = value;
    assert.ok(!C.publicPosts(data, notices(), NOW).some(post => post.id === '40216'));
  }
});

test('cafe: unknown visibility, wrong board and malformed fields fail closed', () => {
  for (const [field, value] of [['menuId', 32], ['cafeId', 1], ['openArticle', null], ['restrictMenu', 'false'],
    ['articleId', true], ['articleId', '40216'], ['subject', '  '], ['writeDateTimestamp', true],
    ['writeDateTimestamp', 1792211434], ['writeDateTimestamp', 9999999999999999]] as const) {
    const data = articles(); data.result.articleList[0].item[field] = value;
    assert.throws(() => C.publicPosts(data, notices(), NOW), CollectionError, `${field}=${value}`);
  }
  const data = articles(); delete data.result.articleList[0].item.blindArticle;
  assert.throws(() => C.publicPosts(data, notices(), NOW), CollectionError);
});

test('cafe: conflicting duplicate and future date are rejected', () => {
  const data = articles(); const duplicate = clone(data.result.articleList[0]);
  duplicate.item.subject = 'inconsistent response'; data.result.articleList.push(duplicate);
  assert.throws(() => C.publicPosts(data, notices(), NOW), CollectionError);
  const future = articles(); future.result.articleList[0].item.writeDateTimestamp = NOW.getTime() + 1;
  assert.throws(() => C.publicPosts(future, notices(), NOW), CollectionError);
});

test('cafe: titles are plain text with decoded entities and normalized spaces', () => {
  const data = articles(); data.result.articleList[0].item.subject = ' \n &lt;img src=x onerror=alert(1)&gt; &amp; 부기\t ';
  assert.equal(C.publicPosts(data, notices(), NOW)[0].title, '<img src=x onerror=alert(1)> & 부기');
  data.result.articleList[0].item.subject = 'invalid\x00title';
  assert.throws(() => C.publicPosts(data, notices(), NOW), CollectionError);
});

test('cafe: title limit uses UTF-16 units after space normalization', () => {
  for (const title of ['가'.repeat(300), '😀'.repeat(150), '가'.repeat(298) + '😀', '  ' + '가'.repeat(300) + ' \n']) {
    assert.equal(C.plainTitle(title), title.trim());
  }
  for (const title of ['가'.repeat(301), '😀'.repeat(150) + '가', '가'.repeat(299) + '😀']) {
    assert.throws(() => C.plainTitle(title), CollectionError);
  }
  // Python whitespace (not JavaScript's): U+001C is whitespace, U+FEFF is a control.
  assert.equal(C.plainTitle('가\x1c나'), '가 나');
  assert.throws(() => C.plainTitle('가﻿나'), CollectionError);
});

test('cafe: invisible format characters and joiner-only titles are rejected', () => {
  for (const character of ['\x00', '\x01', '\x7f', '\x80', '\x9f', '​', '‎', '‏', '‪', '‫',
    '‬', '‭', '‮', '⁠', '⁯', '﻿']) {
    assert.throws(() => C.plainTitle('일정' + character + '제목'), CollectionError);
  }
  for (const title of ['‌', '‍', ' ‌‍ ‌ ']) assert.throws(() => C.plainTitle(title), CollectionError);
  assert.equal(C.plainTitle('가족 👨‍👩‍👧‍👦'), '가족 👨‍👩‍👧‍👦');
});

test('cafe: board header must match; login page or another board is not an empty success', () => {
  C.validateBoard(FIXTURE.boardHtml);
  for (const html of ['<title>슬요 똥글</title><p>로그인해 주세요</p>', FIXTURE.boardHtml.replaceAll('💩슬요 똥글💩', '다른 게시판'), '',
    '<div class="BoardHeaderTitle"><h3>슬요 똥글</h3><h3>슬요 똥글</h3></div>',
    '<div class="NotBoardHeaderTitle"><h3>슬요 똥글</h3></div>',
    '<script>"<div class=\\"BoardHeaderTitle\\"><h3>슬요 똥글</h3></div>"</script>']) {
    assert.throws(() => C.validateBoard(html), CollectionError);
  }
  C.validateBoard('<div class="x BoardHeaderTitle"><span><h3> 💩슬요&#32;똥글💩️ </h3></span></div>');
  const empty = { result: { articleList: [] } };
  assert.deepEqual(C.publicPosts(empty, notices(), NOW), []);
  for (const invalid of [{ error: 'login required' }, { result: {} }, { result: { articleList: null } }]) {
    assert.throws(() => C.publicPosts(invalid, notices(), NOW), CollectionError);
  }
});

test('cafe: collector requests the three public sources with exact content types and no credentials', async () => {
  const sources: Record<string, [string, string]> = {
    [C.BOARD_URL]: [FIXTURE.boardHtml, 'text/html; charset=utf-8'],
    [C.ARTICLES_URL]: [JSON.stringify(FIXTURE.articles), 'application/json'],
    [C.NOTICES_URL]: [JSON.stringify(FIXTURE.notices), 'application/json;charset=UTF-8'],
  };
  const { fn, calls } = fakeFetch(url => {
    const source = sources[url]; if (!source) throw new Error(`unexpected ${url}`);
    return new Response(source[0], { headers: { 'Content-Type': source[1] } });
  });
  const payload = await C.collectCafe(C.publicFetcher(fn), NOW);
  assert.deepEqual(Object.keys(payload).sort(), ['boardTitle', 'cafeId', 'fetchedAt', 'menuId', 'posts', 'schemaVersion']);
  assert.equal(payload.fetchedAt, '2026-10-17T14:00:00.000Z');
  assert.equal(payload.posts.length, 5);
  assert.deepEqual(calls.map(call => call.url), [C.BOARD_URL, C.ARTICLES_URL, C.NOTICES_URL]);
  for (const call of calls) {
    assert.equal(call.init?.credentials, 'omit'); assert.equal(call.init?.redirect, 'manual');
    assert.ok(!Object.keys(call.init?.headers as object).some(name => /cookie|authorization|apikey/i.test(name)));
  }
  const wrongType = fakeFetch(() => new Response('{}', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(C.collectCafe(C.publicFetcher(wrongType.fn), NOW), CollectionError);
});

test('cafe: output matches the committed Python cache format', () => {
  const sample = JSON.parse(readFileSync(new URL('../../../../data/cafe-posts.json', import.meta.url), 'utf8'));
  assert.equal(sample.schemaVersion, 1);
  assert.match(sample.fetchedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  for (const post of sample.posts) assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/);
  const ours = C.publicPosts(articles(), notices(), NOW)[0];
  assert.match(ours.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/);
});

// ── store ─────────────────────────────────────────────────────────
test('store: keys per mode, key headers, and project-only requests', async () => {
  assert.equal(cacheKey('live', 'shadow'), 'live_status__edge');
  assert.equal(cacheKey('up', 'live'), 'up_ranking');
  assert.equal(cacheKey('cafe', 'live'), 'cafe_posts');
  assert.deepEqual(keyHeaders('sb_secret_x'), { apikey: 'sb_secret_x' });
  assert.deepEqual(keyHeaders('eyJ.legacy'), { apikey: 'eyJ.legacy', Authorization: 'Bearer eyJ.legacy' });
  assert.throws(() => createStore(forbidden as any, 'https://evil.example', 'k'));
  assert.throws(() => createStore(forbidden as any, 'https://qlmcwobfldgmhwhptkfz.supabase.co', ''));
  const { fn, calls } = fakeFetch(url => url.includes('on_conflict') ? new Response(null, { status: 201 }) : jsonResponse([]));
  const store = createStore(fn, 'https://qlmcwobfldgmhwhptkfz.supabase.co', 'sb_secret_test');
  assert.equal(await store.read('up_ranking__edge'), null);
  await store.write('live_status__edge', { live: false }, '2026-10-17T14:00:00Z');
  assert.equal(calls[0].url, 'https://qlmcwobfldgmhwhptkfz.supabase.co/rest/v1/site_runtime_cache?cache_key=eq.up_ranking__edge&select=payload');
  assert.equal(calls[1].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), [{ cache_key: 'live_status__edge', payload: { live: false }, updated_at: '2026-10-17T14:00:00Z' }]);
  assert.ok(calls.every(call => call.url.startsWith('https://qlmcwobfldgmhwhptkfz.supabase.co/rest/v1/')));
  const bad = createStore(async () => jsonResponse([{ payload: [] }]), 'https://qlmcwobfldgmhwhptkfz.supabase.co', 'sb_secret_test');
  await assert.rejects(bad.read('x'), CollectionError);
});

// ── handler ───────────────────────────────────────────────────────
function memoryStore(initial: Record<string, unknown> = {}) {
  const rows = new Map(Object.entries(initial)); const writes: [string, unknown][] = [];
  const store: Store = {
    async read(key) { return (rows.get(key) as Record<string, unknown>) ?? null; },
    async write(key, payload) { writes.push([key, payload]); rows.set(key, payload); },
    async selectActiveUpEvents() { return [EVENT]; },
  };
  return { store, writes };
}
const request = (body: unknown, secret: string | null = SECRET, method = 'POST') => new Request('http://local/runtime-collector', {
  method, headers: secret === null ? {} : { 'x-collector-secret': secret }, body: method === 'POST' ? JSON.stringify(body) : undefined,
});

test('handler: auth, method, mode and job checks happen before any network or store use', async () => {
  let storeUsed = 0;
  const config = { secret: SECRET, mode: 'shadow', fetchFn: forbidden as any, store: () => { storeUsed++; return memoryStore().store; } };
  assert.equal((await handle(request({ job: 'live' }, null), config)).status, 401);
  assert.equal((await handle(request({ job: 'live' }, 'b'.repeat(64)), config)).status, 401);
  assert.equal((await handle(request({ job: 'live' }, SECRET.slice(1)), config)).status, 401);
  assert.equal((await handle(request(null, SECRET, 'GET'), config)).status, 405);
  assert.equal((await handle(request({ job: 'drop' }), config)).status, 400);
  assert.equal((await handle(request({ job: 'live' }), { ...config, secret: 'short' })).status, 500);
  assert.equal((await handle(request({ job: 'live' }), { ...config, secret: undefined })).status, 500);
  assert.equal((await handle(request({ job: 'live' }), { ...config, mode: 'production' })).status, 500);
  assert.equal(storeUsed, 0);
  assert.equal(resolveMode(undefined), 'shadow');
  assert.equal(await secretMatches(SECRET, SECRET), true);
  assert.equal(await secretMatches('', ''), false);
});

test('handler: shadow mode writes only the __edge key', async () => {
  const { store, writes } = memoryStore();
  const fetchFn = async () => jsonResponse({ station: { user_id: 'beadyo97' }, broad: { broad_no: 1, broad_title: '방송' } });
  const response = await handle(request({ job: 'live' }), { secret: SECRET, mode: undefined, fetchFn, store: () => store, now: () => NOW });
  assert.equal(response.status, 200);
  assert.deepEqual(writes, [['live_status__edge', { live: true, title: '방송', updated: '2026-10-17T14:00:00Z' }]]);
});

test('handler: failed collection returns 502 and writes nothing', async () => {
  for (const job of ['live', 'cafe']) {
    const { store, writes } = memoryStore();
    const response = await handle(request({ job }), { secret: SECRET, mode: 'live', fetchFn: async () => new Response('', { status: 503 }), store: () => store });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).saved, false);
    assert.deepEqual(writes, []);
  }
  const { store, writes } = memoryStore();
  store.read = async () => { throw new Error('cache down'); };
  const response = await handle(request({ job: 'up' }), { secret: SECRET, mode: 'live', fetchFn: async () => new Response('', { status: 503 }), store: () => store });
  assert.equal(response.status, 502);
  assert.deepEqual(writes, []);
});

test('handler: live mode up job keeps the previous production ranking on SOOP failure', async () => {
  const { store, writes } = memoryStore({ up_ranking: clone(CACHED) });
  const response = await handle(request({ job: 'up' }), { secret: SECRET, mode: 'live', fetchFn: async () => new Response('', { status: 403 }), store: () => store, now: () => NOW });
  assert.equal(response.status, 200);
  assert.equal(writes[0][0], 'up_ranking');
  assert.deepEqual((writes[0][1] as any).events[0].ranking, CACHED.events[0].ranking);
});
