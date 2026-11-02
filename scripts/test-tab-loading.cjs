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
        removeAttribute(name) { delete this[name]; },
        addEventListener(name, fn) { listeners.set(name, fn); },
        click() { listeners.get('click')?.(); },
        getAttribute(name) { return this[name]; },
    };
}
function harness({ deferAnimation = false, url = 'http://localhost:3000/#content' } = {}) {
    const frames = Array.from({ length: 9 }, (_, i) => {
        const frame = element();
        frame.id = `frame-${i}`;
        frame.requests = [];
        frame.contentWindow = { postMessage() {} };
        let src = '';
        Object.defineProperty(frame, 'src', { get: () => src, set(value) { src = value; frame.requests.push(value); } });
        return frame;
    });
    const loading = element(), text = element(), content = element();
    const tabs = [7, 0, 2, 3, 4, 5, 6].map(index => {
        const tab = element(); tab.dataset.tabIndex = String(index); return tab;
    });
    const contentNav = element();
    const contentButtons = [5, 8].map(index => {
        const button = element(); button.dataset.contentTab = String(index); return button;
    });
    contentNav.querySelectorAll = () => contentButtons;
    loading.querySelector = selector => selector === '.loading-text' ? text : loading.children.find(node => 'frameLoadRetry' in node.dataset);
    const timers = new Map(), auth = [], themes = [], animations = [];
    const listeners = new Map(), location = new URL(url), entries = [url];
    let entryIndex = 0;
    const history = {
        pushState(_state, _title, next) {
            location.href = new URL(next, location).href;
            entries.splice(++entryIndex, entries.length, location.href);
        },
        replaceState(_state, _title, next) {
            location.href = new URL(next, location).href; entries[entryIndex] = location.href;
        },
        back() { if (entryIndex > 0) { location.href = entries[--entryIndex]; listeners.get('popstate')?.(); } },
        forward() { if (entryIndex + 1 < entries.length) { location.href = entries[++entryIndex]; listeners.get('popstate')?.(); } },
    };
    let nextTimer = 0;
    const ctx = vm.createContext({
        HOME_TAB_INDEX: 7, SONGBOOK_TAB_INDEX: 2, CONTENT_TAB_INDEX: 5, GAME_LOG_TAB_INDEX: 8, GAME_TAB_INDEX: 6, MUSIC_TAB_INDEX: 4,
        TAB_ROUTES: ['calendar', 'schedule', 'songbook', 'live', 'music', 'content', 'games', 'home', 'game-log'],
        MUSIC_PAGES: { songs: {}, dance: {}, gembox: {} },
        URLSearchParams, location, history, authServiceUnavailable: false,
        document: {
            title: 'BEADYO', body: element(), createElement: element,
            getElementById(id) { return id === 'loading' ? loading : id === 'content-subnav' ? contentNav : frames[Number(id.replace('frame-', ''))]; },
            querySelector: () => content,
            querySelectorAll: selector => selector === '.sheet-frame' ? frames : selector === '.tab' ? tabs : [],
        },
        window: { location, matchMedia: () => ({ matches: false }), dispatchEvent() {}, addEventListener: (name, fn) => listeners.set(name, fn), BeadyoHome: { activate() {} } },
        CustomEvent: class {}, requestAnimationFrame: fn => deferAnimation ? animations.push(fn) : fn(),
        setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        updateMusicSubnav() {}, updateMobileFab() {},
        resetFrameScrollAfterLoad() {}, syncCalendarAuth: frame => auth.push(frame?.id),
        syncThemeToFrames: frame => themes.push(frame?.id),
        deliverPendingSongbookSong() {}, deliverPendingLiveDate() {},
    });
    const app = source('index-app.js');
    vm.runInContext(
        section(app, 'const loaded =', 'const authDb =') +
        "let currentMusicPage = 'songs'; function getFrameUrl(index) { return index === 4 ? currentMusicPage + '.html' : 'page-' + index + '.html'; }\n" +
        section(app, 'function routeToMusicPage(', 'const readOnlyUrl =') +
        app.match(/function updateContentSubnav\([^]*?\n\}/)[0] + '\n' +
        section(app, 'function hideLoading(', 'function resetFrameScroll(') +
        section(app, 'function switchTab(', '// 첫 탭 초기 로드') +
        section(app, 'function handleTabRouteChange(', "window.addEventListener('storage'"), ctx);
    return {
        ctx, frames, loading, text, timers, auth, themes, tabs, contentNav, contentButtons, location,
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

test('direct game-log routes select CONTENT and only its played-games subpage', () => {
    for (const url of ['http://localhost:3000/#game-log', 'http://localhost:3000/?tab=game-log']) {
        const h = harness({ url });
        assert.equal(h.ctx.routeToTabIndex(), 8);
        h.ctx.switchTab(h.ctx.routeToTabIndex(), { replaceUrl: true });
        assert.deepEqual(h.tabs.filter(tab => tab.classList.contains('active')).map(tab => tab.dataset.tabIndex), ['5']);
        assert.equal(h.tabs.find(tab => tab.dataset.tabIndex === '5').getAttribute('aria-current'), 'page');
        assert.equal(h.contentNav.classList.contains('open'), true);
        assert.deepEqual(h.contentButtons.filter(button => button.classList.contains('active')).map(button => button.dataset.contentTab), ['8']);
        assert.equal(h.contentButtons[1].getAttribute('aria-current'), 'page');
        assert.equal(h.frames[8].classList.contains('active'), true);
        assert.equal(h.frames[5].classList.contains('active'), false);
        assert.equal(h.frames[5].requests.length, 0);
    }
});

test('content subpages preserve browser back and forward without reloading completed frames', () => {
    const h = harness({ url: 'http://localhost:3000/#game-log' });
    h.ctx.switchTab(8, { replaceUrl: true }); h.frames[8].onload();
    h.ctx.switchTab(5); h.frames[5].onload();
    assert.equal(h.location.hash, '#content');
    assert.equal(h.contentButtons[0].getAttribute('aria-current'), 'page');
    assert.equal(h.contentButtons[1].getAttribute('aria-current'), undefined);
    h.ctx.history.back();
    assert.equal(h.location.hash, '#game-log');
    assert.equal(h.frames[8].classList.contains('active'), true);
    assert.equal(h.contentButtons[1].getAttribute('aria-current'), 'page');
    h.ctx.history.forward();
    assert.equal(h.location.hash, '#content');
    assert.equal(h.frames[5].classList.contains('active'), true);
    assert.equal(h.contentButtons[0].getAttribute('aria-current'), 'page');
    assert.equal(h.frames[5].requests.length, 1);
    assert.equal(h.frames[8].requests.length, 1);
});

test('leaving CONTENT closes its subnavigation and clears its parent selection', () => {
    const h = harness(); h.ctx.switchTab(8); h.ctx.switchTab(6);
    assert.equal(h.contentNav.classList.contains('open'), false);
    assert.equal(h.tabs.find(tab => tab.dataset.tabIndex === '5').classList.contains('active'), false);
    assert.equal(h.tabs.find(tab => tab.dataset.tabIndex === '6').getAttribute('aria-current'), 'page');
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
