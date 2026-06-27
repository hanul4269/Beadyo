const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
const OWNER_EMAIL = 'riosniper12@gmail.com';
const FALLBACK_ASSET_VERSION = 'gacha-wall-hit-20260614';
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

function withFrameAssetVersion(src, assetVersion = APP_ASSET_VERSION) {
    if (!src || /^https?:\/\//i.test(src)) return src;
    const url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin) return src;
    url.searchParams.set('v', IS_LOCAL_HOST ? FRAME_ASSET_VERSION : assetVersion);
    return `${url.pathname.replace(/^\//, '')}${url.search}${url.hash}`;
}

const TABS = [
    { type: 'calendar', src: 'calendar.html', directUrl: 'calendar.html' },
    { type: 'schedule', id: '1vXzzx7UibAcUwM26Lp2InUnhNkITLd7-JkqB4g_FudM' },
    { type: 'songbook', src: 'songbook.html?view=songbook', directUrl: 'songbook.html?view=songbook', assetVersion: 'gacha-wall-hit-20260614' },
    { type: 'songbook', src: 'songbook.html?view=live', directUrl: 'songbook.html?view=live', assetVersion: 'gacha-wall-hit-20260614' },
    { type: 'songs', src: 'songs.html', directUrl: 'songs.html', assetVersion: 'gembox-subnav-20260628' },
    { type: 'games', src: 'games.html', directUrl: 'games.html', assetVersion: 'gacha-wall-hit-20260614' },
];

const GAME_TAB_INDEX = 5;
const TAB_ROUTES = ['calendar', 'schedule', 'songbook', 'live', 'music', 'games'];
const MUSIC_TAB_INDEX = 4;
const MUSIC_PAGES = {
    songs: { src: 'songs.html', directUrl: 'songs.html', assetVersion: 'gembox-subnav-20260628' },
    gembox: { src: 'gembox.html', directUrl: 'gembox.html', assetVersion: 'gembox-subnav-20260628' },
};
let currentMusicPage = 'songs';

function routeToMusicPage() {
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    const route = queryTab || hash;
    if (route === 'gembox' || route === 'jewelbox') return 'gembox';
    if (route === 'music' || route === 'songs') return 'songs';
    return null;
}

function routeToTabIndex() {
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    if (queryTab === 'game') return GAME_TAB_INDEX;
    if (queryTab === 'songs' || queryTab === 'music' || queryTab === 'gembox' || queryTab === 'jewelbox') return MUSIC_TAB_INDEX;
    const queryIndex = TAB_ROUTES.indexOf(queryTab);
    if (queryIndex >= 0) return queryIndex;

    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (hash === 'game-preview') return GAME_TAB_INDEX;
    if (hash === 'songs' || hash === 'music' || hash === 'gembox' || hash === 'jewelbox') return MUSIC_TAB_INDEX;
    const hashIndex = TAB_ROUTES.indexOf(hash);
    if (hashIndex >= 0) return hashIndex;

    return null;
}

function syncTabUrl(index, replace = false) {
    const route = index === MUSIC_TAB_INDEX && currentMusicPage === 'gembox' ? 'gembox' : TAB_ROUTES[index];
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
    }
});
let authUser = null;

async function isEditorUser(user) {
    if (!user) return false;
    const email = (user.email || '').toLowerCase();
    if (email === OWNER_EMAIL.toLowerCase()) return true;
    try {
        const { data } = await authDb.from('editors').select('email').eq('email', email).maybeSingle();
        return !!data;
    } catch { return false; }
}

const isMobile = window.matchMedia('(max-width: 640px)').matches;

