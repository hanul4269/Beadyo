// Run with: node --test scripts/test-unified-search.cjs
// Fixtures below are synthetic; reviewed series membership comes from the existing registry.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Series = require('../content-series.js');
const source = fs.readFileSync(require.resolve('../beadyo-common.js'), 'utf8');

function harness(reader = async () => ({ data: [], error: null }), options = {}) {
    const storage = new Map(options.storage || []);
    const calls = [];
    let now = options.now || Date.parse('2026-10-11T00:00:00Z');
    class Clock extends Date { static now() { return now; } }
    const localStorage = {
        getItem(key) { if (options.blockStorage) throw Error('Storage blocked'); return storage.get(key) ?? null; },
        setItem(key, value) { if (options.blockStorage) throw Error('Storage blocked'); storage.set(key, value); },
        removeItem(key) { if (options.blockStorage) throw Error('Storage blocked'); storage.delete(key); },
    };
    const client = { from(table) {
        let columns;
        const query = {
            select(value) { columns = value; return query; },
            order() { return query; },
            abortSignal() { return query; },
            async range(from, to) {
                calls.push({ table, columns, from, to });
                return reader(table, from, to);
            },
        };
        return query;
    } };
    const document = { addEventListener() {}, querySelector() { return null; }, readyState: 'loading' };
    const window = {
        location: new URL('http://localhost:3000/index.html'),
        localStorage, sessionStorage: localStorage,
        supabase: { createClient: () => client },
        BeadyoContentSeries: Series,
        addEventListener() {},
    };
    window.top = window.self = window.parent = window;
    const context = vm.createContext({ window, document, Date: Clock, URL, URLSearchParams,
        AbortController, setTimeout: (callback, ms) => setTimeout(callback, options.deadlineMs && ms === 12000 ? options.deadlineMs : ms),
        clearTimeout, console, localStorage, sessionStorage: localStorage,
        fetch() { throw Error('Unified search must not query video platforms'); } });
    vm.runInContext(source, context);
    return { api: window.BeadyoCommon, calls, storage, advance(ms) { now += ms; }, now: () => now };
}

function fixtures() {
    const reviewedId = Object.keys(Series.reviewed).find(id => Series.reviewed[id].series_id === 'guquiz');
    return {
        songbookRows: [
            { id: 'song-a', title: 'Blue Moon', artist: '테스트 가수', category: 'K-POP', memo: '', tags: [] },
            { id: 'song-b', title: '밤편지', artist: '아이유', tags: [] },
        ],
        liveRows: [
            { id: 'live-a', title: 'Blue Moon', artist: '테스트 가수', performed_date: '2026-10-01' },
            { id: 'live-b', title: 'Blue Moon', artist: '테스트 가수', performed_date: '2026-10-02' },
        ],
        contentRows: [
            { id: reviewedId, title: '테스트 손님과의 대화', broadcast_date: '2026-09-30', tags: [] },
            { id: 'content-exact', title: '여름 이야기', summary: '등록된 회차 요약', broadcast_date: '2026-10-01', tags: ['beadyo-series:guquiz', 'beadyo-episode:7'] },
            { id: 'content-partial', title: '여름 이야기 다시 보기', broadcast_date: '2026-10-02', tags: [] },
        ],
        musicRows: [
            { id: 'music-a', title: 'Blue Moon', type: 'cover', collab: '함께한 가수', upload_date: '2026-10-01', youtube_url: 'https://youtu.be/abcdefghijk' },
            { id: 'music-b', title: 'Blue Moon', type: 'live', upload_date: '2026-10-02', youtube_url: 'https://youtu.be/lmnopqrstuv' },
        ],
    };
}
const section = (result, type) => result.sections.find(row => row.type === type);
const keys = rows => Array.from(rows, row => row.key);
const json = value => JSON.parse(JSON.stringify(value));
function readerFor(rows, onRead = () => {}) {
    const byTable = { songbook: rows.songbookRows, live_songs: rows.liveRows, content_archive: rows.contentRows, youtube_songs: rows.musicRows };
    return async (table, from, to) => {
        onRead(table);
        assert.ok(Object.hasOwn(byTable, table), `Unexpected source ${table}`);
        return { data: byTable[table].slice(from, to + 1), error: null };
    };
}

