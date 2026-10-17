// Run with: node --test scripts/test-schedule-editor.cjs
// All schedule writes are in-memory stubs; this suite never connects to Supabase.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));
function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `Missing schedule section: ${start}`);
    return source.slice(from, to);
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function element() {
    const classes = new Set();
    return { value: '', checked: false, disabled: false, hidden: false, innerHTML: '', textContent: '', dataset: {}, style: {},
        classList: { add: name => classes.add(name), remove: name => classes.delete(name),
            contains: name => classes.has(name), toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
        setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
        focus() {}, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
        scrollTo() {}, removeEventListener() {},
    };
}
function event(overrides = {}) {
    return { id: 'source-1', date: '2026-12-31', end_date: '2027-01-02', start_time: '21:35:00', duration: '2시간',
        title: '원본 일정', type: 'collab', subtitle: '원본 부제', collab: '등록된 출연자', memo: '원본 메모', is_rest: false,
        vod_url: 'https://example.test/original-vod', youtube_links: 'https://www.youtube.com/watch?v=abcdefghijk\nhotclip:https://vod.sooplive.com/player/123456',
        created_by: 'source-author', created_at: '2026-10-01T00:00:00Z', sort_order: 999, ...overrides };
}
function harness(options = {}) {
    const nodes = new Map(), toasts = [], writes = [], alignedDates = [], hotclips = [element(), element(), element()], radios = [];
    const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    const owner = { email: 'editor@example.test', name: 'Editor' };
    const state = { events: [event()], isEditor: true, user: owner, year: 2026, month: 9, ...options.state };
    let reloads = 0, mutation = options.mutation || (async () => ({ error: null }));
    const document = { body: element(), activeElement: null,
        getElementById: node,
        querySelectorAll(selector) {
            if (selector === '.edit-hotclip-url') return hotclips;
            if (/radio|editType|scheduleType/.test(selector)) return radios;
            return [];
        },
        querySelector: () => null,
    };
    const db = { from(table) {
        assert.equal(table, 'schedules');
        return {
            insert(payload) { writes.push({ mode: 'insert', payload: json(payload) }); return mutation(writes.at(-1)); },
            update(payload) { return { eq(key, id) { assert.equal(key, 'id'); writes.push({ mode: 'update', id, payload: json(payload) }); return mutation(writes.at(-1)); } }; },
        };
    } };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const context = vm.createContext({ state, document, db, Date, URL, Promise, Object, String, Number, Array,
        OWNER_EMAIL: 'owner@example.test',
        window: { BeadyoExploreData: require('../explore-data.js') },
        _ensureDb: options.ensureDb || (async () => {}),
        showToast: message => toasts.push(message),
        handleSupabaseMutationError: async (_, message) => toasts.push(message),
        loadEvents: async () => { reloads++; if (options.onReload) options.onReload(state); },
        nextSortOrderForDate: () => 17,
        resetScheduleDrag() {},
        closeViewModal: () => node('viewModal').classList.remove('open'),
        openViewModal() {}, openDayViewModal() {}, renderCalendar() {}, renderMemoSidebar() {},
        alignCalendarDate: date => alignedDates.push(date),
        checkEditorAccess: options.checkEditorAccess || (async () => true), safeImageUrl: value => value || '',
        normalizeOptionalUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return value ? null : ''; } },
        ytLinkType: value => /youtube\.com/.test(value || '') ? 'long' : null,
        esc, jsArg: value => esc(JSON.stringify(String(value ?? ''))), typeStyle: type => `color:${type.text}`,
        setTimeout: fn => { fn(); return 1; }, clearTimeout() {}, requestAnimationFrame: fn => fn(),
        console: { error() {}, warn() {} }, confirm: () => true, prompt: () => '',
    });
    vm.runInContext(section('const EVENT_TYPES =', 'const HOLIDAYS =') +
        section('const HOTCLIP_LINK_PREFIX', 'function pad(n)') +
        section('function pad(n)', 'function eventEndDate(') +
        section('// ─── 추가/수정 모달 ───', '// ─── 편집자 관리 ───') +
        section('async function setSessionUser(', '// ─── 모바일 스와이프'), context);
    const types = vm.runInContext('EVENT_TYPES', context);
    radios.push(...Array.from(types, type => ({ ...element(), value: type.key })));
    node('editTypeOptions').querySelectorAll = () => radios;
    node('editModal').querySelectorAll = () => [
        ...['editDate', 'editEndDate', 'editTime', 'editDuration', 'editTitle', 'editType', 'editCollab',
            'editSubtitle', 'editVodUrl', 'editMemo', 'editIsRest', 'editPreservedLinks', 'editId', 'saveEventBtn'].map(node),
        ...hotclips, ...radios,
    ];
    context.initTimePicker = value => { node('editTime').value = value; };
    return { context, state, node, hotclips, radios, types, toasts, writes, alignedDates,
        reloads: () => reloads, setMutation(fn) { mutation = fn; } };
}

