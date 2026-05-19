const SUPABASE_URL      = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
const OWNER_EMAIL       = 'riosniper12@gmail.com';

const EVENT_TYPES = [
    { key: 'chat',    label: '소통',        icon: '☘', color: '#d8f4cf', text: '#3e7d2f', border: '#a7d892' },
    { key: 'song',    label: '노래',        icon: '♪',  color: '#ffd9e8', text: '#a33a69', border: '#f2a9c8' },
    { key: 'solo',    label: '슬요 컨텐츠', icon: '✦', color: '#ffe7bf', text: '#a76016', border: '#f1bd73' },
    { key: 'collab',  label: '참여 컨텐츠', icon: '＋', color: '#dff3bf', text: '#547d19', border: '#bddb7d' },
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
    '2026-09-26': '추석 연휴',
    '2026-09-27': '추석',
    '2026-09-28': '추석 연휴',
    '2026-09-29': '대체공휴일 (추석)',         // 추석 일요일
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '크리스마스',
    // 2027
    '2027-01-01': '신정',
    '2027-01-26': '설날 연휴',
    '2027-01-27': '설날',
    '2027-01-28': '설날 연휴',
    '2027-03-01': '삼일절',
    '2027-05-05': '어린이날',
    '2027-05-13': '석가탄신일',
    '2027-06-06': '현충일',
    '2027-06-07': '대체공휴일 (현충일)',       // 현충일 일요일
    '2027-07-17': '제헌절',
    '2027-08-15': '광복절',
    '2027-08-16': '대체공휴일 (광복절)',       // 광복절 일요일
    '2027-10-03': '개천절',
    '2027-10-04': '추석 연휴',
    '2027-10-05': '추석',
    '2027-10-06': '추석 연휴',
    '2027-10-09': '한글날',
    '2027-12-25': '크리스마스',
    '2027-12-26': '대체공휴일 (크리스마스)',   // 크리스마스 일요일
    // 2028
    '2028-01-01': '신정',
    '2028-01-02': '대체공휴일 (신정)',         // 신정 일요일
    '2028-01-26': '설날 연휴',
    '2028-01-27': '설날',
    '2028-01-28': '설날 연휴',
    '2028-03-01': '삼일절',
    '2028-05-05': '어린이날',
    '2028-05-06': '대체공휴일 (어린이날)',     // 어린이날 토요일
    '2028-05-09': '석가탄신일',
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
    user: null,
    isEditor: false,
    isOwner: false,
    editors: [],
    viewMode: 'month',
    weekStart: null,
    mobileStartDate: dateToStr(new Date()),
};

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function typeOf(key) {
    return EVENT_TYPES.find(t => t.key === key) ?? EVENT_TYPES.find(t => t.key === 'general');
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
function typeStyle(t) {
    return `background:${t.color};color:${t.text};border-color:${t.border || t.text};`;
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}
function safeUrl(s) {
    try {
        const u = new URL(String(s));
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {}
    return '#';
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
    if (isCompact) return 'clamp(7px, 0.68vw, 9px)';
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

function chipFontSize(title, isSingle, isCompact, eventCount = 0) {
    const len = title.length;
    if (isCompact) {
        if (len <= 4)  return 'clamp(13px, 1.3vw, 16px)';
        if (len <= 6)  return 'clamp(12px, 1.2vw, 15px)';
        if (len <= 10) return 'clamp(10px, 1.02vw, 13px)';
        if (len <= 16) return 'clamp(8px,  0.82vw, 11px)';
        return                'clamp(8px,  0.75vw, 10px)';
    }
    if (isSingle) {
        if (len <= 5)  return 'clamp(16px, 2.2vw, 28px)';
        if (len <= 9)  return 'clamp(14px, 2.0vw, 24px)';
        if (len <= 14) return 'clamp(13px, 1.7vw, 20px)';
        if (len <= 20) return 'clamp(12px, 1.4vw, 17px)';
        return                'clamp(11px, 1.2vw, 14px)';
    } else {
        if (eventCount === 2) {
            if (len <= 2)  return 'clamp(22px, 2.5vw, 30px)';
            if (len <= 3)  return 'clamp(20px, 2.25vw, 28px)';
            if (len <= 5)  return 'clamp(18px, 2.05vw, 25px)';
            if (len <= 9)  return 'clamp(16px, 1.75vw, 21px)';
            if (len <= 14) return 'clamp(12px, 1.25vw, 16px)';
            return                'clamp(10px, 1.0vw, 13px)';
        }
        if (eventCount === 3) {
            if (len <= 2)  return 'clamp(20px, 2.2vw, 27px)';
            if (len <= 3)  return 'clamp(18px, 2.0vw, 24px)';
            if (len <= 5)  return 'clamp(16px, 1.8vw, 21px)';
            if (len <= 7)  return 'clamp(15px, 1.65vw, 19px)';
            if (len <= 9)  return 'clamp(13px, 1.4vw, 17px)';
            if (len <= 14) return 'clamp(10px, 1.08vw, 14px)';
            return                'clamp(9px,  0.9vw, 12px)';
        }
        if (eventCount === 4) {
            if (len <= 2)  return 'clamp(17px, 1.75vw, 22px)';
            if (len <= 3)  return 'clamp(15px, 1.55vw, 19px)';
            if (len <= 5)  return 'clamp(14px, 1.42vw, 17px)';
            if (len <= 7)  return 'clamp(12px, 1.2vw, 15px)';
            if (len <= 9)  return 'clamp(11px, 1.08vw, 14px)';
            if (len <= 14) return 'clamp(9px,  0.9vw, 12px)';
            return                'clamp(8px,  0.78vw, 10px)';
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
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── 드래그앤드랍 순서 ───
let dragState = { id: null, dateStr: null };
let _dragged = false;
let _eventsLoaded = false;
var renderUpTab;

function getLocalOrder(dateStr, events) {
    const saved = localStorage.getItem('beadyo_order_' + dateStr);
    if (!saved) return events.map(e => e.id);
    const ids = saved.split(',');
    const ordered = [];
    ids.forEach(id => { if (events.find(e => e.id === id)) ordered.push(id); });
    events.forEach(ev => { if (!ordered.includes(ev.id)) ordered.push(ev.id); });
    return ordered;
}

function applyLocalOrder(dateStr, events) {
    const order = getLocalOrder(dateStr, events);
    return order.map(id => events.find(e => e.id === id)).filter(Boolean);
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
}
function dragOver(e, id, dateStr) {
    if (dragState.dateStr !== dateStr || dragState.id === id) return;
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}
function dragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}
function dragDrop(e, targetId, dateStr) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const { id: sourceId, dateStr: srcDate } = dragState;
    if (!sourceId || sourceId === targetId || srcDate !== dateStr) return;

    const cellEvents = state.events.filter(ev => {
        const endDate = ev.end_date || ev.date;
        return dateStr >= ev.date && dateStr <= endDate;
    });
    const order = getLocalOrder(dateStr, cellEvents);
    const fromIdx = order.indexOf(sourceId);
    const toIdx   = order.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceId);
    localStorage.setItem('beadyo_order_' + dateStr, order.join(','));
    renderCalendar();
    dragState = { id: null, dateStr: null };
}

// ─── 데이터 로드 ───
async function loadEvents() {
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

    const cacheKey = `beadyo_ev_${state.year}_${pad(state.month + 1)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached && state.events.length === 0) {
        try { state.events = JSON.parse(cached); renderCalendar(); } catch {}
    }

    // 캐시 없으면 빈 상태라도 즉시 렌더 (모바일 무한 빈 화면 방지)
    if (state.events.length === 0) renderCalendar();

    // 페이지가 hidden이면 fetch 건너뜀 — visibilitychange 복귀 시 재시도
    if (document.visibilityState !== 'visible') {
        _eventsLoaded = false;
        return;
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);

    let data, error;
    try {
        ({ data, error } = await db
            .from('schedules')
            .select('id,date,end_date,start_time,duration,title,type,collab,subtitle,vod_url,memo,is_rest')
            .gte('date', extFirst)
            .lte('date', last)
            .order('date')
            .order('start_time', { nullsFirst: false })
            .abortSignal(controller.signal));
    } catch (e) {
        clearTimeout(tid);
        if (e.name === 'AbortError') {
            console.warn('loadEvents: timeout, using cache');
            if (!cached) { state.events = []; renderCalendar(); }
        } else {
            console.error('loadEvents:', e);
            if (!cached) { state.events = []; renderCalendar(); }
        }
        return;
    }
    clearTimeout(tid);

    if (error) {
        console.error('loadEvents:', error);
        if (!cached) { state.events = []; renderCalendar(); }
        return;
    }
    state.events = data ?? [];
    try { localStorage.setItem(cacheKey, JSON.stringify(state.events)); } catch {}
    _eventsLoaded = true;
    renderCalendar();
}

async function loadEditors() {
    const { data, error } = await db.from('editors').select('id,email,created_at').order('created_at');
    if (error) {
        console.error('loadEditors:', error);
        state.editors = [];
        return;
    }
    state.editors = data ?? [];
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
        `<div class="legend-sticker"><img src="stickers/s15.png" alt="대기 중"></div>`;
}

function eventsForDate(dateStr) {
    return state.events
        .filter(ev => eventOnDate(ev, dateStr))
        .sort((a, b) => {
            if (!!b.is_rest !== !!a.is_rest) return (b.is_rest ? 1 : 0) - (a.is_rest ? 1 : 0);
            return String(a.start_time || '99:99').localeCompare(String(b.start_time || '99:99'));
        });
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
                return `<button class="mobile-event-pill" style="${typeStyle(t)}" onclick="openViewModal('${esc(ev.id)}')">
                    <span class="mobile-event-time">${esc(time)}</span>
                    <span class="mobile-event-title">${esc(ev.title)}</span>
                    <span class="mobile-event-icon">${esc(t.icon)}</span>
                </button>`;
            }).join('')
            : `<div class="mobile-empty-note">일정이 비어있어요</div>`;
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
        for (let d = 1; cells.length < 42; d++)
            cells.push({ day: d, dateStr: toDateStr(state.year, state.month + 1, d), other: true });
    }

    document.getElementById('calGrid').innerHTML = cells.map(({ day, dateStr, other }, idx) => {
        const dow     = idx % 7;
        const isToday = !other && dateStr === todayStr;
        const events  = other ? [] : applyLocalOrder(dateStr,
            state.events.filter(e => {
                return eventOnDate(e, dateStr);
            }).sort((a, b) => (b.is_rest ? 1 : 0) - (a.is_rest ? 1 : 0))
        );
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
        ].filter(Boolean).join(' ');

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
            const bodyStyle = `${!isStart ? 'opacity:0.55;' : ''}font-size:${chipFontSize(ev.title, isSingle, isCompact, events.length)};${hasNewline ? 'white-space:pre-line;' : ''}`;
            const titleSizeClass = String(ev.title ?? '').length <= 5 ? 'short-title' : 'long-title';
            const subtitleClass = isStart && ev.subtitle ? ' has-subtitle' : '';

            const memoAttr = isStart && ev.memo
                ? `data-memo="${esc(ev.memo)}"` : '';
            const memoEvents = isStart && ev.memo
                ? `onmouseenter="showMemoTooltip(event)" onmouseleave="hideMemoTooltip()"` : '';

            const subtitleHtml = isStart && ev.subtitle
                ? `<div class="chip-subtitle" style="font-size:${chipSubtitleFontSize(ev.subtitle, isSingle, isCompact)};">${esc(ev.subtitle)}</div>` : '';

            const dragAttrs = state.isEditor && isStart
                ? `draggable="true"
                   ondragstart="dragStart(event,'${esc(ev.id)}','${dateStr}')"
                   ondragend="dragEnd(event)"
                   ondragover="dragOver(event,'${esc(ev.id)}','${dateStr}')"
                   ondragleave="dragLeave(event)"
                   ondrop="dragDrop(event,'${esc(ev.id)}','${dateStr}')"` : '';

            const timeClass = isStart && ev.start_time ? ' has-time' : '';

            return `<button class="event-chip ${titleSizeClass}${subtitleClass}${timeClass}"
                style="${typeStyle(t)}border-radius:${br};"
                onclick="if(!_dragged)openViewModal('${esc(ev.id)}')"
                ${memoAttr} ${memoEvents} ${dragAttrs}
                title="${esc(ev.title)}">${timeBadge}<div class="chip-body" style="${bodyStyle}">${vodDot}${esc(ev.title)}</div>${subtitleHtml}</button>`;
        }).join('');

        const holiday   = !other ? (getHoliday(dateStr) || null) : null;
        const holHtml   = holiday ? `<div class="holiday-label">${esc(holiday)}</div>` : '';
        const todayBadge = isToday ? `<span class="today-badge">TODAY</span>` : '';
        const addBtn = !other
            ? `<button class="cell-add-btn" onclick="openAddModal('${dateStr}')" title="일정 추가">+</button>`
            : '';
        const topRight = !other
            ? `<div class="cell-top-right">${todayBadge}${addBtn}</div>` : '';

        const chipsClass = `chips-area${isSingle ? ' single' : ''}${isStableList ? ' stable-list' : ''}${isPacked ? ' packed' : ''}${isCompact ? ' compact' : ''}${isStableList ? ` count-${events.length}` : ''}`;
        const body = `<div class="${chipsClass}">${chipsHtml}</div>`;

        return `<div class="${cellCls}" ${cellClick}>
            <div class="${numCls}">${day}</div>
            ${holHtml}
            ${topRight}
            ${body}
        </div>`;
    }).join('');
    renderSecondaryViews();
}

// ─── 보기 모달 ───
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
        html += `<div class="view-section"><div class="view-label">w.</div><div class="view-value">${esc(ev.collab)}</div></div>`;
    if (ev.subtitle)
        html += `<div class="view-section"><div class="view-label">부제</div><div class="view-value">${esc(ev.subtitle)}</div></div>`;
    if (ev.memo)
        html += `<div class="view-section"><div class="view-label">메모</div><div class="view-value" style="white-space:pre-wrap">${esc(ev.memo)}</div></div>`;
    if (ev.vod_url)
        html += `<a class="vod-link" href="${safeUrl(ev.vod_url)}" target="_blank" rel="noopener noreferrer">▶ 다시보기</a>`;

    document.getElementById('viewContent').innerHTML = html;
    document.getElementById('viewBtns').innerHTML = state.isEditor
        ? `<button class="btn btn-primary"  onclick="openEditModal('${esc(id)}')">수정</button>
           <button class="btn btn-secondary" onclick="copyEvent('${esc(id)}')">복사</button>
           <button class="btn btn-secondary" onclick="repeatWeekly('${esc(id)}')">매주 반복</button>
           <button class="btn btn-danger"   onclick="deleteEvent('${esc(id)}')">삭제</button>
           <button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`
        : `<button class="btn btn-secondary" onclick="closeViewModal()">닫기</button>`;

    document.getElementById('viewModal').classList.add('open');
}
function closeViewModal() { document.getElementById('viewModal').classList.remove('open'); }

async function openUpModal() {
    document.getElementById('upModal').classList.add('open');
    document.getElementById('upModalContent').innerHTML = '<div class="up-empty">불러오는 중...</div>';
    try {
        const res = await fetch('up.json?t=' + Date.now());
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        renderUpModal(data, true);
    } catch {
        document.getElementById('upModalContent').innerHTML =
            '<div class="up-empty">데이터를 불러올 수 없습니다</div>';
    }
}
function closeUpModal() {
    document.getElementById('upModal').classList.remove('open');
}

function parseSoopUrl(url) {
    const clean = url.split('#')[0];
    const m = clean.match(/\/(?:station\/)?(\w+)\/post\/(\d+)/);
    return m ? [m[1], m[2]] : [null, null];
}

async function fetchSoopRankingLive(bjId, postNo) {
    const PROXY = 'https://clever-rhino-36.hanul4269.deno.net';
    const allItems = [];
    let page = 1, lastPage = 1;
    do {
        const target = `https://api-channel.sooplive.com/v1.1/channel/${bjId}/post/${postNo}/comment?page=${page}&orderBy=reg_date&cCommentNo=0&perPage=100`;
        const url = `${PROXY}?url=${encodeURIComponent(target)}`;
        try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!resp.ok) break;
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
        } catch (e) {
            console.log('SOOP fetch error:', e.message);
            break;
        }
        page++;
    } while (page <= lastPage);

    if (!allItems.length) return null;
    allItems.sort((a, b) => b.up_count - a.up_count);
    allItems.forEach((r, i) => r.rank = i + 1);
    return allItems;
}

