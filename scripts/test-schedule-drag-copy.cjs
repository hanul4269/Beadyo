// Run with: node --test scripts/test-schedule-drag-copy.cjs
// Uses the real calendar drag handlers with in-memory writes; no database access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));
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
function element() {
    const classes = new Set();
    const listeners = new Map();
    return { dataset: {}, style: {}, textContent: '', hidden: false, draggable: true, removed: false, offsetWidth: 160, offsetHeight: 44,
        classList: { add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name),
            toggle(name, on) { on ? classes.add(name) : classes.delete(name); } },
        contains(other) { return this === other; }, setAttribute(name, value) { this[name] = value; },
        getAttribute(name) { return this[name] ?? null; }, removeAttribute(name) { delete this[name]; },
        closest(selector) { return selector.includes('cal-cell') && this.classList.contains('cal-cell') ? this : null; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 160, height: 44 }),
        setPointerCapture(id) { this.capturedPointer = id; }, releasePointerCapture(id) { if (this.capturedPointer === id) delete this.capturedPointer; },
        hasPointerCapture(id) { return this.capturedPointer === id; },
        appendChild(child) { child.parentElement = this; }, remove() { this.removed = true; }, cloneNode: () => element(),
        addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
        removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== callback)); },
        dispatchEvent(event) { (listeners.get(event.type) || []).forEach(callback => callback(event)); },
    };
}
function dragEvent(modifiers = {}, currentTarget = element()) {
    const data = new Map();
    return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers,
        currentTarget, relatedTarget: null, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.stopped = true; this.immediateStopped = true; },
        dataTransfer: { effectAllowed: 'uninitialized', dropEffect: 'none',
            setData: (type, value) => data.set(type, value), getData: type => data.get(type) || '' },
    };
}
function schedule(overrides = {}) {
    return { id: 'source', date: '2026-12-31', end_date: '2027-01-02', title: '복사할 일정',
        start_time: '21:35:00', duration: '2시간', type: 'chat', is_rest: true,
        subtitle: '등록된 부제', collab: '등록된 참여자', memo: '등록된 메모',
        vod_url: 'https://example.test/registered-vod',
        youtube_links: 'https://www.youtube.com/watch?v=abcdefghijk\nhotclip:https://vod.sooplive.com/player/123456',
        sort_order: 4, created_by: 'original-author', created_at: '2026-10-17T00:00:00Z', ...overrides };
}
function harness(options = {}) {
    const nodes = new Map(), toasts = [], writes = [], elements = [], timers = [];
    const documentListeners = new Map(), windowListeners = new Map();
    const listen = (listeners, type, callback) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
    };
    const unlisten = (listeners, type, callback) => {
        listeners.set(type, (listeners.get(type) || []).filter(item => item !== callback));
    };
    const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    const state = { events: [schedule()], isEditor: true, user: { email: 'editor@example.test' }, ...options.state };
    let reloads = 0, renders = 0, hitTarget = null, mutation = options.mutation || (async () => ({ error: null }));
    const navigator = { platform: options.platform || 'MacIntel', userAgent: options.userAgent || 'fixture',
        ...(options.userAgentPlatform ? { userAgentData: { platform: options.userAgentPlatform } } : {}) };
    const db = { from(table) {
        assert.equal(table, 'schedules');
        return {
            insert(payload) { const write = { mode: 'insert', payload: json(payload) }; writes.push(write); return mutation(write); },
            update(payload) { return { eq(key, id) { assert.equal(key, 'id'); const write = { mode: 'update', id, payload: json(payload) }; writes.push(write); return { select() { return { single: () => mutation(write) }; } }; } }; },
        };
    } };
    const document = { body: element(), visibilityState: 'visible', hidden: false, getElementById: node,
        addEventListener: (type, callback) => listen(documentListeners, type, callback),
        removeEventListener: (type, callback) => unlisten(documentListeners, type, callback),
        createElement: () => element(), elementFromPoint: () => hitTarget,
        querySelectorAll(selector) {
            const alternatives = selector.split(',').map(part => part.match(/\.[\w-]+/g) || []);
            return elements.filter(el => alternatives.some(required =>
                required.length && required.every(name => el.classList.contains(name.slice(1)))));
        },
    };
    const window = { navigator, innerWidth: 1280, innerHeight: 900, addEventListener: (type, callback) => listen(windowListeners, type, callback),
        removeEventListener: (type, callback) => unlisten(windowListeners, type, callback) };
    const context = vm.createContext({ state, db, navigator, document, window,
        Date, Promise, Array, Object, String, Number, console: { error() {}, warn() {} },
        _scheduleEditorEpoch: 0, _savingEvent: false, _scheduleDeletePending: false,
        _ensureDb: options.ensureDb || (async () => {}),
        showToast: message => toasts.push(message),
        hideMemoTooltip() {},
        handleSupabaseMutationError: async (_, message) => toasts.push(message),
        loadEvents: async () => { reloads++; }, renderCalendar: () => { renders++; },
        setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
        setInterval: () => 1, clearInterval() {},
    });
    vm.runInContext(section('function isRestEvent(', 'function stickerForEvent(') +
        section('function pad(n)', 'function broadcastInfoForDate(') +
        section('// ─── 드래그앤드랍 순서 ───', '// ─── 데이터 로드 ───') +
        section('function calendarEventsForDate(', 'function renderMobileSchedule(') +
        section('function scheduleDateMillis(', 'function refreshScheduleCopyUi('), context);
    function start(modifiers = {}, id = 'source', currentTarget = element()) {
        const row = state.events.find(ev => ev.id === id);
        const event = dragEvent(modifiers, currentTarget);
        elements.push(event.currentTarget);
        context.dragStart(event, id, row?.date || '2026-12-31');
        return event;
    }
    async function dispatch(type, values = {}, target = element()) {
        const event = { ...dragEvent({ pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, buttons: 1,
            clientX: 220, clientY: 120, ...values }, target), type, target };
        const results = [...(documentListeners.get(type) || []), ...(windowListeners.get(type) || [])].map(callback => callback(event));
        await Promise.all(results);
        await new Promise(resolve => setImmediate(resolve));
        return event;
    }
    function pointerStart(modifiers = { metaKey: true }, id = 'source') {
        const row = state.events.find(ev => ev.id === id);
        const chip = element();
        chip.classList.add('event-chip');
        elements.push(chip);
        const event = { ...dragEvent({ pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, buttons: 1,
            clientX: 20, clientY: 20, ...modifiers }, chip), type: 'pointerdown', target: chip };
        context.startSchedulePointerCopy(event, id, row?.date || '2026-12-31');
        return event;
    }
    function hitDate(date) {
        hitTarget = date ? element() : null;
        if (hitTarget) { hitTarget.classList.add('cal-cell'); hitTarget.dataset.date = date; elements.push(hitTarget); }
        return hitTarget;
    }
    return { context, state, document, node, toasts, writes, start, pointerStart, hitDate, dispatch, elements,
        reloads: () => reloads, renders: () => renders, setMutation(fn) { mutation = fn; },
        advanceTimers() { timers.splice(0).forEach(fn => fn()); },
    };
}

