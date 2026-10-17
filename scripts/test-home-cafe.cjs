const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../home-cafe.js');
const source = fs.readFileSync(require.resolve('../home-cafe.js'), 'utf8');
const now = Date.parse('2026-10-17T03:00:00Z');
const key = 'beadyo:home-cafe:v1';
const rawUrl = 'https://raw.githubusercontent.com/hanul4269/Beadyo/main/data/cafe-posts.json';
const post = (id = '10', publishedAt = '2026-10-17T02:00:00Z', extra = {}) => ({ id,
    title: `등록 글 ${id}`, publishedAt, href: `https://cafe.naver.com/f-e/cafes/31098081/articles/${id}`, ...extra });
const board = (posts = [post()], extra = {}) => ({ schemaVersion: 1, cafeId: '31098081', menuId: '21',
    boardTitle: '슬요 똥글', fetchedAt: '2026-10-17T03:00:00Z', posts, ...extra });
const response = payload => ({ ok: true, json: async () => payload });
const offline = () => { throw new Error('offline'); };
function fixture(stored, { blocked = false, hostname = 'localhost' } = {}) {
    let clock = now, timerId = 0;
    const storage = new Map(stored === undefined ? [] : [[key, typeof stored === 'string' ? stored : JSON.stringify(stored)]]);
    const timers = new Map();
    class Clock extends Date { static now() { return clock; } }
    const context = vm.createContext({ Date: Clock, console, window: { location: { hostname }, localStorage: {
        getItem(name) { if (blocked) throw Error('blocked'); return storage.get(name) ?? null; },
        setItem(name, value) { if (blocked) throw Error('quota'); storage.set(name, value); },
    } }, setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); } });
    vm.runInContext(source, context);
    return { api: context.window.BeadyoHomeCafe, storage, timers, advance(ms) { clock += ms; },
        async flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); },
        expire() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } };
}

test('board identity, schema and collection must match the public feed contract', () => {
    assert.equal(C.boardUrl, 'https://cafe.naver.com/f-e/cafes/31098081/menus/21');
    for (const payload of [null, {}, board([], { schemaVersion: '1' }), board([], { schemaVersion: 2 }),
        board([], { cafeId: 'other' }), board([], { cafeId: 31098081 }), board([], { menuId: '22' }),
        board([], { boardTitle: '다른 게시판' }), board(null)]) assert.throws(() => C.normalize(payload, now));
});

test('actual instants determine order across Korean and UTC timestamps; newest duplicate wins', () => {
    const result = C.normalize(board([post('9', '2026-10-17T09:00:00+09:00'), post('10', '2026-10-17T01:00:00Z'),
        post('2', '2026-10-17T11:00:00+09:00'), post('2', '2026-10-17T00:00:00Z', { title: '옛 제목' }),
        post('99'), post('100')]), now);
    assert.deepEqual(result.posts.map(row => row.id), ['100', '99', '2', '10', '9']);
    assert.equal(result.posts.find(row => row.id === '2').title, '등록 글 2');
    assert.equal(result.posts.find(row => row.id === '2').publishedAt, '2026-10-17T02:00:00.000Z');
    assert.equal(result.posts.length, 5);
});

test('only five unique posts survive even if duplicates occupy the newest input positions', () => {
    const rows = [post('9'), post('9'), post('8'), post('7'), post('6'), post('5'), post('4')];
    assert.deepEqual(C.normalize(board(rows), now).posts.map(row => row.id), ['9', '8', '7', '6', '5']);
});

test('titles normalize visible spacing but reject empty, control, bidi and oversized text', () => {
    assert.equal(C.normalize(board([post('1', undefined, { title: '  등록\u3000 글\u00a0 제목  ' })]), now).posts[0].title, '등록 글 제목');
    for (const title of ['', '   ', '\u200d', '글\n제목', '글\t제목', '글\u0000', '\u007f', '글\u202e제목', '글\u200b', '가'.repeat(301)]) {
        assert.throws(() => C.normalize(board([post('1', undefined, { title })]), now));
    }
    // Emoji joiners are meaningful text; titles remain plain data for the caller to escape.
    const title = '👨‍👩‍👧 오늘 <script>text</script>';
    assert.equal(C.normalize(board([post('1', undefined, { title })]), now).posts[0].title, title);
});

test('post IDs are positive canonical safe integers represented as strings', () => {
    for (const id of [1, '', '0', '01', '-1', '1.0', '1e3', '../1', '9007199254740992', null]) {
        assert.throws(() => C.normalize(board([post(id)]), now));
    }
});

