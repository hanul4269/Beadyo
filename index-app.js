const FALLBACK_ASSET_VERSION = 'release-20261011-all';
const IS_LOCAL_HOST = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
const APP_ASSET_VERSION = (() => {
    try {
        const scriptUrl = document.currentScript?.src || '';
        return new URL(scriptUrl, window.location.href).searchParams.get('v') || FALLBACK_ASSET_VERSION;
    } catch {
        return FALLBACK_ASSET_VERSION;
    }
})();
const FRAME_ASSET_VERSION = IS_LOCAL_HOST ? `dev-${Date.now()}` : APP_ASSET_VERSION;
const THEME_STORAGE_KEY = 'beadyo:theme';
const PWA_GUIDE_SEEN_STORAGE_KEY = 'beadyo:pwa-guide-seen:v1';
const NOTIFICATION_READ_STORAGE_KEY = 'beadyo:notification-read:v1';
const NOTIFICATION_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const JWT_FUTURE_FINAL_RETRY_DELAYS_MS = [2000, 5000];
const JWT_FUTURE_MAX_WAIT_MS = 90000;
const THEME_META_COLORS = {
    light: '#76ad39',
    dark: '#4f7d2b',
};
const NOTIFICATION_TYPE_LABELS = {
    notice: '공지',
    patch: '패치',
    live: 'LIVE',
    up: 'UP',
};
const NOTIFICATION_TYPE_ORDER = {
    notice: 0,
    patch: 1,
    live: 2,
    up: 3,
};
let notificationState = {
    items: [],
    filter: 'all',
    loading: false,
    loadedAt: 0,
    error: '',
    promise: null,
};

function withFrameAssetVersion(src, assetVersion = APP_ASSET_VERSION) {
    if (!src || /^https?:\/\//i.test(src)) return src;
    const url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin) return src;
    url.searchParams.set('v', IS_LOCAL_HOST ? FRAME_ASSET_VERSION : assetVersion);
    return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
}

function readStoredTheme() {
    try {
        return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
        return 'light';
    }
}

let currentTheme = normalizeTheme(document.documentElement.dataset.theme || readStoredTheme());

function persistTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
}

function updateThemeToggles() {
    const isDark = currentTheme === 'dark';
    const label = isDark ? '낮 모드 켜기' : '밤 모드 켜기';
    document.querySelectorAll('.theme-toggle').forEach(button => {
        button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        button.setAttribute('aria-label', label);
        button.title = label;
    });
}

function updateThemeMetaColor() {
    const meta = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_META_COLORS[currentTheme] || THEME_META_COLORS.light);
}

function applyTheme(theme, options = {}) {
    currentTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = currentTheme;
    document.documentElement.style.colorScheme = currentTheme === 'dark' ? 'dark' : 'light';
    if (options.persist) persistTheme(currentTheme);
    updateThemeToggles();
    updateThemeMetaColor();
    if (options.broadcast) syncThemeToFrames();
}

function syncThemeToFrames(targetFrame = null) {
    const msg = { type: 'beadyo-theme-sync', theme: currentTheme };
    const ids = ['frame-0', 'frame-2', 'frame-3', 'frame-4', 'frame-5', 'frame-6', 'guide-frame'];
    const frames = targetFrame
        ? (ids.includes(targetFrame.id) ? [targetFrame] : [])
        : ids.map(id => document.getElementById(id));
    for (const frame of frames) {
        if (!isFrameReadyForMessage(frame)) continue;
        const origin = window.location.origin === 'null' || frame.id === 'guide-frame'
            ? '*'
            : window.location.origin;
        frame.contentWindow.postMessage(msg, origin);
    }
}

const SONGBOOK_TAB_INDEX = 2;
let pendingSongbookSongId = '';
let pendingSongbookDetail = false;
let pendingLiveDate = '';
function normalizeSongbookSongId(value) {
    const id = String(value ?? '').trim();
    return /^[a-zA-Z0-9_-]+$/.test(id) ? id : '';
}

function deliverPendingSongbookSong(frame = document.getElementById(`frame-${SONGBOOK_TAB_INDEX}`)) {
    if (!pendingSongbookSongId || !isFrameReadyForMessage(frame)) return false;
    const origin = window.location.origin === 'null' ? '*' : window.location.origin;
    frame.contentWindow.postMessage({
        type: 'beadyo-focus-songbook-song',
        songId: pendingSongbookSongId,
        detail: pendingSongbookDetail,
    }, origin);
    pendingSongbookSongId = '';
    pendingSongbookDetail = false;
    return true;
}

function openSongbookSong(songId, options = {}) {
    const targetId = normalizeSongbookSongId(songId);
    if (!targetId) return;
    pendingSongbookSongId = targetId;
    pendingSongbookDetail = options.detail === true;
    BeadyoCommon.closeUnifiedSearch();
    switchTab(SONGBOOK_TAB_INDEX);
    requestAnimationFrame(() => deliverPendingSongbookSong());
}

window.addEventListener('message', event => {
    if (!beadyoAllowedMessageOrigin(event.origin)) return;
    if (event.data?.type === 'beadyo-open-unified-search') {
        BeadyoCommon.openUnifiedSearch();
    } else if (event.data?.type === 'beadyo-open-songbook-song') {
        openSongbookSong(event.data.songId);
    }
});

function toggleThemeMode() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark', { persist: true, broadcast: true });
}

