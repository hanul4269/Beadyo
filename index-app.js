const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
const OWNER_EMAIL = 'riosniper12@gmail.com';

const TABS = [
    { type: 'calendar', src: 'calendar.html', directUrl: 'calendar.html' },
    { type: 'schedule', id: '1vXzzx7UibAcUwM26Lp2InUnhNkITLd7-JkqB4g_FudM' },
    { type: 'songbook', src: 'songbook.html?view=songbook&v=design-20260604', directUrl: 'songbook.html?view=songbook' },
    { type: 'songbook', src: 'songbook.html?view=live&v=design-20260604', directUrl: 'songbook.html?view=live' },
    { type: 'songs', src: 'songs.html?v=design-20260604', directUrl: 'songs.html' },
    { type: 'games', src: 'games.html?v=games-official-20260609', directUrl: 'games.html' },
];

const GAME_TAB_INDEX = 5;
const TAB_ROUTES = ['calendar', 'schedule', 'songbook', 'live', 'music', 'games'];

function routeToTabIndex() {
    const params = new URLSearchParams(window.location.search);
    const queryTab = (params.get('tab') || '').toLowerCase();
    if (queryTab === 'game') return GAME_TAB_INDEX;
    if (queryTab === 'songs') return 4;
    const queryIndex = TAB_ROUTES.indexOf(queryTab);
    if (queryIndex >= 0) return queryIndex;

    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (hash === 'game-preview') return GAME_TAB_INDEX;
    if (hash === 'songs') return 4;
    const hashIndex = TAB_ROUTES.indexOf(hash);
    if (hashIndex >= 0) return hashIndex;

    return null;
}

function syncTabUrl(index, replace = false) {
    const route = TAB_ROUTES[index];
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
    auth: { detectSessionInUrl: false }
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
    const tab = TABS[index];
    if (tab.type === 'calendar' || tab.type === 'songs' || tab.type === 'songbook' || tab.type === 'games') return tab.src;
    if (tab.type === 'schedule') return scheduleUrl(tab);
    if (tab.alwaysEdit) return editUrl(tab);
    return readOnlyUrl(tab);
}

function getSheetDirectUrl(index) {
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
            hideLoading(index);
            if (index === 0 || index === 2 || index === 3 || index === 4) syncCalendarAuth();
        };
        frame.src = getFrameUrl(index);
        loaded.add(index);
    }
}

// 첫 탭 초기 로드
try {
    let initialTab = 0;
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

async function checkLiveStatus() {
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

checkLiveStatus();
setTimeout(checkLiveStatus, 3000);
setInterval(checkLiveStatus, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLiveStatus();
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
    if (frame && !frame.src) frame.src = 'guide.html?v=games-preview-hidefix-20260606';
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

async function signIn() {
    if (location.protocol === 'file:') {
        alert('파일로 직접 열면 로그인이 안 돼요.\n터미널에서 아래 명령어로 로컬 서버를 실행해주세요:\n\npython3 -m http.server 3000\n\n그 다음 http://localhost:3000 에서 접속하면 로그인 가능해요.');
        return;
    }
    const redirectTo = `${location.protocol}//${location.host}/`;
    const { error } = await authDb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    });
    if (error) alert('로그인 실패: ' + error.message);
}

async function signOut() {
    closeAuthMenu();
    await authDb.auth.signOut();
    authUser = null;
    updateAuthUI();
    syncCalendarAuth();
}

initAuth();
