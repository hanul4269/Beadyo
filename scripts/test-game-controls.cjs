const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require.resolve('../games.html'), 'utf8');
const mainScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('const GAME_MODES'));
assert.ok(mainScript, 'The game controls script is present');
const controls = mainScript.slice(0, mainScript.lastIndexOf('\n        resetLadder();'));

function fixture({ balls = 0 } = {}) {
    let now = 0, nextTimer = 1;
    const pending = new Map(), callbacks = new Map(), nodes = new Map(), listeners = new Map();
    const count = { renders: 0, reveals: 0, starts: [] };
    const document = { activeElement: null, documentElement: { dataset: { theme: 'light' }, style: {} } };
    function element(id, tag = 'div') {
        if (nodes.has(id)) return nodes.get(id);
        const classes = new Set();
        const node = {
            id, tagName: tag.toUpperCase(), style: { setProperty() {} }, children: [], parentElement: null,
            textContent: '', innerHTML: '', hidden: false, disabled: false, inert: false,
            isConnected: true, tabIndex: ['button', 'textarea', 'input'].includes(tag) ? 0 : -1,
            classList: { add: (...values) => values.forEach(value => classes.add(value)),
                remove: (...values) => values.forEach(value => classes.delete(value)),
                contains: value => classes.has(value), toggle() {} },
            focus() { document.activeElement = this; }, blur() { document.activeElement = document.body; },
            addEventListener() {}, setAttribute() {}, get offsetWidth() { return 1; },
            contains(child) { for (let current = child; current; current = current.parentElement) if (current === this) return true; return false; },
            getClientRects() { for (let current = this; current; current = current.parentElement) if (current.hidden) return []; return [{}]; },
            closest() { return this.editable || ['BUTTON', 'TEXTAREA', 'INPUT', 'A'].includes(this.tagName) || this.roleButton ? this : null; },
            querySelector(selector) {
                if (selector === '[role="dialog"]') return this.dialog || null;
                if (selector === '#name-input') return nodes.get('name-input');
                if (selector === 'button') return this.focusables?.find(item => item.tagName === 'BUTTON') || null;
                return null;
            },
            querySelectorAll(selector) {
                if (id === 'gacha-bowl' && selector === '.gacha-ball') return this.balls || [];
                return this.focusables || [];
            },
        };
        nodes.set(id, node); return node;
    }
    function append(parent, child) { parent.children.push(child); child.parentElement = parent; }
    document.body = element('body', 'body'); document.body.style.overflow = 'auto';
    const page = element('page'), toolbar = element('toolbar'); append(document.body, page); append(page, toolbar);
    const gachaPanel = element('gacha-panel'); append(page, gachaPanel);
    append(gachaPanel, element('gacha-machine')); append(gachaPanel, element('gacha-info'));
    const opener = element('opener', 'button'); append(toolbar, opener); document.activeElement = opener;
    for (const id of ['settings-modal', 'results-modal', 'gacha-prize-modal']) {
        const overlay = element(id); overlay.hidden = id === 'gacha-prize-modal';
        append(id === 'gacha-prize-modal' ? gachaPanel : document.body, overlay);
        const dialog = element(`${id}-dialog`); dialog.tabIndex = -1; overlay.dialog = dialog; append(overlay, dialog);
        const first = element(`${id}-first`, 'button'), last = element(`${id}-last`, 'button');
        append(dialog, first); append(dialog, last); overlay.focusables = [first, last];
    }
    const nameInput = element('name-input', 'textarea'); append(nodes.get('settings-modal').dialog, nameInput);
    nodes.get('settings-modal').focusables.splice(1, 0, nameInput);
    const bowl = element('gacha-bowl'); bowl.balls = Array.from({ length: balls }, (_, i) => element(`ball-${i}`));
    document.getElementById = id => element(id, ['spin-btn', 'gacha-btn'].includes(id) ? 'button' : 'div');
    document.querySelector = selector => {
        if (selector === '#ladder-panel.active') return page;
        if (selector === '.modal-backdrop.open') return ['settings-modal', 'results-modal'].map(id => nodes.get(id)).find(node => node.classList.contains('open')) || null;
        if (selector === '#nikke-panel iframe') return null;
        return element(selector);
    };
    document.querySelectorAll = selector => selector === '.modal-backdrop.open'
        ? ['settings-modal', 'results-modal'].map(id => nodes.get(id)).filter(node => node.classList.contains('open')) : [];
    document.addEventListener = (type, listener) => listeners.set(type, listener);
    function schedule(callback, delay, raf = false) {
        const id = nextTimer++; pending.set(id, { callback, at: now + delay, raf }); callbacks.set(id, callback); return id;
    }
    const context = vm.createContext({ document, console, URLSearchParams, location: { origin: 'http://localhost:3000', search: '' },
        localStorage: { getItem() {}, setItem() {} }, window: { addEventListener() {}, location: { origin: 'http://localhost:3000' } },
        setTimeout: (callback, delay) => schedule(callback, delay), clearTimeout: id => pending.delete(id),
        requestAnimationFrame: callback => schedule(callback, 16, true), cancelAnimationFrame: id => pending.delete(id),
    });
    vm.runInContext(controls, context);
    // Rendering/physics are outside these tests; all cancellation, event and modal functions run unmodified.
    context.count = count;
    vm.runInContext(`
        renderGacha = () => { count.renders++; };
        drawRoulette = () => {};
        drawLadder = () => {};
        makeGachaPhysicsState = ball => ({ ball });
        stepGachaCapsule = () => {};
        revealLadder = () => { count.reveals++; };
        runLadder = index => { count.starts.push(index); };
        globalThis.api = { roulette, gacha, ladder, spinRoulette, resetRoulette, pullGachaLever, resetGacha,
            openSettings, applySettings, handleSlotKeydown, handleLadderStartKeydown, handleGameKeydown,
            focusGameModal, releaseGameModal, closeGachaPrize, closeModal,
            activeModal: () => activeGameModal };
    `, context);
    async function flush() { await Promise.resolve(); await Promise.resolve(); }
    async function advance(milliseconds) {
        const end = now + milliseconds;
        await flush();
        for (;;) {
            const task = [...pending.entries()].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!task) break;
            const [id, item] = task; pending.delete(id); now = item.at; item.callback(item.raf ? now : undefined); await flush();
        }
        now = end; await flush();
    }
    function key(value, target = document.body, extra = {}) {
        const event = { key: value, target, currentTarget: target, defaultPrevented: false, stopped: false,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
        return event;
    }
    return { api: context.api, nodes, element, document, count, callbacks, pending, advance, flush, key };
}

