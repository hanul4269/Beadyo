const SUPABASE_URL      = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
const OWNER_EMAIL       = 'riosniper12@gmail.com';

const EVENT_TYPES = [
    { key: 'chat',    label: '소통',        icon: '☘', color: '#c8f5bc', text: '#2e6e22', border: '#8fd878' },
    { key: 'song',    label: '노래',        icon: '♪',  color: '#ffd0b8', text: '#a03a15', border: '#f5a07a' },
    { key: 'solo',    label: '슬요 컨텐츠', icon: '✦', color: '#ffe7bf', text: '#a76016', border: '#f1bd73' },
    { key: 'collab',  label: '참여 컨텐츠', icon: '＋', color: '#bff5ee', text: '#1a7a6e', border: '#7dddd6' },
    { key: 'watch',   label: '같이 보기',   icon: '▶', color: '#eadcff', text: '#6b4aa0', border: '#cdb7ef' },
    { key: 'game',    label: '게임',        icon: '◆', color: '#cdf6df', text: '#28724b', border: '#97d9b5' },
    { key: 'ad',      label: '광고',        icon: 'AD', color: '#fff3b8', text: '#9a7914', border: '#ecd46a' },
    { key: 'rest',    label: '휴방',        icon: 'Zz', color: '#ffd9e3', text: '#e14b67', border: '#f3a8b8' },
    { key: 'cover',   label: '커버곡',      icon: '♬', color: '#d8f1d0', text: '#3d7634', border: '#acd99f' },
    { key: 'relay',   label: '중계',        icon: 'ON', color: '#d7ebff', text: '#326a9d', border: '#9fc9ee' },
    { key: 'pre',     label: '방송 전',     icon: '…', color: '#f4f1ea', text: '#777064', border: '#ddd5c7' },
    { key: 'general', label: '기타',        icon: '•', color: '#dde9ef', text: '#405f6d', border: '#b8cdd8' },
];

const HOLIDAYS = {
    // 2025
    '2025-01-01': '신정',
    '2025-01-28': '설날 연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설날 연휴',
    '2025-03-01': '삼일절',
    '2025-05-05': '어린이날',
    '2025-05-06': '석가탄신일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석 연휴',
    '2025-10-06': '추석',
    '2025-10-07': '추석 연휴',
    '2025-10-09': '한글날',
    '2025-12-25': '크리스마스',
    // 2026
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절',
    '2026-03-02': '대체공휴일 (삼일절)',      // 삼일절 일요일
    '2026-05-05': '어린이날',
    '2026-05-24': '석가탄신일',
    '2026-05-25': '대체공휴일 (석가탄신일)',   // 석가탄신일 일요일
    '2026-06-06': '현충일',
    '2026-07-17': '제헌절',
    '2026-08-15': '광복절',
    '2026-08-17': '대체공휴일 (광복절)',       // 광복절 토요일
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절',
    '2026-10-05': '대체공휴일 (개천절)',       // 개천절 토요일
    '2026-10-09': '한글날',
    '2026-12-25': '크리스마스',
    // 2027
    '2027-01-01': '신정',
    '2027-02-06': '설날 연휴',
    '2027-02-07': '설날',
    '2027-02-08': '설날 연휴',
    '2027-02-09': '대체공휴일 (설날)',         // 설날 일요일
    '2027-03-01': '삼일절',
    '2027-05-05': '어린이날',
    '2027-05-13': '석가탄신일',
    '2027-06-06': '현충일',
    '2027-07-17': '제헌절',
    '2027-07-19': '대체공휴일 (제헌절)',       // 제헌절 토요일
    '2027-08-15': '광복절',
    '2027-08-16': '대체공휴일 (광복절)',       // 광복절 일요일
    '2027-09-14': '추석 연휴',
    '2027-09-15': '추석',
    '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절',
    '2027-10-04': '대체공휴일 (개천절)',       // 개천절 일요일
    '2027-10-09': '한글날',
    '2027-10-11': '대체공휴일 (한글날)',       // 한글날 토요일
    '2027-12-25': '크리스마스',
    '2027-12-27': '대체공휴일 (크리스마스)',   // 크리스마스 토요일
    // 2028
    '2028-01-01': '신정',
    '2028-01-26': '설날 연휴',
    '2028-01-27': '설날',
    '2028-01-28': '설날 연휴',
    '2028-03-01': '삼일절',
    '2028-05-02': '석가탄신일',
    '2028-05-05': '어린이날',
    '2028-06-06': '현충일',
    '2028-07-17': '제헌절',
    '2028-08-15': '광복절',
    '2028-10-02': '추석 연휴',
    '2028-10-03': '추석 / 개천절',
    '2028-10-04': '추석 연휴',
    '2028-10-09': '한글날',
    '2028-12-25': '크리스마스',
    // 2029
    '2029-01-01': '신정',
    '2029-02-02': '설날 연휴',
    '2029-02-03': '설날',
    '2029-02-04': '설날 연휴',
    '2029-03-01': '삼일절',
    '2029-05-05': '어린이날',
    '2029-05-06': '대체공휴일 (어린이날)',     // 어린이날 일요일
    '2029-05-27': '석가탄신일',
    '2029-05-28': '대체공휴일 (석가탄신일)',   // 석가탄신일 일요일
    '2029-06-06': '현충일',
    '2029-07-17': '제헌절',
    '2029-08-15': '광복절',
    '2029-09-21': '추석 연휴',
    '2029-09-22': '추석',
    '2029-09-23': '추석 연휴',
    '2029-10-03': '개천절',
    '2029-10-09': '한글날',
    '2029-12-25': '크리스마스',
    // 2030
    '2030-01-01': '신정',
    '2030-02-02': '설날 연휴',
    '2030-02-03': '설날',
    '2030-02-04': '설날 연휴',
    '2030-02-05': '대체공휴일 (설날)',         // 설날 연휴 시작일 일요일
    '2030-03-01': '삼일절',
    '2030-05-05': '어린이날',
    '2030-05-17': '석가탄신일',
    '2030-06-06': '현충일',
    '2030-07-17': '제헌절',
    '2030-08-15': '광복절',
    '2030-10-03': '개천절',
    '2030-10-10': '추석 연휴',
    '2030-10-11': '추석',
    '2030-10-12': '추석 연휴',
    '2030-10-09': '한글날',
    '2030-12-25': '크리스마스',
};

function getHoliday(dateStr) {
    return HOLIDAYS[dateStr] || (dateStr.slice(5) === '08-18' ? '🎂 구슬요 생일' : null);
}

const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    events: [],
    ytLinks: [],
    broadcastInfos: [],
    memoCards: [],
    user: null,
    isEditor: false,
    isOwner: false,
    editors: [],
    calendarNotices: [],
    viewMode: 'month',
    weekStart: null,
    mobileStartDate: dateToStr(new Date()),
};

const DEFAULT_CALENDAR_NOTICE = {
    id: 'bosikham-season2-20260627',
    title: '공지사항',
    image_url: 'notice-bosikham-season2-20260627.jpg',
    link_url: 'https://www.sooplive.com/station/beadyo97/post/199734125',
    link_label: '공지 보러가기',
    button_bg_color: '#d9a53a',
    button_text_color: '#6f280b',
    header_bg_color: '#190a07',
    header_text_color: '#fff3cf',
    is_active: true,
    sort_order: 0,
};

const OPTIMIZED_NOTICE_IMAGES = {
    'notice-bosikham-season2-20260627.png': 'notice-bosikham-season2-20260627.jpg',
};

let db = null;
let _dbReady = null;
function _ensureDb() {
    if (db) return Promise.resolve(db);
    if (_dbReady) return _dbReady;
    _dbReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'supabase.min.js?v=supabase-2-112-2';
        s.onload = () => { db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); resolve(db); };
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return _dbReady;
}

async function fetchRuntimeCache(cacheKey, timeoutMs = 5000) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `${SUPABASE_URL}/rest/v1/site_runtime_cache?select=payload,updated_at&cache_key=eq.${encodeURIComponent(cacheKey)}&limit=1`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            signal: controller.signal,
        });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`runtime cache HTTP ${res.status}`);
        const rows = await res.json();
        const row = Array.isArray(rows) ? rows[0] : null;
        return row?.payload ? { ...row.payload, row_updated_at: row.updated_at } : null;
    } catch (error) {
        clearTimeout(tid);
        throw error;
    }
}

async function fetchActiveUpEvents(timeoutMs = 8000) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `${SUPABASE_URL}/rest/v1/up_events?select=*&is_active=eq.true&order=sort_order.asc`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            signal: controller.signal,
        });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`up_events HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        clearTimeout(tid);
        throw error;
    }
}

function typeOf(key) {
    return EVENT_TYPES.find(t => t.key === key) ?? EVENT_TYPES.find(t => t.key === 'general');
}

const GOBOOKTICON_STICKERS = Array.from({ length: 19 }, (_, i) =>
    `game-assets/gobookticon/gobook-${String(i + 1).padStart(2, '0')}.png`
);
const MOOD_STICKERS = {
    chat: GOBOOKTICON_STICKERS[5],
    song: GOBOOKTICON_STICKERS[9],
    solo: GOBOOKTICON_STICKERS[12],
    collab: GOBOOKTICON_STICKERS[13],
    watch: GOBOOKTICON_STICKERS[7],
    game: GOBOOKTICON_STICKERS[1],
    ad: GOBOOKTICON_STICKERS[4],
    rest: GOBOOKTICON_STICKERS[16],
    cover: GOBOOKTICON_STICKERS[10],
    relay: GOBOOKTICON_STICKERS[17],
    pre: GOBOOKTICON_STICKERS[3],
    general: GOBOOKTICON_STICKERS[14],
    empty: GOBOOKTICON_STICKERS[15],
    loading: GOBOOKTICON_STICKERS[2],
    highlight: GOBOOKTICON_STICKERS[11],
    save: GOBOOKTICON_STICKERS[0],
    delete: GOBOOKTICON_STICKERS[8],
    error: GOBOOKTICON_STICKERS[6],
    fan: 'game-assets/gobookticon/gobook-fan-sd.png',
};

function stickerImg(src, className, alt = '') {
    return `<img class="${className}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}
function stickerForEvent(ev) {
    if (ev?.is_rest || ev?.type === 'rest') return MOOD_STICKERS.rest;
    return MOOD_STICKERS[ev?.type] || MOOD_STICKERS.general;
}
function dayEmptyHtml(message, mood = 'empty') {
    return `<div class="day-empty with-sticker">${stickerImg(MOOD_STICKERS[mood] || MOOD_STICKERS.empty, 'day-empty-sticker')}${esc(message)}</div>`;
}
function upEmptyHtml(message, mood = 'loading') {
    return `<div class="up-empty with-sticker">${stickerImg(MOOD_STICKERS[mood] || MOOD_STICKERS.loading, 'up-empty-sticker')}${esc(message)}</div>`;
}
function toastStickerForMessage(message) {
    const text = String(message ?? '');
    if (/실패|오류|에러/.test(text)) return MOOD_STICKERS.error;
    if (/삭제/.test(text)) return MOOD_STICKERS.delete;
    if (/저장|추가|완료|되었습니다|로그인/.test(text)) return MOOD_STICKERS.save;
    return MOOD_STICKERS.general;
}
function ytLinkType(url) {
    const normalized = normalizeOptionalUrl(url);
    if (!normalized) return null;
    try {
        const u = new URL(normalized);
        const host = u.hostname.toLowerCase();
        if (host === 'youtu.be') return 'long';
        if (host === 'youtube.com' || host === 'www.youtube.com') {
            return u.pathname.includes('/shorts/') ? 'short' : 'long';
        }
    } catch {}
    return null;
}
const HOTCLIP_LINK_PREFIX = 'hotclip:';
function scheduleLinkLines(value) {
    return String(value || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}
function isHotclipUrl(url) {
    const normalized = normalizeOptionalUrl(url);
    if (!normalized) return false;
    try {
        const u = new URL(normalized);
        const host = u.hostname.toLowerCase();
        const isSoopVod = host === 'vod.sooplive.com' || host === 'vod.sooplive.co.kr' || host === 'vod.afreecatv.com';
        return isSoopVod && u.pathname.includes('/player/');
    } catch {}
    return false;
}
function parseScheduleLinkLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return null;
    if (raw.startsWith(HOTCLIP_LINK_PREFIX)) {
        const url = normalizeOptionalUrl(raw.slice(HOTCLIP_LINK_PREFIX.length));
        return url ? { kind: 'hotclip', url, raw } : null;
    }
    const ytType = ytLinkType(raw);
    if (ytType) return { kind: 'youtube', type: ytType, url: normalizeOptionalUrl(raw), raw };
    const url = normalizeOptionalUrl(raw);
    if (url && isHotclipUrl(url)) return { kind: 'hotclip', url, raw };
    return url ? { kind: 'link', url, raw } : null;
}
function eventScheduleLinks(ev) {
    return scheduleLinkLines(ev?.youtube_links)
        .map(parseScheduleLinkLine)
        .filter(Boolean);
}
function eventHotclipUrls(ev) {
    return eventScheduleLinks(ev)
        .filter(link => link.kind === 'hotclip')
        .map(link => link.url)
        .slice(0, 3);
}
function eventYoutubeLinks(ev) {
    return eventScheduleLinks(ev).filter(link => link.kind === 'youtube');
}
function preservedScheduleLinkLines(ev) {
    return scheduleLinkLines(ev?.youtube_links).filter(line => parseScheduleLinkLine(line)?.kind !== 'hotclip');
}
function encodedHotclipLine(url) {
    return `${HOTCLIP_LINK_PREFIX}${url}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function toDateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function formatDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${y}년 ${+m}월 ${+d}일`;
}
function dateFromStr(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
}
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
function dateToStr(date) {
    return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}
