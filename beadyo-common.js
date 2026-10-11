(function (global) {
    'use strict';

    if (global.BeadyoCommon) return;

    const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
    const OWNER_EMAIL = 'riosniper12@gmail.com';

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
        return origin !== 'null' && origin === global.location.origin;
    }

    const UNIFIED_SEARCH_CACHE_KEY = 'beadyo:unified-search:v2';
    const UNIFIED_SEARCH_CACHE_VERSION = 2;
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
        content_archive: 'id,title,summary,broadcast_date,categories,planning_type,hosts,cast_members,tags',
        youtube_songs: 'id,title,type,collab,upload_date',
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

    const SEARCH_SOURCES = Object.freeze({
        songbook: { table: 'songbook', rows: 'songbookRows', label: '노래책' },
        live: { table: 'live_songs', rows: 'liveRows', label: '방송 노래 기록' },
        content: { table: 'content_archive', rows: 'contentRows', label: '콘텐츠' },
        music: { table: 'youtube_songs', rows: 'musicRows', label: '음악 영상' },
    });
    const SEARCH_TYPES = Object.freeze([
        ['shortcut', '시리즈·페이지 바로가기'], ['content', '콘텐츠'],
        ['music', '음악 영상'], ['songbook', '노래책'], ['live', '방송 노래 기록'],
    ]);
    let searchSeriesPromise = null;
    function loadSearchSeries() {
        if (global.BeadyoContentSeries) return Promise.resolve(global.BeadyoContentSeries);
        if (searchSeriesPromise) return searchSeriesPromise;
        searchSeriesPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'content-series.js?v=release-20261011-all';
            const timer = setTimeout(() => { script.remove(); reject(new Error('시리즈 정보를 불러오지 못했어요.')); }, 12000);
            script.onload = () => {
                clearTimeout(timer);
                if (global.BeadyoContentSeries) resolve(global.BeadyoContentSeries);
                else reject(new Error('시리즈 정보를 불러오지 못했어요.'));
            };
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('시리즈 정보를 불러오지 못했어요.')); };
            document.head.append(script);
        }).finally(() => { searchSeriesPromise = null; });
        return searchSeriesPromise;
    }

    // Preserve source identities: two performances or videos with the same title are distinct.
    function createUnifiedCatalog(payload = {}) {
        const entries = [], seen = new Set();
        const series = global.BeadyoContentSeries;
        const text = value => String(value ?? '').trim();
        function add(type, row, fields) {
            const id = text(row.id);
            const key = `${type}:${id}`;
            if (!id || seen.has(key)) return;
            seen.add(key);
            entries.push({ id, key, type, title: text(row.title), subtitle: '', metadata: '', date: '', ...fields });
        }
        for (const row of payload.songbookRows || []) add('songbook', row, {
            subtitle: text(row.artist), metadata: uniqueSongbookSummary([row]),
            href: `songbook.html?view=songbook&song=${encodeURIComponent(row.id)}&detail=1`,
            terms: [row.title, row.artist, row.memo, ...normalizeTags(row.tags)], aliases: [row.title],
        });
        for (const row of payload.liveRows || []) add('live', row, {
            subtitle: text(row.artist), date: text(row.performed_date),
            metadata: [row.memo, row.exclude_from_stats === true ? '집계 제외' : ''].filter(Boolean).join(' · '),
            href: `songbook.html?view=live&record=${encodeURIComponent(row.id)}${row.performed_date ? `&date=${encodeURIComponent(row.performed_date)}` : ''}`,
            terms: [row.title, row.artist, row.memo, row.performed_date], aliases: [row.title],
        });
        for (const row of payload.musicRows || []) add('music', row, {
            subtitle: text(row.collab), date: text(row.upload_date),
            metadata: ({ original: '오리지널', cover: '커버', live: '라이브' })[row.type] || '',
            href: `songs.html?video=${encodeURIComponent(row.id)}`,
            terms: [row.title, row.collab], aliases: [row.title],
        });
        for (const row of payload.contentRows || []) {
            const info = series?.normalize(row) || {};
            const seriesName = series?.name(info.series_id) || '';
            add('content', row, {
                subtitle: text(row.summary) !== text(row.title) ? text(row.summary) : '',
                date: text(row.broadcast_date),
                metadata: [seriesName, info.episode_number && `${info.episode_number}화`, ...(row.categories || [])].filter(Boolean).join(' · '),
                href: `content.html?content=${encodeURIComponent(row.id)}`,
                aliases: [row.title, row.summary],
                terms: [row.title, row.summary, seriesName, ...(row.hosts || []), ...(row.cast_members || []),
                    ...normalizeTags(row.tags).filter(tag => !series?.isMetadata(tag))],
            });
        }
        for (const item of series?.registry || []) {
            const count = entries.filter(entry => entry.type === 'content' &&
                series.normalize((payload.contentRows || []).find(row => String(row.id) === entry.id) || {}).series_id === item.id).length;
            if (count) add('shortcut', { id: `series:${item.id}`, title: item.name }, {
                subtitle: '시리즈 모아보기', metadata: `등록 콘텐츠 ${count}개`,
                href: `content.html?series=${encodeURIComponent(item.id)}`, aliases: [item.name], terms: [item.name],
            });
        }
        for (const page of [
            { id: 'gembox', title: 'GEMBOX', subtitle: '보석함', href: 'gembox.html', aliases: ['GEMBOX', '보석함', '구슬요의 보석함'] },
            { id: 'tractor', title: 'TRACTOR SERVICE', subtitle: '트랙터서비스', href: 'tractor-service.html', aliases: ['TRACTOR SERVICE', '트랙터서비스'] },
            { id: 'dance', title: 'DANCE', subtitle: '춤영상', href: 'dance.html', aliases: ['DANCE', '춤영상'] },
        ]) add('shortcut', page, { ...page, terms: page.aliases, metadata: '전용 페이지' });
        return entries;
    }

    function searchUnifiedCatalog(entries, rawQuery, options = {}) {
        const queryText = String(rawQuery ?? '').trim();
        const choseongOnly = isAllChoseongQuery(queryText);
        const query = choseongOnly ? normalizeChoseongQuery(queryText) : normalizeUnifiedSearchText(queryText);
        const result = { query: queryText, total: 0, sections: [], items: [], reason: null };
        if (!query) return { ...result, reason: 'empty-query' };
        if (choseongOnly && [...query].length < UNIFIED_SEARCH_CONFIG.minChoseongLength) return { ...result, reason: 'choseong-too-short' };
        const normalize = choseongOnly ? hangulChoseong : normalizeUnifiedSearchText;
        const ranked = entries.map(item => {
            const aliases = (item.aliases || [item.title]).map(normalize).filter(Boolean);
            const exact = bestTextMatch(aliases, query, { exact: 600, prefix: 450, partial: 380 });
            const details = (item.terms || []).map(normalize).filter(Boolean);
            const score = item.type === 'shortcut'
                ? (query.length >= 2 ? bestTextMatch(aliases, query, { exact: 620, prefix: 410, partial: 0 }) : 0)
                : Math.max(exact, bestTextMatch(details, query, { exact: 320, prefix: 260, partial: 200 }));
            return { ...item, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score ||
            String(b.date).localeCompare(String(a.date)) || searchCollator.compare(a.title, b.title) || searchCollator.compare(a.key, b.key));
        for (const [type, label] of SEARCH_TYPES) {
            const matches = ranked.filter(item => item.type === type);
            if (!matches.length) continue;
            const limit = Math.max(3, Number(options.limits?.[type]) || 3);
            const items = matches.slice(0, limit);
            result.sections.push({ type, label, total: matches.length, items });
            result.items.push(...items);
        }
        result.total = ranked.length;
        return result;
    }

    function readUnifiedSearchCache() {
        try {
            const cached = JSON.parse(global.localStorage?.getItem(UNIFIED_SEARCH_CACHE_KEY) || 'null');
            return cached?.version === UNIFIED_SEARCH_CACHE_VERSION && cached.sources ? cached : null;
        } catch { return null; }
    }
    function writeUnifiedSearchCache(payload) {
        try { global.localStorage?.setItem(UNIFIED_SEARCH_CACHE_KEY, JSON.stringify(payload)); } catch {}
    }
    async function fetchUnifiedSearchTable(table, columns) {
        const client = getSupabaseClient(), rows = [];
        let from = 0;
        while (true) {
            const controller = new AbortController();
            let timer;
            try {
                let request = client.from(table).select(columns).order('id', { ascending: true })
                    .range(from, from + UNIFIED_SEARCH_PAGE_SIZE - 1);
                if (request.abortSignal) request = request.abortSignal(controller.signal);
                const timeout = new Promise((_, reject) => {
                    timer = setTimeout(() => { controller.abort(); reject(new Error('조회 시간이 초과됐어요.')); }, 12000);
                });
                const { data, error } = await Promise.race([request, timeout]);
                if (error) throw error;
                if (!Array.isArray(data)) throw new Error('검색 응답을 확인하지 못했어요.');
                rows.push(...data);
                if (data.length < UNIFIED_SEARCH_PAGE_SIZE) break;
                from += UNIFIED_SEARCH_PAGE_SIZE;
            } finally { clearTimeout(timer); }
        }
        return rows;
    }

    async function loadUnifiedSearchData(options = {}) {
        if (unifiedSearchState.loadPromise) return unifiedSearchState.loadPromise;
        const force = options.force === true;
        const cached = readUnifiedSearchCache();
        const sources = { ...(cached?.sources || {}), ...(unifiedSearchState.data?.sources || {}) };
        unifiedSearchState.loadPromise = (async () => {
            const errors = {}, sourceStates = {}, payload = {};
            await Promise.allSettled(Object.entries(SEARCH_SOURCES).map(async ([key, config]) => {
                try {
                    if (key === 'content') await loadSearchSeries();
                    const saved = sources[key];
                    if (force || !Array.isArray(saved?.rows) || !Number.isFinite(saved.fetchedAt) ||
                        saved.fetchedAt > Date.now() || Date.now() - saved.fetchedAt >= UNIFIED_SEARCH_CACHE_TTL_MS) {
                        sources[key] = { rows: await fetchUnifiedSearchTable(config.table, UNIFIED_SEARCH_COLUMNS[config.table]), fetchedAt: Date.now() };
                    }
                    payload[config.rows] = sources[key].rows;
                    sourceStates[key] = 'success';
                } catch (error) {
                    // An unavailable source is never persisted as a successful empty result.
                    delete sources[key];
                    payload[config.rows] = [];
                    errors[key] = String(error?.message || error);
                    sourceStates[key] = 'error';
                }
            }));
            writeUnifiedSearchCache({ version: UNIFIED_SEARCH_CACHE_VERSION, sources });
            unifiedSearchState.data = {
                ...payload, sources, sourceStates, errors, fetchedAt: Date.now(),
                groups: createUnifiedSearchIndex(payload.songbookRows, payload.liveRows),
                entries: createUnifiedCatalog(payload),
            };
            return unifiedSearchState.data;
        })().finally(() => { unifiedSearchState.loadPromise = null; });
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
        limits: {},
        restore: null,
        previousInert: false,
    };

    function unifiedSearchIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>';
    }

    function addUnifiedSearchStyles() {
        if (document.querySelector('link[data-beadyo-unified-search]')) return;
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'unified-search.css?v=release-20261011-all';
        stylesheet.dataset.beadyoUnifiedSearch = '';
        document.head.append(stylesheet);
    }

    function unifiedSearchModalHtml() {
        return `<div class="beadyo-search-overlay" data-beadyo-search-overlay hidden>
            <section class="beadyo-search-modal" role="dialog" aria-modal="true" aria-label="통합 검색">
                <header class="beadyo-search-head">
                    <div class="beadyo-search-title-wrap">
                        <strong>통합 검색</strong>
                        <span>콘텐츠·음악 영상·노래를 찾아보세요</span>
                    </div>
                    <button class="beadyo-search-close" type="button" data-beadyo-search-close aria-label="통합 검색 닫기">&times;</button>
                </header>
                <div class="beadyo-search-input-wrap">
                    ${unifiedSearchIcon()}
                    <input type="search" data-beadyo-search-input autocomplete="off" spellcheck="false" placeholder="제목, 시리즈, 가수, 초성 검색" aria-label="통합 검색어">
                    <kbd>ESC</kbd>
                </div>
                <div class="beadyo-search-summary" data-beadyo-search-summary aria-live="polite">검색 데이터를 준비하는 중...</div>
                <div class="beadyo-search-results" data-beadyo-search-results id="beadyo-search-results" role="region" aria-label="통합 검색 결과"></div>
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
            unifiedSearchUiState.limits = {};
            unifiedSearchUiState.querySequence += 1;
            unifiedSearchUiState.result = null;
            unifiedSearchUiState.activeIndex = -1;
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
            if (event.target.closest('[data-beadyo-search-retry]')) { prepareUnifiedSearch({ force: true }); return; }
            const more = event.target.closest('[data-beadyo-search-more]');
            if (more) {
                const type = more.dataset.beadyoSearchMore;
                const scrollTop = overlay.querySelector('[data-beadyo-search-results]').scrollTop;
                const previousCount = unifiedSearchUiState.result?.sections.find(section => section.type === type)?.items.length || 0;
                unifiedSearchUiState.limits[type] = (unifiedSearchUiState.limits[type] || 3) + 10;
                runUnifiedSearch(input.value, { immediate: true }).then(() => {
                    overlay.querySelector('[data-beadyo-search-results]').scrollTop = scrollTop;
                    const section = unifiedSearchUiState.result?.sections.find(section => section.type === type);
                    const firstNew = section?.items[previousCount];
                    const nextIndex = unifiedSearchUiState.result?.items.findIndex(item => item.key === firstNew?.key);
                    const focusTarget = overlay.querySelector(`[data-beadyo-search-more="${type}"]`) ||
                        overlay.querySelector(`[data-beadyo-search-result-index="${nextIndex}"]`) || input;
                    focusTarget.focus({ preventScroll: true });
                });
                return;
            }
            const result = event.target.closest('[data-beadyo-search-result-index]');
            if (result && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                selectUnifiedSearchResult(Number(result.dataset.beadyoSearchResultIndex));
            }
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

    function unifiedSearchResultHtml(item, index) {
        return `<a class="beadyo-search-result is-navigable" href="${esc(item.href)}" id="beadyo-search-result-${index}" data-beadyo-search-result-index="${index}">
            <div class="beadyo-search-result-heading"><strong>${esc(item.title)}</strong></div>
            ${item.subtitle ? `<div class="beadyo-search-subtitle">${esc(item.subtitle)}</div>` : ''}
            ${item.metadata || item.date ? `<div class="beadyo-search-source">${item.metadata ? `<span>${esc(item.metadata)}</span>` : ''}${item.date ? `<time datetime="${esc(item.date)}">${esc(item.date)}</time>` : ''}</div>` : ''}
        </a>`;
    }
    function unifiedSearchEmptyHtml(message, detail = '제목, 시리즈, 가수를 다른 단어로 검색해보세요.') {
        return `<div class="beadyo-search-empty"><strong>${esc(message)}</strong><span>${esc(detail)}</span></div>`;
    }
    function renderUnifiedSearchResult(result) {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay) return;
        const summary = overlay.querySelector('[data-beadyo-search-summary]');
        const results = overlay.querySelector('[data-beadyo-search-results]');
        unifiedSearchUiState.result = result;
        unifiedSearchUiState.activeIndex = -1;
        overlay.querySelector('[data-beadyo-search-input]').removeAttribute('aria-describedby');
        const errors = Object.keys(unifiedSearchState.data?.errors || {});
        const allFailed = errors.length === Object.keys(SEARCH_SOURCES).length;
        const warning = errors.length ? `<div class="beadyo-search-warning" role="status"><span>${esc(errors.map(key => SEARCH_SOURCES[key].label).join(' · '))} 조회 실패 · ${allFailed ? '전용 페이지 바로가기는 이용할 수 있어요.' : '다른 검색 결과는 계속 볼 수 있어요.'}</span><button type="button" data-beadyo-search-retry>다시 시도</button></div>` : '';
        if (result.reason === 'empty-query') {
            summary.textContent = '제목, 시리즈, 가수, 초성으로 검색하세요.';
            results.innerHTML = warning + '<div class="beadyo-search-prompt"><span>⌘K</span><strong>콘텐츠·음악 영상·노래를 찾아보세요.</strong></div>';
            return;
        }
        if (result.reason === 'choseong-too-short') {
            summary.textContent = '초성은 2글자 이상 입력해주세요.';
            results.innerHTML = warning + unifiedSearchEmptyHtml('초성을 한 글자 더 입력해주세요');
            return;
        }
        summary.textContent = `"${result.query}" ${errors.length ? '조회된 자료에서 ' : ''}검색 결과 ${result.total}개`;
        if (!result.total) {
            if (allFailed) summary.textContent = `"${result.query}" 검색 자료 조회 실패`;
            results.innerHTML = warning + (errors.length
                ? unifiedSearchEmptyHtml(allFailed ? '검색 자료를 불러오지 못했어요' : '일부 자료를 조회하지 못했어요', '다시 시도로 검색 결과를 확인해주세요.')
                : unifiedSearchEmptyHtml('검색 결과가 없어요'));
            return;
        }
        let index = 0;
        results.innerHTML = warning + result.sections.map(section => {
            const remaining = section.total - section.items.length;
            return `<section class="beadyo-search-section" aria-label="${esc(section.label)}">
                <h3>${esc(section.label)} <span>${section.total}${section.type === 'songbook' ? '곡' : '개'}</span></h3>
                ${section.items.map(item => unifiedSearchResultHtml(item, index++)).join('')}
                ${remaining > 0 ? `<button class="beadyo-search-more" type="button" data-beadyo-search-more="${section.type}">${esc(section.label)} 더 보기 <span>남은 ${remaining}개 · 전체 ${section.total}개</span></button>` : ''}
            </section>`;
        }).join('');
        setUnifiedSearchActiveIndex(0);
        if (unifiedSearchUiState.restore) {
            const saved = unifiedSearchUiState.restore;
            const active = result.items.findIndex(item => item.key === saved.activeKey);
            setUnifiedSearchActiveIndex(Math.max(0, active));
            results.scrollTop = saved.scrollTop || 0;
            unifiedSearchUiState.restore = null;
        }
    }

    function renderUnifiedSearchLoading() {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay) return;
        overlay.querySelector('[data-beadyo-search-summary]').textContent = '콘텐츠·음악 영상·노래를 불러오는 중...';
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
            const data = unifiedSearchState.data || await loadUnifiedSearchData();
            const result = searchUnifiedCatalog(data.entries, query, { limits: unifiedSearchUiState.limits });
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
            if (active) card.setAttribute('aria-current', 'true');
            else card.removeAttribute('aria-current');
        });
        const activeCard = cards[next];
        overlay.querySelector('[data-beadyo-search-input]')?.setAttribute('aria-describedby', activeCard.id);
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
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        const saved = {
            open: true, query: overlay.querySelector('[data-beadyo-search-input]').value,
            limits: { ...unifiedSearchUiState.limits }, activeKey: item.key,
            scrollTop: overlay.querySelector('[data-beadyo-search-results]').scrollTop,
        };
        global.history.replaceState({ ...global.history.state, beadyoSearch: saved }, '', global.location.href);
        global.location.assign(new URL(item.href, global.location.href).href);
    }

    let searchHistoryRestored = false;
    function restoreUnifiedSearch(event) {
        if (searchHistoryRestored && !event?.persisted) return;
        const saved = global.history.state?.beadyoSearch;
        if (!saved?.open || global.self !== global.top) return;
        searchHistoryRestored = true;
        const overlay = ensureUnifiedSearchModal();
        overlay.querySelector('[data-beadyo-search-input]').value = saved.query || '';
        unifiedSearchUiState.limits = saved.limits || {};
        unifiedSearchUiState.restore = saved;
        openUnifiedSearch();
    }
    global.addEventListener('pageshow', restoreUnifiedSearch);
    document.addEventListener('DOMContentLoaded', restoreUnifiedSearch);

    function openUnifiedSearch() {
        if (global.self !== global.top) {
            const origin = global.location.origin === 'null' ? '*' : global.location.origin;
            global.parent.postMessage({ type: UNIFIED_SEARCH_MESSAGE_TYPE }, origin);
            return;
        }
        const overlay = ensureUnifiedSearchModal();
        if (overlay.hidden) {
            unifiedSearchUiState.lastFocused = document.activeElement;
            unifiedSearchUiState.previousInert = overlay.inert;
        }
        overlay.inert = false;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add('is-open'));
        document.documentElement.classList.add('beadyo-search-open');
        const input = overlay.querySelector('[data-beadyo-search-input]');
        requestAnimationFrame(() => input.focus());
        const data = unifiedSearchState.data;
        const needsLoad = !data || Object.keys(data.errors).length ||
            Object.values(data.sources).some(source => Date.now() - source.fetchedAt >= UNIFIED_SEARCH_CACHE_TTL_MS);
        if (needsLoad && !unifiedSearchUiState.loading) {
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
        unifiedSearchUiState.querySequence += 1;
        if (global.history.state?.beadyoSearch) {
            global.history.replaceState({ ...global.history.state, beadyoSearch: null }, '', global.location.href);
        }
        overlay.classList.remove('is-open');
        overlay.inert = unifiedSearchUiState.previousInert;
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
            event.stopImmediatePropagation();
            closeUnifiedSearch();
        } else if (event.key === 'Tab') {
            event.stopImmediatePropagation();
            const focusable = [...overlay.querySelectorAll('input, button, a[href]')].filter(el => !el.disabled && !el.hidden);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (!overlay.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveUnifiedSearchActive(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveUnifiedSearchActive(-1);
        } else if (event.key === 'Enter' && event.target.matches('[data-beadyo-search-input]') && unifiedSearchUiState.activeIndex >= 0) {
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
    // Existing video dialogs also own a focus guard. The foreground search takes priority.
    document.addEventListener('focusin', event => {
        const overlay = document.querySelector('[data-beadyo-search-overlay]');
        if (!overlay || overlay.hidden || !overlay.classList.contains('is-open')) return;
        event.stopImmediatePropagation();
        if (!overlay.contains(event.target)) overlay.querySelector('[data-beadyo-search-input]')?.focus();
    }, true);

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
        home.href = 'index.html#home';
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
        homeAction.href = 'index.html#home';
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
        createUnifiedCatalog,
        searchUnifiedCatalog,
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
