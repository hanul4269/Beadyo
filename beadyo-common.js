(function (global) {
    'use strict';

    if (global.BeadyoCommon) return;

    const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
    const OWNER_EMAIL = 'riosniper12@gmail.com';
    const ALLOWED_MESSAGE_ORIGINS = new Set([
        'https://beadyo.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]);

    let supabaseClient = null;

    function getSupabaseClient(options = {}) {
        if (supabaseClient) return supabaseClient;
        if (!global.supabase?.createClient) {
            throw new Error('supabase.min.js must be loaded before beadyo-common.js');
        }
        supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        return supabaseClient;
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character]));
    }

    function safeUrl(value, fallback = '#', allowRelative = false) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback;
        try {
            const url = allowRelative ? new URL(raw, global.location.href) : new URL(raw);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
        } catch {
            return fallback;
        }
    }

    function safeImageUrl(value, fallback = '') {
        return safeUrl(value, fallback);
    }

    async function fetchWithTimeout(url, ms, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function allowedMessageOrigin(origin) {
        return origin === global.location.origin || ALLOWED_MESSAGE_ORIGINS.has(origin);
    }

    const UNIFIED_SEARCH_CACHE_KEY = 'beadyo:unified-search:v1';
    const UNIFIED_SEARCH_CACHE_VERSION = 1;
    const UNIFIED_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
    const UNIFIED_SEARCH_PAGE_SIZE = 1000;
    const UNIFIED_SEARCH_DEFAULT_LIMIT = 20;
    const UNIFIED_SEARCH_MAX_LIMIT = 100;
    const UNIFIED_SEARCH_CONFIG = Object.freeze({
        cacheTtlMs: UNIFIED_SEARCH_CACHE_TTL_MS,
        debounceMs: 250,
        defaultLimit: UNIFIED_SEARCH_DEFAULT_LIMIT,
        maxLimit: UNIFIED_SEARCH_MAX_LIMIT,
        minChoseongLength: 2,
    });
    const UNIFIED_SEARCH_COLUMNS = Object.freeze({
        songbook: 'id,category,sort_order,title,artist,skill_level,memo,tags',
        live_songs: 'id,performed_date,title,artist,memo,clip_url,exclude_from_stats',
    });
    const HANGUL_CHOSEONG = Object.freeze([
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
        'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    ]);
    const HANGUL_CHOSEONG_SET = new Set(HANGUL_CHOSEONG);
    const MODERN_CHOSEONG_TO_COMPAT = new Map([
        ['ᄀ', 'ㄱ'], ['ᄁ', 'ㄲ'], ['ᄂ', 'ㄴ'], ['ᄃ', 'ㄷ'], ['ᄄ', 'ㄸ'],
        ['ᄅ', 'ㄹ'], ['ᄆ', 'ㅁ'], ['ᄇ', 'ㅂ'], ['ᄈ', 'ㅃ'], ['ᄉ', 'ㅅ'],
        ['ᄊ', 'ㅆ'], ['ᄋ', 'ㅇ'], ['ᄌ', 'ㅈ'], ['ᄍ', 'ㅉ'], ['ᄎ', 'ㅊ'],
        ['ᄏ', 'ㅋ'], ['ᄐ', 'ㅌ'], ['ᄑ', 'ㅍ'], ['ᄒ', 'ㅎ'],
    ]);
    const BRACKET_CONTENT_RE = /\([^)]*\)|\uff08[^\uff09]*\uff09|\[[^\]]*\]|\u3010[^\u3011]*\u3011|\{[^}]*\}/g;
    const BRACKET_CAPTURE_RE = /\(([^)]*)\)|\uff08([^\uff09]*)\uff09|\[([^\]]*)\]|\u3010([^\u3011]*)\u3011|\{([^}]*)\}/g;
    const searchCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
    const unifiedSearchState = {
        data: null,
        loadPromise: null,
    };

    function normalizeUnifiedSearchText(value) {
        return String(value ?? '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[\u200b-\u200d\ufeff]/g, '')
            .replace(/[\s\p{P}\p{S}]+/gu, '');
    }

    function normalizeJoinBase(value) {
        return normalizeUnifiedSearchText(String(value ?? '').replace(BRACKET_CONTENT_RE, ' '));
    }

    function artistAliasKeys(value) {
        const raw = String(value ?? '');
        const aliases = new Set();
        const strict = normalizeUnifiedSearchText(raw);
        const base = normalizeJoinBase(raw);
        if (strict) aliases.add(strict);
        if (base) aliases.add(base);

        for (const match of raw.matchAll(BRACKET_CAPTURE_RE)) {
            const inner = normalizeUnifiedSearchText(match.slice(1).find(Boolean) || '');
            if (inner) aliases.add(inner);
        }
        return [...aliases];
    }

    function buildArtistAliasMap(rows) {
        const parent = new Map();

        function find(key) {
            if (!parent.has(key)) parent.set(key, key);
            const next = parent.get(key);
            if (next !== key) parent.set(key, find(next));
            return parent.get(key);
        }

        function union(left, right) {
            const leftRoot = find(left);
            const rightRoot = find(right);
            if (leftRoot === rightRoot) return;
            parent.set(rightRoot, leftRoot < rightRoot ? leftRoot : rightRoot);
            parent.set(leftRoot, leftRoot < rightRoot ? leftRoot : rightRoot);
        }

        for (const row of rows) {
            const aliases = artistAliasKeys(row?.artist);
            if (!aliases.length) continue;
            aliases.forEach(find);
            for (let i = 1; i < aliases.length; i++) union(aliases[0], aliases[i]);
        }

        const components = new Map();
        for (const key of parent.keys()) {
            const root = find(key);
            if (!components.has(root)) components.set(root, []);
            components.get(root).push(key);
        }

        const canonical = new Map();
        for (const aliases of components.values()) {
            const key = [...aliases].sort(searchCollator.compare)[0];
            aliases.forEach(alias => canonical.set(alias, key));
        }
        return canonical;
    }

    function canonicalArtistKey(value, artistAliasMap) {
        const aliases = artistAliasKeys(value);
        if (!aliases.length) return '';
        for (const alias of aliases) {
            const canonical = artistAliasMap.get(alias);
            if (canonical) return canonical;
        }
        return aliases[0];
    }

    function hangulChoseong(value) {
        let result = '';
        for (const character of String(value ?? '')) {
            const code = character.charCodeAt(0);
            if (code >= 0xAC00 && code <= 0xD7A3) {
                result += HANGUL_CHOSEONG[Math.floor((code - 0xAC00) / 588)];
            } else if (HANGUL_CHOSEONG_SET.has(character)) {
                result += character;
            } else if (MODERN_CHOSEONG_TO_COMPAT.has(character)) {
                result += MODERN_CHOSEONG_TO_COMPAT.get(character);
            }
        }
        return result;
    }

    function normalizeChoseongQuery(value) {
        let result = '';
        for (const character of String(value ?? '').replace(/\s+/g, '')) {
            result += MODERN_CHOSEONG_TO_COMPAT.get(character) || character;
        }
        return result;
    }

    function isAllChoseongQuery(value) {
        const query = normalizeChoseongQuery(value);
        return !!query && [...query].every(character => HANGUL_CHOSEONG_SET.has(character));
    }

    function normalizeTags(tags) {
        if (Array.isArray(tags)) return tags.map(tag => String(tag ?? '')).filter(Boolean);
        if (!tags) return [];
        return String(tags)
            .replace(/^\{|\}$/g, '')
            .split(',')
            .map(tag => tag.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
    }

    function searchTextValues(rows, key) {
        return [...new Set(rows
            .map(row => normalizeUnifiedSearchText(row?.[key]))
            .filter(Boolean))];
    }

    function sortableNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function createUnifiedSearchIndex(songbookRows = [], liveRows = []) {
        const safeSongbookRows = Array.isArray(songbookRows) ? songbookRows : [];
        const safeLiveRows = Array.isArray(liveRows) ? liveRows : [];
        const artistAliasMap = buildArtistAliasMap([...safeSongbookRows, ...safeLiveRows]);
        const groups = [];
        const exactGroups = new Map();
        const relaxedGroups = new Map();

        function addMapValue(map, key, group) {
            if (!key) return;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key).add(group);
        }

        function rowKeys(row) {
            const artist = canonicalArtistKey(row?.artist, artistAliasMap);
            const title = normalizeUnifiedSearchText(row?.title);
            const relaxedTitle = normalizeJoinBase(row?.title) || title;
            return {
                exact: title ? `${title}|||${artist}` : '',
                relaxed: relaxedTitle ? `${relaxedTitle}|||${artist}` : '',
            };
        }

        function createGroup(row, source, keys) {
            const group = {
                key: keys.exact || keys.relaxed || `unmatched:${groups.length}`,
                title: String(row?.title ?? '').trim(),
                artist: String(row?.artist ?? '').trim(),
                songbook: null,
                songbookRows: [],
                liveRows: [],
                liveCount: 0,
                totalLiveRecords: 0,
                latestPerformedDate: null,
            };
            groups.push(group);
            addMapValue(exactGroups, keys.exact, group);
            addMapValue(relaxedGroups, keys.relaxed, group);
            addRow(group, row, source);
            return group;
        }

        function addRow(group, row, source) {
            if (source === 'songbook') group.songbookRows.push(row);
            else group.liveRows.push(row);
        }

        function findGroup(keys, allowRelaxed) {
            const exact = exactGroups.get(keys.exact);
            if (exact?.size === 1) return [...exact][0];
            if (!allowRelaxed) return null;
            const relaxed = relaxedGroups.get(keys.relaxed);
            return relaxed?.size === 1 ? [...relaxed][0] : null;
        }

        const orderedSongbook = [...safeSongbookRows].sort((left, right) => {
            const leftOrder = sortableNumber(left?.sort_order);
            const rightOrder = sortableNumber(right?.sort_order);
            if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }
            if (leftOrder !== null) return -1;
            if (rightOrder !== null) return 1;
            return searchCollator.compare(String(left?.title ?? ''), String(right?.title ?? ''));
        });

        for (const row of orderedSongbook) {
            const keys = rowKeys(row);
            const group = findGroup(keys, false) || createGroup(row, 'songbook', keys);
            if (!group.songbookRows.includes(row)) addRow(group, row, 'songbook');
            addMapValue(relaxedGroups, keys.relaxed, group);
        }

        const orderedLive = [...safeLiveRows].sort((left, right) => {
            const dateDiff = String(right?.performed_date ?? '').localeCompare(String(left?.performed_date ?? ''));
            if (dateDiff) return dateDiff;
            return Number(right?.id || 0) - Number(left?.id || 0);
        });

        for (const row of orderedLive) {
            const keys = rowKeys(row);
            const group = findGroup(keys, true) || createGroup(row, 'live', keys);
            if (!group.liveRows.includes(row)) addRow(group, row, 'live');
            addMapValue(exactGroups, keys.exact, group);
            addMapValue(relaxedGroups, keys.relaxed, group);
        }

        for (const group of groups) {
            group.songbookRows.sort((left, right) => {
                const leftOrder = sortableNumber(left?.sort_order);
                const rightOrder = sortableNumber(right?.sort_order);
                if (leftOrder !== null && rightOrder !== null) return leftOrder - rightOrder;
                if (leftOrder !== null) return -1;
                if (rightOrder !== null) return 1;
                return 0;
            });
            group.liveRows.sort((left, right) => {
                const dateDiff = String(right?.performed_date ?? '').localeCompare(String(left?.performed_date ?? ''));
                return dateDiff || Number(right?.id || 0) - Number(left?.id || 0);
            });
            group.songbook = group.songbookRows[0] || null;
            const displayRow = group.songbook || group.liveRows[0] || {};
            group.title = String(displayRow.title ?? group.title).trim();
            group.artist = String(displayRow.artist ?? group.artist).trim();
            group.liveCount = group.liveRows.filter(row => row?.exclude_from_stats !== true).length;
            group.totalLiveRecords = group.liveRows.length;
            group.latestPerformedDate = group.liveRows.find(row => row?.performed_date)?.performed_date || null;

            const allRows = [...group.songbookRows, ...group.liveRows];
            const titles = searchTextValues(allRows, 'title');
            const artists = searchTextValues(allRows, 'artist');
            const details = [...new Set(allRows.flatMap(row => [
                normalizeUnifiedSearchText(row?.memo),
                ...normalizeTags(row?.tags).map(normalizeUnifiedSearchText),
            ]).filter(Boolean))];
            const choseongTitles = [...new Set(allRows.map(row => hangulChoseong(row?.title)).filter(Boolean))];
            const choseongArtists = [...new Set(allRows.map(row => hangulChoseong(row?.artist)).filter(Boolean))];
            Object.defineProperty(group, '_search', {
                value: { titles, artists, details, choseongTitles, choseongArtists },
                enumerable: false,
            });
        }

        return groups;
    }

    function bestTextMatch(values, query, scores) {
        let best = 0;
        for (const value of values) {
            if (value === query) best = Math.max(best, scores.exact);
            else if (value.startsWith(query)) best = Math.max(best, scores.prefix);
            else if (value.includes(query)) best = Math.max(best, scores.partial);
        }
        return best;
    }

    function scoreUnifiedSearchGroup(group, query, choseongOnly) {
        const search = group._search;
        if (choseongOnly) {
            const titleScore = bestTextMatch(search.choseongTitles, query, { exact: 220, prefix: 210, partial: 200 });
            const artistScore = bestTextMatch(search.choseongArtists, query, { exact: 190, prefix: 180, partial: 170 });
            return Math.max(titleScore, artistScore);
        }

        const titleScore = bestTextMatch(search.titles, query, { exact: 500, prefix: 420, partial: 380 });
        const artistScore = bestTextMatch(search.artists, query, { exact: 460, prefix: 340, partial: 300 });
        const detailScore = search.details.some(value => value.includes(query)) ? 100 : 0;
        return Math.max(titleScore, artistScore, detailScore);
    }

    function searchUnifiedIndex(groups, rawQuery, options = {}) {
        const queryText = String(rawQuery ?? '').trim();
        const choseongOnly = isAllChoseongQuery(queryText);
        const query = choseongOnly
            ? normalizeChoseongQuery(queryText)
            : normalizeUnifiedSearchText(queryText);
        const requestedLimit = Number.parseInt(options.limit, 10);
        const requestedOffset = Number.parseInt(options.offset, 10);
        const limit = Math.min(
            UNIFIED_SEARCH_MAX_LIMIT,
            Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : UNIFIED_SEARCH_DEFAULT_LIMIT,
        );
        const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

        if (!query) {
            return { query: queryText, total: 0, offset, limit, hasMore: false, reason: 'empty-query', items: [] };
        }
        if (choseongOnly && [...query].length < UNIFIED_SEARCH_CONFIG.minChoseongLength) {
            return { query: queryText, total: 0, offset, limit, hasMore: false, reason: 'choseong-too-short', items: [] };
        }

        const ranked = groups
            .map(group => ({ group, score: scoreUnifiedSearchGroup(group, query, choseongOnly) }))
            .filter(result => result.score > 0)
            .sort((left, right) => {
                if (right.score !== left.score) return right.score - left.score;
                const leftBoth = left.group.songbookRows.length > 0 && left.group.liveRows.length > 0 ? 1 : 0;
                const rightBoth = right.group.songbookRows.length > 0 && right.group.liveRows.length > 0 ? 1 : 0;
                if (rightBoth !== leftBoth) return rightBoth - leftBoth;
                if (right.group.liveCount !== left.group.liveCount) return right.group.liveCount - left.group.liveCount;
                const dateDiff = String(right.group.latestPerformedDate ?? '').localeCompare(String(left.group.latestPerformedDate ?? ''));
                if (dateDiff) return dateDiff;
                const leftOrder = sortableNumber(left.group.songbook?.sort_order);
                const rightOrder = sortableNumber(right.group.songbook?.sort_order);
                if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) return leftOrder - rightOrder;
                if (leftOrder !== null) return -1;
                if (rightOrder !== null) return 1;
                return searchCollator.compare(left.group.title, right.group.title);
            });

        const items = ranked.slice(offset, offset + limit).map(result => ({
            ...result.group,
            score: result.score,
        }));
        return {
            query: queryText,
            total: ranked.length,
            offset,
            limit,
            hasMore: offset + items.length < ranked.length,
            reason: null,
            items,
        };
    }

    function readUnifiedSearchCache() {
        try {
            const raw = global.localStorage?.getItem(UNIFIED_SEARCH_CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (
                cached?.version !== UNIFIED_SEARCH_CACHE_VERSION ||
                !Number.isFinite(cached?.fetchedAt) ||
                Date.now() - cached.fetchedAt > UNIFIED_SEARCH_CACHE_TTL_MS ||
                !Array.isArray(cached?.songbookRows) ||
                !Array.isArray(cached?.liveRows)
            ) {
                return null;
            }
            return cached;
        } catch {
            return null;
        }
    }

    function writeUnifiedSearchCache(payload) {
        try {
            global.localStorage?.setItem(UNIFIED_SEARCH_CACHE_KEY, JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    async function fetchUnifiedSearchTable(table, columns) {
        const client = getSupabaseClient();
        const rows = [];
        let from = 0;
        while (true) {
            const { data, error } = await client
                .from(table)
                .select(columns)
                .order('id', { ascending: true })
                .range(from, from + UNIFIED_SEARCH_PAGE_SIZE - 1);
            if (error) throw error;
            if (!data?.length) break;
            rows.push(...data);
            if (data.length < UNIFIED_SEARCH_PAGE_SIZE) break;
            from += UNIFIED_SEARCH_PAGE_SIZE;
        }
        return rows;
    }

    function hydrateUnifiedSearchData(payload, source) {
        const groups = createUnifiedSearchIndex(payload.songbookRows, payload.liveRows);
        unifiedSearchState.data = {
            groups,
            songbookRows: payload.songbookRows,
            liveRows: payload.liveRows,
            fetchedAt: payload.fetchedAt,
            source,
        };
        return unifiedSearchState.data;
    }

    async function loadUnifiedSearchData(options = {}) {
        const force = options.force === true;
        if (!force && unifiedSearchState.data) return unifiedSearchState.data;
        if (unifiedSearchState.loadPromise) return unifiedSearchState.loadPromise;

        if (!force) {
            const cached = readUnifiedSearchCache();
            if (cached) return hydrateUnifiedSearchData(cached, 'localStorage');
        }

        unifiedSearchState.loadPromise = (async () => {
            const [songbookRows, liveRows] = await Promise.all([
                fetchUnifiedSearchTable('songbook', UNIFIED_SEARCH_COLUMNS.songbook),
                fetchUnifiedSearchTable('live_songs', UNIFIED_SEARCH_COLUMNS.live_songs),
            ]);
            const payload = {
                version: UNIFIED_SEARCH_CACHE_VERSION,
                fetchedAt: Date.now(),
                songbookRows,
                liveRows,
            };
            writeUnifiedSearchCache(payload);
            return hydrateUnifiedSearchData(payload, 'network');
        })().finally(() => {
            unifiedSearchState.loadPromise = null;
        });
        return unifiedSearchState.loadPromise;
    }

    async function searchUnifiedSongs(query, options = {}) {
        const data = await loadUnifiedSearchData(options);
        return searchUnifiedIndex(data.groups, query, options);
    }

    function clearUnifiedSearchCache() {
        unifiedSearchState.data = null;
        try {
            global.localStorage?.removeItem(UNIFIED_SEARCH_CACHE_KEY);
        } catch {}
    }

    const UNIFIED_SEARCH_MESSAGE_TYPE = 'beadyo-open-unified-search';
    const unifiedSearchUiState = {
        activeIndex: -1,
        debounceTimer: null,
        lastFocused: null,
        loadError: null,
        loading: false,
        querySequence: 0,
        result: null,
        visibleLimit: UNIFIED_SEARCH_DEFAULT_LIMIT,
    };

    function unifiedSearchIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>';
    }

    function addUnifiedSearchStyles() {
        if (document.querySelector('link[data-beadyo-unified-search]')) return;
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'unified-search.css?v=20260924';
        stylesheet.dataset.beadyoUnifiedSearch = '';
        document.head.append(stylesheet);
    }

    function unifiedSearchModalHtml() {
        return `<div class="beadyo-search-overlay" data-beadyo-search-overlay hidden>
            <section class="beadyo-search-modal" role="dialog" aria-modal="true" aria-label="통합 검색">
                <header class="beadyo-search-head">
                    <div class="beadyo-search-title-wrap">
                        <strong>통합 검색</strong>
                        <span>노래책과 라이브 기록을 한 번에 찾아요</span>
                    </div>
                    <button class="beadyo-search-close" type="button" data-beadyo-search-close aria-label="통합 검색 닫기">&times;</button>
                </header>
                <div class="beadyo-search-input-wrap">
                    ${unifiedSearchIcon()}
                    <input type="search" data-beadyo-search-input autocomplete="off" spellcheck="false" placeholder="제목, 가수, 초성 검색" aria-label="통합 검색어">
                    <kbd>ESC</kbd>
                </div>
                <div class="beadyo-search-summary" data-beadyo-search-summary aria-live="polite">검색 데이터를 준비하는 중...</div>
                <div class="beadyo-search-results" data-beadyo-search-results role="listbox" aria-label="통합 검색 결과"></div>
            </section>
        </div>`;
    }

    function ensureUnifiedSearchModal() {
        let overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (overlay) return overlay;

        addUnifiedSearchStyles();
        const host = document.createElement('div');
        host.innerHTML = unifiedSearchModalHtml();
        overlay = host.firstElementChild;
        document.body.append(overlay);

        const input = overlay.querySelector('[data-beadyo-search-input]');
        overlay.querySelector('[data-beadyo-search-close]').addEventListener('click', closeUnifiedSearch);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeUnifiedSearch();
        });
        input.addEventListener('input', () => {
            unifiedSearchUiState.visibleLimit = UNIFIED_SEARCH_DEFAULT_LIMIT;
            clearTimeout(unifiedSearchUiState.debounceTimer);
            unifiedSearchUiState.debounceTimer = setTimeout(
                () => runUnifiedSearch(input.value),
                UNIFIED_SEARCH_CONFIG.debounceMs,
            );
        });
        overlay.addEventListener('mousemove', event => {
            const result = event.target.closest('[data-beadyo-search-result-index]');
            if (!result) return;
            setUnifiedSearchActiveIndex(Number(result.dataset.beadyoSearchResultIndex));
        });
        overlay.addEventListener('click', event => {
            if (event.target.closest('.beadyo-search-watch')) return;
            const more = event.target.closest('[data-beadyo-search-more]');
            if (more) {
                unifiedSearchUiState.visibleLimit += UNIFIED_SEARCH_DEFAULT_LIMIT;
                runUnifiedSearch(input.value, { immediate: true });
                return;
            }
            const result = event.target.closest('[data-beadyo-search-result-index]');
            if (result) selectUnifiedSearchResult(Number(result.dataset.beadyoSearchResultIndex));
        });
        return overlay;
    }

    function skillStars(value) {
        const level = Math.max(0, Math.min(5, Number.parseInt(value, 10) || 0));
        return '★'.repeat(level);
    }

    function uniqueSongbookSummary(rows) {
        const categories = [...new Set(rows.map(row => String(row?.category ?? '').trim()).filter(Boolean))];
        const levels = rows
            .map(row => Number.parseInt(row?.skill_level, 10))
            .filter(level => Number.isFinite(level) && level > 0);
        const level = levels.length ? Math.max(...levels) : 0;
        return [categories.join(' · '), level ? `숙련도 ${skillStars(level)}` : ''].filter(Boolean).join(' · ');
    }

    function unifiedSearchLiveRowsHtml(rows) {
        const visibleRows = rows.slice(0, 3);
        const remaining = rows.length - visibleRows.length;
        return `<div class="beadyo-search-live-dates">
            ${visibleRows.map(row => {
                const clipUrl = safeUrl(row?.clip_url, '');
                return `<div class="beadyo-search-live-date">
                    <time datetime="${esc(row?.performed_date || '')}">${esc(row?.performed_date || '날짜 미상')}</time>
                    ${clipUrl ? `<a class="beadyo-search-watch" href="${esc(clipUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${row?.performed_date || '날짜 미상'} 다시보기 새 탭에서 열기`)}">다시보기 ▶</a>` : ''}
                    ${row?.exclude_from_stats === true ? '<span class="beadyo-search-excluded">집계 제외</span>' : ''}
                </div>`;
            }).join('')}
            ${remaining > 0 ? `<div class="beadyo-search-live-more">외 ${remaining}건</div>` : ''}
        </div>`;
    }

    function unifiedSearchResultHtml(item, index) {
        const songbookSummary = uniqueSongbookSummary(item.songbookRows || []);
        const excludedCount = Math.max(0, Number(item.totalLiveRecords || 0) - Number(item.liveCount || 0));
        const hasSongbook = !!item.songbookRows?.length;
        return `<article class="beadyo-search-result${hasSongbook ? ' is-navigable' : ''}" id="beadyo-search-result-${index}" role="option" aria-selected="false" tabindex="-1" data-beadyo-search-result-index="${index}"${hasSongbook ? ` data-beadyo-search-songbook-id="${esc(item.songbookRows[0]?.id)}"` : ''}>
            <div class="beadyo-search-result-heading">
                <strong>${esc(item.title || '')}</strong>
                ${item.artist ? `<span aria-hidden="true">—</span><span>${esc(item.artist)}</span>` : ''}
            </div>
            ${item.songbookRows?.length ? `<div class="beadyo-search-source beadyo-search-source-songbook">
                <span class="beadyo-search-source-label">노래책</span>
                <span>${esc(songbookSummary || '등록됨')}</span>
            </div>` : ''}
            ${item.liveRows?.length ? `<div class="beadyo-search-source beadyo-search-source-live">
                <span class="beadyo-search-source-label">라이브 기록</span>
                <strong>${Number(item.liveCount || 0)}번 부름</strong>
                ${excludedCount ? `<span class="beadyo-search-count-note">· 집계 제외 ${excludedCount}건</span>` : ''}
            </div>
            ${unifiedSearchLiveRowsHtml(item.liveRows)}` : ''}
        </article>`;
    }

    function unifiedSearchEmptyHtml(message) {
        return `<div class="beadyo-search-empty"><strong>${esc(message)}</strong><span>제목이나 가수를 다른 단어로 검색해보세요.</span></div>`;
    }

    function renderUnifiedSearchResult(result) {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay) return;
        const summary = overlay.querySelector('[data-beadyo-search-summary]');
        const results = overlay.querySelector('[data-beadyo-search-results]');
        unifiedSearchUiState.result = result;
        unifiedSearchUiState.activeIndex = -1;
        results.removeAttribute('aria-activedescendant');

        if (result.reason === 'empty-query') {
            summary.textContent = '제목, 가수, 초성으로 검색하세요.';
            results.innerHTML = '<div class="beadyo-search-prompt"><span>⌘K</span><strong>검색어를 입력하면 노래책과 라이브 기록을 함께 보여드려요.</strong></div>';
            return;
        }
        if (result.reason === 'choseong-too-short') {
            summary.textContent = '초성은 2글자 이상 입력해주세요.';
            results.innerHTML = unifiedSearchEmptyHtml('초성을 한 글자 더 입력해주세요');
            return;
        }
        if (!result.total) {
            summary.textContent = `"${result.query}" 검색 결과 0곡`;
            results.innerHTML = unifiedSearchEmptyHtml('검색 결과가 없어요');
            return;
        }

        summary.textContent = `"${result.query}" 검색 결과 ${result.total}곡`;
        results.innerHTML = result.items.map(unifiedSearchResultHtml).join('') + (
            result.hasMore
                ? `<button class="beadyo-search-more" type="button" data-beadyo-search-more>더 보기 <span>${result.items.length}/${result.total}</span></button>`
                : ''
        );
        setUnifiedSearchActiveIndex(0);
    }

    function renderUnifiedSearchLoading() {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay) return;
        overlay.querySelector('[data-beadyo-search-summary]').textContent = '노래책과 라이브 기록을 불러오는 중...';
        overlay.querySelector('[data-beadyo-search-results]').innerHTML = `<div class="beadyo-search-loading" aria-label="검색 데이터 로딩 중">
            <span></span><span></span><span></span>
        </div>`;
    }

    function renderUnifiedSearchError(error) {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay) return;
        overlay.querySelector('[data-beadyo-search-summary]').textContent = '검색 데이터를 불러오지 못했어요.';
        overlay.querySelector('[data-beadyo-search-results]').innerHTML = `<div class="beadyo-search-empty">
            <strong>잠시 후 다시 시도해주세요.</strong>
            <button type="button" data-beadyo-search-retry>다시 시도</button>
        </div>`;
        overlay.querySelector('[data-beadyo-search-retry]')?.addEventListener('click', () => prepareUnifiedSearch({ force: true }));
        if (error) console.error('Unified search load failed:', error);
    }

    async function prepareUnifiedSearch(options = {}) {
        if (unifiedSearchUiState.loading) return;
        unifiedSearchUiState.loading = true;
        unifiedSearchUiState.loadError = null;
        renderUnifiedSearchLoading();
        try {
            await loadUnifiedSearchData(options);
            const input = document.querySelector('[data-beadyo-search-input]');
            await runUnifiedSearch(input?.value || '', { immediate: true });
        } catch (error) {
            unifiedSearchUiState.loadError = error;
            renderUnifiedSearchError(error);
        } finally {
            unifiedSearchUiState.loading = false;
        }
    }

    async function runUnifiedSearch(query, options = {}) {
        if (!options.immediate && unifiedSearchUiState.loading) return;
        const sequence = ++unifiedSearchUiState.querySequence;
        try {
            const result = await searchUnifiedSongs(query, { limit: unifiedSearchUiState.visibleLimit });
            if (sequence !== unifiedSearchUiState.querySequence) return;
            renderUnifiedSearchResult(result);
        } catch (error) {
            if (sequence !== unifiedSearchUiState.querySequence) return;
            renderUnifiedSearchError(error);
        }
    }

    function setUnifiedSearchActiveIndex(index) {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        const cards = [...(overlay?.querySelectorAll('[data-beadyo-search-result-index]') || [])];
        if (!cards.length) {
            unifiedSearchUiState.activeIndex = -1;
            return;
        }
        const next = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
        unifiedSearchUiState.activeIndex = next;
        cards.forEach((card, cardIndex) => {
            const active = cardIndex === next;
            card.classList.toggle('is-active', active);
            card.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const activeCard = cards[next];
        overlay.querySelector('[data-beadyo-search-results]')?.setAttribute('aria-activedescendant', activeCard.id);
    }

    function moveUnifiedSearchActive(delta) {
        const cards = document.querySelectorAll('[data-beadyo-search-result-index]');
        if (!cards.length) return;
        let next = unifiedSearchUiState.activeIndex;
        if (next < 0) next = delta > 0 ? 0 : cards.length - 1;
        else next = (next + delta + cards.length) % cards.length;
        setUnifiedSearchActiveIndex(next);
        cards[next]?.scrollIntoView({ block: 'nearest' });
    }

    function selectUnifiedSearchResult(index = unifiedSearchUiState.activeIndex) {
        const item = unifiedSearchUiState.result?.items?.[index];
        if (!item) return;
        setUnifiedSearchActiveIndex(index);
        const songbookId = item.songbookRows?.[0]?.id;
        if (songbookId !== undefined && songbookId !== null && String(songbookId).trim()) {
            openUnifiedSearchSongbookSong(songbookId);
            return;
        }
        document.querySelector(`[data-beadyo-search-result-index="${index}"] .beadyo-search-watch`)?.click();
    }

    function openUnifiedSearchSongbookSong(songbookId) {
        const targetId = String(songbookId ?? '').trim();
        if (!targetId) return;
        const message = { type: 'beadyo-open-songbook-song', songId: targetId };
        const origin = global.location.origin === 'null' ? '*' : global.location.origin;

        if (global.self !== global.top) {
            global.parent.postMessage(message, origin);
            return;
        }
        if (document.getElementById('frame-2')) {
            global.postMessage(message, origin);
            return;
        }

        const target = new URL('songbook.html', global.location.href);
        target.searchParams.set('view', 'songbook');
        target.searchParams.set('song', targetId);
        global.location.assign(target.toString());
    }

    function openUnifiedSearch() {
        if (global.self !== global.top) {
            const origin = global.location.origin === 'null' ? '*' : global.location.origin;
            global.parent.postMessage({ type: UNIFIED_SEARCH_MESSAGE_TYPE }, origin);
            return;
        }
        const overlay = ensureUnifiedSearchModal();
        unifiedSearchUiState.lastFocused = document.activeElement;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('is-open'));
        document.documentElement.classList.add('beadyo-search-open');
        const input = overlay.querySelector('[data-beadyo-search-input]');
        requestAnimationFrame(() => input.focus());
        if (!unifiedSearchState.data && !unifiedSearchUiState.loading) {
            prepareUnifiedSearch();
        } else if (unifiedSearchUiState.loadError) {
            renderUnifiedSearchError(unifiedSearchUiState.loadError);
        } else {
            runUnifiedSearch(input.value, { immediate: true });
        }
    }

    function closeUnifiedSearch() {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay || overlay.hidden) return;
        clearTimeout(unifiedSearchUiState.debounceTimer);
        overlay.classList.remove('is-open');
        document.documentElement.classList.remove('beadyo-search-open');
        setTimeout(() => {
            if (!overlay.classList.contains('is-open')) overlay.hidden = true;
        }, 160);
        if (unifiedSearchUiState.lastFocused?.isConnected) unifiedSearchUiState.lastFocused.focus();
    }

    function handleUnifiedSearchKeydown(event) {
        const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
        if (shortcut) {
            event.preventDefault();
            openUnifiedSearch();
            return;
        }

        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay || overlay.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeUnifiedSearch();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveUnifiedSearchActive(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveUnifiedSearchActive(-1);
        } else if (event.key === 'Enter' && unifiedSearchUiState.activeIndex >= 0) {
            event.preventDefault();
            selectUnifiedSearchResult();
        }
    }

    function buildStandaloneSearchButton() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'beadyo-standalone-home-link beadyo-standalone-search-button';
        button.dataset.beadyoUnifiedSearchTrigger = '';
        button.setAttribute('aria-label', '통합 검색 열기');
        button.innerHTML = `${unifiedSearchIcon()}<span>통합 검색</span>`;
        return button;
    }

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-beadyo-unified-search-trigger]');
        if (!trigger) return;
        event.preventDefault();
        openUnifiedSearch();
    });
    document.addEventListener('keydown', handleUnifiedSearchKeydown, true);

    const STANDALONE_PAGES = new Set([
        'calendar.html',
        'songbook.html',
        'songs.html',
        'dance.html',
        'gembox.html',
        'tractor-service.html',
        'content.html',
        'games.html',
        'guide.html',
    ]);

    const STANDALONE_NAV_ITEMS = [
        { key: 'calendar', label: '일정', href: 'calendar.html' },
        { key: 'schedule', label: '주간편성', href: 'index.html?tab=schedule' },
        { key: 'songbook', label: '노래책', href: 'songbook.html?view=songbook' },
        { key: 'live', label: '라이브 기록', href: 'songbook.html?view=live' },
        { key: 'songs', label: '음악', href: 'songs.html' },
        { key: 'dance', label: '춤영상', href: 'dance.html' },
        { key: 'gembox', label: '보석함', href: 'gembox.html' },
        { key: 'tractor-service', label: '트랙터서비스', href: 'tractor-service.html' },
        { key: 'content', label: '콘텐츠', href: 'content.html' },
        { key: 'games', label: '게임', href: 'games.html' },
        { key: 'guide', label: '이용가이드', href: 'guide.html' },
    ];

    function currentStandalonePage(fileName) {
        if (fileName === 'songbook.html') {
            const view = new URLSearchParams(global.location.search).get('view');
            return view === 'live' ? 'live' : 'songbook';
        }
        return fileName.replace(/\.html$/, '');
    }

    function addStandaloneNavigationStyles() {
        if (document.querySelector('link[data-beadyo-standalone-nav]')) return;
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'standalone-nav.css?v=20260919';
        stylesheet.dataset.beadyoStandaloneNav = '';
        document.head.append(stylesheet);
    }

    function buildStandaloneNavigation(activePage) {
        const header = document.createElement('header');
        header.className = 'beadyo-standalone-header';
        header.dataset.beadyoStandaloneHeader = '';

        const inner = document.createElement('div');
        inner.className = 'beadyo-standalone-inner';

        const home = document.createElement('a');
        home.className = 'beadyo-standalone-brand';
        home.href = 'index.html';
        home.setAttribute('aria-label', 'BEADYO 전체 홈으로 이동');

        const mascot = document.createElement('img');
        mascot.src = 'stickers/kyabuki.webp';
        mascot.alt = '';
        mascot.width = 32;
        mascot.height = 32;
        mascot.decoding = 'async';

        const brandCopy = document.createElement('span');
        brandCopy.className = 'beadyo-standalone-brand-copy';
        const brandName = document.createElement('strong');
        brandName.textContent = 'BEADYO';
        const brandDescription = document.createElement('span');
        brandDescription.textContent = '비드요닷컴 — OFFICIAL';
        brandCopy.append(brandName, brandDescription);
        home.append(mascot, brandCopy);

        const homeAction = document.createElement('a');
        homeAction.className = 'beadyo-standalone-home-link';
        homeAction.href = 'index.html';
        homeAction.textContent = '전체 홈';
        homeAction.setAttribute('aria-label', 'BEADYO 전체 홈으로 이동');

        const actions = document.createElement('div');
        actions.className = 'beadyo-standalone-actions';
        actions.append(buildStandaloneSearchButton(), homeAction);
        inner.append(home, actions);

        const navigation = document.createElement('nav');
        navigation.className = 'beadyo-standalone-nav';
        navigation.setAttribute('aria-label', 'BEADYO 주요 메뉴');

        const list = document.createElement('div');
        list.className = 'beadyo-standalone-nav-list';
        STANDALONE_NAV_ITEMS.forEach(item => {
            const link = document.createElement('a');
            link.className = 'beadyo-standalone-nav-link';
            link.href = item.href;
            link.textContent = item.label;
            if (item.key === activePage) {
                link.classList.add('is-active');
                link.setAttribute('aria-current', 'page');
            }
            list.append(link);
        });
        navigation.append(list);
        header.append(inner, navigation);
        return header;
    }

    function initStandaloneNavigation() {
        if (global.self !== global.top) return;

        const fileName = decodeURIComponent(global.location.pathname)
            .split('/')
            .filter(Boolean)
            .pop()
            ?.toLowerCase();
        if (!fileName || !STANDALONE_PAGES.has(fileName)) return;
        if (document.querySelector('[data-beadyo-standalone-header]')) return;

        addStandaloneNavigationStyles();
        const mount = () => {
            if (!document.body || document.querySelector('[data-beadyo-standalone-header]')) return;
            const header = buildStandaloneNavigation(currentStandalonePage(fileName));
            document.body.prepend(header);

            const navigation = header.querySelector('.beadyo-standalone-nav');
            const activeLink = header.querySelector('.beadyo-standalone-nav-link.is-active');
            if (navigation && activeLink) {
                requestAnimationFrame(() => {
                    navigation.scrollLeft = Math.max(
                        0,
                        activeLink.offsetLeft - (navigation.clientWidth - activeLink.offsetWidth) / 2,
                    );
                });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        } else {
            mount();
        }
    }

    const api = Object.freeze({
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        OWNER_EMAIL,
        getSupabaseClient,
        esc,
        safeUrl,
        safeImageUrl,
        fetchWithTimeout,
        allowedMessageOrigin,
        unifiedSearchConfig: UNIFIED_SEARCH_CONFIG,
        normalizeUnifiedSearchText,
        hangulChoseong,
        isAllChoseongQuery,
        createUnifiedSearchIndex,
        searchUnifiedIndex,
        loadUnifiedSearchData,
        searchUnifiedSongs,
        clearUnifiedSearchCache,
        openUnifiedSearch,
        closeUnifiedSearch,
    });

    Object.defineProperties(global, {
        BeadyoCommon: { value: api, enumerable: true, configurable: true },
        SUPABASE_URL: { value: SUPABASE_URL, configurable: true },
        SUPABASE_ANON_KEY: { value: SUPABASE_ANON_KEY, configurable: true },
        OWNER_EMAIL: { value: OWNER_EMAIL, configurable: true },
        getBeadyoSupabaseClient: { value: getSupabaseClient, configurable: true },
        esc: { value: esc, configurable: true },
        safeUrl: { value: safeUrl, configurable: true },
        safeImageUrl: { value: safeImageUrl, configurable: true },
        fetchWithTimeout: { value: fetchWithTimeout, configurable: true },
        beadyoAllowedMessageOrigin: { value: allowedMessageOrigin, configurable: true },
    });

    initStandaloneNavigation();
})(window);