test('canonical official article URLs reject lookalikes, credentials, redirects and other article IDs', () => {
    for (const href of ['javascript:alert(1)', '//cafe.naver.com/f-e/cafes/31098081/articles/10',
        'http://cafe.naver.com/f-e/cafes/31098081/articles/10',
        'https://cafe.naver.com.evil.example/f-e/cafes/31098081/articles/10',
        'https://cafe.naver.com@evil.example/f-e/cafes/31098081/articles/10',
        'https://user:pass@cafe.naver.com/f-e/cafes/31098081/articles/10',
        'https://cafe.naver.com:444/f-e/cafes/31098081/articles/10',
        'https://cafe.naver.com/f-e/cafes/31098082/articles/10',
        'https://cafe.naver.com/f-e/cafes/31098081/articles/11',
        'https://cafe.naver.com/f-e/cafes/31098081/articles/%31%30',
        'https://cafe.naver.com/f-e/cafes/31098081/articles/10?redirect=https://evil.example',
        'https://cafe.naver.com/f-e/cafes/31098081/articles/10#x',
        ' https://cafe.naver.com/f-e/cafes/31098081/articles/10']) {
        assert.throws(() => C.normalize(board([post('10', undefined, { href })]), now));
    }
});

test('timestamps require actual ISO dates with zones, reject rollovers and allow at most five minutes clock skew', () => {
    for (const value of [null, '', '2026-10-17', '2026-10-17T02:00:00', '2026-02-30T02:00:00Z',
        '2026-13-01T02:00:00Z', '2026-10-17T24:00:00Z', '2026-10-17T02:60:00Z',
        '2026-10-17T02:00:60Z', '2026-10-17T02:00:00+25:00', new Date(now + 300001).toISOString()]) {
        assert.throws(() => C.normalize(board([], { fetchedAt: value }), now));
        assert.throws(() => C.normalize(board([post('1', value)]), now));
    }
    const exact = new Date(now + 300000).toISOString();
    assert.equal(C.normalize(board([post('1', exact)], { fetchedAt: exact }), now).posts.length, 1);
    assert.equal(C.normalize(board([], { fetchedAt: '2024-02-29T02:00:00.123456+09:00' }), now).fetchedAt, '2024-02-28T17:00:00.123Z');
    assert.throws(() => C.normalize(board([post()], { fetchedAt: '2026-10-16T00:00:00Z' }), now));
});

test('stale begins at six hours and a successful empty board remains a genuine empty list', () => {
    const payload = board([], { fetchedAt: new Date(now - 6 * 3600000).toISOString() });
    assert.equal(C.normalize(payload, now - 1).stale, false);
    assert.equal(C.normalize(payload, now).stale, true);
    assert.deepEqual(C.normalize(board([]), now), { posts: [], fetchedAt: '2026-10-17T03:00:00.000Z',
        stale: false, fromCache: false, fetchFailed: false });
});

test('read only fetches the local JSON, without cookies or redirects, and shares concurrent work', async () => {
    const h = fixture(); let calls = 0, resolve;
    const fetcher = (url, ms, options) => {
        calls++; assert.equal(url, './data/cafe-posts.json'); assert.equal(ms, 6000);
        assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-cache');
        assert.equal(options.mode, 'same-origin'); assert.equal(options.redirect, 'error');
        return new Promise(done => { resolve = done; });
    };
    const first = h.api.read(fetcher), second = h.api.read(fetcher, { force: true });
    assert.equal(first, second); await h.flush(); assert.equal(calls, 1);
    resolve(response(board())); const result = await first;
    assert.equal(result.fromCache, false); assert.equal(result.fetchFailed, false);
    assert.equal(h.timers.size, 0);
});

test('five-minute memory cache expires, forced failure preserves success and a fresh retry recovers', async () => {
    const h = fixture(); let calls = 0;
    const fetcher = async () => { calls++; return response(board()); };
    await h.api.read(fetcher); const cached = await h.api.read(fetcher);
    assert.equal(calls, 1); assert.equal(cached.fromCache, true);
    const saved = h.storage.get(key), failed = await h.api.read(offline, { force: true });
    assert.equal(failed.fetchFailed, true); assert.equal(h.storage.get(key), saved);
    assert.equal((await h.api.read(fetcher)).fetchFailed, true); assert.equal(calls, 1);
    h.advance(5 * 60000); const recovered = await h.api.read(fetcher);
    assert.equal(calls, 2); assert.equal(recovered.fetchFailed, false); assert.equal(recovered.fromCache, false);
});

