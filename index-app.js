const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
const OWNER_EMAIL = 'riosniper12@gmail.com';
const FALLBACK_ASSET_VERSION = 'development-request-comments-20260902';
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
    return `${url.pathname.replace(/^\//, '')}${url.search}${url.hash}`;
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

function syncThemeToFrames() {
    const origin = window.location.origin === 'null' ? '*' : window.location.origin;
    const msg = { type: 'beadyo-theme-sync', theme: currentTheme };
    for (const id of ['frame-0', 'frame-2', 'frame-3', 'frame-4', 'frame-5', 'frame-6', 'guide-frame']) {
        const frame = document.getElementById(id);
        if (frame?.contentWindow) frame.contentWindow.postMessage(msg, origin);
    }
}

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
    { type: 'calendar', src: 'calendar.html', directUrl: 'calendar.html', assetVersion: 'responsive-calendar-20260903' },
    { type: 'schedule', id: '1vXzzx7UibAcUwM26Lp2InUnhNkITLd7-JkqB4g_FudM' },
    { type: 'songbook', src: 'songbook.html?view=songbook', directUrl: 'songbook.html?view=songbook', assetVersion: 'auth-session-clock-skew-20260828' },
    { type: 'songbook', src: 'songbook.html?view=live', directUrl: 'songbook.html?view=live', assetVersion: 'auth-session-clock-skew-20260828' },
    { type: 'songs', src: 'songs.html', directUrl: 'songs.html', assetVersion: 'music-dark-mode-20260822' },
    { type: 'content', src: 'content.html', directUrl: 'content.html', assetVersion: 'content-archive-20260902-5' },
    { type: 'games', src: 'games.html', directUrl: 'games.html', assetVersion: 'gacha-wall-hit-20260614' },
];

const CONTENT_TAB_INDEX = 5;
const GAME_TAB_INDEX = 6;
const TAB_ROUTES = ['calendar', 'schedule', 'songbook', 'live', 'music', 'content', 'games'];
const MUSIC_TAB_INDEX = 4;
const MUSIC_PAGES = {
    songs: { src: 'songs.html', directUrl: 'songs.html', assetVersion: 'music-dark-mode-20260822' },
    dance: { src: 'dance.html', directUrl: 'dance.html', assetVersion: 'music-dark-mode-20260822' },
    gembox: { src: 'gembox.html', directUrl: 'gembox.html', assetVersion: 'music-dark-mode-20260822' },
    tractor: { src: 'tractor-service.html', directUrl: 'tractor-service.html', assetVersion: 'music-dark-mode-20260822' },
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
    const route = index === MUSIC_TAB_INDEX
        ? (currentMusicPage === 'songs' ? 'music' : currentMusicPage)
        : TAB_ROUTES[index];
    if (!route) return;
    const nextUrl = `${window.location.pathname}${window.location.search}#${route}`;
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
const authDb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        detectSessionInUrl: false,
        flowType: 'pkce',
    },
    global: { fetch: fetchWithJwtFutureRetry },
});
let authUser = null;

function beadyoAllowedMessageOrigin(origin) {
    return origin === window.location.origin || [
        'https://beadyo.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ].includes(origin);
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
    if (!user) return false;
    const email = (user.email || '').toLowerCase();
    if (email === OWNER_EMAIL.toLowerCase()) return true;
    try {
        const { data, error } = await authDb.from('editors').select('email').eq('email', email).maybeSingle();
        if (error) {
            if (isJwtIssuedAtFutureError(error)) {
                console.warn('편집 권한 확인이 지연되고 있지만 로그인 상태는 유지합니다.');
            }
            return false;
        }
        return !!data;
    } catch { return false; }
}

const mobileLayoutQuery = window.matchMedia('(max-width: 768px)');

function getFrameUrl(index) {
    if (index === MUSIC_TAB_INDEX) {
        const musicPage = MUSIC_PAGES[currentMusicPage] || MUSIC_PAGES.songs;
        return withFrameAssetVersion(musicPage.src, musicPage.assetVersion);
    }
    const tab = TABS[index];
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
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
    const frame = document.getElementById(`frame-${index}`);
    if (frame) requestAnimationFrame(() => frame.classList.add('loaded'));
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
    if (!mobileLayoutQuery.matches) {
        fab.classList.remove('show');
        return;
    }
    const type = TABS[index]?.type;
    if (type === 'calendar' || type === 'songs' || type === 'songbook' || type === 'content' || type === 'games') {
        fab.classList.remove('show');
        return;
    }
    fab.classList.add('show');
    fab.href = getSheetDirectUrl(index);
}

function handleMobileLayoutChange() {
    const activeIndex = [...document.querySelectorAll('.tab')]
        .findIndex(tab => tab.classList.contains('active'));
    updateMobileFab(activeIndex < 0 ? 0 : activeIndex);
}

if (typeof mobileLayoutQuery.addEventListener === 'function') {
    mobileLayoutQuery.addEventListener('change', handleMobileLayoutChange);
} else {
    mobileLayoutQuery.addListener(handleMobileLayoutChange);
}

function getSerializableAuthUser(user = authUser) {
    if (!user) return null;
    return {
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
        picture: safeImageUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || ''),
    };
}

