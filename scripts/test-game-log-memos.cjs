// Run with: node --test scripts/test-game-log-memos.cjs
// 가짜 DB(메모리)만 사용합니다. 운영 DB나 네트워크에는 요청하지 않습니다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../game-log-memos.js');

const root = path.resolve(__dirname, '..');

function memoryDB(options = {}) {
    const state = { rows: new Map((options.rows || []).map(row => [row.game_id, { ...row }])), calls: [] };
    const db = { from(table) {
        assert.equal(table, 'game_log_memos');
        const request = { operation: 'select', fields: '', eq: null, range: null, cardinality: 'many', payload: null, upsertOptions: null };
        const chain = {
            select(fields) { request.fields = fields; return chain; },
            upsert(item, opts) { request.operation = 'upsert'; request.payload = item; request.upsertOptions = opts; return chain; },
            delete() { request.operation = 'delete'; return chain; },
            order() { return chain; },
            range(from, to) { request.range = [from, to]; return chain; },
            eq(key, value) { request.eq = [key, value]; return chain; },
            abortSignal() { return chain; },
            single() { request.cardinality = 'single'; return chain; },
            then(resolve, reject) {
                return Promise.resolve().then(() => {
                    state.calls.push(request);
                    if (options.execute) return options.execute(request, state);
                    if (request.operation === 'select') {
                        const all = [...state.rows.values()].sort((a, b) => a.game_id.localeCompare(b.game_id));
                        return { data: all.slice(request.range[0], request.range[1] + 1), error: null };
                    }
                    if (request.operation === 'upsert') {
                        const saved = { ...request.payload, updated_at: '2026-11-26T00:00:00Z' };
                        state.rows.set(saved.game_id, saved);
                        return { data: saved, error: null };
                    }
                    const [, id] = request.eq;
                    const existed = state.rows.get(id);
                    if (options.denyDelete || !existed) return { data: [], error: null }; // RLS: 오류 없이 0행
                    state.rows.delete(id);
                    return { data: [{ game_id: id }], error: null };
                }).then(resolve, reject);
            },
        };
        return chain;
    } };
    return { db, state };
}

test('memo text keeps line breaks, trims edges and enforces 2000 characters', () => {
    assert.equal(M.memoText('  첫 줄\r\n둘째 줄  '), '첫 줄\n둘째 줄');
    assert.equal(M.memoText(''), '');
    assert.equal(M.memoText(null), '');
    assert.equal(M.memoText('가'.repeat(2000)).length, 2000);
    assert.throws(() => M.memoText('가'.repeat(2001)), /2000자/);
    assert.throws(() => M.memoText('bad\u0000char'), /쓸 수 없는/);
    assert.throws(() => M.memoText(42), /확인/);
});

test('game ids must match the catalog/custom id format, including prototype-like names', () => {
    for (const ok of ['minecraft', 'among-us-3d', 'custom-00000000-0000-4000-8000-000000000001']) assert.equal(M.gameId(ok), ok);
    for (const bad of ['', '__proto__', 'constructor ', 'Minecraft', '-lead', '../x', 'a'.repeat(161), null]) {
        assert.throws(() => M.gameId(bad), /게임을 확인/);
    }
});

test('readMemos returns a Map, pages through rows and skips malformed rows', async () => {
    const rows = [
        { game_id: 'minecraft', memo: '[테스트용] 재밌음', updated_at: 'x' },
        { game_id: 'BAD ID', memo: '무시됨' },
        { game_id: 'among-us-3d', memo: '   ' },
        { game_id: '__proto__', memo: '무시됨' },
    ];
    const { db, state } = memoryDB({ rows });
    const memos = await M.readMemos(db, { pageSize: 2 });
    assert.ok(memos instanceof Map);
    assert.deepEqual([...memos.keys()], ['minecraft']);
    assert.equal(memos.get('minecraft').memo, '[테스트용] 재밌음');
    assert.equal(state.calls.length, 3); // 2 + 2 + 0 rows
    assert.equal(state.calls[0].fields, M.FIELDS);
});