function eventEndDate(ev) {
    return ev.end_date || ev.date;
}
function eventOnDate(ev, dateStr) {
    return dateStr >= ev.date && dateStr <= eventEndDate(ev);
}
function broadcastInfoForDate(dateStr) {
    return state.broadcastInfos.find(info => info.date === dateStr) || null;
}
function timeInputValue(value) {
    if (!value) return '';
    return normalizeTimeInput(value) || '';
}
function normalizeTimeInput(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    let h, m, s = 0;
    const colon = raw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colon) {
        h = Number(colon[1]);
        m = Number(colon[2]);
        s = colon[3] === undefined ? 0 : Number(colon[3]);
    } else {
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 3) {
            h = Number(digits.slice(0, 1));
            m = Number(digits.slice(1, 3));
        } else if (digits.length === 4) {
            h = Number(digits.slice(0, 2));
            m = Number(digits.slice(2, 4));
        } else if (digits.length === 6) {
            h = Number(digits.slice(0, 2));
            m = Number(digits.slice(2, 4));
            s = Number(digits.slice(4, 6));
        } else {
            return null;
        }
    }
    if (![h, m, s].every(Number.isInteger)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function timeDisplayValue(value) {
    const normalized = timeInputValue(value);
    if (!normalized) return '';
    return normalized.endsWith(':00') ? normalized.slice(0, 5) : normalized;
}
function broadcastTimeLabel(info) {
    if (!info) return '';
    const start = timeDisplayValue(info.start_time);
    const end = timeDisplayValue(info.end_time);
    if (start && end) return `${start} ~ ${end}`;
    return start || end || '';
}
function broadcastUrls(info) {
    if (!info || !info.vod_urls) return [];
    return String(info.vod_urls)
        .split('\n')
        .map(url => url.trim())
        .filter(Boolean);
}
function broadcastTitles(info) {
    if (!info || !info.vod_titles) return [];
    return String(info.vod_titles)
        .split('\n')
        .map(title => title.trim());
}
function broadcastLinks(info) {
    const urls = broadcastUrls(info);
    const titles = broadcastTitles(info);
    return urls.map((url, i) => {
        const customTitle = titles[i] || '';
        const fallback = urls.length > 1 ? `다시보기 ${i + 1}` : '다시보기';
        return { url, title: customTitle || fallback };
    });
}
function broadcastRows(info) {
    const urls = broadcastUrls(info);
    const titles = broadcastTitles(info);
    const rows = urls.map((url, i) => ({ title: titles[i] || '', url }));
    return rows.length ? rows : [{ title: '', url: '' }];
}
function typeStyle(t) {
    return `background:${t.color};color:${t.text};border-color:${t.border || t.text};`;
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}
function jsArg(s) {
    return esc(JSON.stringify(String(s ?? '')));
}
function safeUrl(s) {
    try {
        const u = new URL(String(s));
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {}
    return '#';
}
function safeImageUrl(s, fallback = '') {
    const url = safeUrl(s);
    return url === '#' ? fallback : url;
}
function normalizeOptionalUrl(s) {
    const raw = String(s ?? '').trim();
    if (!raw) return '';
    const url = safeUrl(raw);
    return url === '#' ? null : url;
}
function isAllowedHostUrl(url, allowedHosts) {
    const normalized = normalizeOptionalUrl(url);
    if (!normalized) return false;
    try {
        const host = new URL(normalized).hostname.toLowerCase();
        return allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
    } catch {}
    return false;
}

function showMemoTooltip(e) {
    const memo = e.currentTarget.dataset.memo;
    if (!memo) return;
    const tooltip = document.getElementById('memoTooltip');
    tooltip.textContent = memo;
    tooltip.classList.add('show');

    const rect = e.currentTarget.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = rect.left;
    let top  = rect.top - th - 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (top < 8) top = rect.bottom + 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
}
function hideMemoTooltip() {
    document.getElementById('memoTooltip').classList.remove('show');
}

function chipSubtitleFontSize(subtitle, isSingle, isCompact) {
    if (isCompact) return 'clamp(9px, 0.72vw, 10px)';
    const len = subtitle.length;
    if (isSingle) {
        if (len <= 8)  return 'clamp(11px, 1.1vw, 15px)';
        if (len <= 16) return 'clamp(10px, 0.95vw, 13px)';
        return                'clamp(9px,  0.8vw,  12px)';
    } else {
        if (len <= 10) return 'clamp(10px, 0.9vw, 13px)';
        return                'clamp(9px,  0.8vw, 11px)';
    }
}

function softenChipFontSize(value) {
    return value.replace(/clamp\(([\d.]+)px,\s*([\d.]+)vw,\s*([\d.]+)px\)/, (_, min, preferred, max) => {
        const minPx = Number(min);
        const preferredVw = Number(preferred);
        const maxPx = Number(max);
        const minStep = minPx >= 18 ? 2 : 1;
        const maxStep = maxPx >= 22 ? 2 : 1;
        const vwStep = preferredVw >= 2 ? 0.16 : preferredVw >= 1.4 ? 0.1 : 0.06;
        const fmt = (num) => Number(num.toFixed(2)).toString();
        return `clamp(${fmt(Math.max(9, minPx - minStep))}px, ${fmt(Math.max(0.72, preferredVw - vwStep))}vw, ${fmt(Math.max(10, maxPx - maxStep))}px)`;
    });
}

function chipFontSize(title, isSingle, isCompact, eventCount = 0, detailCount = 3) {
    return softenChipFontSize(chipFontSizeRaw(title, isSingle, isCompact, eventCount, detailCount));
}

function chipFontSizeRaw(title, isSingle, isCompact, eventCount = 0, detailCount = 3) {
    const len = title.length;
    const room = Math.max(0, 2 - detailCount);
    if (isCompact) {
        if (room >= 2 && len <= 4) return 'clamp(15px, 1.45vw, 18px)';
        if (room >= 2 && len <= 8) return 'clamp(13px, 1.22vw, 16px)';
        if (len <= 4)  return 'clamp(13px, 1.3vw, 16px)';
        if (len <= 6)  return 'clamp(12px, 1.2vw, 15px)';
        if (len <= 10) return room >= 2 ? 'clamp(12px, 1.08vw, 14px)' : 'clamp(11px, 1.05vw, 13px)';
        if (len <= 16) return room >= 2 ? 'clamp(10px, 0.9vw, 12px)' : 'clamp(9px,  0.86vw, 12px)';
        return                'clamp(9px,  0.78vw, 11px)';
    }
    if (isSingle) {
        if (len <= 3)  return room >= 2 ? 'clamp(23px, 2.8vw, 34px)' : room >= 1 ? 'clamp(19px, 2.4vw, 30px)' : 'clamp(16px, 2.2vw, 28px)';
        if (len <= 5)  return room >= 2 ? 'clamp(20px, 2.5vw, 31px)' : room >= 1 ? 'clamp(17px, 2.25vw, 28px)' : 'clamp(16px, 2.2vw, 28px)';
        if (len <= 9)  return room >= 2 ? 'clamp(17px, 2.2vw, 27px)' : room >= 1 ? 'clamp(15px, 2.05vw, 25px)' : 'clamp(14px, 2.0vw, 24px)';
        if (len <= 14) return room >= 2 ? 'clamp(15px, 1.9vw, 23px)' : room >= 1 ? 'clamp(14px, 1.75vw, 21px)' : 'clamp(13px, 1.7vw, 20px)';
        if (len <= 20) return room >= 2 ? 'clamp(13px, 1.55vw, 19px)' : 'clamp(12px, 1.4vw, 17px)';
        return                'clamp(11px, 1.2vw, 14px)';
    } else {
        if (eventCount === 2) {
            if (len <= 2)  return room >= 2 ? 'clamp(24px, 2.7vw, 32px)' : room >= 1 ? 'clamp(22px, 2.5vw, 30px)' : 'clamp(20px, 2.25vw, 27px)';
            if (len <= 3)  return room >= 2 ? 'clamp(22px, 2.45vw, 30px)' : room >= 1 ? 'clamp(20px, 2.25vw, 28px)' : 'clamp(18px, 2.05vw, 25px)';
            if (len <= 5)  return room >= 2 ? 'clamp(20px, 2.25vw, 27px)' : room >= 1 ? 'clamp(18px, 2.05vw, 25px)' : 'clamp(16px, 1.82vw, 22px)';
            if (len <= 9)  return room >= 2 ? 'clamp(17px, 1.9vw, 23px)' : room >= 1 ? 'clamp(16px, 1.78vw, 22px)' : 'clamp(15px, 1.68vw, 20px)';
            if (len <= 14) return room >= 2 ? 'clamp(14px, 1.45vw, 18px)' : room >= 1 ? 'clamp(13px, 1.32vw, 17px)' : 'clamp(12px, 1.25vw, 16px)';
            return                room >= 2 ? 'clamp(11px, 1.1vw, 14px)' : 'clamp(10px, 1.0vw, 13px)';
        }
        if (eventCount === 3) {
            if (len <= 2)  return room >= 2 ? 'clamp(22px, 2.35vw, 28px)' : room >= 1 ? 'clamp(20px, 2.2vw, 27px)' : 'clamp(18px, 2.0vw, 24px)';
            if (len <= 3)  return room >= 2 ? 'clamp(20px, 2.15vw, 26px)' : room >= 1 ? 'clamp(18px, 2.0vw, 24px)' : 'clamp(16px, 1.8vw, 22px)';
            if (len <= 5)  return room >= 2 ? 'clamp(18px, 1.95vw, 23px)' : room >= 1 ? 'clamp(16px, 1.8vw, 21px)' : 'clamp(14px, 1.55vw, 18px)';
            if (len <= 7)  return room >= 2 ? 'clamp(16px, 1.75vw, 21px)' : room >= 1 ? 'clamp(15px, 1.65vw, 19px)' : 'clamp(14px, 1.52vw, 18px)';
            if (len <= 9)  return room >= 2 ? 'clamp(14px, 1.5vw, 18px)' : room >= 1 ? 'clamp(13px, 1.42vw, 17px)' : 'clamp(13px, 1.4vw, 17px)';
            if (len <= 14) return room >= 2 ? 'clamp(12px, 1.18vw, 15px)' : 'clamp(11px, 1.08vw, 14px)';
            return                'clamp(10px, 0.92vw, 12px)';
        }
        if (eventCount === 4) {
            if (len <= 2)  return room >= 2 ? 'clamp(19px, 1.95vw, 24px)' : room >= 1 ? 'clamp(17px, 1.75vw, 22px)' : 'clamp(15px, 1.55vw, 19px)';
            if (len <= 3)  return room >= 2 ? 'clamp(17px, 1.72vw, 21px)' : room >= 1 ? 'clamp(15px, 1.55vw, 19px)' : 'clamp(13px, 1.32vw, 17px)';
            if (len <= 5)  return room >= 2 ? 'clamp(15px, 1.5vw, 18px)' : room >= 1 ? 'clamp(14px, 1.42vw, 17px)' : 'clamp(13px, 1.32vw, 16px)';
            if (len <= 7)  return room >= 2 ? 'clamp(13px, 1.28vw, 16px)' : room >= 1 ? 'clamp(12px, 1.2vw, 15px)' : 'clamp(11px, 1.08vw, 14px)';
            if (len <= 9)  return room >= 2 ? 'clamp(12px, 1.14vw, 15px)' : 'clamp(11px, 1.08vw, 14px)';
            if (len <= 14) return 'clamp(10px, 0.92vw, 12px)';
            return                'clamp(9px,  0.82vw, 11px)';
        }
        if (len <= 8)  return 'clamp(13px, 1.5vw, 18px)';
        if (len <= 14) return 'clamp(12px, 1.3vw, 16px)';
        return                'clamp(11px, 1.0vw, 13px)';
    }
}

function toAmPm(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    return `${h >= 12 ? 'PM' : 'AM'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

let toastTimer;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.innerHTML = `${stickerImg(toastStickerForMessage(msg), 'toast-sticker')}<span>${esc(msg)}</span>`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── 그림판 ───
const paintState = {
    canvas: null,
    ctx: null,
    tool: 'pen',
    color: '#2a2f29',
    background: '#ffffff',
    size: 8,
    drawing: false,
    start: null,
    last: null,
    undoStack: [],
    redoStack: [],
    initialized: false,
};

function initPaintCanvas() {
    if (paintState.initialized) return;
    const canvas = document.getElementById('paintCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    paintState.canvas = canvas;
    paintState.ctx = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    resetPaintCanvas(false);

    canvas.addEventListener('pointerdown', startPaintStroke);
    canvas.addEventListener('pointermove', movePaintStroke);
    canvas.addEventListener('pointerup', endPaintStroke);
    canvas.addEventListener('pointerleave', endPaintStroke);
    canvas.addEventListener('pointercancel', endPaintStroke);
    canvas.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
    canvas.addEventListener('touchend', e => e.stopPropagation(), { passive: false });
    paintState.initialized = true;
}

function openPaintModal() {
    document.getElementById('paintModal').classList.add('open');
    initPaintCanvas();
}

function closePaintModal() {
    document.getElementById('paintModal').classList.remove('open');
    endPaintStroke();
}

function resetPaintCanvas(saveHistory = true) {
    const { canvas, ctx } = paintState;
    if (!canvas || !ctx) return;
    if (saveHistory) pushPaintHistory();
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    if (paintState.background === 'transparent') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.background = 'transparent';
    } else {
        ctx.fillStyle = paintState.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        canvas.style.background = paintState.background;
    }
    ctx.restore();
}

function setPaintTool(tool) {
    const tools = ['pen', 'eraser', 'text', 'line', 'arrow', 'rect', 'circle'];
    paintState.tool = tools.includes(tool) ? tool : 'pen';
    tools.forEach(name => {
        const id = `paint${name.charAt(0).toUpperCase()}${name.slice(1)}Btn`;
        document.getElementById(id)?.classList.toggle('active', paintState.tool === name);
    });
}

function normalizePaintColor(color) {
    const normalized = String(color || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : paintState.color;
}

function setPaintColor(color) {
    const nextColor = normalizePaintColor(color);
    paintState.color = nextColor;
    setPaintTool('pen');
    document.querySelectorAll('#paintSwatches .paint-swatch').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.color || '').toLowerCase() === nextColor);
    });
    const picker = document.getElementById('paintColorPicker');
    if (picker && picker.value.toLowerCase() !== nextColor) picker.value = nextColor;
}

function setPaintSize(size) {
    paintState.size = Math.max(2, Math.min(36, Number(size) || 8));
}

function setPaintBackground(background) {
    paintState.background = background === 'transparent' ? 'transparent' : background;
    pushPaintHistory();
    paintState.redoStack = [];
    resetPaintCanvas(false);
}

function isPaintShapeTool() {
    return ['line', 'arrow', 'rect', 'circle'].includes(paintState.tool);
}

function paintPoint(event) {
    const rect = paintState.canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (paintState.canvas.width / rect.width),
        y: (event.clientY - rect.top) * (paintState.canvas.height / rect.height),
    };
}

function startPaintStroke(event) {
    if (!paintState.canvas || !paintState.ctx) return;
    event.preventDefault();
    event.stopPropagation();
    const point = paintPoint(event);
    if (paintState.tool === 'text') {
        const text = prompt('삽입할 텍스트');
        if (!text) return;
        pushPaintHistory();
        paintState.redoStack = [];
        drawPaintText(point, text);
        return;
    }
    pushPaintHistory();
    paintState.redoStack = [];
    paintState.drawing = true;
    paintState.start = point;
    paintState.last = point;
    try {
        paintState.canvas.setPointerCapture?.(event.pointerId);
    } catch (err) {
        // Synthetic pointer events used in local checks may not have a capture target.
    }
    if (!isPaintShapeTool()) drawPaintSegment(paintState.last, paintState.last);
}

function movePaintStroke(event) {
    if (!paintState.drawing) return;
    event.preventDefault();
    event.stopPropagation();
    const next = paintPoint(event);
    if (isPaintShapeTool()) {
        restorePaintPreviewBase();
        drawPaintShape(paintState.start, next);
    } else {
        drawPaintSegment(paintState.last, next);
    }
    paintState.last = next;
}

function endPaintStroke() {
    if (paintState.drawing && isPaintShapeTool() && paintState.start && paintState.last) {
        restorePaintPreviewBase();
        drawPaintShape(paintState.start, paintState.last);
    }
    paintState.drawing = false;
    paintState.start = null;
    paintState.last = null;
}

function drawPaintSegment(from, to) {
    const { ctx } = paintState;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = paintState.tool === 'eraser'
        ? (paintState.background === 'transparent' ? paintState.color : paintState.background)
        : paintState.color;
    if (paintState.tool === 'eraser' && paintState.background === 'transparent') {
        ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.lineWidth = paintState.size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
}

function restorePaintPreviewBase() {
    const { ctx } = paintState;
    const image = paintState.undoStack[paintState.undoStack.length - 1];
    if (image) ctx.putImageData(image, 0, 0);
}

function drawPaintShape(from, to) {
    const { ctx } = paintState;
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = paintState.color;
    ctx.lineWidth = paintState.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (paintState.tool === 'line' || paintState.tool === 'arrow') {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        if (paintState.tool === 'arrow') drawPaintArrowHead(from, to);
    } else if (paintState.tool === 'rect') {
        ctx.strokeRect(x, y, w, h);
    } else if (paintState.tool === 'circle') {
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPaintArrowHead(from, to) {
    const { ctx } = paintState;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const length = Math.max(16, paintState.size * 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - length * Math.cos(angle - Math.PI / 7), to.y - length * Math.sin(angle - Math.PI / 7));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - length * Math.cos(angle + Math.PI / 7), to.y - length * Math.sin(angle + Math.PI / 7));
    ctx.strokeStyle = paintState.color;
    ctx.lineWidth = paintState.size;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

function drawPaintText(point, text) {
    const { ctx } = paintState;
    const fontSize = Math.max(18, Math.min(72, paintState.size * 2.6));
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = paintState.color;
    ctx.font = `900 ${fontSize}px "Pretendard", sans-serif`;
    ctx.textBaseline = 'top';
    String(text).split('\n').slice(0, 6).forEach((line, i) => {
        ctx.fillText(line, point.x, point.y + i * fontSize * 1.28);
    });
    ctx.restore();
}

function pushPaintHistory() {
    const { canvas, ctx } = paintState;
    if (!canvas || !ctx) return;
    try {
        paintState.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (paintState.undoStack.length > 25) paintState.undoStack.shift();
    } catch (err) {
        console.warn('paint history failed:', err);
    }
}

function undoPaint() {
    const { canvas, ctx } = paintState;
    if (!canvas || !ctx || paintState.undoStack.length === 0) return;
    paintState.redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const image = paintState.undoStack.pop();
    ctx.putImageData(image, 0, 0);
}

function redoPaint() {
    const { canvas, ctx } = paintState;
    if (!canvas || !ctx || paintState.redoStack.length === 0) return;
    paintState.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const image = paintState.redoStack.pop();
    ctx.putImageData(image, 0, 0);
}

function clearPaintCanvas() {
    resetPaintCanvas(true);
    paintState.redoStack = [];
}

function downloadPaintCanvas() {
    const { canvas } = paintState;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `beadyo-canvas-${dateToStr(new Date())}.png`;
    a.click();
    a.remove();
}

// ─── 드래그앤드랍 순서 ───
let dragState = { id: null, dateStr: null };
let _dragged = false;
let _eventsLoaded = false;
let _retryTimer = null;
let _calendarRealtimeChannel = null;
let _calendarRealtimeReloadTimer = null;
let _calendarFallbackPollTimer = null;
var renderUpTab;

function _scheduleLoadRetry(delay = 3000) {
    clearTimeout(_retryTimer);
    _retryTimer = setTimeout(() => { if (!_eventsLoaded) loadEvents(); }, delay);
}

function scheduleCalendarReload(delay = 350) {
    clearTimeout(_calendarRealtimeReloadTimer);
    _calendarRealtimeReloadTimer = setTimeout(() => {
        if (document.visibilityState === 'visible') loadEvents().catch(() => {});
    }, delay);
}

function startCalendarFallbackPolling() {
    clearInterval(_calendarFallbackPollTimer);
    _calendarFallbackPollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') loadEvents().catch(() => {});
    }, 30000);
}

async function initCalendarRealtime() {
    startCalendarFallbackPolling();
    try {
        await _ensureDb();
        if (_calendarRealtimeChannel || typeof db.channel !== 'function') return;
        _calendarRealtimeChannel = db
            .channel('beadyo-calendar-schedules')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                scheduleCalendarReload();
            })
            .subscribe();
    } catch (error) {
        console.warn('calendar realtime unavailable:', error);
    }
}

function eventOrderValue(ev) {
    return Number.isFinite(Number(ev.sort_order)) ? Number(ev.sort_order) : 9999;
}

function sortCalendarEvents(events) {
    return [...events].sort((a, b) => {
        if (!!b.is_rest !== !!a.is_rest) return (b.is_rest ? 1 : 0) - (a.is_rest ? 1 : 0);
        const orderDiff = eventOrderValue(a) - eventOrderValue(b);
        if (orderDiff !== 0) return orderDiff;
        const timeDiff = String(a.start_time || '99:99').localeCompare(String(b.start_time || '99:99'));
        if (timeDiff !== 0) return timeDiff;
        return String(a.created_at || a.id || '').localeCompare(String(b.created_at || b.id || ''));
    });
}

function eventsOnDateUnsorted(dateStr) {
    return state.events.filter(ev => eventOnDate(ev, dateStr));
}

function nextSortOrderForDate(dateStr) {
    const dayEvents = eventsOnDateUnsorted(dateStr);
    const orders = dayEvents.map(eventOrderValue).filter(n => n < 9999);
    return orders.length ? Math.max(...orders) + 1 : dayEvents.length;
}

async function saveDateOrder(dateStr, orderedEvents) {
    if (!state.isEditor) return false;
    await _ensureDb();
    orderedEvents.forEach((ev, i) => { ev.sort_order = i; });
    const updates = orderedEvents
        .filter(ev => ev.date === dateStr)
        .map((ev, i) => db.from('schedules').update({ sort_order: i }).eq('id', ev.id));
    if (!updates.length) return true;
    const results = await Promise.all(updates);
    const failed = results.find(res => res.error);
    if (failed) {
        showToast('순서 저장 실패: ' + failed.error.message);
        return false;
    }
    return true;
}

function dragStart(e, id, dateStr) {
    _dragged = false;
    dragState = { id, dateStr };
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function dragEnd(e) {
    _dragged = true;
    setTimeout(() => { _dragged = false; }, 100);
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.cell-drop-target').forEach(el => el.classList.remove('cell-drop-target'));
}
function dragOver(e, id, dateStr) {
    if (dragState.id === id) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}
function dragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}
async function dragDrop(e, targetId, targetDateStr) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    const { id: sourceId, dateStr: srcDate } = dragState;
    dragState = { id: null, dateStr: null };
    if (!sourceId || sourceId === targetId) return;

    if (srcDate === targetDateStr) {
        const orderedEvents = calendarEventsForDate(targetDateStr);
        const fromIdx = orderedEvents.findIndex(ev => ev.id === sourceId);
        const toIdx   = orderedEvents.findIndex(ev => ev.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = orderedEvents.splice(fromIdx, 1);
        orderedEvents.splice(toIdx, 0, moved);
        const saved = await saveDateOrder(targetDateStr, orderedEvents);
        if (!saved) await loadEvents();
        renderCalendar();
    } else {
        await moveEventToDate(sourceId, srcDate, targetDateStr);
    }
}
function cellDragOver(e, dateStr) {
    if (!dragState.id) return;
    e.preventDefault();
    e.currentTarget.classList.add('cell-drop-target');
}
function cellDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    e.currentTarget.classList.remove('cell-drop-target');
}
async function cellDrop(e, dateStr) {
    e.preventDefault();
    e.currentTarget.classList.remove('cell-drop-target');
    const { id: sourceId, dateStr: srcDate } = dragState;
    dragState = { id: null, dateStr: null };
    if (!sourceId || srcDate === dateStr) return;
    await moveEventToDate(sourceId, srcDate, dateStr);
}
async function moveEventToDate(eventId, srcDate, targetDate) {
    if (!state.isEditor) return;
    await _ensureDb();
    const ev = state.events.find(e => e.id === eventId);
    if (!ev) return;
    const payload = { date: targetDate, sort_order: nextSortOrderForDate(targetDate) };
    if (ev.end_date && ev.end_date !== ev.date) {
        const [sy, sm, sd] = srcDate.split('-').map(Number);
        const [ty, tm, td] = targetDate.split('-').map(Number);
        const dayDiff = Math.round((new Date(ty, tm - 1, td) - new Date(sy, sm - 1, sd)) / 86400000);
        const [ey, em, ed] = ev.end_date.split('-').map(Number);
        const newEnd = new Date(ey, em - 1, ed);
        newEnd.setDate(newEnd.getDate() + dayDiff);
        payload.end_date = toDateStr(newEnd.getFullYear(), newEnd.getMonth(), newEnd.getDate());
    }
    const { error } = await db.from('schedules').update(payload).eq('id', eventId);
    if (error) { showToast('이동 실패: ' + error.message); return; }
    showToast('일정이 이동되었습니다');
    await loadEvents();
}

// ─── 데이터 로드 ───
async function loadEvents() {
    _eventsLoaded = false;
    clearTimeout(_retryTimer);
    _retryTimer = null;

    const first = toDateStr(state.year, state.month, 1);
    let   last  = toDateStr(state.year, state.month, new Date(state.year, state.month + 1, 0).getDate());
    const prev  = new Date(state.year, state.month - 1, 1);
    const extFirst = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`;

    // 주간 뷰에서 주가 월 경계를 넘는 경우 다음 달까지 포함
    if (state.viewMode === 'week' && state.weekStart) {
        const [wy, wm, wd] = state.weekStart.split('-').map(Number);
        const weekEnd = addDays(new Date(wy, wm - 1, wd), 6);
        const weekEndStr = dateToStr(weekEnd);
        if (weekEndStr > last) last = weekEndStr;
    }

    // 빈 상태라도 즉시 렌더 (모바일 무한 빈 화면 방지)
    if (state.events.length === 0) renderCalendar();

    // 페이지가 hidden이면 fetch 건너뜀 — visibilitychange 복귀 시 재시도
    if (document.visibilityState !== 'visible') {
        _scheduleLoadRetry(1000);
        return;
    }

    // Supabase 클라이언트 초기화 행 방지 — REST API 직접 호출
    const baseCols = 'id,date,end_date,start_time,duration,title,type,collab,subtitle,vod_url,memo,is_rest,youtube_links';
    const cols = `${baseCols},sort_order,created_at`;
    const baseQuery = `${SUPABASE_URL}/rest/v1/schedules` +
        `&date=gte.${extFirst}` +
        `&date=lte.${last}`;
    const url = `${baseQuery.replace('&', '?select=' + cols + '&')}` +
        `&order=date.asc,sort_order.asc.nullslast,start_time.asc.nullslast`;
    const fallbackUrl = `${baseQuery.replace('&', '?select=' + baseCols + '&')}` +
        `&order=date.asc,start_time.asc.nullslast`;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 6000);

    let data;
    try {
        let res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            signal: controller.signal,
        });
        if (!res.ok && res.status === 400) {
            res = await fetch(fallbackUrl, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                signal: controller.signal,
            });
        }
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch (e) {
        clearTimeout(tid);
        state.events = [];
        renderCalendar();
        _scheduleLoadRetry();
        return;
    }

    state.events = Array.isArray(data) ? data : [];
    await loadBroadcastInfos(extFirst, last);
    _eventsLoaded = true;
    renderCalendar();
    loadYtLinks().catch(() => {});
}

