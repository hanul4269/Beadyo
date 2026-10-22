const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
    const events = {}, ids = {};
    const document = {
        activeElement: null,
        addEventListener(name, callback) { (events[name] ||= []).push(callback); },
        getElementById: id => ids[id],
        createElement: tag => new Element(tag),
    };
    class Element {
        constructor(tag) {
            this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
            this.attrs = {}; this.style = {}; this.hidden = false; this.inert = false;
            this.disabled = false; this.tabIndex = ['BUTTON', 'A', 'IFRAME'].includes(this.tagName) ? 0 : -1;
            this.events = {};
            const names = new Set();
            this.classList = { add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name) };
        }
        get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
        get firstChild() { return this.children[0] || null; }
        setAttribute(name, value) { this.attrs[name] = value; }
        getAttribute(name) { return this.attrs[name]; }
        hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
        removeAttribute(name) { delete this.attrs[name]; }
        addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
        appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
        insertBefore(child, next) { child.parentElement = this; this.children.splice(next ? this.children.indexOf(next) : this.children.length, 0, child); }
        remove() { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
        contains(child) { return child === this || this.children.some(node => node.contains(child)); }
        descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
        querySelector(selector) { return this.descendants().find(node => selector === '[role="dialog"]' && node.attrs.role === 'dialog') || null; }
        querySelectorAll() { return this.descendants().filter(node => node.tabIndex >= 0); }
        getClientRects() { return this.hidden ? [] : [{}]; }
        focus() {
            document.activeElement = this;
            (this.events.focus || []).forEach(callback => callback({ target: this }));
            (events.focusin || []).forEach(callback => callback({ target: this }));
        }
    }
    document.body = new Element('body');
    const background = document.body.appendChild(new Element('main'));
    const trigger = background.appendChild(new Element('button'));
    const preexistingInert = document.body.appendChild(new Element('aside')); preexistingInert.inert = true;
    const modal = document.body.appendChild(new Element('div')); modal.hidden = true;
    const dialog = modal.appendChild(new Element('section')); dialog.setAttribute('role', 'dialog');
    const first = dialog.appendChild(new Element('button'));
    const iframe = dialog.appendChild(new Element('iframe'));
    const last = dialog.appendChild(new Element('a'));
    ids.videoModal = modal; ids.videoModalFrame = iframe; ids.videoModalOriginal = last;
    ids.videoModalTitle = new Element('div'); ids.videoTitle = new Element('div'); ids.videoFrameWrap = new Element('div');
    document.activeElement = trigger;
    const window = {};
    vm.runInNewContext(fs.readFileSync(require.resolve('../modal-focus.js'), 'utf8'), { window, document, Object });
    const press = (key, shiftKey = false) => {
        let prevented = false;
        (events.keydown || []).forEach(callback => callback({ key, shiftKey, preventDefault() { prevented = true; } }));
        return prevented;
    };
    return { document, window, modal, dialog, trigger, background, preexistingInert, first, iframe, last, press };
}

test('video overlays move focus inside, wrap both directions and restore the trigger and inert state', () => {
    const h = harness(); let closes = 0;
    const close = () => { closes++; h.modal.hidden = true; h.window.BeadyoModalFocus.release(h.modal); };
    h.modal.hidden = false;
    h.window.BeadyoModalFocus.activate(h.modal, close);
    assert.equal(h.document.activeElement, h.first);
    assert.equal(h.background.inert, true);
    assert.equal(h.preexistingInert.inert, true);
    assert.equal(h.press('Tab', true), true); assert.equal(h.document.activeElement, h.last);
    assert.equal(h.press('Tab'), true); assert.equal(h.document.activeElement, h.first);
    h.document.activeElement = h.dialog;
    assert.equal(h.press('Tab', true), true); assert.equal(h.document.activeElement, h.last);
    h.trigger.focus(); assert.equal(h.document.activeElement, h.first);
    assert.equal(h.press('Escape'), true); assert.equal(closes, 1);
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.background.inert, false); assert.equal(h.preexistingInert.inert, true);
    assert.equal(h.press('Escape'), false); assert.equal(closes, 1);
});

test('focus guards catch either direction when focus leaves an external video frame', () => {
    const h = harness();
    h.window.BeadyoModalFocus.activate(h.modal, () => {});
    const guards = h.dialog.children.filter(element => element.hasAttribute('data-modal-focus-guard'));
    assert.equal(guards.length, 2);
    guards[1].focus(); assert.equal(h.document.activeElement, h.first);
    guards[0].focus(); assert.equal(h.document.activeElement, h.last);
    h.window.BeadyoModalFocus.release(h.modal);
    assert.equal(h.dialog.children.filter(element => element.hasAttribute('data-modal-focus-guard')).length, 0);
});

