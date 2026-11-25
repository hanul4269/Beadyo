// 플레이한 게임 메모(구슬요의 후기). 누구나 읽고, 편집자만 쓰고 지운다(DB RLS).
// 표: public.game_log_memos (game_id 기본 키, memo 1~2000자)
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoGameMemos = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const TABLE = 'game_log_memos';
    const FIELDS = 'game_id,memo,updated_at';
    const MAX_LENGTH = 2000;
    const GAME_ID = /^[a-z0-9][a-z0-9-]{0,159}$/;

    function fail(message, code = 'VALIDATION') {
        const error = new Error(message);
        error.code = code;
        return error;
    }
    function gameId(value) {
        if (typeof value !== 'string' || !GAME_ID.test(value)) throw fail('게임을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.');
        return value;
    }
    // 앞뒤 공백만 정리하고 줄바꿈은 그대로 둔다. 빈 메모는 저장 대신 삭제로 처리한다.
    function memoText(value) {
        if (value == null) value = '';
        if (typeof value !== 'string') throw fail('후기 내용을 확인해 주세요.');
        const text = value.replace(/\r\n?/g, '\n').trim();
        if (text.length > MAX_LENGTH) throw fail(`후기는 ${MAX_LENGTH}자 이내로 써 주세요.`);
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw fail('후기에 쓸 수 없는 문자가 있어요.');
        return text;
    }
    function validRow(row) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw fail('후기를 확인하지 못했어요.', 'INVALID_RECORD');
        const id = gameId(row.game_id);
        const memo = memoText(row.memo);
        if (!memo) throw fail('후기를 확인하지 못했어요.', 'INVALID_RECORD');
        return { game_id: id, memo, updated_at: typeof row.updated_at === 'string' ? row.updated_at : '' };
    }
    async function deadline(operation, timeoutMs = 8000) {
        const controller = new AbortController();
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(() => operation(controller.signal)),
                new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(fail('응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.', 'TIMEOUT')); }, timeoutMs); }),
            ]);
        } finally { clearTimeout(timer); }
    }
    function databaseError(error, code) {
        const result = fail(code === 'READ_FAILED' ? '후기를 불러오지 못했어요.' : '후기를 저장하지 못했어요. 편집 권한을 확인하고 다시 시도해 주세요.', code);
        result.cause = error;
        return result;
    }

    // 전체 메모를 game_id → 메모 Map으로 돌려준다. 잘못된 행은 건너뛴다.
    async function readMemos(db, options = {}) {
        const pageSize = options.pageSize || 1000;
        try {
            return await deadline(async signal => {
                const memos = new Map();
                for (let offset = 0; ; offset += pageSize) {
                    const { data, error } = await db.from(TABLE).select(FIELDS).order('game_id', { ascending: true }).range(offset, offset + pageSize - 1).abortSignal(signal);
                    if (error) throw databaseError(error, 'READ_FAILED');
                    if (!Array.isArray(data)) throw fail('후기를 불러오지 못했어요.', 'READ_FAILED');
                    for (const row of data) {
                        try { const item = validRow(row); memos.set(item.game_id, item); } catch { /* 형식이 맞지 않는 행은 표시하지 않음 */ }
                    }
                    if (data.length < pageSize) return memos;
                }
            }, options.timeoutMs || 5000);
        } catch (error) { throw error?.code ? error : databaseError(error, 'READ_FAILED'); }
    }

    // 메모 저장(있으면 덮어쓰기). 빈 내용은 deleteMemo를 써야 한다.
    async function saveMemo(db, id, value, options = {}) {
        const game_id = gameId(id);
        const memo = memoText(value);
        if (!memo) throw fail('후기 내용을 입력해 주세요.');
        try {
            return await deadline(async signal => {
                const { data, error } = await db.from(TABLE).upsert({ game_id, memo }, { onConflict: 'game_id' }).select(FIELDS).abortSignal(signal).single();
                if (error) throw databaseError(error, 'SAVE_FAILED');
                const saved = validRow(data);
                if (saved.game_id !== game_id || saved.memo !== memo) throw fail('저장 결과를 확인하지 못했어요. 새로고침해 주세요.', 'SAVE_FAILED');
                return saved;
            }, options.timeoutMs || 8000);
        } catch (error) { throw error?.code ? error : databaseError(error, 'SAVE_FAILED'); }
    }

    async function deleteMemo(db, id, options = {}) {
        const game_id = gameId(id);
        try {
            return await deadline(async signal => {
                // 권한이 없으면 RLS가 오류 없이 0행만 지우므로, 지워진 행을 돌려받아 확인한다.
                const { data, error } = await db.from(TABLE).delete().eq('game_id', game_id).select('game_id').abortSignal(signal);
                if (error) throw databaseError(error, 'DELETE_FAILED');
                if (!Array.isArray(data) || data.length !== 1 || data[0]?.game_id !== game_id) {
                    throw fail('후기를 지우지 못했어요. 편집 권한을 확인하고 새로고침해 주세요.', 'DELETE_FAILED');
                }
                return true;
            }, options.timeoutMs || 8000);
        } catch (error) { throw error?.code ? error : databaseError(error, 'DELETE_FAILED'); }
    }

    return Object.freeze({ TABLE, FIELDS, MAX_LENGTH, memoText, gameId, readMemos, saveMemo, deleteMemo });
});