function syncCalendarAuth() {
    const origin = window.location.origin === 'null' ? '*' : window.location.origin;
    const msg = { type: 'beadyo-auth-sync', user: getSerializableAuthUser() };
    for (const id of ['frame-0', 'frame-2', 'frame-3', 'frame-4', 'frame-5']) {
        const frame = document.getElementById(id);
        if (frame?.contentWindow) frame.contentWindow.postMessage(msg, origin);
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

function safeImageUrl(value) {
    try {
        const u = new URL(String(value || '').trim());
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {}
    return '';
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

async function loadLiveNotificationItems() {
    const data = await fetchRuntimeCache('live_status', 3500);
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
            loadLiveNotificationItems(),
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
        notificationState.items = items;
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
    closeAuthMenu();
    switchTab(0);
    setTimeout(() => sendCalendarAction('open-admin'), 120);
}

function openDanceReviewPage() {
    closeAuthMenu();
    window.location.href = withFrameAssetVersion('dance-archive.html', 'dance-nav-20260628');
}

function openDevelopmentRequestsPage() {
    closeAuthMenu();
    window.location.href = withFrameAssetVersion('development-requests.html', 'development-request-comments-20260902');
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
            ${picture ? `<img src="${escAttr(picture)}" alt="">` : `<img src="login-icon.png" alt="">`}
        </button>
        <div class="auth-menu" id="auth-menu">
            ${canAdmin ? `<button onclick="openCalendarAdmin()">⚙ 편집 설정</button>` : ''}
            <button onclick="openPatchNotesModal()">패치노트</button>
            <button onclick="openDanceReviewPage()">춤영상 검토페이지</button>
            <button onclick="openDevelopmentRequestsPage()">개발요청란</button>
            <button class="danger" onclick="signOut()">로그아웃</button>
        </div>
    </div>`;
    document.querySelectorAll('.login-btn').forEach(b => b.style.display = 'none');
    badge.classList.add('show');
}

function switchTab(index, options = {}) {
    const { updateUrl = true, replaceUrl = false } = options;
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === index));
    document.querySelectorAll('.sheet-frame').forEach((f, i) => f.classList.toggle('active', i === index));
    updateMusicSubnav(index);

    updateMobileFab(index);
    if (updateUrl) syncTabUrl(index, replaceUrl);

    const frame = document.getElementById(`frame-${index}`);

    if (loaded.has(index) && index !== 1) {
        hideLoading(index);
        if (index === 0 || index === 2 || index === 3 || index === 4 || index === CONTENT_TAB_INDEX) syncCalendarAuth();
        syncThemeToFrames();
    } else {
        document.getElementById('loading').style.display = 'flex';
        frame.onload = () => {
            resetFrameScrollAfterLoad(index);
            hideLoading(index);
            if (index === 0 || index === 2 || index === 3 || index === 4 || index === CONTENT_TAB_INDEX) syncCalendarAuth();
            syncThemeToFrames();
        };
        frame.src = getFrameUrl(index);
        loaded.add(index);
    }
}

function switchMusicPage(page) {
    if (!MUSIC_PAGES[page]) return;
    currentMusicPage = page;
    updateMusicSubnav(MUSIC_TAB_INDEX);

    const frame = document.getElementById(`frame-${MUSIC_TAB_INDEX}`);
    const isMusicActive = frame?.classList.contains('active');
    loaded.delete(MUSIC_TAB_INDEX);

    if (!isMusicActive) {
        switchTab(MUSIC_TAB_INDEX);
        return;
    }

    document.getElementById('loading').style.display = 'flex';
    frame.onload = () => {
        resetFrameScrollAfterLoad(MUSIC_TAB_INDEX);
        hideLoading(MUSIC_TAB_INDEX);
        syncCalendarAuth();
        syncThemeToFrames();
    };
    frame.src = getFrameUrl(MUSIC_TAB_INDEX);
    loaded.add(MUSIC_TAB_INDEX);
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

window.addEventListener('hashchange', () => {
    const musicPage = routeToMusicPage();
    if (musicPage && musicPage !== currentMusicPage) {
        switchMusicPage(musicPage);
        return;
    }
    const routeTab = routeToTabIndex();
    if (routeTab !== null) switchTab(routeTab, { updateUrl: false });
});

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

async function fetchWithTimeout(url, ms, options = {}) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(tid);
        return res;
    } catch (e) {
        clearTimeout(tid);
        throw e;
    }
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
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return row?.payload ? { ...row.payload, row_updated_at: row.updated_at } : null;
}

function isFreshRuntimeCache(data, maxAgeMs) {
    const updatedAt = Date.parse(data?.updated || data?.row_updated_at || '');
    return Number.isFinite(updatedAt) && Date.now() - updatedAt < maxAgeMs;
}

let _lastLiveStatusCheckAt = 0;
async function checkLiveStatus(force = false) {
    const now = Date.now();
    if (!force && now - _lastLiveStatusCheckAt < 55000) return;
    _lastLiveStatusCheckAt = now;
    const badge = document.getElementById('live-badge');
    if (!badge) return;

    // 1) Supabase 런타임 캐시: GitHub Actions가 5분마다 갱신
    try {
        const data = await fetchRuntimeCache('live_status');
        if (data && typeof data.live !== 'undefined' && isFreshRuntimeCache(data, 15 * 60 * 1000)) {
            badge.classList.toggle('is-live', !!data.live);
            return;
        }
    } catch {}

    // 2) Supabase 캐시가 없거나 오래되면 SOOP chapi API 직접 호출 (Deno 프록시 경유)
    try {
        const res = await fetchWithTimeout(
            `${PROXY}?url=${encodeURIComponent('https://chapi.sooplive.co.kr/api/beadyo97/station')}`,
            4000
        );
        if (res.ok) {
            const d = await res.json();
            const broad = d?.broad;
            badge.classList.toggle('is-live', !!(broad?.broad_no));
            return;
        }
    } catch {}

    // 3) 기존 JSON fallback
    for (const url of ['live.json?t=' + Date.now(), 'https://beadyo.com/live.json?t=' + Date.now()]) {
        try {
            const res = await fetchWithTimeout(url, 5000);
            if (!res.ok) continue;
            const data = await res.json();
            badge.classList.toggle('is-live', !!data.live);
            return;
        } catch {}
    }
}

checkLiveStatus(true);
setTimeout(checkLiveStatus, 3000);
setInterval(checkLiveStatus, 60 * 1000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLiveStatus(true);
});

// ── 로그인 모달 ──
function openLoginModal() {
    document.getElementById('login-overlay').classList.add('open');
}

function closeLoginModal() {
    document.getElementById('login-overlay').classList.remove('open');
}

function handleLoginOverlayClick(e) {
    if (e.target === document.getElementById('login-overlay')) closeLoginModal();
}

// ── 이용가이드 모달 ──
function openGuideModal() {
    const overlay = document.getElementById('guide-overlay');
    const frame = document.getElementById('guide-frame');
    if (frame && !frame.src) frame.src = withFrameAssetVersion('guide.html');
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
    closeAuthMenu();
    await authDb.auth.signOut();
    authUser = null;
    updateAuthUI();
    syncCalendarAuth();
}

initAuth();