test('one title searches MUSIC, SONGBOOK and each LIVE record without merging distinct IDs', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    const result = api.searchUnifiedCatalog(entries, 'Blue Moon');
    assert.equal(section(result, 'music').total, 2);
    assert.equal(section(result, 'songbook').total, 1);
    assert.equal(section(result, 'live').total, 2);
    assert.equal(result.total, 5);
    assert.equal(new Set(keys(result.items)).size, 5);
    assert.equal(new Set(section(result, 'music').items.map(item => item.href)).size, 2);
    assert.equal(new Set(section(result, 'live').items.map(item => item.href)).size, 2);
});

test('repeated source IDs are removed while records with matching titles remain separate', () => {
    const { api } = harness();
    const rows = fixtures();
    for (const type of ['songbookRows', 'liveRows', 'contentRows', 'musicRows']) rows[type].push({ ...rows[type][0] });
    const result = api.searchUnifiedCatalog(api.createUnifiedCatalog(rows), 'blue moon');
    assert.equal(result.total, 5);
    assert.equal(new Set(keys(result.items)).size, result.items.length);
});

test('each result uses the existing page with an ID-specific destination', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    for (const [type, id, pathname, params] of [
        ['content', 'content-exact', '/content.html', { content: 'content-exact' }],
        ['music', 'music-a', '/songs.html', { video: 'music-a' }],
        ['live', 'live-a', '/songbook.html', { view: 'live', record: 'live-a' }],
        ['songbook', 'song-a', '/songbook.html', { view: 'songbook', song: 'song-a', detail: '1' }],
    ]) {
        const entry = entries.find(item => item.type === type && item.id === id);
        assert.ok(entry, `${type}: ${id}`);
        const route = new URL(entry.href, 'http://localhost:3000');
        assert.equal(route.origin, 'http://localhost:3000');
        assert.equal(route.pathname, pathname);
        for (const [param, value] of Object.entries(params)) assert.equal(route.searchParams.get(param), value);
    }
});

test('case and surrounding whitespace do not change matches, and legacy choseong search remains available', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    assert.deepEqual(keys(api.searchUnifiedCatalog(entries, '  bLuE mOoN \t').items), keys(api.searchUnifiedCatalog(entries, 'Blue Moon').items));
    assert.equal(section(api.searchUnifiedCatalog(entries, 'ㅂㅍㅈ'), 'songbook').total, 1);
    assert.equal(api.searchUnifiedCatalog(entries, 'ㅂ').total, 0);
});

test('series search reuses reviewed and explicit membership; exact episode titles rank first', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    const series = api.searchUnifiedCatalog(entries, '구퀴즈');
    assert.equal(section(series, 'content').total, 2);
    assert.ok(section(series, 'shortcut').items.some(item => new URL(item.href, 'http://localhost:3000').searchParams.get('series') === 'guquiz'));
    const episode = section(api.searchUnifiedCatalog(entries, '여름 이야기'), 'content');
    assert.equal(episode.total, 2);
    assert.equal(episode.items[0].title, '여름 이야기');
    assert.equal(new URL(episode.items[0].href, 'http://localhost:3000').searchParams.get('content'), 'content-exact');
});

test('dedicated page aliases resolve equally in Korean and English, without unrelated shortcuts', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    for (const [queries, pathname] of [
        [['GEMBOX', ' gEmBoX ', '보석함'], '/gembox.html'],
        [['TRACTOR SERVICE', 'tractor service', '트랙터서비스'], '/tractor-service.html'],
    ]) for (const query of queries) {
        const matches = section(api.searchUnifiedCatalog(entries, query), 'shortcut');
        assert.ok(matches?.items.some(item => new URL(item.href, 'http://localhost:3000').pathname === pathname), query);
    }
    assert.equal(section(api.searchUnifiedCatalog(entries, 'Blue Moon'), 'shortcut'), undefined);
});