test('category choices use every registered type and keep the native checked value and rest flag synchronized', () => {
    const h = harness();
    h.context.populateTypeSelect();
    assert.match(h.node('editTypeOptions').innerHTML, /type="radio"/);
    for (const type of h.types) {
        h.context.selectEventType(type.key);
        assert.equal(h.node('editType').value, type.key);
        assert.deepEqual(h.radios.filter(radio => radio.checked).map(radio => radio.value), [type.key]);
        assert.equal(h.node('editIsRest').checked, type.key === 'rest');
    }
});

test('filling a legacy rest-flag mismatch preserves it until the user chooses a category', () => {
    const h = harness();
    h.context.fillEditForm(event({ type: 'chat', is_rest: true }), '수정', 'source-1');
    assert.equal(h.node('editType').value, 'chat');
    assert.equal(h.node('editIsRest').checked, true);
    h.context.selectEventType('song');
    assert.equal(h.node('editIsRest').checked, false);
    h.context.selectEventType('rest');
    assert.equal(h.node('editIsRest').checked, true);
});

test('copy only captures a draft and closes details, without opening an editor or writing a row', () => {
    const h = harness();
    h.node('viewModal').classList.add('open');
    h.context.copyEvent('source-1');
    assert.equal(h.node('viewModal').classList.contains('open'), false);
    assert.equal(h.node('editModal').classList.contains('open'), false);
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
});

