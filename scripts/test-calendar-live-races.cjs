// Run with: node --test scripts/test-calendar-live-races.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
function section(name, start, end) {
    const text = source(name), from = text.indexOf(start), to = text.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} section exists`);
    return text.slice(from, to);
}
function element() {
    const classes = new Set();
    return {
        dataset: {}, style: {}, hidden: false, innerHTML: '', textContent: '', parentElement: { style: {} },
        classList: {
            add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
            toggle(name, on) { on ? classes.add(name) : classes.delete(name); },
        },
    };
}
const response = rows => ({ ok: true, json: async () => rows });
const youtube = (id, date) => ({ id, date, url: `https://www.youtube.com/watch?v=${id}` });
const flush = () => new Promise(resolve => setImmediate(resolve));
function calendar({ width = 1280, search = '', readLinks = async () => response([]), state = {} } = {}) {
    const nodes = Object.fromEntries(['viewContent', 'viewBtns', 'viewModal', 'calendar-song-links'].map(id => [id, element()]));
    let modalHtml = '', renders = 0, mounts = 0;
    Object.defineProperty(nodes.viewContent, 'innerHTML', {
        get: () => modalHtml,
        set(html) {
            modalHtml = html;
            if (html.includes('id="day-youtube-links"')) nodes['day-youtube-links'] = element();
            else delete nodes['day-youtube-links'];
        },
    });
    const requests = [], broadcasts = [];
    const ctx = vm.createContext({
        state: { year: 2025, month: 0, viewMode: 'month', weekStart: null, mobileStartDate: '2025-01-01', events: [], ytLinks: [], isEditor: false, ...state },
        _loadRequestSequence: 0, _eventsLoaded: false, _retryTimer: null, _loadRetryAttempt: 0, _loadFailureNoticeShown: false,
        window: { innerWidth: width, BeadyoExploreData: require('../explore-data.js'), BeadyoExplore: { mountDate() { mounts++; } } },
        document: { getElementById: id => nodes[id] || null, querySelector: () => null },
        location: { search }, URLSearchParams, Date, AbortController,
        SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'fixture',
        fetch: async url => { requests.push(url); return response([]); },
        BeadyoCommon: { fetchWithTimeout: async url => { requests.push(url); return readLinks(url); } },
        readCalendarJson: result => result.json(),
        loadBroadcastInfos: async (from, to) => { broadcasts.push({ from, to }); },
        renderCalendar() { renders++; }, setTimeout: () => 1, clearTimeout() {},
        loadMemoCards: async () => {}, renderMobileSchedule() {},
        calendarEventsForDate: () => [], broadcastInfoForDate: () => null, broadcastTimeLabel: () => '', broadcastLinks: () => [],
        dayEmptyHtml: message => message, esc: value => String(value ?? ''), safeUrl: value => value,
        ytLinkType: () => 'long', jsArg: value => JSON.stringify(value),
        typeOf: () => ({ icon: '', label: '' }), typeStyle: () => '', eventHotclipUrls: () => [], eventYoutubeLinks: () => [],
        console: { error() {} },
    });
    vm.runInContext(
        section('app.js', 'function pad(n)', 'function eventEndDate(') +
        section('app.js', 'function calendarLoadRange()', 'async function loadEditors()') +
        section('app.js', 'async function loadYtLinks(', 'async function loadBroadcastInfos(') +
        section('app.js', 'let pendingCalendarDate =', '// ───') +
        section('app.js', 'function changeMonth(', 'function normalizeAuthUser('), ctx);
    return { ctx, nodes, requests, broadcasts, renders: () => renders, mounts: () => mounts };
}
const queryDates = url => new URL(url).searchParams.getAll('date');

test('past-month YouTube uses the selected calendar range rather than the current month', async () => {
    const h = calendar();
    await h.ctx.loadYtLinks();
    assert.deepEqual(queryDates(h.requests[0]), ['gte.2024-12-01', 'lte.2025-01-31']);
});

