(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoGameStore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const TABLE = 'game_log_entries';
    const FIELDS = 'id,title,genres,played_date,official_url,source_url,notes,created_at';
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s:：·.\-_'’!?]/g, '');
    function fail(message, code = 'VALIDATION') {
        const error = new Error(message);
        error.code = code;
        return error;
    }
    function text(value, label, limit, required = false) {
        if (value == null) value = '';
        if (typeof value !== 'string') throw fail(`${label}을 확인해 주세요.`);
        const result = value.trim();
        if ((required && !result) || result.length > limit || result.includes('\0')) throw fail(`${label}은 ${required ? '1~' : ''}${limit}자 이내로 입력해 주세요.`);
        return result;
    }
    function title(value) {
        const result = text(value, '게임 이름', 160, true);
        if (/[\u0000-\u001f\u007f]/.test(result) || !normalize(result)) throw fail('게임 이름을 확인해 주세요.');
        return result;
    }
    function date(value) {
        const result = text(value, '플레이 날짜', 10);
        if (!result) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.slice(0, 4) === '0000') throw fail('올바른 플레이 날짜를 입력해 주세요.');
        const parsed = new Date(`${result}T00:00:00.000Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw fail('올바른 플레이 날짜를 입력해 주세요.');
        return result;
    }
    function url(value, label) {
        const result = text(value, label, 2048);
        if (!result) return null;
        try {
            const parsed = new URL(result);
            if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
            return parsed.href;
        } catch { throw fail(`${label}은 http 또는 https 주소로 입력해 주세요.`); }
    }
    function genres(value, allowed) {
        if (value == null) value = [];
        if (!Array.isArray(value) || value.length > 16 || value.some(item => typeof item !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(item) || (allowed && !allowed.has(item)))) throw fail('장르를 다시 선택해 주세요.');
        return [...new Set(value)];
    }
    function canonicalPayload(values) {
        if (!values || !UUID.test(values.id || '')) throw fail('저장할 게임 정보를 다시 확인해 주세요.');
        return {
            id: values.id.toLowerCase(), title: title(values.title), genres: genres(values.genres),
            played_date: date(values.played_date), official_url: url(values.official_url, '공식 게임 주소'),
            source_url: url(values.source_url, '기록 출처 주소'), notes: text(values.notes, '메모', 2000) || null,
        };
    }
    function buildPayload(values, existingGames, categories, id) {
        const payload = canonicalPayload({ ...values, id });
        const allowed = new Set((categories || []).map(category => typeof category === 'string' ? category : category.id));
        payload.genres = genres(values.genres, allowed);
        if ((existingGames || []).some(game => [game.title, ...(game.aliases || [])].some(value => normalize(value) === normalize(payload.title)))) throw fail('이미 등록된 게임입니다. 게임 목록에서 확인해 주세요.', 'DUPLICATE');
        return payload;
    }
    function validRow(row) {
        try {
            const payload = canonicalPayload(row);
            if (typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) throw new Error();
            return { ...payload, created_at: row.created_at };
        } catch { throw fail('등록된 게임 정보를 확인하지 못했어요. 다시 불러와 주세요.', 'INVALID_RECORD'); }
    }
    function rowToGame(row) {
        const item = validRow(row);
        return {
            id: `custom-${item.id}`, title: item.title, aliases: [], genres: [...item.genres],
            image: null, officialUrl: item.official_url, isCustom: true,
            customNote: item.notes || '', customSourceUrl: item.source_url || '',
            dates: item.played_date ? [{ date: item.played_date, dateEnd: null, confidence: 'manual', sourceLabel: '직접 등록', sourceUrl: item.source_url || '', eventTitle: item.notes || '' }] : [],
        };
    }
    function databaseError(error, fallback) {
        const code = error?.code || fallback;
        const message = code === '23505' ? '이미 등록된 게임입니다. 게임 목록에서 확인해 주세요.'
            : code === '42501' || code === 'PGRST301' ? '게임을 추가할 권한을 확인하지 못했어요. 로그인 상태를 확인해 주세요.'
                : code === 'PGRST205' || code === '42P01' ? '게임 저장 기능을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.'
                    : fallback === 'READ_FAILED' ? '추가한 게임을 불러오지 못했어요. 다시 시도해 주세요.'
                        : '저장 결과를 확인하지 못했어요. 잠시 후 같은 내용으로 다시 저장해 주세요.';
        return fail(message, code);
    }
    async function deadline(operation, timeoutMs) {
        const controller = new AbortController();
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(() => operation(controller.signal)),
                new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(fail('응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.', 'TIMEOUT')); }, timeoutMs); }),
            ]);
        } finally { clearTimeout(timer); }
    }
    async function readEntries(db, options = {}) {
        const pageSize = options.pageSize || 1000;
        try { return await deadline(async signal => {
            const rows = [], seen = new Set();
            for (let offset = 0; ; offset += pageSize) {
                const { data, error } = await db.from(TABLE).select(FIELDS).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + pageSize - 1).abortSignal(signal);
                if (error) throw databaseError(error, 'READ_FAILED');
                if (!Array.isArray(data)) throw fail('추가한 게임 목록을 확인하지 못했어요. 다시 불러와 주세요.', 'INVALID_RECORD');
                for (const row of data) {
                    const item = validRow(row);
                    if (seen.has(item.id)) throw fail('게임 목록이 변경되었어요. 다시 불러와 주세요.', 'INVALID_RECORD');
                    seen.add(item.id); rows.push(item);
                }
                if (data.length < pageSize) return rows;
            }
        }, options.timeoutMs || 5000); }
        catch (error) { throw error?.code ? error : databaseError(error, 'READ_FAILED'); }
    }
    function matches(row, payload) {
        if (!row || row.id !== payload.id) return false;
        try {
            const item = validRow(row);
            return ['id', 'title', 'played_date', 'official_url', 'source_url', 'notes'].every(key => item[key] === payload[key])
                && [...item.genres].sort().join('\0') === [...payload.genres].sort().join('\0');
        } catch { return false; }
    }
    async function addEntry(db, values, options = {}) {
        const payload = canonicalPayload(values);
        const timeoutMs = options.timeoutMs || 5000;
        let originalError;
        try {
            const result = await deadline(signal => db.from(TABLE).insert(payload).select(FIELDS).abortSignal(signal).single(), timeoutMs);
            if (result.error) throw databaseError(result.error, 'SAVE_UNCONFIRMED');
            if (!matches(result.data, payload)) throw fail('저장 결과를 확인하지 못했어요. 잠시 후 같은 내용으로 다시 저장해 주세요.', 'SAVE_UNCONFIRMED');
            return validRow(result.data);
        } catch (error) { originalError = error?.code ? error : databaseError(error, 'SAVE_UNCONFIRMED'); }
        // A failed response may follow a committed INSERT. Verify only this request's UUID.
        try {
            const { data, error } = await deadline(signal => db.from(TABLE).select(FIELDS).eq('id', payload.id).abortSignal(signal).maybeSingle(), timeoutMs);
            if (!error && matches(data, payload)) return validRow(data);
        } catch { /* Preserve the uncertain result; never invent a successful save. */ }
        throw originalError;
    }
    return Object.freeze({ FIELDS, normalize, buildPayload, rowToGame, readEntries, addEntry });
});
