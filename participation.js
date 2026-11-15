// 참가 콘텐츠: 구슬요가 다른 분이 주최한 콘텐츠에 참가한 이력
(function () {
    'use strict';
    const R = window.BeadyoRecords;
    const { $, db, el } = R;
    const TABLE = 'participation_entries';
    const CATEGORIES = ['왁타버스', 'VR', '마인크래프트', '기타 게임', 'SOOP 콘텐츠'];
    const state = { rows: [], category: '', year: '', query: '', isEditor: false, editingId: null, saving: false };
    const currentView = R.viewToggle($('view-toggle'), 'beadyo:participation-view', () => render());

    const pad = n => String(n).padStart(2, '0');
    const whenLabel = row => row.event_date
        ? row.event_date.replace(/-/g, '.')
        : row.month ? `${row.year}.${pad(row.month)}` : `${row.year}`;

    function sortRows(rows) {
        return rows.slice().sort((a, b) => (b.year - a.year)
            || ((b.month || 0) - (a.month || 0))
            || String(b.event_date || '').localeCompare(String(a.event_date || ''))
            || String(a.created_at).localeCompare(String(b.created_at)));
    }
    function filtered() {
        const q = state.query.trim().toLowerCase();
        return state.rows.filter(row => (!state.category || row.category === state.category)
            && (!state.year || String(row.year) === state.year)
            && (!q || [row.title, row.team, row.host, row.result, row.nickname, row.role].some(v => String(v || '').toLowerCase().includes(q))));
    }

    function renderSummary() {
        const box = $('summary');
        const counts = CATEGORIES.map(c => [c, state.rows.filter(r => r.category === c).length]).filter(([, n]) => n);
        const total = el('span', '', '전체');
        total.append(el('strong', '', `${state.rows.length}건`));
        box.replaceChildren(total);
        counts.forEach(([name, n]) => {
            box.append(el('span', 'summary-divider'));
            const span = el('span', '', name);
            span.append(el('strong', '', String(n)));
            box.append(span);
        });
    }
    function renderFilters() {
        const chips = [['', '전체'], ...CATEGORIES.map(c => [c, c])].map(([value, label]) => {
            const button = el('button', 'filter-chip', label);
            button.type = 'button';
            button.setAttribute('aria-pressed', String(state.category === value));
            button.addEventListener('click', () => { state.category = value; renderFilters(); render(); });
            return button;
        });
        $('category-filter').replaceChildren(...chips);
        const select = $('year-filter');
        const years = [...new Set(state.rows.map(r => r.year))].sort((a, b) => b - a);
        const current = state.year;
        select.replaceChildren(el('option', '', '전체 연도'), ...years.map(y => el('option', '', `${y}년`)));
        select.options[0].value = '';
        years.forEach((y, i) => { select.options[i + 1].value = String(y); });
        select.value = current;
    }

    function fallbackArt(row) {
        const art = el('div', 'record-fallback');
        art.setAttribute('aria-hidden', 'true');
        art.dataset.category = row.category;
        art.append(el('span', '', row.category));
        return art;
    }
    // 대표 장면: 다시보기가 있으면 누르면 다시보기로 이동
    function media(row) {
        const image = R.sitePath(row.image_url);
        if (!image) return fallbackArt(row);
        const img = el('img', 'record-image');
        img.src = image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { (img.closest('a') || img).replaceWith(fallbackArt(row)); }, { once: true });
        const replay = R.link(row.replay_url, '', 'record-image-link');
        if (replay) { replay.setAttribute('aria-label', `${row.title} 다시보기`); replay.append(img); }
        return replay || img;
    }
    function metaLine(row) {
        const top = el('div', 'record-meta');
        top.append(el('time', 'record-when', whenLabel(row)), el('span', 'category-chip', row.category));
        if (row.tags?.length) row.tags.filter(t => t !== row.category).forEach(t => top.append(el('span', 'tag-chip', t)));
        return top;
    }
    function linkBox(row, replayLabel) {
        const links = el('div', 'record-links');
        [R.link(row.replay_url, replayLabel),
            ...(Array.isArray(row.result_links) ? row.result_links : []).map(l => R.link(l?.url, l?.label || '링크'))]
            .filter(Boolean).forEach(a => links.append(a));
        if (state.isEditor) {
            const edit = el('button', 'record-edit', '수정');
            edit.type = 'button';
            edit.addEventListener('click', () => openEditor(row));
            links.append(edit);
        }
        return links;
    }
    function card(row) {
        const item = el('article', 'record-card has-image');
        item.append(media(row), metaLine(row), el('h3', 'record-title', row.title));
        const facts = el('dl', 'record-facts');
        [['팀', row.team], ['역할', row.role], ['닉네임', row.nickname], ['주최', row.host]].forEach(([k, v]) => {
            if (!v) return;
            facts.append(el('dt', '', k), el('dd', '', v));
        });
        if (facts.childElementCount) item.append(facts);
        if (row.result) item.append(el('p', 'record-result', row.result));
        if (row.notes) item.append(el('p', 'record-note', row.notes));
        const links = linkBox(row, '▶ 다시보기');
        if (links.childElementCount) item.append(links);
        return item;
    }
    function listRow(row) {
        const item = el('article', 'record-row');
        const thumb = el('div', 'record-thumb');
        thumb.append(media(row));
        const main = el('div', 'record-row-main');
        main.append(metaLine(row), el('h3', 'record-title', row.title));
        const detail = [row.team && `팀 ${row.team}`, row.role, row.result && row.result.split('\n')[0]].filter(Boolean).join(' · ');
        if (detail) main.append(el('p', 'record-row-detail', detail));
        item.append(thumb, main);
        const links = linkBox(row, '다시보기');
        if (links.childElementCount) item.append(links);
        return item;
    }
    function render() {
        const list = filtered();
        const host = $('records');
        host.setAttribute('aria-busy', 'false');
        $('empty').hidden = list.length > 0 || state.rows.length === 0;
        $('result-count').textContent = state.rows.length ? `${list.length}건` : '';
        const groups = new Map();
        sortRows(list).forEach(row => { if (!groups.has(row.year)) groups.set(row.year, []); groups.get(row.year).push(row); });
        host.replaceChildren(...[...groups].map(([year, rows]) => {
            const section = el('section', 'record-year');
            const head = el('div', 'year-head');
            head.append(el('h2', '', `${year}`), el('span', 'year-count', `${rows.length}건`));
            const listView = currentView() === 'list';
            const grid = el('div', listView ? 'record-list' : 'record-grid');
            rows.forEach(r => grid.append(listView ? listRow(r) : card(r)));
            section.append(head, grid);
            return section;
        }));
        if (!state.rows.length) host.replaceChildren(Object.assign(el('div', 'empty-state'), { textContent: '아직 등록된 참가 기록이 없어요.' }));
    }

    async function load() {
        $('load-error').hidden = true;
        $('records').setAttribute('aria-busy', 'true');
        if (!db) { $('load-error').hidden = false; return; }
        const { data, error } = await db.from(TABLE).select('*').order('year', { ascending: false });
        if (error) { console.error(TABLE, error); $('load-error').hidden = false; $('summary').replaceChildren(el('span', '', '기록을 불러오지 못했어요.')); return; }
        state.rows = data || [];
        renderSummary();
        renderFilters();
        render();
        $('copy-btn').hidden = state.rows.length === 0;
    }

    function copyList() {
        const lines = sortRows(filtered()).reverse().map(r => {
            const team = r.team ? ` (${r.team})` : '';
            const result = r.result ? ` - ${r.result.replace(/\s*\n\s*/g, ' ')}` : '';
            return `${whenLabel(r)} ${r.title}${team}${result}`;
        });
        R.copyText(lines.join('\n')).then(ok => notice(ok ? `${lines.length}건을 복사했어요. 지원서에 붙여넣으세요.` : '복사하지 못했어요. 브라우저 권한을 확인해 주세요.'));
    }
    let noticeTimer;
    function notice(text) {
        const box = $('notice');
        box.textContent = text;
        box.hidden = false;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { box.hidden = true; }, 4000);
    }

    // ── 편집 ──
    const form = () => $('edit-form');
    function linksToText(links) { return (Array.isArray(links) ? links : []).map(l => `${l.label || '링크'} | ${l.url}`).join('\n'); }
    function textToLinks(text) {
        return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
            const bar = line.lastIndexOf('|');
            const label = bar >= 0 ? line.slice(0, bar).trim() : '링크';
            const url = R.urlOrNull(bar >= 0 ? line.slice(bar + 1) : line, '결과 링크');
            return { label: (label || '링크').slice(0, 40), url };
        }).slice(0, 10);
    }
    function openEditor(row) {
        if (!state.isEditor) return;
        state.editingId = row?.id || null;
        const f = form();
        f.reset();
        f.category.replaceChildren(...CATEGORIES.map(c => el('option', '', c)));
        $('edit-title').textContent = row ? '참가 기록 수정' : '참가 기록 추가';
        $('delete-btn').hidden = !row;
        $('edit-message').textContent = '';
        const r = row || { year: new Date().getFullYear(), month: new Date().getMonth() + 1, category: state.category || '왁타버스' };
        ['title', 'category', 'host', 'year', 'month', 'event_date', 'team', 'role', 'nickname', 'result', 'replay_url', 'image_url', 'notes']
            .forEach(k => { f[k].value = r[k] ?? ''; });
        f.result_links.value = linksToText(r.result_links);
        $('edit-dialog').showModal();
        f.title.focus();
    }
    function payload() {
        const f = form();
        const title = R.trimOrNull(f.title.value, 200);
        if (!title) throw new Error('콘텐츠명을 입력해 주세요.');
        if (!CATEGORIES.includes(f.category.value)) throw new Error('분류를 골라 주세요.');
        const year = Number(f.year.value);
        if (!Number.isInteger(year) || year < 2015 || year > 2100) throw new Error('연도를 확인해 주세요.');
        const month = f.month.value === '' ? null : Number(f.month.value);
        if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) throw new Error('월은 1~12 사이로 입력해 주세요.');
        const eventDate = f.event_date.value || null;
        const existing = state.rows.find(r => r.id === state.editingId);
        return {
            title, category: f.category.value, year, month, event_date: eventDate,
            tags: existing?.tags || [],
            host: R.trimOrNull(f.host.value, 120), team: R.trimOrNull(f.team.value, 120),
            role: R.trimOrNull(f.role.value, 200), nickname: R.trimOrNull(f.nickname.value, 120),
            result: R.trimOrNull(f.result.value, 2000), notes: R.trimOrNull(f.notes.value, 2000),
            application_url: existing?.application_url ?? null,
            replay_url: R.urlOrNull(f.replay_url.value, '다시보기 주소'),
            image_url: R.urlOrNull(f.image_url.value, '썸네일 이미지 주소'),
            result_links: textToLinks(f.result_links.value),
        };
    }
    async function save(event) {
        event.preventDefault();
        if (!state.isEditor || state.saving) return;
        let body;
        try { body = payload(); } catch (error) { $('edit-message').textContent = error.message; return; }
        state.saving = true;
        $('save-btn').disabled = true;
        const request = state.editingId
            ? db.from(TABLE).update(body).eq('id', state.editingId).select().single()
            : db.from(TABLE).insert(body).select().single();
        const { error } = await request;
        state.saving = false;
        $('save-btn').disabled = false;
        if (error) { console.error(error); $('edit-message').textContent = '저장하지 못했어요. 편집 권한과 입력값을 확인해 주세요.'; return; }
        $('edit-dialog').close();
        notice(state.editingId ? '수정했어요.' : '추가했어요.');
        await load();
    }
    async function remove() {
        const row = state.rows.find(r => r.id === state.editingId);
        if (!row || !state.isEditor || state.saving) return;
        if (!confirm(`'${row.title}' 기록을 삭제할까요? 되돌릴 수 없어요.`)) return;
        state.saving = true;
        const { error } = await db.from(TABLE).delete().eq('id', row.id);
        state.saving = false;
        if (error) { $('edit-message').textContent = '삭제하지 못했어요.'; return; }
        $('edit-dialog').close();
        notice('삭제했어요.');
        await load();
    }

    $('search').addEventListener('input', e => { state.query = e.target.value; render(); });
    $('year-filter').addEventListener('change', e => { state.year = e.target.value; render(); });
    $('reset').addEventListener('click', () => { state.query = ''; state.category = ''; state.year = ''; $('search').value = ''; renderFilters(); render(); });
    $('retry').addEventListener('click', load);
    $('copy-btn').addEventListener('click', copyList);
    $('add-btn').addEventListener('click', () => openEditor(null));
    $('close-edit').addEventListener('click', () => $('edit-dialog').close());
    $('cancel-edit').addEventListener('click', () => $('edit-dialog').close());
    $('delete-btn').addEventListener('click', remove);
    form().addEventListener('submit', save);

    R.watchEditor(allowed => {
        const changed = state.isEditor !== allowed;
        state.isEditor = allowed;
        $('add-btn').hidden = !allowed;
        if (!allowed && $('edit-dialog').open && !state.saving) $('edit-dialog').close();
        if (changed && state.rows.length) render();
    });
    load();
})();