test('readMemos reports a read failure (missing table) instead of crashing the page', async () => {
    const { db } = memoryDB({ execute: () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) });
    await assert.rejects(M.readMemos(db), error => error.code === 'READ_FAILED');
});

test('saveMemo upserts by game_id and verifies the saved row', async () => {
    const { db, state } = memoryDB();
    const saved = await M.saveMemo(db, 'minecraft', '  [테스트용]\n메모  ');
    assert.deepEqual(state.calls[0].payload, { game_id: 'minecraft', memo: '[테스트용]\n메모' });
    assert.deepEqual(state.calls[0].upsertOptions, { onConflict: 'game_id' });
    assert.equal(state.calls[0].cardinality, 'single');
    assert.equal(saved.memo, '[테스트용]\n메모');
    await assert.rejects(M.saveMemo(db, 'minecraft', '   '), /입력해/);
    await assert.rejects(M.saveMemo(db, '__proto__', '메모'), /게임을 확인/);
});

test('saveMemo fails when the database rejects or returns a different row', async () => {
    const denied = memoryDB({ execute: () => ({ data: null, error: { code: '42501', message: 'permission denied' } }) });
    await assert.rejects(M.saveMemo(denied.db, 'minecraft', '메모'), error => error.code === 'SAVE_FAILED');
    const mismatch = memoryDB({ execute: request => ({ data: { game_id: request.payload.game_id, memo: '다른 내용' }, error: null }) });
    await assert.rejects(M.saveMemo(mismatch.db, 'minecraft', '메모'), error => error.code === 'SAVE_FAILED');
});

test('deleteMemo succeeds only when exactly one row was removed (RLS denial returns 0 rows)', async () => {
    const ok = memoryDB({ rows: [{ game_id: 'minecraft', memo: '[테스트용]' }] });
    assert.equal(await M.deleteMemo(ok.db, 'minecraft'), true);
    assert.equal(ok.state.rows.has('minecraft'), false);
    assert.deepEqual(ok.state.calls[0].eq, ['game_id', 'minecraft']);

    const denied = memoryDB({ rows: [{ game_id: 'minecraft', memo: '[테스트용]' }], denyDelete: true });
    await assert.rejects(M.deleteMemo(denied.db, 'minecraft'), error => error.code === 'DELETE_FAILED');
    assert.equal(denied.state.rows.has('minecraft'), true);
});

test('pages load the memo module before game-log.js and the review field exists', () => {
    const gameHtml = fs.readFileSync(path.join(root, 'game-log.html'), 'utf8');
    assert.ok(gameHtml.indexOf('game-log-memos.js') > 0 && gameHtml.indexOf('game-log-memos.js') < gameHtml.indexOf('game-log.js?'));
    const watchHtml = fs.readFileSync(path.join(root, 'watchlist.html'), 'utf8');
    assert.match(watchHtml, /<textarea name="review" rows="6" maxlength="2000"/);
    const watchJs = fs.readFileSync(path.join(root, 'watchlist.js'), 'utf8');
    assert.match(watchJs, /'image_url', 'review'\]\.forEach/);
    // 한 줄 메모는 화면·저장에서 빠졌다(기존 DB 값은 보내지 않아 그대로 유지).
    assert.doesNotMatch(watchHtml, /name="notes"/);
    assert.doesNotMatch(watchJs, /r\.notes|f\.notes|notes:/);
    assert.match(watchJs, /review: reviewText\(f\.review\.value\)/);
    // 후기는 textContent로만 넣는다(HTML 해석 금지).
    assert.doesNotMatch(watchJs, /innerHTML[^;]*review/);
    const gameJs = fs.readFileSync(path.join(root, 'game-log.js'), 'utf8');
    assert.doesNotMatch(gameJs, /innerHTML[^;]*memo/i);
});
