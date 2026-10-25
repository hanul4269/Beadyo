const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sources = new Map();
function section(file, start, end) {
    if (!sources.has(file)) sources.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
    const source = sources.get(file), from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

// Run the real vendored SDK against an in-memory HTTP server substitute.
// No browser, live login, external fetch or production database is involved.
const runtime = vm.createContext({ console, URL, URLSearchParams, Headers, Request, Response,
    AbortController, AbortSignal, WebSocket, setTimeout, clearTimeout, setInterval, clearInterval,
    atob, btoa, crypto: require('node:crypto').webcrypto,
    process: { versions: { node: process.versions.node }, release: { name: 'node' } },
});
vm.runInContext(fs.readFileSync(path.join(root, 'supabase.min.js'), 'utf8'), runtime);
function clientFor(responder) {
    const requests = [];
    const fetch = async (input, init = {}) => {
        const request = new Request(input, init);
        const body = request.body ? await request.clone().json() : null;
        const url = new URL(request.url);
        requests.push({ method: request.method, url, body });
        const result = responder({ request, url, body }) || { rows: [] };
        if (result.error) return Response.json(result.error, { status: result.status || 403 });
        const rows = result.rows || [];
        if (request.headers.get('accept')?.includes('application/vnd.pgrst.object+json')) {
            if (rows.length !== 1) return Response.json({ code: 'PGRST116', message: '[테스트용] 변경된 자료를 확인하지 못했습니다', details: 'The result contains 0 rows', hint: null }, { status: 406 });
            return Response.json(rows[0]);
        }
        return Response.json(rows);
    };
    const db = runtime.supabase.createClient('https://isolated-fixture.invalid', 'fake-public-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch },
    });
    return { db, requests };
}

test('transient cover and stats-column checks can recover without reloading the page', async () => {
    for (const [start, end, name] of [
        ['let _liveExcludeColumnReady', 'let _songCoverColumnReady', 'ensureLiveExcludeColumn'],
        ['let _songCoverColumnReady', 'let _songbookTagsColumnReady', 'ensureSongCoverColumn'],
    ]) {
        let calls = 0;
        const { db } = clientFor(() => ++calls === 1
            ? { error: { code: 'PGRST301', message: '[테스트용] 로그인 시각 확인 지연' }, status: 401 } : { rows: [] });
        const ctx = vm.createContext({ db, ensureDb: async () => {} });
        vm.runInContext(section('songbook.html', start, end), ctx);
        assert.equal(await ctx[name](), false);
        assert.equal(await ctx[name](), true);
        assert.equal(await ctx[name](), true);
        assert.equal(calls, 2, 'healthy feature checks are cached, failed checks are retried');
    }
});

test('music update does not close the form or claim success when RLS changes zero rows', async () => {
    for (const exists of [false, true]) {
        const nodes = Object.fromEntries(Object.entries({
            'field-url': 'https://youtu.be/abc123_-XYZ', 'field-title': '[테스트용] 가짜 음악',
            'field-type': 'cover', 'field-date': '2026-11-01', 'field-collab': '', 'btn-save': '',
        }).map(([key, value]) => [key, { value, disabled: false }]));
        const { db } = clientFor(() => ({ rows: exists ? [{ id: 990007 }] : [] }));
        const messages = []; let closed = 0;
        const ctx = vm.createContext({ db, document: { getElementById: id => nodes[id] },
            state: { isEditor: true, editingId: 990007 }, ensureDb: async () => {},
            safeYtUrl: value => value, extractVideoId: () => 'abc123_-XYZ', parseDate: value => value,
            showToast: message => messages.push(message), closeModal: () => { closed++; }, loadSongs: async () => {},
        });
        vm.runInContext(section('songs.html', '        async function saveSong()', '        async function deleteSong('), ctx);
        await ctx.saveSong();
        assert.equal(closed, exists ? 1 : 0);
        assert.equal(messages.includes('수정되었습니다'), exists);
        assert.equal(nodes['btn-save'].disabled, false);
        assert.equal(nodes['field-title'].value, '[테스트용] 가짜 음악');
    }
});

test('zero-row calendar memo update preserves the old displayed record and unsaved input', async () => {
    const { db } = clientFor(() => ({ rows: [] }));
    const state = { memoCards: [{ id: 990007, content: '[테스트용] 원래 가짜 메모', url: '' }] };
    const messages = []; let reset = 0;
    const form = { content: { value: '[테스트용] 저장되지 않은 가짜 메모' }, url: { value: '' } };
    const ctx = vm.createContext({ db, state, _memoEditingId: 990007, _memoFormEls: () => form,
        normalizeOptionalUrl: value => value, _ensureDb: async () => {},
        _resetMemoForm: () => { reset++; }, renderMemoSidebar() {}, renderMemoModalList() {},
        showToast: message => messages.push(message), handleSupabaseMutationError: async (_, message) => messages.push(message),
    });
    vm.runInContext(section('app.js', 'async function addMemoCard(', 'function editMemoCard('), ctx);
    await ctx.addMemoCard();
    assert.equal(state.memoCards[0].content, '[테스트용] 원래 가짜 메모');
    assert.equal(reset, 0);
    assert.equal(messages.includes('메모를 수정했어요'), false);
    assert.match(form.content.value, /저장되지 않은/);
});

