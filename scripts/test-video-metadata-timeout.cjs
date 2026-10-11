const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const href = 'https://youtu.be/Jj4aR7ZxKZM';
const key = 'beadyo:video-metadata:v1:Jj4aR7ZxKZM';
function harness(fetcher, initial = {}) {
    const storage = new Map(Object.entries(initial));
    let calls = 0, now = Date.now();
    class Clock extends Date { static now() { return now; } }
    const context = vm.createContext({
        Date: Clock, Map, JSON, URL, Number, String, Promise, AbortController,
        setTimeout: (callback, delay) => setTimeout(callback, Math.min(delay, 20)), clearTimeout,
        localStorage: { getItem: name => storage.get(name), setItem: (name, value) => storage.set(name, value) },
        fetch: async (...args) => { calls++; return fetcher(...args); },
        window: {
            BeadyoExploreData: require('../explore-data.js'),
            BeadyoCommon: { safeUrl: value => /^https?:\/\//.test(value || '') ? value : '' },
        },
    });
    vm.runInContext(fs.readFileSync(require.resolve('../video-metadata.js'), 'utf8'), context);
    return {
        api: context.window.BeadyoVideoMetadata, storage, calls: () => calls,
        advance: milliseconds => { now += milliseconds; },
    };
}
async function bounded(promise) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Metadata read remained pending')), 100);
        })]);
    } finally { clearTimeout(timer); }
}

for (const stalledPhase of ['response', 'JSON body']) {
    test(`metadata deadline releases a stalled ${stalledPhase}, shares the request and permits retry after failure cache expiry`, async () => {
        let retry = false, signal;
        const h = harness(async (_url, options) => {
            signal = options.signal;
            if (retry) return { ok: true, json: async () => ({ title: 'Retrieved title' }) };
            if (stalledPhase === 'response') return new Promise(() => {});
            return { ok: true, json: () => new Promise(() => {}) };
        });
        const rows = await bounded(Promise.all([h.api.read(href), h.api.read(href)]));
        assert.equal(h.calls(), 1);
        assert.equal(signal.aborted, true);
        for (const row of rows) {
            assert.equal(row.status, 'unavailable');
            assert.equal(row.title, '');
        }
        assert.equal(JSON.parse(h.storage.get(key)).status, 'unavailable');
        await bounded(h.api.read(href));
        assert.equal(h.calls(), 1);
        const reload = harness(() => { throw Error('Failure cache must be reused'); }, Object.fromEntries(h.storage));
        assert.equal((await bounded(reload.api.read(href))).status, 'unavailable');
        assert.equal(reload.calls(), 0);

        retry = true;
        h.advance(6 * 3600000 + 1);
        assert.equal((await bounded(h.api.read(href))).title, 'Retrieved title');
        assert.equal(h.calls(), 2);
    });
}

test('a late JSON body cannot overwrite the timeout fallback', async () => {
    let resolveBody;
    const h = harness(async () => ({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) }));
    assert.equal((await bounded(h.api.read(href))).status, 'unavailable');
    resolveBody({ title: 'Late title' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await bounded(h.api.read(href))).title, '');
    assert.equal(JSON.parse(h.storage.get(key)).title, '');
    assert.equal(h.calls(), 1);
});