function isPwaGuideSeen() {
    try {
        return localStorage.getItem(PWA_GUIDE_SEEN_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function updateGuideNewBadges() {
    const seen = isPwaGuideSeen();
    document.querySelectorAll('[data-guide-new-badge]').forEach(badge => {
        badge.hidden = seen;
    });
}

function markPwaGuideSeen() {
    try {
        localStorage.setItem(PWA_GUIDE_SEEN_STORAGE_KEY, '1');
    } catch {}
    updateGuideNewBadges();
}

const TABS = [
    { type: 'calendar', src: 'calendar.html', directUrl: 'calendar.html', assetVersion: 'release-20261017-all' },
    { type: 'schedule', id: '1vXzzx7UibAcUwM26Lp2InUnhNkITLd7-JkqB4g_FudM' },
    { type: 'songbook', src: 'songbook.html?view=songbook', directUrl: 'songbook.html?view=songbook', assetVersion: 'release-20261011-all' },
    { type: 'songbook', src: 'songbook.html?view=live', directUrl: 'songbook.html?view=live', assetVersion: 'release-20261011-all' },
    { type: 'songs', src: 'songs.html', directUrl: 'songs.html', assetVersion: 'release-20261011-all' },
    { type: 'content', src: 'content.html', directUrl: 'content.html', assetVersion: 'release-20261011-all' },
    { type: 'games', src: 'games.html', directUrl: 'games.html', assetVersion: 'release-20261011-all' },
    { type: 'home' },
];

const CONTENT_TAB_INDEX = 5;
const GAME_TAB_INDEX = 6;
const HOME_TAB_INDEX = 7;
const TAB_ROUTES = ['calendar', 'schedule', 'songbook', 'live', 'music', 'content', 'games', 'home'];
const MUSIC_TAB_INDEX = 4;
const MUSIC_PAGES = {
    songs: { src: 'songs.html', directUrl: 'songs.html', assetVersion: 'release-20261011-all' },
    dance: { src: 'dance.html', directUrl: 'dance.html', assetVersion: 'release-20261011-all' },
    gembox: { src: 'gembox.html', directUrl: 'gembox.html', assetVersion: 'release-20261011-all' },
    tractor: { src: 'tractor-service.html', directUrl: 'tractor-service.html', assetVersion: 'release-20261011-all' },
};
let currentMusicPage = 'songs';

function routeToMusicPage() {
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    const route = queryTab || hash;
    if (route === 'gembox' || route === 'jewelbox') return 'gembox';
    if (route === 'tractor' || route === 'tractor-service' || route === 'tractorservice') return 'tractor';
    if (route === 'dance' || route === 'dance-video' || route === 'dance-videos') return 'dance';
    if (route === 'music' || route === 'songs') return 'songs';
    return null;
}

function routeToTabIndex() {
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    if (queryTab === 'game') return GAME_TAB_INDEX;
    if (queryTab === 'songs' || queryTab === 'music' || queryTab === 'gembox' || queryTab === 'jewelbox' || queryTab === 'tractor' || queryTab === 'tractor-service' || queryTab === 'tractorservice' || queryTab === 'dance' || queryTab === 'dance-video' || queryTab === 'dance-videos') return MUSIC_TAB_INDEX;
    const queryIndex = TAB_ROUTES.indexOf(queryTab);
    if (queryIndex >= 0) return queryIndex;

    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (hash === 'game-preview') return GAME_TAB_INDEX;
    if (hash === 'songs' || hash === 'music' || hash === 'gembox' || hash === 'jewelbox' || hash === 'tractor' || hash === 'tractor-service' || hash === 'tractorservice' || hash === 'dance' || hash === 'dance-video' || hash === 'dance-videos') return MUSIC_TAB_INDEX;
    const hashIndex = TAB_ROUTES.indexOf(hash);
    if (hashIndex >= 0) return hashIndex;

    return null;
}

function syncTabUrl(index, replace = false) {
    if (authServiceUnavailable && window.location.hash.includes('access_token=')) return;
    const route = index === MUSIC_TAB_INDEX
        ? (currentMusicPage === 'songs' ? 'music' : currentMusicPage)
        : TAB_ROUTES[index];
    if (!route) return;
    const params = new URLSearchParams(window.location.search);
    if (!replace) params.delete('tab');
    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}#${route}`;
    if (window.location.href.endsWith(`#${route}`)) return;
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ tab: index }, document.title, nextUrl);
}

const readOnlyUrl = s =>
    `https://docs.google.com/spreadsheets/d/${s.id}/htmlview?gid=${s.gid}&embedded=true`;
const editUrl = s =>
    `https://docs.google.com/spreadsheets/d/${s.id}/edit?rm=minimal#gid=${s.gid}`;

function currentScheduleSheetName() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yy}.${mm}`;
}

function scheduleUrl(tab) {
    const sheet = currentScheduleSheetName();
    return `https://docs.google.com/spreadsheets/d/${tab.id}/edit?rm=minimal&range=${encodeURIComponent(sheet)}!A1`;
}

const loaded = new Set();
const pendingFrameLoads = new Map();
const FRAME_LOAD_TIMEOUT_MS = 20000;
const AUTH_UNAVAILABLE_MESSAGE = '로그인 서비스를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
let authServiceUnavailable = false;
const authDb = (() => {
    try {
        return getBeadyoSupabaseClient({
            auth: {
                detectSessionInUrl: false,
                flowType: 'pkce',
            },
            global: { fetch: fetchWithJwtFutureRetry },
        });
    } catch (error) {
        authServiceUnavailable = true;
        console.error('로그인 서비스 초기화 실패:', error);
        return null;
    }
})();
let authUser = null;

function showAuthUnavailable() {
    authServiceUnavailable = true;
    document.getElementById('auth-badge')?.classList.remove('show');
    document.querySelectorAll('.login-btn').forEach(button => {
        button.style.display = '';
        button.textContent = '로그인 연결 오류';
        button.title = AUTH_UNAVAILABLE_MESSAGE;
        button.setAttribute('aria-label', AUTH_UNAVAILABLE_MESSAGE);
    });
    const overlay = document.getElementById('login-overlay');
    const status = overlay?.querySelector('.login-modal-subtitle');
    if (status) {
        status.textContent = AUTH_UNAVAILABLE_MESSAGE;
        status.setAttribute('role', 'status');
    }
    const googleButton = overlay?.querySelector('.login-google-btn');
    if (googleButton) {
        googleButton.disabled = true;
        googleButton.title = AUTH_UNAVAILABLE_MESSAGE;
    }
}

function isJwtIssuedAtFutureError(error) {
    const message = String(error?.message || error?.error_description || error || '');
    return /jwt.*issued.*future|issued at future/i.test(message);
}

async function responseHasJwtIssuedAtFuture(response) {
    if (response?.ok) return false;
    try {
        return isJwtIssuedAtFutureError(await response.clone().text());
    } catch {
        return false;
    }
}

function createRetryableRequest(input, init) {
    if (typeof Request === 'undefined') return null;
    try {
        return new Request(input instanceof Request ? input.clone() : input, init);
    } catch {
        return null;
    }
}

function isSupabaseRestRequest(request) {
    if (!request) return false;
    try {
        const url = new URL(request.url);
        return url.origin === SUPABASE_URL && url.pathname.startsWith('/rest/v1/');
    } catch {
        return false;
    }
}

function anonymousSupabaseReadRequest(request) {
    const clone = request.clone();
    const headers = new Headers(clone.headers);
    headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    return new Request(clone, { headers });
}

function jwtFutureWaitMs(request, response) {
    try {
        const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        const part = token.split('.')[1];
        if (!part) return 1000;
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
        const issuedAtMs = Number(JSON.parse(atob(base64)).iat) * 1000;
        const responseDateMs = Date.parse(response.headers.get('Date') || '');
        const referenceMs = Number.isFinite(responseDateMs) ? responseDateMs : Date.now();
        if (!Number.isFinite(issuedAtMs)) return 1000;
        return Math.max(1000, Math.min(JWT_FUTURE_MAX_WAIT_MS, issuedAtMs - referenceMs + 1200));
    } catch {
        return 1000;
    }
}