test('roulette reset cancels a pending winner and immediately permits a fresh run', async () => {
    const h = fixture(); h.api.spinRoulette(); const old = h.api.roulette.resultTimer;
    h.api.resetRoulette(); assert.equal(h.nodes.get('winner-name').textContent, '대기 중');
    assert.equal(h.api.roulette.spinning, false); assert.equal(h.nodes.get('spin-btn').disabled, false);
    h.callbacks.get(old)(); // A callback already queued by the browser must also be harmless.
    await h.advance(5000); assert.equal(h.api.roulette.history.length, 0);
    h.api.spinRoulette(); await h.advance(4100); assert.equal(h.api.roulette.history.length, 1);
});

test('roulette setting changes cannot publish a winner from the old candidates', async () => {
    const h = fixture(); h.api.spinRoulette(); const old = h.api.roulette.resultTimer;
    h.api.openSettings('roulette'); h.nodes.get('name-input').value = '새 후보 A\n새 후보 B'; h.api.applySettings();
    h.callbacks.get(old)(); await h.advance(5000); assert.equal(h.api.roulette.history.length, 0);
    h.api.spinRoulette(); await h.advance(4100); assert.ok(h.api.roulette.names.includes(h.nodes.get('winner-name').textContent));
    assert.match(h.nodes.get('winner-name').textContent, /^새 후보 /);
});

test('gacha reset during animation cancels RAF work and resolves the pending draw', async () => {
    const h = fixture({ balls: 2 }); const draw = h.api.pullGachaLever();
    await h.advance(64); assert.ok(h.api.gacha.animationFrame);
    h.api.resetGacha(); await draw; await h.advance(6000);
    assert.equal(h.api.gacha.drawing, false); assert.equal(h.api.gacha.animationFrame, 0);
    assert.equal(h.nodes.get('gacha-prize-modal').hidden, true); assert.equal(h.api.gacha.history.length, 0);
    assert.equal(h.nodes.get('gacha-btn').disabled, false);
});

test('a late canceled animation callback cannot erase the new draw animation handle', async () => {
    const h = fixture({ balls: 2 }); const oldDraw = h.api.pullGachaLever();
    await h.advance(16); const oldFrame = h.api.gacha.animationFrame;
    h.api.resetGacha(); await oldDraw;
    const newDraw = h.api.pullGachaLever(), newFrame = h.api.gacha.animationFrame;
    h.callbacks.get(oldFrame)(32);
    assert.equal(h.api.gacha.animationFrame, newFrame);
    h.api.resetGacha(); await newDraw; assert.equal(h.pending.has(newFrame), false);
});

