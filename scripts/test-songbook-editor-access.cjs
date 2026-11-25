// Run with: node --test scripts/test-songbook-editor-access.cjs
// Signing in alone must not open SONGBOOK edit UI: only is_beadyo_editor() === true does.
// The RPC is a mock; no browser, live login or production database is involved.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'songbook.html'), 'utf8');
function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} section exists`);
    return source.slice(from, to);
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const fan = { user: { id: 'fixture-fan' } };
const editor = { user: { id: 'fixture-editor' } };

function songbook(rpc) {
    const opened = [], rpcCalls = [];
    let uiUpdates = 0;
    const ctx = vm.createContext({
        S: { session: null, isEditor: false },
        db: { rpc: async name => { rpcCalls.push(name); return rpc(name, rpcCalls.length); } },
        ensureDb: async () => {},
        updateAuthUI() { uiUpdates++; },
        openSongModal: id => opened.push(['edit', id]),
        openSongDetailPanel: id => opened.push(['detail', id]),
        console: { warn() {} },
    });
    vm.runInContext(
        section('function canEditSongbook()', 'function updateAuthUI()') +
        section('function songClickClass()', 'function songClickHandler(') +
        section('function openSongDetail(', 'function closeSongDetail('), ctx);
    return { ctx, opened, rpcCalls, uiUpdates: () => uiUpdates };
}

for (const [name, rpc] of [
    ['RPC false', async () => ({ data: false, error: null })],
    ['RPC error', async () => ({ data: null, error: { message: '[테스트용] permission denied' } })],
    ['RPC throws', async () => { throw new TypeError('Failed to fetch'); }],
]) test(`a signed-in fan (${name}) gets the public detail, not the edit modal`, async () => {
    const h = songbook(rpc);
    await h.ctx.setSongbookSession(fan);
    assert.deepEqual(h.rpcCalls, ['is_beadyo_editor']);
    assert.equal(h.ctx.canEditSongbook(), false);
    h.ctx.openSongDetail(7);
    assert.deepEqual(h.opened, [['detail', 7]]);
    assert.equal(h.ctx.songClickClass(), 'clickable');
});

test('a confirmed editor gets the edit modal and edit styling', async () => {
    const h = songbook(async () => ({ data: true, error: null }));
    await h.ctx.setSongbookSession(editor);
    assert.equal(h.ctx.canEditSongbook(), true);
    assert.ok(h.uiUpdates() >= 2, 'UI re-renders once editor access is confirmed');
    h.ctx.openSongDetail(7);
    assert.deepEqual(h.opened, [['edit', 7]]);
    assert.equal(h.ctx.songClickClass(), 'clickable editable');
});

test('a signed-out visitor never triggers the editor check', async () => {
    const h = songbook(async () => ({ data: true, error: null }));
    await h.ctx.setSongbookSession(null);
    assert.deepEqual(h.rpcCalls, []);
    h.ctx.openSongDetail(3);
    assert.deepEqual(h.opened, [['detail', 3]]);
});

test('switching users drops editor access before the new check finishes', async () => {
    let finishFanCheck;
    const h = songbook((_, call) => call === 1
        ? { data: true, error: null }
        : new Promise(resolve => { finishFanCheck = () => resolve({ data: false, error: null }); }));
    await h.ctx.setSongbookSession(editor);
    assert.equal(h.ctx.canEditSongbook(), true);
    const pending = h.ctx.setSongbookSession(fan);
    assert.equal(h.ctx.canEditSongbook(), false, 'no edit UI while the new user is unchecked');
    await flush(); finishFanCheck(); await pending;
    assert.equal(h.ctx.canEditSongbook(), false);
    await h.ctx.setSongbookSession(null);
    assert.equal(h.ctx.canEditSongbook(), false);
});

test('an older editor check cannot grant access after a newer sign-out', async () => {
    let finish;
    const h = songbook(() => new Promise(resolve => { finish = () => resolve({ data: true, error: null }); }));
    const pending = h.ctx.setSongbookSession(editor);
    await flush();
    await h.ctx.setSongbookSession(null);
    finish(); await pending;
    assert.equal(h.ctx.canEditSongbook(), false);
});

test('token refresh for the same editor keeps access without flicker', async () => {
    const h = songbook(async () => ({ data: true, error: null }));
    await h.ctx.setSongbookSession(editor);
    const refreshed = h.ctx.setSongbookSession({ user: { id: 'fixture-editor' } });
    assert.equal(h.ctx.canEditSongbook(), true);
    await refreshed;
    assert.equal(h.ctx.canEditSongbook(), true);
});

test('edit entry points and edit-only display no longer check the bare session', () => {
    const script = source.slice(source.indexOf('const S = {'));
    const reads = script.match(/S\.session\b(?!\s*=[^=])/g) || [];
    const allowed = section('function canEditSongbook()', 'function updateAuthUI()').match(/S\.session\b(?!\s*=[^=])/g) || [];
    assert.equal(reads.length, allowed.length, 'S.session is read only inside the editor check');
    for (const fn of ['openSongModal', 'openLiveModal', 'openBulkModal', 'openLiveBulkModal', 'openCoverBackfillModal', 'startCoverBackfill']) {
        const body = section(`function ${fn}(`, '\n}');
        assert.match(body, /if \(!canEditSongbook\(\)\) return;/, `${fn} is editor-only`);
    }
});
