/* Public YouTube metadata. Same ID shares a persisted cache and one in-flight read. */
(function () {
    'use strict';
    const C = window.BeadyoCommon, D = window.BeadyoExploreData;
    const memory = new Map(), pending = new Map();
    const prefix = 'beadyo:video-metadata:v1:';
    function cached(id) {
        let value = memory.get(id);
        if (!value) try { value = JSON.parse(localStorage.getItem(prefix + id)); } catch {}
        if (!value || typeof value.title !== 'string' || !['ready','unavailable'].includes(value.status) || !Number.isFinite(value.at) || value.at > Date.now() || Date.now() - value.at > (value.title ? 7 * 86400000 : 6 * 3600000)) return null;
        memory.set(id, value);
        return value;
    }
    function type(href) {
        try {
            const u = new URL(href);
            if (!D.mediaKey(href).startsWith('youtube:')) return '';
            // watch/youtu.be also carry Shorts: do not infer a regular video from them.
            return u.pathname.startsWith('/shorts/') ? 'Shorts' : u.pathname.startsWith('/live/') ? '라이브 영상' : '';
        } catch { return ''; }
    }
    async function read(href, existing) {
        const key = D.mediaKey(href);
        if (!key.startsWith('youtube:')) return { title: '', status: 'unavailable' };
        if (existing?.title) return { title: existing.title, thumbnail: existing.thumbnail_url || '', status: 'stored' };
        const id = key.slice(8), hit = cached(id);
        if (hit) return hit;
        if (pending.has(id)) return pending.get(id);
        const task = (async () => {
            let value = { title: '', status: 'unavailable', at: Date.now() };
            try {
                const controller = new AbortController();
                let timer;
                try {
                    // Bound both the response and body even when abort is ignored.
                    const responseData = (async () => {
                        const response = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), { signal: controller.signal });
                        if (!response.ok) throw new Error('Metadata unavailable');
                        return response.json();
                    })();
                    const data = await Promise.race([responseData, new Promise((_, reject) => {
                        timer = setTimeout(() => {
                            controller.abort();
                            reject(new Error('Metadata timeout'));
                        }, 4500);
                    })]);
                    if (typeof data.title === 'string' && data.title.trim()) value = { title: data.title.trim().slice(0, 500), thumbnail: C.safeUrl(data.thumbnail_url, ''), status: 'ready', at: Date.now() };
                } finally { clearTimeout(timer); }
            } catch {}
            memory.set(id, value);
            try { localStorage.setItem(prefix + id, JSON.stringify(value)); } catch {}
            return value;
        })().finally(() => pending.delete(id));
        pending.set(id, task);
        return task;
    }
    window.BeadyoVideoMetadata = Object.freeze({ read, type });
})();