for (const fixture of [
    { name: 'week crossing the year', width: 1280, state: { year: 2025, month: 11, viewMode: 'week', weekStart: '2025-12-28' }, from: '2025-11-01', to: '2026-01-03' },
    { name: 'mobile three-day window crossing the month', width: 375, state: { year: 2026, month: 9, mobileStartDate: '2026-10-31' }, from: '2026-09-01', to: '2026-11-02' },
]) test(`schedules, broadcast info and YouTube share the ${fixture.name} range`, async () => {
    const h = calendar(fixture);
    await h.ctx.loadEvents(); await flush();
    assert.equal(h.requests.length, 2);
    for (const url of h.requests) assert.deepEqual(queryDates(url), [`gte.${fixture.from}`, `lte.${fixture.to}`]);
    assert.deepEqual(h.broadcasts, [{ from: fixture.from, to: fixture.to }]);
});

test('moving to a final week in the same month loads the next month days', async () => {
    const h = calendar({ state: { year: 2025, month: 7, viewMode: 'week', weekStart: '2025-08-24' } });
    h.ctx.changeMonth(1); await flush();
    assert.equal(h.ctx.state.weekStart, '2025-08-31');
    assert.equal(h.requests.length, 2);
    for (const url of h.requests) assert.deepEqual(queryDates(url), ['gte.2025-07-01', 'lte.2025-09-06']);
});

test('moving three mobile days within the same month loads the next month days', async () => {
    const h = calendar({ width: 375, state: { year: 2026, month: 9, mobileStartDate: '2026-10-28' } });
    h.ctx.navigateMobileDays(3); await flush();
    assert.equal(h.ctx.state.mobileStartDate, '2026-10-31');
    assert.equal(h.requests.length, 2);
    for (const url of h.requests) assert.deepEqual(queryDates(url), ['gte.2026-09-01', 'lte.2026-11-02']);
});

for (const rejectOld of [false, true]) test(`an old YouTube ${rejectOld ? 'failure' : 'success'} cannot overwrite the newer month`, async () => {
    let resolve, reject;
    const old = new Promise((a, b) => { resolve = a; reject = b; });
    const h = calendar({ readLinks: url => url.includes('gte.old') ? old : response([youtube('new', '2026-10-11')]) });
    h.ctx._loadRequestSequence = 1;
    const first = h.ctx.loadYtLinks('old', 'old', 1);
    h.ctx._loadRequestSequence = 2;
    await h.ctx.loadYtLinks('new', 'new', 2);
    const renderCount = h.renders();
    if (rejectOld) reject(Error('old request failed')); else resolve(response([youtube('old', '2025-01-02')]));
    await first;
    assert.equal(h.ctx.state.ytLinks[0].id, 'new');
    assert.equal(h.renders(), renderCount);
});

test('late YouTube data updates only the open date modal link section', async () => {
    let finish;
    const h = calendar({ search: '?date=2025-01-02', readLinks: () => new Promise(resolve => { finish = resolve; }) });
    await h.ctx.loadEvents();
    const originalHtml = h.nodes.viewContent.innerHTML;
    assert.equal(h.nodes.viewModal.dataset.dayDate, '2025-01-02');
    assert.equal(h.nodes['day-youtube-links'].innerHTML, '');
    finish(response([youtube('abcdefghijk', '2025-01-02')])); await flush();
    assert.match(h.nodes['day-youtube-links'].innerHTML, /watch\?v=abcdefghijk/);
    assert.equal(h.nodes.viewContent.innerHTML, originalHtml);
    assert.equal(h.mounts(), 1);
});

test('late links follow the currently open date, rather than the earlier date', async () => {
    let finish;
    const h = calendar({ readLinks: () => new Promise(resolve => { finish = resolve; }) });
    const pending = h.ctx.loadYtLinks();
    h.ctx.openDayViewModal('2025-01-02'); h.ctx.openDayViewModal('2025-01-03');
    finish(response([youtube('old-link', '2025-01-02'), youtube('current-link', '2025-01-03')])); await pending;
    assert.match(h.nodes['day-youtube-links'].innerHTML, /current-link/);
    assert.doesNotMatch(h.nodes['day-youtube-links'].innerHTML, /old-link/);
});

