// Run with: node --test scripts/test-runtime-fallbacks.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index-app.js'), 'utf8');
const rankingSource = app.slice(app.indexOf('const UP_LIVE_CACHE_TTL_MS'), app.indexOf('\nfunction renderUpModal'));
const liveSource = index.slice(index.indexOf("const PROXY ="), index.indexOf('\nasync function fetchRuntimeCache'));
const freshSource = index.slice(index.indexOf('function isFreshRuntimeCache'), index.indexOf('\nfunction checkLiveStatus'));
const row = (id, likes) => ({pCommentNo: id, userId: `user${id}`, likeCnt: likes});
const response = data => ({ok: true, status: 200, json: async () => data});
const page = (items, lastPage = 1) => response({data: items, meta: {lastPage}});
function ranking(fetchPage) {
    const calls = [], timeouts = [];
    let now = Date.now();
    class Clock extends Date { static now() { return now; } }
    const ctx = vm.createContext({Date: Clock, AbortSignal: {timeout(ms) {timeouts.push(ms); return {ms};}},
        fetch: async (url, options) => {
            const proxy = url.includes('deno.net');
            const target = proxy ? new URL(url).searchParams.get('url') : url;
            const n = Number(new URL(target).searchParams.get('page'));
            calls.push(`${proxy ? 'proxy' : 'direct'}${n}`);
            assert.equal(options.signal.ms, 10000);
            return fetchPage(proxy, n);
        }});
    vm.runInContext(rankingSource, ctx);
    return {ctx, calls, timeouts, advance(ms) { now += ms; }};
}
test('complete pagination includes highest UP on the last page', async () => {
    const r = ranking((_, n) => page([row(n, n * 100)], 3));
    const result = await r.ctx.fetchSoopRankingLive('test', '1');
    assert.equal(result.ranking.length, 3);
    assert.equal(result.ranking[0].reply_no, '3');
    assert.deepEqual(r.calls, ['direct1', 'direct2', 'direct3']);
    assert.deepEqual(r.timeouts, [10000, 10000, 10000]);
});
test('body failure retries the same page through proxy and stays on proxy', async () => {
    const r = ranking((proxy, n) => !proxy ? {ok: true, json: async () => {throw Error('truncated body');}} : page([row(n, n)], 3));
    assert.equal((await r.ctx.fetchSoopRankingLive('test', '1')).ranking.length, 3);
    assert.deepEqual(r.calls, ['direct1', 'proxy1', 'proxy2', 'proxy3']);
});
test('HTTP error on page two falls back without losing page one', async () => {
    const r = ranking((proxy, n) => !proxy && n === 2 ? {ok: false, status: 503} : page([row(n, n)], 3));
    assert.equal((await r.ctx.fetchSoopRankingLive('test', '1')).ranking.length, 3);
    assert.deepEqual(r.calls, ['direct1', 'direct2', 'proxy2', 'proxy3']);
});
test('mid-pagination failure returns no partial result and leaves no fresh cache', async () => {
    const r = ranking((_, n) => n === 1 ? page([row(1, 10)], 3) : {ok: false, status: 503});
    assert.equal(await r.ctx.fetchSoopRankingLive('test', '1'), null);
    assert.equal(r.ctx.readCachedUpRanking('test', '1', true), null);
});
test('expired complete cache survives failed refresh with its original timestamp', async () => {
    let fail = false;
    const r = ranking((_, n) => fail && n === 2 ? {ok: false, status: 503} : page([row(n, n)], 2));
    const original = await r.ctx.fetchSoopRankingLive('test', '1');
    r.advance(120001); fail = true;
    const fallback = await r.ctx.fetchSoopRankingLive('test', '1');
    assert.equal(fallback.stale, true);
    assert.equal(fallback.updatedAt, original.updatedAt);
    assert.equal(fallback.ranking.length, 2);
    assert.equal(r.ctx.readCachedUpRanking('test', '1'), null);
    assert.equal(r.ctx.readCachedUpRanking('test', '1', true).updatedAt, original.updatedAt);
});
for (const lastPage of [0, 1, '1']) test(`valid empty result (lastPage=${JSON.stringify(lastPage)}) replaces stale rows`, async () => {
    const r = ranking(() => page([], lastPage));
    r.ctx.writeCachedUpRanking('test', '1', [row(99, 99)]);
    const result = await r.ctx.fetchSoopRankingLive('test', '1', {force: true});
    assert.equal(result.ranking.length, 0);
    assert.equal(result.stale, undefined);
});
for (const body of [{}, {data: []}, {data: [], meta: {lastPage: 2}}, {data: [], meta: {lastPage: null}}, {data: [], meta: {lastPage: -1}}]) {
    test(`invalid page is never cached: ${JSON.stringify(body)}`, async () => {
        const r = ranking(() => response(body));
        assert.equal(await r.ctx.fetchSoopRankingLive('test', '1'), null);
        assert.equal(r.ctx.readCachedUpRanking('test', '1', true), null);
    });
}
test('overlapping forced ranking retries share one request', async () => {
    let resolve;
    const r = ranking(() => new Promise(r => { resolve = r; }));
    const first = r.ctx.fetchSoopRankingLive('test', '1', {force: true});
    const second = r.ctx.fetchSoopRankingLive('test', '1', {force: true});
    resolve(page([row(1, 1)]));
    await Promise.all([first, second]);
    assert.equal(r.calls.length, 1);
});
const station = broad => ({station: {user_id: 'beadyo97'}, broad});
function live(fetchResponse, cache = null) {
    const calls = [];
    const ctx = vm.createContext({Date, applyLiveStatus() {},
        fetchWithTimeout: async url => {const source = url.includes('deno.net') ? 'proxy' : 'direct'; calls.push(source); return fetchResponse(source);},
        fetchRuntimeCache: async () => {calls.push('cache'); return cache;}});
    vm.runInContext(liveSource + '\n' + freshSource, ctx);
    return {ctx, calls};
}
for (const broad of [null, {broad_no: 123, broad_title: ' LIVE '}, {broad_no: '123', broad_title: 'LIVE'}]) {
    test(`normal station is accepted and memoized: ${JSON.stringify(broad)}`, async () => {
        const r = live(() => response(station(broad)));
        const result = await r.ctx.fetchLiveStatus();
        assert.equal(result.live, broad !== null);
        await r.ctx.fetchLiveStatus();
        assert.deepEqual(r.calls, ['direct']);
    });
}
for (const invalid of [null, {}, {error: 'temporary failure'}, {station:{user_id:'beadyo97'}}, station({}), station({broad_no:0, broad_title:''}), {station:{user_id:'other'},broad:null}]) {
    test(`invalid station falls back instead of caching OFF: ${JSON.stringify(invalid)}`, async () => {
        const r = live(source => response(source === 'direct' ? invalid : station({broad_no:123,broad_title:'LIVE'})));
        assert.equal((await r.ctx.fetchLiveStatus()).live, true);
        assert.deepEqual(r.calls, ['direct', 'proxy']);
    });
}
test('invalid station responses reach fresh Supabase fallback', async () => {
    const r = live(() => response({error:'temporary'}), {live:true, updated:new Date().toISOString()});
    assert.equal((await r.ctx.fetchLiveStatus()).live, true);
    assert.deepEqual(r.calls, ['direct', 'proxy', 'cache']);
});
test('all invalid responses are not memoized', async () => {
    const r = live(() => response({error:'temporary'}));
    assert.equal(await r.ctx.fetchLiveStatus(), null);
    assert.equal(await r.ctx.fetchLiveStatus(), null);
    assert.deepEqual(r.calls, ['direct','proxy','cache','direct','proxy','cache']);
});
test('invalid or expired fallback is rejected', async () => {
    for (const cache of [{live:'false',updated:new Date().toISOString()}, {live:true,updated:'2000-01-01T00:00:00Z'}]) {
        const r = live(() => ({ok:false}), cache);
        assert.equal(await r.ctx.fetchLiveStatus(), null);
    }
});
