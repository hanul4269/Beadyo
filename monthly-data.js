(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoMonthlyData = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    function dayKey(now = new Date()) {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
    }
    function validDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
        const n = Date.parse(value + 'T00:00:00Z');
        return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value ? value : '';
    }
    function validMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') && validDate(value + '-01') ? value : ''; }
    function recordDate(row, field) {
        const activity = validDate(row[field]);
        if (activity) return { date:activity, basis:'activity' };
        // Only absent dates allow a timestamp fallback; corrupt activity dates are not reinterpreted.
        if (row[field] != null && row[field] !== '') return { date:'', basis:'unknown' };
        const stamp = row.created_at;
        if (typeof stamp !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(Date.parse(stamp))) return { date:'', basis:'unknown' };
        return { date:dayKey(new Date(stamp)), basis:'registered' };
    }
    function select(rows, field, month, today = dayKey(), excludeStats = false) {
        if (!validMonth(month)) return [];
        return (rows || []).map(row => ({ ...row, ...recordDate(row, field) }))
            .filter(row => row.date && row.date.startsWith(month + '-') && row.date <= today && (!excludeStats || row.exclude_from_stats !== true))
            .sort((a,b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
    }
    function bounds(month) {
        if (!validMonth(month)) throw new Error('Invalid month');
        const [year, m] = month.split('-').map(Number);
        const end = new Date(0); end.setUTCFullYear(year, m, 0); end.setUTCHours(0,0,0,0);
        return { start:month+'-01', end:end.toISOString().slice(0,10) };
    }
    return Object.freeze({ dayKey, validDate, validMonth, recordDate, select, bounds });
});