test('synchronous failures and malformed responses do not retain a rejected in-flight promise', async () => {
    const h = fixture();
    await assert.rejects(h.api.read(offline), /offline/);
    await assert.rejects(h.api.read(async () => ({ ok: false })), /unavailable/);
    await assert.rejects(h.api.read(async () => response(board([], { menuId: '99' }))), /Invalid/);
    assert.equal((await h.api.read(async () => response(board()))).posts.length, 1);
});

test('fallback reads revalidate persisted metadata and never substitute an error with an invented empty board', async () => {
    const old = board([post('1', '2026-10-16T12:00:00Z')], { fetchedAt: '2026-10-16T13:00:00Z' });
    const h = fixture(old), fallback = await h.api.read(offline);
    assert.equal(fallback.posts[0].id, '1'); assert.equal(fallback.stale, true);
    assert.equal(fallback.fromCache, true); assert.equal(fallback.fetchFailed, true);
    for (const stored of ['bad JSON', board([], { cafeId: 'wrong' }), board([], { fetchedAt: new Date(now + 300001).toISOString() }),
        board([post('1', undefined, { href: 'javascript:alert(1)' })])]) {
        await assert.rejects(fixture(stored).api.read(offline));
    }
    // A stored fallback does not suppress the next recovery attempt for five minutes.
    const recovered = await h.api.read(async () => response(board()));
    assert.equal(recovered.posts[0].id, '10'); assert.equal(recovered.fetchFailed, false);
});

test('storage exceptions cannot spoil successful network or memory reads', async () => {
    const h = fixture(undefined, { blocked: true });
    assert.equal((await h.api.read(async () => response(board()))).posts.length, 1);
    assert.equal((await h.api.read(offline)).fromCache, true);
    assert.equal((await h.api.read(offline, { force: true })).fetchFailed, true);
    await assert.rejects(fixture(undefined, { blocked: true }).api.read(offline));
});

test('valid empty success replaces old data, persists as empty, and remains distinguishable on failure', async () => {
    const h = fixture(); await h.api.read(async () => response(board()));
    const empty = await h.api.read(async () => response(board([])), { force: true });
    assert.equal(empty.posts.length, 0); assert.equal(empty.fetchFailed, false);
    const fallback = await h.api.read(offline, { force: true });
    assert.equal(fallback.posts.length, 0); assert.equal(fallback.fetchFailed, true);
    assert.equal(JSON.parse(h.storage.get(key)).posts.length, 0);
});

test('stored fields are restricted to public metadata and caller mutation cannot poison the memory cache', async () => {
    const h = fixture(); const value = await h.api.read(async () => response(board([post('1', undefined, { token: 'not saved' })], { cookie: 'not saved' })));
    assert.doesNotMatch(h.storage.get(key), /token|cookie|not saved/);
    value.posts[0].title = 'mutated'; value.posts.length = 0;
    const cached = await h.api.read(offline); assert.equal(cached.posts[0].title, '등록 글 1');
});

test('a stalled JSON body times out and its late response cannot overwrite a recovered feed', async () => {
    const h = fixture(); await h.api.read(async () => response(board()));
    let finishBody;
    const stalled = h.api.read(async () => ({ ok: true, json: () => new Promise(resolve => { finishBody = resolve; }) }), { force: true });
    await h.flush(); h.expire(); assert.equal((await stalled).fetchFailed, true);
    await h.api.read(async () => response(board([post('2')])), { force: true });
    finishBody(board([post('1')])); await h.flush();
    assert.equal((await h.api.read(offline)).posts[0].id, '2');
    assert.equal(h.timers.size, 0);
});

test('only the three production hosts read public raw data first, without cookies or local fallback on success', async () => {
    for (const hostname of ['beadyo.com', 'www.beadyo.com', 'hanul4269.github.io']) {
        const h = fixture(undefined, { hostname }), calls = [];
        const result = await h.api.read(async (url, ms, options) => {
            calls.push(url); assert.equal(url, rawUrl); assert.equal(ms, 6000);
            assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-cache');
            assert.equal(options.mode, 'cors'); assert.equal(options.redirect, 'error');
            return response(board());
        });
        assert.equal(calls.length, 1); assert.equal(result.fetchFailed, false); assert.equal(result.fromCache, false);
    }
});

test('preview, loopback, subdomains and lookalike hosts never request the remote data', async () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'dev.beadyo.com', 'beadyo.com.evil.example', 'other.github.io', '']) {
        const h = fixture(undefined, { hostname }), calls = [];
        await assert.rejects(h.api.read(async (url, ms, options) => {
            calls.push(url); assert.equal(url, './data/cafe-posts.json'); assert.equal(ms, 6000);
            assert.equal(options.mode, 'same-origin'); return { ok: false };
        }));
        assert.equal(calls.length, 1);
    }
});