test('per-type preview limits keep exact totals and expanding one type retains the others', () => {
    const { api } = harness();
    const rows = fixtures();
    rows.contentRows = Array.from({ length: 7 }, (_, i) => ({ id: `content-${i}`, title: `검색 시험 콘텐츠 ${i}`, tags: [] }));
    rows.musicRows = Array.from({ length: 5 }, (_, i) => ({ id: `music-${i}`, title: `검색 시험 음악 ${i}`, youtube_url: `https://youtu.be/fixture${i}xxx` }));
    const entries = api.createUnifiedCatalog(rows);
    const preview = api.searchUnifiedCatalog(entries, '검색 시험');
    assert.equal(preview.total, 12);
    assert.equal(section(preview, 'content').total, 7);
    assert.equal(section(preview, 'music').total, 5);
    assert.ok(section(preview, 'content').items.length >= 2 && section(preview, 'content').items.length <= 3);
    const expanded = api.searchUnifiedCatalog(entries, preview.query, { limits: { content: 7 } });
    assert.equal(expanded.total, 12);
    assert.equal(expanded.query, preview.query);
    assert.equal(section(expanded, 'content').items.length, 7);
    assert.deepEqual(keys(section(expanded, 'music').items), keys(section(preview, 'music').items));
    assert.equal(expanded.sections.some(s => s.total === 0), false);
});

test('empty query and no matching result expose no empty result sections', () => {
    const { api } = harness();
    const entries = api.createUnifiedCatalog(fixtures());
    for (const query of ['', '   ', '존재하지않는검색어qzx987']) {
        const result = api.searchUnifiedCatalog(entries, query);
        assert.equal(result.total, 0);
        assert.equal(result.sections.length, 0);
        assert.equal(result.items.length, 0);
    }
});

test('a failed source leaves normal results visible and retries only the incomplete source', async () => {
    const rows = fixtures();
    let fail = true;
    const reader = readerFor(rows);
    const h = harness((table, from, to) => table === 'content_archive' && fail
        ? Promise.resolve({ data: null, error: { message: 'Content unavailable' } }) : reader(table, from, to));
    const first = await h.api.loadUnifiedSearchData();
    assert.ok(first.errors.content);
    assert.equal(first.sourceStates.content, 'error');
    assert.equal(first.sourceStates.music, 'success');
    assert.equal(first.musicRows.length, 2);
    assert.equal(h.api.searchUnifiedCatalog(first.entries, 'Blue Moon').total, 5);
    assert.equal(first.contentRows.length, 0);
    fail = false;
    const second = await h.api.loadUnifiedSearchData();
    assert.equal(Object.keys(second.errors).length, 0);
    assert.equal(second.sourceStates.content, 'success');
    assert.equal(second.contentRows.length, 3);
    const counts = h.calls.reduce((all, { table }) => { all[table] = (all[table] || 0) + 1; return all; }, {});
    assert.deepEqual(counts, { songbook: 1, live_songs: 1, content_archive: 2, youtube_songs: 1 });
});

test('successful data survives reload in cache, expires after one hour, and force refreshes every source', async () => {
    const h = harness(readerFor(fixtures()));
    const first = await h.api.loadUnifiedSearchData();
    assert.equal(h.calls.length, 4);
    await h.api.loadUnifiedSearchData();
    assert.equal(h.calls.length, 4);
    const reload = harness(readerFor(fixtures()), { storage: h.storage, now: h.now() });
    assert.equal((await reload.api.loadUnifiedSearchData()).entries.length, first.entries.length);
    assert.equal(reload.calls.length, 0);
    reload.advance(60 * 60 * 1000 + 1);
    await reload.api.loadUnifiedSearchData();
    assert.equal(reload.calls.length, 4);
    await reload.api.loadUnifiedSearchData({ force: true });
    assert.equal(reload.calls.length, 8);
});