test('clipboard keeps an independent snapshot after the original changes or the month reloads', () => {
    const h = harness();
    const original = h.state.events[0];
    h.context.copyEvent(original.id);
    original.title = '수정된 원본';
    original.memo = '수정된 메모';
    original.end_date = '2027-01-30';
    original.vod_url = 'https://example.test/changed-vod';
    original.youtube_links = 'https://www.youtube.com/watch?v=changed1234';
    h.state.events = [];
    h.state.month = 10;
    h.context.pasteCopiedEvent('2024-02-28');
    assert.equal(h.node('editId').value, '');
    assert.equal(h.node('editTitle').value, '원본 일정');
    assert.equal(h.node('editMemo').value, '원본 메모');
    assert.equal(h.node('editDate').value, '2024-02-28');
    assert.equal(h.node('editEndDate').value, '2024-03-01');
    assert.equal(h.node('editTime').value, '21:35');
    assert.equal(h.node('editDuration').value, '2시간');
    assert.equal(h.node('editSubtitle').value, '원본 부제');
    assert.equal(h.node('editCollab').value, '등록된 출연자');
    assert.equal(h.node('editType').value, 'collab');
    assert.equal(h.node('editVodUrl').value, 'https://example.test/original-vod');
    assert.equal(h.node('editPreservedLinks').value, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.deepEqual(h.hotclips.map(input => input.value), ['https://vod.sooplive.com/player/123456', '', '']);
    assert.equal(h.node('editModal').classList.contains('open'), true);
});

test('pasting moves the entire period across leap days, month and year boundaries', () => {
    for (const [target, expectedEnd] of [
        ['2024-02-28', '2024-03-01'], ['2025-02-28', '2025-03-02'],
        ['2026-10-31', '2026-11-02'], ['2026-12-31', '2027-01-02'],
    ]) {
        const h = harness();
        h.context.copyEvent('source-1');
        h.context.pasteCopiedEvent(target);
        assert.equal(h.node('editDate').value, target);
        assert.equal(h.node('editEndDate').value, expectedEnd);
    }
    const single = harness({ state: { events: [event({ end_date: null })] } });
    single.context.copyEvent('source-1');
    single.context.pasteCopiedEvent('2027-01-01');
    assert.equal(single.node('editEndDate').value, '');
});

test('changing a copied start date moves its period until the user explicitly edits the end date', () => {
    const h = harness();
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-01');
    h.node('editDate').value = '2026-10-31';
    h.context.updateCopiedEventDates('2026-10-31');
    assert.equal(h.node('editEndDate').value, '2026-11-02');
    h.node('editEndDate').value = '2026-11-15';
    h.context.editCopyEndDateChanged();
    h.node('editDate').value = '2026-11-01';
    h.context.updateCopiedEventDates('2026-11-01');
    assert.equal(h.node('editEndDate').value, '2026-11-15');
});

test('saving a pasted draft preserves media while creating a fresh row without source identity or ordering', async () => {
    const h = harness();
    const original = json(h.state.events[0]);
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    assert.equal(h.node('editVodUrl').value, original.vod_url);
    assert.equal(h.node('editPreservedLinks').value, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.deepEqual(h.hotclips.map(input => input.value), ['https://vod.sooplive.com/player/123456', '', '']);
    await h.context.saveEvent();
    assert.equal(h.writes.length, 1);
    const { mode, payload } = h.writes[0];
    assert.equal(mode, 'insert');
    assert.equal(payload.date, '2026-10-17');
    assert.equal(payload.end_date, '2026-10-19');
    assert.equal(payload.title, '원본 일정');
    assert.equal(payload.sort_order, 17);
    assert.equal(payload.vod_url, original.vod_url);
    assert.equal(payload.youtube_links, original.youtube_links);
    for (const key of ['id', 'created_by', 'created_at', 'updated_at']) assert.equal(Object.hasOwn(payload, key), false);
    assert.deepEqual(json(h.state.events[0]), original);
    assert.deepEqual(h.alignedDates, ['2026-10-17']);
});

test('editing an existing record uses update and retains its own links and legacy rest flag', async () => {
    const h = harness({ state: { events: [event({ type: 'chat', is_rest: true })] } });
    h.context.openEditModal('source-1');
    h.node('editTitle').value = '수정한 일정';
    await h.context.saveEvent();
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'update');
    assert.equal(h.writes[0].id, 'source-1');
    assert.equal(h.writes[0].payload.title, '수정한 일정');
    assert.equal(h.writes[0].payload.vod_url, 'https://example.test/original-vod');
    assert.match(h.writes[0].payload.youtube_links, /youtube\.com/);
    assert.match(h.writes[0].payload.youtube_links, /hotclip:/);
    assert.equal(h.writes[0].payload.is_rest, true);
    assert.equal(Object.hasOwn(h.writes[0].payload, 'sort_order'), false);
});

test('guest copy, paste and save perform no mutation and cannot open a copied draft', async () => {
    const h = harness({ state: { isEditor: false, user: null } });
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    h.node('editTitle').value = '우회 시도';
    h.node('editDate').value = '2026-10-17';
    await h.context.saveEvent();
    assert.equal(h.node('editModal').classList.contains('open'), false);
    assert.equal(h.writes.length, 0);
});

test('logout clears the memory clipboard even after the same editor signs in again', async () => {
    const h = harness();
    h.context.copyEvent('source-1');
    await h.context.setSessionUser(null);
    await h.context.setSessionUser({ email: 'editor@example.test' });
    assert.equal(h.state.isEditor, true);
    h.context.pasteCopiedEvent('2026-10-17');
    assert.equal(h.node('editModal').classList.contains('open'), false);
});

test('losing editor permission clears a prior clipboard before permission is granted again', async () => {
    let allowed = false;
    const h = harness({ checkEditorAccess: async () => allowed });
    h.context.copyEvent('source-1');
    await h.context.setSessionUser({ email: 'editor@example.test' });
    assert.equal(h.state.isEditor, false);
    allowed = true;
    await h.context.setSessionUser({ email: 'editor@example.test' });
    h.context.pasteCopiedEvent('2026-10-17');
    assert.equal(h.node('editModal').classList.contains('open'), false);
});

test('a late permission grant cannot replace a newer denial for the same account', async () => {
    const older = deferred(), newer = deferred();
    const pending = [older, newer];
    const h = harness({ checkEditorAccess: () => pending.shift().promise });
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    const first = h.context.setSessionUser({ email: 'editor@example.test' });
    const second = h.context.setSessionUser({ email: 'editor@example.test' });
    newer.resolve(false);
    await second;
    older.resolve(true);
    await first;
    assert.equal(h.state.isEditor, false);
    assert.equal(h.node('editModal').classList.contains('open'), false);
    assert.equal(h.node('scheduleCopyBar').hidden, true);
});

test('a late permission denial cannot close a draft or clear the clipboard after a newer grant', async () => {
    const older = deferred(), newer = deferred();
    const pending = [older, newer];
    const h = harness({ checkEditorAccess: () => pending.shift().promise });
    h.context.copyEvent('source-1');
    const first = h.context.setSessionUser({ email: 'editor@example.test' });
    const second = h.context.setSessionUser({ email: 'editor@example.test' });
    newer.resolve(true);
    await second;
    h.context.pasteCopiedEvent('2026-10-17');
    h.node('editTitle').value = '유지할 작성 중 일정';
    older.resolve(false);
    await first;
    assert.equal(h.state.isEditor, true);
    assert.equal(h.node('editModal').classList.contains('open'), true);
    assert.equal(h.node('editTitle').value, '유지할 작성 중 일정');
    h.context.closeEditModal();
    h.context.pasteCopiedEvent('2026-11-01');
    assert.equal(h.node('editModal').classList.contains('open'), true);
    assert.equal(h.node('editTitle').value, '원본 일정');
    assert.equal(h.node('editDate').value, '2026-11-01');
});

test('permission results from before logout cannot affect a new session for the same account', async () => {
    const beforeLogout = deferred(), afterLogin = deferred();
    const pending = [beforeLogout, afterLogin];
    const h = harness({ checkEditorAccess: () => pending.shift().promise });
    const stale = h.context.setSessionUser({ email: 'editor@example.test' });
    await h.context.setSessionUser(null);
    const current = h.context.setSessionUser({ email: 'editor@example.test' });
    afterLogin.resolve(false);
    await current;
    beforeLogout.resolve(true);
    await stale;
    assert.equal(h.state.user.email, 'editor@example.test');
    assert.equal(h.state.isEditor, false);
    assert.equal(h.node('editModal').classList.contains('open'), false);
});

test('save validation rejects a reversed period without writing or leaving the save button locked', async () => {
    const h = harness();
    h.context.openAddModal('2026-10-17');
    h.node('editTitle').value = '일정';
    h.node('editEndDate').value = '2026-10-16';
    await h.context.saveEvent();
    assert.equal(h.writes.length, 0);
    assert.equal(h.node('saveEventBtn').disabled, false);
    assert.equal(h.node('editModal').classList.contains('open'), true);
    assert.ok(h.toasts.some(message => /종료|기간/.test(message)));
});

test('double save shares a single mutation while the database is still initializing', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.context.openAddModal('2026-10-17');
    h.node('editTitle').value = '일정';
    const first = h.context.saveEvent();
    const second = h.context.saveEvent();
    assert.equal(h.node('saveEventBtn').disabled, true);
    ready.resolve();
    await Promise.all([first, second]);
    assert.equal(h.writes.length, 1);
    assert.equal(h.node('saveEventBtn').disabled, false);
});

