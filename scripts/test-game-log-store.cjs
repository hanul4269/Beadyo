const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../game-log-store.js');

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const categories = [{ id: 'puzzle' }, { id: 'horror' }];
const values = extra => ({ title: '[테스트용] 가짜 게임', genres: ['puzzle'], played_date: '2026-12-01', official_url: '', source_url: '', notes: '', ...extra });
const payload = extra => S.buildPayload(values(extra), [], categories, id(1));
const row = extra => ({ ...payload(), created_at: '2026-11-02T12:00:00.000Z', ...extra });

function memoryDB(options = {}) {
    const state = { rows: structuredClone(options.rows || []), calls: [], signals: [] };
    const db = { from(table) {
        assert.equal(table, 'game_log_entries');
        const request = { operation: 'select', fields: '', range: null, eq: null, cardinality: 'many', signal: null };
        const chain = {
            select(fields) { request.fields = fields; return chain; },
            insert(item) { request.operation = 'insert'; request.payload = item; return chain; },
            order() { return chain; },
            range(from, to) { request.range = [from, to]; return chain; },
            eq(key, value) { request.eq = [key, value]; return chain; },
            abortSignal(signal) { request.signal = signal; state.signals.push(signal); return chain; },
            single() { request.cardinality = 'single'; return chain; },
            maybeSingle() { request.cardinality = 'maybe'; return chain; },
            then(resolve, reject) { return Promise.resolve().then(async () => {
                state.calls.push(request);
                assert.equal(request.fields, S.FIELDS);
                if (options.execute) {
                    const overridden = await options.execute(request, state);
                    if (overridden !== undefined) return overridden;
                }
                if (request.operation === 'insert') {
                    const item = request.payload;
                    if (state.rows.some(saved => saved.id === item.id || saved.title.toLowerCase() === item.title.toLowerCase())) return { data: null, error: { code: '23505' } };
                    const saved = { ...structuredClone(item), created_at: '2026-11-02T12:00:00.000Z' };
                    state.rows.push(saved);
                    return { data: structuredClone(saved), error: null };
                }
                let data = [...state.rows];
                if (request.eq) data = data.filter(item => item[request.eq[0]] === request.eq[1]);
                if (request.range) data = data.slice(request.range[0], request.range[1] + 1);
                return { data: request.cardinality === 'many' ? structuredClone(data) : structuredClone(data[0] || null), error: null };
            }).then(resolve, reject); },
        };
        return chain;
    } };
    return { db, state };
}

test('payload validation trims optional fields, preserves a valid leap day and deduplicates selected genres', () => {
    assert.deepEqual(S.buildPayload(values({ title: '  가짜 게임  ', genres: ['puzzle', 'puzzle'], played_date: '2024-02-29', official_url: 'https://example.com', notes: ' 확인 메모 ' }), [], categories, id(1)), {
        id: id(1), title: '가짜 게임', genres: ['puzzle'], played_date: '2024-02-29', official_url: 'https://example.com/', source_url: null, notes: '확인 메모',
    });
    assert.equal(payload({ played_date: '' }).played_date, null);
});

test('invalid dates, names, unknown genres, oversized text and unsafe URLs never form a write payload', () => {
    for (const change of [
        { title: '' }, { title: 'x'.repeat(161) }, { title: 'line\nbreak' }, { title: '---' },
        { played_date: '2026-02-29' }, { played_date: '2026-04-31' }, { played_date: '2026-2-01' }, { played_date: '0000-01-01' },
        { genres: ['not-a-category'] }, { genres: 'puzzle' }, { notes: 'x'.repeat(2001) },
        { official_url: 'javascript:alert(1)' }, { official_url: '/relative' }, { official_url: 'https://user:password@example.com' }, { source_url: 'data:text/html,hello' },
    ]) assert.throws(() => payload(change), error => error.code === 'VALIDATION' && /[가-힣]/.test(error.message));
    assert.throws(() => S.buildPayload(values(), [], categories, 'not-a-uuid'), /게임 정보/);
});

test('new titles also check normalized aliases of the existing archive without changing any stored data', () => {
    const existing = [{ title: 'Different Name', aliases: ['Night: Quest!'], dates: [{ date: '2025-01-01' }] }];
    const before = JSON.stringify(existing);
    assert.throws(() => S.buildPayload(values({ title: 'ＮＩＧＨＴ-ＱＵＥＳＴ' }), existing, categories, id(1)), error => error.code === 'DUPLICATE');
    assert.equal(JSON.stringify(existing), before);
    assert.equal(S.buildPayload(values(), existing, categories, id(1)).title, '[테스트용] 가짜 게임');
});

test('row conversion produces a manual game record and leaves an unconfirmed date genuinely empty', () => {
    const original = row({ source_url: 'https://example.com/replay', notes: '가짜 기록' });
    const before = JSON.stringify(original);
    const game = S.rowToGame(original);
    assert.equal(game.id, `custom-${id(1)}`);
    assert.equal(game.image, null);
    assert.deepEqual(game.genres, ['puzzle']);
    assert.equal(game.dates[0].confidence, 'manual');
    assert.equal(game.dates[0].date, '2026-12-01');
    assert.equal(game.dates[0].sourceUrl, 'https://example.com/replay');
    const undated = S.rowToGame(row({ played_date: null, notes: '날짜 미확인 메모', source_url: 'https://example.com/undated-record' }));
    assert.deepEqual(undated.dates, []);
    assert.equal(undated.customNote, '날짜 미확인 메모');
    assert.equal(undated.customSourceUrl, 'https://example.com/undated-record');
    assert.equal(game.customNote, '가짜 기록');
    assert.equal(game.customSourceUrl, 'https://example.com/replay');
    game.genres.push('horror');
    assert.equal(JSON.stringify(original), before);
    assert.throws(() => S.rowToGame(row({ id: 'invalid' })), error => error.code === 'INVALID_RECORD');
});