for (const file of ['gembox.html', 'tractor-service.html', 'dance-archive.html']) {
    test(`${file} connects its existing open, close and Escape behavior to modal focus`, () => {
        const h = harness();
        const source = fs.readFileSync(require.resolve('../' + file), 'utf8');
        const start = source.indexOf('        function openVideoModal(');
        const end = source.indexOf(file === 'dance-archive.html' ? '        function filteredVideos()' : '        function handleVideoBackdrop(event)', start);
        const api = new Function('document', 'window', 'esc', 'gemboxSafeUrl', 'resetVideoFrame', 'getVideoEmbedUrl', 'safeUrl',
            source.slice(start, end) + '; return {open:openVideoModal, close:closeVideoModal};'
        )(h.document, h.window, value => value, value => value, () => {}, value => value.url, value => value);
        if (file === 'dance-archive.html') api.open({ title: 'Fixture', url: 'https://www.youtube.com/watch?v=Jj4aR7ZxKZM' });
        else if (file === 'tractor-service.html') api.open('Jj4aR7ZxKZM', 'Fixture');
        else api.open('https://www.youtube.com/embed/Jj4aR7ZxKZM', 'Fixture');
        assert.equal(h.document.activeElement, h.first);
        assert.equal(h.press('Escape'), true);
        assert.equal(h.document.activeElement, h.trigger);
        api.close(); // A second close must not steal focus or reset an unrelated overlay.
        assert.equal(h.document.activeElement, h.trigger);
        assert.match(source, /src="modal-focus\.js\?v=[^"]+"/);
    });
}

test('dance review cards render native playback and detail buttons and name the search field', () => {
    const source = fs.readFileSync(require.resolve('../dance-archive.html'), 'utf8');
    const start = source.indexOf('        function renderGrid()');
    const end = source.indexOf('        function updateSelectionUi(', start);
    const grid = { innerHTML: '', querySelectorAll: () => [] };
    const videos = [{ id: 'fixture', source: 'youtube', title: 'Fixture dance', thumbnail: '', status: 'review', date: '2026-10-11', song: 'Fixture song', tags: [] }];
    new Function('filteredVideos', 'selectedIds', 'videos', 'selectedId', 'resultMeta', 'emptyState', 'grid', 'esc', 'sourceColors', 'sourceLabels', 'statusLabels', 'updateSelectionUi', 'renderDetail',
        source.slice(start, end) + '; renderGrid();'
    )(() => videos, new Set(), videos, '', {}, { style: {} }, grid, value => value, { youtube: 'green' }, { youtube: 'YouTube' }, { review: '검토' }, () => {}, () => {});
    assert.match(grid.innerHTML, /<button class="play-mark" type="button" aria-label="Fixture dance 영상 재생"/);
    assert.match(grid.innerHTML, /<button class="card-body" type="button" aria-label="Fixture dance 검토 상세 보기"/);
    assert.match(source, /id="searchInput"[^>]*aria-label="춤영상 제목, 곡명, 태그 검색"/);
});

test('selecting a dance review checkbox preserves keyboard focus when its grid is rebuilt', () => {
    const source = fs.readFileSync(require.resolve('../dance-archive.html'), 'utf8');
    const start = source.indexOf('        function renderGrid()');
    const end = source.indexOf('        function updateSelectionUi(', start);
    const videos = [{ id: 'fixture', source: 'youtube', title: 'Fixture', thumbnail: '', status: 'review', date: '2026-10-11', song: '', tags: [] }];
    const selectedIds = new Set();
    const document = { activeElement: null };
    let currentInput;
    const grid = {
        set innerHTML(value) {
            currentInput = {
                dataset: { selectId: 'fixture' }, checked: selectedIds.has('fixture'), events: {},
                addEventListener(name, callback) { this.events[name] = callback; },
                focus() { document.activeElement = this; },
            };
        },
        querySelectorAll: selector => selector === 'input[data-select-id]' ? [currentInput] : [],
    };
    new Function('filteredVideos', 'selectedIds', 'videos', 'selectedId', 'resultMeta', 'emptyState', 'grid', 'esc', 'sourceColors', 'sourceLabels', 'statusLabels', 'updateSelectionUi', 'renderDetail', 'document',
        source.slice(start, end) + '; renderGrid();'
    )(() => videos, selectedIds, videos, 'fixture', {}, { style: {} }, grid, value => value, { youtube: 'green' }, { youtube: 'YouTube' }, { review: '검토' }, () => {}, () => {}, document);
    const previousInput = currentInput;
    document.activeElement = previousInput;
    previousInput.checked = true;
    previousInput.events.change({ stopPropagation() {} });
    assert.equal(selectedIds.has('fixture'), true);
    assert.notEqual(currentInput, previousInput);
    assert.equal(document.activeElement, currentInput);
});