function getFrameUrl(index) {
    if (index === MUSIC_TAB_INDEX) {
        const musicPage = MUSIC_PAGES[currentMusicPage] || MUSIC_PAGES.songs;
        return withFrameAssetVersion(musicPage.src, musicPage.assetVersion);
    }
    const tab = TABS[index];
    if (tab.type === 'calendar' || tab.type === 'songs' || tab.type === 'songbook' || tab.type === 'games') {
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
    if (tab.type === 'calendar' || tab.type === 'songs' || tab.type === 'songbook' || tab.type === 'games') return tab.directUrl;
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
    if (!isMobile) return;
    const type = TABS[index]?.type;
    if (type === 'calendar' || type === 'songs' || type === 'songbook' || type === 'games') {
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

function syncCalendarAuth() {
    const origin = window.location.origin === 'null' ? '*' : window.location.origin;
    const msg = { type: 'beadyo-auth-sync', user: getSerializableAuthUser() };
    for (const id of ['frame-0', 'frame-2', 'frame-3', 'frame-4']) {
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

function openCalendarAdmin() {
    closeAuthMenu();
    switchTab(0);
    setTimeout(() => sendCalendarAction('open-admin'), 120);
}

async function updateAuthUI() {
    const badge = document.getElementById('auth-badge');
    if (!authUser) {
        badge.classList.remove('show');
        document.querySelectorAll('.login-btn').forEach(b => b.style.display = '');
        return;
    }

    const picture = safeImageUrl(authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '');
    const canAdmin = await isEditorUser(authUser);
    badge.innerHTML = `<div class="auth-menu-wrap">
        <button class="auth-trigger" onclick="toggleAuthMenu(event)" aria-label="계정 메뉴">
            ${picture ? `<img src="${escAttr(picture)}" alt="">` : `<img src="login-icon.png" alt="">`}
        </button>
        <div class="auth-menu" id="auth-menu">
            ${canAdmin ? `<button onclick="openCalendarAdmin()">⚙ 편집 설정</button>` : ''}
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
    try { localStorage.setItem('activeTab', index); } catch {}
    if (updateUrl) syncTabUrl(index, replaceUrl);

    const frame = document.getElementById(`frame-${index}`);

    if (loaded.has(index) && index !== 1) {
        hideLoading(index);
        if (index === 0 || index === 2 || index === 3 || index === 4) syncCalendarAuth();
    } else {
        document.getElementById('loading').style.display = 'flex';
        frame.onload = () => {
            resetFrameScrollAfterLoad(index);
            hideLoading(index);
            if (index === 0 || index === 2 || index === 3 || index === 4) syncCalendarAuth();
        };
        frame.src = getFrameUrl(index);
        loaded.add(index);
    }
}

function switchMusicPage(page) {
    if (!MUSIC_PAGES[page]) return;
    currentMusicPage = page;
    try { localStorage.setItem('musicSubpage', page); } catch {}
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
    };
    frame.src = getFrameUrl(MUSIC_TAB_INDEX);
    loaded.add(MUSIC_TAB_INDEX);
    syncTabUrl(MUSIC_TAB_INDEX);
}

// 첫 탭 초기 로드
try {
    let initialTab = 0;
    currentMusicPage = routeToMusicPage() || localStorage.getItem('musicSubpage') || 'songs';
    if (!MUSIC_PAGES[currentMusicPage]) currentMusicPage = 'songs';
    const routeTab = routeToTabIndex();
    if (routeTab !== null) {
        initialTab = routeTab;
    } else if (window.location.hash === '#songbook') {
        history.replaceState({}, document.title, window.location.pathname);
        initialTab = 2;
    } else {
        const saved = parseInt(localStorage.getItem('activeTab'));
        if (Number.isFinite(saved) && saved >= 0 && saved < TABS.length) {
            initialTab = saved;
        }
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

// ── 라이브 상태 체크 ──
const PROXY = 'https://clever-rhino-36.hanul4269.deno.net';

async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        return res;
    } catch (e) {
        clearTimeout(tid);
        throw e;
    }
}

let _lastLiveStatusCheckAt = 0;
async function checkLiveStatus(force = false) {
    const now = Date.now();
    if (!force && now - _lastLiveStatusCheckAt < 20000) return;
    _lastLiveStatusCheckAt = now;
    const badge = document.getElementById('live-badge');

    // 1) 실시간: SOOP chapi API 직접 호출 (Deno 프록시 경유)
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

    // 2) 폴백: live.json
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
setInterval(checkLiveStatus, 10 * 60 * 1000);
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
    try { localStorage.setItem('desktopView', '1'); } catch {}
    closeQuickMenu();
    document.getElementById('mobile-restore-btn').style.display = '';
    document.getElementById('mobile-fab').classList.remove('show');
}

function viewMobile() {
    try { localStorage.removeItem('desktopView'); } catch {}
    location.reload();
}

try {
    if (localStorage.getItem('desktopView') === '1') {
        document.querySelector('meta[name=viewport]').content = 'width=1200';
        document.getElementById('mobile-restore-btn').style.display = '';
    }
} catch {}

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

    const { data: { session } } = await authDb.auth.getSession();
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
