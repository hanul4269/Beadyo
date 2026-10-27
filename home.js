(function () {
    'use strict';
    const root = document.getElementById('frame-7');
    if (!root) return;
    const D = window.BeadyoHomeData;
    const C = window.BeadyoCommon;
    const SOOP = 'https://www.sooplive.co.kr/station/beadyo97';
    const sources = {};
    const rendered = new WeakMap();
    let initialized = false;
    let loadedDay = '';
    let pending = 0;
    let lastLoad = 0;
    const scheduleColumns = 'id,date,end_date,start_time,title,type,subtitle,collab,is_rest';
    const typeNames = { chat: '소통', song: '노래', solo: '슬요 컨텐츠', collab: '참여 컨텐츠', watch: '같이 보기', game: '게임', ad: '광고', rest: '휴방', cover: '커버곡', relay: '중계', pre: '방송 전', general: '기타' };
    const esc = C.esc;
    const url = value => C.safeUrl(value, '');
    const dateText = day => Number.isFinite(D.dayNumber(day)) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${day}T00:00:00+09:00`)) : '';
    const eventDate = event => `${dateText(event.date)}${event.start_time ? ` · ${String(event.start_time).slice(0, 5)}` : ' · 시간 미정'}`;
    function external(href, label, className = 'home-link') {
        const safe = url(href);
        return safe ? `<a class="${className}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
    }
    function routeHref(route) {
        const params = new URLSearchParams(window.location.search);
        params.delete('tab');
        params.delete('month');
        const search = params.toString();
        return `${window.location.pathname}${search ? `?${search}` : ''}#${route}`;
    }
    function tabLink(route, label, className = 'home-link') {
        return `<a class="${className}" href="${esc(routeHref(route))}" data-home-route="${route}">${esc(label)}</a>`;
    }
    function motionImage(name, alt, width, height) {
        return `<figure class="home-card-art" data-home-motion-frame><img src="assets/home/${name}.webp" data-home-poster="assets/home/${name}.webp" data-home-animation="assets/home/${name}-motion.webp" alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async"><figcaption hidden><span class="home-motion-note" role="status"></span></figcaption></figure>`;
    }
    function liveMedia() {
        return `<div data-home-live-media><a class="home-live-thumbnail" data-home-live-thumbnail href="${SOOP}" target="_blank" rel="noopener noreferrer" hidden><img data-home-broadcast-image alt="현재 구슬요 SOOP 방송 썸네일" width="640" height="360" decoding="async"></a>${motionImage('wave', '손을 흔드는 구슬요', 480, 480)}</div>`;
    }
    function shell() {
        const card = (id, title, link, wide = '') => `<article class="home-card ${wide}" data-home-card="${id}" aria-labelledby="home-title-${id}"><div class="home-card-head"><h2 id="home-title-${id}">${title}</h2>${link}</div><div id="home-${id}" aria-live="polite"></div>${id === 'live' ? liveMedia() : ''}</article>`;
        root.innerHTML = `<div class="home-wrap"><header class="home-hero"><img class="home-banner" src="assets/home/banner.webp?v=banner-20261028" alt="구슬요 beadyo 캐릭터 배너" width="1600" height="233" fetchpriority="high" draggable="false"><div class="home-intro"><div class="home-intro-copy"><h1>오늘도 구슬요와 함께</h1><p id="home-today"></p><button class="home-action home-primary home-guide-link" type="button" data-start-here><span>뉴북이 입문가이드</span></button></div><section class="home-soop-notice" aria-labelledby="home-soop-title"><div class="home-soop-head"><h2 id="home-soop-title">SOOP 공지사항</h2>${external(window.BeadyoHomeSoop.boardUrl, '전체 보기')}</div><div id="home-soop" aria-live="polite"></div></section></div></header><div class="home-grid">
            ${card('live', '지금 방송은?', '', '')}
            ${card('schedule', '오늘과 다음 일정', tabLink('calendar', 'CALENDAR →'), 'home-wide')}
            ${card('news', '최신 소식', tabLink('music', 'MUSIC →'), 'home-news-wide')}
            ${card('content', '최근 콘텐츠', tabLink('content', 'CONTENT →'), 'home-wide')}
            ${card('cafe', '슬요 똥글', `<div class="home-cafe-actions"><button class="home-action home-cafe-refresh" id="home-cafe-refresh" type="button" data-home-refresh="cafe" aria-label="슬요 똥글 새로고침" title="최근 목록 새로고침">새로고침</button>${external(window.BeadyoHomeCafe?.boardUrl || 'https://cafe.naver.com/f-e/cafes/31098081/menus/21?viewType=L', '전체 보기')}</div>`)}
            ${card('monthly', '이번 달 돌아보기', '', 'home-wide')}
            ${card('events', '주요 이벤트', tabLink('calendar', '전체 일정 →'))}
        </div></div>`;
    }
    function stateHtml(key, empty) {
        const state = sources[key];
        if (!state || state.status === 'loading') return '<p class="home-state" role="status">불러오는 중…</p>';
        if (state.status === 'error') return `<div class="home-state home-error">데이터를 불러오지 못했습니다.<button class="home-action" type="button" data-home-retry="${key}">다시 시도</button></div>`;
        if (!state.data?.length) return `<p class="home-state">${empty}</p>`;
        return '';
    }
    function refreshNotice(key) {
        return sources[key]?.refreshError ? `<p class="home-state home-error">갱신하지 못해 이전 내용을 표시합니다. <button class="home-action" type="button" data-home-retry="${key}">다시 시도</button></p>` : '';
    }
    function setHtml(id, html) {
        const element = document.getElementById(id);
        if ((rendered.get(element) ?? element.innerHTML) !== html) element.innerHTML = html;
        rendered.set(element, html);
    }
    function rows(key, render, empty, className = 'home-list') {
        return stateHtml(key, empty) || `<ul class="${className}">${sources[key].data.map(render).join('')}</ul>`;
    }
    function newsThumbnail(href, thumbnail = '') {
        const key = window.BeadyoExploreData.mediaKey(href);
        const id = key.startsWith('youtube:') ? key.slice(8) : '';
        return `<span class="home-news-thumb" aria-hidden="true">${id || thumbnail ? `<img src="${esc(url(thumbnail) || `https://img.youtube.com/vi/${id}/hqdefault.jpg`)}" alt="" width="480" height="360" loading="lazy" decoding="async" data-home-thumbnail>` : ''}<span class="home-news-image-state"${id || thumbnail ? ' hidden' : ''}>썸네일 없음</span></span>`;
    }
    function newsItem(href, label, meta, fallbackRoute, thumbnail = '') {
        const safe = url(href);
        return `<li><a class="home-news-item" href="${esc(safe || routeHref(fallbackRoute))}" ${safe ? 'target="_blank" rel="noopener noreferrer"' : `data-home-route="${fallbackRoute}"`}>${newsThumbnail(safe, thumbnail)}<span class="home-news-copy"><span class="home-item-date">${esc(meta)}</span><span class="home-item-title">${esc(label)}${safe ? ' ↗' : ''}</span></span></a></li>`;
    }
    function scheduleItem(event) {
        return `<li><a class="home-item" href="calendar.html?date=${encodeURIComponent(event.date)}" data-home-date="${esc(event.date)}"><span class="home-item-date">${esc(eventDate(event))}</span><span class="home-item-title"><span class="home-tag">${esc(D.isRest(event) ? '휴방' : typeNames[event.type] || '일정')}</span>${esc(event.title)}</span>${event.subtitle ? `<span class="home-item-desc">${esc(event.subtitle)}</span>` : ''}</a></li>`;
    }
    function renderLive() {
        const live = sources.live;
        const schedules = sources.schedule;
        const status = D.broadcastState(live?.status === 'success' ? live.data : null, schedules?.status === 'success' ? schedules.data : null);
        setHtml('home-live', `${live?.status === 'loading' ? '<p class="home-state" role="status">방송 상태를 확인하는 중…</p>' : `<span class="home-status" data-kind="${status.kind}">${status.label}</span><p class="home-live-title">${esc(status.detail)}</p>${status.next ? `<p class="home-meta">${esc(eventDate(status.next))}</p>` : ''}`}
            <div class="home-live-actions">${external(SOOP, 'SOOP에서 보기', 'home-action home-primary')}</div>${live?.status === 'error' ? '<button class="home-action" type="button" data-home-retry="live">다시 시도</button>' : refreshNotice('live')}`);
        window.BeadyoHomeVisual?.setBroadcast(status.kind === 'live' ? live.data.broad_no : null);
    }
    function renderSchedule() {
        const day = D.dayKey();
        const state = sources.schedule;
        let html = stateHtml('schedule', '가까운 60일 안에 등록된 일정이 없습니다.');
        if (state?.status === 'success') {
            const today = state.data.filter(e => D.onDay(e, day));
            const next = D.sortSchedules(state.data.filter(e => e.date > day)).slice(0, 3);
            html = `<div class="home-schedule-columns"><section><h3>오늘</h3>${today.length ? `<ul class="home-list">${D.sortSchedules(today).map(scheduleItem).join('')}</ul>` : '<p class="home-state">오늘 등록된 일정이 없습니다.</p>'}</section><section><h3>다음 일정</h3>${next.length ? `<ul class="home-list">${next.map(scheduleItem).join('')}</ul>` : '<p class="home-state">가까운 60일 안에 다음 일정이 없습니다.</p>'}</section></div>${refreshNotice('schedule')}`;
        }
        setHtml('home-schedule', html);
        renderLive();
    }
    function renderNews() {
        const notice = rows('notices', e => `<li><div class="home-item"><span class="home-item-title">${esc(e.title)}</span>${external(e.link_url, '공지 원문') || tabLink('calendar', 'CALENDAR에서 보기')}</div></li>`, '등록된 활성 공지가 없습니다.');
        const music = rows('music', e => newsItem(e.youtube_url, e.title, `${e.upload_date || '게시일 미등록'} · ${{ original: '오리지널', cover: '커버곡', live: '라이브 영상' }[e.type] || '음악'}`, 'music'), '등록된 음악 영상이 없습니다.', 'home-news-list home-music-list');
        const musicKeys = new Set((sources.music?.data || []).map(e => window.BeadyoExploreData.mediaKey(e.youtube_url)).filter(Boolean));
        const seen = new Set(musicKeys);
        const uniqueVideos = (sources.videos?.data || []).filter(e => {
            const key = window.BeadyoExploreData.mediaKey(e.url) || e.url;
            if (seen.has(key)) return false;
            seen.add(key); return true;
        }).slice(0, 2);
        const videos = stateHtml('videos', '등록된 최근 영상이 없습니다.') || (uniqueVideos.length ? `<ul class="home-news-list home-video-list">${uniqueVideos.map(e => newsItem(e.url, e.metadata?.title || (e.metadata?.status === 'unavailable' ? '영상 제목을 확인하지 못했습니다' : '영상 제목 확인 중'), [e.date ? `연결 일정 · ${e.date}` : '날짜 미등록', window.BeadyoVideoMetadata.type(e.url)].filter(Boolean).join(' · '), 'calendar', e.metadata?.thumbnail)).join('')}</ul>` : '<p class="home-state">추가 영상은 MUSIC에 표시된 영상과 중복됩니다.</p>');
        setHtml('home-news', `${sources.notices?.status === 'success' && !sources.notices.data.length && !sources.notices.refreshError ? '' : `<section class="home-notices"><h3>공지</h3>${notice}${refreshNotice('notices')}</section>`}<div class="home-news-columns"><section><h3>음악 · 커버곡</h3>${music}${refreshNotice('music')}</section><section><h3>캘린더에 등록된 영상</h3>${videos}${refreshNotice('videos')}</section></div>`);
    }
    function renderSoop() {
        const html = stateHtml('soop', '등록된 공개 공지가 없습니다.') || sources.soop.data.map(notice => {
            const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(notice.postedAt));
            return `<a class="home-soop-post" href="${esc(notice.href)}" target="_blank" rel="noopener noreferrer"><span class="home-soop-meta"><span class="home-soop-author">${notice.profile ? `<img src="${esc(notice.profile)}" alt="" width="28" height="28" decoding="async" data-home-soop-profile>` : ''}${esc(notice.author)}</span><time datetime="${esc(notice.postedAt)}">${esc(date)}</time></span><span class="home-soop-title">${esc(notice.title)} ↗</span></a>`;
        }).join('');
        setHtml('home-soop', html + refreshNotice('soop'));
    }
    function renderContent() {
        setHtml('home-content', rows('content', e => `<li><a class="home-item" href="content.html?content=${encodeURIComponent(e.id)}"><span class="home-item-date">${esc(e.broadcast_date)}</span><span class="home-item-title">${esc(e.title)} →</span></a></li>`, '등록된 콘텐츠가 없습니다.') + refreshNotice('content'));
    }
    function renderCafe() {
        const state = sources.cafe;
        const refreshing = state?.status === 'loading' || Boolean(state?.refreshing);
        const button = document.getElementById('home-cafe-refresh');
        if (button) {
            button.disabled = refreshing;
            button.ariaBusy = String(refreshing);
            button.textContent = refreshing ? '갱신 중…' : '새로고침';
        }
        let html;
        if (!state || state.status === 'loading') {
            html = '<p class="home-state" role="status">카페 글을 불러오는 중…</p>';
        } else if (state.status === 'error') {
            html = '<div class="home-state home-error">카페 글 목록을 불러오지 못했습니다.<button class="home-action" type="button" data-home-retry="cafe">다시 시도</button></div>';
        } else {
            const data = state.data;
            const date = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
            const checked = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.fetchedAt));
            html = data.posts.length ? `<ul class="home-list home-cafe-list">${data.posts.map(post => `<li><a class="home-item home-cafe-item" href="${esc(post.href)}" target="_blank" rel="noopener noreferrer"><span class="home-item-title">${esc(post.title)} ↗</span><time class="home-cafe-date" datetime="${esc(post.publishedAt)}">${esc(date(post.publishedAt))}</time></a></li>`).join('')}</ul>` : '<p class="home-state">현재 표시할 공개 게시글이 없습니다.</p>';
            html += `<p class="home-meta home-cafe-checked">최근 업데이트 · <time datetime="${esc(data.fetchedAt)}">${esc(checked)}</time></p>`;
            if (data.fetchFailed || state.refreshError) {
                html += '<p class="home-state home-error">갱신하지 못해 마지막으로 확인한 목록을 표시합니다. <button class="home-action" type="button" data-home-retry="cafe">다시 시도</button></p>';
            }
        }
        setHtml('home-cafe', html);
    }
    function renderEvents() {
        const state = sources.events;
        const day = D.dayKey();
        const empty = stateHtml('events', '현재 지정된 주요 이벤트가 없습니다.');
        setHtml('home-events', empty || state.data.map(e => {
            const difference = D.dayNumber(e.date) - D.dayNumber(day);
            const label = difference > 0 ? `D-${difference}` : difference === 0 ? 'D-DAY' : '진행 중';
            return `<a class="home-event" href="calendar.html?date=${encodeURIComponent(e.date)}" data-home-date="${esc(e.date)}"><div class="home-dday">${label}</div><span class="home-item-title">${esc(e.title)}</span><p class="home-meta">${esc(eventDate(e))}${e.end_date ? ` ~ ${esc(dateText(e.end_date))}` : ''}</p><span class="home-link">CALENDAR에서 상세 보기 →</span></a>`;
        }).join('') + refreshNotice('events'));
    }
    const renderers = { live: renderLive, schedule: renderSchedule, soop: renderSoop, cafe: renderCafe, notices: renderNews, music: renderNews, videos: renderNews, content: renderContent, events: renderEvents };
    function deadline(promise, ms = 12000) {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('HOME timeout')), ms); })]).finally(() => clearTimeout(timer));
    }
    async function readRows(path) {
        const data = await fetchSupabaseRest(path, 6000);
        if (!Array.isArray(data)) throw new Error('Expected rows');
        return data;
    }
    async function schedules() {
        const day = D.dayKey();
        const result = [];
        for (let offset = 0; offset < 2000; offset += 200) {
            const batch = await readRows(`schedules?select=${scheduleColumns}&or=(date.gte.${day},end_date.gte.${day})&date=lte.${D.addDays(day, 60)}&order=date.asc,id.asc&limit=200&offset=${offset}`);
            result.push(...batch);
            if (batch.length < 200) return D.sortSchedules(result);
        }
        throw new Error('Schedule range exceeds HOME limit');
    }
    const loaders = {
        live: async () => { const data = await fetchLiveStatus(); if (!data) throw new Error('Live unavailable'); return data; },
        schedule: schedules,
        soop: () => window.BeadyoHomeSoop.read(C.fetchWithTimeout),
        cafe: (options = {}) => window.BeadyoHomeCafe.read(C.fetchWithTimeout, { force: Boolean(options.force || sources.cafe?.refreshError || sources.cafe?.data?.fetchFailed) }),
        notices: () => readRows('calendar_notices?select=id,title,link_url,created_at&is_active=eq.true&order=created_at.desc,id.asc&limit=3'),
        music: () => readRows(`youtube_songs?select=id,title,type,upload_date,youtube_url&or=(upload_date.lte.${D.dayKey()},upload_date.is.null)&order=upload_date.desc.nullslast,id.asc&limit=3`),
        videos: async () => {
            const data = await readRows(`youtube_links?select=id,date,url&date=lte.${D.dayKey()}&order=date.desc,created_at.desc,id.asc&limit=12`);
            let music = [];
            try { music = await window.BeadyoExplore.readAll('youtube_songs', 'id,title,youtube_url'); } catch {}
            const stored = new Map(music.map(e => [window.BeadyoExploreData.mediaKey(e.youtube_url), e]));
            const seen = new Set();
            const unique = data.filter(e => { const key = window.BeadyoExploreData.mediaKey(e.url) || e.url; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 5);
            return Promise.all(unique.map(async e => ({ ...e, metadata: await window.BeadyoVideoMetadata.read(e.url, stored.get(window.BeadyoExploreData.mediaKey(e.url))) })));
        },
        content: () => readRows(`content_archive?select=id,title,broadcast_date&broadcast_date=lte.${D.dayKey()}&order=broadcast_date.desc,id.asc&limit=3`),
        events: async () => {
            const response = await C.fetchWithTimeout(`home-events.json?v=home-step1-20261010`, 4000, { cache: 'no-store' });
            if (!response.ok) throw new Error('Event configuration unavailable');
            const config = await response.json();
            if (!Array.isArray(config.scheduleIds) || config.scheduleIds.length > 20 || config.scheduleIds.some(id => !/^[a-f0-9-]{36}$/i.test(id))) throw new Error('Invalid event IDs');
            if (!config.scheduleIds.length) return [];
            const data = await readRows(`schedules?select=${scheduleColumns}&id=in.(${config.scheduleIds.join(',')})&order=date.asc,id.asc`);
            return data.filter(e => Number.isFinite(D.dayNumber(e.date)) && (e.end_date || e.date) >= D.dayKey());
        },
    };
    async function load(key, options = {}) {
        if (sources[key]?.status === 'loading' || sources[key]?.refreshing) return;
        const previous = sources[key]?.status === 'success' ? sources[key] : null;
        sources[key] = previous ? { ...previous, refreshing: true } : { status: 'loading' };
        pending++;
        if (!previous || key === 'cafe') renderers[key]();
        try {
            const data = await deadline(loaders[key](options));
            sources[key] = { status: 'success', data, at: Date.now() };
        } catch {
            sources[key] = previous ? { ...previous, refreshing: false, refreshError: true } : { status: 'error' };
        } finally { pending--; renderers[key](); }
    }
    function refresh() {
        if (pending) return;
        loadedDay = D.dayKey();
        lastLoad = Date.now();
        window.BeadyoMonthly?.refresh();
        document.getElementById('home-today').textContent = dateText(loadedDay);
        Object.keys(loaders).forEach(key => { void load(key); });
    }
    function activate() {
        if (!initialized) {
            shell();
            window.BeadyoMonthly?.mount(root);
            initialized = true;
            const preventBannerSave = event => {
                if (event.target.matches?.('.home-banner')) event.preventDefault();
            };
            root.addEventListener('contextmenu', preventBannerSave);
            root.addEventListener('dragstart', preventBannerSave);
            root.addEventListener('error', event => {
                const image = event.target;
                if (image.matches?.('[data-home-soop-profile]')) { image.hidden = true; return; }
                if (!image.matches?.('[data-home-thumbnail]')) return;
                image.hidden = true;
                const message = image.parentElement.querySelector('.home-news-image-state');
                message.hidden = false;
                message.textContent = '이미지를 불러올 수 없습니다';
            }, true);
            root.addEventListener('click', event => {
                const target = event.target.closest('a,button');
                if (!target) return;
                if (target.dataset.homeDate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    openCalendarDate(target.dataset.homeDate);
                } else if (target.dataset.homeRoute && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    const routes = { calendar: 0, music: 4, content: 5 };
                    if (target.dataset.homeRoute === 'music') switchMusicPage('songs');
                    else switchTab(routes[target.dataset.homeRoute]);
                } else if (target.dataset.homeRefresh === 'cafe') void load('cafe', { force: true });
                else if (target.dataset.homeRetry && loaders[target.dataset.homeRetry]) void load(target.dataset.homeRetry);
            });
        }
        window.BeadyoHomeVisual?.activate();
        if (!lastLoad || loadedDay !== D.dayKey() || Date.now() - lastLoad > 120000) refresh();
        else if (sources.live?.status !== 'loading') void load('live');
    }
    window.BeadyoHome = Object.freeze({ activate });
    setInterval(() => {
        if (!root.classList.contains('active') || document.hidden) return;
        if (loadedDay !== D.dayKey() || Date.now() - lastLoad >= 120000) refresh();
        else void load('live');
    }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && root.classList.contains('active')) activate(); });
    if (root.classList.contains('active')) activate();
})();