async function loadEditors() {
    await _ensureDb();
    const { data, error } = await db.from('editors').select('id,email,created_at').order('created_at');
    if (error) {
        console.error('loadEditors:', error);
        state.editors = [];
        return;
    }
    state.editors = data ?? [];
}

async function loadYtLinks() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const from = dateToStr(firstDay);
    const to   = dateToStr(lastDay);
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/youtube_links?select=id,date,url&date=gte.${from}&date=lte.${to}&order=date.asc,created_at.asc`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.ytLinks = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('loadYtLinks:', e);
        state.ytLinks = [];
    }
    renderCalendar();
}

async function loadBroadcastInfos(from, to) {
    try {
        const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
        let res = await fetch(
            `${SUPABASE_URL}/rest/v1/broadcast_infos?select=id,date,start_time,end_time,vod_urls,vod_titles,memo&date=gte.${from}&date=lte.${to}&order=date.asc`,
            { headers }
        );
        if (!res.ok && res.status === 400) {
            res = await fetch(
                `${SUPABASE_URL}/rest/v1/broadcast_infos?select=id,date,start_time,end_time,vod_urls,memo&date=gte.${from}&date=lte.${to}&order=date.asc`,
                { headers }
            );
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.broadcastInfos = Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn('loadBroadcastInfos:', e);
        state.broadcastInfos = [];
    }
}

// ─── 범례 렌더링 ───
function renderLegend() {
    document.getElementById('legend').innerHTML =
        `<button class="up-launcher" onclick="openUpModal()"><img class="up-launcher-emoji" src="stickers/s8.png" alt=""><span>UP</span></button>` +
        `<div class="legend-title">유형</div>` +
        EVENT_TYPES.map(t => `
            <div class="legend-item" onclick="openAddModalWithType('${t.key}')">
                <div class="legend-dot" style="${typeStyle(t)}">${esc(t.icon)}</div>
                <span>${t.label}</span>
                <span class="legend-add">+</span>
            </div>
        `).join('') +
        `<div class="legend-sticker"><img src="stickers/legend-thanks-hanul.png" alt="고마워요"></div>`;
}

function eventsForDate(dateStr) {
    return state.events
        .filter(ev => eventOnDate(ev, dateStr))
        .sort((a, b) => {
            if (!!b.is_rest !== !!a.is_rest) return (b.is_rest ? 1 : 0) - (a.is_rest ? 1 : 0);
            return String(a.start_time || '99:99').localeCompare(String(b.start_time || '99:99'));
        });
}

function calendarEventsForDate(dateStr) {
    return sortCalendarEvents(eventsOnDateUnsorted(dateStr));
}

function renderMobileSchedule() {
    const wrap = document.getElementById('mobileScheduleView');
    if (!wrap) return;
    const todayStr = dateToStr(new Date());
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const [y, m, d] = state.mobileStartDate.split('-').map(Number);
    const cards = [];

    for (let i = 0; i < 3; i++) {
        const date = new Date(y, m - 1, d + i);
        const dateStr = dateToStr(date);
        const events = eventsForDate(dateStr);
        const dow = date.getDay();
        const day = date.getDate();
        const titleCls = dow === 0 ? ' sun' : '';
        const eventHtml = events.length
            ? events.map(ev => {
                const t = typeOf(ev.type);
                const time = ev.start_time ? ev.start_time.slice(0, 5) : '미정';
                const restSticker = ev.is_rest || ev.type === 'rest'
                    ? stickerImg(MOOD_STICKERS.fan, 'mobile-event-sticker', '선풍기')
                    : '';
                return `<button class="mobile-event-pill" style="${typeStyle(t)}" onclick="openDayViewModal('${dateStr}')">
                    ${restSticker}
                    <span class="mobile-event-time">${esc(time)}</span>
                    <span class="mobile-event-title">${esc(ev.title)}</span>
                    <span class="mobile-event-icon">${esc(t.icon)}</span>
                </button>`;
            }).join('')
            : `<div class="mobile-empty-note">${stickerImg(MOOD_STICKERS.rest, 'mobile-empty-sticker')}<span>일정이 비어있어요</span></div>`;
        cards.push(`<section class="mobile-day-card">
            <div class="mobile-day-head">
                <div class="mobile-date-title${titleCls}">${day}일(${dayNames[dow]})</div>
                ${dateStr === todayStr ? '<div class="mobile-today-badge">TODAY</div>' : ''}
            </div>
            <div class="mobile-event-list">${eventHtml}</div>
        </section>`);
    }

    wrap.innerHTML = cards.join('');
}

function renderSecondaryViews() {
    if (window.innerWidth <= 640) renderMobileSchedule();
}

// ─── 캘린더 렌더링 ───
function renderCalendar() {
    if (state.viewMode === 'week' && state.weekStart) {
        const [wy, wm, wd] = state.weekStart.split('-').map(Number);
        const wStart = new Date(wy, wm - 1, wd);
        const wEnd   = addDays(wStart, 6);
        const fmt = d => `${d.getMonth() + 1}.${pad(d.getDate())}`;
        document.getElementById('monthLabel').textContent = `${fmt(wStart)} ~ ${fmt(wEnd)}`;
        document.querySelector('.nav-btn.prev').dataset.tip = '이전 주';
        document.querySelector('.nav-btn.next').dataset.tip = '다음 주';
    } else {
        document.getElementById('monthLabel').textContent = `${state.year}.${pad(state.month + 1)}`;
        document.querySelector('.nav-btn.prev').dataset.tip = '이전 달';
        document.querySelector('.nav-btn.next').dataset.tip = '다음 달';
    }
    document.getElementById('weekModeBtn')?.classList.toggle('active', state.viewMode === 'week');
    document.getElementById('monthModeBtn')?.classList.toggle('active', state.viewMode === 'month');
    document.querySelector('.cal-area')?.classList.toggle('week-mode', state.viewMode === 'week');

    const today    = new Date();
    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    const cells = [];
    if (state.viewMode === 'week') {
        if (!state.weekStart) {
            const ws = addDays(today, -today.getDay());
            state.weekStart = dateToStr(ws);
        }
        const [wy, wm, wd] = state.weekStart.split('-').map(Number);
        const start = new Date(wy, wm - 1, wd);
        for (let i = 0; i < 7; i++) {
            const date = addDays(start, i);
            cells.push({
                day: date.getDate(),
                dateStr: dateToStr(date),
                other: false,
            });
        }
    } else {
        const firstWd  = new Date(state.year, state.month, 1).getDay();
        const daysInM  = new Date(state.year, state.month + 1, 0).getDate();
        const daysInP  = new Date(state.year, state.month, 0).getDate();
        for (let i = firstWd - 1; i >= 0; i--)
            cells.push({ day: daysInP - i, dateStr: toDateStr(state.year, state.month - 1, daysInP - i), other: true });
        for (let d = 1; d <= daysInM; d++)
            cells.push({ day: d, dateStr: toDateStr(state.year, state.month, d), other: false });
        const totalCells = Math.ceil((firstWd + daysInM) / 7) * 7;
        for (let d = 1; cells.length < totalCells; d++)
            cells.push({ day: d, dateStr: toDateStr(state.year, state.month + 1, d), other: true });
    }

    let otherMonthStickerDate = null;
    if (state.viewMode === 'month') {
        const firstCurrentIndex = cells.findIndex(cell => !cell.other);
        const lastCurrentIndex = cells.reduce((last, cell, index) => cell.other ? last : index, -1);
        const nextMonthFirst = cells.find((cell, index) => cell.other && index > lastCurrentIndex && cell.day === 1);
        const prevMonthLast = cells[firstCurrentIndex - 1];
        otherMonthStickerDate = nextMonthFirst?.dateStr || (prevMonthLast?.other ? prevMonthLast.dateStr : null);
    }

    document.getElementById('calGrid').innerHTML = cells.map(({ day, dateStr, other }, idx) => {
        const dow     = idx % 7;
        const isToday = !other && dateStr === todayStr;
        const events  = other ? [] : calendarEventsForDate(dateStr);
        const hasRest = events.some(e => e.is_rest);

        const isEmpty = !other && events.length === 0;
        const cellCls = ['cal-cell',
            other   ? 'other-month' : '',
            isToday ? 'today'       : '',
            hasRest ? 'is-rest'     : '',
            isEmpty ? 'empty'       : '',
        ].filter(Boolean).join(' ');

        const cellClick = isEmpty && state.isEditor
            ? `onclick="openAddModal('${dateStr}')"` : '';

        const isHoliday = !other && !!getHoliday(dateStr);
        const numCls = ['date-num',
            (dow === 0 || isHoliday) ? 'sun' : dow === 6 ? 'sat' : '',
            state.isEditor && !other ? 'date-button' : '',
        ].filter(Boolean).join(' ');
        const dateNumHtml = state.isEditor && !other
            ? `<button class="${numCls}" onclick="event.stopPropagation();openBroadcastModal('${dateStr}')" title="방송정보 편집">${day}</button>`
            : `<div class="${numCls}">${day}</div>`;

        const isSingle     = events.length === 1;
        const isStableList = events.length >= 2 && events.length <= 4;
        const isCompact    = events.length >= 5 && events.length <= 6;
        const isPacked     = events.length >= 7;
        const chipsHtml = events.map(ev => {
            const t        = typeOf(ev.type);
            const isMulti  = ev.end_date && ev.end_date !== ev.date;
            const isStart  = ev.date === dateStr;
            const isEnd    = (ev.end_date || ev.date) === dateStr;
            const visStart = isStart || dow === 0;
            const visEnd   = isEnd   || dow === 6;

            let br = '10px';
            if (isMulti) {
                if      (visStart && visEnd) br = '10px';
                else if (visStart)           br = '10px 0 0 10px';
                else if (visEnd)             br = '0 10px 10px 0';
                else                         br = '0';
            }

            const timeBadge = isStart && ev.start_time
                ? `<div class="chip-time-badge">${toAmPm(ev.start_time)}</div>` : '';
            const vodDot = isStart && ev.vod_url
                ? `<span class="vod-dot"></span>` : '';
            const hasNewline   = ev.title.includes('\n');
            const newlineClass = hasNewline && !isSingle ? ' has-newline' : '';
            const newlineStyle = hasNewline
                ? 'white-space:pre-line;'
                : '';
            const visibleDetailParts = isStart
                ? [!!ev.subtitle, !!ev.collab]
                : [true, true];
            const visibleDetailCount = visibleDetailParts.filter(Boolean).length;
            const detailName = ['none', 'one', 'two'][visibleDetailCount] || 'two';
            const detailClass = ` detail-${detailName}${ev.subtitle ? ' has-subtitle-detail' : ' no-subtitle-detail'}${ev.collab ? ' has-collab-detail' : ' no-collab-detail'}${ev.memo ? ' has-memo-detail' : ' no-memo-detail'}`;
            const bodyStyle = `${!isStart ? 'opacity:0.55;' : ''}--chip-title-size:${chipFontSize(ev.title, isSingle, isCompact, events.length, visibleDetailCount)};${newlineStyle}`;
            const titleSizeClass = String(ev.title ?? '').length <= 5 ? 'short-title' : 'long-title';
            const subtitleClass = !isStart ? ''
                : ev.subtitle ? ' has-subtitle'
                : ev.collab   ? ' has-collab'
                : '';
            const restClass = ev.is_rest || ev.type === 'rest' ? ' rest-chip' : '';

            const memoAttr = isStart && ev.memo
                ? `data-memo="${esc(ev.memo)}"` : '';
            const memoEvents = isStart && ev.memo
                ? `onmouseenter="showMemoTooltip(event)" onmouseleave="hideMemoTooltip()"` : '';

            const subtitleHtml = isStart && ev.subtitle
                ? `<div class="chip-subtitle" style="--chip-subtitle-size:${chipSubtitleFontSize(ev.subtitle, isSingle, isCompact)};">${esc(ev.subtitle)}</div>` : '';
            const collabHtml = isStart && ev.collab
                ? `<div class="chip-collab" style="--chip-detail-size:${chipSubtitleFontSize(ev.collab, isSingle, isCompact)};">w. ${esc(ev.collab)}</div>` : '';
            const chipSticker = isStart && (ev.is_rest || ev.type === 'rest') && (isSingle || isStableList)
                ? stickerImg(MOOD_STICKERS.fan, 'event-chip-sticker', '선풍기')
                : '';

            const dragAttrs = state.isEditor && isStart
                ? `draggable="true"
                   ondragstart="dragStart(event,'${esc(ev.id)}','${dateStr}')"
                   ondragend="dragEnd(event)"
                   ondragover="dragOver(event,'${esc(ev.id)}','${dateStr}')"
                   ondragleave="dragLeave(event)"
                   ondrop="dragDrop(event,'${esc(ev.id)}','${dateStr}')"` : '';

            const timeClass = isStart && ev.start_time ? ' has-time' : '';

            return `<button class="event-chip ${titleSizeClass}${subtitleClass}${timeClass}${newlineClass}${restClass}${detailClass}"
                style="${typeStyle(t)}border-radius:${br};"
                onclick="if(!_dragged)openDayViewModal('${dateStr}')"
                ${memoAttr} ${memoEvents} ${dragAttrs}
                title="${esc(ev.title)}">${timeBadge}${chipSticker}<div class="chip-body" style="${bodyStyle}">${vodDot}${esc(ev.title)}</div>${subtitleHtml}${collabHtml}</button>`;
        }).join('');

        const holiday   = !other ? (getHoliday(dateStr) || null) : null;
        const holHtml   = holiday ? `<div class="holiday-label">${esc(holiday)}</div>` : '';
        const todayBadge = isToday ? `<span class="today-badge">TODAY</span>` : '';
        const addBtn = !other
            ? `<button class="cell-add-btn" onclick="openAddModal('${dateStr}')" title="일정 추가">+</button>`
            : '';
        const topRight = !other
            ? `<div class="cell-top-right">${todayBadge}${addBtn}</div>` : '';

        const ytBadges = [];
        events.forEach(ev => {
            if (ev.date !== dateStr) return;
            eventYoutubeLinks(ev).forEach(({ url, type }) => ytBadges.push({ url, type }));
        });
        state.ytLinks.filter(yl => yl.date === dateStr).forEach(yl => {
            const type = ytLinkType(yl.url);
            if (type) ytBadges.push({ url: yl.url.trim(), type });
        });
        const ytAddBtn = !other && state.isEditor
            ? `<button class="yt-add-btn" onclick="event.stopPropagation();openYtModal('${dateStr}')" title="YouTube 링크 추가"><svg viewBox="0 0 10 7"><path d="M3.9 4.9V2.1L6.7 3.5z"/></svg></button>`
            : '';
        const ytBadgesHtml = (ytBadges.length || ytAddBtn)
            ? `<div class="yt-badges">${ytBadges.map(({ url, type }) =>
                `<a class="yt-badge yt-${type}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="${type === 'long' ? 'YouTube' : 'YouTube Shorts'}">${type === 'long' ? 'Y' : 'S'}</a>`
              ).join('')}${ytAddBtn}</div>` : '';

        const chipsClass = `chips-area${isSingle ? ' single' : ''}${isStableList ? ' stable-list' : ''}${isPacked ? ' packed' : ''}${isCompact ? ' compact' : ''}${isStableList ? ` count-${events.length}` : ''}`;
        const body = `<div class="${chipsClass}">${chipsHtml}</div>`;
        const otherMonthSticker = other && dateStr === otherMonthStickerDate
            ? `<div class="other-month-sticker"><img src="stickers/legend-thanks-hanul.png" alt="고마워요"></div>`
            : '';
        const cellDropAttrs = !other && state.isEditor
            ? `ondragover="cellDragOver(event,'${dateStr}')" ondragleave="cellDragLeave(event)" ondrop="cellDrop(event,'${dateStr}')"` : '';

        return `<div class="${cellCls}" ${cellClick} ${cellDropAttrs}>
            <div class="cell-date-row">
                ${dateNumHtml}
                ${ytBadgesHtml}
            </div>
            ${holHtml}
            ${topRight}
            ${body}
            ${otherMonthSticker}
        </div>`;
    }).join('');
    renderSecondaryViews();
}

// ─── 메모카드 ───
let _memoEditingId = null;

function _memoFormHtml(source) {
    return `<div class="memo-add-form">
        <textarea id="memoNewContent-${source}" placeholder="메모 내용을 입력하세요" rows="3"></textarea>
        <input type="url" id="memoNewUrl-${source}" placeholder="링크 URL (선택)">
        <button id="memoSaveBtn-${source}" onclick="addMemoCard('${source}')">추가</button>
        <button id="memoCancelBtn-${source}" type="button" onclick="cancelMemoEdit('${source}')" style="display:none;background:#f0f0f0;color:#555;">취소</button>
    </div>`;
}

function _memoFormEls(source = 'sidebar') {
    return {
        content: document.getElementById(`memoNewContent-${source}`),
        url: document.getElementById(`memoNewUrl-${source}`),
        save: document.getElementById(`memoSaveBtn-${source}`),
        cancel: document.getElementById(`memoCancelBtn-${source}`),
    };
}

function _resetMemoForm(source = 'sidebar') {
    const els = _memoFormEls(source);
    if (els.content) els.content.value = '';
    if (els.url) els.url.value = '';
    if (els.save) els.save.textContent = '추가';
    if (els.cancel) els.cancel.style.display = 'none';
    _memoEditingId = null;
}

async function loadMemoCards() {
    const ym = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/memo_cards?select=id,content,url,sort_order,year_month&year_month=eq.${ym}&order=sort_order.asc,created_at.asc`,
            { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.memoCards = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('loadMemoCards:', e);
        state.memoCards = [];
    }
    renderMemoSidebar();
}