test('production raw HTTP, JSON and validation failures use the bundled feed with a failure notice', async () => {
    for (const badResponse of [{ ok: false }, { ok: true, json: async () => { throw Error('bad JSON'); } },
        response(board([], { menuId: 'wrong' })), response(board([post('1', undefined, { href: 'javascript:bad' })]))]) {
        const h = fixture(undefined, { hostname: 'beadyo.com' }), calls = [];
        const result = await h.api.read(async (url, ms, options) => {
            calls.push(url);
            if (url === rawUrl) return badResponse;
            assert.equal(url, './data/cafe-posts.json'); assert.equal(ms, 4000);
            assert.equal(options.mode, 'same-origin'); assert.equal(options.credentials, 'omit');
            return response(board([post('2')]));
        });
        assert.equal(calls.join(','), `${rawUrl},./data/cafe-posts.json`);
        assert.equal(result.posts[0].id, '2'); assert.equal(result.fetchFailed, true); assert.equal(result.fromCache, true);
        const memory = await h.api.read(offline);
        assert.equal(memory.fetchFailed, true); assert.equal(memory.posts[0].id, '2');
    }
});

test('both production sources failing preserve stored or in-memory success and a retry clears the failure flag', async () => {
    const saved = board([post('3')]);
    const stored = fixture(saved, { hostname: 'beadyo.com' });
    const fallback = await stored.api.read(offline);
    assert.equal(fallback.posts[0].id, '3'); assert.equal(fallback.fetchFailed, true);
    const h = fixture(undefined, { hostname: 'beadyo.com' });
    await h.api.read(async () => response(saved)); const before = h.storage.get(key);
    const failed = await h.api.read(async url => url === rawUrl ? { ok: false } : response(board([], { cafeId: 'wrong' })), { force: true });
    assert.equal(failed.posts[0].id, '3'); assert.equal(failed.fetchFailed, true); assert.equal(h.storage.get(key), before);
    const recovered = await h.api.read(async () => response(board([post('4')])), { force: true });
    assert.equal(recovered.posts[0].id, '4'); assert.equal(recovered.fetchFailed, false);
    assert.equal((await h.api.read(offline)).fetchFailed, false);
});

test('production without a valid cache rejects both-source failure and can subsequently recover', async () => {
    const h = fixture(board([], { menuId: 'wrong' }), { hostname: 'www.beadyo.com' });
    await assert.rejects(h.api.read(offline), /offline/);
    assert.equal((await h.api.read(async () => response(board()))).posts[0].id, '10');
});

test('a production raw body timeout falls back locally and its late response cannot overwrite the fallback', async () => {
    const h = fixture(undefined, { hostname: 'beadyo.com' }); let resolveRaw;
    const pending = h.api.read(async url => url === rawUrl
        ? { ok: true, json: () => new Promise(resolve => { resolveRaw = resolve; }) }
        : response(board([post('2')])));
    await h.flush(); h.expire(); const result = await pending;
    assert.equal(result.posts[0].id, '2'); assert.equal(result.fetchFailed, true);
    resolveRaw(board([post('1')])); await h.flush();
    assert.equal((await h.api.read(offline)).posts[0].id, '2'); assert.equal(h.timers.size, 0);
});

test('a bundled body timeout after raw failure reaches persistent fallback instead of hanging', async () => {
    const h = fixture(board([post('3')]), { hostname: 'hanul4269.github.io' }); let resolveLocal;
    const pending = h.api.read(async url => url === rawUrl ? { ok: false }
        : { ok: true, json: () => new Promise(resolve => { resolveLocal = resolve; }) });
    await h.flush(); h.expire(); const result = await pending;
    assert.equal(result.posts[0].id, '3'); assert.equal(result.fetchFailed, true);
    await h.api.read(async () => response(board([post('4')])), { force: true });
    resolveLocal(board([post('2')])); await h.flush();
    assert.equal((await h.api.read(offline)).posts[0].id, '4'); assert.equal(h.timers.size, 0);
});