async function fetchWithJwtFutureRetry(input, init) {
    const requestTemplate = createRetryableRequest(input, init);
    const send = () => window.fetch(requestTemplate ? requestTemplate.clone() : input, init);
    let response = await send();
    if (!await responseHasJwtIssuedAtFuture(response) || !isSupabaseRestRequest(requestTemplate)) return response;

    if (['GET', 'HEAD'].includes(requestTemplate.method)) {
        return window.fetch(anonymousSupabaseReadRequest(requestTemplate));
    }

    const firstWaitMs = jwtFutureWaitMs(requestTemplate, response);
    for (const delayMs of [firstWaitMs, ...JWT_FUTURE_FINAL_RETRY_DELAYS_MS]) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        response = await send();
        if (!await responseHasJwtIssuedAtFuture(response)) return response;
    }
    return response;
}

async function isEditorUser(user) {
    if (!user || !authDb || authServiceUnavailable) return false;
    try {
        const { data, error } = await authDb.rpc('is_beadyo_editor');
        if (error) {
            if (isJwtIssuedAtFutureError(error)) {
                console.warn('편집 권한 확인이 지연되고 있지만 로그인 상태는 유지합니다.');
            }
            return false;
        }
        return data === true;
    } catch { return false; }
}

const isMobile = window.matchMedia('(max-width: 640px)').matches;

function getFrameUrl(index) {
    if (index === MUSIC_TAB_INDEX) {
        const musicPage = MUSIC_PAGES[currentMusicPage] || MUSIC_PAGES.songs;
        return withFrameAssetVersion(musicPage.src, musicPage.assetVersion);
    }
    const tab = TABS[index];
    if (index === CONTENT_TAB_INDEX) {
        const child = new URL(tab.src, location.href), parent = new URLSearchParams(location.search);
        ['q','year','category','planning','series','sort','content'].forEach(key => {
            const value = parent.get(['series', 'content'].includes(key) ? key : 'content_' + key);
            if (value) child.searchParams.set(key, value);
        });
        return withFrameAssetVersion(child.pathname + child.search, tab.assetVersion);
    }
    if (tab.type === 'calendar' || tab.type === 'songs' || tab.type === 'songbook' || tab.type === 'content' || tab.type === 'games') {
        return withFrameAssetVersion(tab.src, tab.assetVersion);
    }
    if (tab.type === 'schedule') return scheduleUrl(tab);
    if (tab.alwaysEdit) return editUrl(tab);
    return readOnlyUrl(tab);
}

function getSheetDirectUrl(index) {
    if (index === MUSIC_TAB_INDEX) {
        return (MUSIC_PAGES[currentMusicPage] || MUSIC_PAGES.songs).directUrl;
    }
    const tab = TABS[index];
    if (tab.type === 'calendar' || tab.type === 'songs' || tab.type === 'songbook' || tab.type === 'content' || tab.type === 'games') return tab.directUrl;
    if (tab.type === 'schedule') return scheduleUrl(tab);
    return `https://docs.google.com/spreadsheets/d/${tab.id}/edit#gid=${tab.gid}`;
}

function hideLoading(index) {
    const frame = document.getElementById(`frame-${index}`);
    const el = document.getElementById('loading');
    if (el && frame?.classList.contains('active')) el.style.display = 'none';
    if (frame) requestAnimationFrame(() => {
        if (index === HOME_TAB_INDEX || (loaded.has(index) && frame.dataset.messageReady === 'true')) {
            frame.classList.add('loaded');
        }
    });
}

function showFrameLoading(index, error = '') {
    const frame = document.getElementById(`frame-${index}`);
    const el = document.getElementById('loading');
    if (!el || !frame?.classList.contains('active')) return;
    el.style.display = 'flex';
    el.dataset.frameIndex = String(index);
    const text = el.querySelector('.loading-text');
    if (text) {
        text.textContent = error || '대기 중';
        text.classList.toggle('loading-dots', !error);
        text.style.color = error ? 'var(--ink)' : '';
    }
    let retry = el.querySelector('[data-frame-load-retry]');
    if (error && !retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'notification-ghost-btn';
        retry.dataset.frameLoadRetry = '';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', () => {
            startFrameLoad(Number(el.dataset.frameIndex), true);
        });
        el.append(retry);
    }
    if (retry) retry.hidden = !error;
}

function cancelFrameLoad(index) {
    const pending = pendingFrameLoads.get(index);
    if (pending) clearTimeout(pending.timer);
    pendingFrameLoads.delete(index);
}

function startFrameLoad(index, force = false) {
    const frame = document.getElementById(`frame-${index}`);
    if (!frame) return;
    if (!force && pendingFrameLoads.has(index)) {
        showFrameLoading(index, pendingFrameLoads.get(index).error);
        return;
    }
    cancelFrameLoad(index);
    loaded.delete(index);
    frame.dataset.messageReady = 'false';
    frame.classList.remove('loaded');
    const pending = { timer: null, error: '' };
    pendingFrameLoads.set(index, pending);
    showFrameLoading(index);
    const fail = message => {
        if (pendingFrameLoads.get(index) !== pending) return;
        clearTimeout(pending.timer);
        pending.error = message;
        showFrameLoading(index, message);
    };
    frame.onerror = () => fail('화면을 불러오지 못했습니다. 다시 시도해 주세요.');
    frame.onload = () => {
        if (pendingFrameLoads.get(index) !== pending) return;
        clearTimeout(pending.timer);
        pendingFrameLoads.delete(index);
        loaded.add(index);
        frame.dataset.messageReady = 'true';
        resetFrameScrollAfterLoad(index);
        hideLoading(index);
        if (index === 0 || index === 2 || index === 3 || index === 4 || index === CONTENT_TAB_INDEX) syncCalendarAuth(frame);
        syncThemeToFrames(frame);
        if (index === SONGBOOK_TAB_INDEX) deliverPendingSongbookSong(frame);
        if (index === 3) deliverPendingLiveDate(frame);
    };
    pending.timer = setTimeout(() => {
        fail('화면을 불러오는 데 시간이 걸리고 있습니다. 다시 시도해 주세요.');
    }, FRAME_LOAD_TIMEOUT_MS);
    frame.src = getFrameUrl(index);
}

function resetFrameScroll(index) {
    try {
        const frame = document.getElementById(`frame-${index}`);
        frame?.contentWindow?.scrollTo(0, 0);
        if (frame?.contentDocument) {
            frame.contentDocument.documentElement.scrollTop = 0;
            frame.contentDocument.body.scrollTop = 0;
        }
    } catch {}
}