test('ordinary dragging to another date continues to update the existing row', async () => {
    const h = harness();
    h.start();
    await h.context.cellDrop(dragEvent(), '2026-10-17');
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'update');
    assert.equal(h.writes[0].id, 'source');
    assert.equal(h.writes[0].payload.date, '2026-10-17');
    assert.equal(h.writes[0].payload.end_date, '2026-10-19');
    assert.equal(h.reloads(), 1);
});

test('ordinary dragging onto a same-day event preserves reordering without inserting a row', async () => {
    const h = harness({ state: { events: [schedule({ is_rest: false, end_date: null, sort_order: 0 }),
        schedule({ id: 'target', is_rest: false, end_date: null, sort_order: 1 })] } });
    h.start();
    await h.context.dragDrop(dragEvent(), 'target', '2026-12-31');
    assert.deepEqual(h.writes.map(write => [write.mode, write.id, write.payload]), [
        ['update', 'target', { sort_order: 0 }], ['update', 'source', { sort_order: 1 }],
    ]);
    assert.equal(h.renders(), 1);
});

for (const fixture of [
    { platform: 'MacIntel', modifier: { metaKey: true }, mode: 'insert', name: 'Mac Command' },
    { platform: 'MacIntel', modifier: { ctrlKey: true }, mode: 'update', name: 'Mac Control' },
    { platform: 'Win32', modifier: { ctrlKey: true }, mode: 'insert', name: 'Windows Control' },
    { platform: 'Win32', modifier: { metaKey: true }, mode: 'update', name: 'Windows Meta' },
]) test(`${fixture.name} selects the correct copy or move action`, async () => {
    const h = harness({ platform: fixture.platform });
    h.start(fixture.modifier);
    await h.context.cellDrop(dragEvent(fixture.modifier), '2026-10-17');
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, fixture.mode);
});