function renderMemoSidebar() {
    const el = document.getElementById('memoSidebar');
    if (!el) return;

    // 입력 폼: 아직 없을 때만 렌더 (입력 중인 텍스트 보호)
    if (state.isEditor && !el.querySelector('.memo-add-form')) {
        const form = document.createElement('div');
        form.innerHTML = _memoFormHtml('sidebar');
        el.prepend(form);
    }

    // 카드 목록만 갱신
    const cardsHtml = state.memoCards.map(card => _memoCardHtml(card, true)).join('');
    let listEl = el.querySelector('.memo-card-list');
    if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'memo-card-list';
        el.appendChild(listEl);
    }
    listEl.innerHTML = cardsHtml;
}

function _memoCardHtml(card, sidebar) {
    const isLink = !!card.url;
    const actions = state.isEditor
        ? `<div class="memo-card-actions">
            <button class="memo-card-edit" onclick="event.stopPropagation();editMemoCard(${jsArg(card.id)},${jsArg(sidebar ? 'sidebar' : 'modal')})" title="수정">✎</button>
            <button class="memo-card-del" onclick="event.stopPropagation();deleteMemoCard(${jsArg(card.id)})" title="삭제">✕</button>
        </div>`
        : '';
    const dragAttrs = state.isEditor && sidebar
        ? `draggable="true"
           ondragstart="memoDragStart(event,${jsArg(card.id)})"
           ondragover="memoDragOver(event,${jsArg(card.id)})"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="memoDrop(event,${jsArg(card.id)})"
           ondragend="memoDragEnd(event)"`
        : '';
    const clickAttr = isLink
        ? `onclick="openMemoCard(${jsArg(card.url)})"` : '';
    const handle = state.isEditor && sidebar
        ? `<span class="memo-drag-handle">• • •</span>` : '';
    return `<div class="memo-card${isLink ? ' is-link' : ''}" ${clickAttr} ${dragAttrs}>
        ${actions}
        <div class="memo-card-text">${esc(card.content)}</div>
        ${handle}
    </div>`;
}

async function addMemoCard(source = 'sidebar') {
    const els = _memoFormEls(source);
    const content = (els.content?.value || '').trim();
    const url     = (els.url?.value || '').trim();
    if (!content) { showToast('내용을 입력해 주세요'); return; }
    const normalizedUrl = normalizeOptionalUrl(url);
    if (url && !normalizedUrl) { showToast('올바른 URL을 입력해 주세요'); return; }

    if (_memoEditingId) {
        await _ensureDb();
        const { data, error } = await db.from('memo_cards')
            .update({ content, url: normalizedUrl || null })
            .eq('id', _memoEditingId)
            .select();
        if (error) { showToast('수정 실패: ' + error.message); return; }
        const updated = data?.[0];
        state.memoCards = state.memoCards.map(card => card.id === _memoEditingId ? { ...card, ...(updated || { content, url: normalizedUrl || null }) } : card);
        _resetMemoForm(source);
        renderMemoSidebar();
        renderMemoModalList();
        showToast('메모를 수정했어요');
        return;
    }

    const ym = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
    const maxOrder = state.memoCards.reduce((m, c) => Math.max(m, c.sort_order ?? 0), -1);
    await _ensureDb();
    const { data, error } = await db.from('memo_cards')
        .insert({ content, url: normalizedUrl || null, sort_order: maxOrder + 1, year_month: ym })
        .select();
    if (error) { showToast('저장 실패: ' + error.message); return; }
    state.memoCards.push(data[0]);
    _resetMemoForm(source);
    renderMemoSidebar();
    renderMemoModalList();
}

function editMemoCard(id, source = 'sidebar') {
    const card = state.memoCards.find(c => c.id === id);
    if (!card) return;
    _memoEditingId = id;
    const els = _memoFormEls(source);
    if (els.content) {
        els.content.value = card.content || '';
        els.content.focus();
    }
    if (els.url) els.url.value = card.url || '';
    if (els.save) els.save.textContent = '수정 저장';
    if (els.cancel) els.cancel.style.display = '';
}

function cancelMemoEdit(source = 'sidebar') {
    _resetMemoForm(source);
}

async function deleteMemoCard(id) {
    await _ensureDb();
    const { error } = await db.from('memo_cards').delete().eq('id', id);
    if (error) { showToast('삭제 실패: ' + error.message); return; }
    state.memoCards = state.memoCards.filter(c => c.id !== id);
    renderMemoSidebar();
    renderMemoModalList();
}

function openMemoCard(url) {
    window.open(safeUrl(url), '_blank', 'noopener,noreferrer');
}

// 드래그앤드롭
let _memoDragId = null;
function memoDragStart(e, id) {
    _memoDragId = id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function memoDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.memo-card.drag-over').forEach(el => el.classList.remove('drag-over'));
    _memoDragId = null;
}
function memoDragOver(e, id) {
    if (!_memoDragId || _memoDragId === id) return;
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}
async function memoDrop(e, targetId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!_memoDragId || _memoDragId === targetId) return;
    const fromIdx = state.memoCards.findIndex(c => c.id === _memoDragId);
    const toIdx   = state.memoCards.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...state.memoCards];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reordered.forEach((c, i) => { c.sort_order = i; });
    state.memoCards = reordered;
    renderMemoSidebar();
    await _ensureDb();
    await Promise.all(reordered.map((c, i) =>
        db.from('memo_cards').update({ sort_order: i }).eq('id', c.id)
    ));
}

// 모바일 메모 모달
function openMemoModal() {
    renderMemoModalList();
    renderMemoModalForm();
    document.getElementById('memoModal').classList.add('open');
}
function closeMemoModal() {
    document.getElementById('memoModal').classList.remove('open');
}
function renderMemoModalList() {
    const el = document.getElementById('memoModalList');
    if (!el) return;
    if (!state.memoCards.length) {
        el.innerHTML = '<div style="color:#aaa;font-size:13px;text-align:center;padding:10px 0;">등록된 메모가 없어요</div>';
        return;
    }
    el.innerHTML = state.memoCards.map(card => {
        const isLink = !!card.url;
        const actions = state.isEditor
            ? `<div class="memo-card-actions">
                <button class="memo-card-edit" onclick="event.stopPropagation();editMemoCard(${jsArg(card.id)},${jsArg('modal')})" title="수정">✎</button>
                <button class="memo-card-del" onclick="event.stopPropagation();deleteMemoCard(${jsArg(card.id)})" title="삭제">✕</button>
            </div>` : '';
        const clickAttr = isLink ? `onclick="openMemoCard(${jsArg(card.url)})"` : '';
        return `<div class="memo-modal-card${isLink ? ' is-link' : ''}" ${clickAttr}>
            ${actions}
            <div style="white-space:pre-wrap">${esc(card.content)}</div>
        </div>`;
    }).join('');
}
function renderMemoModalForm() {
    const el = document.getElementById('memoModalForm');
    if (!el || !state.isEditor) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = _memoFormHtml('modal');
}

// ─── YouTube 링크 모달 ───
let _ytModalDate = null;

function openYtModal(dateStr) {
    _ytModalDate = dateStr;
    const [y, m, d] = dateStr.split('-');
    document.getElementById('ytLinkModalTitle').textContent = 'YouTube 링크';
    document.getElementById('ytLinkInput').value = '';
    renderYtLinkList();
    document.getElementById('ytLinkModal').classList.add('open');
}

function closeYtModal() {
    document.getElementById('ytLinkModal').classList.remove('open');
    _ytModalDate = null;
}

function renderYtLinkList() {
    const list = document.getElementById('ytLinkList');
    const links = state.ytLinks.filter(yl => yl.date === _ytModalDate);
    if (!links.length) {
        list.innerHTML = '<div class="yt-empty-msg">등록된 링크가 없어요</div>';
        return;
    }
    list.innerHTML = links.map(yl => {
        const type = ytLinkType(yl.url);
        const badge = type ? `<span class="yt-badge yt-${type}">${type === 'long' ? 'Y' : 'S'}</span>` : '';
        return `<div class="yt-link-item">
            ${badge}
            <a href="${esc(safeUrl(yl.url))}" target="_blank" rel="noopener noreferrer">${esc(yl.url)}</a>
            <button class="yt-link-del" onclick="deleteYtLink(${jsArg(yl.id)})" title="삭제">✕</button>
        </div>`;
    }).join('');
}

async function saveYtLink() {
    const urlInput = document.getElementById('ytLinkInput').value.trim();
    if (!urlInput || !_ytModalDate) return;
    const url = normalizeOptionalUrl(urlInput);
    if (!url || !ytLinkType(url)) { showToast('유효한 YouTube URL을 입력해 주세요'); return; }
    const existing = state.ytLinks.filter(yl => yl.date === _ytModalDate);
    if (existing.length >= 3) { showToast('날짜당 최대 3개까지 등록할 수 있어요'); return; }
    await _ensureDb();
    const { data, error } = await db.from('youtube_links').insert({ date: _ytModalDate, url }).select();
    if (error) { showToast('저장 실패: ' + error.message); return; }
    state.ytLinks.push(data[0]);
    document.getElementById('ytLinkInput').value = '';
    renderYtLinkList();
    renderCalendar();
}

async function deleteYtLink(id) {
    await _ensureDb();
    const { error } = await db.from('youtube_links').delete().eq('id', id);
    if (error) { showToast('삭제 실패: ' + error.message); return; }
    state.ytLinks = state.ytLinks.filter(yl => yl.id !== id);
    renderYtLinkList();
    renderCalendar();
}

// ─── 방송정보 모달 ───
let _broadcastModalDate = null;

function renderBroadcastVodRows(rows = [{ title: '', url: '' }]) {
    const list = document.getElementById('broadcastVodList');
    if (!list) return;
    const normalizedRows = rows.length ? rows : [{ title: '', url: '' }];
    list.innerHTML = normalizedRows.map((row, i) => `
        <div class="broadcast-vod-row">
            <input type="text" class="broadcast-vod-title" value="${esc(row.title || '')}" placeholder="${i === 0 ? '다시보기' : `다시보기 ${i + 1}`}">
            <input type="url" class="broadcast-vod-url" value="${esc(row.url || '')}" placeholder="https://...">
            <button type="button" class="broadcast-vod-remove" onclick="removeBroadcastVodRow(this)" title="삭제">×</button>
        </div>
    `).join('');
    updateBroadcastVodRemoveButtons();
}

function addBroadcastVodRow(title = '', url = '') {
    const list = document.getElementById('broadcastVodList');
    if (!list) return;
    const rows = readBroadcastVodRows({ includeEmpty: true });
    rows.push({ title, url });
    renderBroadcastVodRows(rows);
}

function removeBroadcastVodRow(button) {
    const row = button?.closest('.broadcast-vod-row');
    if (!row) return;
    row.remove();
    const rows = readBroadcastVodRows({ includeEmpty: true });
    renderBroadcastVodRows(rows.length ? rows : [{ title: '', url: '' }]);
}

function updateBroadcastVodRemoveButtons() {
    const rows = document.querySelectorAll('#broadcastVodList .broadcast-vod-row');
    rows.forEach(btnRow => {
        const btn = btnRow.querySelector('.broadcast-vod-remove');
        if (btn) btn.style.visibility = rows.length <= 1 ? 'hidden' : '';
    });
}

function readBroadcastVodRows({ includeEmpty = false } = {}) {
    return Array.from(document.querySelectorAll('#broadcastVodList .broadcast-vod-row'))
        .map(row => ({
            title: row.querySelector('.broadcast-vod-title')?.value.trim() || '',
            url: row.querySelector('.broadcast-vod-url')?.value.trim() || '',
        }))
        .filter(row => includeEmpty || row.title || row.url);
}

function openBroadcastModal(dateStr) {
    if (!state.isEditor) return;
    _broadcastModalDate = dateStr;
    const info = broadcastInfoForDate(dateStr);
    document.getElementById('broadcastModalTitle').textContent = `${formatDate(dateStr)} 방송정보`;
    document.getElementById('broadcastDate').value = dateStr;
    document.getElementById('broadcastStartTime').value = timeInputValue(info?.start_time);
    document.getElementById('broadcastEndTime').value = timeInputValue(info?.end_time);
    renderBroadcastVodRows(broadcastRows(info));
    document.getElementById('broadcastMemo').value = info?.memo || '';
    document.getElementById('broadcastDeleteBtn').style.display = info ? '' : 'none';
    document.getElementById('broadcastModal').classList.add('open');
}

function closeBroadcastModal() {
    document.getElementById('broadcastModal').classList.remove('open');
    _broadcastModalDate = null;
}

async function saveBroadcastInfo() {
    if (!_broadcastModalDate || !state.isEditor) return;
    await _ensureDb();
    const startTime = normalizeTimeInput(document.getElementById('broadcastStartTime').value);
    const endTime = normalizeTimeInput(document.getElementById('broadcastEndTime').value);
    if (startTime === null || endTime === null) {
        showToast('방송시간은 18:01 또는 18:01:00 형식으로 입력해주세요');
        return;
    }
    const vodRows = readBroadcastVodRows()
        .filter(row => row.url)
        .map(row => ({ ...row, url: normalizeOptionalUrl(row.url) }));
    if (vodRows.some(row => !row.url)) {
        showToast('링크 URL은 http 또는 https 주소로 입력해주세요');
        return;
    }
    const vodUrls = vodRows.map(row => row.url).join('\n');
    const vodTitles = vodRows.map(row => row.title).join('\n');
    const hasVodTitles = vodRows.some(row => row.title);
    const payload = {
        date: _broadcastModalDate,
        start_time: startTime || null,
        end_time: endTime || null,
        vod_urls: vodUrls || null,
        vod_titles: hasVodTitles ? vodTitles : null,
        memo: document.getElementById('broadcastMemo').value.trim() || null,
        updated_at: new Date().toISOString(),
    };

    if (!payload.start_time && !payload.end_time && !payload.vod_urls && !payload.vod_titles && !payload.memo) {
        showToast('방송정보를 하나 이상 입력해주세요');
        return;
    }

    const { data, error } = await db
        .from('broadcast_infos')
        .upsert(payload, { onConflict: 'date' })
        .select();
    if (error) { showToast('저장 실패: ' + error.message); return; }

    const saved = data?.[0] || payload;
    const idx = state.broadcastInfos.findIndex(info => info.date === _broadcastModalDate);
    if (idx >= 0) state.broadcastInfos[idx] = saved;
    else state.broadcastInfos.push(saved);
    state.broadcastInfos.sort((a, b) => a.date.localeCompare(b.date));
    showToast('방송정보가 저장되었습니다');
    closeBroadcastModal();
    renderCalendar();
    openDayViewModal(saved.date);
}

