// Run with: node --test scripts/test-index-auth-boot.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.resolve(__dirname, '../index-app.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function element() {
    const classes = new Set(), listeners = new Map();
    return {
        children: [], dataset: {}, style: {}, hidden: false, disabled: false, textContent: '', innerHTML: '', isConnected: true,
        classList: {
            add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
            toggle(name, on = !classes.has(name)) { on ? classes.add(name) : classes.delete(name); },
        },
        append(...nodes) { this.children.push(...nodes); },
        setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
        getAttribute(name) { return this[name] || null; },
        addEventListener(name, fn) { listeners.set(name, fn); },
        focus() { this.focused = true; }, closest() { return null; }, scrollIntoView() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
    };
}
function boot({ sdk = 'normal', href = 'http://localhost:3000/index.html', session = null, sessionError = null, getSessionFailure = null } = {}) {
    const nodes = new Map(), loginButtons = [element(), element()], status = element(), googleButton = element(), backButton = element();
    loginButtons.forEach(button => { button.textContent = '로그인'; });
    const node = id => {
        if (!nodes.has(id)) { const next = element(); next.id = id; nodes.set(id, next); }
        return nodes.get(id);
    };
    const messages = [], calls = [], errors = [], alerts = [], redirects = [], historyCalls = [], storageDeletes = [];
    const frames = Array.from({ length: 8 }, (_, i) => {
        const frame = node(`frame-${i}`);
        frame.contentWindow = { postMessage: message => messages.push(message), scrollTo() {} };
        return frame;
    });
    const tabs = [7, 0, 2, 3, 4, 5, 6].map(index => { const tab = element(); tab.dataset.tabIndex = String(index); return tab; });
    const overlay = node('login-overlay');
    overlay.querySelector = selector => {
        if (selector === '.login-modal-subtitle') return status;
        if (selector === '.login-google-btn') return googleButton;
        if (selector === 'button:not([disabled])') return googleButton.disabled ? backButton : googleButton;
        return null;
    };
    node('loading').querySelector = selector => selector === '.loading-text' ? node('loading-text') : null;
    const location = new URL(href);
    location.assign = url => redirects.push(url);
    location.reload = () => calls.push(['reload']);
    const timers = new Map(); let nextTimer = 0, authListener;
    const client = {
        auth: {
            onAuthStateChange(fn) { calls.push(['onAuthStateChange']); authListener = fn; },
            async getSession() { calls.push(['getSession']); if (getSessionFailure) throw getSessionFailure; return { data: { session }, error: sessionError }; },
            async setSession(tokens) { calls.push(['setSession', tokens]); return { data: { session }, error: null }; },
            async exchangeCodeForSession(code) { calls.push(['exchangeCodeForSession', code]); return { data: { session }, error: null }; },
            async signInWithOAuth(options) { calls.push(['signInWithOAuth', options]); return { data: { url: 'https://accounts.fixture.invalid/login' }, error: null }; },
            async signOut() { calls.push(['signOut']); },
        },
        async rpc(name) { calls.push(['rpc', name]); return { data: true, error: null }; },
    };
    const document = {
        title: 'BEADYO', visibilityState: 'visible', currentScript: { src: 'http://localhost:3000/index-app.js?v=test' },
        documentElement: { dataset: { theme: 'light' }, style: {} }, body: element(), activeElement: loginButtons[0],
        getElementById: node, createElement: element, addEventListener() {},
        querySelector: selector => selector === '.content' ? node('content') : null,
        querySelectorAll: selector => ({ '.sheet-frame': frames, '.tab': tabs, '.login-btn': loginButtons }[selector] || []),
    };
    const ctx = vm.createContext({
        document, location, window: { location, matchMedia: () => ({ matches: true }), addEventListener() {}, dispatchEvent() {},
            BeadyoHome: { activate() { calls.push(['home']); } }, fetch: async () => ({ ok: false }) },
        history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (_, __, url) => {
            historyCalls.push([method, url]); location.href = new URL(url, location.href).href;
        }])),
        localStorage: { getItem: () => null, setItem() {}, removeItem: key => storageDeletes.push(key) },
        URL, URLSearchParams, Date, Map, Set, Request, Headers, AbortController,
        SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'fixture',
        BeadyoCommon: { closeUnifiedSearch() {}, openUnifiedSearch() {} }, beadyoAllowedMessageOrigin: origin => origin === location.origin,
        safeImageUrl: value => String(value || ''), fetchWithTimeout: async () => ({ ok: false }),
        setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
        setInterval: () => 1, requestAnimationFrame: fn => fn(), CustomEvent: class {},
        console: { error: (...args) => errors.push(args), warn() {} }, alert: message => alerts.push(message),
    });
    if (sdk !== 'missing') ctx.getBeadyoSupabaseClient = options => {
        calls.push(['createClient', options]);
        if (sdk === 'throw') throw Error('Supabase SDK unavailable');
        return client;
    };
    vm.runInContext(app, ctx, { filename: 'index-app.js' });
    return { ctx, node, frames, loginButtons, status, googleButton, backButton, messages, calls, errors, alerts, redirects, historyCalls, storageDeletes,
        authEvent: (event, nextSession) => authListener(event, nextSession),
        authUser: () => vm.runInContext('authUser', ctx), authDb: () => vm.runInContext('authDb', ctx),
    };
}