test('zero-row request status update restores the selection and leaves the record unchanged', async () => {
    const { db } = clientFor(() => ({ rows: [] }));
    const request = { id: 990007, status: 'received' }, messages = [];
    const select = { dataset: { requestId: '990007' }, value: 'completed', disabled: false };
    const ctx = vm.createContext({ db, state: { isAdmin: true, requests: [request] },
        STATUS_LABELS: { received: '접수', completed: '완료' }, renderRequests() {},
        showToast: message => messages.push(message), console: { error() {} },
    });
    vm.runInContext(section('development-requests.html', '        async function changeStatus(', '        function startRequestEdit('), ctx);
    await ctx.changeStatus(select);
    assert.equal(request.status, 'received'); assert.equal(select.value, 'received');
    assert.equal(select.disabled, false); assert.deepEqual(messages, ['상태를 변경하지 못했어요.']);
});

test('zero-row content deletion preserves the local item instead of reporting deletion', async () => {
    const { db } = clientFor(() => ({ rows: [] }));
    const state = { isEditor: true, saving: false, items: [{ id: 'test-only', title: '[테스트용] 가짜 콘텐츠' }] };
    const messages = []; let closed = 0;
    const ctx = vm.createContext({ db, state, confirm: () => true, $: () => ({ hidden: true }),
        closeDetail: () => { closed++; }, closeForm() {}, renderGrid() {},
        showToast: message => messages.push(message), console: { error() {} },
    });
    vm.runInContext(section('content.js', '    async function deleteContent(', '    let toastTimer'), ctx);
    await ctx.deleteContent('test-only');
    assert.equal(state.items.length, 1); assert.equal(closed, 0); assert.equal(state.saving, false);
    assert.equal(messages.includes('콘텐츠를 삭제했습니다'), false);
});

test('partial memo-order failures are surfaced and preserve the previous local order', async () => {
    const { db, requests } = clientFor(({ url }) => url.searchParams.get('id') === 'eq.990008'
        ? { rows: [{ id: 990008 }] } : { rows: [] });
    const state = { memoCards: [{ id: 990007, sort_order: 0 }, { id: 990008, sort_order: 1 }] };
    const messages = [];
    const ctx = vm.createContext({ db, state, _memoDragId: 990007, _ensureDb: async () => {},
        renderMemoSidebar() {}, renderMemoModalList() {}, showToast: message => messages.push(message),
    });
    vm.runInContext(section('app.js', 'async function memoDrop(', '// 모바일 메모 모달'), ctx);
    await ctx.memoDrop({ preventDefault() {}, currentTarget: { classList: { remove() {} } } }, 990008);
    assert.deepEqual(Array.from(state.memoCards, row => row.id), [990007, 990008]);
    assert.deepEqual(Array.from(state.memoCards, row => row.sort_order), [0, 1]);
    assert.equal(requests.length, 2); assert.match(messages[0], /일부 저장하지 못/);
});

test('cover undo preserves newer values, confirms actual changes and retains only failed entries', async () => {
    const old = 'https://example.invalid/test-old.jpg', newer = 'https://example.invalid/test-new.jpg';
    const rows = new Map([[990007, { id: 990007, cover_url: old }], [990008, { id: 990008, cover_url: newer }], [990009, { id: 990009, cover_url: old }]]);
    const { db, requests } = clientFor(({ url, body }) => {
        const id = Number(url.searchParams.get('id').slice(3));
        if (id === 990009) return { error: { message: '[테스트용] 권한 변경', code: '42501' }, status: 403 };
        const row = rows.get(id), expected = url.searchParams.get('cover_url')?.slice(3);
        if (!row || row.cover_url !== expected) return { rows: [] };
        Object.assign(row, body); return { rows: [{ id }] };
    });
    const state = { songbookData: Array.from(rows.values(), row => ({ ...row })), query: '' };
    const entries = [990007, 990008, 990009, 990010].map(id => ({ id, coverUrl: old }));
    const messages = [], logs = [];
    const ctx = vm.createContext({ db, S: state, _coverBackfillRunning: false, _lastCoverBackfillSaved: entries,
        confirm: () => true, document: { getElementById: () => ({}) }, ensureDb: async () => {},
        appendCoverLog: message => logs.push(message), updateCoverRunActions() {}, updateCoverBackfillCounts() {}, renderSongbook() {},
        handleSongbookMutationError: async (_, message) => messages.push(message), showToast: message => messages.push(message),
    });
    vm.runInContext(section('songbook.html', 'async function undoLastCoverBackfill()', 'const BULK_CATS'), ctx);
    await ctx.undoLastCoverBackfill();
    assert.equal(rows.get(990007).cover_url, null);
    assert.equal(rows.get(990008).cover_url, newer);
    assert.equal(rows.get(990009).cover_url, old);
    assert.equal(state.songbookData[1].cover_url, newer);
    assert.deepEqual(Array.from(ctx._lastCoverBackfillSaved, row => row.id), [990009]);
    assert.equal(requests.length, 4);
    assert.match(logs[0], /1곡 되돌림.*2곡 유지.*1곡/);
    assert.match(messages[0], /1곡 실패/);
    for (const { url } of requests) assert.equal(url.searchParams.get('cover_url'), 'eq.' + old);
});
