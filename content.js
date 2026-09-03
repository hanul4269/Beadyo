(() => {
    'use strict';

    const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
    const OWNER_EMAIL = 'riosniper12@gmail.com';
    const IMAGE_BUCKET = 'content-images';
    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const DEFAULT_CATEGORIES = ['토크', '음악', '게임', '합방', '경연', '특집', '참여형', '기타'];
    const LIST_FIELDS = ['planners', 'hosts', 'cast_members', 'tags'];
    const ALLOWED_ORIGINS = new Set(['https://beadyo.com', 'http://localhost:3000', 'http://127.0.0.1:3000']);
    const SOOP_READER_URL = 'https://r.jina.ai/';

    const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { detectSessionInUrl: false, flowType: 'pkce' },
    });

    const state = {
        items: [],
        query: '',
        year: '',
        category: '',
        planningType: '',
        sort: 'newest',
        isEditor: false,
        loading: true,
        loadError: '',
        detailId: null,
        editingId: null,
        dirty: false,
        saving: false,
        initializingForm: false,
        pendingImageFile: null,
        removeImage: false,
        previewObjectUrl: '',
        lastFocused: null,
        soopThumbnails: new Map(),
        soopThumbnailPromises: new Map(),
    };

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeUrl(value) {
        try {
            const raw = String(value || '').trim();
            if (!raw) return '';
            const url = new URL(raw);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            return url.toString();
        } catch {
            return '';
        }
    }

    function stringValue(value, max = 10000) {
        return typeof value === 'string' ? value.trim().slice(0, max) : '';
    }

    function stringList(value) {
        const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n|,/g) : [];
        return source.map(item => stringValue(item, 1000)).filter(Boolean).slice(0, 100);
    }

    function normalizeDate(value) {
        const raw = stringValue(value, 32);
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return '';
        const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(match[1]) || date.getMonth() + 1 !== Number(match[2]) || date.getDate() !== Number(match[3])) return '';
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    function normalizeReplay(value, index) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const rawUrl = stringValue(value.url, 2000);
        return {
            platform: stringValue(value.platform, 40) || '기타',
            label: stringValue(value.label, 120) || '다시보기',
            url: rawUrl ? safeUrl(rawUrl) : '',
            video_type: stringValue(value.video_type, 40) || '전체',
            status: ['정상', '비공개', '삭제됨', '확인 중'].includes(value.status) ? value.status : '확인 중',
            sort_order: Number.isFinite(Number(value.sort_order)) ? Number(value.sort_order) : index,
        };
    }

    function normalizeContent(row) {
        const replaysSource = Array.isArray(row?.replays) ? row.replays : [];
        return {
            id: stringValue(row?.id, 100),
            broadcast_date: normalizeDate(row?.broadcast_date),
            title: stringValue(row?.title, 200) || '제목 없는 콘텐츠',
            summary: stringValue(row?.summary, 500),
            description: stringValue(row?.description, 20000),
            categories: stringList(row?.categories),
            planning_type: stringValue(row?.planning_type, 100),
            planners: stringList(row?.planners),
            hosts: stringList(row?.hosts),
            cast_members: stringList(row?.cast_members),
            tags: stringList(row?.tags),
            thumbnail_url: safeUrl(row?.thumbnail_url),
            notes: stringValue(row?.notes, 10000),
            replays: replaysSource.map(normalizeReplay).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order),
            created_at: stringValue(row?.created_at, 64),
            updated_at: stringValue(row?.updated_at, 64),
        };
    }

    function formatDate(value, long = false) {
        const normalized = normalizeDate(value);
        if (!normalized) return '날짜 미상';
        const date = new Date(`${normalized}T00:00:00`);
        return new Intl.DateTimeFormat('ko-KR', long
            ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
            : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    }

    function formatTimestamp(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function cardFallback() {
        return `<div class="card-fallback"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 16 3.5-4 2.8 3 2.2-2.5L19 16"/><circle cx="8" cy="9" r="1.2"/></svg></div>`;
    }

    function youtubeVideoId(value) {
        const normalized = safeUrl(value);
        if (!normalized) return '';
        try {
            const url = new URL(normalized);
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            let candidate = '';
            if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] || '';
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
                const parts = url.pathname.split('/').filter(Boolean);
                if (url.pathname === '/watch') candidate = url.searchParams.get('v') || '';
                else if (['shorts', 'live', 'embed'].includes(parts[0])) candidate = parts[1] || '';
            }
            return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
        } catch {
            return '';
        }
    }

    function soopVideoId(value) {
        const normalized = safeUrl(value);
        if (!normalized) return '';
        try {
            const url = new URL(normalized);
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            if (!['vod.sooplive.com', 'vod.sooplive.co.kr', 'vod.afreecatv.com', 'vod.afreecatv.co.kr'].includes(host)) return '';
            return url.pathname.match(/^\/player\/(\d+)(?:\/|$)/i)?.[1] || '';
        } catch {
            return '';
        }
    }

    function soopCacheKey(videoId) {
        return `beadyo:content-soop-thumbnail:${videoId}`;
    }

    function cachedSoopThumbnail(videoId) {
        if (!videoId) return '';
        if (state.soopThumbnails.has(videoId)) return state.soopThumbnails.get(videoId);
        let thumbnail = '';
        try { thumbnail = safeUrl(sessionStorage.getItem(soopCacheKey(videoId))); } catch {}
        if (thumbnail) state.soopThumbnails.set(videoId, thumbnail);
        return thumbnail;
    }

    function findSchemaThumbnail(value) {
        if (!value || typeof value !== 'object') return '';
        if (Array.isArray(value)) {
            for (const entry of value) {
                const nested = findSchemaThumbnail(entry);
                if (nested) return nested;
            }
            return '';
        }
        const candidate = Array.isArray(value.thumbnailUrl) ? value.thumbnailUrl[0] : value.thumbnailUrl;
        const direct = safeUrl(candidate);
        if (direct) return direct;
        const graph = Array.isArray(value['@graph']) ? value['@graph'] : [];
        for (const entry of graph) {
            const nested = findSchemaThumbnail(entry);
            if (nested) return nested;
        }
        return '';
    }

    function extractSoopThumbnail(html) {
        const documentNode = new DOMParser().parseFromString(String(html || ''), 'text/html');
        for (const script of documentNode.querySelectorAll('script[type="application/ld+json"]')) {
            try {
                const thumbnail = findSchemaThumbnail(JSON.parse(script.textContent || ''));
                if (thumbnail) return thumbnail;
            } catch {}
        }
        return '';
    }

    async function fetchSoopThumbnail(replayUrl) {
        const normalized = safeUrl(replayUrl);
        const videoId = soopVideoId(normalized);
        if (!videoId) return '';
        const cached = cachedSoopThumbnail(videoId);
        if (cached) return cached;
        if (state.soopThumbnailPromises.has(videoId)) return state.soopThumbnailPromises.get(videoId);

        const promise = (async () => {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(`${SOOP_READER_URL}${normalized}`, {
                    headers: { 'X-Return-Format': 'html' },
                    signal: controller.signal,
                });
                if (!response.ok) return '';
                const thumbnail = extractSoopThumbnail(await response.text());
                if (!thumbnail) return '';
                state.soopThumbnails.set(videoId, thumbnail);
                try { sessionStorage.setItem(soopCacheKey(videoId), thumbnail); } catch {}
                return thumbnail;
            } catch {
                return '';
            } finally {
                window.clearTimeout(timeout);
            }
        })().finally(() => state.soopThumbnailPromises.delete(videoId));
        state.soopThumbnailPromises.set(videoId, promise);
        return promise;
    }

    function replayThumbnailUrl(item) {
        for (const replay of item.replays || []) {
            const videoId = youtubeVideoId(replay.url);
            if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }
        for (const replay of item.replays || []) {
            const thumbnail = cachedSoopThumbnail(soopVideoId(replay.url));
            if (thumbnail) return thumbnail;
        }
        return '';
    }

    async function resolveSoopThumbnails(items = state.items) {
        const replayUrls = [...new Set(items.flatMap(item => {
            if (safeUrl(item.thumbnail_url) || replayThumbnailUrl(item)) return [];
            const replay = (item.replays || []).find(candidate => soopVideoId(candidate.url));
            return replay ? [replay.url] : [];
        }))];
        if (!replayUrls.length) return;

        let cursor = 0;
        let changed = false;
        const worker = async () => {
            while (cursor < replayUrls.length) {
                const replayUrl = replayUrls[cursor++];
                if (await fetchSoopThumbnail(replayUrl)) changed = true;
            }
        };
        await Promise.all(Array.from({ length: Math.min(2, replayUrls.length) }, worker));
        if (!changed) return;
        renderGrid();
        if (state.detailId) openDetail(state.detailId, { updateUrl: false, refresh: true });
    }

    function displayThumbnailUrl(item) {
        return safeUrl(item.thumbnail_url) || replayThumbnailUrl(item);
    }

    function imageMarkup(item, className) {
        const src = displayThumbnailUrl(item);
        return `${src ? `<img class="${className}" src="${esc(src)}" alt="${esc(item.title)}" loading="lazy" decoding="async" onerror="this.hidden=true">` : ''}${cardFallback()}`;
    }

    function renderSkeletons() {
        $('#content-grid').innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton-card" aria-hidden="true"><div class="skeleton skeleton-media"></div><div class="skeleton-copy"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div></div>`).join('');
        $('#result-count').textContent = '콘텐츠를 불러오는 중입니다';
    }

    function searchableText(item) {
        return [item.title, item.summary, item.description, item.planning_type, ...item.planners, ...item.hosts, ...item.cast_members, ...item.tags, ...item.categories].join(' ').toLocaleLowerCase('ko-KR');
    }

    function filteredItems() {
        const query = state.query.toLocaleLowerCase('ko-KR');
        const items = state.items.filter(item => {
            if (query && !searchableText(item).includes(query)) return false;
            if (state.year && !item.broadcast_date.startsWith(`${state.year}-`)) return false;
            if (state.category && !item.categories.includes(state.category)) return false;
            if (state.planningType && item.planning_type !== state.planningType) return false;
            return true;
        });
        return items.sort((a, b) => {
            if (state.sort === 'title') return a.title.localeCompare(b.title, 'ko-KR');
            const dateCompare = a.broadcast_date.localeCompare(b.broadcast_date);
            if (dateCompare !== 0) return state.sort === 'oldest' ? dateCompare : -dateCompare;
            return b.created_at.localeCompare(a.created_at);
        });
    }

    function hasActiveFilters() {
        return Boolean(state.query || state.year || state.category || state.planningType || state.sort !== 'newest');
    }

    function renderFilters() {
        const years = [...new Set(state.items.map(item => item.broadcast_date.slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort().reverse();
        const categories = [...new Set(state.items.flatMap(item => item.categories))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
        const planningTypes = [...new Set(state.items.map(item => item.planning_type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
        fillSelect($('#year-filter'), years, '전체 연도', state.year);
        fillSelect($('#category-filter'), categories, '전체 분류', state.category);
        fillSelect($('#planning-filter'), planningTypes, '전체 기획 형태', state.planningType);
    }

    function fillSelect(select, values, placeholder, selected) {
        select.innerHTML = `<option value="">${esc(placeholder)}</option>${values.map(value => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('')}`;
    }

    function renderGrid() {
        if (state.loading) return renderSkeletons();
        renderFilters();
        const items = filteredItems();
        $('#result-count').textContent = `총 ${items.length.toLocaleString('ko-KR')}개의 콘텐츠`;
        const active = [state.year && `${state.year}년`, state.category, state.planningType].filter(Boolean);
        $('#active-filter-summary').textContent = active.length ? `· ${active.join(' · ')}` : '';

        if (state.loadError) {
            $('#content-grid').innerHTML = `<div class="error-state"><div class="empty-icon">!</div><h2>콘텐츠를 불러오지 못했어요</h2><p>${esc(state.loadError)}</p><button class="primary-btn" type="button" data-retry-load>다시 불러오기</button></div>`;
            $('[data-retry-load]')?.addEventListener('click', loadContents);
            return;
        }

        if (!items.length) {
            const filtered = hasActiveFilters();
            const title = filtered ? '조건에 맞는 콘텐츠가 없어요' : '아직 등록된 콘텐츠가 없어요';
            const copy = filtered ? '검색어나 필터를 바꾸거나 초기화해 보세요.' : '구슬요의 방송 콘텐츠 기록이 이곳에 차곡차곡 쌓일 예정입니다.';
            $('#content-grid').innerHTML = `<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m9 9 6 3-6 3Z"/></svg></div><h2>${title}</h2><p>${copy}</p><div class="empty-actions">${filtered ? '<button class="ghost-btn" type="button" data-empty-reset>필터 초기화</button>' : ''}${state.isEditor ? '<button class="primary-btn" type="button" data-empty-add>첫 콘텐츠 추가</button>' : ''}</div></div>`;
            $('[data-empty-reset]')?.addEventListener('click', resetFilters);
            $('[data-empty-add]')?.addEventListener('click', () => openForm());
            return;
        }

        $('#content-grid').innerHTML = items.map(item => {
            const people = item.cast_members.length ? item.cast_members.join(', ') : item.hosts.join(', ');
            const replayCount = item.replays.filter(replay => replay.url && replay.status === '정상').length;
            const chips = [...item.tags.map(tag => ({ value: `#${tag}`, type: 'tag' })), ...item.categories.map(value => ({ value, type: '' }))].slice(0, 4);
            return `<button class="content-card" type="button" data-content-id="${esc(item.id)}" aria-label="${esc(item.title)} 상세 보기">
                <div class="card-media">${imageMarkup(item, 'card-thumb')}<span class="replay-mark${replayCount ? '' : ' none'}">${replayCount ? `▶ 다시보기 ${replayCount}` : '다시보기 없음'}</span></div>
                <div class="card-body">
                    <div class="card-kicker">${esc([item.categories[0], item.planning_type].filter(Boolean).join(' · ') || 'BEADYO CONTENT')}</div>
                    <h2 class="card-title">${esc(item.title)}</h2>
                    <p class="card-summary">${esc(item.summary || item.description || '상세 기록에서 콘텐츠 정보를 확인해 보세요.')}</p>
                    <div class="card-people">${people ? `출연 · ${esc(people)}` : '&nbsp;'}</div>
                    <div class="chip-list">${chips.map(chip => `<span class="chip ${chip.type}">${esc(chip.value)}</span>`).join('')}</div>
                    <time class="card-date" datetime="${esc(item.broadcast_date)}">${esc(formatDate(item.broadcast_date))}</time>
                </div>
            </button>`;
        }).join('');
        $$('[data-content-id]').forEach(card => card.addEventListener('click', () => openDetail(card.dataset.contentId)));
    }

    async function loadContents() {
        if (!db) {
            state.loading = false;
            state.loadError = '데이터 연결 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
            renderGrid();
            return;
        }
        state.loading = true;
        state.loadError = '';
        renderGrid();
        try {
            const { data, error } = await db.from('content_archive').select('*').order('broadcast_date', { ascending: false });
            if (error) throw error;
            state.items = (data || []).map(normalizeContent).filter(item => item.id);
        } catch (error) {
            const migrationMissing = /content_archive/i.test(error?.message || '');
            (migrationMissing ? console.warn : console.error)('CONTENT load error', error);
            state.items = [];
            state.loadError = migrationMissing
                ? 'CONTENT 데이터베이스 마이그레이션이 아직 적용되지 않았을 수 있습니다.'
                : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
        } finally {
            state.loading = false;
            renderGrid();
            openInitialContentIfNeeded();
            resolveSoopThumbnails();
        }
    }

    function detailMeta(label, values) {
        const list = Array.isArray(values) ? values : [values];
        const clean = list.filter(Boolean);
        return clean.length ? `<div class="meta-item"><dt>${esc(label)}</dt><dd>${clean.map(esc).join(', ')}</dd></div>` : '';
    }

    function detailText(title, value) {
        return value ? `<section class="detail-section"><h3>${esc(title)}</h3><p>${esc(value)}</p></section>` : '';
    }

    function replayMarkup(replay) {
        const available = replay.url && replay.status === '정상';
        const platformClass = replay.platform.toLowerCase() === 'youtube' ? ' youtube' : '';
        const inner = `<span class="platform-badge${platformClass}">${esc(replay.platform)}</span><span class="replay-copy"><strong>${esc(replay.label)}</strong><small>${esc(replay.video_type)}</small></span>${available ? '<span class="replay-arrow">↗</span>' : `<span class="replay-status">${esc(replay.status)}</span>`}`;
        return available
            ? `<a class="replay-link" href="${esc(replay.url)}" target="_blank" rel="noopener noreferrer external">${inner}</a>`
            : `<div class="replay-unavailable" aria-label="${esc(replay.label)} ${esc(replay.status)}">${inner}</div>`;
    }

    function openDetail(id, options = {}) {
        const item = state.items.find(candidate => candidate.id === id);
        if (!item) return;
        const thumbnailUrl = displayThumbnailUrl(item);
        if (!options.refresh) state.lastFocused = document.activeElement;
        state.detailId = item.id;
        const updated = formatTimestamp(item.updated_at);
        const replays = item.replays.length ? `<section class="detail-section"><h3>다시보기</h3><div class="replay-list">${item.replays.map(replayMarkup).join('')}</div></section>` : '';
        const chips = [...item.categories, ...item.tags.map(tag => `#${tag}`)];
        $('#detail-content').innerHTML = `<div class="detail-hero">${thumbnailUrl ? `<img class="detail-hero-image" src="${esc(thumbnailUrl)}" alt="" onerror="this.hidden=true">` : ''}<div class="detail-hero-fallback"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 16 3.5-4 2.8 3 2.2-2.5L19 16"/><circle cx="8" cy="9" r="1.2"/></svg></div></div>
            <header class="detail-heading"><time class="detail-date" datetime="${esc(item.broadcast_date)}">${esc(formatDate(item.broadcast_date, true))}</time><h2 class="detail-title" id="detail-title">${esc(item.title)}</h2>${item.summary ? `<p class="detail-summary">${esc(item.summary)}</p>` : ''}</header>
            <div class="detail-body">
                <dl class="detail-meta">${detailMeta('콘텐츠 분류', item.categories)}${detailMeta('기획 형태', item.planning_type)}${detailMeta('기획자', item.planners)}${detailMeta('진행자', item.hosts)}${detailMeta('출연자', item.cast_members)}${detailMeta('방송일', formatDate(item.broadcast_date, true))}</dl>
                ${replays}
                ${detailText('상세 설명', item.description)}
                ${chips.length ? `<section class="detail-section"><h3>태그와 분류</h3><div class="detail-chips">${chips.map(value => `<span class="chip${value.startsWith('#') ? ' tag' : ''}">${esc(value)}</span>`).join('')}</div></section>` : ''}
                ${detailText('비고', item.notes)}
                <footer class="detail-footer"><span class="updated-at">${updated ? `마지막 수정 ${esc(updated)}` : ''}</span><button class="detail-action" type="button" data-share-content>공유</button>${state.isEditor ? '<button class="detail-action" type="button" data-edit-content>수정</button><button class="detail-action delete" type="button" data-delete-content>삭제</button>' : ''}</footer>
            </div>`;
        $('#detail-layer').hidden = false;
        document.body.classList.add('modal-open');
        if (!options.refresh) $('#detail-modal').focus({ preventScroll: true });
        if (options.updateUrl !== false) setContentParam(item.id);
        $('[data-share-content]')?.addEventListener('click', () => shareContent(item));
        $('[data-edit-content]')?.addEventListener('click', () => openForm(item.id));
        $('[data-delete-content]')?.addEventListener('click', () => deleteContent(item.id));
    }

    function closeDetail(options = {}) {
        if ($('#detail-layer').hidden) return;
        $('#detail-layer').hidden = true;
        state.detailId = null;
        if ($('#form-layer').hidden) document.body.classList.remove('modal-open');
        if (options.updateUrl !== false) setContentParam('');
        state.lastFocused?.focus?.({ preventScroll: true });
    }

    function setContentParam(id) {
        try {
            const url = new URL(window.location.href);
            if (id) url.searchParams.set('content', id);
            else url.searchParams.delete('content');
            history.replaceState({ content: id || null }, document.title, `${url.pathname}${url.search}${url.hash}`);
        } catch {}
    }

    function openInitialContentIfNeeded() {
        if (state.loading || state.detailId) return;
        const id = new URLSearchParams(window.location.search).get('content');
        if (id && state.items.some(item => item.id === id)) openDetail(id, { updateUrl: false });
    }

    async function shareContent(item) {
        const url = new URL('content.html', window.location.href);
        url.searchParams.set('content', item.id);
        const shareData = { title: `${item.title} | BEADYO CONTENT`, text: item.summary || '구슬요 CONTENT 아카이브', url: url.toString() };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                await navigator.clipboard.writeText(url.toString());
                showToast('공유 주소를 복사했습니다');
            }
        } catch (error) {
            if (error?.name !== 'AbortError') showToast('공유 주소를 복사하지 못했습니다', true);
        }
    }

    function repeatSection(field) {
        return $(`[data-list-field="${field}"]`);
    }

    function addRepeatRow(field, value = '') {
        const section = repeatSection(field);
        if (!section) return;
        const row = $('#repeat-row-template').content.firstElementChild.cloneNode(true);
        row.querySelector('[data-repeat-input]').value = value;
        row.querySelector('[data-repeat-input]').placeholder = '항목 입력';
        row.querySelector('[data-remove-list]').addEventListener('click', () => {
            row.remove();
            markDirty();
        });
        section.querySelector('.repeat-list').appendChild(row);
        return row;
    }

    function setRepeatRows(field, values) {
        const list = repeatSection(field)?.querySelector('.repeat-list');
        if (!list) return;
        list.innerHTML = '';
        stringList(values).forEach(value => addRepeatRow(field, value));
    }

    function readRepeatRows(field) {
        return [...(repeatSection(field)?.querySelectorAll('[data-repeat-input]') || [])].map(input => input.value.trim()).filter(Boolean);
    }

    function addReplayRow(replay = {}) {
        const row = $('#replay-row-template').content.firstElementChild.cloneNode(true);
        const normalized = normalizeReplay(replay, $('#replay-form-list').children.length) || normalizeReplay({}, $('#replay-form-list').children.length);
        Object.entries(normalized).forEach(([field, value]) => {
            const input = row.querySelector(`[data-replay-field="${field}"]`);
            if (input) input.value = value;
        });
        if (!stringValue(replay.url, 2000)) row.querySelector('[data-replay-field="url"]').value = '';
        row.querySelector('[data-remove-replay]').addEventListener('click', () => {
            row.remove();
            numberReplayRows();
            markDirty();
        });
        $('#replay-form-list').appendChild(row);
        numberReplayRows();
        return row;
    }

    function numberReplayRows() {
        $$('#replay-form-list .replay-row').forEach((row, index) => {
            row.querySelector('[data-replay-number]').textContent = `다시보기 ${index + 1}`;
            const order = row.querySelector('[data-replay-field="sort_order"]');
            if (order && order.value === '') order.value = index;
        });
    }

    function readReplays() {
        return $$('#replay-form-list .replay-row').map((row, index) => {
            const get = field => row.querySelector(`[data-replay-field="${field}"]`)?.value.trim() || '';
            const urlRaw = get('url');
            return {
                platform: get('platform') || '기타',
                label: get('label') || '다시보기',
                url: urlRaw ? safeUrl(urlRaw) : '',
                video_type: get('video_type') || '전체',
                status: get('status') || '확인 중',
                sort_order: Number.isFinite(Number(get('sort_order'))) ? Number(get('sort_order')) : index,
                _rawUrl: urlRaw,
            };
        }).filter(replay => replay._rawUrl || replay.label !== '다시보기');
    }

    function renderCategoryChoices(selected = []) {
        const existing = state.items.flatMap(item => item.categories);
        const values = [...new Set([...DEFAULT_CATEGORIES, ...existing, ...selected])];
        $('#category-choices').innerHTML = values.map(value => `<label class="choice"><input type="checkbox" name="categories" value="${esc(value)}"${selected.includes(value) ? ' checked' : ''}><span>${esc(value)}</span></label>`).join('');
    }

    function selectedCategories() {
        return $$('input[name="categories"]:checked').map(input => input.value);
    }

    function currentFormItem() {
        return state.items.find(item => item.id === state.editingId) || null;
    }

    function openForm(id = null) {
        if (!state.isEditor) return;
        const item = id ? state.items.find(candidate => candidate.id === id) : null;
        if (id && !item) return;
        if (state.detailId) closeDetail();
        state.lastFocused = document.activeElement;
        state.initializingForm = true;
        state.editingId = item?.id || null;
        state.dirty = false;
        state.pendingImageFile = null;
        state.removeImage = false;
        clearPreviewObjectUrl();
        $('#content-form').reset();
        $('#form-title').textContent = item ? '콘텐츠 수정' : '콘텐츠 추가';
        $('#form-delete-btn').hidden = !item;
        $('#field-date').value = item?.broadcast_date || '';
        $('#field-title').value = item?.title === '제목 없는 콘텐츠' ? '' : item?.title || '';
        $('#field-summary').value = item?.summary || '';
        $('#field-description').value = item?.description || '';
        $('#field-planning-type').value = item?.planning_type || '';
        $('#field-thumbnail-url').value = item?.thumbnail_url || '';
        $('#field-notes').value = item?.notes || '';
        renderCategoryChoices(item?.categories || []);
        LIST_FIELDS.forEach(field => setRepeatRows(field, item?.[field] || []));
        $('#replay-form-list').innerHTML = '';
        (item?.replays || []).forEach(addReplayRow);
        renderImagePreview(item?.thumbnail_url || '');
        $('#duplicate-warning').hidden = true;
        $('#form-layer').hidden = false;
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            state.initializingForm = false;
            $('#form-modal').scrollTop = 0;
            $('#field-date').focus({ preventScroll: true });
        });
    }

    function markDirty() {
        if (!state.initializingForm) state.dirty = true;
    }

    function closeForm(options = {}) {
        if ($('#form-layer').hidden || (state.saving && !options.force)) return false;
        if (!options.force && state.dirty && !confirm('저장하지 않은 변경사항이 있습니다. 편집을 닫을까요?')) return false;
        $('#form-layer').hidden = true;
        state.editingId = null;
        state.dirty = false;
        state.pendingImageFile = null;
        state.removeImage = false;
        clearPreviewObjectUrl();
        document.body.classList.remove('modal-open');
        state.lastFocused?.focus?.({ preventScroll: true });
        return true;
    }

    function clearPreviewObjectUrl() {
        if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
        state.previewObjectUrl = '';
    }

    function renderImagePreview(src) {
        const url = src && src === state.previewObjectUrl ? src : safeUrl(src);
        $('#image-preview').innerHTML = url ? `<img src="${esc(url)}" alt="포스터 미리보기" onerror="this.parentElement.innerHTML='<span>이미지를 불러올 수 없어요</span>'">` : '<span>미리보기</span>';
    }

    function onImageFileSelected(file) {
        if (!file) return;
        if (!IMAGE_TYPES.has(file.type)) {
            $('#field-thumbnail-file').value = '';
            showToast('JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다', true);
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            $('#field-thumbnail-file').value = '';
            showToast('이미지는 8MB 이하만 업로드할 수 있습니다', true);
            return;
        }
        clearPreviewObjectUrl();
        state.pendingImageFile = file;
        state.removeImage = false;
        state.previewObjectUrl = URL.createObjectURL(file);
        renderImagePreview(state.previewObjectUrl);
        markDirty();
    }

    async function uploadPendingImage() {
        const file = state.pendingImageFile;
        if (!file) return '';
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type];
        const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const path = `${new Date().getUTCFullYear()}/${random}.${extension}`;
        const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });
        if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
        return db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    function checkDuplicate() {
        const title = $('#field-title').value.trim().toLocaleLowerCase('ko-KR');
        const date = normalizeDate($('#field-date').value);
        const duplicate = title && date && state.items.find(item => item.id !== state.editingId && item.broadcast_date === date && item.title.toLocaleLowerCase('ko-KR') === title);
        $('#duplicate-warning').hidden = !duplicate;
        $('#duplicate-warning').textContent = duplicate ? '같은 날짜와 제목의 콘텐츠가 이미 있습니다. 중복 저장은 가능하니 한 번 확인해 주세요.' : '';
        return Boolean(duplicate);
    }

    async function saveContent(event) {
        event.preventDefault();
        if (!state.isEditor || state.saving) return;
        const continueAdding = event.submitter?.dataset.afterSave === 'add';
        const title = $('#field-title').value.trim();
        const broadcastDate = normalizeDate($('#field-date').value);
        if (!broadcastDate) return showToast('방송 날짜를 입력해 주세요', true);
        if (!title) return showToast('콘텐츠명을 입력해 주세요', true);
        if (title.length > 200) return showToast('콘텐츠명은 200자 이하로 입력해 주세요', true);
        const urlInput = $('#field-thumbnail-url').value.trim();
        if (urlInput && !safeUrl(urlInput)) return showToast('이미지 URL을 확인해 주세요', true);
        const replays = readReplays();
        if (replays.some(replay => replay._rawUrl && !replay.url)) return showToast('다시보기 URL을 확인해 주세요', true);
        checkDuplicate();

        const wasEditing = Boolean(state.editingId);
        const button = $('#save-content-btn');
        const addNextButton = $('#save-and-add-content-btn');
        state.saving = true;
        button.disabled = true;
        addNextButton.disabled = true;
        button.textContent = state.pendingImageFile ? '이미지 업로드 중…' : '저장 중…';
        addNextButton.textContent = state.pendingImageFile ? '이미지 업로드 중…' : '저장 중…';
        try {
            let thumbnailUrl = state.removeImage ? '' : safeUrl(urlInput) || currentFormItem()?.thumbnail_url || '';
            if (state.pendingImageFile) thumbnailUrl = await uploadPendingImage();
            if (!thumbnailUrl && !replays.some(replay => youtubeVideoId(replay.url))) {
                const soopReplay = replays.find(replay => soopVideoId(replay.url));
                if (soopReplay) {
                    button.textContent = 'SOOP 썸네일 확인 중…';
                    addNextButton.textContent = 'SOOP 썸네일 확인 중…';
                    thumbnailUrl = await fetchSoopThumbnail(soopReplay.url);
                }
            }
            const payload = {
                broadcast_date: broadcastDate,
                title,
                summary: $('#field-summary').value.trim() || null,
                description: $('#field-description').value.trim() || null,
                categories: selectedCategories(),
                planning_type: $('#field-planning-type').value.trim() || null,
                thumbnail_url: thumbnailUrl || null,
                notes: $('#field-notes').value.trim() || null,
                replays: replays.map(({ _rawUrl, ...replay }) => replay).sort((a, b) => a.sort_order - b.sort_order),
            };
            LIST_FIELDS.forEach(field => { payload[field] = readRepeatRows(field); });
            const query = state.editingId
                ? db.from('content_archive').update(payload).eq('id', state.editingId).select('*').single()
                : db.from('content_archive').insert(payload).select('*').single();
            const { data, error } = await query;
            if (error) throw error;
            const saved = normalizeContent(data);
            if (state.editingId) state.items = state.items.map(item => item.id === saved.id ? saved : item);
            else state.items.push(saved);
            state.dirty = false;
            closeForm({ force: true });
            renderGrid();
            showToast(wasEditing ? '콘텐츠를 수정했습니다' : '콘텐츠를 추가했습니다');
            if (continueAdding) openForm();
        } catch (error) {
            console.error('CONTENT save error', error);
            showToast(error?.message || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
        } finally {
            state.saving = false;
            button.disabled = false;
            addNextButton.disabled = false;
            button.textContent = '저장';
            addNextButton.textContent = '저장 후 추가하기';
        }
    }

    async function deleteContent(id) {
        if (!state.isEditor || state.saving) return;
        const item = state.items.find(candidate => candidate.id === id);
        if (!item || !confirm(`“${item.title}” 콘텐츠를 삭제할까요?\n업로드한 이미지 파일은 삭제되지 않습니다.`)) return;
        state.saving = true;
        try {
            const { error } = await db.from('content_archive').delete().eq('id', item.id);
            if (error) throw error;
            state.items = state.items.filter(candidate => candidate.id !== item.id);
            closeDetail();
            if (!$('#form-layer').hidden) closeForm({ force: true });
            renderGrid();
            showToast('콘텐츠를 삭제했습니다');
        } catch (error) {
            console.error('CONTENT delete error', error);
            showToast(error?.message || '삭제하지 못했습니다', true);
        } finally {
            state.saving = false;
        }
    }

    function resetFilters() {
        state.query = '';
        state.year = '';
        state.category = '';
        state.planningType = '';
        state.sort = 'newest';
        $('#content-search').value = '';
        $('#sort-filter').value = 'newest';
        renderGrid();
    }

    let toastTimer = 0;
    function showToast(message, isError = false) {
        const toast = $('#toast');
        toast.textContent = message;
        toast.classList.toggle('error', isError);
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
    }

    async function checkEditor(user) {
        if (!user) return false;
        const email = stringValue(user.email, 320).toLowerCase();
        if (email === OWNER_EMAIL.toLowerCase()) return true;
        try {
            const { data, error } = await db.from('editors').select('email').eq('email', email).maybeSingle();
            return !error && Boolean(data);
        } catch {
            return false;
        }
    }

    async function setEditorFromUser(user) {
        state.isEditor = await checkEditor(user);
        $('#add-content-btn').hidden = !state.isEditor;
        renderGrid();
        if (state.detailId) openDetail(state.detailId, { updateUrl: false });
    }

    async function initAuth() {
        if (!db) return;
        const { data: { session } = {} } = await db.auth.getSession();
        await setEditorFromUser(session?.user || null);
        db.auth.onAuthStateChange((_event, nextSession) => setEditorFromUser(nextSession?.user || null));
    }

    function allowedMessageOrigin(origin) {
        return origin === window.location.origin || ALLOWED_ORIGINS.has(origin);
    }

    function handleKeydown(event) {
        const openLayer = !$('#form-layer').hidden ? $('#form-layer') : !$('#detail-layer').hidden ? $('#detail-layer') : null;
        if (!openLayer) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (openLayer.id === 'form-layer') closeForm();
            else closeDetail();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...openLayer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function bindEvents() {
        $('#content-search').addEventListener('input', event => { state.query = event.target.value.trim(); renderGrid(); });
        $('#year-filter').addEventListener('change', event => { state.year = event.target.value; renderGrid(); });
        $('#category-filter').addEventListener('change', event => { state.category = event.target.value; renderGrid(); });
        $('#planning-filter').addEventListener('change', event => { state.planningType = event.target.value; renderGrid(); });
        $('#sort-filter').addEventListener('change', event => { state.sort = event.target.value; renderGrid(); });
        $('#filter-reset').addEventListener('click', resetFilters);
        $('#add-content-btn').addEventListener('click', () => openForm());
        $$('[data-close-modal]').forEach(element => element.addEventListener('click', () => closeDetail()));
        $$('[data-close-form]').forEach(element => element.addEventListener('click', () => closeForm()));
        $$('[data-add-list]').forEach(button => button.addEventListener('click', () => {
            const field = button.closest('[data-list-field]').dataset.listField;
            const row = addRepeatRow(field);
            row.querySelector('[data-repeat-input]').focus();
            markDirty();
        }));
        $('#add-replay-btn').addEventListener('click', () => {
            const row = addReplayRow({ sort_order: $('#replay-form-list').children.length });
            row.querySelector('[data-replay-field="url"]').focus();
            markDirty();
        });
        $('#add-category-btn').addEventListener('click', () => {
            const value = $('#custom-category').value.trim();
            if (!value) return;
            const selected = [...selectedCategories(), value];
            renderCategoryChoices(selected);
            $('#custom-category').value = '';
            markDirty();
        });
        $('#field-thumbnail-file').addEventListener('change', event => onImageFileSelected(event.target.files?.[0]));
        $('#field-thumbnail-url').addEventListener('input', event => {
            state.pendingImageFile = null;
            $('#field-thumbnail-file').value = '';
            clearPreviewObjectUrl();
            state.removeImage = false;
            renderImagePreview(event.target.value);
        });
        $('#remove-image-btn').addEventListener('click', () => {
            state.pendingImageFile = null;
            state.removeImage = true;
            $('#field-thumbnail-file').value = '';
            $('#field-thumbnail-url').value = '';
            clearPreviewObjectUrl();
            renderImagePreview('');
            markDirty();
        });
        $('#field-title').addEventListener('input', checkDuplicate);
        $('#field-date').addEventListener('input', checkDuplicate);
        $('#content-form').addEventListener('input', markDirty);
        $('#content-form').addEventListener('change', markDirty);
        $('#content-form').addEventListener('submit', saveContent);
        $('#form-delete-btn').addEventListener('click', () => deleteContent(state.editingId));
        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('beforeunload', event => {
            if (!state.dirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
        window.addEventListener('message', event => {
            if (!allowedMessageOrigin(event.origin) || event.data?.type !== 'beadyo-auth-sync') return;
            setEditorFromUser(event.data.user || null);
        });
        window.addEventListener('popstate', () => {
            const id = new URLSearchParams(window.location.search).get('content');
            if (id && state.items.some(item => item.id === id)) openDetail(id, { updateUrl: false });
            else closeDetail({ updateUrl: false });
        });
    }

    async function init() {
        bindEvents();
        renderSkeletons();
        await Promise.all([loadContents(), initAuth()]);
    }

    init();
})();