async function deleteBroadcastInfo() {
    if (!_broadcastModalDate || !state.isEditor) return;
    if (!confirm('이 날짜의 방송정보를 삭제할까요?')) return;
    await _ensureDb();
    const { error } = await db.from('broadcast_infos').delete().eq('date', _broadcastModalDate);
    if (error) { showToast('삭제 실패: ' + error.message); return; }
    const dateStr = _broadcastModalDate;
    state.broadcastInfos = state.broadcastInfos.filter(info => info.date !== dateStr);
    showToast('방송정보가 삭제되었습니다');
    closeBroadcastModal();
    renderCalendar();
    openDayViewModal(dateStr);
}

// ─── 보기 모달 ───
function dayEventCardHtml(ev, dateStr) {
    const t = typeOf(ev.type);
    const time = ev.start_time ? ev.start_time.slice(0, 5) : '';
    const dateRange = ev.end_date && ev.end_date !== ev.date
        ? `${formatDate(ev.date)} ~ ${formatDate(ev.end_date)}`
        : '';
    const links = [];
    if (ev.vod_url) links.push(`<a class="day-link" href="${esc(safeUrl(ev.vod_url))}" target="_blank" rel="noopener noreferrer">참고링크</a>`);
    eventHotclipUrls(ev).forEach((url, i) => {
        links.push(`<a class="day-link hotclip" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">핫클립${i + 1}</a>`);
    });
    eventYoutubeLinks(ev).forEach(({ url, type }) => {
        links.push(`<a class="day-link yt" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${type === 'long' ? 'YouTube' : 'Shorts'}</a>`);
    });

    const eventSticker = ev.is_rest || ev.type === 'rest'
        ? stickerImg(MOOD_STICKERS.fan, 'day-event-sticker', '선풍기')
        : '';

    return `<div class="day-event-card" style="border-color:${t.border};background:${t.color};color:${t.text};">
        ${eventSticker}
        <div class="day-event-main">
            <div class="day-event-head">
                <span class="day-type-chip">${esc(t.icon)} ${esc(t.label)}</span>
                ${time ? `<span class="day-event-time">${esc(time)}</span>` : ''}
            </div>
            <div class="day-event-title">${esc(ev.title)}</div>
            ${ev.subtitle ? `<div class="day-event-sub">${esc(ev.subtitle)}</div>` : ''}
            ${ev.collab ? `<div class="day-event-sub">w. ${esc(ev.collab)}</div>` : ''}
            ${dateRange ? `<div class="day-event-meta">${dateRange}</div>` : ''}
            ${links.length ? `<div class="day-link-row">${links.join('')}</div>` : ''}
        </div>
        ${state.isEditor ? `<div class="day-event-actions">
            <button class="day-edit-btn" onclick="openEditModal(${jsArg(ev.id)}, { type: 'day', date: ${jsArg(dateStr)} })">수정</button>
            <button class="day-delete-btn" onclick="event.stopPropagation();deleteEvent(${jsArg(ev.id)})">삭제</button>
        </div>` : ''}
    </div>`;
}

function openDayViewModal(dateStr) {
    const events = calendarEventsForDate(dateStr);
    const info = broadcastInfoForDate(dateStr);
    const time = broadcastTimeLabel(info);
    const links = broadcastLinks(info);
    const ytLinks = state.ytLinks.filter(yl => yl.date === dateStr);

    let html = `<div class="modal-title">${formatDate(dateStr)}</div>`;
    html += `<div class="day-modal-section">
        <div class="day-section-title">일정</div>
        ${events.length
            ? `<div class="day-event-list">${events.map(ev => dayEventCardHtml(ev, dateStr)).join('')}</div>`
            : dayEmptyHtml('등록된 일정이 없어요', 'empty')}
    </div>`;

    html += `<div class="day-modal-section">
        <div class="day-section-title">방송정보</div>
        ${info
            ? `<div class="broadcast-card">
                ${time ? `<div class="view-section"><div class="view-label">방송시간</div><div class="view-value">${esc(time)}</div></div>` : ''}
                ${info.memo ? `<div class="view-section"><div class="view-label">메모</div><div class="view-value" style="white-space:pre-wrap">${esc(info.memo)}</div></div>` : ''}
                ${links.length ? `<div class="day-link-row broadcast-links">${links.map(link => `<a class="vod-link" href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">▶ ${esc(link.title)}</a>`).join('')}</div>` : ''}
            </div>`
            : dayEmptyHtml('아직 방송정보가 등록되지 않았어요', 'pre')}
        ${ytLinks.length ? `<div class="day-section-title sub">YouTube 링크</div><div class="day-link-row">${ytLinks.map(yl => {
            const type = ytLinkType(yl.url);
            return `<a class="vod-link yt-vod-link" href="${esc(safeUrl(yl.url))}" target="_blank" rel="noopener noreferrer">${type === 'short' ? '▶ YouTube Shorts' : '▶ YouTube'}</a>`;
        }).join('')}</div>` : ''}
    </div>`;

    document.getElementById('viewContent').innerHTML = html;
    document.getElementById('viewBtns').innerHTML = state.isEditor
        ? `<button class="btn btn-primary" onclick="openBroadcastModal(${jsArg(dateStr)})">방송정보 편집</button>
           <button class="btn btn-secondary" onclick="closeViewModal();openAddModal(${jsArg(dateStr)})">일정 추가</button>
           <button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`
        : `<button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`;
    document.getElementById('viewModal').classList.add('open');
}

function openViewModal(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;
    const t = typeOf(ev.type);

    let html = `<div class="modal-title">${esc(ev.title)}</div>`;
    html += `<span class="type-badge" style="${typeStyle(t)}">${esc(t.icon)} ${t.label}</span>`;

    if (ev.date) {
        let d = formatDate(ev.date);
        if (ev.end_date && ev.end_date !== ev.date) d += ` ~ ${formatDate(ev.end_date)}`;
        html += `<div class="view-section"><div class="view-label">날짜</div><div class="view-value">${d}</div></div>`;
    }
    if (ev.start_time) {
        let t2 = ev.start_time.slice(0, 5);
        if (ev.duration) t2 += ` (${esc(ev.duration)})`;
        html += `<div class="view-section"><div class="view-label">시간</div><div class="view-value">${t2}</div></div>`;
    }
    if (ev.collab)
        html += `<div class="view-section"><div class="view-label">합방</div><div class="view-value">${esc(ev.collab)}</div></div>`;
    if (ev.subtitle)
        html += `<div class="view-section"><div class="view-label">부제</div><div class="view-value">${esc(ev.subtitle)}</div></div>`;
    if (ev.memo)
        html += `<div class="view-section"><div class="view-label">메모</div><div class="view-value" style="white-space:pre-wrap">${esc(ev.memo)}</div></div>`;
    if (ev.vod_url)
        html += `<a class="vod-link" href="${esc(safeUrl(ev.vod_url))}" target="_blank" rel="noopener noreferrer">▶ 참고링크</a>`;
    eventHotclipUrls(ev).forEach((url, i) => {
        html += `<a class="vod-link hotclip-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">▶ 핫클립${i + 1}</a>`;
    });
    eventYoutubeLinks(ev).forEach(({ url, type }) => {
        html += `<a class="vod-link yt-vod-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${type === 'long' ? '▶ YouTube' : '▶ YouTube Shorts'}</a>`;
    });

    document.getElementById('viewContent').innerHTML = html;
    document.getElementById('viewBtns').innerHTML = state.isEditor
        ? `<button class="btn btn-primary"  onclick="openEditModal(${jsArg(id)})">수정</button>
           <button class="btn btn-secondary" onclick="copyEvent(${jsArg(id)})">복사</button>
           <button class="btn btn-secondary" onclick="repeatWeekly(${jsArg(id)})">매주 반복</button>
           <button class="btn btn-danger"   onclick="deleteEvent(${jsArg(id)})">삭제</button>
           <button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`
        : `<button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`;

    document.getElementById('viewModal').classList.add('open');

    const titleEl = document.querySelector('#viewContent .modal-title');
    if (titleEl) {
        let fs = 26;
        titleEl.style.fontSize = fs + 'px';
        const maxH = fs * 1.45 * 4;
        while (fs > 13 && titleEl.scrollHeight > maxH) {
            titleEl.style.fontSize = --fs + 'px';
        }
    }
}
function closeViewModal() { document.getElementById('viewModal').classList.remove('open'); }

const UP_LOCAL_RANKING_CACHE_KEY = 'beadyoUpRankingLastSnapshot:v1';
const UP_LOCAL_RANKING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const UP_LOCAL_RANKING_LIMIT = 200;

function compactUpRankingRow(row, index) {
    return {
        rank: Number(row.rank || index + 1),
        bj_id: String(row.bj_id || '').trim(),
        name: String(row.name || '').trim(),
        profile_url: String(row.profile_url || '').trim(),
        timestamp: String(row.timestamp || '').trim(),
        up_count: Number(row.up_count || 0),
        reply_no: String(row.reply_no || '').trim(),
    };
}

function compactUpEventForCache(event) {
    return {
        id: event.id,
        tab: event.tab_name || event.tab || '',
        title: event.title || '',
        soop_url: event.soop_url || '',
        show_on_startup: isUpStartupEvent(event),
        live_updated_at: event.live_updated_at || null,
        ranking: Array.isArray(event.ranking)
            ? event.ranking.slice(0, UP_LOCAL_RANKING_LIMIT).map(compactUpRankingRow)
            : [],
    };
}

function writeLocalUpRankingSnapshot(data) {
    const events = (data?.events || []).map(compactUpEventForCache);
    if (!events.some(event => event.ranking.length)) {
        clearLocalUpRankingSnapshot();
        return;
    }
    try {
        localStorage.setItem(UP_LOCAL_RANKING_CACHE_KEY, JSON.stringify({
            updated: data.updated || new Date().toISOString(),
            saved_at: new Date().toISOString(),
            events,
        }));
    } catch {}
}

function clearLocalUpRankingSnapshot() {
    try {
        localStorage.removeItem(UP_LOCAL_RANKING_CACHE_KEY);
    } catch {}
}

function readLocalUpRankingSnapshot(options = {}) {
    try {
        const raw = localStorage.getItem(UP_LOCAL_RANKING_CACHE_KEY);
        if (!raw) return null;
        const parsed = normalizeUpCachePayload(JSON.parse(raw));
        if (!parsed) return null;
        const savedAt = new Date(parsed.saved_at || parsed.updated || 0).getTime();
        if (!Number.isFinite(savedAt) || Date.now() - savedAt > UP_LOCAL_RANKING_MAX_AGE_MS) {
            localStorage.removeItem(UP_LOCAL_RANKING_CACHE_KEY);
            return null;
        }
        const events = (parsed.events || [])
            .filter(event => !options.startupOnly || isUpStartupEvent(event))
            .map(upEventFromRow)
            .filter(event => Array.isArray(event.ranking) && event.ranking.length);
        return events.length ? { updated: parsed.updated || parsed.saved_at || null, events } : null;
    } catch {
        return null;
    }
}

async function openUpModal(options = {}) {
    const startupOnly = options.startupOnly === true;
    const preloadedEvents = Array.isArray(options.sbEvents) ? options.sbEvents : null;
    _upModalIsAutoPrompt = options.auto === true;
    document.getElementById('upModal').classList.add('open');
    document.getElementById('upModalContent').innerHTML = upEmptyHtml('불러오는 중...', 'loading');

    // Supabase에서 현재 활성 이벤트 목록 직접 조회
    let sbEvents = [];
    let loadedActiveEvents = false;
    if (preloadedEvents) {
        sbEvents = preloadedEvents.filter(e => !startupOnly || isUpStartupEvent(e));
        loadedActiveEvents = true;
    } else {
        try {
            const data = await fetchActiveUpEvents();
            sbEvents = (data || []).filter(e => !startupOnly || isUpStartupEvent(e));
            loadedActiveEvents = true;
        } catch {
            document.getElementById('upModalContent').innerHTML =
                upEmptyHtml('UP 이벤트 목록을 확인하지 못했습니다', 'empty');
            return;
        }
    }

    if (loadedActiveEvents && !sbEvents.length) {
        clearLocalUpRankingSnapshot();
        _upCurrentData = { updated: null, events: [] };
        renderUpModal(_upCurrentData, false);
        return;
    }

    // Supabase 활성 이벤트 목록을 기준으로만 캐시 랭킹을 병합한다.
    const cachedData = await loadUpRankingCache();
    const localSnapshot = readLocalUpRankingSnapshot({ startupOnly });
    const cachedMap = {};
    for (const e of (cachedData.events || [])) cachedMap[e.id] = e;
    for (const e of (localSnapshot?.events || [])) cachedMap[e.id] = e;

    const mergedEvents = sbEvents.map(e => ({ ...upEventFromRow(e), ranking: cachedMap[e.id]?.ranking || [] }));

    _upCurrentData = { updated: localSnapshot?.updated || cachedData.updated || null, events: mergedEvents };
    writeLocalUpRankingSnapshot(_upCurrentData);
    renderUpModal(_upCurrentData, true);
}
function closeUpModal() {
    document.getElementById('upModal').classList.remove('open');
    _upModalIsAutoPrompt = false;
}

const UP_AUTO_POPUP_HIDE_UNTIL_KEY = 'beadyoUpAutoPopupHideUntil';

function upAutoPopupHiddenUntil() {
    try {
        const value = localStorage.getItem(UP_AUTO_POPUP_HIDE_UNTIL_KEY) || '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= dateToStr(new Date())) return value;
        if (value) localStorage.removeItem(UP_AUTO_POPUP_HIDE_UNTIL_KEY);
    } catch {}
    return '';
}

function hideUpAutoPopupUntil(daysFromToday) {
    const until = dateToStr(addDays(new Date(), daysFromToday));
    try {
        localStorage.setItem(UP_AUTO_POPUP_HIDE_UNTIL_KEY, until);
    } catch {}
}

function dismissUpAutoPopup(mode) {
    hideUpAutoPopupUntil(mode === 'week' ? 6 : 0);
    closeUpModal();
}

async function maybeOpenUpModalOnStart() {
    if (_upAutoPopupChecked) return;
    _upAutoPopupChecked = true;
    if (upAutoPopupHiddenUntil()) return;
    try {
        const data = await fetchActiveUpEvents();
        const events = data || [];
        if (events.some(isUpStartupEvent)) {
            openUpModal({ auto: true, startupOnly: true, sbEvents: events });
        }
    } catch {}
}

function parseSoopUrl(url) {
    const clean = url.split('#')[0];
    const m = clean.match(/\/(?:station\/)?(\w+)\/post\/(\d+)/);
    return m ? [m[1], m[2]] : [null, null];
}

function upJsonCacheUrl() {
    return 'up.json';
}

function normalizeUpCachePayload(payload) {
    if (!payload || !Array.isArray(payload.events)) return null;
    return {
        updated: payload.updated || payload.row_updated_at || null,
        saved_at: payload.saved_at || null,
        events: payload.events,
    };
}

async function loadUpRankingCache() {
    try {
        const res = await fetch(upJsonCacheUrl(), { cache: 'force-cache' });
        if (res.ok) {
            const cached = normalizeUpCachePayload(await res.json());
            if (cached) return cached;
        }
    } catch {}

    try {
        const cached = normalizeUpCachePayload(await fetchRuntimeCache('up_ranking'));
        if (cached) return cached;
    } catch {}

    return { updated: null, events: [] };
}

const UP_LIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const _upLiveFetchPromises = new Map();
const _upLiveRankingCache = new Map();

function upLiveCacheKey(bjId, postNo) {
    return `beadyo_up_live_${bjId}_${postNo}`;
}

function readCachedUpRanking(bjId, postNo) {
    const cached = _upLiveRankingCache.get(upLiveCacheKey(bjId, postNo));
    if (!cached || !Array.isArray(cached.ranking)) return null;
    if (Date.now() - Number(cached.savedAt || 0) > UP_LIVE_CACHE_TTL_MS) {
        _upLiveRankingCache.delete(upLiveCacheKey(bjId, postNo));
        return null;
    }
    return { ranking: cached.ranking, updatedAt: cached.updatedAt || cached.savedAt };
}

function writeCachedUpRanking(bjId, postNo, ranking) {
    const updatedAt = new Date().toISOString();
    _upLiveRankingCache.set(upLiveCacheKey(bjId, postNo), {
        savedAt: Date.now(),
        updatedAt,
        ranking,
    });
    return updatedAt;
}

async function fetchSoopRankingLive(bjId, postNo, options = {}) {
    const cacheKey = `${bjId}:${postNo}`;
    if (!options.force) {
        const cached = readCachedUpRanking(bjId, postNo);
        if (cached) return cached;
        if (_upLiveFetchPromises.has(cacheKey)) return _upLiveFetchPromises.get(cacheKey);
    }
    const promise = fetchSoopRankingLiveFresh(bjId, postNo).finally(() => {
        _upLiveFetchPromises.delete(cacheKey);
    });
    _upLiveFetchPromises.set(cacheKey, promise);
    return promise;
}

async function fetchSoopRankingLiveFresh(bjId, postNo) {
    const PROXY = 'https://clever-rhino-36.hanul4269.deno.net';
    const allItems = [];
    let liveUpdatedAt = null;
    let page = 1, lastPage = 1;
    do {
        const target = `https://api-channel.sooplive.com/v1.1/channel/${bjId}/post/${postNo}/comment?page=${page}&orderBy=reg_date&cCommentNo=0&perPage=100`;
        const url = `${PROXY}?url=${encodeURIComponent(target)}`;
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!resp.ok) break;
            liveUpdatedAt = liveUpdatedAt || new Date().toISOString();
            const d = await resp.json();
            const items = d.data || [];
            for (const it of items) {
                if (it.pCommentNo) {
                    allItems.push({
                        bj_id:       String(it.userId || '').trim(),
                        name:        String(it.userNick || '').trim(),
                        profile_url: String(it.profileImage || '').trim(),
                        timestamp:   String(it.regDate || '').trim(),
                        up_count:    parseInt(it.likeCnt || 0) || 0,
                        reply_no:    String(it.pCommentNo || ''),
                    });
                }
            }
            lastPage = (d.meta || {}).lastPage || 1;
        } catch {
            break;
        }
        page++;
    } while (page <= lastPage);

    if (!allItems.length) return null;
    allItems.sort((a, b) => b.up_count - a.up_count);
    allItems.forEach((r, i) => r.rank = i + 1);
    const updatedAt = writeCachedUpRanking(bjId, postNo, allItems) || liveUpdatedAt;
    return { ranking: allItems, updatedAt };
}