test('the browser platform hint selects Command even when the legacy platform value differs', async () => {
    const h = harness({ platform: 'Win32', userAgentPlatform: 'macOS' });
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes[0].mode, 'insert');
});

test('drag feedback switches between copy and move and cancellation removes all target styling', () => {
    const h = harness();
    const start = h.start();
    assert.equal(start.dataTransfer.effectAllowed, 'copyMove');
    const target = element();
    h.elements.push(target);
    const copy = dragEvent({ metaKey: true }, target);
    h.context.cellDragOver(copy, '2026-10-17');
    assert.equal(copy.dataTransfer.dropEffect, 'copy');
    assert.equal(copy.prevented, true);
    assert.equal(target.classList.contains('cell-drop-target'), true);
    assert.equal(target.classList.contains('copy-drop-target'), true);
    assert.match(h.node('scheduleDragHint').textContent, /원본 유지/);
    const move = dragEvent({}, target);
    h.context.cellDragOver(move, '2026-10-17');
    assert.equal(move.dataTransfer.dropEffect, 'move');
    assert.equal(target.classList.contains('copy-drop-target'), false);
    h.context.cellDragOver(copy, '2026-10-17');
    h.context.dragEnd(start);
    assert.equal(target.classList.contains('cell-drop-target'), false);
    assert.equal(target.classList.contains('copy-drop-target'), false);
    assert.equal(start.currentTarget.classList.contains('dragging'), false);
});

test('copy uses the modifier at drop time, so pressing or releasing it during a drag works', async () => {
    for (const [startModifier, dropModifier, mode] of [
        [{}, { metaKey: true }, 'insert'], [{ metaKey: true }, {}, 'update'],
    ]) {
        const h = harness();
        h.start(startModifier);
        await h.context.cellDrop(dragEvent(dropModifier), '2026-10-17');
        assert.equal(h.writes[0].mode, mode);
    }
});

for (const fixture of [
    { platform: 'MacIntel', modifier: { metaKey: true }, key: 'Meta', name: 'Mac Command' },
    { platform: 'Win32', modifier: { ctrlKey: true }, key: 'Control', name: 'Windows Control' },
]) test(`${fixture.name} pointer copy works without any native drag event and keeps its initial copy intent`, async () => {
    const h = harness({ platform: fixture.platform });
    const sourceBefore = json(h.state.events[0]);
    const start = h.pointerStart(fixture.modifier);
    assert.equal(start.currentTarget.draggable, false);
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    // Native dragging can suppress modifier flags. Releasing the key must not turn this copy into a move.
    await h.dispatch('keyup', { key: fixture.key });
    await h.dispatch('pointerup');
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
    assert.equal(h.writes[0].payload.date, '2026-10-17');
    assert.equal(h.writes[0].payload.end_date, '2026-10-19');
    assert.equal(h.writes[0].payload.youtube_links, sourceBefore.youtube_links);
    assert.deepEqual(json(h.state.events[0]), sourceBefore);
    assert.equal(start.currentTarget.draggable, true);
    assert.equal(start.currentTarget.hasPointerCapture(1), false);
});