for (const sdk of ['throw', 'missing']) test(`${sdk} SDK leaves the default calendar and every main menu functional`, async () => {
    const h = boot({ sdk }); await flush();
    assert.equal(h.authDb(), null);
    assert.equal(h.frames[0].classList.contains('active'), true);
    assert.match(h.frames[0].src, /calendar\.html/);
    for (const index of [7, 0, 2, 3, 4, 5, 6]) {
        assert.doesNotThrow(() => h.ctx.switchTab(index));
        assert.equal(h.frames[index].classList.contains('active'), true);
        h.frames[index].onload?.();
    }
    assert.equal(h.errors.length, 1);
    assert.equal(h.messages.some(message => message.type === 'beadyo-auth-sync'), false);
    assert.deepEqual(h.storageDeletes, []);
});

test('SDK failure shows a readable login failure and focuses the enabled modal action', async () => {
    const h = boot({ sdk: 'throw' }); await flush();
    for (const button of h.loginButtons) {
        assert.equal(button.style.display, ''); assert.equal(button.textContent, '로그인 연결 오류');
        assert.match(button.title, /새로고침/); assert.match(button['aria-label'], /로그인 서비스/);
    }
    assert.match(h.status.textContent, /새로고침/); assert.equal(h.status.role, 'status');
    assert.equal(h.googleButton.disabled, true);
    h.ctx.openLoginModal(); assert.equal(h.node('login-overlay').classList.contains('open'), true);
    assert.equal(h.backButton.focused, true);
    h.ctx.closeLoginModal(); assert.equal(h.loginButtons[0].focused, true);
});

test('unavailable authentication entry points make no SDK calls or guest/admin messages', async () => {
    const h = boot({ sdk: 'throw', href: 'http://localhost:3000/index.html?code=keep-for-reload#home' }); await flush();
    const clientCalls = h.calls.length;
    await h.ctx.initAuth(); await h.ctx.signIn(); await h.ctx.signOut();
    assert.equal(await h.ctx.isEditorUser({ email: 'fixture@example.invalid' }), false);
    h.ctx.syncCalendarAuth(); h.ctx.sendCalendarAction('open-admin'); h.ctx.openCalendarAdmin();
    assert.equal(h.calls.length, clientCalls);
    assert.equal(h.messages.some(message => message.type === 'beadyo-auth-sync' || message.type === 'beadyo-auth-action'), false);
    assert.match(h.ctx.location.href, /code=keep-for-reload/);
    assert.deepEqual(h.redirects, []); assert.deepEqual(h.storageDeletes, []);
});

test('SDK failure preserves an unconsumed implicit callback hash during tab navigation', async () => {
    const hash = '#access_token=fixture-access&refresh_token=fixture-refresh';
    const h = boot({ sdk: 'throw', href: 'http://localhost:3000/index.html' + hash }); await flush();
    for (const index of [7, 5, 0]) h.ctx.switchTab(index);
    assert.equal(h.ctx.location.hash, hash);
    assert.equal(h.calls.some(call => call[0] === 'setSession'), false);
    assert.deepEqual(h.storageDeletes, []);
});