function renderUpModal(data, fetchLive = false) {
    const events = data.events || [];
    if (!events.length) {
        document.getElementById('upModalContent').innerHTML =
            '<div class="up-empty">진행 중인 UP 이벤트가 없습니다</div>';
        return;
    }
    const updatedStr = data.updated
        ? new Date(data.updated).toLocaleString('ko-KR') : '-';

    let currentIdx = 0;

    function renderTab(idx) {
        currentIdx = idx;
        const ev = events[idx];
        const tabs = events.map((e, i) =>
            `<button class="up-tab-btn${i===idx?' active':''}" onclick="renderUpTab(${i})">${esc(e.tab)}</button>`
        ).join('');
        const ranking = ev.ranking || [];
        const baseUrl = ev.soop_url.split('#')[0];
        const items = ranking.length
            ? ranking.map(r => {
                const cls = r.rank <= 3 ? ` top${r.rank}` : '';
                const replyNo = String(r.reply_no || '').replace(/\D/g, '');
                const href = safeUrl(replyNo ? `${baseUrl}#comment_noti${replyNo}` : ev.soop_url);
                return `<div class="up-rank-item" role="link" tabindex="0" data-href="${esc(href)}"
                    onclick="window.open(this.dataset.href,'_blank','noopener noreferrer')"
                    onkeydown="if(event.key==='Enter')window.open(this.dataset.href,'_blank','noopener noreferrer')">
                    <div class="up-rank-num${cls}">${r.rank}</div>
                    <img class="up-rank-profile" src="${esc(r.profile_url)}"
                         onerror="this.src='stickers/s8.png'" alt="" loading="lazy">
                    <div class="up-rank-info">
                        <div class="up-rank-name">${esc(r.name)}</div>
                        <div class="up-rank-handle">@${esc(r.bj_id)}</div>
                        <div class="up-rank-time">${esc(r.timestamp)}</div>
                    </div>
                    <div class="up-rank-count">👍 ${Number(r.up_count).toLocaleString()}</div>
                </div>`;
            }).join('')
            : '<div class="up-empty">랭킹 데이터를 불러오는 중입니다...</div>';

        document.getElementById('upModalContent').innerHTML = `
            <div class="up-tabs">${tabs}</div>
            <div class="up-event-header">
                <div class="up-event-title">${esc(ev.title)}</div>
                <a class="up-goto-btn" href="${esc(ev.soop_url)}" target="_blank" rel="noopener">UP 바로가기 ↗</a>
            </div>
            <div class="up-ranking-list">${items}</div>
            <div class="up-updated">업데이트: ${updatedStr}</div>`;
    }

    renderUpTab = (idx) => renderTab(idx);
    renderTab(0);

    if (fetchLive) {
        events.forEach(async (ev, idx) => {
            const [bjId, postNo] = parseSoopUrl(ev.soop_url);
            if (!bjId) return;
            const ranking = await fetchSoopRankingLive(bjId, postNo);
            if (ranking !== null) {
                ev.ranking = ranking;
                if (currentIdx === idx) renderTab(idx);
            }
        });
    }
}