test('a completed pointer copy cannot leave stale Command intent on the next ordinary drag', async () => {
    const h = harness();
    h.pointerStart();
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    await h.dispatch('pointerup');
    h.advanceTimers();
    const normal = h.pointerStart({});
    assert.equal(normal.currentTarget.draggable, true);
    h.start({}, 'source', normal.currentTarget);
    await h.context.cellDrop(dragEvent(), '2026-11-01');
    assert.deepEqual(h.writes.map(write => write.mode), ['insert', 'update']);
});

for (const reason of ['Escape', 'pointercancel', 'lostpointercapture', 'buttons-released', 'blur', 'hidden', 'outside', 'other-month', 'same-date', 'no-movement']) {
    test(`pointer copy ${reason} cancels without a write and restores ordinary dragging`, async () => {
        const h = harness();
        const start = h.pointerStart();
        const cell = h.hitDate(reason === 'same-date' ? '2026-12-31' : '2026-10-17');
        if (reason === 'other-month') cell.classList.add('other-month');
        if (reason !== 'no-movement') await h.dispatch('pointermove');
        if (reason === 'Escape') await h.dispatch('keydown', { key: 'Escape' });
        else if (reason === 'pointercancel' || reason === 'blur') await h.dispatch(reason);
        else if (reason === 'lostpointercapture') start.currentTarget.dispatchEvent({ type: 'lostpointercapture', pointerId: 1 });
        else if (reason === 'buttons-released') await h.dispatch('pointermove', { buttons: 0 });
        else if (reason === 'hidden') { h.document.visibilityState = 'hidden'; h.document.hidden = true; await h.dispatch('visibilitychange'); }
        else if (reason === 'outside') h.hitDate(null);
        await h.dispatch('pointerup', reason === 'no-movement' ? { clientX: 22, clientY: 22 } : {});
        assert.equal(h.writes.length, 0);
        assert.equal(start.currentTarget.draggable, true);
        assert.equal(start.currentTarget.hasPointerCapture(1), false);
        assert.equal(h.document.body.classList.contains('schedule-copying'), false);
    });
}

test('a native dragstart cannot take over an active pointer copy gesture', async () => {
    const h = harness();
    const pointer = h.pointerStart();
    const native = h.start({}, 'source', pointer.currentTarget);
    assert.equal(native.prevented, true);
    assert.equal(pointer.currentTarget.draggable, false);
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    await h.dispatch('pointerup');
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
});

test('a delayed mouse-up click after Escape is suppressed even after the drag timer expires', async () => {
    const h = harness();
    const pointer = h.pointerStart();
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    await h.dispatch('keydown', { key: 'Escape' });
    h.advanceTimers();
    assert.equal(vm.runInContext('_dragged', h.context), false);
    await h.dispatch('pointerup', {}, pointer.currentTarget);
    const releasedClick = await h.dispatch('click', { detail: 1 }, pointer.currentTarget);
    assert.equal(releasedClick.prevented, true);
    assert.equal(releasedClick.immediateStopped, true);
    assert.equal(h.writes.length, 0);
    const laterClick = await h.dispatch('click', { detail: 1 }, pointer.currentTarget);
    assert.equal(laterClick.prevented, false);
});

test('a new pointerdown clears the cancelled gesture click guard before an ordinary click', async () => {
    const h = harness();
    const pointer = h.pointerStart();
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    await h.dispatch('keydown', { key: 'Escape' });
    h.advanceTimers();
    await h.dispatch('pointerdown', {}, pointer.currentTarget);
    await h.dispatch('pointerup', {}, pointer.currentTarget);
    const click = await h.dispatch('click', { detail: 1 }, pointer.currentTarget);
    assert.equal(click.prevented, false);
    assert.equal(click.immediateStopped, undefined);
});

