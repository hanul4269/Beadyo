// Run with: node --test scripts/test-schedule-context-menu.cjs
// The real calendar handlers run against in-memory DOM and database stubs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
function section(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `Missing calendar section: ${start}`);
    return source.slice(from, to);
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function event(values = {}) {
    return { type: 'contextmenu', clientX: 200, clientY: 100, button: 2, detail: 1,
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.stopped = true; this.immediateStopped = true; }, ...values };
}
function schedule(overrides = {}) {
    return { id: 'source', date: '2026-11-23', end_date: '2026-11-25', title: '[테스트용] 같은 제목',
        type: 'chat', sort_order: 0, ...overrides };
}
function harness(options = {}) {
    const nodes = new Map(), documentListeners = new Map(), windowListeners = new Map();
    const toasts = [], confirmations = [], writes = [];
    let reloads = 0, viewCloses = 0, mutation = options.mutation || (async () => ({ error: null }));
    const state = { isEditor: true, user: { email: 'editor@example.test' }, events: [schedule(), schedule({ id: 'same-title', date: '2026-11-26', end_date: null })],
        year: 2026, month: 10, viewMode: 'month', ytLinks: [], ...options.state };
    let document;
    function element(id = '') {
        const classes = new Set(), children = [];
        return { id, dataset: {}, style: {}, hidden: false, disabled: false, isConnected: true, innerHTML: '', textContent: '',
            offsetWidth: 176, offsetHeight: 48,
            classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name), toggle(name, on) { on ? classes.add(name) : classes.delete(name); } },
            focus() { document.activeElement = this; },
            contains(target) { return this === target || children.includes(target); },
            appendChild(child) { children.push(child); child.parentElement = this; },
            getBoundingClientRect() {
                if (id !== 'scheduleContextMenu') return { left: 100, top: 60, right: 260, bottom: 104, width: 160, height: 44 };
                const left = (options.fixedOrigin?.left || 0) + (parseFloat(this.style.left) || 0);
                const top = (options.fixedOrigin?.top || 0) + (parseFloat(this.style.top) || 0);
                return { left, top, right: left + this.offsetWidth, bottom: top + this.offsetHeight,
                    width: this.offsetWidth, height: this.offsetHeight };
            },
            setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
            getAttribute(name) { return this[name] ?? null; },
            querySelector: () => null, querySelectorAll: () => [],
        };
    }
    const node = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
    const listen = (listeners, type, callback) => listeners.set(type, [...(listeners.get(type) || []), callback]);
    const unlisten = (listeners, type, callback) => listeners.set(type, (listeners.get(type) || []).filter(item => item !== callback));
    document = { activeElement: null, body: element('body'), getElementById: node,
        documentElement: { clientWidth: 1280, clientHeight: 900 },
        querySelector: selector => node(selector), querySelectorAll: () => [],
        addEventListener: (type, callback) => listen(documentListeners, type, callback),
        removeEventListener: (type, callback) => unlisten(documentListeners, type, callback),
    };
    const window = { innerWidth: 1280, innerHeight: 900,
        addEventListener: (type, callback) => listen(windowListeners, type, callback),
        removeEventListener: (type, callback) => unlisten(windowListeners, type, callback),
    };
    const db = { from(table) {
        assert.equal(table, 'schedules');
        return { delete() { return { eq(key, id) {
            assert.equal(key, 'id');
            return { async select(columns) {
                assert.equal(columns, 'id');
                writes.push(id);
                return { data: [{ id }], ...await mutation(id) };
            } };
        } }; } };
    } };
    const context = vm.createContext({ state, document, window, db, Date, Promise, console: { error() {}, warn() {} },
        _scheduleEditorEpoch: 0, _scheduleAuthRequest: 0, _savingEvent: false, _scheduleDropPending: false,
        _scheduleContext: null, _scheduleDeletePending: false,
        _ensureDb: options.ensureDb || (async () => {}),
        confirm: message => { confirmations.push(message); return options.confirm ? options.confirm(message) : true; },
        showToast: message => toasts.push(message),
        handleSupabaseMutationError: async (_, message) => toasts.push(message),
        loadEvents: async () => { reloads++; }, closeViewModal: () => { viewCloses++; },
        esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        jsArg: value => JSON.stringify(String(value ?? '')).replace(/"/g, '&quot;'),
        OWNER_EMAIL: 'owner@example.test', safeImageUrl: value => value || '',
        checkEditorAccess: options.checkEditorAccess || (async () => true),
        resetScheduleDrag() {}, hideMemoTooltip() {}, clearCopiedEvent() {}, closeEditModal() {}, refreshScheduleCopyUi() {}, renderMemoSidebar() {},
        renderSecondaryViews() {}, getHoliday: () => null, typeOf: () => ({ text: '', icon: '' }), eventCardStyle: () => '',
        chipFontSize: () => '12px', chipSubtitleFontSize: () => '10px', eventYoutubeLinks: () => [],
        stickerImg: () => '', MOOD_STICKERS: {}, toAmPm: value => value, ytLinkType: () => null, safeUrl: value => value,
        calendarEventsForDate: date => state.events.filter(ev => date >= ev.date && date <= (ev.end_date || ev.date)),
        requestAnimationFrame: fn => fn(), setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
    });
    node('scheduleContextMenu').hidden = true;
    node('scheduleContextMenu').appendChild(node('scheduleContextDelete'));
    node('scheduleContextMenu').querySelector = () => node('scheduleContextDelete');
    node('scheduleContextDelete').textContent = '삭제';
    vm.runInContext(section('function isRestEvent(', 'function stickerForEvent(') +
        section('function pad(n)', 'function broadcastInfoForDate(') +
        section('function scheduleDragEditor()', 'function scheduleDragUsesCommand(') +
        section('// ─── 일정 우클릭 메뉴 ───', '// ─── 편집자 관리 ───') +
        section('function renderCalendar()', '// ─── 메모카드 ───') +
        section('async function setSessionUser(', '// ─── 모바일 스와이프'), context);
    async function dispatch(type, values = {}) {
        const e = event({ type, ...values });
        const callbacks = [...(windowListeners.get(type) || []), ...(documentListeners.get(type) || [])];
        await Promise.all(callbacks.map(callback => callback(e)));
        return e;
    }
    function open(id = 'source', values = {}) {
        const trigger = element('card-' + id);
        trigger.focus();
        const e = event({ target: trigger, currentTarget: trigger, ...values });
        context.openScheduleContextMenu(e, id);
        return { trigger, event: e };
    }
    return { context, state, document, window, node, element, open, dispatch, toasts, confirmations, writes,
        reloads: () => reloads, viewCloses: () => viewCloses, setMutation(fn) { mutation = fn; } };
}