test('an incomplete persisted cache retries a failed source after reload', async () => {
    const reader = readerFor(fixtures());
    const first = harness((table, from, to) => table === 'youtube_songs'
        ? Promise.resolve({ data: null, error: { message: 'Offline' } }) : reader(table, from, to));
    await first.api.loadUnifiedSearchData();
    const reload = harness(reader, { storage: first.storage, now: first.now() });
    const result = await reload.api.loadUnifiedSearchData();
    assert.equal(result.musicRows.length, 2);
    assert.equal(Object.keys(result.errors).length, 0);
    assert.deepEqual(reload.calls.map(call => call.table), ['youtube_songs']);
});

test('a rejected source promise is isolated; successful empty sources are cached as success', async () => {
    const h = harness(async table => {
        if (table === 'content_archive') throw Error('Network disconnected');
        return { data: [], error: null };
    });
    const result = await h.api.loadUnifiedSearchData();
    assert.ok(result.errors.content);
    assert.equal(result.sourceStates.content, 'error');
    for (const type of ['songbook', 'live', 'music']) assert.equal(result.sourceStates[type], 'success');
    assert.equal(section(h.api.searchUnifiedCatalog(result.entries, '보석함'), 'shortcut').total, 1);
    await h.api.loadUnifiedSearchData();
    assert.equal(h.calls.length, 5);
});

test('a stalled source times out independently and remains retryable', { timeout: 1000 }, async () => {
    let stalled = true;
    const reader = readerFor(fixtures());
    const h = harness((table, from, to) => table === 'content_archive' && stalled
        ? new Promise(() => {}) : reader(table, from, to), { deadlineMs: 10 });
    const first = await h.api.loadUnifiedSearchData();
    assert.equal(first.sourceStates.content, 'error');
    assert.match(first.errors.content, /초과/);
    assert.equal(h.api.searchUnifiedCatalog(first.entries, 'Blue Moon').total, 5);
    stalled = false;
    const second = await h.api.loadUnifiedSearchData();
    assert.equal(second.sourceStates.content, 'success');
    assert.equal(second.contentRows.length, 3);
    assert.equal(h.calls.length, 5);
});

test('malformed successful responses are errors rather than cached empty sources', async () => {
    for (const invalid of [null, {}, 'invalid']) {
        const h = harness(async table => ({ data: table === 'youtube_songs' ? invalid : [], error: null }));
        const first = await h.api.loadUnifiedSearchData();
        assert.equal(first.sourceStates.music, 'error');
        assert.ok(first.errors.music);
        await h.api.loadUnifiedSearchData();
        assert.equal(h.calls.length, 5);
    }
});

test('corrupt and future persisted caches cannot suppress fresh source reads', async () => {
    const base = harness(readerFor(fixtures()));
    await base.api.loadUnifiedSearchData();
    const [key, raw] = [...base.storage].find(([, value]) => JSON.parse(value).version === 2);
    const future = JSON.parse(raw);
    for (const cached of Object.values(future.sources)) cached.fetchedAt = base.now() + 86400000;
    for (const value of ['not JSON', JSON.stringify(future)]) {
        const reload = harness(readerFor(fixtures()), { storage: [[key, value]], now: base.now() });
        assert.equal((await reload.api.loadUnifiedSearchData()).musicRows.length, 2);
        assert.equal(reload.calls.length, 4);
    }
});