test('keyboard activation after cancelling a pointer copy is not swallowed by the click guard', async () => {
    const h = harness();
    const pointer = h.pointerStart();
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    await h.dispatch('keydown', { key: 'Escape' });
    h.advanceTimers();
    const click = await h.dispatch('click', { detail: 0 }, pointer.currentTarget);
    assert.equal(click.prevented, false);
    assert.equal(click.immediateStopped, undefined);
});

test('read-only and non-primary pointer gestures cannot start a copy', async () => {
    for (const options of [
        { state: { isEditor: false, user: null } }, { modifier: { metaKey: true, button: 2 } },
        { modifier: { metaKey: true, isPrimary: false } }, { modifier: { metaKey: true, pointerType: 'touch' } },
    ]) {
        const h = harness(options);
        const start = h.pointerStart(options.modifier);
        h.hitDate('2026-10-17');
        await h.dispatch('pointermove');
        await h.dispatch('pointerup');
        assert.equal(h.writes.length, 0);
        assert.equal(start.currentTarget.draggable, true);
    }
});

test('repeated pointer release and a new gesture cannot duplicate a pending copy', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.pointerStart();
    h.hitDate('2026-10-17');
    await h.dispatch('pointermove');
    const first = h.dispatch('pointerup');
    const duplicate = h.dispatch('pointerup');
    const secondStart = h.pointerStart();
    assert.equal(secondStart.currentTarget.draggable, true);
    ready.resolve();
    await Promise.all([first, duplicate]);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
});

test('copy leaves the source untouched and retains all editable details and registered links', async () => {
    const h = harness();
    const before = json(h.state.events[0]);
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
    const payload = h.writes[0].payload;
    for (const key of ['title', 'start_time', 'duration', 'type', 'is_rest', 'subtitle', 'collab', 'memo', 'vod_url', 'youtube_links']) {
        assert.equal(payload[key], before[key], key);
    }
    assert.equal(payload.date, '2026-10-17');
    assert.equal(payload.end_date, '2026-10-19');
    for (const key of ['id', 'created_by', 'created_at', 'updated_at']) assert.equal(Object.hasOwn(payload, key), false, key);
    assert.deepEqual(json(h.state.events[0]), before);
    assert.equal(h.reloads(), 1);
});

test('copy moves the period by calendar days over leap days, month and year boundaries', async () => {
    for (const [target, end] of [
        ['2024-02-28', '2024-03-01'], ['2025-02-28', '2025-03-02'],
        ['2026-10-31', '2026-11-02'], ['2027-12-31', '2028-01-02'],
    ]) {
        const h = harness();
        h.start({ metaKey: true });
        await h.context.cellDrop(dragEvent({ metaKey: true }), target);
        assert.equal(h.writes[0].payload.date, target);
        assert.equal(h.writes[0].payload.end_date, end);
    }
});

test('copy preserves a missing end date and shifts an explicit one-day period', async () => {
    for (const [originalEnd, expectedEnd] of [[null, null], ['2026-12-31', '2026-10-17']]) {
        const h = harness({ state: { events: [schedule({ end_date: originalEnd })] } });
        h.start({ metaKey: true });
        await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
        assert.equal(h.writes[0].payload.end_date, expectedEnd);
    }
});

test('copying onto an occupied date inserts once and does not mutate or reorder target rows', async () => {
    const h = harness({ state: { events: [schedule(), schedule({ id: 'target', date: '2026-10-17', end_date: null, sort_order: 12 })] } });
    const before = json(h.state.events);
    h.start({ metaKey: true });
    const event = dragEvent({ metaKey: true });
    await h.context.dragDrop(event, 'target', '2026-10-17');
    assert.equal(event.stopped, true);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
    assert.deepEqual(json(h.state.events), before);
});

