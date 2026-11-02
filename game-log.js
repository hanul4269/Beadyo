(function () {
    'use strict';
    const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s:：·.\-_'’!?]/g, '');
    const latest = game => game.dates.map(row => row.date).filter(Boolean).sort().at(-1) || '';
    const earliest = game => game.dates.map(row => row.date).filter(Boolean).sort()[0] || '';
    function summarizeDates(game, year = '') {
        const dates = [...new Set(game.dates.map(row => row.date).filter(date => date && (!year || date.startsWith(year))))].sort();
        return { lastDate: dates.at(-1) || '', count: dates.length };
    }
    function sourceCaption(record) {
        if (record.confidence === 'video') return '방송 영상에서 보기 ↗';
        if (record.confidence === 'calendar') return '캘린더에서 보기 ↗';
        return '나무위키 기록 ↗';
    }
    function filterGames(games, state) {
        const needle = normalize(state.query);
        return games.filter(game => {
            const dated = game.dates.some(row => row.date);
            return (!needle || [game.title, ...(game.aliases || [])].some(value => normalize(value).includes(needle)))
                && (!state.year || game.dates.some(row => row.date?.startsWith(state.year)))
                && (state.status === 'all' || (state.status === 'dated' ? dated : !dated));
        }).sort((a, b) => {
            const nameOrder = a.title.localeCompare(b.title, 'ko');
            if (state.sort === 'name') return nameOrder;
            const scoped = game => state.year ? { dates: game.dates.filter(row => row.date?.startsWith(state.year)) } : game;
            const ad = state.sort === 'oldest' ? earliest(scoped(a)) : latest(scoped(a));
            const bd = state.sort === 'oldest' ? earliest(scoped(b)) : latest(scoped(b));
            if (!ad || !bd) return ad ? -1 : bd ? 1 : nameOrder;
            return (state.sort === 'oldest' ? ad.localeCompare(bd) : bd.localeCompare(ad)) || nameOrder;
        });
    }
    if (typeof module === 'object' && module.exports) module.exports = { normalize, filterGames, latest, earliest, summarizeDates, sourceCaption };
    if (typeof document === 'undefined') return;

    const $ = id => document.getElementById(id);
    const VIEW_STORAGE_KEY = 'beadyo:game-log:view';
    let preferredView = 'grid';
    try { if (localStorage.getItem(VIEW_STORAGE_KEY) === 'list') preferredView = 'list'; } catch {}
    const state = { query: '', year: '', sort: 'recent', status: 'all', view: preferredView };
    let dataset = null;
    let returnFocus = null;
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme');
    try { document.documentElement.dataset.theme = theme === 'dark' || (!theme && localStorage.getItem('beadyo:theme') === 'dark') ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
    const embedded = window.self !== window.top;
    if (embedded) $('standalone-nav').hidden = true;
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== parent) return;
        if (event.data?.type === 'beadyo-theme-sync') document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
    });
    window.addEventListener('storage', event => {
        if (event.key === 'beadyo:theme') document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
    });
    function element(tag, className, text) {
        const item = document.createElement(tag);
        if (className) item.className = className;
        if (text !== undefined) item.textContent = text;
        return item;
    }
    const gameIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 15h20c5 0 7 4 8 11l2 8c1 6-4 8-8 4l-7-7H19l-7 7c-4 4-9 2-8-4l2-8c1-7 3-11 8-11Z"/><path d="M15 20v9M10.5 24.5h9M31 21h.1M36 27h.1"/></svg>';
    const dateIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M6 2v4M14 2v4M3 9h14"/></svg>';
    const formatDate = date => date ? date.replaceAll('-', '.') : '';
    function safeLink(value) {
        try {
            const url = new URL(value, location.href);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            return url.href;
        } catch { return ''; }
    }
    function officialImage(game, className) {
        if (!game.image || !/^assets\/game-log\/[\w.-]+$/.test(game.image)) return null;
        const image = element('img', className);
        image.src = game.image;
        image.alt = `${game.title} 공식 게임 이미지`;
        image.loading = className === 'detail-image' ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.width = 460;
        image.height = 215;
        image.addEventListener('error', () => { image.hidden = true; });
        return image;
    }
    function gameArt(game) {
        const art = element('div', 'game-art');
        const fallback = element('div', 'art-fallback');
        fallback.innerHTML = gameIcon;
        fallback.append(element('span', '', game.title));
        art.append(fallback);
        const image = officialImage(game);
        if (image) art.append(image);
        return art;
    }
    function renderCard(game) {
        const button = element('button', 'game-card');
        button.type = 'button';
        button.dataset.gameId = game.id;
        button.setAttribute('aria-label', `${game.title} 플레이 날짜 보기`);
        const copy = element('div', 'game-card-copy');
        copy.append(element('h2', 'game-title', game.title));
        const date = element('div', 'game-date');
        date.innerHTML = dateIcon;
        const { lastDate, count } = summarizeDates(game, state.year);
        if (lastDate) {
            const time = element('time', '', formatDate(lastDate));
            time.dateTime = lastDate;
            date.append(time);
            if (count > 1) date.append(element('span', 'date-extra', `+${count - 1}개 기록`));
        } else date.append(element('span', 'date-unknown', '플레이 날짜 미확인'));
        copy.append(date);
        button.append(gameArt(game), copy);
        button.addEventListener('click', () => openDetail(game, button));
        return button;
    }
    function renderListRow(game) {
        const { lastDate, count } = summarizeDates(game, state.year);
        const button = element('button', 'game-row');
        button.type = 'button';
        button.dataset.gameId = game.id;
        button.setAttribute('aria-label', `${game.title}, ${lastDate ? `최근 기록 ${formatDate(lastDate)}, 등록 날짜 ${count}개` : '플레이 날짜 미확인'}, 상세 보기`);
        const title = element('h2', 'game-row-title', game.title);
        const stats = element('div', 'game-row-stats');
        const recent = element('div', 'game-row-stat');
        recent.append(element('span', 'row-stat-label', '최근 기록'));
        const date = element(lastDate ? 'time' : 'span', lastDate ? 'row-stat-value' : 'row-stat-value date-unknown', lastDate ? formatDate(lastDate) : '날짜 미확인');
        if (lastDate) date.dateTime = lastDate;
        recent.append(date);
        const total = element('div', 'game-row-stat');
        total.append(element('span', 'row-stat-label', '등록 날짜'), element('span', 'row-stat-value', `${count}개`));
        stats.append(recent, total);
        const detail = element('span', 'row-detail');
        detail.setAttribute('aria-hidden', 'true');
        detail.append(element('span', '', '상세보기'));
        detail.innerHTML += '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5 5 5-5 5"/></svg>';
        button.append(gameArt(game), title, stats, detail);
        button.addEventListener('click', () => openDetail(game, button));
        return button;
    }
    function render() {
        if (!dataset) return;
        const games = filterGames(dataset.games, state);
        const listView = state.view === 'list';
        $('games').classList.toggle('game-list', listView);
        $('games').replaceChildren(...games.map(listView ? renderListRow : renderCard));
        $('empty-state').hidden = games.length > 0;
        $('result-count').textContent = `${games.length}개 게임`;
        document.querySelectorAll('[data-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === state.status)));
        document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    }
    function openDetail(game, opener, updateUrl = true) {
        returnFocus = opener || null;
        const body = $('detail-body');
        const image = officialImage(game, 'detail-image');
        body.replaceChildren();
        if (image) body.append(image);
        const content = element('div', 'detail-content');
        const title = element('h2', '', game.title);
        title.id = 'detail-title';
        content.append(title);
        const aliases = (game.aliases || []).filter(alias => normalize(alias) !== normalize(game.title));
        if (aliases.length) content.append(element('p', 'detail-aliases', aliases.join(' · ')));
        const dated = game.dates.filter(row => row.date).sort((a, b) => b.date.localeCompare(a.date));
        const heading = element('div', 'detail-record-heading');
        heading.append(element('h3', '', '기록된 플레이 날짜'), element('span', '', `${dated.length}개 기록`));
        content.append(heading);
        if (!dated.length) content.append(element('p', 'detail-note', '플레이한 게임 목록에는 있지만 정확한 날짜는 아직 확인하지 못했어요. 날짜가 확인되면 이곳에 함께 남길게요.'));
        else {
            const list = element('ul', 'record-list');
            dated.forEach(record => {
                const item = element('li');
                const row = element('div', 'record-row');
                const dateGroup = element('div', 'record-date');
                const time = element('time', '', formatDate(record.date) + (record.dateEnd ? ` ~ ${formatDate(record.dateEnd)}` : ''));
                time.dateTime = record.date;
                dateGroup.append(time);
                if (record.timestampLabel) dateGroup.append(element('span', 'timestamp-label', `영상 ${record.timestampLabel}`));
                if (record.participationRole) dateGroup.append(element('span', 'participation-role-label', record.participationRole));
                if (record.confidence === 'video' && record.broadcastDate && record.broadcastDate !== record.date) {
                    dateGroup.append(element('span', 'broadcast-date-label', `${formatDate(record.broadcastDate)} 방송 · 자정 이후`));
                }
                const href = safeLink(record.sourceUrl);
                const source = element(href ? 'a' : 'span', 'source-label', sourceCaption(record));
                if (href) {
                    source.href = href;
                    source.target = '_blank';
                    source.rel = 'noopener noreferrer';
                }
                row.append(dateGroup, source);
                item.append(row);
                if (record.eventTitle) item.append(element('p', 'record-description', record.eventTitle));
                list.append(item);
            });
            content.append(list);
        }
        content.append(element('p', 'detail-date-note', '확인된 자료에 남아 있는 날짜예요. 최초 플레이일이나 전체 플레이 횟수를 뜻하지는 않습니다.'));
        if (game.officialUrl && safeLink(game.officialUrl)) {
            const credit = element('div', 'image-credit');
            credit.append(element('span', '', game.image ? '이미지 © 해당 게임 제작사·배급사' : '게임 정보'));
            const link = element('a', '', '공식 게임 페이지 ↗');
            link.href = safeLink(game.officialUrl);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            credit.append(link);
            content.append(credit);
        }
        body.append(content);
        const dialog = $('game-dialog');
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('detail-open');
        dialog.scrollTop = 0;
        if (updateUrl) {
            const url = new URL(location.href);
            url.searchParams.set('game', game.id);
            history.replaceState(null, '', url.pathname + url.search + url.hash);
        }
    }
    function reset() {
        Object.assign(state, { query: '', year: '', sort: 'recent', status: 'all' });
        $('game-search').value = '';
        $('year-filter').value = '';
        $('sort-filter').value = 'recent';
        render();
    }
    function isDatasetValid(data) {
        return data && Array.isArray(data.games) && data.games.every(game => typeof game.id === 'string' && typeof game.title === 'string' && Array.isArray(game.dates) && game.dates.every(row => row.date === null || /^\d{4}-\d{2}-\d{2}$/.test(row.date)));
    }
    async function load() {
        $('load-error').hidden = true;
        $('games').setAttribute('aria-busy', 'true');
        try {
            const response = await fetch('data/game-log.json?v=20261101', { cache: 'no-cache', credentials: 'omit' });
            if (!response.ok) throw new Error('Data unavailable');
            const next = await response.json();
            if (!isDatasetValid(next)) throw new Error('Invalid game records');
            dataset = next;
            const datedGames = dataset.games.filter(game => game.dates.some(row => row.date));
            const summary = $('archive-summary');
            summary.replaceChildren();
            for (const [label, count] of [['기록된 게임', dataset.games.length], ['날짜 있는 게임', datedGames.length]]) {
                const item = element('span', '', label);
                item.append(element('strong', '', `${count}`));
                summary.append(item);
            }
            summary.append(element('span', 'update-date', `기록 정리 ${formatDate(dataset.updatedAt || '2026-10-28')}`));
            const years = [...new Set(dataset.games.flatMap(game => game.dates.map(row => row.date?.slice(0, 4))).filter(Boolean))].sort().reverse();
            $('year-filter').replaceChildren(new Option('전체 연도', ''), ...years.map(year => new Option(`${year}년`, year)));
            const hasVideoRecords = dataset.games.some(game => game.dates.some(record => record.confidence === 'video'));
            const sourceNote = hasVideoRecords ? '영상에서 확인한 날짜에는 해당 장면으로 이동하는 링크를 붙였습니다. 날짜는 한국 시간 기준이며, 자정을 넘긴 경우 방송 시작일도 함께 표시합니다.' : '날짜별 링크에서 캘린더·문서 출처를 확인할 수 있어요.';
            $('source-info').replaceChildren(element('p', '', `기록: 제공된 나무위키 문서, 비드요 캘린더${hasVideoRecords ? ', SOOP 방송 영상의 확인 장면' : ''}. ${sourceNote}`), element('p', '', '이미지: 공식 스토어 및 제작사·배급사 공개 자료. 게임별 공식 페이지는 상세 화면에서 확인할 수 있어요. 이미지가 확보되지 않은 게임은 이름으로 표시합니다.'));
            if (dataset.videoReview) {
                const review = dataset.videoReview;
                $('source-info').append(element('p', '', `영상 검토 범위: ${review.period || '방송국 공개 영상'}. 목록 ${review.totalVods}개 중 공개 영상 ${review.reviewedVods}개의 장면 표본을 확인했습니다. ${review.pendingVods ? `아직 검토 중이거나 남은 영상은 ${review.pendingVods}개입니다. ` : ''}열람 제한 ${review.restrictedVods}개${review.unavailableVods ? `, 공개 재생 불가 ${review.unavailableVods}개` : ''}는 확인하지 못했습니다.`));
                $('source-info').append(element('p', '', '검토 방법: 공개 파일 전체 구간의 1분 간격 표본과 15초 비교로 추린 변화 장면을 살펴보고, 게임 식별이 필요한 부분은 원본 프레임으로 대조합니다. 전편 연속 재생·음성 검토는 아니며, 삭제된 부분과 표본 사이의 짧은 플레이는 확인되지 않을 수 있습니다. 장면을 준비한 것과 직접 확인한 결과는 검토 기록에서 구분합니다.'));
                const auditLink = element('a', '', '영상별 검토 기록 보기 ↗');
                auditLink.href = 'data/game-log-vod-audit.json';
                auditLink.target = '_blank';
                auditLink.rel = 'noopener noreferrer';
                const auditRow = element('p');
                auditRow.append(auditLink);
                $('source-info').append(auditRow);
            }
            render();
            const selected = dataset.games.find(game => game.id === params.get('game'));
            if (selected) openDetail(selected, null, false);
        } catch {
            $('archive-summary').textContent = '게임 기록장';
            $('games').replaceChildren();
            $('load-error').hidden = false;
            $('result-count').textContent = '';
        } finally { $('games').setAttribute('aria-busy', 'false'); }
    }
    $('game-search').addEventListener('input', event => { state.query = event.target.value; render(); });
    $('year-filter').addEventListener('change', event => {
        state.year = event.target.value;
        if (state.year && state.status === 'undated') state.status = 'all';
        render();
    });
    $('sort-filter').addEventListener('change', event => { state.sort = event.target.value; render(); });
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
        state.view = button.dataset.view === 'list' ? 'list' : 'grid';
        try { localStorage.setItem(VIEW_STORAGE_KEY, state.view); } catch {}
        render();
    }));
    document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
        state.status = button.dataset.status;
        if (state.status === 'undated') { state.year = ''; $('year-filter').value = ''; }
        render();
    }));
    $('reset-filters').addEventListener('click', reset);
    $('retry-load').addEventListener('click', load);
    $('close-detail').addEventListener('click', () => $('game-dialog').close());
    $('game-dialog').addEventListener('click', event => { if (event.target === $('game-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
    $('game-dialog').addEventListener('close', () => {
        document.body.classList.remove('detail-open');
        const url = new URL(location.href);
        url.searchParams.delete('game');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        returnFocus?.focus({ preventScroll: true });
    });
    load();
})();
