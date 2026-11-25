// Run with: node --test scripts/test-kst-dates.cjs
// Dates must read the same in every device time zone and browser locale:
// HOME and CALENDAR both use Korea time (KST, UTC+9, no DST).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

const ZONES = ['Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Europe/London', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const INSTANTS = {
    // KST 2026-11-25 01:30 — still Nov 24 in UTC and Los Angeles.
    kstAfterMidnight: '2026-11-24T16:30:00Z',
    // KST 2026-11-25 23:59:59 — already Nov 26 in Kiritimati (UTC+14).
    kstBeforeMidnight: '2026-11-25T14:59:59Z',
    // Los Angeles DST starts at 10:00Z on 2026-03-08; KST is 19:30.
    laDstStart: '2026-03-08T10:30:00Z',
    // Year boundary: KST 2027-01-01 00:10, LA is still 2026-12-31.
    newYear: '2026-12-31T15:10:00Z',
};

// Runs inside a child process with a fixed TZ so the device time zone really differs.
function probe() {
    const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
    const [root, instantsJson] = process.argv.slice(-2), instants = JSON.parse(instantsJson);
    const K = require(path.join(root, 'kst-date.js'));
    const homeData = require(path.join(root, 'home-data.js'));
    const monthly = require(path.join(root, 'monthly-data.js'));
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const cut = (start, end) => { const from = app.indexOf(start); return app.slice(from, app.indexOf(end, from)); };
    const out = { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, rows: {} };
    for (const [name, iso] of Object.entries(instants)) {
        const ms = Date.parse(iso);
        // CALENDAR: run the real kstToday/goToday with Date.now pinned to the instant.
        class FixedDate extends Date {
            constructor(...args) { super(...(args.length ? args : [ms])); }
            static now() { return ms; }
        }
        const ctx = vm.createContext({ Date: FixedDate, state: { year: 0, month: 0 }, pendingCalendarDate: '', loadEvents() {}, loadMemoCards: async () => {} });
        vm.runInContext(cut('function pad(n)', 'function eventEndDate(') + cut('function goToday()', 'function navigateMobileDays('), ctx);
        vm.runInContext('goToday()', ctx);
        out.rows[name] = {
            kstDayKey: K.dayKey(new Date(ms)),
            homeDayKey: homeData.dayKey(new Date(ms)),
            monthlyDayKey: monthly.dayKey(new Date(ms)),
            calendarToday: vm.runInContext('dateToStr(kstToday())', ctx),
            calendarState: { year: ctx.state.year, month: ctx.state.month, mobileStartDate: ctx.state.mobileStartDate, weekStart: ctx.state.weekStart },
            formatDate: K.formatDate(iso),
            formatDateTime: K.formatDateTime(iso),
            formatDateTimeSeconds: K.formatDateTime(iso, { seconds: true }),
            formatLongDate: K.formatLongDate(iso, { weekday: true }),
            formatLongDateTime: K.formatLongDateTime(iso),
            formatMonthDay: K.formatMonthDay(iso),
            formatMonthDayTime: K.formatMonthDayTime(iso),
            dateOnly: K.formatLongDate('2026-11-25', { weekday: true }) + ' | ' + K.formatDate('2026-11-25'),
        };
    }
    process.stdout.write(JSON.stringify(out));
}

function runIn(tz, lang = 'ko_KR.UTF-8') {
    const json = execFileSync(process.execPath, ['-e', `(${probe})()`, root, JSON.stringify(INSTANTS)],
        { env: { ...process.env, TZ: tz, LANG: lang, LC_ALL: lang }, encoding: 'utf8' });
    return JSON.parse(json);
}

const results = Object.fromEntries(ZONES.map(tz => [tz, runIn(tz)]));

test('child processes really ran in different device time zones', () => {
    for (const tz of ZONES) assert.equal(results[tz].tz, tz);
});

test('HOME, monthly and CALENDAR agree on today (KST) in every time zone', () => {
    const expected = { kstAfterMidnight: '2026-11-25', kstBeforeMidnight: '2026-11-25', laDstStart: '2026-03-08', newYear: '2027-01-01' };
    for (const tz of ZONES) for (const [name, day] of Object.entries(expected)) {
        const row = results[tz].rows[name];
        assert.equal(row.kstDayKey, day, `${tz} ${name} kst`);
        assert.equal(row.homeDayKey, day, `${tz} ${name} home`);
        assert.equal(row.monthlyDayKey, day, `${tz} ${name} monthly`);
        assert.equal(row.calendarToday, day, `${tz} ${name} calendar today`);
        assert.equal(row.calendarState.mobileStartDate, day, `${tz} ${name} goToday mobile date`);
        const [y, m] = day.split('-').map(Number);
        assert.equal(row.calendarState.year, y, `${tz} ${name} goToday year`);
        assert.equal(row.calendarState.month, m - 1, `${tz} ${name} goToday month`);
    }
});

test('goToday week starts on the KST Sunday in every time zone', () => {
    // 2026-11-25 (Wed) → week starts Sun 2026-11-22; 2027-01-01 (Fri) → Sun 2026-12-27.
    for (const tz of ZONES) {
        assert.equal(results[tz].rows.kstAfterMidnight.calendarState.weekStart, '2026-11-22', tz);
        assert.equal(results[tz].rows.newYear.calendarState.weekStart, '2026-12-27', tz);
    }
});

test('formatted dates are identical across time zones and use one fixed notation', () => {
    const base = results['Asia/Seoul'].rows;
    for (const tz of ZONES) assert.deepEqual(results[tz].rows, base, tz);
    assert.deepEqual(base.kstAfterMidnight, {
        ...base.kstAfterMidnight,
        formatDate: '2026. 11. 25.',
        formatDateTime: '2026. 11. 25. 01:30',
        formatDateTimeSeconds: '2026. 11. 25. 01:30:00',
        formatLongDate: '2026년 11월 25일 (수)',
        formatLongDateTime: '2026년 11월 25일 01:30',
        formatMonthDay: '11월 25일 (수)',
        formatMonthDayTime: '11월 25일 01:30',
        dateOnly: '2026년 11월 25일 (수) | 2026. 11. 25.',
    });
    assert.equal(base.kstBeforeMidnight.formatDateTimeSeconds, '2026. 11. 25. 23:59:59');
    assert.equal(base.newYear.formatLongDate, '2027년 1월 1일 (금)');
});

test('browser language settings do not change the notation', () => {
    const en = runIn('America/Los_Angeles', 'en_US.UTF-8');
    assert.deepEqual(en.rows, results['Asia/Seoul'].rows);
});

test('invalid values format to an empty string instead of "Invalid Date"', () => {
    const K = require('../kst-date.js');
    for (const value of [null, undefined, '', 'not a date', '2026-02-30']) {
        assert.equal(K.formatDate(value), '', String(value));
        assert.equal(K.formatDateTime(value), '', String(value));
    }
});

test('site code no longer formats dates through browser locale APIs', () => {
    const files = fs.readdirSync(root).filter(name => /\.(js|html)$/.test(name) && !/\.min\.js$|-data\.js$/.test(name) || /^(home|monthly)-data\.js$/.test(name));
    const offenders = [];
    for (const name of files) {
        const text = fs.readFileSync(path.join(root, name), 'utf8');
        text.split('\n').forEach((line, i) => {
            if (/toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat\(|new Date\([^)]*\)\.toLocaleString|\.toLocaleString\(\s*'ko-KR'\s*,\s*\{\s*(dateStyle|timeStyle|year|month)/.test(line)) offenders.push(`${name}:${i + 1}`);
        });
    }
    assert.deepEqual(offenders, []);
});

test('the CALENDAR has no device-time "today" left', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    for (const pattern of [/const (today|now)\s*=\s*new Date\(\);/, /dateToStr\(new Date\(\)\)/, /new Date\(\)\.get(FullYear|Month|Date|Day)\(\)/])
        assert.doesNotMatch(app, pattern);
});