test('rights lost while initialization is pending prevent a late save', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.context.openAddModal('2026-10-17');
    h.node('editTitle').value = '일정';
    const saving = h.context.saveEvent();
    h.state.isEditor = false;
    h.state.user = null;
    ready.resolve();
    await saving;
    assert.equal(h.writes.length, 0);
    assert.equal(h.node('saveEventBtn').disabled, false);
});

test('switching from editor A to B and back to A invalidates the pending save and old clipboard', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    const saving = h.context.saveEvent();
    await h.context.setSessionUser({ email: 'second-editor@example.test' });
    await h.context.setSessionUser({ email: 'editor@example.test' });
    assert.equal(h.state.isEditor, true);
    assert.equal(h.state.user.email, 'editor@example.test');
    ready.resolve();
    await saving;
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
    assert.equal(h.node('saveEventBtn').disabled, false);
    assert.equal(h.node('editModal').classList.contains('open'), false);
    h.context.pasteCopiedEvent('2026-11-01');
    assert.equal(h.node('editModal').classList.contains('open'), false);
});

test('database initialization failure leaves the draft intact and permits a successful retry', async () => {
    let attempts = 0;
    const h = harness({ ensureDb: async () => {
        if (++attempts === 1) throw Error('Database client unavailable');
    } });
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    h.node('editTitle').value = '재시도할 초안';
    await h.context.saveEvent();
    assert.equal(h.writes.length, 0);
    assert.equal(h.node('saveEventBtn').disabled, false);
    assert.equal(h.node('editModal').classList.contains('open'), true);
    assert.equal(h.node('editTitle').value, '재시도할 초안');
    assert.ok(h.toasts.some(message => /다시 시도/.test(message)));
    await h.context.saveEvent();
    assert.equal(attempts, 2);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
    assert.equal(h.writes[0].payload.title, '재시도할 초안');
    assert.equal(h.node('editModal').classList.contains('open'), false);
});

