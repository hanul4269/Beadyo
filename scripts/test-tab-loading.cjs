const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
function section(text, start, end) {
    const from = text.indexOf(start), to = text.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} section exists`);
    return text.slice(from, to);
}
function element() {
    const classes = new Set(), listeners = new Map();
    return {
        children: [], dataset: {}, style: {}, hidden: false,
        classList: {
            add: name => classes.add(name), remove: name => classes.delete(name),
            contains: name => classes.has(name),
            toggle(name, on) { on ? classes.add(name) : classes.delete(name); },
        },
        append(...nodes) { this.children.push(...nodes); },
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, fn) { listeners.set(name, fn); },
        click() { listeners.get('click')?.(); },
        getAttribute(name) { return this[name]; },
    };
}
function harness({ deferAnimation = false } = {}) {
    const frames = Array.from({ length: 8 }, (_, i) => {
        const frame = element();
        frame.id = `frame-${i}`;
        frame.requests = [];
        frame.contentWindow = { postMessage() {} };
        let src = '';
        Object.defineProperty(frame, 'src', { get: () => src, set(value) { src = value; frame.requests.push(value); } });
        return frame;
    });
    const loading = element(), text = element(), content = element();
    loading.querySelector = selector => selector === '.loading-text' ? text : loading.children.find(node => 'frameLoadRetry' in node.dataset);
    const timers = new Map(), auth = [], themes = [], animations = [];
    let nextTimer = 0;
    const ctx = vm.createContext({
        HOME_TAB_INDEX: 7, SONGBOOK_TAB_INDEX: 2, CONTENT_TAB_INDEX: 5, MUSIC_TAB_INDEX: 4,
        MUSIC_PAGES: { songs: {}, dance: {}, gembox: {} },
        document: {
            title: 'BEADYO', body: element(), createElement: element,
            getElementById(id) { return id === 'loading' ? loading : frames[Number(id.replace('frame-', ''))]; },
            querySelector: () => content,
            querySelectorAll: selector => selector === '.sheet-frame' ? frames : [],
        },
        window: { matchMedia: () => ({ matches: false }), dispatchEvent() {}, BeadyoHome: { activate() {} } },
        CustomEvent: class {}, requestAnimationFrame: fn => deferAnimation ? animations.push(fn) : fn(),
        setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        updateMusicSubnav() {}, updateMobileFab() {}, syncTabUrl() {},
        resetFrameScrollAfterLoad() {}, syncCalendarAuth: frame => auth.push(frame?.id),
        syncThemeToFrames: frame => themes.push(frame?.id),
        deliverPendingSongbookSong() {}, deliverPendingLiveDate() {},
    });
    const app = source('index-app.js');
    vm.runInContext(
        section(app, 'const loaded =', 'const authDb =') +
        "let currentMusicPage = 'songs'; function getFrameUrl(index) { return index === 4 ? currentMusicPage + '.html' : 'page-' + index + '.html'; }\n" +
        section(app, 'function hideLoading(', 'function resetFrameScroll(') +
        section(app, 'function switchTab(', '// 첫 탭 초기 로드'), ctx);
    return {
        ctx, frames, loading, text, timers, auth, themes,
        flushAnimations() { while (animations.length) animations.shift()(); },
        isLoaded: index => vm.runInContext(`loaded.has(${index})`, ctx),
        expire(index) {
            const id = vm.runInContext(`pendingFrameLoads.get(${index}).timer`, ctx);
            const timer = timers.get(id); assert.ok(timer); timers.delete(id); timer.fn();
        },
        retry: () => loading.querySelector('[data-frame-load-retry]'),
    };
}

test('a background tab finishing cannot hide the active tab loading indicator', () => {
    const h = harness(); h.ctx.switchTab(4); h.ctx.switchTab(5);
    h.frames[4].onload();
    assert.equal(h.isLoaded(4), true);
    assert.equal(h.frames[5].dataset.messageReady, 'false');
    assert.equal(h.loading.style.display, 'flex');
    h.frames[5].onload();
    assert.equal(h.loading.style.display, 'none');
    assert.equal(h.frames[5].dataset.messageReady, 'true');
});

test('revisiting a pending tab waits for the same request rather than displaying an empty frame', () => {
    const h = harness(); h.ctx.switchTab(4); h.ctx.switchTab(7); h.ctx.switchTab(4);
    assert.equal(h.frames[4].requests.length, 1);
    assert.equal(h.isLoaded(4), false);
    assert.equal(h.frames[4].classList.contains('loaded'), false);
    assert.equal(h.loading.style.display, 'flex');
    h.frames[4].onload();
    assert.equal(h.isLoaded(4), true);
    assert.equal(h.loading.style.display, 'none');
});

test('an old MUSIC completion cannot mark a newly selected MUSIC page ready', () => {
    const h = harness(); h.ctx.switchTab(4);
    const previousLoad = h.frames[4].onload;
    h.ctx.switchMusicPage('gembox'); previousLoad();
    assert.equal(h.frames[4].src, 'gembox.html');
    assert.equal(h.isLoaded(4), false);
    assert.equal(h.frames[4].dataset.messageReady, 'false');
    assert.equal(h.loading.style.display, 'flex');
    h.frames[4].onload();
    assert.equal(h.isLoaded(4), true);
    assert.deepEqual(h.auth, ['frame-4']);
    assert.deepEqual(h.themes, ['frame-4']);
});

test('a queued reveal from the previous MUSIC page cannot reveal its replacement before load', () => {
    const h = harness({ deferAnimation: true }); h.ctx.switchTab(4); h.frames[4].onload();
    h.ctx.switchMusicPage('dance'); h.flushAnimations();
    assert.equal(h.frames[4].classList.contains('loaded'), false);
    assert.equal(h.loading.style.display, 'flex');
    h.frames[4].onload(); h.flushAnimations();
    assert.equal(h.frames[4].classList.contains('loaded'), true);
});

test('failed frames remain retryable and a successful retry restores normal loading and synchronization', () => {
    const h = harness(); h.ctx.switchTab(5); h.frames[5].onerror();
    assert.equal(h.isLoaded(5), false);
    assert.equal(h.retry().hidden, false);
    assert.match(h.text.textContent, /불러오지 못했습니다/);
    h.retry().click();
    assert.equal(h.frames[5].requests.length, 2);
    assert.equal(h.retry().hidden, true);
    assert.equal(h.text.textContent, '대기 중');
    h.frames[5].onload();
    assert.equal(h.loading.style.display, 'none');
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.auth, ['frame-5']);
});

test('a timeout in a background tab cannot replace another tab status and can recover after a late success', () => {
    const h = harness(); h.ctx.switchTab(4); h.ctx.switchTab(5); h.expire(4);
    assert.equal(h.text.textContent, '대기 중');
    assert.equal(h.loading.dataset.frameIndex, '5');
    h.ctx.switchTab(4);
    assert.match(h.text.textContent, /시간이 걸리고/);
    assert.equal(h.retry().hidden, false);
    h.frames[4].onload();
    assert.equal(h.loading.style.display, 'none');
    assert.equal(h.isLoaded(4), true);
});

test('retrying after timeout ignores the abandoned completion and waits for the replacement request', () => {
    const h = harness(); h.ctx.switchTab(5);
    const previousLoad = h.frames[5].onload;
    h.expire(5); h.retry().click(); previousLoad();
    assert.equal(h.frames[5].dataset.messageReady, 'false');
    assert.equal(h.isLoaded(5), false);
    assert.equal(h.loading.style.display, 'flex');
    h.frames[5].onload();
    assert.equal(h.loading.style.display, 'none');
});

test('a pending completion leaves HOME visible and a completed tab is reused', () => {
    const h = harness(); h.ctx.switchTab(2); h.ctx.switchTab(7); h.frames[2].onload();
    assert.equal(h.frames[7].classList.contains('active'), true);
    assert.equal(h.loading.style.display, 'none');
    h.ctx.switchTab(2);
    assert.equal(h.frames[2].requests.length, 1);
    assert.equal(h.loading.style.display, 'none');
});

test('standalone brand and whole-home actions both target the HOME route', () => {
    const ctx = vm.createContext({ document: { createElement: element }, STANDALONE_NAV_ITEMS: [], buildStandaloneSearchButton: element });
    vm.runInContext(section(source('beadyo-common.js'), '    function buildStandaloneNavigation(', '    function initStandaloneNavigation('), ctx);
    const header = ctx.buildStandaloneNavigation('content');
    const [brand, actions] = header.children[0].children;
    for (const link of [brand, actions.children[1]]) {
        const url = new URL(link.href, 'http://localhost:3000/content.html');
        assert.equal(url.pathname, '/index.html');
        assert.equal(url.hash, '#home');
    }
});