test('overlapping loads share pending source requests', async () => {
    const pending = [];
    const h = harness(() => new Promise(resolve => pending.push(resolve)));
    const first = h.api.loadUnifiedSearchData();
    const second = h.api.loadUnifiedSearchData({ force: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 4);
    pending.forEach(resolve => resolve({ data: [], error: null }));
    const results = await Promise.all([first, second]);
    assert.deepEqual(json(results[0].entries), json(results[1].entries));
    assert.equal(h.calls.length, 4);
});

test('pagination includes all source rows; a failed later page never becomes a successful partial source', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ id: `song-${i}`, title: `곡 ${i}`, artist: '가수' }));
    let failLastPage = true;
    const h = harness(async (table, from, to) => {
        if (table !== 'songbook') return { data: [], error: null };
        if (from > 0 && failLastPage) return { data: null, error: { message: 'Last page failed' } };
        return { data: many.slice(from, to + 1), error: null };
    });
    const incomplete = await h.api.loadUnifiedSearchData();
    assert.ok(incomplete.errors.songbook);
    assert.equal(incomplete.songbookRows.length, 0);
    failLastPage = false;
    const complete = await h.api.loadUnifiedSearchData();
    assert.equal(complete.songbookRows.length, 1001);
    assert.equal(Object.keys(complete.errors).length, 0);
});

test('blocked local storage does not prevent useful search results or repeat network reads', async () => {
    const h = harness(readerFor(fixtures()), { blockStorage: true });
    assert.equal((await h.api.loadUnifiedSearchData()).musicRows.length, 2);
    assert.equal((await h.api.loadUnifiedSearchData()).musicRows.length, 2);
    assert.equal(h.calls.length, 4);
});

function sectionSource(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `Missing shared search section ${start}`);
    return source.slice(from, to);
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function queryHarness() {
    const pending = [], rendered = [], errors = [];
    const ui = { loading: false, querySequence: 0, limits: {}, result: null, activeIndex: -1 };
    const state = { data: null };
    const context = vm.createContext({
        unifiedSearchUiState: ui, unifiedSearchState: state,
        loadUnifiedSearchData: () => { const request = deferred(); pending.push(request); return request.promise; },
        searchUnifiedCatalog: (_, query) => ({ query }),
        renderUnifiedSearchResult: result => rendered.push(result.query),
        renderUnifiedSearchError: error => errors.push(error.message),
    });
    vm.runInContext(sectionSource('    async function runUnifiedSearch(', '    function setUnifiedSearchActiveIndex('), context);
    return { context, ui, state, pending, rendered, errors };
}

test('late query success or failure cannot overwrite a newer query', async () => {
    for (const failOld of [false, true]) {
        const h = queryHarness();
        const oldQuery = h.context.runUnifiedSearch('old query');
        const newQuery = h.context.runUnifiedSearch('new query');
        h.pending[1].resolve({ entries: [] });
        await newQuery;
        if (failOld) h.pending[0].reject(Error('late failure'));
        else h.pending[0].resolve({ entries: [] });
        await oldQuery;
        assert.deepEqual(h.rendered, ['new query']);
        assert.deepEqual(h.errors, []);
    }
});

test('typing invalidates a pending old result immediately, before debounce runs', async () => {
    const h = queryHarness();
    const listeners = {};
    const input = { value: 'new query', addEventListener: (type, fn) => { listeners[type] = fn; } };
    const overlay = { querySelector: selector => selector === '[data-beadyo-search-input]' ? input : { addEventListener() {} }, addEventListener() {} };
    let debounce;
    Object.assign(h.context, {
        document: { querySelector: () => null, createElement: () => ({ firstElementChild: overlay }), body: { append() {} } },
        addUnifiedSearchStyles() {}, unifiedSearchModalHtml: () => '', closeUnifiedSearch() {},
        UNIFIED_SEARCH_CONFIG: { debounceMs: 250 }, clearTimeout() {}, setTimeout: fn => { debounce = fn; },
    });
    vm.runInContext(sectionSource('    function ensureUnifiedSearchModal(', '    function skillStars('), h.context);
    h.context.ensureUnifiedSearchModal();
    const oldQuery = h.context.runUnifiedSearch('old query');
    listeners.input();
    h.pending[0].resolve({ entries: [] });
    await oldQuery;
    assert.deepEqual(h.rendered, []);
    const latest = debounce();
    h.pending[1].resolve({ entries: [] });
    await latest;
    assert.deepEqual(h.rendered, ['new query']);
});