for (const action of ['close', 'event detail']) test(`late links do not replace a ${action === 'close' ? 'closed date modal' : 'subsequent event detail'}`, async () => {
    let finish;
    const h = calendar({ readLinks: () => new Promise(resolve => { finish = resolve; }) });
    const pending = h.ctx.loadYtLinks(); h.ctx.openDayViewModal('2025-01-02');
    if (action === 'close') h.ctx.closeViewModal();
    else { h.ctx.state.events = [{ id: 'fixture', title: 'Event detail' }]; h.ctx.openViewModal('fixture'); }
    const html = h.nodes.viewContent.innerHTML;
    finish(response([youtube('abcdefghijk', '2025-01-02')])); await pending;
    assert.equal(h.nodes.viewContent.innerHTML, html);
    assert.equal(h.nodes.viewModal.dataset.dayDate, undefined);
    if (action === 'close') assert.equal(h.nodes.viewModal.classList.contains('open'), false);
});

test('initial and message date navigation align the mobile and week anchors across year boundaries', () => {
    const h = calendar({ search: '?date=2025-01-02', state: { viewMode: 'week', weekStart: '2026-10-11', mobileStartDate: '2026-10-11' } });
    assert.equal(h.ctx.state.year, 2025); assert.equal(h.ctx.state.month, 0);
    assert.equal(h.ctx.state.mobileStartDate, '2025-01-02'); assert.equal(h.ctx.state.weekStart, '2024-12-29');
    h.ctx.loadEvents = () => {};
    h.ctx.openCalendarDate('2025-12-31');
    assert.equal(h.ctx.state.year, 2025); assert.equal(h.ctx.state.month, 11);
    assert.equal(h.ctx.state.mobileStartDate, '2025-12-31'); assert.equal(h.ctx.state.weekStart, '2025-12-28');
    assert.equal(h.ctx.state.viewMode, 'week');
    h.ctx.openCalendarDate('2025-02-30');
    assert.equal(h.ctx.state.mobileStartDate, '2025-12-31');
});

test('manual month, week, mobile and today navigation cancel a pending automatic date modal', async () => {
    for (const action of ['month', 'week', 'mobile', 'today']) {
        const h = calendar({ width: action === 'mobile' ? 375 : 1280,
            state: { viewMode: action === 'week' ? 'week' : 'month' } });
        h.ctx.openCalendarDate('2026-10-01');
        if (action === 'mobile') h.ctx.navigateMobileDays(3);
        else if (action === 'today') h.ctx.goToday();
        else h.ctx.changeMonth(1);
        await flush();
        assert.equal(h.nodes.viewModal.classList.contains('open'), false, action);
        assert.equal(h.nodes.viewModal.dataset.dayDate, undefined, action);
        if (action === 'month') assert.equal(h.ctx.state.month, 10);
        if (action === 'week') assert.equal(h.ctx.state.weekStart, '2026-10-04');
        if (action === 'mobile') assert.equal(h.ctx.state.mobileStartDate, '2026-10-04');
    }
});

test('a newer explicit date request still opens its detail after an older date load finishes', async () => {
    const h = calendar();
    h.ctx.openCalendarDate('2026-10-01');
    h.ctx.openCalendarDate('2026-11-02');
    await flush();
    assert.equal(h.ctx.state.month, 10);
    assert.equal(h.nodes.viewModal.classList.contains('open'), true);
    assert.equal(h.nodes.viewModal.dataset.dayDate, '2026-11-02');
});

