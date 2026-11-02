const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { filterGames, summarizeDates } = require('../game-log.js');
const archive = require('../data/game-log.json');

const state = extra => ({ query: '', year: '', month: '', genre: '', status: 'all', sort: 'recent', ...extra });
const game = (id, dates, extra = {}) => ({
    id, title: id, aliases: [],
    dates: dates.map(date => typeof date === 'object' && date !== null ? date : { date }),
    ...extra,
});
const ids = games => games.map(item => item.id);

test('year and month must match the same play record, rather than separate sessions', () => {
    const games = [
        game('cross-period', ['2025-01-20', '2026-02-10']),
        game('matching-period', ['2025-02-15']),
    ];
    assert.deepEqual(ids(filterGames(games, state({ year: '2025', month: '02' }))), ['matching-period']);
});

test('a month without a year includes that month across years, including leap day', () => {
    const games = [
        game('february-2024', ['2024-02-29']),
        game('february-2025', ['2025-02-01']),
        game('february-2026', ['2026-02-01']),
        game('march', ['2026-03-01']),
    ];
    assert.deepEqual(ids(filterGames(games, state({ month: '02' }))), ['february-2026', 'february-2025', 'february-2024']);
    assert.deepEqual(ids(filterGames(games, state({ year: '2024', month: '02' }))), ['february-2024']);
});

test('the actual play date determines the month when a broadcast crosses midnight', () => {
    const games = [game('after-midnight', [{ date: '2026-02-01', broadcastDate: '2026-01-31', playedAt: '2026-02-01T00:05:00+09:00' }])];
    assert.deepEqual(ids(filterGames(games, state({ year: '2026', month: '02' }))), ['after-midnight']);
    assert.deepEqual(filterGames(games, state({ year: '2026', month: '01' })), []);
});

test('a game is included when any session matches, even when its latest session is in another month', () => {
    const games = [game('replayed-later', ['2026-02-05', '2026-10-29']), game('october-only', ['2026-10-30'])];
    assert.deepEqual(ids(filterGames(games, state({ year: '2026', month: '02' }))), ['replayed-later']);
    assert.deepEqual(summarizeDates(games[0], '2026', '02'), { lastDate: '2026-02-05', count: 1 });
});

test('date summaries count distinct selected dates and preserve the existing year-only behavior', () => {
    const item = game('repeat-days', ['2025-02-28', '2026-02-01', '2026-02-01', '2026-02-20', '2026-10-29', null]);
    assert.deepEqual(summarizeDates(item, '2026', '02'), { lastDate: '2026-02-20', count: 2 });
    assert.deepEqual(summarizeDates(item, '', '02'), { lastDate: '2026-02-20', count: 3 });
    assert.deepEqual(summarizeDates(item, '2026'), { lastDate: '2026-10-29', count: 3 });
    assert.deepEqual(summarizeDates(item), { lastDate: '2026-10-29', count: 4 });
    assert.deepEqual(summarizeDates(item, '2026', '03'), { lastDate: '', count: 0 });
});

test('recent and oldest sorting both use only sessions inside the selected period', () => {
    const games = [
        game('early-in-period', ['2026-02-02', '2026-10-29']),
        game('late-in-period', ['2026-01-01', '2026-02-20']),
        game('middle-in-period', ['2026-02-08']),
    ];
    const period = { year: '2026', month: '02' };
    assert.deepEqual(ids(filterGames(games, state(period))), ['late-in-period', 'middle-in-period', 'early-in-period']);
    assert.deepEqual(ids(filterGames(games, state({ ...period, sort: 'oldest' }))), ['early-in-period', 'middle-in-period', 'late-in-period']);
});

test('name, alias, genre, year, month and dated filters combine without dropping a condition', () => {
    const games = [
        game('match', ['2026-02-05'], { aliases: ['Night Quest'], genres: ['rpg', 'horror'] }),
        game('wrong-genre', ['2026-02-05'], { aliases: ['Night Quest'], genres: ['racing'] }),
        game('wrong-month', ['2026-01-05'], { aliases: ['Night Quest'], genres: ['horror'] }),
        game('wrong-name', ['2026-02-05'], { genres: ['horror'] }),
        game('unknown-date', [], { aliases: ['Night Quest'], genres: ['horror'] }),
    ];
    const combined = state({ query: 'ＮＩＧＨＴ-ＱＵＥＳＴ', genre: 'horror', year: '2026', month: '02', status: 'dated' });
    assert.deepEqual(ids(filterGames(games, combined)), ['match']);
    assert.deepEqual(ids(filterGames([games[0]], state({ genre: 'rpg' }))), ['match']);
});

test('unclassified includes missing and empty genre lists without including classified games', () => {
    const games = [
        game('missing-genres', ['2026-02-05']),
        game('empty-genres', ['2026-02-06'], { genres: [] }),
        game('classified', ['2026-02-07'], { genres: ['horror'] }),
        game('undated-unclassified', []),
    ];
    assert.deepEqual(ids(filterGames(games, state({ genre: 'unclassified', sort: 'name' }))), ['empty-genres', 'missing-genres', 'undated-unclassified']);
    assert.deepEqual(ids(filterGames(games, state({ genre: 'unclassified', year: '2026', month: '02' }))), ['empty-genres', 'missing-genres']);
    assert.deepEqual(ids(filterGames(games, state({ genre: 'horror' }))), ['classified']);
});