test('opening the editor context menu displays the selected schedule without confirming or deleting', () => {
    const h = harness();
    const opened = h.open();
    assert.equal(opened.event.prevented, true);
    assert.equal(h.node('scheduleContextMenu').hidden, false);
    assert.equal(h.node('scheduleContextTitle').textContent, '[테스트용] 같은 제목');
    assert.match(h.node('scheduleContextDate').textContent, /2026.*11.*23/);
    assert.equal(h.document.activeElement, h.node('scheduleContextDelete'));
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

test('guest cards expose no menu action and direct deletion does not confirm or write', async () => {
    const h = harness({ state: { isEditor: false, user: null } });
    h.context.renderCalendar();
    assert.doesNotMatch(h.node('calGrid').innerHTML, /oncontextmenu/);
    h.open();
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    await h.context.deleteEvent('source');
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

test('all continuation cards retain their source ID and equal titles keep their separate IDs', () => {
    const h = harness();
    h.context.renderCalendar();
    const html = h.node('calGrid').innerHTML;
    const contexts = [...html.matchAll(/oncontextmenu="([^"]*)"/g)].map(match => match[1]);
    assert.equal(contexts.filter(value => /source/.test(value)).length, 3);
    assert.equal(contexts.filter(value => /same-title/.test(value)).length, 1);
});

test('delete menu choice confirms once and deletes only the selected ID, regardless of matching titles', async () => {
    const h = harness();
    h.open('same-title');
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.confirmations.length, 1);
    assert.match(h.confirmations[0], /같은 제목/);
    assert.match(h.confirmations[0], /2026.*11.*26/);
    assert.deepEqual(h.writes, ['same-title']);
    assert.equal(h.reloads(), 1);
    assert.equal(h.node('scheduleContextMenu').hidden, true);
});

test('declining the existing confirmation leaves every schedule untouched', async () => {
    const h = harness({ confirm: () => false });
    h.open();
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.confirmations.length, 1);
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
});

test('Escape closes the menu and restores focus to the source card', async () => {
    const h = harness();
    const { trigger } = h.open();
    const e = await h.dispatch('keydown', { key: 'Escape' });
    assert.equal(e.prevented, true);
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    assert.equal(h.document.activeElement, trigger);
});

for (const reason of ['pointerdown', 'focusin', 'scroll', 'resize', 'blur']) test(`${reason} closes the context menu without stealing focus`, async () => {
    const h = harness();
    h.open();
    const other = h.element('other-control');
    other.focus();
    await h.dispatch(reason, { target: other });
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    assert.equal(h.document.activeElement, other);
});

test('a pointer action inside the menu does not close it before the delete action can run', async () => {
    const h = harness();
    h.open();
    await h.dispatch('pointerdown', { target: h.node('scheduleContextDelete') });
    assert.equal(h.node('scheduleContextMenu').hidden, false);
});

test('focus inside the menu retains the action, while search input focus closes it and releases arrow keys', async () => {
    const h = harness();
    h.open();
    await h.dispatch('focusin', { target: h.node('scheduleContextDelete') });
    assert.equal(h.node('scheduleContextMenu').hidden, false);
    const input = h.element('unified-search-input');
    input.focus();
    await h.dispatch('focusin', { target: input });
    const arrow = await h.dispatch('keydown', { key: 'ArrowDown' });
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    assert.equal(h.document.activeElement, input);
    assert.equal(arrow.prevented, false);
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

for (const modifier of ['metaKey', 'ctrlKey']) test(`${modifier}+K closes the menu before search records its return focus`, async () => {
    const h = harness();
    const { trigger } = h.open();
    let searchReturnFocus;
    h.document.addEventListener('keydown', () => { searchReturnFocus = h.document.activeElement; });
    const key = await h.dispatch('keydown', { key: 'k', [modifier]: true });
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    assert.equal(searchReturnFocus, trigger);
    assert.equal(key.prevented, false);
    assert.equal(key.stopped, false);
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

test('Shift+F10 opens the selected card menu and Tab closes it for normal keyboard navigation', () => {
    const h = harness();
    const trigger = h.element('keyboard-card');
    trigger.focus();
    const e = event({ type: 'keydown', key: 'F10', shiftKey: true, currentTarget: trigger, target: trigger });
    h.context.scheduleContextTriggerKey(e, 'source');
    assert.equal(e.prevented, true);
    assert.equal(h.node('scheduleContextMenu').hidden, false);
    assert.equal(h.node('scheduleContextMenu').style.left, '100px');
    assert.equal(h.node('scheduleContextMenu').style.top, '104px');
    h.context.scheduleContextMenuKey(event({ key: 'Tab' }));
    assert.equal(h.node('scheduleContextMenu').hidden, true);
});

test('context menu positioning stays inside narrow viewports near the bottom-right corner', () => {
    for (const width of [320, 375]) {
        const h = harness();
        h.window.innerWidth = width;
        h.window.innerHeight = 568;
        h.document.documentElement.clientWidth = width;
        h.document.documentElement.clientHeight = 568;
        h.open('source', { clientX: width - 1, clientY: 567 });
        const menu = h.node('scheduleContextMenu');
        const left = parseFloat(menu.style.left), top = parseFloat(menu.style.top);
        assert.ok(left >= 8 && left + menu.offsetWidth <= width - 8);
        assert.ok(top >= 8 && top + menu.offsetHeight <= 560);
    }
});

test('desktop scrollbar gutters do not shift the context menu beyond the visible document edge', () => {
    const h = harness({ fixedOrigin: { left: 15, top: 0 } });
    h.document.documentElement.clientWidth = 1265;
    h.document.documentElement.clientHeight = 885;
    h.open('source', { clientX: 1279, clientY: 899 });
    const rect = h.node('scheduleContextMenu').getBoundingClientRect();
    assert.equal(h.window.innerWidth, 1280);
    assert.equal(rect.right, 1265 - 8);
    assert.equal(rect.bottom, 885 - 8);
    assert.ok(rect.left >= 15);
    assert.equal(h.writes.length, 0);
});

test('logging out closes an open menu and its stale delete action cannot write', async () => {
    const h = harness();
    h.open();
    await h.context.setSessionUser(null);
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.writes.length, 0);
});

test('losing permission on the same account closes the menu and prevents a stale selection', async () => {
    const h = harness({ checkEditorAccess: async () => false });
    h.open();
    await h.context.setSessionUser({ email: 'editor@example.test' });
    assert.equal(h.state.isEditor, false);
    assert.equal(h.node('scheduleContextMenu').hidden, true);
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

test('a menu selected before an account switch cannot confirm deletion for the new editor', async () => {
    const h = harness();
    h.open();
    h.state.user = { email: 'another-editor@example.test' };
    vm.runInContext('_scheduleEditorEpoch++', h.context);
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
});

test('a pending delete is invalidated by a permission change even if the email later matches again', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.open();
    const pending = h.context.deleteScheduleFromContextMenu();
    vm.runInContext('_scheduleEditorEpoch += 2', h.context);
    ready.resolve();
    await pending;
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
});

test('duplicate delete actions share the lock while initialization is pending', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    const first = h.context.deleteEvent('source');
    const second = h.context.deleteEvent('source');
    ready.resolve();
    await Promise.all([first, second]);
    assert.equal(h.confirmations.length, 1);
    assert.deepEqual(h.writes, ['source']);
    assert.equal(h.reloads(), 1);
});

for (const thrown of [false, true]) test(`${thrown ? 'thrown' : 'returned'} delete failures unlock a later retry without reporting success`, async () => {
    const h = harness({ mutation: async () => {
        if (thrown) throw Error('Network disconnected');
        return { error: { message: 'Temporary failure' } };
    } });
    h.open();
    await h.context.deleteScheduleFromContextMenu();
    assert.equal(h.reloads(), 0);
    assert.ok(h.toasts.length > 0);
    assert.ok(h.toasts.every(message => !/삭제되었습니다/.test(message)));
    h.setMutation(async () => ({ error: null }));
    h.open();
    await h.context.deleteScheduleFromContextMenu();
    assert.deepEqual(h.writes, ['source', 'source']);
    assert.equal(h.reloads(), 1);
});

test('database initialization failure is handled and releases the delete lock for retry', async () => {
    let attempts = 0;
    const h = harness({ ensureDb: async () => { if (++attempts === 1) throw Error('Client unavailable'); } });
    await h.context.deleteEvent('source');
    assert.equal(h.writes.length, 0);
    await h.context.deleteEvent('source');
    assert.deepEqual(h.writes, ['source']);
    assert.equal(h.reloads(), 1);
});

test('a response without the selected deleted ID never reports deletion success', async () => {
    for (const data of [null, [], [{ id: 'another-record' }]]) {
        const h = harness({ mutation: async () => ({ data, error: null }) });
        h.open();
        const result = await h.context.deleteScheduleFromContextMenu();
        assert.equal(result, false);
        assert.deepEqual(h.writes, ['source']);
        assert.equal(h.viewCloses(), 0);
        assert.equal(h.reloads(), 1);
        assert.ok(h.toasts.some(message => /삭제되지 않았습니다/.test(message)));
        assert.ok(h.toasts.every(message => !/삭제되었습니다/.test(message)));
    }
});