test('public reads collect every page using only the declared fields and preserve the database rows', async () => {
    const rows = Array.from({ length: 5 }, (_, n) => row({ id: id(n + 1), title: `가짜 게임 ${n}` }));
    const original = JSON.stringify(rows);
    const { db, state } = memoryDB({ rows });
    const result = await S.readEntries(db, { pageSize: 2 });
    assert.equal(result.length, 5);
    assert.deepEqual(state.calls.map(call => call.range), [[0, 1], [2, 3], [4, 5]]);
    result[0].genres.push('horror');
    assert.equal(JSON.stringify(rows), original);
    assert.equal(state.rows[0].genres.length, 1);
});

test('a missing setup table retains the backend code and never masquerades as an empty archive', async () => {
    const { db } = memoryDB({ execute: () => ({ data: null, error: { code: 'PGRST205' } }) });
    await assert.rejects(S.readEntries(db), error => error.code === 'PGRST205');
    const networkFailure = memoryDB({ execute: () => { throw new Error('Network unavailable'); } });
    await assert.rejects(S.readEntries(networkFailure.db), error => error.code === 'READ_FAILED');
});

test('malformed and duplicate read rows fail rather than exposing a partial list', async () => {
    const invalid = memoryDB({ rows: [row({ title: '' })] });
    await assert.rejects(S.readEntries(invalid.db), error => error.code === 'INVALID_RECORD');
    const duplicate = memoryDB({ rows: [row(), row()] });
    await assert.rejects(S.readEntries(duplicate.db), error => error.code === 'INVALID_RECORD');
});

test('a stalled public read aborts at its deadline and a later independent read recovers', async () => {
    const stalled = memoryDB({ execute: () => new Promise(() => {}) });
    await assert.rejects(S.readEntries(stalled.db, { timeoutMs: 10 }), error => error.code === 'TIMEOUT');
    assert.equal(stalled.state.signals[0].aborted, true);
    const recovered = memoryDB({ rows: [row()] });
    assert.equal((await S.readEntries(recovered.db)).length, 1);
});

test('insert success requires a returned matching record and returns a detached row', async () => {
    const { db, state } = memoryDB();
    const result = await S.addEntry(db, payload());
    assert.equal(result.id, id(1));
    assert.equal(state.rows.length, 1);
    assert.equal(state.calls.length, 1);
    result.genres.push('horror');
    assert.equal(state.rows[0].genres.length, 1);
});

test('an absent representation cannot produce a successful save when its UUID is not found', async () => {
    const { db, state } = memoryDB({ execute: request => request.operation === 'insert' ? { data: null, error: null } : undefined });
    await assert.rejects(S.addEntry(db, payload()), error => error.code === 'SAVE_UNCONFIRMED');
    assert.equal(state.rows.length, 0);
    assert.deepEqual(state.calls[1].eq, ['id', id(1)]);
});

test('permission rejection is preserved and never appends an optimistic record', async () => {
    const { db, state } = memoryDB({ execute: request => request.operation === 'insert' ? { data: null, error: { code: '42501' } } : undefined });
    await assert.rejects(S.addEntry(db, payload()), error => error.code === '42501');
    assert.equal(state.rows.length, 0);
});

test('an ambiguous network failure only becomes success after the exact saved UUID and payload are read back', async () => {
    const { db, state } = memoryDB({ execute: (request, store) => {
        if (request.operation !== 'insert') return;
        store.rows.push({ ...structuredClone(request.payload), created_at: '2026-11-02T12:00:00.000Z' });
        throw new Error('Connection lost after commit');
    } });
    const result = await S.addEntry(db, payload());
    assert.equal(result.id, id(1));
    assert.equal(state.rows.length, 1);
    assert.deepEqual(state.calls[1].eq, ['id', id(1)]);
});

test('retrying the same request UUID confirms its existing row without creating a second record', async () => {
    const { db, state } = memoryDB({ rows: [row()] });
    assert.equal((await S.addEntry(db, payload())).id, id(1));
    assert.equal(state.rows.length, 1);
    await assert.rejects(S.addEntry(db, payload({ notes: '다른 내용' })), error => error.code === '23505');
    assert.equal(state.rows[0].notes, null);
});

test('a different UUID or changed payload in a response or verification read never counts as confirmation', async () => {
    for (const changed of [{ id: id(2) }, { title: '다른 게임' }, { genres: ['horror'] }, { played_date: '2026-12-02' }]) {
        const wrong = row(changed);
        const { db } = memoryDB({ execute: () => ({ data: wrong, error: null }) });
        await assert.rejects(S.addEntry(db, payload()), error => error.code === 'SAVE_UNCONFIRMED');
    }
});

test('insert and verification stalls are bounded and cannot invent a saved record', async () => {
    const { db, state } = memoryDB({ execute: () => new Promise(() => {}) });
    await assert.rejects(S.addEntry(db, payload(), { timeoutMs: 10 }), error => error.code === 'TIMEOUT');
    assert.equal(state.signals.length, 2);
    assert.ok(state.signals.every(signal => signal.aborted));
    assert.equal(state.rows.length, 0);
});