test('production concurrent callers share the complete raw-to-bundled fallback sequence', async () => {
    const h = fixture(undefined, { hostname: 'beadyo.com' }), calls = []; let resolveLocal;
    const fetcher = async url => {
        calls.push(url);
        return url === rawUrl ? { ok: false } : new Promise(resolve => { resolveLocal = resolve; });
    };
    const first = h.api.read(fetcher), second = h.api.read(fetcher, { force: true });
    assert.equal(first, second); await h.flush();
    assert.equal(calls.join(','), `${rawUrl},./data/cafe-posts.json`);
    resolveLocal(response(board())); assert.equal((await first).fetchFailed, true);
});

test('a successful empty raw feed is authoritative and never replaced by bundled or stored posts', async () => {
    const h = fixture(board(), { hostname: 'beadyo.com' }); let calls = 0;
    const result = await h.api.read(async url => { calls++; assert.equal(url, rawUrl); return response(board([])); });
    assert.equal(calls, 1); assert.equal(result.posts.length, 0); assert.equal(result.fetchFailed, false);
    assert.equal(JSON.parse(h.storage.get(key)).posts.length, 0);
});

test('raw failure plus an older valid bundle preserves the last raw success, checked time and stored value', async () => {
    const h = fixture(undefined, { hostname: 'beadyo.com' });
    const latest = board([post('20')]);
    const older = board([post('10', '2026-10-17T00:00:00Z')], { fetchedAt: '2026-10-17T01:00:00Z' });
    const first = await h.api.read(async () => response(latest)); const saved = h.storage.get(key);
    const fallback = await h.api.read(async url => url === rawUrl ? { ok: false } : response(older), { force: true });
    assert.equal(fallback.posts[0].id, '20'); assert.equal(fallback.fetchedAt, first.fetchedAt);
    assert.equal(fallback.fetchFailed, true); assert.equal(h.storage.get(key), saved);
});

test('cold-start persistent success beats an older valid bundled fallback', async () => {
    const latest = C.normalize(board([post('20')]), now);
    const saved = board(latest.posts, { fetchedAt: latest.fetchedAt });
    const h = fixture(saved, { hostname: 'www.beadyo.com' }), original = h.storage.get(key);
    const older = board([post('10', '2026-10-17T00:00:00Z')], { fetchedAt: '2026-10-17T01:00:00Z' });
    const fallback = await h.api.read(async url => url === rawUrl ? { ok: false } : response(older));
    assert.equal(fallback.posts[0].id, '20'); assert.equal(fallback.fetchedAt, latest.fetchedAt);
    assert.equal(fallback.fetchFailed, true); assert.equal(h.storage.get(key), original);
});

test('a newer valid bundle is still selected instead of older persisted data', async () => {
    const old = board([post('10', '2026-10-17T00:00:00Z')], { fetchedAt: '2026-10-17T01:00:00Z' });
    const h = fixture(old, { hostname: 'beadyo.com' });
    const fallback = await h.api.read(async url => url === rawUrl ? { ok: false } : response(board([post('20')])));
    assert.equal(fallback.posts[0].id, '20'); assert.equal(fallback.fetchFailed, true);
    assert.equal(JSON.parse(h.storage.get(key)).posts[0].id, '20');
});

test('newer metadata saved by another tab wins over memory on both cache reads and complete failure', async () => {
    const old = board([post('10', '2026-10-17T00:00:00Z')], { fetchedAt: '2026-10-17T01:00:00Z' });
    const h = fixture(undefined, { hostname: 'beadyo.com' }); await h.api.read(async () => response(old));
    h.storage.set(key, JSON.stringify(board([post('20')])));
    const cache = await h.api.read(offline);
    assert.equal(cache.posts[0].id, '20'); assert.equal(cache.fetchedAt, '2026-10-17T03:00:00.000Z');
    h.storage.delete(key); // The latest validated cross-tab value must also survive a storage clear.
    const fallback = await h.api.read(offline, { force: true });
    assert.equal(fallback.posts[0].id, '20'); assert.equal(fallback.fetchFailed, true);
});

test('authoritative empty raw success still clears newer remembered posts and survives fallback', async () => {
    const h = fixture(undefined, { hostname: 'beadyo.com' }); await h.api.read(async () => response(board([post('20')])));
    const olderEmpty = board([], { fetchedAt: '2026-10-17T01:00:00Z' });
    const empty = await h.api.read(async () => response(olderEmpty), { force: true });
    assert.equal(empty.posts.length, 0); assert.equal(empty.fetchFailed, false);
    assert.equal(empty.fetchedAt, '2026-10-17T01:00:00.000Z');
    assert.equal(JSON.parse(h.storage.get(key)).posts.length, 0);
    const fallback = await h.api.read(offline, { force: true });
    assert.equal(fallback.posts.length, 0); assert.equal(fallback.fetchFailed, true);
});