test('failed save preserves the draft and clipboard and releases the lock for a successful retry', async () => {
    const h = harness({ mutation: async () => ({ error: { message: 'Temporary failure' } }) });
    h.context.copyEvent('source-1');
    h.context.pasteCopiedEvent('2026-10-17');
    h.node('editTitle').value = '저장할 초안';
    await h.context.saveEvent();
    assert.equal(h.node('editModal').classList.contains('open'), true);
    assert.equal(h.node('editTitle').value, '저장할 초안');
    assert.equal(h.node('saveEventBtn').disabled, false);
    assert.equal(h.reloads(), 0);
    h.setMutation(async () => ({ error: null }));
    await h.context.saveEvent();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1].payload.title, '저장할 초안');
    assert.equal(h.node('editModal').classList.contains('open'), false);
    h.context.pasteCopiedEvent('2026-11-01');
    assert.equal(h.node('editTitle').value, '원본 일정');
    assert.equal(h.node('editDate').value, '2026-11-01');
});

test('a thrown save failure is handled and unlocks a later attempt', async () => {
    const h = harness({ mutation: async () => { throw Error('Network disconnected'); } });
    h.context.openAddModal('2026-10-17');
    h.node('editTitle').value = '일정';
    await h.context.saveEvent();
    assert.equal(h.node('saveEventBtn').disabled, false);
    assert.equal(h.node('editModal').classList.contains('open'), true);
    h.setMutation(async () => ({ error: null }));
    await h.context.saveEvent();
    assert.equal(h.writes.length, 2);
});