test('same-date modifier drops onto a cell or another event are no-ops', async () => {
    for (const ontoCard of [false, true]) {
        const h = harness({ state: { events: [schedule(), schedule({ id: 'target', sort_order: 9 })] } });
        const before = json(h.state.events);
        h.start({ metaKey: true });
        if (ontoCard) await h.context.dragDrop(dragEvent({ metaKey: true }), 'target', '2026-12-31');
        else await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-12-31');
        assert.equal(h.writes.length, 0);
        assert.equal(h.reloads(), 0);
        assert.deepEqual(json(h.state.events), before);
    }
});

test('a card drop bubbling to its calendar cell cannot insert a second copy', async () => {
    const h = harness();
    h.start({ metaKey: true });
    const event = dragEvent({ metaKey: true });
    const cardDrop = h.context.dragDrop(event, 'target', '2026-10-17');
    const cellDrop = h.context.cellDrop(event, '2026-10-17');
    await Promise.all([cardDrop, cellDrop]);
    assert.equal(event.stopped, true);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].mode, 'insert');
});

test('a cancelled drag clears its source so a stale drop cannot create a copy', async () => {
    const h = harness();
    const event = h.start({ metaKey: true });
    h.context.dragEnd(event);
    h.advanceTimers();
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 0);
    assert.equal(event.currentTarget.classList.contains('dragging'), false);
});

test('copy is locked while initialization is pending, including a second attempted drag', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.start({ metaKey: true });
    const first = h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    h.start({ metaKey: true });
    const second = h.context.cellDrop(dragEvent({ metaKey: true }), '2026-11-01');
    ready.resolve();
    await Promise.all([first, second]);
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].payload.date, '2026-10-17');
});

test('editor permission loss while initialization is pending prevents a late insert', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.start({ metaKey: true });
    const pending = h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    h.state.isEditor = false;
    h.state.user = null;
    ready.resolve();
    await pending;
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
});

test('an account switch back to the original email still invalidates a pending copy', async () => {
    const ready = deferred();
    const h = harness({ ensureDb: () => ready.promise });
    h.start({ metaKey: true });
    const pending = h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    vm.runInContext('_scheduleEditorEpoch += 2', h.context);
    ready.resolve();
    await pending;
    assert.equal(h.writes.length, 0);
});

test('a drag started before an account switch cannot be dropped by the new editor', async () => {
    const h = harness();
    h.start({ metaKey: true });
    h.state.user = { email: 'another-editor@example.test' };
    vm.runInContext('_scheduleEditorEpoch++', h.context);
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 0);
    assert.equal(h.reloads(), 0);
});

test('guests cannot initiate a drag or write through either drop handler', async () => {
    const h = harness({ state: { isEditor: false, user: null } });
    const event = h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    await h.context.dragDrop(dragEvent({ metaKey: true }), 'target', '2026-10-17');
    assert.equal(h.writes.length, 0);
    assert.equal(event.currentTarget.classList.contains('dragging'), false);
});

for (const thrown of [false, true]) test(`a ${thrown ? 'thrown' : 'returned'} copy failure preserves the source and unlocks retry`, async () => {
    const h = harness({ mutation: async () => {
        if (thrown) throw Error('Network disconnected');
        return { error: { message: 'Temporary failure' } };
    } });
    const before = json(h.state.events[0]);
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.deepEqual(json(h.state.events[0]), before);
    assert.equal(h.reloads(), 0);
    assert.ok(h.toasts.length > 0);
    h.setMutation(async () => ({ error: null }));
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1].mode, 'insert');
    assert.equal(h.reloads(), 1);
});

test('a database initialization failure unlocks a later drag without making a write', async () => {
    let attempts = 0;
    const h = harness({ ensureDb: async () => { if (++attempts === 1) throw Error('Client unavailable'); } });
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 0);
    h.start({ metaKey: true });
    await h.context.cellDrop(dragEvent({ metaKey: true }), '2026-10-17');
    assert.equal(h.writes.length, 1);
    assert.equal(h.reloads(), 1);
});
