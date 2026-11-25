// Contrast of white-on-green fills, keyboard focus for the day/song detail popups,
// and the phone-width songbook rows. Run: node --test scripts/test-a11y-contrast-dialogs.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = file => fs.readFileSync(require.resolve('../' + file), 'utf8');

function luminance(hex) {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
function tokenBlock(css, selector) {
    const start = css.indexOf(selector + ' {');
    assert.ok(start >= 0, `missing ${selector}`);
    return css.slice(start, css.indexOf('}', start));
}
function cssRules(source) {
    return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
}

test('the solid green behind white text reaches 4.5:1 on the calendar and songbook pages', () => {
    const tokens = read('tokens.css');
    for (const page of ['calendar', 'songbook']) {
        const value = tokenBlock(tokens, `html[data-page="${page}"]`).match(/--accent-solid:\s*(#[0-9a-f]{6})/i)?.[1];
        assert.ok(value, `${page} defines --accent-solid`);
        assert.ok(contrast(value, '#ffffff') >= 4.5, `${page} ${value} = ${contrast(value, '#ffffff').toFixed(2)}`);
    }
    // The light accent itself stays as the decorative brand green (2.10:1 with white).
    assert.ok(contrast('#8bc34a', '#ffffff') < 3);
});

test('no light-theme rule paints white text on the light accent green any more', () => {
    for (const file of ['calendar.html', 'songbook.html']) {
        const offenders = cssRules(read(file)).filter(({ selector, body }) => {
            if (selector.includes('data-theme="dark"')) return false;
            const background = body.match(/background(?:-color)?\s*:\s*([^;]+);/)?.[1] || '';
            const color = body.match(/(?<![-\w])color\s*:\s*([^;]+);/)?.[1] || '';
            return /var\(--accent\)|#8bc34a|#7fb83f/i.test(background) && /#fff\b|#ffffff|white/i.test(color);
        }).map(rule => rule.selector.split('\n').pop());
        assert.deepEqual(offenders, [], file);
    }
});

test('calendar today markers and hover fills keep white text at 4.5:1 or more', () => {
    const calendar = read('calendar.html');
    assert.match(calendar, /\.cal-cell\.today \.date-num \{\s*background: var\(--accent-solid, #4f7f25\);\s*color: #fff;/);
    assert.match(calendar, /\.today-badge \{\s*background: var\(--accent-solid, #4f7f25\);/);
    assert.match(calendar, /\.cal-cell\.today \.date-num\.date-button:hover \{ color: #fff; \}/);
    const mobileBadge = calendar.match(/\.mobile-today-badge \{[^}]*background: (#[0-9a-f]{6});/i)[1];
    assert.ok(contrast(mobileBadge, '#ffffff') >= 4.5, `mobile TODAY ${mobileBadge}`);
    const memoHover = calendar.match(/\.memo-add-form button:hover \{ background: (#[0-9a-f]{6}); \}/i)[1];
    assert.ok(contrast(memoHover, '#ffffff') >= 4.5, `memo hover ${memoHover}`);
    assert.doesNotMatch(calendar, /\.up-goto-btn:hover \{ opacity/);
});

function harness() {
    const events = {}, ids = {};
    const document = {
        activeElement: null,
        addEventListener(name, callback) { (events[name] ||= []).push(callback); },
        getElementById: id => ids[id] || null,
        createElement: tag => new Element(tag),
    };
    class Element {
        constructor(tag) {
            this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
            this.attrs = {}; this.style = {}; this.hidden = false; this.inert = false; this.dataset = {};
            this.disabled = false; this.tabIndex = ['BUTTON', 'A', 'INPUT'].includes(this.tagName) ? 0 : -1;
            this.events = {}; this.overlay = false;
            const names = new Set();
            this.classList = { add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name) };
        }
        get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
        get firstChild() { return this.children[0] || null; }
        setAttribute(name, value) { this.attrs[name] = value; }
        hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
        addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
        appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
        insertBefore(child, next) { child.parentElement = this; this.children.splice(next ? this.children.indexOf(next) : this.children.length, 0, child); }
        remove() { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
        contains(child) { return child === this || this.children.some(node => node.contains(child)); }
        descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
        querySelector(selector) { return this.descendants().find(node => selector === '[role="dialog"]' && node.attrs.role === 'dialog') || null; }
        querySelectorAll() { return this.descendants().filter(node => node.tabIndex >= 0); }
        getClientRects() {
            for (let node = this; node; node = node.parentElement) {
                if (node.hidden || (node.overlay && !node.classList.contains('open'))) return [];
            }
            return [{}];
        }
        focus() {
            if (this.inert || !this.getClientRects().length) return;
            document.activeElement = this;
            (this.events.focus || []).forEach(callback => callback({ target: this }));
            (events.focusin || []).forEach(callback => callback({ target: this }));
        }
    }
    document.body = new Element('body');
    const main = document.body.appendChild(new Element('main'));
    const trigger = main.appendChild(new Element('button'));
    const overlay = id => {
        const modal = document.body.appendChild(new Element('div')); modal.overlay = true; ids[id] = modal;
        const dialog = modal.appendChild(new Element('div')); dialog.setAttribute('role', 'dialog');
        return { modal, dialog };
    };
    const window = {};
    vm.runInNewContext(read('modal-focus.js'), { window, document, Object });
    const press = key => {
        let prevented = false;
        (events.keydown || []).forEach(callback => callback({ key, shiftKey: false, preventDefault() { prevented = true; } }));
        return prevented;
    };
    trigger.focus();
    return { document, window, main, trigger, overlay, press, Element };
}
function between(source, start, end) {
    const from = source.indexOf(start);
    assert.ok(from >= 0, `missing ${start}`);
    const to = source.indexOf(end, from);
    assert.ok(to > from, `missing ${end}`);
    return source.slice(from, to);
}

test('calendar detail popup takes focus, closes on Escape and returns focus to the day that opened it', () => {
    const h = harness();
    const view = h.overlay('viewModal');
    const close = view.dialog.appendChild(new h.Element('button'));
    view.dialog.appendChild(new h.Element('button'));
    const api = new Function('document', 'window', between(read('app.js'), 'function showViewModal()', '\nconst UP_LOCAL_RANKING_CACHE_KEY')
        + '; return { showViewModal, closeViewModal };')(h.document, h.window);
    api.showViewModal();
    assert.equal(h.document.activeElement, close);
    assert.equal(h.main.inert, true);
    assert.equal(h.press('Escape'), true);
    assert.equal(view.modal.classList.contains('open'), false);
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.main.inert, false);
});

test('broadcast editor opened from the day popup stacks on top and hands focus back to the popup', () => {
    const h = harness();
    const view = h.overlay('viewModal');
    view.dialog.appendChild(new h.Element('button'));
    const editButton = view.dialog.appendChild(new h.Element('button'));
    const broadcast = h.overlay('broadcastModal');
    const firstField = broadcast.dialog.appendChild(new h.Element('input'));
    const focus = h.window.BeadyoModalFocus;
    const closeView = () => { view.modal.classList.remove('open'); focus.release(view.modal); };
    const closeBroadcast = () => { broadcast.modal.classList.remove('open'); focus.release(broadcast.modal); };
    view.modal.classList.add('open'); focus.activate(view.modal, closeView);
    editButton.focus();
    broadcast.modal.classList.add('open'); focus.activate(broadcast.modal, closeBroadcast, { nested: true });
    assert.equal(h.document.activeElement, firstField);
    assert.equal(view.modal.inert, true, 'popup underneath is inert while the editor is open');
    assert.equal(broadcast.modal.inert, false);
    assert.equal(h.press('Escape'), true);
    assert.equal(h.document.activeElement, editButton, 'focus returns to the button inside the popup');
    assert.equal(view.modal.inert, false);
    assert.equal(broadcast.modal.inert, true, 'the closed editor is background for the popup again');
    assert.equal(h.press('Escape'), true);
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.main.inert, false);
    assert.equal(broadcast.modal.inert, false);
});

test('a parked popup that was hidden without release is skipped instead of trapping an invisible dialog', () => {
    const h = harness();
    const view = h.overlay('viewModal');
    view.dialog.appendChild(new h.Element('button'));
    const broadcast = h.overlay('broadcastModal');
    broadcast.dialog.appendChild(new h.Element('input'));
    const focus = h.window.BeadyoModalFocus;
    view.modal.classList.add('open'); focus.activate(view.modal, () => {});
    broadcast.modal.classList.add('open'); focus.activate(broadcast.modal, () => {}, { nested: true });
    view.modal.classList.remove('open');
    broadcast.modal.classList.remove('open'); focus.release(broadcast.modal);
    assert.equal(h.main.inert, false);
    assert.equal(h.press('Escape'), false, 'nothing is trapped any more');
});

test('song detail popup takes focus, closes on Escape and restores the row that opened it', () => {
    const h = harness();
    const detail = h.overlay('song-detail-modal');
    const panel = detail.dialog; // #song-detail-panel carries role="dialog" in songbook.html
    const getById = h.document.getElementById;
    h.document.getElementById = id => (id === 'song-detail-panel' ? panel : getById(id));
    let closeButton;
    Object.defineProperty(panel, 'innerHTML', { set() { panel.children.length = 0; closeButton = panel.appendChild(new h.Element('button')); } });
    const source = read('songbook.html');
    const api = new Function('document', 'window', 'findSongbookSongById', 'songDetailPanelHtml', 'updateSongDetailLastDate', 'ensureLiveAllForSongDetail',
        between(source, 'function openSongDetailPanel(id)', '\nfunction openSongDetail(id)') + '; return { open: openSongDetailPanel };'
    )(h.document, h.window, id => ({ id }), () => '', () => {}, () => {});
    api.open(7);
    assert.equal(h.document.activeElement, closeButton);
    assert.equal(h.press('Escape'), true);
    assert.equal(detail.modal.classList.contains('open'), false);
    assert.equal(h.document.activeElement, h.trigger);
    assert.match(source, /<script defer src="modal-focus\.js\?v=[^"]+"><\/script>/);
    assert.match(source, /id="song-detail-panel" role="dialog" aria-modal="true" aria-labelledby="song-detail-title"/);
    assert.match(source, /<h2 class="song-detail-title" id="song-detail-title">/);
});

test('calendar detail popup and broadcast editor are labelled dialogs and modal-focus is loaded', () => {
    const calendar = read('calendar.html');
    assert.match(calendar, /id="viewModal"[^>]*>\s*<div class="modal" role="dialog" aria-modal="true" aria-labelledby="viewModalTitle">/);
    assert.match(calendar, /id="broadcastModal"[^>]*>\s*<div class="modal" role="dialog" aria-modal="true" aria-labelledby="broadcastModalTitle">/);
    assert.match(calendar, /<script defer src="modal-focus\.js\?v=[^"]+"><\/script>/);
    const app = read('app.js');
    assert.equal((app.match(/class="modal-title" id="viewModalTitle"/g) || []).length, 2);
    assert.match(between(app, 'function openBroadcastModal(', 'async function saveBroadcastInfo'), /activate\(modal, closeBroadcastModal, \{ nested: true \}\)/);
});

test('songbook tables become stacked rows at phone width instead of an 820px scroller', () => {
    const source = read('songbook.html');
    const block = between(source, '@media (max-width: 640px) {\n            #live-list .song-table,', '\n        }\n    </style>');
    assert.match(block, /#live-list \.song-table,[\s\S]*?min-width: 0;/);
    assert.match(block, /#live-list \.song-table tbody tr \{\s*grid-template-columns:/);
    assert.match(block, /#songbook-list \.song-table tbody tr,\s*#wc-search-results \.song-table tbody tr \{\s*grid-template-columns:/);
    assert.match(block, /thead \{\s*position: absolute;/, 'headers stay available to screen readers');
});

test('when a refresh replaces the opener, focus goes to its rebuilt successor', () => {
    const h = harness();
    const view = h.overlay('viewModal');
    view.dialog.appendChild(new h.Element('button'));
    const replacement = h.main.appendChild(new h.Element('button'));
    const focus = h.window.BeadyoModalFocus;
    view.modal.classList.add('open');
    focus.activate(view.modal, () => { view.modal.classList.remove('open'); focus.release(view.modal); }, { restore: () => replacement });
    h.trigger.remove(); // renderCalendar() rebuilt the cell while the popup was open
    assert.equal(h.press('Escape'), true);
    assert.equal(h.document.activeElement, replacement);
});

test('song rows and cards are keyboard focusable and open their detail with Enter or Space', () => {
    const source = read('songbook.html');
    assert.match(between(source, 'function editableSongAttrs(song)', '\n}'), /tabindex="0"/);
    assert.match(between(source, 'function songbookCardGridHtml(', '\nfunction songbookTagCounts'), /onclick="\$\{songClickHandler\(s\)\}" tabindex="0">/);
    const handler = between(source, "// Song rows and cards open their detail with Enter or Space", '\n});');
    let added;
    new Function('document', handler + '\n});')({ addEventListener: (name, callback) => { added = callback; } });
    let clicks = 0, prevented = 0;
    const row = { matches: selector => selector === '[data-songbook-entry-id][tabindex][onclick]', click: () => clicks++ };
    const button = { matches: () => false, click: () => clicks++ };
    added({ key: 'Enter', target: row, preventDefault: () => prevented++ });
    added({ key: ' ', target: row, preventDefault: () => prevented++ });
    added({ key: 'Enter', target: button, preventDefault: () => prevented++ });
    added({ key: 'a', target: row, preventDefault: () => prevented++ });
    assert.equal(clicks, 2);
    assert.equal(prevented, 2);
});

test('pages keep a fallback fill when an older cached tokens.css lacks --accent-solid', () => {
    for (const file of ['calendar.html', 'songbook.html']) {
        const source = read(file);
        assert.doesNotMatch(source, /var\(--accent-solid\)/, file);
        assert.match(source, /var\(--accent-solid, #4f7f25\)/, file);
    }
});