test('initial loading searches the latest typed value after source completion', async () => {
    const h = queryHarness();
    const input = { value: 'before loading' };
    const loadingStates = [];
    Object.assign(h.context, {
        document: { querySelector: () => input },
        renderUnifiedSearchLoading: () => loadingStates.push('loading'),
    });
    vm.runInContext(sectionSource('    async function prepareUnifiedSearch(', '    async function runUnifiedSearch('), h.context);
    const preparation = h.context.prepareUnifiedSearch();
    assert.equal(h.ui.loading, true);
    input.value = 'latest query';
    h.state.data = { entries: [] };
    h.pending[0].resolve(h.state.data);
    await preparation;
    assert.equal(h.ui.loading, false);
    assert.deepEqual(loadingStates, ['loading']);
    assert.deepEqual(h.rendered, ['latest query']);
});

test('loading, empty, partial failure and populated results render distinct messages', () => {
    const { api } = harness();
    const summary = { textContent: '' }, results = { innerHTML: '', scrollTop: 0 };
    const input = { removeAttribute() {} };
    const overlay = { querySelector: selector => selector === '[data-beadyo-search-summary]' ? summary
        : selector === '[data-beadyo-search-input]' ? input : results };
    const state = { data: { errors: {} } };
    const context = vm.createContext({
        document: { querySelector: () => overlay }, esc: api.esc,
        unifiedSearchUiState: {}, unifiedSearchState: state,
        SEARCH_SOURCES: { content: { label: '콘텐츠' }, music: { label: '음악 영상' }, songbook: { label: '노래책' }, live: { label: '방송 노래 기록' } }, setUnifiedSearchActiveIndex() {},
        console: { error() {} },
    });
    vm.runInContext(sectionSource('    function unifiedSearchResultHtml(', '    async function prepareUnifiedSearch('), context);
    context.renderUnifiedSearchLoading();
    assert.match(summary.textContent, /불러오는 중/);
    assert.match(results.innerHTML, /beadyo-search-loading/);
    const empty = api.searchUnifiedCatalog([], '없는 자료');
    context.renderUnifiedSearchResult(empty);
    assert.match(summary.textContent, /0개/);
    assert.match(results.innerHTML, /검색 결과가 없어요/);
    assert.doesNotMatch(results.innerHTML, /조회 실패/);
    state.data.errors.content = 'Offline';
    context.renderUnifiedSearchResult(empty);
    assert.match(results.innerHTML, /콘텐츠 조회 실패/);
    assert.match(results.innerHTML, /일부 자료를 조회하지 못했어요/);
    assert.doesNotMatch(results.innerHTML, /검색 결과가 없어요/);
    const matches = api.searchUnifiedCatalog(api.createUnifiedCatalog(fixtures()), 'Blue Moon');
    context.renderUnifiedSearchResult(matches);
    assert.match(summary.textContent, /5개/);
    assert.match(results.innerHTML, /조회 실패/);
    assert.match(results.innerHTML, /음악 영상/);
    assert.match(results.innerHTML, /노래책/);
    assert.match(results.innerHTML, /방송 노래 기록/);
    assert.match(results.innerHTML, /1곡/);
    state.data.errors = { content: 'Offline', music: 'Offline', songbook: 'Offline', live: 'Offline' };
    context.renderUnifiedSearchResult(empty);
    assert.match(summary.textContent, /검색 자료 조회 실패/);
    assert.doesNotMatch(summary.textContent, /0개/);
    assert.match(results.innerHTML, /검색 자료를 불러오지 못했어요/);
});