function renderUpModal(data, fetchLive = false) {
    const events = data.events || [];
    if (!events.length) {
        document.getElementById('upModalContent').innerHTML =
            upEmptyHtml('진행 중인 UP 이벤트가 없습니다', 'empty');
        return;
    }
    let currentIdx = 0;

    function renderTab(idx) {
        currentIdx = idx;
        const ev = events[idx];
        const updateLabel = ev.live_updated_at
            ? `실시간 업데이트: ${new Date(ev.live_updated_at).toLocaleString('ko-KR')}`
            : (fetchLive ? '실시간 업데이트 확인 중...' : `캐시 업데이트: ${data.updated ? new Date(data.updated).toLocaleString('ko-KR') : '-'}`);
        const tabs = events.map((e, i) =>
            `<button class="up-tab-btn${i===idx?' active':''}" onclick="renderUpTab(${i})">${esc(e.tab)}</button>`
        ).join('');
        const ranking = displayUpRanking(ev);
        const baseUrl = soopPostBaseUrl(ev.soop_url);
        const highlightReplyNo = parseSoopHighlightReplyNo(ev.soop_url);
        const eventHref = safeUrl(ev.soop_url);
        const baseHref = safeUrl(baseUrl || ev.soop_url);
        const eventActions = highlightReplyNo
            ? `<a class="up-goto-btn primary" href="${esc(eventHref)}" target="_blank" rel="noopener noreferrer">UP하러 가기</a>
               <a class="up-goto-btn secondary" href="${esc(baseHref)}" target="_blank" rel="noopener noreferrer">원문 보기</a>`
            : `<a class="up-goto-btn" href="${esc(baseHref)}" target="_blank" rel="noopener noreferrer">UP 바로가기</a>`;
        const items = ranking.length
            ? ranking.map(r => {
                const cls = r.rank <= 3 ? ` top${r.rank}` : '';
                const replyNo = String(r.reply_no || '').replace(/\D/g, '');
                const href = safeUrl(replyNo ? `${baseUrl}#comment_noti${replyNo}` : ev.soop_url);
                const rankSticker = r._highlight
                    ? stickerImg(MOOD_STICKERS.highlight, 'up-rank-sticker', '하이라이트')
                    : r.rank === 1
                        ? stickerImg(MOOD_STICKERS.relay, 'up-rank-sticker', '1위')
                        : '';
                return `<div class="up-rank-item${r._highlight ? ' is-highlight' : ''}" role="link" tabindex="0" data-href="${esc(href)}"
                    onclick="window.open(this.dataset.href,'_blank','noopener noreferrer')"
                    onkeydown="if(event.key==='Enter')window.open(this.dataset.href,'_blank','noopener noreferrer')">
                    <div class="up-rank-num${cls}">${r.rank}</div>
                    <img class="up-rank-profile" src="${esc(safeImageUrl(r.profile_url, 'stickers/s8.png'))}"
                         onerror="this.src='stickers/s8.png'" alt="" loading="lazy">
                    <div class="up-rank-info">
                        <div class="up-rank-name">${esc(r.name)}${r._highlight ? '<span class="up-rank-badge">하이라이트</span>' : ''}</div>
                        <div class="up-rank-handle">@${esc(r.bj_id)}</div>
                        <div class="up-rank-time">${esc(r.timestamp)}</div>
                    </div>
                    ${rankSticker}
                    <div class="up-rank-count">👍 ${Number(r.up_count).toLocaleString()}</div>
                </div>`;
            }).join('')
            : upEmptyHtml('랭킹 데이터를 불러오는 중입니다...', 'loading');

        document.getElementById('upModalContent').innerHTML = `
            <div class="up-tabs">${tabs}</div>
            <div class="up-event-header">
                <div class="up-event-title">${esc(ev.title)}</div>
                <div class="up-event-actions">${eventActions}</div>
            </div>
            <div class="up-ranking-list">${items}</div>
            <div class="up-updated">${esc(updateLabel)}</div>
            ${_upModalIsAutoPrompt ? `
                <div class="up-popup-actions">
                    <button type="button" onclick="dismissUpAutoPopup('today')">오늘 하루 보지 않기</button>
                    <button type="button" onclick="dismissUpAutoPopup('week')">일주일간 보지 않기</button>
                </div>` : ''}`;
    }

    const liveRequested = new Set();
    async function refreshLiveRanking(idx) {
        if (!fetchLive || liveRequested.has(idx)) return;
        const ev = events[idx];
        if (!ev) return;
        liveRequested.add(idx);
        const [bjId, postNo] = parseSoopUrl(ev.soop_url);
        if (!bjId || !postNo) {
            liveRequested.delete(idx);
            return;
        }
        const result = await fetchSoopRankingLive(bjId, postNo);
        if (result !== null) {
            ev.ranking = result.ranking;
            ev.live_updated_at = result.updatedAt;
            _upCurrentData = { updated: result.updatedAt || data.updated || null, events };
            writeLocalUpRankingSnapshot(_upCurrentData);
            if (currentIdx === idx) renderTab(idx);
        } else {
            liveRequested.delete(idx);
        }
    }

    renderUpTab = (idx) => {
        renderTab(idx);
        refreshLiveRanking(idx);
    };
    renderTab(0);

    if (fetchLive) {
        refreshLiveRanking(0);
        events.forEach((_, idx) => {
            if (idx === 0) return;
            setTimeout(() => { refreshLiveRanking(idx); }, 350 + idx * 250);
        });
    }
}

// ─── 추가/수정 모달 ───
function populateTypeSelect() {
    document.getElementById('editType').innerHTML = EVENT_TYPES.map(t =>
        `<option value="${t.key}">${t.label}</option>`
    ).join('');
}

// ── 시간 피커 ──
const _TP_H = 36;
let _tpDeleting = false;

function _tpBuild(col, count) {
    let html = '<div class="tp-pad"></div>';
    for (let i = 0; i < count; i++)
        html += `<div class="tp-item">${String(i).padStart(2, '0')}</div>`;
    html += '<div class="tp-pad"></div>';
    col.innerHTML = html;
}

function _tpVal(col, count) {
    return Math.max(0, Math.min(count - 1, Math.round(col.scrollTop / _TP_H)));
}

function _tpSync() {
    const wrap = document.getElementById('tpWrap');
    if (!wrap || wrap.classList.contains('disabled')) return;
    const h = document.getElementById('tpHour');
    const m = document.getElementById('tpMin');
    const inp = document.getElementById('editTime');
    if (!h || !m || !inp) return;
    inp.value = `${String(_tpVal(h, 24)).padStart(2, '0')}:${String(_tpVal(m, 60)).padStart(2, '0')}`;
}

function _tpAddMouseDrag(col) {
    if (col._tpCleanup) col._tpCleanup();

    let isDragging = false;
    let lastY = 0, lastTime = 0;
    let velocity = 0, totalMoved = 0;
    let animId = null;
    const FRICTION = 0.88;
    const MAX_V = 50;
    const velSamples = [];

    function cancelAnim() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
    }

    function snapTo(fromScrollTop) {
        cancelAnim();
        const target = Math.round(fromScrollTop / _TP_H) * _TP_H;
        const s0 = col.scrollTop;
        const dist = target - s0;
        if (Math.abs(dist) < 0.5) {
            col.scrollTop = target;
            col.classList.remove('dragging');
            _tpSync();
            return;
        }
        const dur = Math.min(220, Math.max(40, Math.abs(dist) * 0.9));
        const t0 = performance.now();
        function frame(now) {
            const p = Math.min(1, (now - t0) / dur);
            const ease = 1 - Math.pow(1 - p, 3);
            col.scrollTop = s0 + dist * ease;
            if (p < 1) { animId = requestAnimationFrame(frame); }
            else {
                col.scrollTop = target;
                col.classList.remove('dragging');
                animId = null;
                _tpSync();
            }
        }
        animId = requestAnimationFrame(frame);
    }

    function runInertia(prevTime) {
        const now = performance.now();
        const dt = Math.min(32, now - prevTime);
        velocity *= Math.pow(FRICTION, dt / 16);
        if (Math.abs(velocity) < 0.5) { snapTo(col.scrollTop); return; }
        const prev = col.scrollTop;
        col.scrollTop += velocity * (dt / 16);
        if (Math.abs(col.scrollTop - prev) < 0.1) { snapTo(col.scrollTop); return; }
        animId = requestAnimationFrame(t => runInertia(t));
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        cancelAnim();
        isDragging = true;
        lastY = e.clientY;
        lastTime = performance.now();
        velocity = 0;
        totalMoved = 0;
        velSamples.length = 0;
        col.classList.add('dragging', 'grabbing');
        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!isDragging) return;
        const now = performance.now();
        const dt = Math.max(1, now - lastTime);
        const dy = e.clientY - lastY;
        totalMoved += Math.abs(dy);
        velSamples.push({ v: -dy * 16 / dt, t: now });
        while (velSamples.length > 1 && velSamples[0].t < now - 100) velSamples.shift();
        col.scrollTop -= dy;
        lastY = e.clientY;
        lastTime = now;
    }

    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        col.classList.remove('grabbing');

        if (totalMoved < 6) {
            const item = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tp-item');
            if (item) {
                const idx = [...col.querySelectorAll('.tp-item')].indexOf(item);
                if (idx >= 0) { snapTo(idx * _TP_H); return; }
            }
            snapTo(col.scrollTop);
            return;
        }

        const now = performance.now();
        const recent = velSamples.filter(s => s.t >= now - 80);
        velocity = recent.length > 0
            ? recent.reduce((s, x) => s + x.v, 0) / recent.length
            : 0;
        velocity = Math.max(-MAX_V, Math.min(MAX_V, velocity));
        animId = requestAnimationFrame(t => runInertia(t));
    }

    col.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    col._tpCleanup = () => {
        cancelAnim();
        isDragging = false;
        col.classList.remove('dragging', 'grabbing');
        col.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        delete col._tpCleanup;
    };
}

function toggleTimePicker() {
    const wrap = document.getElementById('tpWrap');
    const btn = document.getElementById('tpToggleBtn');
    const inp = document.getElementById('editTime');
    const isOpen = !wrap.classList.contains('disabled');
    if (isOpen) {
        wrap.classList.add('disabled');
        btn.classList.remove('active');
    } else {
        wrap.classList.remove('disabled');
        btn.classList.add('active');
        const match = inp.value.match(/^(\d{1,2}):(\d{2})$/);
        const h = match ? Math.min(23, parseInt(match[1], 10)) : 0;
        const m = match ? Math.min(59, parseInt(match[2], 10)) : 0;
        setTimeout(() => {
            document.getElementById('tpHour').scrollTo({ top: h * _TP_H, behavior: 'instant' });
            document.getElementById('tpMin').scrollTo({ top: m * _TP_H, behavior: 'instant' });
            _tpSync();
        }, 10);
    }
}

function onTimeKeyDown(e) {
    if (e.key !== 'Backspace') return;
    const inp = e.target;
    const val = inp.value;
    const pos = inp.selectionStart;
    if (inp.selectionStart !== inp.selectionEnd) { _tpDeleting = true; return; }

    const colonIdx = val.indexOf(':');

    // 커서가 콜론 바로 뒤: 콜론 건너뛰고 시간 마지막 자리 삭제
    if (colonIdx >= 0 && pos === colonIdx + 1) {
        e.preventDefault();
        let newVal, newPos;
        if (colonIdx > 0) {
            newVal = val.slice(0, colonIdx - 1) + val.slice(colonIdx);
            newPos = colonIdx - 1;
        } else {
            newVal = val.slice(1);
            newPos = 0;
        }
        inp.value = newVal;
        inp.setSelectionRange(newPos, newPos);
        onTimeTextInput(inp);
        return;
    }

    // 콜론만 남은 경우 (:) → 전체 삭제
    if (colonIdx === 0 && pos === 0) {
        e.preventDefault();
        inp.value = '';
        onTimeTextInput(inp);
        return;
    }

    _tpDeleting = true;
}

function onTimeTextInput(inp) {
    const deleting = _tpDeleting;
    _tpDeleting = false;
    let val = inp.value.replace(/[^\d:]/g, '');
    if (val !== inp.value) inp.value = val;
    if (!deleting && val.length === 2 && !val.includes(':')) {
        inp.value = val + ':';
        val = inp.value;
    }
    const wrap = document.getElementById('tpWrap');
    if (!wrap || wrap.classList.contains('disabled')) return;
    const match = val.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
        const h = Math.min(23, parseInt(match[1], 10));
        const m = Math.min(59, parseInt(match[2], 10));
        document.getElementById('tpHour')?.scrollTo({ top: h * _TP_H, behavior: 'smooth' });
        document.getElementById('tpMin')?.scrollTo({ top: m * _TP_H, behavior: 'smooth' });
    }
}

function onTimeEnableChange() {}

function initTimePicker(value) {
    const hCol = document.getElementById('tpHour');
    const mCol = document.getElementById('tpMin');
    const wrap = document.getElementById('tpWrap');
    const btn = document.getElementById('tpToggleBtn');
    const inp = document.getElementById('editTime');
    if (!hCol || !mCol) return;

    _tpBuild(hCol, 24);
    _tpBuild(mCol, 60);
    _tpAddMouseDrag(hCol);
    _tpAddMouseDrag(mCol);

    wrap.classList.add('disabled');
    btn?.classList.remove('active');
    inp.value = value || '';

    const h = value ? parseInt(value, 10) : 0;
    const m = value ? parseInt(value.split(':')[1], 10) : 0;

    setTimeout(() => {
        hCol.scrollTo({ top: h * _TP_H, behavior: 'instant' });
        mCol.scrollTo({ top: m * _TP_H, behavior: 'instant' });
    }, 30);

    hCol.removeEventListener('scroll', _tpSync);
    mCol.removeEventListener('scroll', _tpSync);
    hCol.addEventListener('scroll', _tpSync, { passive: true });
    mCol.addEventListener('scroll', _tpSync, { passive: true });
}

function openAddModalWithType(typeKey) {
    if (!state.isEditor) return;
    const today = new Date();
    openAddModal(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()), typeKey);
}

let _editReturnContext = null;

function openAddModal(dateStr, type = 'chat') {
    _editReturnContext = null;
    populateTypeSelect();
    document.getElementById('editModalTitle').textContent = '일정 추가';
    document.getElementById('editId').value        = '';
    document.getElementById('editDate').value      = dateStr;
    document.getElementById('editEndDate').value   = '';
    initTimePicker('');
    document.getElementById('editDuration').value  = '';
    document.getElementById('editTitle').value     = '';
    document.getElementById('editType').value      = type;
    document.getElementById('editCollab').value    = '';
    document.getElementById('editSubtitle').value  = '';
    document.getElementById('editVodUrl').value    = '';
    setHotclipInputs([]);
    document.getElementById('editMemo').value      = '';
    document.getElementById('editIsRest').checked  = false;
    const preservedLinksInput = document.getElementById('editPreservedLinks');
    if (preservedLinksInput) preservedLinksInput.value = '';
    document.getElementById('editModal').classList.add('open');
}

function openEditModal(id, returnContext = null) {
    _editReturnContext = returnContext || { type: 'event', id };
    closeViewModal();
    const ev = state.events.find(e => e.id === id);
    if (!ev) {
        _editReturnContext = null;
        return;
    }
    fillEditForm(ev, '일정 수정', ev.id);
    document.getElementById('editModal').classList.add('open');
}

function reopenEditReturnContext(context) {
    if (!context) return;
    if (context.type === 'day' && context.date) {
        openDayViewModal(context.date);
        return;
    }
    if (context.type === 'event' && context.id && state.events.some(e => e.id === context.id)) {
        openViewModal(context.id);
    }
}

function fillEditForm(ev, title, id = '') {
    populateTypeSelect();
    document.getElementById('editModalTitle').textContent = title;
    document.getElementById('editId').value        = id;
    document.getElementById('editDate').value      = ev.date ?? '';
    document.getElementById('editEndDate').value   = ev.end_date ?? '';
    initTimePicker(ev.start_time ? ev.start_time.slice(0, 5) : '');
    document.getElementById('editDuration').value  = ev.duration ?? '';
    document.getElementById('editTitle').value     = ev.title ?? '';
    document.getElementById('editType').value      = ev.type ?? 'chat';
    document.getElementById('editCollab').value    = ev.collab ?? '';
    document.getElementById('editSubtitle').value  = ev.subtitle ?? '';
    document.getElementById('editVodUrl').value    = ev.vod_url ?? '';
    setHotclipInputs(eventHotclipUrls(ev));
    document.getElementById('editMemo').value      = ev.memo ?? '';
    document.getElementById('editIsRest').checked  = ev.is_rest ?? false;
    const preservedLinksInput = document.getElementById('editPreservedLinks');
    if (preservedLinksInput) preservedLinksInput.value = preservedScheduleLinkLines(ev).join('\n');
}

function setHotclipInputs(urls = []) {
    document.querySelectorAll('.edit-hotclip-url').forEach((input, i) => {
        input.value = urls[i] || '';
    });
}

function readHotclipInputs() {
    const urls = [];
    for (const [i, input] of Array.from(document.querySelectorAll('.edit-hotclip-url')).entries()) {
        const raw = input.value.trim();
        if (!raw) continue;
        const url = normalizeOptionalUrl(raw);
        if (!url) return { error: `핫클립${i + 1} URL은 http 또는 https 주소로 입력해주세요` };
        urls.push(url);
    }
    return { urls: urls.slice(0, 3) };
}
function closeEditModal(options = {}) {
    const { reopenView = true } = options;
    document.getElementById('editModal').classList.remove('open');
    const returnContext = _editReturnContext;
    _editReturnContext = null;
    if (reopenView) reopenEditReturnContext(returnContext);
}

function copyEvent(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev || !state.isEditor) return;
    closeViewModal();
    fillEditForm(ev, '일정 복사', '');
    document.getElementById('editModal').classList.add('open');
}

