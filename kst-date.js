/* KST(한국 시간) 날짜 계산·표기.
 * toLocaleString / Intl.DateTimeFormat 결과는 브라우저·ICU 버전·기기 설정에 따라
 * '2026. 11. 25.' 또는 '2026/11/25'처럼 달라지므로, 사이트 표기는 여기서 직접 만든다.
 * 한국은 서머타임이 없어 UTC+9 고정 오프셋으로 정확히 계산된다. */
(function (root) {
    'use strict';
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
    const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
    const pad = n => String(n).padStart(2, '0');

    function toDate(value) {
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
        if (value === null || value === undefined || value === '') return null;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : null;
    }

    // 날짜만 있는 'YYYY-MM-DD'는 시간대 변환 없이 그 날짜 그대로 쓴다.
    function dayParts(day) {
        const m = DAY_RE.exec(String(day || ''));
        if (!m) return null;
        const [year, month, date] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const utc = new Date(Date.UTC(year, month - 1, date));
        if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) return null;
        return { year, month, day: date, hour: 0, minute: 0, second: 0, weekday: utc.getUTCDay() };
    }

    // 시각(타임스탬프)은 KST 벽시계 기준 부분으로 바꾼다.
    function parts(value) {
        if (typeof value === 'string' && DAY_RE.test(value)) return dayParts(value);
        const date = toDate(value);
        if (!date) return null;
        const k = new Date(date.getTime() + KST_OFFSET_MS);
        return {
            year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate(),
            hour: k.getUTCHours(), minute: k.getUTCMinutes(), second: k.getUTCSeconds(),
            weekday: k.getUTCDay(),
        };
    }

    function dayKey(value = new Date()) {
        const p = parts(value);
        return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : '';
    }

    // 오늘(KST)의 연·월(0부터)·일. 달력 초기 월·'오늘' 표시에 쓴다.
    function today(now = new Date()) {
        const p = parts(now);
        return { year: p.year, month: p.month - 1, day: p.day, key: dayKey(now) };
    }

    // KST 날짜를 기기 시간대와 무관한 로컬 자정 Date로 만든다(달력 칸 계산용).
    function todayLocalDate(now = new Date()) {
        const t = today(now);
        return new Date(t.year, t.month, t.day);
    }

    const time = (p, seconds) => `${pad(p.hour)}:${pad(p.minute)}${seconds ? `:${pad(p.second)}` : ''}`;
    const weekday = p => WEEKDAYS[p.weekday];

    // 2026. 11. 25.
    function formatDate(value) {
        const p = parts(value);
        return p ? `${p.year}. ${pad(p.month)}. ${pad(p.day)}.` : '';
    }
    // 2026. 11. 25. 21:05 (seconds: 21:05:09)
    function formatDateTime(value, { seconds = false } = {}) {
        const p = parts(value);
        return p ? `${formatDate(value)} ${time(p, seconds)}` : '';
    }
    // 2026년 11월 25일 (weekday: 2026년 11월 25일 (수))
    function formatLongDate(value, { weekday: withWeekday = false } = {}) {
        const p = parts(value);
        if (!p) return '';
        return `${p.year}년 ${p.month}월 ${p.day}일${withWeekday ? ` (${weekday(p)})` : ''}`;
    }
    // 2026년 11월 25일 21:05
    function formatLongDateTime(value) {
        const p = parts(value);
        return p ? `${formatLongDate(value)} ${time(p)}` : '';
    }
    // 11월 25일 (수)
    function formatMonthDay(value, { weekday: withWeekday = true } = {}) {
        const p = parts(value);
        if (!p) return '';
        return `${p.month}월 ${p.day}일${withWeekday ? ` (${weekday(p)})` : ''}`;
    }
    // 11월 25일 21:05
    function formatMonthDayTime(value) {
        const p = parts(value);
        return p ? `${formatMonthDay(value, { weekday: false })} ${time(p)}` : '';
    }

    const api = Object.freeze({
        KST_OFFSET_MS, parts, dayKey, today, todayLocalDate,
        formatDate, formatDateTime, formatLongDate, formatLongDateTime, formatMonthDay, formatMonthDayTime,
    });
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BeadyoKstDate = api;
})(typeof window === 'object' ? window : globalThis);