function keyEvent(key, target, extra = {}) {
    return { key, target, prevented: 0, stopped: 0,
        preventDefault() { this.prevented++; }, stopImmediatePropagation() { this.stopped++; }, ...extra };
}
test('keyboard opening preserves the original opener, traps foreground focus and closes only search', () => {
    const timers = [], listeners = {}, moves = [];
    let selections = 0;
    const document = { activeElement: null, addEventListener: (type, fn) => { listeners[type] = fn; },
        documentElement: { classList: { add() {}, remove() {} } } };
    const node = (name, isInput = false) => ({ name, isConnected: true, matches: () => isInput,
        focus() { document.activeElement = this; } });
    const opener = node('header'), close = node('close'), input = node('input', true), link = node('result');
    input.value = '구퀴즈';
    const classes = new Set();
    const overlay = { hidden: true, inert: true,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
        querySelector: () => input, querySelectorAll: () => [close, input, link],
        contains: value => [close, input, link].includes(value) };
    document.querySelector = () => overlay;
    document.activeElement = opener;
    const global = { location: { href: 'http://localhost:3000/index.html', origin: 'http://localhost:3000' }, history: { state: null } };
    global.self = global.top = global;
    const ui = { loading: false, querySequence: 0 };
    const context = vm.createContext({ document, global, unifiedSearchUiState: ui,
        unifiedSearchState: { data: { errors: {}, sources: {} } },
        ensureUnifiedSearchModal: () => overlay, requestAnimationFrame: fn => fn(),
        runUnifiedSearch() {}, prepareUnifiedSearch() {}, renderUnifiedSearchError() {},
        clearTimeout() {}, setTimeout: fn => timers.push(fn),
        moveUnifiedSearchActive: delta => moves.push(delta), selectUnifiedSearchResult: () => { selections++; },
        Date, UNIFIED_SEARCH_CACHE_TTL_MS: 3600000,
    });
    vm.runInContext(sectionSource('    function openUnifiedSearch()', '    function buildStandaloneSearchButton('), context);
    vm.runInContext(sectionSource('    // Existing video dialogs also own a focus guard.', '    const STANDALONE_PAGES'), context);
    for (const modifier of ['metaKey', 'ctrlKey']) {
        const event = keyEvent('k', input, { [modifier]: true });
        context.handleUnifiedSearchKeydown(event);
        assert.equal(event.prevented, 1);
        assert.equal(document.activeElement, input);
        assert.equal(ui.lastFocused, opener);
        assert.equal(overlay.inert, false);
    }
    document.activeElement = opener;
    const outsideTab = keyEvent('Tab', opener);
    context.handleUnifiedSearchKeydown(outsideTab);
    assert.equal(document.activeElement, close);
    assert.equal(outsideTab.stopped, 1);
    const backward = keyEvent('Tab', close, { shiftKey: true });
    context.handleUnifiedSearchKeydown(backward);
    assert.equal(document.activeElement, link);
    const forward = keyEvent('Tab', link);
    context.handleUnifiedSearchKeydown(forward);
    assert.equal(document.activeElement, close);
    const escapedFocus = keyEvent('', opener);
    listeners.focusin(escapedFocus);
    assert.equal(document.activeElement, input);
    assert.equal(escapedFocus.stopped, 1);
    context.handleUnifiedSearchKeydown(keyEvent('ArrowDown', input));
    context.handleUnifiedSearchKeydown(keyEvent('ArrowUp', input));
    assert.deepEqual(moves, [1, -1]);
    ui.activeIndex = 0;
    context.handleUnifiedSearchKeydown(keyEvent('Enter', link));
    context.handleUnifiedSearchKeydown(keyEvent('Enter', input));
    assert.equal(selections, 1);
    const escape = keyEvent('Escape', input);
    context.handleUnifiedSearchKeydown(escape);
    assert.equal(escape.prevented, 1);
    assert.equal(escape.stopped, 1);
    assert.equal(document.activeElement, opener);
    assert.equal(overlay.inert, true);
    timers.forEach(fn => fn());
    assert.equal(overlay.hidden, true);
});