// ─── 추가/수정 모달 ───
function populateTypeSelect() {
    document.getElementById('editType').innerHTML = EVENT_TYPES.map(t =>
        `<option value="${t.key}">${t.label}</option>`
    ).join('');
}

function openAddModalWithType(typeKey) {
    if (!state.isEditor) return;
    const today = new Date();
    openAddModal(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()), typeKey);
}

function openAddModal(dateStr, type = 'general') {
    populateTypeSelect();
    document.getElementById('editModalTitle').textContent = '일정 추가';
    document.getElementById('editId').value        = '';
    document.getElementById('editDate').value      = dateStr;
    document.getElementById('editEndDate').value   = '';
    document.getElementById('editTime').value      = '';
    document.getElementById('editDuration').value  = '';
    document.getElementById('editTitle').value     = '';
    document.getElementById('editType').value      = type;
    document.getElementById('editCollab').value    = '';
    document.getElementById('editSubtitle').value  = '';
    document.getElementById('editVodUrl').value    = '';
    document.getElementById('editMemo').value      = '';
    document.getElementById('editIsRest').checked  = false;
    document.getElementById('editModal').classList.add('open');
}

function openEditModal(id) {
    closeViewModal();
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;
    fillEditForm(ev, '일정 수정', ev.id);
    document.getElementById('editModal').classList.add('open');
}

