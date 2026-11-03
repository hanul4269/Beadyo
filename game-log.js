(function () {
    'use strict';
    const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[\s:：·.\-_'’!?]/g, '');
    const latest = game => game.dates.map(row => row.date).filter(Boolean).sort().at(-1) || '';
    const earliest = game => game.dates.map(row => row.date).filter(Boolean).sort()[0] || '';
    const matchesPeriod = (date, year = '', month = '') => Boolean(date) && (!year || date.slice(0, 4) === year) && (!month || date.slice(5, 7) === month);
    function summarizeDates(game, year = '', month = '') {
        const dates = [...new Set(game.dates.map(row => row.date).filter(date => matchesPeriod(date, year, month)))].sort();
        return { lastDate: dates.at(-1) || '', count: dates.length };
    }
    function sourceCaption(record) {
        if (record.confidence === 'manual') return record.sourceUrl ? '등록한 기록 보기 ↗' : '직접 등록';
        if (record.confidence === 'video') return '방송 영상에서 보기 ↗';
        if (record.confidence === 'calendar') return '캘린더에서 보기 ↗';
        return '나무위키 기록 ↗';
    }
    function filterGames(games, state) {
        const needle = normalize(state.query);
        return games.filter(game => {
            const dated = game.dates.some(row => row.date);
            return (!needle || [game.title, ...(game.aliases || [])].some(value => normalize(value).includes(needle)))
                && (!(state.year || state.month) || game.dates.some(row => matchesPeriod(row.date, state.year, state.month)))
                && (!state.genre || (state.genre === 'unclassified' ? !game.genres?.length : game.genres?.includes(state.genre)))
                && (state.status === 'all' || (state.status === 'dated' ? dated : !dated));
        }).sort((a, b) => {
            const nameOrder = a.title.localeCompare(b.title, 'ko');
            if (state.sort === 'name') return nameOrder;
            const scoped = game => state.year || state.month ? { dates: game.dates.filter(row => matchesPeriod(row.date, state.year, state.month)) } : game;
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
    const state = { query: '', year: '', month: '', genre: '', sort: 'recent', status: 'all', view: preferredView };
    let dataset = null;
    let genreCategories = [];
    let genresAvailable = false;
    let customRows = [];
    let customReady = false;
    let customReadFailed = false;
    let isEditor = false;
    let authGeneration = 0;
    let savingGame = false;
    let draftId = '';
    const Store = window.BeadyoGameStore;
    let db = null;
    try { db = window.getBeadyoSupabaseClient({ auth: { detectSessionInUrl: false, flowType: 'pkce' } }); } catch {}

    let returnFocus = null;
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme');
    try { document.documentElement.dataset.theme = theme === 'dark' || (!theme && localStorage.getItem('beadyo:theme') === 'dark') ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
    const embedded = window.self !== window.top;
    if (embedded) $('standalone-nav').hidden = true;
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== parent) return;
        if (event.data?.type === 'beadyo-theme-sync') document.documentElement.dataset.theme = event.data.theme === 'dark' ? 'dark' : 'light';
        if (event.data?.type === 'beadyo-auth-sync') void refreshEditorPermission();
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
        if (typeof value !== 'string' || !value.trim()) return '';
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
        image.alt = `${game.title} ${game.imageCredit?.label || '공식 게임 이미지'}`;
        if (game.imageFit === 'contain') image.classList.add('image-contained');
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
        const { lastDate, count } = summarizeDates(game, state.year, state.month);
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
        const { lastDate, count } = summarizeDates(game, state.year, state.month);
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
        syncFilterButtons();
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
        const dated = game.dates.filter(row => matchesPeriod(row.date, state.year, state.month)).sort((a, b) => b.date.localeCompare(a.date));
        const heading = element('div', 'detail-record-heading');
        heading.append(element('h3', '', state.year || state.month ? '선택한 기간의 플레이 날짜' : '기록된 플레이 날짜'), element('span', '', `${dated.length}개 기록`));
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
        if (game.isCustom && !game.dates.some(row => row.date)) {
            if (game.customNote) content.append(element('p', 'detail-note', game.customNote));
            const href = safeLink(game.customSourceUrl);
            if (game.customSourceUrl && href) {
                const source = element('a', 'source-label', '등록한 기록 보기 ↗');
                source.href = href;
                source.target = '_blank';
                source.rel = 'noopener noreferrer';
                content.append(source);
            }
        }
        content.append(element('p', 'detail-date-note', '확인된 자료에 남아 있는 날짜예요. 최초 플레이일이나 전체 플레이 횟수를 뜻하지는 않습니다.'));
        if (state.year || state.month) content.append(element('p', 'detail-date-note', '다른 기간의 기록은 연도·월 필터를 해제하면 볼 수 있어요.'));
        const imageSource = safeLink(game.imageCredit?.sourceUrl || '');
        const gameSource = safeLink(game.officialUrl || '');
        if (imageSource || gameSource) {
            const credit = element('div', 'image-credit');
            credit.append(element('span', '', game.imageCredit?.label || (game.image ? '이미지 © 해당 게임 제작사·배급사' : '게임 정보')));
            const link = element('a', '', imageSource ? '이미지 출처 ↗' : '공식 게임 페이지 ↗');
            link.href = imageSource || gameSource;
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
        Object.assign(state, { query: '', year: '', month: '', genre: '', sort: 'recent', status: 'all' });
        $('game-search').value = '';
        $('sort-filter').value = 'recent';
        render();
    }
    function isDatasetValid(data) {
        return data && Array.isArray(data.games) && data.games.every(game => typeof game.id === 'string' && typeof game.title === 'string' && Array.isArray(game.dates) && game.dates.every(row => row.date === null || /^\d{4}-\d{2}-\d{2}$/.test(row.date)));
    }
    function updateEditorControls() {
        $('add-game-btn').hidden = !isEditor;
        $('add-game-btn').disabled = !customReady || !dataset;
        $('custom-load-status').hidden = !customReadFailed;
        $('custom-load-status').textContent = customReadFailed ? '새로 등록한 게임을 불러오지 못했어요.' : '';
        $('retry-custom-games').hidden = !customReadFailed;
    }
    async function loadCustomRecords() {
        try {
            if (!db || !Store) throw new Error('게임 저장 연결 없음');
            const rows = await Store.readEntries(db);
            customRows = rows;
            customReady = true;
            customReadFailed = false;
        } catch {
            customReady = false;
            customReadFailed = true;
        }
        updateEditorControls();
    }
    async function authStep(request) {
        let timeout;
        try {
            return await Promise.race([request, new Promise(resolve => { timeout = setTimeout(() => resolve(null), 5000); })]);
        } catch { return null; }
        finally { clearTimeout(timeout); }
    }
    async function canEditNow() {
        if (!db) return false;
        try {
            const session = await authStep(db.auth.getSession());
            if (session?.error || !session?.data?.session?.user) return false;
            const permission = await authStep(db.rpc('is_beadyo_editor'));
            return !permission?.error && permission?.data === true;
        } catch { return false; }
    }
    async function refreshEditorPermission() {
        const generation = ++authGeneration;
        isEditor = false;
        updateEditorControls();
        const allowed = await canEditNow();
        if (generation !== authGeneration) return;
        isEditor = allowed;
        updateEditorControls();
        if (!isEditor && $('game-add-dialog').open && !savingGame) $('game-add-dialog').close();
    }
    async function initEditorAuth() {
        if (!db) return;
        try {
            db.auth.onAuthStateChange(() => { setTimeout(() => { void refreshEditorPermission(); }, 0); });
            await refreshEditorPermission();
        } catch { isEditor = false; updateEditorControls(); }
    }
    function renderGenreChoices() {
        $('new-game-genres').replaceChildren(...genreCategories.map(category => {
            const label = element('label');
            const input = element('input');
            input.type = 'checkbox';
            input.name = 'genres';
            input.value = category.id;
            label.append(input, element('span', '', category.label));
            return label;
        }));
    }
    function openAddGame() {
        if (!isEditor || !customReady || !dataset || savingGame) return;
        $('game-add-form').reset();
        $('game-add-message').textContent = '';
        $('new-game-date').value = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        draftId = crypto.randomUUID();
        $('game-add-dialog').showModal();
        document.body.classList.add('detail-open');
    }
    async function saveNewGame(event) {
        event.preventDefault();
        if (savingGame || !isEditor || !customReady || !Store || !dataset) return;
        const message = $('game-add-message');
        let payload;
        try {
            payload = Store.buildPayload({
                title: $('new-game-title').value,
                played_date: $('new-game-date').value,
                genres: [...$('new-game-genres').querySelectorAll('input:checked')].map(input => input.value),
                official_url: $('new-game-official').value,
                source_url: $('new-game-source').value,
                notes: $('new-game-notes').value,
            }, dataset.games, genreCategories, draftId);
        } catch (error) { message.textContent = error.message; return; }
        savingGame = true;
        message.textContent = '';
        $('game-add-fields').disabled = true;
        for (const id of ['save-new-game', 'cancel-new-game', 'close-add-game']) $(id).disabled = true;
        $('save-new-game').textContent = '저장 중…';
        try {
            if (!await canEditNow()) throw new Error('편집 권한을 확인하지 못했어요. 로그인 상태를 확인하고 다시 시도해 주세요.');
            const saved = await Store.addEntry(db, payload);
            customRows = [...customRows.filter(row => row.id !== saved.id), saved];
            const game = Store.rowToGame(saved);
            dataset = { ...dataset, games: [...dataset.games.filter(item => item.id !== game.id), game] };
            reset();
            syncCatalogControls();
            state.query = game.title;
            $('game-search').value = game.title;
            render();
            $('game-add-dialog').close();
            $('game-save-notice').textContent = '새 게임을 추가했어요.';
            $('game-save-notice').hidden = false;
        } catch (error) {
            message.textContent = ['23505', 'DUPLICATE'].includes(error.code) ? '이미 등록된 게임 이름이에요. 목록에서 먼저 확인해 주세요.' : error.message || '저장하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.';
        } finally {
            savingGame = false;
            $('game-add-fields').disabled = false;
            for (const id of ['save-new-game', 'cancel-new-game', 'close-add-game']) $(id).disabled = false;
            $('save-new-game').textContent = '게임 추가';
        }
    }
    function syncCatalogControls() {
        if (!dataset) return;
        const genresUsed = new Set(dataset.games.flatMap(game => game.genres));
        if (!genresAvailable) state.genre = '';
        const allGenres = filterButton('genre', '', genresAvailable ? '전체 장르' : '장르 불러오기 실패');
        allGenres.disabled = !genresAvailable;
        $('genre-filter').replaceChildren(allGenres, ...genreCategories.filter(category => genresUsed.has(category.id)).map(category => filterButton('genre', category.id, category.label)));
        if (genresAvailable && dataset.games.some(game => !game.genres.length)) $('genre-filter').append(filterButton('genre', 'unclassified', '장르 미분류'));
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
        $('year-filter').replaceChildren(filterButton('year', '', '전체 연도'), ...years.map(year => filterButton('year', year, `${year}년`)));
        syncFilterButtons();
    }
    function filterButton(key, value, label) {
        const button = element('button', 'filter-chip', label);
        button.type = 'button';
        button.dataset.filter = key;
        button.dataset.value = value;
        button.setAttribute('aria-pressed', String(state[key] === value));
        return button;
    }
    function syncFilterButtons() {
        document.querySelectorAll('.filter-chip[data-filter]').forEach(button => {
            button.setAttribute('aria-pressed', String(state[button.dataset.filter] === button.dataset.value));
        });
    }
    async function loadGenres() {
        const controller = new AbortController();
        let timeout;
        try {
            return await Promise.race([
                (async () => {
                    const response = await fetch('data/game-log-genres.json?v=filters-20261102', { cache: 'no-cache', credentials: 'omit', signal: controller.signal });
                    if (!response.ok) return null;
                    const data = await response.json();
                    if (!Array.isArray(data.categories) || !data.games || typeof data.games !== 'object') return null;
                    if (!data.categories.every(category => typeof category.id === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(category.id) && category.id !== 'unclassified' && typeof category.label === 'string')) return null;
                    return data;
                })(),
                new Promise(resolve => { timeout = setTimeout(() => { controller.abort(); resolve(null); }, 5000); }),
            ]);
        } catch { return null; }
        finally { clearTimeout(timeout); }
    }
    async function load() {
        $('load-error').hidden = true;
        $('games').setAttribute('aria-busy', 'true');
        try {
            const [response, genreData] = await Promise.all([
                fetch('data/game-log.json?v=game-images-20261103', { cache: 'no-cache', credentials: 'omit' }),
                loadGenres(),
                loadCustomRecords(),
            ]);
            if (!response.ok) throw new Error('Data unavailable');
            const next = await response.json();
            if (!isDatasetValid(next)) throw new Error('Invalid game records');
            const categories = genreData?.categories || [];
            genreCategories = categories;
            genresAvailable = Boolean(genreData);
            renderGenreChoices();
            const categoryIds = new Set(categories.map(category => category.id));
            dataset = { ...next, games: next.games.map(game => {
                const genres = genreData?.games[game.id]?.genres;
                return { ...game, genres: Array.isArray(genres) ? [...new Set(genres.filter(genre => categoryIds.has(genre)))] : [] };
            }).concat(customRows.map(row => Store.rowToGame(row))) };
            syncCatalogControls();
            const hasVideoRecords = dataset.games.some(game => game.dates.some(record => record.confidence === 'video'));
            const sourceNote = hasVideoRecords ? '영상에서 확인한 날짜에는 해당 장면으로 이동하는 링크를 붙였습니다. 날짜는 한국 시간 기준이며, 자정을 넘긴 경우 방송 시작일도 함께 표시합니다.' : '날짜별 링크에서 캘린더·문서 출처를 확인할 수 있어요.';
            $('source-info').replaceChildren(element('p', '', `기록: 제공된 나무위키 문서, 비드요 캘린더${hasVideoRecords ? ', SOOP 방송 영상의 확인 장면' : ''}. ${sourceNote}`), element('p', '', '이미지: 공식 스토어·제작사 자료, 보존 아카이브의 원게임 화면, 게임 표지 및 실제 방송 플레이 화면을 사용합니다. 종류와 출처는 각 게임의 상세 화면에서 확인할 수 있어요. 권리는 각 권리자에게 있으며, 이미지가 없는 새 등록 게임은 이름으로 표시합니다.'));
            $('source-info').append(element('p', '', genreData ? '장르: 기존 게임은 공식 스토어·제작사 페이지의 장르와 태그를 검색용으로 묶었으며, 새 게임은 등록자가 선택한 장르로 표시합니다. 여러 장르에 포함될 수 있으며 확인되지 않은 게임은 장르 미분류로 표시합니다.' : '장르 정보를 불러오지 못했어요. 새로고침하면 다시 시도합니다.'));
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
        } finally { $('games').setAttribute('aria-busy', 'false'); updateEditorControls(); }
    }
    $('game-search').addEventListener('input', event => { state.query = event.target.value; render(); });
    $('month-filter').replaceChildren(filterButton('month', '', '전체 월'), ...Array.from({ length: 12 }, (_, i) => filterButton('month', String(i + 1).padStart(2, '0'), `${i + 1}월`)));
    for (const key of ['year', 'month', 'genre']) {
        $(`${key}-filter`).addEventListener('click', event => {
            const button = event.target.closest('button[data-filter]');
            if (!button || button.disabled || button.dataset.filter !== key) return;
            state[key] = state[key] === button.dataset.value ? '' : button.dataset.value;
            if ((key === 'year' || key === 'month') && (state.year || state.month) && state.status === 'undated') state.status = 'all';
            render();
        });
    }
    $('sort-filter').addEventListener('change', event => { state.sort = event.target.value; render(); });
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
        state.view = button.dataset.view === 'list' ? 'list' : 'grid';
        try { localStorage.setItem(VIEW_STORAGE_KEY, state.view); } catch {}
        render();
    }));
    document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
        state.status = button.dataset.status;
        if (state.status === 'undated') { state.year = ''; state.month = ''; }
        render();
    }));
    $('reset-filters').addEventListener('click', reset);
    $('retry-load').addEventListener('click', load);
    $('retry-custom-games').addEventListener('click', load);
    $('add-game-btn').addEventListener('click', openAddGame);
    $('game-add-form').addEventListener('submit', saveNewGame);
    $('game-add-form').addEventListener('input', () => { if (!savingGame) $('game-add-message').textContent = ''; });
    for (const id of ['cancel-new-game', 'close-add-game']) $(id).addEventListener('click', () => { if (!savingGame) $('game-add-dialog').close(); });
    $('game-add-dialog').addEventListener('cancel', event => { if (savingGame) event.preventDefault(); });
    $('game-add-dialog').addEventListener('close', () => {
        document.body.classList.remove('detail-open');
        if (isEditor) $('add-game-btn').focus({ preventScroll: true });
    });
    $('close-detail').addEventListener('click', () => $('game-dialog').close());
    $('game-dialog').addEventListener('click', event => { if (event.target === $('game-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
    $('game-dialog').addEventListener('close', () => {
        document.body.classList.remove('detail-open');
        const url = new URL(location.href);
        url.searchParams.delete('game');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        returnFocus?.focus({ preventScroll: true });
    });
    initEditorAuth();
    load();
})();