test('navigation saves search state; duplicate startup events cannot overwrite fresh input, while back-cache restores it', () => {
    const listeners = {}, destinations = [];
    let opens = 0;
    const input = { value: '구퀴즈' }, results = { scrollTop: 127 };
    const overlay = { querySelector: selector => selector === '[data-beadyo-search-input]' ? input : results };
    const item = { key: 'content:episode-7', href: 'content.html?content=episode-7' };
    const ui = { activeIndex: 0, result: { items: [item] }, limits: { content: 13 } };
    const history = { state: { existing: 'preserved' }, replaceState(value) { this.state = value; } };
    const global = { history, location: { href: 'http://localhost:3000/index.html#content', assign: href => destinations.push(href) },
        addEventListener: (type, fn) => { listeners[type] = fn; } };
    global.self = global.top = global;
    const context = vm.createContext({ global, URL, unifiedSearchUiState: ui,
        document: { querySelector: () => overlay, addEventListener: (type, fn) => { listeners[type] = fn; } },
        ensureUnifiedSearchModal: () => overlay, openUnifiedSearch: () => { opens++; } });
    vm.runInContext(sectionSource('    function selectUnifiedSearchResult(', '    function openUnifiedSearch()'), context);
    context.selectUnifiedSearchResult();
    assert.deepEqual(destinations, ['http://localhost:3000/content.html?content=episode-7']);
    assert.equal(history.state.existing, 'preserved');
    assert.deepEqual(json(history.state.beadyoSearch), { open: true, query: '구퀴즈', limits: { content: 13 }, activeKey: item.key, scrollTop: 127 });
    input.value = '';
    listeners.DOMContentLoaded({ type: 'DOMContentLoaded' });
    assert.equal(input.value, '구퀴즈');
    assert.equal(opens, 1);
    assert.deepEqual(json(ui.limits), { content: 13 });
    assert.equal(ui.restore.scrollTop, 127);
    input.value = '새로운 검색어';
    listeners.pageshow({ persisted: false });
    assert.equal(input.value, '새로운 검색어');
    assert.equal(opens, 1);
    listeners.pageshow({ persisted: true });
    assert.equal(input.value, '구퀴즈');
    assert.equal(opens, 2);
});

test('final type expansion keeps query and scroll position and focuses the first newly shown result', async () => {
    const listeners = [], focus = [], queries = [];
    const input = { value: '구퀴즈', addEventListener() {}, focus: () => focus.push('input') };
    const results = { scrollTop: 214 };
    const rows = Array.from({ length: 5 }, (_, i) => ({ key: `content:${i}` }));
    const ui = { limits: {}, result: { sections: [{ type: 'content', items: rows.slice(0, 3) }], items: rows.slice(0, 3) } };
    const overlay = {
        querySelector(selector) {
            if (selector === '[data-beadyo-search-input]') return input;
            if (selector === '[data-beadyo-search-close]') return { addEventListener() {} };
            if (selector === '[data-beadyo-search-results]') return results;
            if (selector === '[data-beadyo-search-result-index="3"]') return { focus: () => focus.push('content:3') };
            return null;
        },
        addEventListener: (type, fn) => { if (type === 'click') listeners.push(fn); },
    };
    const context = vm.createContext({ unifiedSearchUiState: ui,
        document: { querySelector: () => null, createElement: () => ({ firstElementChild: overlay }), body: { append() {} } },
        addUnifiedSearchStyles() {}, unifiedSearchModalHtml: () => '', closeUnifiedSearch() {},
        runUnifiedSearch: async query => {
            queries.push(query);
            ui.result = { sections: [{ type: 'content', items: rows }], items: rows };
            results.scrollTop = 0;
        } });
    vm.runInContext(sectionSource('    function ensureUnifiedSearchModal(', '    function skillStars('), context);
    context.ensureUnifiedSearchModal();
    const more = { dataset: { beadyoSearchMore: 'content' } };
    const event = { target: { closest: selector => selector === '[data-beadyo-search-more]' ? more : null } };
    listeners.forEach(fn => fn(event));
    await Promise.resolve();
    assert.deepEqual(queries, ['구퀴즈']);
    assert.deepEqual(ui.limits, { content: 13 });
    assert.equal(results.scrollTop, 214);
    assert.deepEqual(focus, ['content:3']);
});