test('normal SDK keeps PKCE options, session UI, OAuth redirect and explicit sign-out behavior', async () => {
    const session = { user: { email: 'fixture@example.invalid', user_metadata: { name: 'Fixture' } } };
    const h = boot({ session }); await flush();
    const options = h.calls.find(call => call[0] === 'createClient')[1];
    assert.equal(options.auth.detectSessionInUrl, false); assert.equal(options.auth.flowType, 'pkce');
    assert.equal(typeof options.global.fetch, 'function'); assert.equal(h.authUser().email, session.user.email);
    assert.equal(h.node('auth-badge').classList.contains('show'), true);
    assert.equal(h.googleButton.disabled, false);
    assert.ok(h.loginButtons.every(button => button.style.display === 'none'));
    h.ctx.switchTab(0); h.frames[0].onload();
    assert.equal(h.messages.find(message => message.type === 'beadyo-auth-sync').user.email, session.user.email);
    await h.ctx.signIn();
    const oauth = h.calls.find(call => call[0] === 'signInWithOAuth')[1];
    assert.equal(oauth.provider, 'google'); assert.equal(oauth.options.redirectTo, 'http://localhost:3000/');
    assert.equal(oauth.options.skipBrowserRedirect, true); assert.equal(oauth.options.queryParams.prompt, 'select_account');
    assert.deepEqual(h.redirects, ['https://accounts.fixture.invalid/login']);
    await h.ctx.signOut();
    assert.equal(h.calls.filter(call => call[0] === 'signOut').length, 1); assert.equal(h.authUser(), null);
    assert.equal(h.messages.filter(message => message.type === 'beadyo-auth-sync').at(-1).user, null);
    assert.ok(h.loginButtons.every(button => button.style.display === ''));
});

test('normal PKCE boot and explicit implicit processing still use the original SDK session exchange', async () => {
    const session = { user: { email: 'fixture@example.invalid', user_metadata: {} } };
    const pkce = boot({ session, href: 'http://localhost:3000/index.html?code=fixture-code#home' }); await flush();
    assert.equal(pkce.calls.find(call => call[0] === 'exchangeCodeForSession')[1], 'fixture-code');
    assert.equal(pkce.authUser().email, session.user.email);
    const implicit = boot({ session }); await flush();
    // Test the legacy handler directly; initial tab routing predates this fix and can replace its hash.
    implicit.ctx.location.hash = '#access_token=fixture-access&refresh_token=fixture-refresh';
    await implicit.ctx.initAuth();
    const tokens = implicit.calls.find(call => call[0] === 'setSession')[1];
    assert.equal(tokens.access_token, 'fixture-access'); assert.equal(tokens.refresh_token, 'fixture-refresh');
    assert.equal(implicit.authUser().email, session.user.email);
});

test('a future-issued session error preserves the existing no-clear behavior', async () => {
    const h = boot({ sessionError: { message: 'JWT issued at future' } }); await flush();
    assert.deepEqual(h.storageDeletes, []); assert.equal(h.calls.some(call => call[0] === 'signOut'), false);
    assert.equal(h.messages.some(message => message.type === 'beadyo-auth-sync'), false);
    assert.equal(h.googleButton.disabled, false); assert.equal(h.loginButtons[0].textContent, '로그인');
});

test('an unexpected auth initialization rejection is contained without stopping menu navigation', async () => {
    const h = boot({ getSessionFailure: Error('SDK session read failed') }); await flush();
    assert.match(h.status.textContent, /새로고침/); assert.equal(h.googleButton.disabled, true);
    assert.equal(h.errors.length, 1);
    assert.doesNotThrow(() => h.ctx.switchTab(5)); assert.equal(h.frames[5].classList.contains('active'), true);
    assert.equal(h.messages.some(message => message.type === 'beadyo-auth-sync'), false);
    assert.deepEqual(h.storageDeletes, []);
});