function live({ readYear, readStats = async () => {} } = {}) {
    const nodes = Object.fromEntries(['live-list', 'stats-panel', 'result-info', 'explore-live-date'].map(id => [id, element()]));
    let renders = 0, stats = 0;
    const S = { mainTab: 'live', liveYear: 2025, query: '', liveDate: '', session: null, liveCache: {}, liveFilter: { years: new Set([2025, 2026]), sort: 'date', dir: 'desc' } };
    const ctx = vm.createContext({ S,
        document: { getElementById: id => nodes[id], querySelector: () => element() },
        loadLive: readYear || (async () => {}), renderSkeleton() {}, ensureStatsData: readStats, renderStats() { stats++; },
        updateResultInfo() { renders++; }, liveStatKey: row => row.title, esc: value => String(value ?? ''), fmtDate: value => value,
        emptyHtml: value => value, safeUrl: value => value, matches: (title, artist, query) => title.includes(query),
    });
    vm.runInContext(section('songbook.html', 'let liveRenderGeneration =', '// ── 렌더: 통계'), ctx);
    return { ctx, nodes, S, renders: () => renders, stats: () => stats };
}
const song = (year, title) => ({ id: year, year, title, performed_date: `${year}-10-01` });

test('a late previous year cannot replace the selected LIVE RECORD year', async () => {
    let finish;
    const h = live({ readYear: () => new Promise(resolve => { finish = resolve; }) });
    const old = h.ctx.renderLive();
    h.S.liveYear = 2026; h.S.liveCache[2026] = [song(2026, 'Current year')]; await h.ctx.renderLive();
    const currentHtml = h.nodes['live-list'].innerHTML;
    h.S.liveCache[2025] = [song(2025, 'Previous year')]; finish(); await old;
    assert.equal(h.nodes['live-list'].innerHTML, currentHtml);
    assert.equal(h.renders(), 1);
});

test('a late statistics read cannot render after selecting a year', async () => {
    let finish;
    const h = live({ readStats: () => new Promise(resolve => { finish = resolve; }) });
    h.S.liveYear = 'stats'; const old = h.ctx.renderLive();
    h.S.liveYear = 2026; h.S.liveCache[2026] = [song(2026, 'Current year')]; await h.ctx.renderLive();
    finish(); await old;
    assert.equal(h.stats(), 0);
    assert.equal(h.nodes['stats-panel'].style.display, 'none');
    assert.equal(h.nodes['live-list'].parentElement.style.display, '');
});

test('a pending LIVE RECORD read cannot change the shared result count after opening SONGBOOK', async () => {
    let finish;
    const h = live({ readYear: () => new Promise(resolve => { finish = resolve; }) });
    const old = h.ctx.renderLive(); h.S.mainTab = 'songbook';
    h.S.liveCache[2025] = [song(2025, 'Background song')]; finish(); await old;
    assert.equal(h.renders(), 0); assert.equal(h.nodes['live-list'].innerHTML, '');
});

test('new search rendering supersedes an earlier pending search', async () => {
    let finish;
    const loading = new Promise(resolve => { finish = resolve; });
    const h = live({ readYear: () => loading });
    h.S.query = 'Old'; const old = h.ctx.renderLive();
    h.S.query = 'Current'; const current = h.ctx.renderLive();
    h.S.liveCache[2025] = [song(2025, 'Old song'), song(2025, 'Current song')]; finish(); await Promise.all([old, current]);
    assert.equal(h.renders(), 1);
    assert.match(h.nodes['live-list'].innerHTML, /Current song/); assert.doesNotMatch(h.nodes['live-list'].innerHTML, /Old song/);
});

test('MUSIC date validation accepts real dates and rejects impossible days, months and formats', () => {
    const ctx = vm.createContext({ Date });
    vm.runInContext(section('songs.html', '        function parseDate(raw)', '        async function saveSong()'), ctx);
    for (const [input, expected] of [['20240229', '2024-02-29'], ['2026-10-31', '2026-10-31'], [' 20260101 ', '2026-01-01'], ['20000229', '2000-02-29']])
        assert.equal(ctx.parseDate(input), expected);
    for (const input of ['20260230', '20260229', '20261301', '20260001', '20260431', '20261000', '19000229', '00000101', '2026/10/01', '2026-1-01', '2026101', 'text20261011'])
        assert.equal(ctx.parseDate(input), null, input);
});
