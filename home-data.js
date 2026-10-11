/* HOME rules operate on existing records; no inferred content relationships. */
(function (root) {
    'use strict';
    const BROADCAST_TYPES = new Set(['chat', 'song', 'solo', 'collab', 'watch', 'game', 'ad', 'relay']);
    function dayKey(now = new Date()) {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    }
    function dayNumber(date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return NaN;
        const stamp = Date.parse(`${date}T00:00:00Z`);
        return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date ? stamp / 86400000 : NaN;
    }
    function addDays(date, days) {
        const n = dayNumber(date);
        return Number.isFinite(n) ? new Date((n + days) * 86400000).toISOString().slice(0, 10) : '';
    }
    function onDay(event, day) {
        return Number.isFinite(dayNumber(event.date)) && event.date <= day && (event.end_date || event.date) >= day;
    }
    function isRest(event) { return event.is_rest === true || event.type === 'rest'; }
    function isBroadcast(event) { return !isRest(event) && BROADCAST_TYPES.has(event.type); }
    function sortSchedules(rows) {
        return rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) ||
            String(a.start_time || '99:99').localeCompare(String(b.start_time || '99:99')) || String(a.id).localeCompare(String(b.id)));
    }
    function broadcastState(live, schedules, now = new Date()) {
        const stamp = Date.parse(live?.updated || live?.row_updated_at || '');
        const age = now.getTime() - stamp;
        const fresh = typeof live?.live === 'boolean' && Number.isFinite(age) && age >= -60000 && age <= 30 * 60 * 1000;
        if (!fresh) return { label: '상태 확인 불가', detail: 'SOOP 방송 상태를 확인하지 못했습니다. 채널에서 직접 확인해 주세요.', kind: 'unknown' };
        if (live.live) return { label: '방송 중', detail: live.title || '지금 SOOP에서 방송 중입니다.', kind: 'live', updated: stamp };
        if (!Array.isArray(schedules)) return { label: '상태 확인 불가', detail: '현재 SOOP은 방송 중이 아닙니다. 방송 일정은 확인하지 못했습니다.', kind: 'unknown', updated: stamp };
        const today = dayKey(now);
        const todayRows = schedules.filter(e => onDay(e, today));
        const rests = todayRows.filter(isRest);
        if (rests.length && !todayRows.some(isBroadcast)) return { label: '휴방', detail: rests[0].title || '오늘 휴방 일정이 등록되어 있습니다.', kind: 'rest', updated: stamp };
        if (rests.length && todayRows.some(isBroadcast)) return { label: '상태 확인 불가', detail: '오늘 휴방과 방송 일정이 함께 등록되어 있습니다. CALENDAR에서 확인해 주세요.', kind: 'unknown', updated: stamp };
        const next = sortSchedules(schedules).find(e => isBroadcast(e) && (e.date > today ||
            (onDay(e, today) && (!e.start_time || Date.parse(`${e.date}T${e.start_time}+09:00`) > now.getTime()))));
        if (next) return { label: '방송 예정', detail: next.title, next, kind: 'scheduled', updated: stamp };
        return { label: '상태 확인 불가', detail: '현재 SOOP은 방송 중이 아닙니다. 예정 방송이나 오늘 휴방 정보가 등록되어 있지 않습니다.', kind: 'unknown', updated: stamp };
    }
    const api = Object.freeze({ dayKey, dayNumber, addDays, onDay, isRest, isBroadcast, sortSchedules, broadcastState });
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoHomeData = api;
})(typeof window === 'object' ? window : globalThis);
