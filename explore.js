(function () {
    'use strict';
    const C = window.BeadyoCommon;
    const D = window.BeadyoExploreData;
    if (!C || !D) return;
    const esc = C.esc;
    const cache = new Map();
    const reads = new Map();
    const jobs = new WeakMap();
    function deadline(promise, ms = 12000) {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Read timeout')), ms);
        })]).finally(() => clearTimeout(timer));
    }
    async function readAll(table, columns, filters = '') {
        const key = `${table}:${columns}:${filters}`;
        const cached = cache.get(key);
        if (cached && Date.now() - cached.at < 300000) return cached.rows;
        if (reads.has(key)) return reads.get(key);
        const request = readPages(table, columns, filters, key).finally(() => reads.delete(key));
        reads.set(key, request);
        return request;
    }
    async function readPages(table, columns, filters, key) {
        const rows = [];
        for (let offset = 0; offset < 10000; offset += 1000) {
            const response = await deadline(C.fetchWithTimeout(`${C.SUPABASE_URL}/rest/v1/${table}?select=${columns}${filters}&order=id.asc&limit=1000&offset=${offset}`, 6000, {
                headers: { apikey: C.SUPABASE_ANON_KEY },
            }));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const batch = await deadline(response.json());
            if (!Array.isArray(batch)) throw new Error('Invalid rows');
            rows.push(...batch);
            if (batch.length < 1000) {
                cache.set(key, { at: Date.now(), rows });
                return rows;
            }
        }
        throw new Error('Read limit exceeded');
    }
    async function readIds(table, columns, ids) {
        if (!Array.isArray(ids) || ids.length > 20 || ids.some(id =>
            typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
            throw new Error('Invalid selection IDs');
        }
        if (!ids.length) return [];
        return readAll(table, columns, `&id=in.(${[...new Set(ids)].join(',')})`);
    }
    function link(url, label) {
        const safe = D.safeUrl(url);
        return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
    }
    function localLink(url, label) {
        return `<a href="${esc(url)}" data-explore-link>${esc(label)} →</a>`;
    }
    function dateLink(date, label = '이 날짜의 기록') {
        return localLink(`calendar.html?date=${encodeURIComponent(date)}`, label);
    }
    function contentLink(item) {
        return localLink(`content.html?content=${encodeURIComponent(item.id)}`, `${item.broadcast_date} · ${item.title}`);
    }
    function area(target, title, loader, render) {
        const section = document.createElement('section');
        section.className = 'explore-area';
        section.innerHTML = `<h3>${esc(title)}</h3><div class="explore-area-body"></div>`;
        target.appendChild(section);
        const body = section.querySelector('.explore-area-body');
        async function run() {
            const token = {};
            jobs.set(body, token);
            body.innerHTML = '<p class="explore-state" role="status">불러오는 중…</p>';
            try {
                const rows = await deadline(Promise.resolve().then(loader));
                if (!body.isConnected || jobs.get(body) !== token) return;
                body.innerHTML = render(rows);
                body.querySelectorAll('[data-explore-retry]').forEach(button => button.addEventListener('click', run));
            } catch {
                if (!body.isConnected || jobs.get(body) !== token) return;
                body.innerHTML = '<p class="explore-state" role="status">자료를 확인하지 못했습니다.</p><button type="button" class="explore-action">다시 시도</button>';
                body.querySelector('button').addEventListener('click', run);
            }
        }
        void run();
    }
    const empty = text => `<p class="explore-state">${esc(text)}</p>`;
    function mountSong(target, song, liveLoader) {
        if (!target) return;
        target.innerHTML = '<h2>이 곡을 더 만나보기</h2><p class="explore-note">등록된 클립·MR의 영상 ID로 확인된 자료만 연결합니다.</p>';
        area(target, 'MUSIC에 등록된 영상', () => readAll('youtube_songs', 'id,title,youtube_url,type,upload_date'), rows => {
            const matched = D.musicForSong(song, rows);
            return matched.length ? `<ul>${matched.map(row => `<li>${link(row.youtube_url, row.title)}<span class="explore-meta">${esc(row.upload_date || '게시일 미등록')} · ${esc(row.type === 'original' ? '오리지널' : row.type === 'cover' ? '커버곡' : '라이브 영상')}</span></li>`).join('')}</ul>` : empty('연결이 확인된 음악 영상이 없습니다.');
        });
        area(target, '클립이 연결된 방송 기록', liveLoader, rows => {
            const matched = D.liveForSong(song, rows).sort((a, b) => (b.performed_date || '').localeCompare(a.performed_date || ''));
            return matched.length ? `<ul>${matched.map(row => `<li><strong>${esc(row.title)}</strong><span class="explore-meta">${esc(row.performed_date || '날짜 미등록')}</span>${link(row.clip_url, '클립')}${D.validDate(row.performed_date) ? dateLink(row.performed_date, '이 날짜의 일정·방송정보') : ''}</li>`).join('')}</ul>` : empty('이 클립과 연결이 확인된 방송 기록이 없습니다.');
        });
        area(target, '관련 공연·합방 콘텐츠', () => readAll('content_archive', 'id,title,broadcast_date,replays'), rows => {
            const matched = D.contentForMedia([song.clip_url, song.mr_url], rows);
            return matched.length ? `<ul>${matched.map(row => `<li>${contentLink(row)}</li>`).join('')}</ul>` : empty('영상으로 연결이 확인된 공연·합방이 없습니다.');
        });
        target.insertAdjacentHTML('beforeend', '<p class="explore-note">다른 방송 버전은 곡별 연결 ID가 확인된 뒤 추가합니다.</p>');
    }
    function mountDate(target, date, replayUrls = []) {
        if (!target || !D.validDate(date)) return;
        target.innerHTML = '<h2>이 날짜의 노래 기록</h2><p class="explore-note">방송에서 부른 날짜 기준입니다. 특정 일정과 같은 방송인지는 별도로 확인해야 합니다.</p>';
        area(target, 'LIVE RECORD → 클립 → SONGBOOK', async () => {
            const live = await readAll('live_songs', 'id,title,artist,performed_date,clip_url', `&performed_date=eq.${date}`);
            if (!live.length) return { live, songs: [] };
            try {
                const songs = await readAll('songbook', 'id,title,artist,category,clip_url');
                return { live, songs };
            } catch { return { live, songs: [], songError: true }; }
        }, ({ live, songs, songError }) => {
            if (!live.length) return empty('이 날짜에 등록된 노래 기록이 없습니다.');
            return `<ul>${live.slice(0, 8).map(row => `<li><strong>${esc(row.title)}</strong><span class="explore-meta">${esc(row.artist || '')}</span>${link(row.clip_url, '클립')}${D.songsForClip(row.clip_url, songs).map(song => localLink(`songbook.html?view=songbook&song=${encodeURIComponent(song.id)}&detail=1`, `같은 영상의 SONGBOOK · ${song.title} (${song.category})`)).join('')}</li>`).join('')}</ul>${live.length > 8 ? `<p class="explore-note">${live.length}개 중 8개를 표시합니다.</p>` : ''}${songError ? '<p class="explore-state">노래책 연결을 확인하지 못했습니다.</p><button class="explore-action" type="button" data-explore-retry>노래책 연결 다시 시도</button>' : ''}${localLink(`songbook.html?view=live&date=${date}`, '이 날짜의 LIVE RECORD 전체')}`;
        });
        if (replayUrls.some(D.mediaKey)) {
            area(target, '방송 영상이 연결된 CONTENT', () => readAll('content_archive', 'id,title,broadcast_date,replays'), rows => {
                const matched = D.contentForMedia(replayUrls, rows);
                return matched.length ? `<ul>${matched.map(row => `<li>${contentLink(row)}</li>`).join('')}</ul>` : empty('방송 영상으로 연결이 확인된 콘텐츠가 없습니다.');
            });
        }
    }
    document.addEventListener('click', event => {
        const anchor = event.target.closest('a[data-explore-link]');
        if (!anchor || window.parent === window || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const url = new URL(anchor.href);
        if (url.origin !== location.origin) return;
        event.preventDefault();
        window.parent.postMessage({ type: 'beadyo-explore-link', href: url.pathname + url.search }, location.origin);
    });
    window.BeadyoExplore = Object.freeze({ readAll, readIds, deadline, area, link, localLink, mountSong, mountDate });
})();