async function repeatWeekly(id) {
    await _ensureDb();
    const ev = state.events.find(e => e.id === id);
    if (!ev || !state.isEditor) return;
    const count = Number(prompt('몇 주 반복할까요? 다음 주부터 생성됩니다.', '4'));
    if (!Number.isInteger(count) || count < 1 || count > 24) {
        showToast('1~24 사이 숫자로 입력해주세요');
        return;
    }
    const payloads = Array.from({ length: count }, (_, i) => {
        const offset = (i + 1) * 7;
        const nextDate = dateToStr(addDays(dateFromStr(ev.date), offset));
        const payload = {
            date: nextDate,
            end_date: ev.end_date ? dateToStr(addDays(dateFromStr(ev.end_date), offset)) : null,
            start_time: ev.start_time || null,
            duration: ev.duration || null,
            title: ev.title,
            type: ev.type,
            collab: ev.collab || null,
            subtitle: ev.subtitle || null,
            vod_url: ev.vod_url || null,
            memo: ev.memo || null,
            is_rest: !!ev.is_rest,
            youtube_links: ev.youtube_links || null,
            sort_order: nextSortOrderForDate(nextDate),
        };
        return payload;
    });
    const { error } = await db.from('schedules').insert(payloads);
    if (error) { showToast('반복 생성 실패: ' + error.message); return; }
    showToast(`${count}개 반복 일정이 생성되었습니다`);
    closeViewModal();
    await loadEvents();
}

async function saveEvent() {
    await _ensureDb();
    const title = document.getElementById('editTitle').value.trim().replace(/\n{2,}/g, '\n');
    if (!title) { showToast('제목을 입력해주세요'); return; }
    const date = document.getElementById('editDate').value;
    if (!date)  { showToast('날짜를 선택해주세요'); return; }
    const vodUrlInput = document.getElementById('editVodUrl').value.trim();
    const vodUrl = normalizeOptionalUrl(vodUrlInput);
    if (vodUrlInput && !vodUrl) { showToast('링크 URL은 http 또는 https 주소로 입력해주세요'); return; }
    const hotclipResult = readHotclipInputs();
    if (hotclipResult.error) { showToast(hotclipResult.error); return; }
    const preservedLinks = scheduleLinkLines(document.getElementById('editPreservedLinks')?.value || '');
    const scheduleLinks = [
        ...preservedLinks,
        ...hotclipResult.urls.map(encodedHotclipLine),
    ];

    const payload = {
        date,
        end_date:   document.getElementById('editEndDate').value   || null,
        start_time: document.getElementById('editTime').value      || null,
        duration:   document.getElementById('editDuration').value.trim() || null,
        title,
        type:       document.getElementById('editType').value,
        collab:     document.getElementById('editCollab').value.trim()   || null,
        subtitle:   document.getElementById('editSubtitle').value.trim() || null,
        vod_url:    vodUrl || null,
        memo:       document.getElementById('editMemo').value.trim()     || null,
        is_rest:    document.getElementById('editIsRest').checked,
        youtube_links: scheduleLinks.length ? scheduleLinks.join('\n') : null,
    };

    const id = document.getElementById('editId').value;
    if (!id) payload.sort_order = nextSortOrderForDate(date);
    const { error } = id
        ? await db.from('schedules').update(payload).eq('id', id)
        : await db.from('schedules').insert(payload);

    if (error) { showToast('저장 실패: ' + error.message); return; }
    showToast(id ? '수정되었습니다' : '추가되었습니다');
    const returnContext = id ? _editReturnContext : null;
    closeEditModal({ reopenView: false });
    await loadEvents();
    reopenEditReturnContext(returnContext);
}

async function deleteEvent(id) {
    await _ensureDb();
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    const { error } = await db.from('schedules').delete().eq('id', id);
    if (error) { showToast('삭제 실패'); return; }
    showToast('삭제되었습니다');
    closeViewModal();
    await loadEvents();
}

// ─── 편집자 관리 ───
async function openAdminModal() {
    await loadEditors();
    await loadUpEvents();
    await loadCalendarNotices({ includeInactive: true, fallback: false });
    renderEditorList();
    renderUpEventList();
    renderCalendarNoticeList();
    document.getElementById('adminModal').classList.add('open');
}
function closeAdminModal() { document.getElementById('adminModal').classList.remove('open'); }

function switchAdminTab(tab) {
    const names = ['editors', 'upevents', 'notices', 'patchnotes'];
    document.querySelectorAll('.admin-tab-btn').forEach((b, i) => {
        b.classList.toggle('active', names[i] === tab);
    });
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.toggle('active', s.id === 'adminSection' + tab.charAt(0).toUpperCase() + tab.slice(1));
    });
}

function renderEditorList() {
    const list = document.getElementById('editorList');
    if (!state.editors.length) {
        list.innerHTML = '<div class="editor-item" style="color:var(--muted);">등록된 편집자가 없습니다.</div>';
        return;
    }
    list.innerHTML = state.editors.map(e => `
        <div class="editor-item">
            <span>${esc(e.email)}</span>
            <button class="editor-remove-btn" onclick="removeEditor(${jsArg(e.id)})">삭제</button>
        </div>
    `).join('');
}

async function addEditor() {
    await _ensureDb();
    const email = document.getElementById('newEditorEmail').value.trim().toLowerCase();
    if (!email.includes('@')) { showToast('올바른 이메일을 입력해주세요'); return; }
    const { error } = await db.from('editors').insert({ email, added_by: state.user?.email });
    if (error) {
        showToast(error.code === '23505' ? '이미 등록된 이메일입니다' : '추가 실패');
        return;
    }
    document.getElementById('newEditorEmail').value = '';
    showToast(`${email} 추가됨`);
    await loadEditors();
    renderEditorList();
}

async function removeEditor(id) {
    await _ensureDb();
    if (!confirm('이 편집자를 삭제하시겠습니까?')) return;
    const { error } = await db.from('editors').delete().eq('id', id);
    if (error) { showToast('삭제 실패'); return; }
    await loadEditors();
    renderEditorList();
    showToast('삭제되었습니다');
}

// ─── 캘린더 공지 관리 ───
let _activeCalendarNotice = null;
let _calendarNoticeLoadError = null;

function isMissingNoticeTable(error) {
    const msg = String(error?.message || '');
    return error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST205' || msg.includes('calendar_notices');
}

function normalizeNoticeImageInput(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const absolute = normalizeOptionalUrl(raw);
    if (absolute) return absolute;
    if (raw.includes('..') || raw.startsWith('/') || raw.startsWith('//')) return null;
    if (/^(?:\.\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:png|jpe?g|webp|gif|avif)(?:\?[\w=&.-]+)?$/i.test(raw)) return raw;
    return null;
}

function noticeImageSrc(value) {
    const src = normalizeNoticeImageInput(value) || DEFAULT_CALENDAR_NOTICE.image_url;
    return OPTIMIZED_NOTICE_IMAGES[src] || src;
}