function resetFrameScrollAfterLoad(index) {
    resetFrameScroll(index);
    setTimeout(() => resetFrameScroll(index), 80);
    setTimeout(() => resetFrameScroll(index), 260);
    setTimeout(() => resetFrameScroll(index), 700);
}

function updateMobileFab(index) {
    const fab = document.getElementById('mobile-fab');
    if (!isMobile) return;
    if (index === HOME_TAB_INDEX) { fab.classList.remove('show'); return; }
    const type = TABS[index]?.type;
    if (type === 'calendar' || type === 'songs' || type === 'songbook' || type === 'content' || type === 'games') {
        fab.classList.remove('show');
        return;
    }
    fab.classList.add('show');
    fab.href = getSheetDirectUrl(index);
}

function getSerializableAuthUser(user = authUser) {
    if (!user) return null;
    return {
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
        picture: safeImageUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || ''),
    };
}

function isFrameReadyForMessage(frame) {
    return !!(
        frame?.contentWindow &&
        frame.dataset.messageReady === 'true' &&
        frame.getAttribute('src')
    );
}

function syncCalendarAuth(targetFrame = null) {
    // An unavailable SDK is not a confirmed guest session.
    if (!authDb || authServiceUnavailable) return;
    const origin = window.location.origin === 'null' ? '*' : window.location.origin;
    const msg = { type: 'beadyo-auth-sync', user: getSerializableAuthUser() };
    const frames = targetFrame
        ? [targetFrame]
        : ['frame-0', 'frame-2', 'frame-3', 'frame-4', 'frame-5'].map(id => document.getElementById(id));
    for (const frame of frames) {
        if (!isFrameReadyForMessage(frame)) continue;
        frame.contentWindow.postMessage(msg, origin);
    }
}

function updateMusicSubnav(activeIndex) {
    const nav = document.getElementById('music-subnav');
    if (!nav) return;
    nav.classList.toggle('open', activeIndex === MUSIC_TAB_INDEX);
    nav.querySelectorAll('.subtab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.musicPage === currentMusicPage);
    });
}

function sendCalendarAction(action) {
    if (!authDb || authServiceUnavailable) return;
    const frame = document.getElementById('frame-0');
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({
        type: 'beadyo-auth-action',
        action,
    }, window.location.origin === 'null' ? '*' : window.location.origin);
}

function toggleAuthMenu(event) {
    event.stopPropagation();
    document.getElementById('auth-menu')?.classList.toggle('open');
}

function closeAuthMenu() {
    document.getElementById('auth-menu')?.classList.remove('open');
}

document.addEventListener('click', closeAuthMenu);

function escAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeNotificationFilter(filter) {
    return filter === 'notice' || filter === 'patch' || filter === 'live' || filter === 'up' ? filter : 'all';
}

function notificationHash(value) {
    const text = String(value ?? '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}

function readNotificationIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
    } catch {
        return new Set();
    }
}

function writeNotificationIds(ids) {
    try {
        localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(Array.from(ids).slice(-240)));
    } catch {}
}

function applyNotificationReadState() {
    const readIds = readNotificationIds();
    notificationState.items.forEach(item => {
        item.isRead = item.attention === false || readIds.has(item.id);
    });
}

function notificationUnreadCount() {
    return notificationState.items.filter(item => item.attention !== false && !item.isRead).length;
}

function formatNotificationDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    try {
        return new Intl.DateTimeFormat('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function notificationTimeValue(item) {
    const value = item.timestamp || item.updatedAt || item.createdAt || item.meta || '';
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
}

function sortNotificationItems(items) {
    return items.slice().sort((a, b) => {
        const unreadDiff = Number(b.attention !== false && !b.isRead) - Number(a.attention !== false && !a.isRead);
        if (unreadDiff) return unreadDiff;
        const typeDiff = (NOTIFICATION_TYPE_ORDER[a.type] ?? 99) - (NOTIFICATION_TYPE_ORDER[b.type] ?? 99);
        if (typeDiff) return typeDiff;
        return notificationTimeValue(b) - notificationTimeValue(a);
    });
}

async function fetchSupabaseRest(path, ms = 4000) {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${cleanPath}`, ms, {
        cache: 'no-store',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!res.ok) throw new Error(`Supabase REST HTTP ${res.status}`);
    return await res.json();
}

async function loadPatchNotificationItems() {
    let data = null;
    if (window.PatchNotes?.load) {
        data = await window.PatchNotes.load();
    } else {
        const res = await fetch('patch-notes.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`patch notes HTTP ${res.status}`);
        const raw = await res.json();
        data = {
            notes: Array.isArray(raw.notes) ? raw.notes : [],
        };
    }
    const notes = (data.notes || [])
        .filter(note => note?.date && note?.tag && Array.isArray(note.items) && note.items.length);
    const latestDate = notes[0]?.date;
    if (!latestDate) return [];

    return notes
        .filter(note => note.date === latestDate)
        .slice(0, 4)
        .map(note => {
            const firstItem = String(note.items[0] || '새 패치노트가 등록되었습니다.');
            const extraText = note.items.length > 1 ? ` 외 ${note.items.length - 1}건` : '';
            return {
                id: `patch:${note.date}:${note.tag}:${notificationHash(note.items.join('|'))}`,
                type: 'patch',
                title: `${note.tag} 패치노트`,
                body: `${firstItem}${extraText}`,
                meta: note.date,
                timestamp: note.date,
                action: 'patch-notes',
                attention: true,
            };
        });
}

function noticeBodyText(row) {
    const label = String(row?.link_label || '').trim();
    if (label && label !== '공지 보러가기') return label;
    return '활성 공지사항이 있습니다.';
}

async function loadNoticeNotificationItems() {
    const rows = await fetchSupabaseRest('calendar_notices?select=id,title,image_url,link_url,link_label,button_bg_color,button_text_color,header_bg_color,header_text_color,is_active,sort_order,created_at&is_active=eq.true&order=sort_order.asc&order=created_at.asc', 4000);
    return (Array.isArray(rows) ? rows : [])
        .filter(row => row?.is_active !== false)
        .slice(0, 3)
        .map(row => {
            const title = String(row.title || '공지사항');
            return {
                id: `notice:${row.id || notificationHash(title)}:${row.created_at || ''}`,
                type: 'notice',
                title,
                body: noticeBodyText(row),
                meta: formatNotificationDate(row.created_at),
                timestamp: row.created_at || '',
                action: 'calendar-notice',
                payload: row,
                attention: true,
            };
        });
}

async function loadLiveNotificationItems(force = false) {
    const data = await fetchLiveStatus({ force });
    return liveNotificationItems(data || _liveStatusMemo.data);
}

function liveNotificationItems(data) {
    if (!data || typeof data.live === 'undefined') return [];
    const isLive = !!data.live;
    const updatedAt = data.updated || data.row_updated_at || '';
    const title = String(data.title || '').trim();
    return [{
        id: `live:${isLive ? 'on' : 'off'}:${notificationHash(title || 'status')}`,
        type: 'live',
        title: isLive ? 'LIVE 진행 중' : 'LIVE 상태',
        body: isLive ? (title || '지금 SOOP에서 방송 중입니다.') : '현재 LIVE 상태가 아닙니다.',
        meta: formatNotificationDate(updatedAt),
        timestamp: updatedAt,
        action: isLive ? 'live-link' : null,
        href: 'https://www.sooplive.co.kr/station/beadyo97',
        attention: isLive,
    }];
}

function withCurrentLiveNotification(items) {
    if (!_liveStatusMemo.data) return items;
    return [...items.filter(item => item.type !== 'live'), ...liveNotificationItems(_liveStatusMemo.data)];
}

function applyLiveStatus(data) {
    document.getElementById('live-badge')?.classList.toggle('is-live', data.live);
    notificationState.items = withCurrentLiveNotification(notificationState.items);
    renderNotificationPanel();
}

function normalizeUpNotificationEvents(data) {
    return Array.isArray(data?.events) ? data.events : [];
}

async function loadUpNotificationItems() {
    const [eventsResult, cacheResult] = await Promise.allSettled([
        fetchSupabaseRest('up_events?select=*&is_active=eq.true&order=sort_order.asc', 4000),
        fetchRuntimeCache('up_ranking', 3500),
    ]);
    const activeRowsLoaded = eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value);
    const activeRows = activeRowsLoaded ? eventsResult.value : [];
    const cachedData = cacheResult.status === 'fulfilled' ? cacheResult.value : null;
    const cachedEvents = normalizeUpNotificationEvents(cachedData);
    const rankingMap = {};
    cachedEvents.forEach(event => {
        if (event?.id) rankingMap[event.id] = Array.isArray(event.ranking) ? event.ranking : [];
    });

    const sourceEvents = activeRowsLoaded ? activeRows : cachedEvents;
    return sourceEvents
        .filter(event => event && event.is_active !== false)
        .slice(0, 3)
        .map(event => {
            const ranking = rankingMap[event.id] || (Array.isArray(event.ranking) ? event.ranking : []);
            const title = String(event.title || event.tab_name || event.tab || 'UP 이벤트');
            return {
                id: `up:${event.id || notificationHash(title)}`,
                type: 'up',
                title,
                body: ranking.length
                    ? `현재 랭킹 ${ranking.length}명을 불러왔습니다.`
                    : '진행 중인 UP 이벤트가 있습니다.',
                meta: formatNotificationDate(event.live_updated_at || cachedData?.updated || cachedData?.row_updated_at || event.created_at),
                timestamp: event.live_updated_at || cachedData?.updated || cachedData?.row_updated_at || event.created_at || '',
                action: 'up-modal',
                payload: event,
                attention: true,
            };
        });
}

function updateNotificationBadges() {
    const count = notificationUnreadCount();
    document.querySelectorAll('[data-notification-count]').forEach(badge => {
        badge.hidden = count < 1;
        badge.textContent = count > 9 ? '9+' : String(count);
    });
    document.querySelectorAll('.notification-bell-btn').forEach(button => {
        button.classList.toggle('has-unread', count > 0);
        button.setAttribute('aria-label', count ? `알림함 열기, 읽지 않은 알림 ${count}개` : '알림함 열기');
    });
}

function renderNotificationPanel() {
    applyNotificationReadState();
    const list = document.getElementById('notification-list');
    const summary = document.getElementById('notification-summary');
    const filter = normalizeNotificationFilter(notificationState.filter);
    const unread = notificationUnreadCount();
    const total = notificationState.items.length;
    updateNotificationBadges();

    document.querySelectorAll('[data-notification-filter]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.notificationFilter === filter);
    });

    if (summary) {
        if (notificationState.loading && !total) {
            summary.textContent = '알림을 확인하는 중...';
        } else if (unread) {
            summary.textContent = `읽지 않은 알림 ${unread}개`;
        } else {
            summary.textContent = total ? '새 알림이 없습니다' : '표시할 알림이 없습니다';
        }
    }
    if (!list) return;

    if (notificationState.loading && !total) {
        list.innerHTML = '<div class="notification-empty">알림을 확인하는 중...</div>';
        return;
    }

    const visibleItems = sortNotificationItems(notificationState.items)
        .filter(item => filter === 'all' || item.type === filter);
    if (!visibleItems.length) {
        const message = notificationState.error
            ? '알림 일부를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : '이 필터에 표시할 알림이 없습니다.';
        list.innerHTML = `<div class="notification-empty">${escAttr(message)}</div>`;
        return;
    }

    list.innerHTML = visibleItems.map(item => `
        <button class="notification-item ${item.isRead ? 'is-read' : ''} ${item.attention === false ? 'is-passive' : ''}" type="button" data-notification-id="${escAttr(item.id)}" onclick="handleNotificationItemClick(this.dataset.notificationId)">
            <span class="notification-dot" aria-hidden="true"></span>
            <span class="notification-main">
                <span class="notification-item-head">
                    <span class="notification-kind ${escAttr(item.type)}">${escAttr(NOTIFICATION_TYPE_LABELS[item.type] || item.type)}</span>
                    <span class="notification-item-title">${escAttr(item.title)}</span>
                </span>
                <span class="notification-body">${escAttr(item.body || '')}</span>
            </span>
            <span class="notification-meta">${escAttr(item.meta || '')}</span>
        </button>
    `).join('');
}

async function refreshNotificationInbox(options = {}) {
    const force = options.force === true;
    if (notificationState.loading && notificationState.promise) return notificationState.promise;
    if (!force && notificationState.loadedAt && Date.now() - notificationState.loadedAt < NOTIFICATION_REFRESH_INTERVAL_MS) {
        // 다른 알림의 2분 캐시와 독립적으로 LIVE의 55초 유효기간을 확인한다.
        await fetchLiveStatus();
        notificationState.items = withCurrentLiveNotification(notificationState.items);
        renderNotificationPanel();
        return notificationState.items;
    }

    notificationState.loading = true;
    notificationState.error = '';
    renderNotificationPanel();
    notificationState.promise = (async () => {
        const results = await Promise.allSettled([
            loadPatchNotificationItems(),
            loadNoticeNotificationItems(),
            loadLiveNotificationItems(force),
            loadUpNotificationItems(),
        ]);
        const items = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                items.push(...result.value);
            } else if (result.status === 'rejected') {
                notificationState.error = result.reason?.message || '알림 로드 실패';
            }
        });
        // 다른 알림을 기다리는 동안 새 LIVE 조회가 끝났다면 최신 결과를 유지한다.
        notificationState.items = withCurrentLiveNotification(items);
        notificationState.loadedAt = Date.now();
        notificationState.loading = false;
        notificationState.promise = null;
        renderNotificationPanel();
        return notificationState.items;
    })().catch(error => {
        notificationState.error = error?.message || '알림 로드 실패';
        notificationState.loading = false;
        notificationState.promise = null;
        renderNotificationPanel();
        return notificationState.items;
    });
    return notificationState.promise;
}

function initNotificationInbox() {
    updateNotificationBadges();
    setTimeout(() => refreshNotificationInbox(), 350);
}

function openNotificationPanel() {
    closeAuthMenu();
    closeQuickMenu();
    const overlay = document.getElementById('notification-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    renderNotificationPanel();
    refreshNotificationInbox();
}

function closeNotificationPanel() {
    document.getElementById('notification-overlay')?.classList.remove('open');
}

function handleNotificationOverlayClick(event) {
    if (event.target === event.currentTarget) closeNotificationPanel();
}

function setNotificationFilter(filter) {
    notificationState.filter = normalizeNotificationFilter(filter);
    renderNotificationPanel();
}

function markNotificationRead(id) {
    const readIds = readNotificationIds();
    readIds.add(String(id));
    writeNotificationIds(readIds);
    applyNotificationReadState();
    renderNotificationPanel();
}

function markAllNotificationsRead() {
    const readIds = readNotificationIds();
    notificationState.items.forEach(item => {
        if (item.attention !== false) readIds.add(item.id);
    });
    writeNotificationIds(readIds);
    applyNotificationReadState();
    renderNotificationPanel();
}

function invokeCalendarFrameFunction(functionName, args = [], attempt = 0) {
    switchTab(0);
    const frame = document.getElementById('frame-0');
    const invoke = () => {
        try {
            const fn = frame?.contentWindow?.[functionName];
            if (typeof fn === 'function') {
                fn(...args);
                return true;
            }
        } catch {}
        return false;
    };
    if (invoke()) return;
    if (attempt < 24) {
        setTimeout(() => invokeCalendarFrameFunction(functionName, args, attempt + 1), 160);
    }
}

function handleNotificationItemClick(id) {
    const item = notificationState.items.find(entry => entry.id === id);
    if (!item) return;
    markNotificationRead(id);
    if (!item.action) return;

    closeNotificationPanel();
    if (item.action === 'patch-notes') {
        openPatchNotesModal();
    } else if (item.action === 'calendar-notice') {
        invokeCalendarFrameFunction('openNoticePopup', [item.payload, { ignoreHiddenToday: true }]);
    } else if (item.action === 'up-modal') {
        invokeCalendarFrameFunction('openUpModal');
    } else if (item.action === 'live-link' && item.href) {
        window.open(item.href, '_blank', 'noopener');
    }
}

function openCalendarAdmin() {
    if (!authDb || authServiceUnavailable) { openLoginModal(); return; }
    closeAuthMenu();
    switchTab(0);
    setTimeout(() => sendCalendarAction('open-admin'), 120);
}

function openDanceReviewPage() {
    closeAuthMenu();
    window.location.href = withFrameAssetVersion('dance-archive.html', 'no-playlists-20261010');
}

function openDevelopmentRequestsPage() {
    closeAuthMenu();
    window.location.href = withFrameAssetVersion('development-requests.html', 'editor-rpc-20260918');
}

function openPatchNotesModal() {
    closeAuthMenu();
    document.getElementById('patch-notes-overlay')?.classList.add('open');
}

function closePatchNotesModal() {
    document.getElementById('patch-notes-overlay')?.classList.remove('open');
}

function handlePatchNotesOverlayClick(event) {
    if (event.target === event.currentTarget) closePatchNotesModal();
}

async function updateAuthUI() {
    if (!authDb || authServiceUnavailable) { showAuthUnavailable(); return; }
    const badge = document.getElementById('auth-badge');
    if (!authUser) {
        badge.classList.remove('show');
        document.querySelectorAll('.login-btn').forEach(b => b.style.display = '');
        return;
    }

    const currentUser = authUser;
    const picture = safeImageUrl(currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '');
    const canAdmin = await isEditorUser(currentUser);
    if (authUser !== currentUser) return;
    badge.innerHTML = `<div class="auth-menu-wrap">
        <button class="auth-trigger" onclick="toggleAuthMenu(event)" aria-label="계정 메뉴">
            <img class="auth-avatar" src="${escAttr(picture || 'login-icon.png')}" alt=""
                referrerpolicy="no-referrer" decoding="async">
        </button>
        <div class="auth-menu" id="auth-menu">
            ${canAdmin ? `<button onclick="openCalendarAdmin()">⚙ 편집 설정</button>` : ''}
            <button onclick="openPatchNotesModal()">패치노트</button>
            <button onclick="openDanceReviewPage()">춤영상 검토페이지</button>
            <button onclick="openDevelopmentRequestsPage()">개발요청란</button>
            <button class="danger" onclick="signOut()">로그아웃</button>
        </div>
    </div>`;
    const avatar = badge.querySelector('.auth-avatar');
    avatar?.addEventListener('error', () => {
        if (avatar.dataset.fallbackApplied === 'true') {
            avatar.hidden = true;
            return;
        }
        avatar.dataset.fallbackApplied = 'true';
        avatar.src = 'login-icon.png';
    });
    document.querySelectorAll('.login-btn').forEach(b => b.style.display = 'none');
    badge.classList.add('show');
}

function deliverPendingLiveDate(frame = document.getElementById('frame-3')) {
    if (!pendingLiveDate || !isFrameReadyForMessage(frame)) return;
    frame.contentWindow.postMessage({ type: 'beadyo-focus-live-date', date: pendingLiveDate }, location.origin);
    pendingLiveDate = '';
}

function openLiveDate(date) {
    if (!window.BeadyoExploreData?.validDate(date)) return;
    pendingLiveDate = date;
    switchTab(3);
    deliverPendingLiveDate();
}

function openCalendarDate(date) {
    if (!window.BeadyoExploreData?.validDate(date)) return;
    invokeCalendarFrameFunction('openCalendarDate', [date]);
}

function switchTab(index, options = {}) {
    const { updateUrl = true, replaceUrl = false } = options;
    document.body.classList.toggle('home-view', index === HOME_TAB_INDEX);
    document.querySelector('.content').classList.toggle('external-sheet-view', index === 1);
    document.querySelectorAll('.tab').forEach((t, i) => {
        const active = Number(t.dataset.tabIndex ?? i) === index;
        t.classList.toggle('active', active);
        if (active) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
        if (active && window.matchMedia('(max-width: 640px)').matches) {
            t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    });
    const home = document.getElementById('frame-7');
    if (home) home.hidden = index !== HOME_TAB_INDEX;
    document.querySelectorAll('.sheet-frame').forEach((f, i) => f.classList.toggle('active', i === index));
    updateMusicSubnav(index);

    updateMobileFab(index);
    window.dispatchEvent(new CustomEvent('beadyo-tab-change', { detail: { index } }));
    if (updateUrl) syncTabUrl(index, replaceUrl);

    const frame = document.getElementById(`frame-${index}`);

    if (index === HOME_TAB_INDEX) {
        hideLoading(index);
        window.BeadyoHome?.activate();
        return;
    }

    if (loaded.has(index) && index !== 1) {
        hideLoading(index);
        if (index === 0 || index === 2 || index === 3 || index === 4 || index === CONTENT_TAB_INDEX) syncCalendarAuth();
        syncThemeToFrames();
        if (index === SONGBOOK_TAB_INDEX) deliverPendingSongbookSong(frame);
        if (index === 3) deliverPendingLiveDate(frame);
    } else {
        startFrameLoad(index);
    }
}

function switchMusicPage(page) {
    if (!MUSIC_PAGES[page]) return;
    currentMusicPage = page;
    updateMusicSubnav(MUSIC_TAB_INDEX);

    const frame = document.getElementById(`frame-${MUSIC_TAB_INDEX}`);
    const isMusicActive = frame?.classList.contains('active');
    cancelFrameLoad(MUSIC_TAB_INDEX);
    loaded.delete(MUSIC_TAB_INDEX);

    if (!isMusicActive) {
        switchTab(MUSIC_TAB_INDEX);
        return;
    }

    startFrameLoad(MUSIC_TAB_INDEX);
    syncTabUrl(MUSIC_TAB_INDEX);
}

// 첫 탭 초기 로드
updateGuideNewBadges();
applyTheme(currentTheme);

try {
    let initialTab = 0;
    currentMusicPage = routeToMusicPage() || 'songs';
    if (!MUSIC_PAGES[currentMusicPage]) currentMusicPage = 'songs';
    const routeTab = routeToTabIndex();
    if (routeTab !== null) {
        initialTab = routeTab;
    } else if (window.location.hash === '#songbook') {
        history.replaceState({}, document.title, window.location.pathname);
        initialTab = 2;
    }
    switchTab(initialTab, { replaceUrl: true });
} catch {
    switchTab(0, { replaceUrl: true });
}

function handleTabRouteChange() {
    const musicPage = routeToMusicPage();
    if (musicPage && musicPage !== currentMusicPage) {
        switchMusicPage(musicPage);
        return;
    }
    const routeTab = routeToTabIndex();
    if (routeTab !== null && !document.getElementById(`frame-${routeTab}`)?.classList.contains('active')) {
        switchTab(routeTab, { updateUrl: false });
    }
}
window.addEventListener('hashchange', handleTabRouteChange);
window.addEventListener('popstate', handleTabRouteChange);

window.addEventListener('storage', event => {
    if (event.key === THEME_STORAGE_KEY) {
        applyTheme(event.newValue, { broadcast: true });
    } else if (event.key === PWA_GUIDE_SEEN_STORAGE_KEY) {
        updateGuideNewBadges();
    } else if (event.key === NOTIFICATION_READ_STORAGE_KEY) {
        applyNotificationReadState();
        renderNotificationPanel();
    }
});

initNotificationInbox();

// ── 라이브 상태 체크 ──
const PROXY = 'https://clever-rhino-36.hanul4269.deno.net';
const SOOP_STATION_API = 'https://chapi.sooplive.co.kr/api/beadyo97/station';

// fetchWithTimeout bounds response headers; body parsing needs its own deadline.
async function readLiveStatusJson(response, ms = 4000) {
    let timer;
    try {
        return await Promise.race([
            response.json(),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('LIVE body timeout')), ms);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

// 라이브 상태 단일 진입점. 헤더 배지와 알림 패널이 같은 값을 쓰도록 한 곳에서 조회한다.
// 순서: SOOP 직접 호출 → Deno 프록시 → Supabase 캐시(최후 수단)
let _liveStatusMemo = { at: 0, data: null };
let _liveStatusPromise = null;
async function fetchLiveStatus({ force = false } = {}) {
    // 강제 조회도 이미 진행 중인 요청에 합류하여 오래된 응답의 덮어쓰기를 막는다.
    if (_liveStatusPromise) return _liveStatusPromise;
    if (!force && _liveStatusMemo.data && Date.now() - _liveStatusMemo.at < 55000) return _liveStatusMemo.data;
    _liveStatusPromise = fetchLiveStatusFresh().then(data => {
        if (data) {
            _liveStatusMemo = { at: Date.now(), data };
            applyLiveStatus(data);
        }
        return data;
    }).finally(() => {
        _liveStatusPromise = null;
    });
    return _liveStatusPromise;
}

async function fetchLiveStatusFresh() {
    const fromStation = d => {
        // 정상 OFF 응답은 station 정보와 명시적인 broad: null을 포함한다.
        // 오류 JSON이나 누락된 broad를 방송 종료로 간주하지 않는다.
        if (!d || d.station?.user_id !== 'beadyo97' ||
            !Object.prototype.hasOwnProperty.call(d, 'broad')) return null;
        const broad = d.broad;
        if (broad !== null && (typeof broad !== 'object' || Array.isArray(broad) ||
            !/^[1-9]\d*$/.test(String(broad.broad_no)) ||
            typeof broad.broad_title !== 'string')) return null;
        return {
            live: broad !== null,
            title: broad ? broad.broad_title.trim() : '',
            broad_no: broad ? String(broad.broad_no) : null,
            updated: new Date().toISOString(),
        };
    };

    for (const url of [SOOP_STATION_API, `${PROXY}?url=${encodeURIComponent(SOOP_STATION_API)}`]) {
        try {
            const res = await fetchWithTimeout(url, 4000);
            if (!res.ok) continue;
            const data = fromStation(await readLiveStatusJson(res));
            if (!data) continue;
            return data;
        } catch {}
    }

    try {
        const cached = await fetchRuntimeCache('live_status');
        if (cached && typeof cached.live === 'boolean' && isFreshRuntimeCache(cached, 30 * 60 * 1000)) {
            return cached;
        }
    } catch {}

    return null;
}

async function fetchRuntimeCache(cacheKey, ms = 4000) {
    const url = `${SUPABASE_URL}/rest/v1/site_runtime_cache?select=payload,updated_at&cache_key=eq.${encodeURIComponent(cacheKey)}&limit=1`;
    const res = await fetchWithTimeout(url, ms, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!res.ok) throw new Error(`runtime cache HTTP ${res.status}`);
    const rows = await readLiveStatusJson(res, ms);
    const row = Array.isArray(rows) ? rows[0] : null;
    return row?.payload ? { ...row.payload, row_updated_at: row.updated_at } : null;
}

function isFreshRuntimeCache(data, maxAgeMs) {
    const updatedAt = Date.parse(data?.updated || data?.row_updated_at || '');
    const age = Date.now() - updatedAt;
    return Number.isFinite(updatedAt) && age >= 0 && age < maxAgeMs;
}

function checkLiveStatus(force = false) {
    return fetchLiveStatus({ force });
}

checkLiveStatus(true);
setTimeout(checkLiveStatus, 3000);
setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    return checkLiveStatus(true);
}, 60 * 1000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLiveStatus(true);
});

// ── 로그인 모달 ──
let loginLastFocused = null;
function openLoginModal() {
    const overlay = document.getElementById('login-overlay');
    if (overlay.classList.contains('open')) return;
    loginLastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.querySelector('button:not([disabled])')?.focus();
}

function closeLoginModal() {
    document.getElementById('login-overlay').classList.remove('open');
    const focusTarget = loginLastFocused?.closest('#quick-menu-panel')
        ? document.getElementById('quick-menu-toggle') : loginLastFocused;
    if (focusTarget?.isConnected) focusTarget.focus();
    loginLastFocused = null;
}

document.addEventListener('keydown', event => {
    const overlay = document.getElementById('login-overlay');
    if (!overlay?.classList.contains('open')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeLoginModal();
    } else if (event.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button:not([disabled])')];
        const first = buttons[0], last = buttons.at(-1);
        if (!first) return;
        const outside = !overlay.contains(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || outside)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || outside)) {
            event.preventDefault(); first.focus();
        }
    }
});

function handleLoginOverlayClick(e) {
    if (e.target === document.getElementById('login-overlay')) closeLoginModal();
}

// ── 이용가이드 모달 ──
function openGuideModal() {
    const overlay = document.getElementById('guide-overlay');
    const frame = document.getElementById('guide-frame');
    if (frame && !frame.getAttribute('src')) {
        frame.dataset.messageReady = 'false';
        frame.onload = () => {
            frame.dataset.messageReady = 'true';
            syncThemeToFrames(frame);
        };
        frame.src = withFrameAssetVersion('guide.html');
    }
    markPwaGuideSeen();
    if (!overlay) return;
    overlay.classList.add('open');
    closeQuickMenu();
}

function closeGuideModal() {
    document.getElementById('guide-overlay')?.classList.remove('open');
}

function handleGuideOverlayClick(e) {
    if (e.target === document.getElementById('guide-overlay')) closeGuideModal();
}

// ── 퀵메뉴 ──
function toggleQuickMenu() {
    const panel = document.getElementById('quick-menu-panel');
    const overlay = document.getElementById('quick-menu-overlay');
    const headerH = document.querySelector('.header').offsetHeight;
    panel.style.top = headerH + 'px';
    panel.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeQuickMenu() {
    document.getElementById('quick-menu-panel').classList.remove('open');
    document.getElementById('quick-menu-overlay').classList.remove('open');
}

function viewDesktop() {
    document.querySelector('meta[name=viewport]').content = 'width=1200';
    closeQuickMenu();
    document.getElementById('mobile-restore-btn').style.display = '';
    document.getElementById('mobile-fab').classList.remove('show');
}

function viewMobile() {
    location.reload();
}

async function initAuth() {
    if (!authDb || authServiceUnavailable) { showAuthUnavailable(); return; }
    authDb.auth.onAuthStateChange((_event, session) => {
        authUser = session?.user ?? null;
        updateAuthUI();
        syncCalendarAuth();
    });

    // Implicit flow: #access_token= 해시 처리
    const hash = window.location.hash.substring(1);
    if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') || '';
        if (accessToken) {
            history.replaceState({}, document.title, window.location.pathname);
            const { data, error } = await authDb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) {
                console.error('setSession error:', error.message, error);
            } else if (data.session) {
                authUser = data.session.user ?? null;
                updateAuthUI();
                syncCalendarAuth();
                return;
            }
        }
    }

    // PKCE flow: ?code= 쿼리 처리
    const currentUrl = new URL(window.location.href);
    const authError = currentUrl.searchParams.get('error_description') || currentUrl.searchParams.get('error');
    if (authError) {
        currentUrl.searchParams.delete('error');
        currentUrl.searchParams.delete('error_code');
        currentUrl.searchParams.delete('error_description');
        history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search);
        alert('로그인 실패: ' + authError);
    }
    const authCode = currentUrl.searchParams.get('code');
    if (authCode) {
        currentUrl.searchParams.delete('code');
        currentUrl.searchParams.delete('state');
        history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search);
        const { data, error } = await authDb.auth.exchangeCodeForSession(authCode);
        if (error) {
            console.error('exchangeCodeForSession error:', error.message, error);
        } else if (data.session) {
            authUser = data.session.user ?? null;
            updateAuthUI();
            syncCalendarAuth();
            return;
        }
    }

    const { data: { session } = {}, error } = await authDb.auth.getSession();
    if (error && isJwtIssuedAtFutureError(error)) {
        console.warn('세션 시각 확인이 지연되고 있습니다. 저장된 로그인 정보는 유지합니다.');
        return;
    }
    authUser = session?.user ?? null;
    updateAuthUI();
    syncCalendarAuth();
}

function authRedirectTo() {
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (localHosts.has(location.hostname)) return `${location.protocol}//${location.host}/`;
    return 'https://beadyo.com/';
}

async function signIn() {
    if (location.protocol === 'file:') {
        alert('파일로 직접 열면 로그인이 안 돼요.\n터미널에서 아래 명령어로 로컬 서버를 실행해주세요:\n\npython3 -m http.server 3000\n\n그 다음 http://localhost:3000 에서 접속하면 로그인 가능해요.');
        return;
    }
    if (!authDb || authServiceUnavailable) { openLoginModal(); return; }
    const { data, error } = await authDb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: authRedirectTo(),
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
        },
    });
    if (error) alert('로그인 실패: ' + error.message);
    else if (data?.url) window.location.assign(data.url);
    else alert('로그인 주소를 만들지 못했어요. 새로고침 후 다시 시도해주세요.');
}

async function signOut() {
    if (!authDb || authServiceUnavailable) { openLoginModal(); return; }
    closeAuthMenu();
    await authDb.auth.signOut();
    authUser = null;
    updateAuthUI();
    syncCalendarAuth();
}

initAuth().catch(error => {
    console.error('로그인 서비스 초기화 실패:', error);
    showAuthUnavailable();
});
