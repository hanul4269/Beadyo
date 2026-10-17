const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../home.js'), 'utf8');
const loadSource = source.slice(source.indexOf('    async function load(key, options = {}) {'), source.indexOf('    function refresh() {'));
function harness(previous) {
    const sources = previous ? { live: previous } : {};
    const renders = [];
    let resolve, reject;
    const loaders = { live: () => new Promise((ok, fail) => { resolve = ok; reject = fail; }) };
    const renderers = { live: () => renders.push({ ...sources.live }) };
    const load = new Function('sources','loaders','renderers','deadline',`let pending = 0; ${loadSource}; return load;`)(sources, loaders, renderers, value => value);
    return { sources, renders, load, resolve: value => resolve(value), reject: () => reject(Error('offline')) };
}
test('background refresh leaves the successful card visible until new data arrives', async () => {
    const old = { status: 'success', data: { live: true }, at: 123 };
    const h = harness(old); const pending = h.load('live');
    assert.equal(h.sources.live.status, 'success'); assert.equal(h.sources.live.data, old.data); assert.equal(h.renders.length, 0);
    h.resolve({ live: false }); await pending;
    assert.equal(h.renders.length, 1); assert.deepEqual(h.sources.live.data, { live: false });
});
test('failed background refresh preserves the last result and marks it for a retry notice', async () => {
    const old = { status: 'success', data: [{ id: 'existing' }], at: 123 };
    const h = harness(old); const pending = h.load('live'); h.reject(); await pending;
    assert.equal(h.sources.live.data, old.data); assert.equal(h.sources.live.at, 123);
    assert.equal(h.sources.live.status, 'success'); assert.equal(h.sources.live.refreshError, true);
});
test('first load still distinguishes loading, empty success and error', async () => {
    const h = harness(); const pending = h.load('live'); assert.equal(h.renders[0].status, 'loading');
    h.resolve([]); await pending; assert.equal(h.renders[1].status, 'success'); assert.deepEqual(h.sources.live.data, []);
    const failed = harness(); const pendingFailure = failed.load('live'); failed.reject(); await pendingFailure;
    assert.equal(failed.sources.live.status, 'error');
});
test('concurrent polling does not start a duplicate fetch', async () => {
    const h = harness({ status: 'success', data: [], at: 123 });
    const pending = h.load('live'); await h.load('live'); assert.equal(h.renders.length, 0);
    h.resolve([]); await pending; assert.equal(h.renders.length, 1);
});
test('identical rendered content does not replace DOM nodes; changed content does', () => {
    const body = source.slice(source.indexOf('    function setHtml(id, html) {'), source.indexOf('    function rows('));
    let html = '<p>same</p>', writes = 0;
    const node = { get innerHTML() { return html; }, set innerHTML(value) { writes++; html = value; } };
    const setHtml = new Function('document', 'rendered', `${body}; return setHtml;`)({ getElementById: () => node }, new WeakMap());
    setHtml('home-live', '<p>same</p>'); assert.equal(writes, 0);
    setHtml('home-live', '<p>changed</p>'); assert.equal(writes, 1);
    html = '<p>changed</p><details open></details>'; // user interaction must survive an identical refresh
    setHtml('home-live', '<p>changed</p>'); assert.equal(writes, 1);
});