function fillEditForm(ev, title, id = '') {
    populateTypeSelect();
    document.getElementById('editModalTitle').textContent = title;
    document.getElementById('editId').value        = id;
    document.getElementById('editDate').value      = ev.date ?? '';
    document.getElementById('editEndDate').value   = ev.end_date ?? '';
    document.getElementById('editTime').value      = ev.start_time ? ev.start_time.slice(0, 5) : '';
    document.getElementById('editDuration').value  = ev.duration ?? '';
    document.getElementById('editTitle').value     = ev.title ?? '';
    document.getElementById('editType').value      = ev.type ?? 'general';
    document.getElementById('editCollab').value    = ev.collab ?? '';
    document.getElementById('editSubtitle').value  = ev.subtitle ?? '';
    document.getElementById('editVodUrl').value    = ev.vod_url ?? '';
    document.getElementById('editMemo').value      = ev.memo ?? '';
    document.getElementById('editIsRest').checked  = ev.is_rest ?? false;
}
function closeEditModal() { document.getElementById('editModal').classList.remove('open'); }

function copyEvent(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev || !state.isEditor) return;
    closeViewModal();
    fillEditForm(ev, '일정 복사', '');
    document.getElementById('editModal').classList.add('open');
}

async function repeatWeekly(id) {
    const ev = state.events.find(e => e.id === id);
    if (!ev || !state.isEditor) return;
    const count = Number(prompt('몇 주 반복할까요? 다음 주부터 생성됩니다.', '4'));
    if (!Number.isInteger(count) || count < 1 || count > 24) {
        showToast('1~24 사이 숫자로 입력해주세요');
        return;
    }
    const payloads = Array.from({ length: count }, (_, i) => {
        const offset = (i + 1) * 7;
        const payload = {
            date: dateToStr(addDays(dateFromStr(ev.date), offset)),
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
    const title = document.getElementById('editTitle').value.trim().replace(/\n{2,}/g, '\n');
    if (!title) { showToast('제목을 입력해주세요'); return; }
    const date = document.getElementById('editDate').value;
    if (!date)  { showToast('날짜를 선택해주세요'); return; }

    const payload = {
        date,
        end_date:   document.getElementById('editEndDate').value   || null,
        start_time: document.getElementById('editTime').value      || null,
        duration:   document.getElementById('editDuration').value.trim() || null,
        title,
        type:       document.getElementById('editType').value,
        collab:     document.getElementById('editCollab').value.trim()   || null,
        subtitle:   document.getElementById('editSubtitle').value.trim() || null,
        vod_url:    document.getElementById('editVodUrl').value.trim()   || null,
        memo:       document.getElementById('editMemo').value.trim()     || null,
        is_rest:    document.getElementById('editIsRest').checked,
    };

    const id = document.getElementById('editId').value;
    const { error } = id
        ? await db.from('schedules').update(payload).eq('id', id)
        : await db.from('schedules').insert(payload);

    if (error) { showToast('저장 실패: ' + error.message); return; }
    showToast(id ? '수정되었습니다' : '추가되었습니다');
    closeEditModal();
    await loadEvents();
}

async function deleteEvent(id) {
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
    renderEditorList();
    renderUpEventList();
    document.getElementById('adminModal').classList.add('open');
}
function closeAdminModal() { document.getElementById('adminModal').classList.remove('open'); }

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach((b, i) => {
        const names = ['editors', 'upevents'];
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
            <button class="editor-remove-btn" onclick="removeEditor('${esc(e.id)}')">삭제</button>
        </div>
    `).join('');
}

async function addEditor() {
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
    if (!confirm('이 편집자를 삭제하시겠습니까?')) return;
    const { error } = await db.from('editors').delete().eq('id', id);
    if (error) { showToast('삭제 실패'); return; }
    await loadEditors();
    renderEditorList();
    showToast('삭제되었습니다');
}

// ─── UP 이벤트 관리 ───
let upEvents = [];

async function loadUpEvents() {
    const { data, error } = await db.from('up_events').select('*').order('sort_order');
    if (!error) upEvents = data || [];
}

function renderUpEventList() {
    const list = document.getElementById('upEventList');
    if (!upEvents.length) {
        list.innerHTML = '<div class="editor-item" style="color:var(--muted);">등록된 UP 이벤트가 없습니다.</div>';
        return;
    }
    list.innerHTML = upEvents.map(e => `
        <div class="editor-item">
            <span style="flex:1;min-width:0;overflow:hidden;">
                <b>${esc(e.tab_name)}</b>
                <span style="color:var(--muted);font-size:12px;margin-left:6px;">${esc(e.title)}</span>
                <span style="color:${e.is_active ? 'var(--accent)' : 'var(--muted)'};font-size:11px;margin-left:6px;">${e.is_active ? '●활성' : '●비활성'}</span>
            </span>
            <button class="editor-remove-btn" onclick="removeUpEvent(${e.id})">삭제</button>
        </div>
    `).join('');
}

async function addUpEvent() {
    const tabName  = document.getElementById('newUpTab').value.trim();
    const title    = document.getElementById('newUpTitle').value.trim();
    const soopUrl  = document.getElementById('newUpUrl').value.trim();
    const sortOrder = parseInt(document.getElementById('newUpOrder').value) || 0;
    if (!tabName || !title || !soopUrl) { showToast('탭 이름, 제목, URL을 모두 입력해주세요'); return; }
    if (!soopUrl.includes('sooplive') && !soopUrl.includes('afreecatv')) {
        showToast('올바른 SOOP URL을 입력해주세요'); return;
    }
    const { error } = await db.from('up_events').insert({
        tab_name: tabName, title, soop_url: soopUrl, sort_order: sortOrder, is_active: true,
    });
    if (error) { showToast('추가 실패: ' + error.message); return; }
    ['newUpTab','newUpTitle','newUpUrl','newUpOrder'].forEach(id => {
        document.getElementById(id).value = '';
    });
    showToast('UP 이벤트 추가됨');
    await loadUpEvents();
    renderUpEventList();
}

async function removeUpEvent(id) {
    if (!confirm('이 UP 이벤트를 삭제하시겠습니까?')) return;
    const { error } = await db.from('up_events').delete().eq('id', id);
    if (error) { showToast('삭제 실패'); return; }
    await loadUpEvents();
    renderUpEventList();
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
}
function goToday() {
    const now = new Date();
    state.year  = now.getFullYear();
    state.month = now.getMonth();
    state.mobileStartDate = dateToStr(now);
    state.weekStart = dateToStr(addDays(now, -now.getDay()));
    loadEvents();
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
        picture: userLike.picture || userLike.user_metadata?.avatar_url || userLike.user_metadata?.picture || '',
    };
}

async function initAuth() {
    // 이전 세션에서 편집자였다면 즉시 is-editor 클래스 적용 (네트워크 대기 없이)
    if (localStorage.getItem('beadyo_was_editor') === '1') {
        document.body.classList.add('is-editor');
    }
    const { data: { session } } = await db.auth.getSession();
    await setSessionUser(normalizeAuthUser(session?.user));
    db.auth.onAuthStateChange((_event, session) => {
        setSessionUser(normalizeAuthUser(session?.user));
    });

    window.addEventListener('message', event => {
        const { data } = event;
        if (!data) return;
        if (data.type === 'beadyo-auth-sync') {
            setSessionUser(normalizeAuthUser(data.user));
        } else if (data.type === 'beadyo-auth-action') {
            if (data.action === 'open-admin' && state.isOwner) openAdminModal();
        }
    });
}

async function setSessionUser(user) {
    state.user = user ? {
        email: user.email,
        name: user.name || user.email,
        picture: user.picture || '',
    } : null;
    if (!state.user) {
        state.isEditor = false;
        state.isOwner = false;
        document.body.classList.remove('is-editor');
        localStorage.removeItem('beadyo_was_editor');
        renderCalendar();
        return;
    }
    state.isOwner = state.user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
    await loadEditors();
    state.isEditor = state.isOwner || state.editors.some(e => e.email.toLowerCase() === state.user.email.toLowerCase());
    document.body.classList.toggle('is-editor', state.isEditor);
    localStorage.setItem('beadyo_was_editor', state.isEditor ? '1' : '0');
    renderCalendar();
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
    if (document.visibilityState === 'visible' && !_eventsLoaded) {
        loadEvents();
    }
});

// ── 이스터에그 ──
const STICKERS = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','s15'];
const CONFETTI_COLORS = ['#ff7eb3','#ffcd3c','#7bc67e','#6eb5ff','#ff8c69','#c77dff','#ff6b6b'];

// ─── 초기화 ───
renderLegend();
loadEvents().catch(err => {
    console.error('initial loadEvents:', err);
    state.events = [];
    renderCalendar();
});
initAuth();
checkBirthday();

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
    const picks = [...STICKERS].sort(() => Math.random() - 0.5).slice(0, 12);
    picks.forEach((s, i) => {
        setTimeout(() => {
            const el = document.createElement('img');
            el.className = 'easter-sticker';
            const size = 36 + Math.random() * 30;
            const top  = 5 + Math.random() * 80;
            const dy   = (Math.random() - 0.5) * 120;
            const rot  = (Math.random() - 0.5) * 540;
            const dur  = 1.2 + Math.random() * 0.8;
            el.src = `stickers/${s}.png`;
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
