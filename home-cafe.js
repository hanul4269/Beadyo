/* Public post metadata is refreshed by the site's feed job, never by a Naver browser request. */
(function (root) {
    'use strict';
    const CAFE_ID = '31098081', MENU_ID = '21', BOARD_TITLE = '슬요 똥글';
    const boardUrl = `https://cafe.naver.com/f-e/cafes/${CAFE_ID}/menus/${MENU_ID}`;
    const source = './data/cafe-posts.json', storageKey = 'beadyo:home-cafe:v1';
    // Public raw data updates independently of a GitHub Pages rebuild. Preview stays local.
    const liveSource = 'https://raw.githubusercontent.com/hanul4269/Beadyo/main/data/cafe-posts.json';
    const liveHosts = new Set(['beadyo.com', 'www.beadyo.com', 'hanul4269.github.io']);
    const cacheDuration = 5 * 60000, staleAfter = 6 * 3600000, futureTolerance = 5 * 60000;
    const controls = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
    let memory = null, memoryAt = 0, pending = null, lastFetchFailed = false;

    function timestamp(value, now) {
        if (typeof value !== 'string') throw new Error('Invalid cafe timestamp');
        const parts = value.match(/^([1-9]\d{3})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
        if (!parts) throw new Error('Invalid cafe timestamp');
        const [, year, month, day, hour, minute, second] = parts.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const at = Date.parse(value);
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
            hour > 23 || minute > 59 || second > 59 || !Number.isFinite(at) || at > now + futureTolerance) {
            throw new Error('Invalid cafe timestamp');
        }
        return new Date(at).toISOString();
    }

    function normalize(payload, now = Date.now()) {
        if (!Number.isFinite(now) || !payload || payload.schemaVersion !== 1 || payload.cafeId !== CAFE_ID ||
            payload.menuId !== MENU_ID || payload.boardTitle !== BOARD_TITLE || !Array.isArray(payload.posts)) {
            throw new Error('Invalid cafe feed');
        }
        const fetchedAt = timestamp(payload.fetchedAt, now);
        const posts = payload.posts.map(post => {
            if (!post || typeof post.id !== 'string' || !/^[1-9]\d*$/.test(post.id) || !Number.isSafeInteger(Number(post.id)) ||
                typeof post.title !== 'string' || controls.test(post.title)) throw new Error('Invalid cafe post');
            const title = post.title.trim().replace(/\s+/g, ' ');
            if (!/[^\s\u200c\u200d]/.test(title) || title.length > 300) throw new Error('Invalid cafe title');
            const href = `https://cafe.naver.com/f-e/cafes/${CAFE_ID}/articles/${post.id}`;
            // A canonical URL also rejects credentials, lookalike hosts, redirects and alternate article IDs.
            if (post.href !== href) throw new Error('Invalid cafe post link');
            const publishedAt = timestamp(post.publishedAt, now);
            if (Date.parse(publishedAt) > Date.parse(fetchedAt) + futureTolerance) throw new Error('Inconsistent cafe dates');
            return { id: post.id, title, publishedAt, href };
        }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || Number(b.id) - Number(a.id));
        const seen = new Set();
        return { posts: posts.filter(post => !seen.has(post.id) && seen.add(post.id)).slice(0, 5), fetchedAt,
            stale: now - Date.parse(fetchedAt) >= staleAfter, fromCache: false, fetchFailed: false };
    }

    function record(value) {
        return { schemaVersion: 1, cafeId: CAFE_ID, menuId: MENU_ID, boardTitle: BOARD_TITLE,
            fetchedAt: value.fetchedAt, posts: value.posts.map(post => ({ ...post })) };
    }

    function cached(now) {
        const values = [];
        try { if (memory) values.push(normalize(memory, now)); } catch {}
        try { values.push(normalize(JSON.parse(root.localStorage.getItem(storageKey)), now)); } catch {}
        const value = values.sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0] || null;
        if (value) memory = record(value);
        return value;
    }

    async function readFeed(fetchWithTimeout, url, mode, timeout = 6000) {
        let timer;
        try {
            // Cover JSON body reads too: the shared fetch timeout only covers the response headers.
            const request = (async () => {
                const response = await fetchWithTimeout(url, timeout,
                    { credentials: 'omit', cache: 'no-cache', mode, redirect: 'error' });
                if (!response?.ok) throw new Error('Cafe feed unavailable');
                return response.json();
            })();
            const payload = await Promise.race([request, new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Cafe feed timeout')), timeout);
            })]);
            return normalize(payload);
        } finally { clearTimeout(timer); }
    }

    async function load(fetchWithTimeout) {
        try {
            let value, fetchFailed = false;
            if (liveHosts.has(root.location?.hostname)) {
                try { value = await readFeed(fetchWithTimeout, liveSource, 'cors'); }
                catch {
                    fetchFailed = true;
                    // Leave time for bundled data and persistent fallback within HOME's 12s deadline.
                    value = await readFeed(fetchWithTimeout, source, 'same-origin', 4000);
                    const previous = cached(Date.now());
                    if (previous && Date.parse(previous.fetchedAt) >= Date.parse(value.fetchedAt)) value = previous;
                }
            } else value = await readFeed(fetchWithTimeout, source, 'same-origin');
            memory = record(value);
            memoryAt = Date.now();
            lastFetchFailed = fetchFailed;
            try { root.localStorage.setItem(storageKey, JSON.stringify(memory)); } catch {}
            return { ...value, fetchFailed, fromCache: fetchFailed };
        } catch (error) {
            lastFetchFailed = true;
            const value = cached(Date.now());
            if (!value) throw error;
            return { ...value, fromCache: true, fetchFailed: true };
        }
    }

    function read(fetchWithTimeout, options = {}) {
        if (pending) return pending;
        if (typeof fetchWithTimeout !== 'function') return Promise.reject(new Error('Cafe feed reader required'));
        const now = Date.now();
        if (!options.force && memory && now >= memoryAt && now - memoryAt < cacheDuration) {
            const value = cached(now);
            if (value) return Promise.resolve({ ...value, fromCache: true, fetchFailed: lastFetchFailed });
        }
        // Start in a microtask so synchronous fetch failures cannot leave a settled Promise in pending.
        pending = Promise.resolve().then(() => load(fetchWithTimeout)).finally(() => { pending = null; });
        return pending;
    }

    const api = Object.freeze({ boardUrl, read, normalize });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BeadyoHomeCafe = api;
})(typeof window !== 'undefined' ? window : globalThis);