test('unknown dates are excluded by a period but remain available when no period is selected', () => {
    const games = [game('empty-dates', []), game('null-date', [null]), game('dated', ['2026-02-05'])];
    assert.deepEqual(ids(filterGames(games, state({ status: 'undated', sort: 'name' }))), ['empty-dates', 'null-date']);
    for (const period of [{ year: '2026' }, { month: '02' }, { year: '2026', month: '02' }]) {
        assert.deepEqual(filterGames(games, state({ ...period, status: 'undated' })), []);
    }
    assert.deepEqual(ids(filterGames(games, state({ status: 'dated' }))), ['dated']);
    assert.equal(filterGames(games, state()).length, 3);
});

test('filtering, sorting and summarizing never change stored game records or their order', () => {
    const games = [
        game('B', ['2026-10-29', '2025-02-01', '2026-02-02'], { genres: ['horror'] }),
        game('A', ['2026-02-20', '2025-12-31'], { genres: [] }),
    ];
    const before = JSON.stringify(games);
    for (const sort of ['recent', 'oldest', 'name']) filterGames(games, state({ year: '2026', month: '02', sort }));
    games.forEach(item => summarizeDates(item, '', '02'));
    assert.equal(JSON.stringify(games), before);
    assert.deepEqual(filterGames(games, state({ year: '2026', month: '12' })), []);
    assert.deepEqual(ids(filterGames(games, state({ sort: 'name' }))), ['A', 'B']);
});

test('reviewed archive month selections retain their historical game counts', () => {
    assert.deepEqual(ids(filterGames(archive.games, state({ year: '2023', month: '02' }))), ['minecraft']);
    assert.equal(filterGames(archive.games, state({ year: '2024', month: '02' })).length, 11);
    assert.equal(filterGames(archive.games, state({ year: '2026', month: '10' })).length, 10);
});

test('reviewed repeated games show the selected historical month rather than their latest overall play', () => {
    const minecraft = archive.games.find(item => item.id === 'minecraft');
    const league = archive.games.find(item => item.id === 'league-of-legends');
    assert.deepEqual(summarizeDates(minecraft, '2025', '10'), { lastDate: '2025-10-29', count: 5 });
    assert.deepEqual(summarizeDates(minecraft, '2026', '10'), { lastDate: '2026-10-30', count: 9 });
    assert.deepEqual(summarizeDates(league, '2026', '02'), { lastDate: '2026-02-01', count: 1 });
});

function genreReader(fetcher) {
    const source = fs.readFileSync(require.resolve('../game-log.js'), 'utf8');
    const start = source.indexOf('    async function loadGenres()');
    const end = source.indexOf('    async function load()', start);
    assert.ok(start >= 0 && end > start);
    const timers = new Map();
    let nextTimer = 0;
    const context = vm.createContext({
        AbortController, fetch: fetcher,
        setTimeout(callback, milliseconds) { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
        clearTimeout: id => timers.delete(id),
    });
    vm.runInContext(source.slice(start, end), context);
    return {
        read: () => context.loadGenres(), timers,
        expire() {
            assert.equal(timers.size, 1, 'genre reads have a bounded deadline');
            for (const [id, timer] of timers) {
                assert.ok(timer.milliseconds > 0 && timer.milliseconds <= 10000);
                timers.delete(id); timer.callback();
            }
        },
    };
}

async function bounded(promise) {
    let timeout;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Optional genre read prevented the archive from loading')), 200);
        })]);
    } finally { clearTimeout(timeout); }
}

for (const phase of ['response', 'JSON body']) {
    test(`a stalled genre ${phase} reaches its deadline, releases the main archive and permits retry`, async () => {
        const metadata = { categories: [{ id: 'horror', label: '공포' }], games: {} };
        let retry = false, signal, bodyStarted = false;
        const reader = genreReader((_url, options) => {
            signal = options.signal;
            if (retry) return Promise.resolve({ ok: true, json: async () => metadata });
            if (phase === 'response') return new Promise(() => {});
            return Promise.resolve({ ok: true, json() { bodyStarted = true; return new Promise(() => {}); } });
        });
        const genres = reader.read();
        const loading = Promise.all([Promise.resolve(archive), genres]);
        await new Promise(resolve => setImmediate(resolve));
        if (phase === 'JSON body') assert.equal(bodyStarted, true);
        reader.expire();
        const [loadedArchive, loadedGenres] = await bounded(loading);
        assert.equal(signal.aborted, true);
        assert.equal(loadedArchive, archive);
        assert.equal(loadedGenres, null);
        assert.equal(reader.timers.size, 0);
        retry = true;
        assert.equal(await bounded(reader.read()), metadata);
        assert.equal(signal.aborted, false);
        assert.equal(reader.timers.size, 0);
    });
}