function normalizeNoticeColor(value, fallback) {
    const raw = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function hexToRgb(hex) {
    const m = String(hex || '').match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function mixNoticeColor(hex, amount, target = '#ffffff') {
    const c = hexToRgb(hex);
    const t = hexToRgb(target);
    if (!c || !t) return hex;
    return rgbToHex(
        c.r + (t.r - c.r) * amount,
        c.g + (t.g - c.g) * amount,
        c.b + (t.b - c.b) * amount
    );
}

function noticeReadableTextColor(hex) {
    const c = hexToRgb(hex);
    if (!c) return '#fff3cf';
    const luminance = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    return luminance > 0.55 ? '#2d1b12' : '#fff3cf';
}

function normalizeCalendarNotice(row) {
    return {
        id: String(row.id || row.slug || row.title || DEFAULT_CALENDAR_NOTICE.id),
        title: row.title || '공지사항',
        message: row.message || '',
        image_url: noticeImageSrc(row.image_url),
        link_url: normalizeOptionalUrl(row.link_url || '') || '',
        link_label: row.link_label || '공지 보러가기',
        button_bg_color: normalizeNoticeColor(row.button_bg_color, DEFAULT_CALENDAR_NOTICE.button_bg_color),
        button_text_color: normalizeNoticeColor(row.button_text_color, DEFAULT_CALENDAR_NOTICE.button_text_color),
        header_bg_color: normalizeNoticeColor(row.header_bg_color, DEFAULT_CALENDAR_NOTICE.header_bg_color),
        header_text_color: normalizeNoticeColor(row.header_text_color, DEFAULT_CALENDAR_NOTICE.header_text_color),
        is_active: row.is_active !== false,
        sort_order: Number(row.sort_order || 0),
        created_at: row.created_at || null,
    };
}

async function loadCalendarNotices(options = {}) {
    const includeInactive = options.includeInactive === true;
    const fallback = options.fallback !== false;
    _calendarNoticeLoadError = null;
    try {
        await _ensureDb();
        let query = db.from('calendar_notices')
            .select('id,title,image_url,link_url,link_label,button_bg_color,button_text_color,header_bg_color,header_text_color,is_active,sort_order,created_at')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (!includeInactive) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) throw error;
        state.calendarNotices = (data || []).map(normalizeCalendarNotice);
    } catch (error) {
        _calendarNoticeLoadError = error;
        if (fallback) {
            state.calendarNotices = [normalizeCalendarNotice(DEFAULT_CALENDAR_NOTICE)];
        } else {
            state.calendarNotices = [];
        }
    }
    return state.calendarNotices;
}

function calendarNoticeHideKey(notice) {
    return `beadyoNoticeHiddenDate:${notice?.id || DEFAULT_CALENDAR_NOTICE.id}`;
}

const _calendarNoticeHiddenDates = new Map();

function isCalendarNoticeHiddenToday(notice) {
    return _calendarNoticeHiddenDates.get(calendarNoticeHideKey(notice)) === dateToStr(new Date());
}

function renderNoticePopup(notice) {
    const title = document.getElementById('noticeTitle');
    const img = document.getElementById('noticeImage');
    const message = document.getElementById('noticeMessage');
    const link = document.getElementById('noticeLink');
    const linkLabel = document.getElementById('noticeLinkLabel');
    const head = document.querySelector('#noticePopup .notice-head');
    if (title) title.textContent = notice.title || '공지사항';
    if (head) {
        head.style.setProperty('--notice-head-bg', notice.header_bg_color);
        head.style.setProperty('--notice-head-bg-light', mixNoticeColor(notice.header_bg_color, 0.18));
        head.style.setProperty('--notice-head-text', notice.header_text_color);
    }
    if (img) {
        const src = noticeImageSrc(notice.image_url);
        if (img.getAttribute('src') !== src) img.src = src;
        img.dataset.src = src;
        img.alt = `${notice.title || '공지'} 이미지`;
    }
    if (message) {
        message.textContent = notice.message || '';
        message.hidden = !notice.message;
    }
    if (link) {
        const href = normalizeOptionalUrl(notice.link_url || '');
        link.hidden = !href;
        if (href) link.href = href;
        link.setAttribute('aria-label', notice.link_label || '공지 보러가기');
        link.title = notice.link_label || '공지 보러가기';
        link.style.setProperty('--notice-button-bg', notice.button_bg_color);
        link.style.setProperty('--notice-button-text', notice.button_text_color);
        link.style.background = `linear-gradient(180deg, color-mix(in srgb, ${notice.button_bg_color} 24%, #ffffff), ${notice.button_bg_color})`;
        link.style.color = notice.button_text_color;
        link.style.boxShadow = `0 8px 20px rgba(0,0,0,0.28), 0 0 18px color-mix(in srgb, ${notice.button_bg_color} 42%, transparent)`;
    }
    if (linkLabel) linkLabel.textContent = notice.link_label || '공지 보러가기';
}

function openNoticePopup(notice = _activeCalendarNotice, options = {}) {
    const normalized = notice ? normalizeCalendarNotice(notice) : null;
    if (!normalized || (!options.ignoreHiddenToday && isCalendarNoticeHiddenToday(normalized))) return;
    _activeCalendarNotice = normalized;
    renderNoticePopup(normalized);
    document.getElementById('noticePopup')?.classList.add('open');
}

function closeNoticePopup() {
    document.getElementById('noticePopup')?.classList.remove('open');
}

function hideNoticeToday() {
    const notice = _activeCalendarNotice || normalizeCalendarNotice(DEFAULT_CALENDAR_NOTICE);
    _calendarNoticeHiddenDates.set(calendarNoticeHideKey(notice), dateToStr(new Date()));
    closeNoticePopup();
}

async function maybeOpenCalendarNoticeOnStart() {
    try {
        const notices = await loadCalendarNotices({ includeInactive: false, fallback: false });
        const notice = notices.find(item => item?.is_active !== false && !isCalendarNoticeHiddenToday(item));
        if (notice) {
            openNoticePopup(notice);
            return;
        }
    } catch (error) {
        console.warn('calendar notice startup:', error);
    }
}

function setNoticeColorInputs(colors) {
    const fields = {
        newNoticeButtonBg: colors.button_bg_color,
        newNoticeButtonText: colors.button_text_color,
        newNoticeHeaderBg: colors.header_bg_color,
        newNoticeHeaderText: colors.header_text_color,
    };
    for (const [id, value] of Object.entries(fields)) {
        const input = document.getElementById(id);
        if (input && value) input.value = value;
    }
}

function applyNoticeAutoColorsFromHex(hex) {
    const headerBg = mixNoticeColor(hex, 0.48, '#000000');
    const buttonBg = mixNoticeColor(hex, 0.12, '#ffffff');
    setNoticeColorInputs({
        button_bg_color: buttonBg,
        button_text_color: noticeReadableTextColor(buttonBg),
        header_bg_color: headerBg,
        header_text_color: noticeReadableTextColor(headerBg),
    });
}

function sampleNoticeImageColor(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const size = 64;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;
                let r = 0, g = 0, b = 0, weightSum = 0;
                for (let i = 0; i < data.length; i += 16) {
                    const alpha = data[i + 3] / 255;
                    if (alpha < 0.35) continue;
                    const pxR = data[i], pxG = data[i + 1], pxB = data[i + 2];
                    const max = Math.max(pxR, pxG, pxB);
                    const min = Math.min(pxR, pxG, pxB);
                    const saturation = max === 0 ? 0 : (max - min) / max;
                    const luminance = (0.2126 * pxR + 0.7152 * pxG + 0.0722 * pxB) / 255;
                    if (luminance < 0.08 || luminance > 0.94) continue;
                    const weight = alpha * (0.35 + saturation) * (1 - Math.abs(luminance - 0.52) * 0.65);
                    r += pxR * weight;
                    g += pxG * weight;
                    b += pxB * weight;
                    weightSum += weight;
                }
                if (!weightSum) throw new Error('no color');
                resolve(rgbToHex(r / weightSum, g / weightSum, b / weightSum));
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

async function analyzeNoticeImageColorsFromInput() {
    const input = document.getElementById('newNoticeImageUrl');
    const imageUrl = normalizeNoticeImageInput(input?.value);
    if (!imageUrl) { showToast('이미지 URL을 먼저 입력해주세요'); return; }
    try {
        const sampled = await sampleNoticeImageColor(imageUrl);
        applyNoticeAutoColorsFromHex(sampled);
        showToast('이미지 색을 반영했어요');
    } catch (error) {
        showToast('이 이미지에서는 자동 색 추출이 어려워요. 색상 선택으로 맞춰주세요');
    }
}

function renderCalendarNoticeList() {
    const list = document.getElementById('noticeList');
    if (!list) return;
    if (_calendarNoticeLoadError && isMissingNoticeTable(_calendarNoticeLoadError)) {
        list.innerHTML = '<div class="notice-admin-empty">공지 테이블 또는 컬럼이 아직 없습니다. add_calendar_notices.sql을 Supabase SQL Editor에서 먼저 실행해 주세요.</div>';
        return;
    }
    if (!state.calendarNotices.length) {
        list.innerHTML = '<div class="notice-admin-empty">등록된 공지가 없습니다.</div>';
        return;
    }
    list.innerHTML = state.calendarNotices.map(notice => `
        <div class="editor-item up-event-row">
            <img class="notice-admin-preview" src="${esc(noticeImageSrc(notice.image_url))}" alt="">
            <div class="up-event-main">
                <div class="up-event-row-title">${esc(notice.title)}</div>
                <div class="up-event-row-subtitle">${esc(notice.link_url || notice.image_url)}</div>
                <div class="up-event-row-state ${notice.is_active ? 'active' : ''}">${notice.is_active ? '● 활성' : '● 비활성'}</div>
            </div>
            <div class="up-event-admin-actions">
                <label class="up-startup-toggle">
                    <input type="checkbox" ${notice.is_active ? 'checked' : ''} onchange="toggleCalendarNoticeActive('${esc(notice.id)}', this.checked)">
                    <span>활성</span>
                </label>
                <button class="editor-remove-btn" onclick="previewCalendarNotice(${jsArg(notice.id)})">미리보기</button>
                <button class="editor-remove-btn" onclick="removeCalendarNotice(${jsArg(notice.id)})">삭제</button>
            </div>
        </div>
    `).join('');
}

async function addCalendarNotice() {
    await _ensureDb();
    const title = document.getElementById('newNoticeTitle').value.trim() || '공지사항';
    const imageUrl = normalizeNoticeImageInput(document.getElementById('newNoticeImageUrl').value);
    const linkInput = document.getElementById('newNoticeLinkUrl').value.trim();
    const linkUrl = normalizeOptionalUrl(linkInput);
    const linkLabel = document.getElementById('newNoticeLinkLabel').value.trim() || '공지 보러가기';
    const buttonBgColor = normalizeNoticeColor(document.getElementById('newNoticeButtonBg')?.value, DEFAULT_CALENDAR_NOTICE.button_bg_color);
    const buttonTextColor = normalizeNoticeColor(document.getElementById('newNoticeButtonText')?.value, DEFAULT_CALENDAR_NOTICE.button_text_color);
    const headerBgColor = normalizeNoticeColor(document.getElementById('newNoticeHeaderBg')?.value, DEFAULT_CALENDAR_NOTICE.header_bg_color);
    const headerTextColor = normalizeNoticeColor(document.getElementById('newNoticeHeaderText')?.value, DEFAULT_CALENDAR_NOTICE.header_text_color);
    const isActive = document.getElementById('newNoticeActive')?.checked === true;
    const sortOrder = parseInt(document.getElementById('newNoticeOrder').value) || 0;
    if (!imageUrl) { showToast('이미지 URL을 입력해주세요'); return; }
    if (linkInput && !linkUrl) { showToast('바로가기 URL은 http 또는 https 주소로 입력해주세요'); return; }

    const { error } = await db.from('calendar_notices').insert({
        title,
        image_url: imageUrl,
        link_url: linkUrl || null,
        link_label: linkLabel,
        button_bg_color: buttonBgColor,
        button_text_color: buttonTextColor,
        header_bg_color: headerBgColor,
        header_text_color: headerTextColor,
        is_active: isActive,
        sort_order: sortOrder,
        created_by: state.user?.email || null,
    });
    if (error) {
        showToast(isMissingNoticeTable(error) ? 'DB에 calendar_notices 테이블을 먼저 추가해주세요' : '공지 추가 실패: ' + error.message);
        return;
    }
    ['newNoticeImageUrl','newNoticeLinkUrl','newNoticeOrder'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('newNoticeTitle').value = '공지사항';
    document.getElementById('newNoticeLinkLabel').value = '공지 보러가기';
    setNoticeColorInputs(DEFAULT_CALENDAR_NOTICE);
    document.getElementById('newNoticeActive').checked = true;
    await loadCalendarNotices({ includeInactive: true, fallback: false });
    renderCalendarNoticeList();
    showToast('공지 추가됨');
}

async function toggleCalendarNoticeActive(id, checked) {
    await _ensureDb();
    const { error } = await db.from('calendar_notices').update({ is_active: checked }).eq('id', id);
    if (error) { showToast('공지 상태 저장 실패'); return; }
    const notice = state.calendarNotices.find(n => n.id === String(id));
    if (notice) notice.is_active = checked;
    renderCalendarNoticeList();
}

function previewCalendarNotice(id) {
    const notice = state.calendarNotices.find(n => n.id === String(id));
    if (notice) openNoticePopup(notice, { ignoreHiddenToday: true });
}

async function removeCalendarNotice(id) {
    await _ensureDb();
    if (!confirm('이 공지를 삭제하시겠습니까?')) return;
    const { error } = await db.from('calendar_notices').delete().eq('id', id);
    if (error) { showToast('공지 삭제 실패'); return; }
    state.calendarNotices = state.calendarNotices.filter(n => n.id !== String(id));
    renderCalendarNoticeList();
    showToast('공지 삭제됨');
}

// ─── UP 이벤트 관리 ───
let upEvents = [];
let _upCurrentData = null;
let _upModalIsAutoPrompt = false;
let _upAutoPopupChecked = false;

function isUpStartupEvent(event) {
    return event?.show_on_startup === true || event?.show_on_startup === 'true' || event?.show_on_startup === 1;
}

function parseSoopHighlightReplyNo(url) {
    const normalized = normalizeOptionalUrl(url);
    if (!normalized) return '';
    try {
        const m = new URL(normalized).hash.match(/^#comment_noti(\d+)$/);
        return m ? m[1] : '';
    } catch {}
    return '';
}

function soopPostBaseUrl(url) {
    const normalized = normalizeOptionalUrl(url);
    return normalized ? normalized.split('#')[0] : '';
}

function upEventFromRow(e) {
    return {
        id: e.id,
        tab: e.tab_name || e.tab,
        title: e.title,
        soop_url: e.soop_url,
        show_on_startup: isUpStartupEvent(e),
        live_updated_at: e.live_updated_at || null,
        ranking: e.ranking || [],
    };
}

function displayUpRanking(ev) {
    const ranking = (ev.ranking || []).map(r => ({ ...r, _highlight: false }));
    const highlightReplyNo = parseSoopHighlightReplyNo(ev.soop_url);
    if (!highlightReplyNo) return ranking;
    const idx = ranking.findIndex(r => String(r.reply_no || '').replace(/\D/g, '') === highlightReplyNo);
    if (idx === -1) return ranking;
    const highlighted = { ...ranking[idx], _highlight: true };
    return [highlighted, ...ranking.filter((_, i) => i !== idx)];
}

function _refreshUpModalDisplay() {
    const modal = document.getElementById('upModal');
    if (!modal || !modal.classList.contains('open')) return;
    const rankingMap = {};
    if (_upCurrentData) {
        for (const e of (_upCurrentData.events || [])) rankingMap[e.id] = e.ranking || [];
    }
    const displayEvents = upEvents
        .filter(e => e.is_active)
        .map(e => ({ ...upEventFromRow(e), ranking: rankingMap[e.id] || [] }));
    if (!displayEvents.length) clearLocalUpRankingSnapshot();
    _upCurrentData = { updated: _upCurrentData?.updated || null, events: displayEvents };
    renderUpModal(_upCurrentData, false);
}

async function loadUpEvents() {
    await _ensureDb();
    const { data, error } = await db.from('up_events').select('*')
        .order('sort_order', { ascending: true });
    if (!error) upEvents = data || [];
}

function renderUpEventList() {
    const list = document.getElementById('upEventList');
    if (!upEvents.length) {
        list.innerHTML = '<div class="editor-item" style="color:var(--muted);">등록된 UP 이벤트가 없습니다.</div>';
        return;
    }
    list.innerHTML = upEvents.map((e, index) => `
        <div class="editor-item up-event-row">
            <div class="up-event-main">
                <div class="up-event-row-title">${esc(e.tab_name)}</div>
                <div class="up-event-row-subtitle">${esc(e.title)}</div>
                <div class="up-event-row-state ${e.is_active ? 'active' : ''}">${e.is_active ? '● 활성' : '● 비활성'}</div>
            </div>
            <div class="up-event-admin-actions">
                <div class="up-order-actions" aria-label="UP 이벤트 순서 변경">
                    <button class="up-order-btn" onclick="moveUpEvent(${jsArg(e.id)}, -1)" ${index === 0 ? 'disabled' : ''}>위</button>
                    <button class="up-order-btn" onclick="moveUpEvent(${jsArg(e.id)}, 1)" ${index === upEvents.length - 1 ? 'disabled' : ''}>아래</button>
                </div>
                <label class="up-startup-toggle">
                    <input type="checkbox" ${isUpStartupEvent(e) ? 'checked' : ''} onchange="toggleUpStartup('${esc(String(e.id))}', this.checked)">
                    <span>먼저 띄우기</span>
                </label>
                <button class="editor-remove-btn" onclick="removeUpEvent(${jsArg(e.id)})">삭제</button>
            </div>
        </div>
    `).join('');
}

function normalizeUpEventOrders() {
    upEvents.forEach((event, index) => { event.sort_order = index; });
}

async function saveUpEventOrder() {
    await _ensureDb();
    normalizeUpEventOrders();
    const results = await Promise.all(upEvents.map((event, index) =>
        db.from('up_events').update({ sort_order: index }).eq('id', event.id)
    ));
    const failed = results.find(result => result.error);
    if (failed) {
        showToast('순서 저장 실패: ' + failed.error.message);
        await loadUpEvents();
        renderUpEventList();
        return false;
    }
    return true;
}

async function moveUpEvent(id, direction) {
    const from = upEvents.findIndex(event => String(event.id) === String(id));
    if (from < 0) return;
    const to = from + (direction < 0 ? -1 : 1);
    if (to < 0 || to >= upEvents.length) return;
    const [moved] = upEvents.splice(from, 1);
    upEvents.splice(to, 0, moved);
    normalizeUpEventOrders();
    renderUpEventList();
    const ok = await saveUpEventOrder();
    if (ok) {
        showToast('UP 이벤트 순서 저장됨');
        _refreshUpModalDisplay();
    }
}

function isMissingUpStartupColumn(error) {
    const msg = String(error?.message || '');
    return error?.code === '42703' || msg.includes('show_on_startup');
}

async function toggleUpStartup(id, checked) {
    await _ensureDb();
    const { error } = await db.from('up_events').update({ show_on_startup: checked }).eq('id', id);
    if (error) {
        showToast(isMissingUpStartupColumn(error) ? 'DB에 show_on_startup 컬럼을 먼저 추가해주세요' : '설정 저장 실패');
        await loadUpEvents();
        renderUpEventList();
        return;
    }
    const item = upEvents.find(e => String(e.id) === String(id));
    if (item) item.show_on_startup = checked;
    showToast(checked ? '접속 시 먼저 띄우기 ON' : '접속 시 먼저 띄우기 OFF');
    _refreshUpModalDisplay();
}

async function addUpEvent() {
    await _ensureDb();
    const tabName  = document.getElementById('newUpTab').value.trim();
    const title    = document.getElementById('newUpTitle').value.trim();
    const soopUrl  = document.getElementById('newUpUrl').value.trim();
    const sortOrder = parseInt(document.getElementById('newUpOrder').value) || 0;
    const showOnStartup = document.getElementById('newUpStartup')?.checked === true;
    if (!tabName || !title || !soopUrl) { showToast('탭 이름, 제목, URL을 모두 입력해주세요'); return; }
    const normalizedSoopUrl = normalizeOptionalUrl(soopUrl);
    if (!normalizedSoopUrl || !isAllowedHostUrl(normalizedSoopUrl, ['sooplive.com', 'sooplive.co.kr', 'afreecatv.com'])) {
        showToast('올바른 SOOP URL을 입력해주세요'); return;
    }
    const [bjId, postNo] = parseSoopUrl(normalizedSoopUrl);
    if (!bjId || !postNo) {
        showToast('올바른 SOOP 게시글 URL을 입력해주세요'); return;
    }
    const { error } = await db.from('up_events').insert({
        tab_name: tabName, title, soop_url: normalizedSoopUrl, sort_order: sortOrder, is_active: true,
    });
    if (error) { showToast('추가 실패: ' + error.message); return; }
    await loadUpEvents();
    const inserted = [...upEvents].reverse().find(e =>
        e.tab_name === tabName && e.title === title && e.soop_url === normalizedSoopUrl
    );
    let startupWarning = false;
    if (showOnStartup && inserted?.id) {
        const { error: startupError } = await db.from('up_events').update({ show_on_startup: true }).eq('id', inserted.id);
        if (startupError && isMissingUpStartupColumn(startupError)) {
            showToast('추가됨. 먼저 띄우기는 DB 컬럼 추가 후 저장됩니다.');
            startupWarning = true;
        }
        await loadUpEvents();
    }
    ['newUpTab','newUpTitle','newUpUrl','newUpOrder'].forEach(id => {
        document.getElementById(id).value = '';
    });
    const startupInput = document.getElementById('newUpStartup');
    if (startupInput) startupInput.checked = false;
    if (!startupWarning) showToast('UP 이벤트 추가됨');
    renderUpEventList();
    _refreshUpModalDisplay();
}

async function removeUpEvent(id) {
    await _ensureDb();
    if (!confirm('이 UP 이벤트를 삭제하시겠습니까?')) return;
    const { error } = await db.from('up_events').delete().eq('id', id);
    if (error) { showToast('삭제 실패'); return; }
    await loadUpEvents();
    renderUpEventList();
    _refreshUpModalDisplay();
    showToast('삭제되었습니다');
}

// ─── 네비게이션 ───
function setViewMode(mode) {
    state.viewMode = mode === 'week' ? 'week' : 'month';
    if (state.viewMode === 'week' && !state.weekStart) {
        const today = new Date();
        const ws = addDays(today, -today.getDay());
        state.weekStart = dateToStr(ws);
    }
    renderCalendar();
}

function changeMonth(delta) {
    if (state.viewMode === 'week') {
        if (!state.weekStart) {
            const today = new Date();
            state.weekStart = dateToStr(addDays(today, -today.getDay()));
        }
        const [wy, wm, wd] = state.weekStart.split('-').map(Number);
        const newWs = addDays(new Date(wy, wm - 1, wd), delta * 7);
        state.weekStart = dateToStr(newWs);
        const newYear  = newWs.getFullYear();
        const newMonth = newWs.getMonth();
        if (newYear !== state.year || newMonth !== state.month) {
            state.year  = newYear;
            state.month = newMonth;
            loadEvents();
            loadMemoCards().catch(() => {});
        } else {
            renderCalendar();
        }
        return;
    }
    state.month += delta;
    if (state.month > 11) { state.month = 0; state.year++; }
    if (state.month < 0)  { state.month = 11; state.year--; }
    state.mobileStartDate = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
    loadEvents();
    loadMemoCards().catch(() => {});
}
function goToday() {
    const now = new Date();
    state.year  = now.getFullYear();
    state.month = now.getMonth();
    state.mobileStartDate = dateToStr(now);
    state.weekStart = dateToStr(addDays(now, -now.getDay()));
    loadEvents();
    loadMemoCards().catch(() => {});
}

function navigateMobileDays(delta) {
    const [y, m, d] = state.mobileStartDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + delta);
    state.mobileStartDate = dateToStr(next);
    const newYear = next.getFullYear();
    const newMonth = next.getMonth();
    if (newYear !== state.year || newMonth !== state.month) {
        state.year = newYear;
        state.month = newMonth;
        loadEvents();
    } else {
        renderMobileSchedule();
    }
}

function normalizeAuthUser(userLike) {
    if (!userLike?.email) return null;
    return {
        email: userLike.email,
        name: userLike.name || userLike.user_metadata?.full_name || userLike.user_metadata?.name || userLike.email,
        picture: safeImageUrl(userLike.picture || userLike.user_metadata?.avatar_url || userLike.user_metadata?.picture || ''),
    };
}

async function initAuth() {
    await _ensureDb();
    const { data: { session } } = await db.auth.getSession();
    await setSessionUser(normalizeAuthUser(session?.user));
    db.auth.onAuthStateChange((_event, session) => {
        setSessionUser(normalizeAuthUser(session?.user));
    });

    window.addEventListener('message', event => {
        const allowed = ['https://beadyo.com', 'http://localhost:3000', 'http://127.0.0.1:3000'];
        if (!allowed.includes(event.origin) && event.origin !== window.location.origin) return;
        const { data } = event;
        if (!data) return;
        if (data.type === 'beadyo-auth-sync') {
            setSessionUser(normalizeAuthUser(data.user));
        } else if (data.type === 'beadyo-auth-action') {
            if (data.action === 'open-admin' && state.isEditor) openAdminModal();
        }
    });
}

async function setSessionUser(user) {
    state.user = user ? {
        email: user.email,
        name: user.name || user.email,
        picture: safeImageUrl(user.picture || ''),
    } : null;
    if (!state.user) {
        state.isEditor = false;
        state.isOwner = false;
        document.body.classList.remove('is-editor');
        renderCalendar();
        return;
    }
    state.isOwner = state.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    await loadEditors();
    state.isEditor = state.isOwner || state.editors.some(e => e.email.toLowerCase() === state.user.email.toLowerCase());
    document.body.classList.toggle('is-editor', state.isEditor);
    renderCalendar();
    renderMemoSidebar();
}

// ─── 모바일 스와이프 ───
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) {
        if (window.innerWidth <= 640) {
            navigateMobileDays(dx < 0 ? 3 : -3);
        } else {
            changeMonth(dx < 0 ? 1 : -1);
        }
    }
}, { passive: true });

// 인앱브라우저(네이버 등) 백그라운드 정지 대응 — 포그라운드 복귀 시 재시도
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        loadEvents();
    }
});
// iOS bfcache 복원 대응 (뒤로가기/탭전환 후 페이지 재표시)
window.addEventListener('pageshow', () => {
    loadEvents();
});

// ── 이스터에그 ──
const STICKERS = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','s15'];
const STICKER_RAIN_ASSETS = [
    ...STICKERS.map(s => `stickers/${s}.png`),
    ...GOBOOKTICON_STICKERS,
];
const CONFETTI_COLORS = ['#ff7eb3','#ffcd3c','#7bc67e','#6eb5ff','#ff8c69','#c77dff','#ff6b6b'];

// ─── 초기화 ───
renderLegend();
loadEvents().catch(err => {
    console.error('initial loadEvents:', err);
    state.events = [];
    renderCalendar();
    loadYtLinks().catch(() => {});
});
loadMemoCards().catch(err => console.error('initial loadMemoCards:', err));
initCalendarRealtime();
initAuth();
maybeOpenCalendarNoticeOnStart();
setTimeout(() => { maybeOpenUpModalOnStart(); }, 700);
checkBirthday();

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeNoticePopup();
});

function launchConfetti(count = 80) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'easter-confetti';
            el.style.cssText = `
                left: ${Math.random() * 100}vw;
                background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
                width: ${6 + Math.random() * 8}px;
                height: ${6 + Math.random() * 8}px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation-duration: ${2 + Math.random() * 2}s;
                animation-delay: ${Math.random() * 0.5}s;
            `;
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }, i * 20);
    }
}

function launchStickerRain() {
    const picks = [...STICKER_RAIN_ASSETS].sort(() => Math.random() - 0.5).slice(0, 14);
    picks.forEach((s, i) => {
        setTimeout(() => {
            const el = document.createElement('img');
            el.className = 'easter-sticker';
            const size = 36 + Math.random() * 30;
            const top  = 5 + Math.random() * 80;
            const dy   = (Math.random() - 0.5) * 120;
            const rot  = (Math.random() - 0.5) * 540;
            const dur  = 1.2 + Math.random() * 0.8;
            el.src = s;
            el.style.cssText = `
                width: ${size}px; height: ${size}px;
                left: -${size + 10}px; top: ${top}vh;
                --dy: ${dy}px; --rot: ${rot}deg;
                animation-duration: ${dur}s;
            `;
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }, i * 120);
    });
}

function showBirthdayPopup() {
    const overlay = document.createElement('div');
    overlay.className = 'birthday-overlay';
    overlay.innerHTML = `
        <div class="birthday-card">
            <div class="bd-emoji">🎂</div>
            <div class="bd-title">구슬요 생일 축하해요!</div>
            <div class="bd-msg">오늘은 구슬요의 생일이에요 🎉<br>항상 건강하고 행복하게<br>방송해줘서 고마워요 💚</div>
            <button class="bd-close" onclick="this.closest('.birthday-overlay').remove()">감사해요 🫶</button>
        </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    launchConfetti(120);
}

function checkBirthday() {
    const now = new Date();
    if (now.getMonth() === 7 && now.getDate() === 18) {
        setTimeout(showBirthdayPopup, 1200);
    }
}

// 월 레이블 클릭 10번 이스터에그
let _labelClicks = 0, _labelTimer = null;
document.getElementById('monthLabel').addEventListener('click', () => {
    _labelClicks++;
    clearTimeout(_labelTimer);
    _labelTimer = setTimeout(() => { _labelClicks = 0; }, 1500);
    if (_labelClicks >= 5) {
        _labelClicks = 0;
        launchStickerRain();
    }
});