test('gacha reset during its pause resolves cancellation without publishing a result', async () => {
    const h = fixture(); const draw = h.api.pullGachaLever(); await h.flush();
    assert.ok(h.api.gacha.pauseTimer); h.api.resetGacha(); await draw; await h.advance(3000);
    assert.equal(h.api.gacha.history.length, 0); assert.equal(h.nodes.get('gacha-prize-modal').hidden, true);
});

test('gacha reset after dispensing cancels a queued result and protects a new run', async () => {
    const h = fixture(); h.api.pullGachaLever(); await h.advance(180);
    const old = h.api.gacha.resultTimer; assert.ok(old);
    h.api.resetGacha(); h.api.pullGachaLever(); await h.advance(180);
    h.callbacks.get(old)(); assert.equal(h.api.gacha.history.length, 0);
    await h.advance(1900); assert.equal(h.api.gacha.history.length, 1); assert.equal(h.nodes.get('gacha-prize-modal').hidden, false);
});

test('gacha setting changes cancel both animation and old-candidate results', async () => {
    const h = fixture(); h.api.pullGachaLever(); await h.advance(180); const old = h.api.gacha.resultTimer;
    h.api.openSettings('gacha'); h.nodes.get('name-input').value = '새 A\n새 B'; h.api.applySettings();
    h.callbacks.get(old)(); await h.advance(6000); assert.equal(h.api.gacha.history.length, 0);
    h.api.pullGachaLever(); await h.advance(2200); assert.match(h.nodes.get('gacha-winner').textContent, /^새 /);
});

test('participant Enter ends editing without bubbling to ladder reveal', () => {
    const h = fixture(), card = h.element('editable'); card.editable = true;
    const event = h.key('Enter', card); h.api.handleSlotKeydown(event); h.api.handleGameKeydown(event);
    assert.equal(event.defaultPrevented, true); assert.equal(event.stopped, true); assert.equal(h.count.reveals, 0);
    h.api.handleGameKeydown(h.key('Enter', card)); assert.equal(h.count.reveals, 0);
    h.api.handleGameKeydown(h.key('Enter')); assert.equal(h.count.reveals, 1);
});

test('individual ladder start responds once to Enter and Space, without reveal propagation', () => {
    const h = fixture(), avatar = h.element('avatar'); avatar.roleButton = true;
    for (const value of ['Enter', ' ']) {
        const event = h.key(value, avatar); h.api.handleLadderStartKeydown(event, 2); h.api.handleGameKeydown(event);
        assert.equal(event.stopped, true);
    }
    h.api.handleLadderStartKeydown(h.key('Enter', avatar, { repeat: true }), 2);
    assert.deepEqual(h.count.starts, [2, 2]); assert.equal(h.count.reveals, 0);
    assert.match(html, /class="avatar ladder-start"[^>]*role="button"[^>]*tabindex="0"[^>]*aria-label=/);
});

test('game setting modal focuses its input, traps Tab, makes background inert and restores focus', async () => {
    const h = fixture(), modal = h.nodes.get('settings-modal'), opener = h.document.activeElement;
    h.api.openSettings('roulette'); await h.advance(16);
    assert.equal(h.document.activeElement, h.nodes.get('name-input')); assert.equal(h.nodes.get('page').inert, true);
    modal.focusables.at(-1).focus(); const tab = h.key('Tab', h.document.activeElement); h.api.handleGameKeydown(tab);
    assert.equal(tab.defaultPrevented, true); assert.equal(h.document.activeElement, modal.focusables[0]);
    const back = h.key('Tab', h.document.activeElement, { shiftKey: true }); h.api.handleGameKeydown(back);
    assert.equal(h.document.activeElement, modal.focusables.at(-1));
    h.api.handleGameKeydown(h.key('Escape', h.document.activeElement));
    assert.equal(modal.classList.contains('open'), false); assert.equal(h.nodes.get('page').inert, false);
    assert.equal(h.document.activeElement, opener); assert.equal(h.document.body.style.overflow, 'auto');
});

test('nested gacha result remains interactive and Escape closes it while restoring its opener', async () => {
    const h = fixture(), opener = h.document.activeElement;
    h.api.pullGachaLever(); await h.advance(2100);
    const modal = h.nodes.get('gacha-prize-modal'); assert.equal(modal.hidden, false);
    assert.equal(modal.inert, false); assert.equal(h.nodes.get('gacha-machine').inert, true);
    assert.equal(h.document.activeElement, modal.focusables[0]);
    h.api.handleGameKeydown(h.key('Escape', h.document.activeElement));
    assert.equal(modal.hidden, true); assert.equal(h.nodes.get('gacha-machine').inert, false);
    assert.equal(h.document.activeElement, opener);
});
