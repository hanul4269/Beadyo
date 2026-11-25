// 같이 본 작품: 방송에서 함께 본 영화·애니메이션·드라마·예능
(function () {
    'use strict';
    const R = window.BeadyoRecords;
    const { $, db, el } = R;
    const TABLE = 'watchlist_entries';
    const KINDS = ['영화', '애니메이션', '드라마', '예능', '기타'];
    const UNDATED = '날짜 미확인';
    const state = { rows: [], kind: '', year: '', query: '', isEditor: false, editingId: null, saving: false };
    const currentView = R.viewToggle($('view-toggle'), 'beadyo:watchlist-view', () => render());

    const yearOf = row => row.watched_date ? row.watched_date.slice(0, 4) : UNDATED;
    function sortRows(rows) {
        return rows.slice().sort((a, b) => String(b.watched_date || '').localeCompare(String(a.watched_date || ''))
            || String(b.created_at).localeCompare(String(a.created_at)));
    }
    function filtered() {
        const q = state.query.trim().toLowerCase();
        return state.rows.filter(r => (!state.kind || r.kind === state.kind)
            && (!state.year || yearOf(r) === state.year)
            && (!q || [r.title, r.review].some(v => String(v || '').toLowerCase().includes(q))));
    }

    function renderSummary() {
        const total = el('span', '', '지금까지 함께 본 작품');
        total.append(el('strong', '', `${state.rows.length}편`));
        $('summary').replaceChildren(total);
        const stats = $('stats');
        stats.hidden = state.rows.length === 0;
        const years = [...new Set(state.rows.map(yearOf).filter(y => y !== UNDATED))];
        stats.replaceChildren(...[
            ...KINDS.map(k => [k, state.rows.filter(r => r.kind === k).length]).filter(([, n]) => n),
            ...(years.length ? [['함께한 해', years.length]] : []),
        ].map(([label, n]) => {
            const box = el('div', 'watch-stat');
            box.append(el('strong', '', String(n)), el('span', '', label));
            return box;
        }));
    }
    function renderFilters() {
        const usedKinds = KINDS.filter(k => k === state.kind || state.rows.some(r => r.kind === k));
        $('kind-filter').replaceChildren(...[['', '전체'], ...usedKinds.map(k => [k, k])].map(([value, label]) => {
            const b = el('button', 'filter-chip', label);
            b.type = 'button';
            b.setAttribute('aria-pressed', String(state.kind === value));
            b.addEventListener('click', () => { state.kind = value; renderFilters(); render(); });
            return b;
        }));
        const years = [...new Set(state.rows.map(yearOf))].sort((a, b) => (a === UNDATED) - (b === UNDATED) || b.localeCompare(a));
        const select = $('year-filter');
        const current = state.year;
        select.replaceChildren(el('option', '', '전체 연도'), ...years.map(y => el('option', '', y === UNDATED ? y : `${y}년`)));
        select.options[0].value = '';
        years.forEach((y, i) => { select.options[i + 1].value = y; });
        select.value = current;
    }
    const dateLabel = r => r.watched_date ? r.watched_date.replace(/-/g, '.') : '날짜 미확인';
    function poster(r) {
        const image = R.sitePath(r.image_url);
        const fallback = () => {
            const art = el('div', 'poster-fallback');
            art.setAttribute('aria-hidden', 'true');
            art.dataset.kind = r.kind;
            art.append(el('span', '', r.kind));
            return art;
        };
        if (!image) return fallback();
        const img = el('img', 'poster-image');
        img.src = image; img.alt = `${r.title} 포스터`; img.loading = 'lazy'; img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
        return img;
    }
    function subLine(r, withKind) {
        const sub = el('div', 'watch-sub');
        if (withKind) sub.append(el('span', 'category-chip', r.kind));
        if (r.episodes) sub.append(el('span', '', r.episodes));
        return sub;
    }
    // 후기: 접어 두었다가 '후기 보기'를 누르면 줄바꿈 그대로 펼쳐 보여 준다.
    function reviewBlock(r) {
        const text = typeof r.review === 'string' ? r.review.trim() : '';
        if (!text) return null;
        const box = el('details', 'watch-review');
        const summary = el('summary', '', '후기 보기');
        box.append(summary, el('p', 'watch-review-text', text));
        box.addEventListener('toggle', () => { summary.textContent = box.open ? '후기 접기' : '후기 보기'; });
        return box;
    }
    function editButton(r) {
        if (!state.isEditor) return null;
        const edit = el('button', 'record-edit', '수정');
        edit.type = 'button';
        edit.addEventListener('click', () => openEditor(r));
        return edit;
    }
    // 편집자에게는 포스터(썸네일) 자체가 '수정' 버튼이 된다. 방문자에게는 그냥 그림이다.
    function artBox(r, className) {
        if (!state.isEditor) return el('div', className);
        const button = el('button', `${className} art-edit`);
        button.type = 'button';
        button.setAttribute('aria-label', `'${r.title}' 수정`);
        button.addEventListener('click', () => openEditor(r));
        return button;
    }
    function card(r) {
        const item = el('article', 'poster-card');
        const art = artBox(r, 'poster-frame');
        art.append(poster(r), el('span', 'poster-kind', r.kind));
        if (state.isEditor) art.append(el('span', 'art-edit-hint', '수정'));
        const body = el('div', 'poster-body');
        body.append(el('h3', 'poster-title', r.title));
        const when = el('time', 'poster-date', dateLabel(r));
        if (r.watched_date) when.dateTime = r.watched_date;
        body.append(when);
        if (r.episodes) body.append(subLine(r, false));
        const review = reviewBlock(r);
        if (review) body.append(review);
        const edit = editButton(r);
        if (edit) {
            // 내용 길이와 상관없이 카드 맨 아래 같은 자리에 둔다.
            const actions = el('div', 'poster-actions');
            actions.append(edit);
            body.append(actions);
        }
        item.append(art, body);
        return item;
    }
    function row(r) {
        const item = el('article', 'watch-row');
        const thumb = artBox(r, 'watch-thumb');
        thumb.append(poster(r));
        const when = el('time', 'watch-date', dateLabel(r));
        if (r.watched_date) when.dateTime = r.watched_date;
        const main = el('div', 'watch-main');
        main.append(el('h3', 'watch-title', r.title), subLine(r, true));
        const review = reviewBlock(r);
        if (review) main.append(review);
        item.append(thumb, when, main);
        const edit = editButton(r);
        if (edit) { const actions = el('div', 'watch-actions'); actions.append(edit); item.append(actions); }
        return item;
    }
    function render() {
        const host = $('records');
        host.setAttribute('aria-busy', 'false');
        if (!state.rows.length) {
            $('empty').hidden = true;
            const empty = el('div', 'empty-state');
            empty.append(el('h2', '', '아직 등록된 작품이 없어요'), el('p', '', state.isEditor ? '‘+ 작품 추가’로 첫 작품을 남겨보세요.' : '함께 본 작품이 곧 채워질 거예요.'));
            host.replaceChildren(empty);
            return;
        }
        const list = sortRows(filtered());
        $('empty').hidden = list.length > 0;
        $('result-count').textContent = `${list.length}편`;
        const listView = currentView() === 'list';
        const groups = new Map();
        list.forEach(r => { const y = yearOf(r); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(r); });
        const ordered = [...groups].sort(([a], [b]) => (a === UNDATED) - (b === UNDATED) || b.localeCompare(a));
        host.replaceChildren(...ordered.map(([year, rows]) => {
            const section = el('section', 'record-year');
            const head = el('div', 'year-head');
            head.append(el('h2', '', year), el('span', 'year-count', `${rows.length}편`));
            const listBox = el('div', listView ? 'watch-list' : 'poster-grid');
            rows.forEach(r => listBox.append(listView ? row(r) : card(r)));
            section.append(head, listBox);
            return section;
        }));
    }
    async function load() {
        $('load-error').hidden = true;
        if (!db) { $('load-error').hidden = false; return; }
        const { data, error } = await db.from(TABLE).select('*').order('watched_date', { ascending: false, nullsFirst: false });
        if (error) { console.error(TABLE, error); $('load-error').hidden = false; $('summary').replaceChildren(el('span', '', '기록을 불러오지 못했어요.')); return; }
        state.rows = data || [];
        renderSummary();
        renderFilters();
        render();
    }

    let noticeTimer;
    function notice(text) {
        const box = $('notice');
        box.textContent = text;
        box.hidden = false;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { box.hidden = true; }, 4000);
    }
    const form = () => $('edit-form');
    function openEditor(r) {
        if (!state.isEditor) return;
        state.editingId = r?.id || null;
        const f = form();
        f.reset();
        $('edit-title').textContent = r ? '작품 수정' : '작품 추가';
        $('delete-btn').hidden = !r;
        $('edit-message').textContent = '';
        const v = r || { kind: state.kind || '영화' };
        ['title', 'kind', 'watched_date', 'episodes', 'image_url', 'review'].forEach(k => { f[k].value = v[k] ?? ''; });
        $('edit-dialog').showModal();
        f.title.focus();
    }
    // 후기는 줄바꿈을 살리고 앞뒤 공백만 정리한다. 빈 칸이면 저장하지 않음(null).
    function reviewText(value) {
        const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
        if (text.length > 2000) throw new Error('후기는 2000자 이내로 써 주세요.');
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('후기에 쓸 수 없는 문자가 있어요.');
        return text || null;
    }
    function payload() {
        const f = form();
        const title = R.trimOrNull(f.title.value, 200);
        if (!title) throw new Error('작품 제목을 입력해 주세요.');
        if (!KINDS.includes(f.kind.value)) throw new Error('종류를 골라 주세요.');
        return {
            title, kind: f.kind.value, watched_date: f.watched_date.value || null,
            // '한 줄 메모'(notes)는 2026-11-26에 화면에서 뺐다. 저장할 때 보내지 않으므로 DB의 기존 값은 그대로 남는다.
            episodes: R.trimOrNull(f.episodes.value, 60),
            review: reviewText(f.review.value),
            image_url: R.urlOrNull(f.image_url.value, '포스터 이미지 주소'),
        };
    }
    async function save(event) {
        event.preventDefault();
        if (!state.isEditor || state.saving) return;
        let body;
        try { body = payload(); } catch (error) { $('edit-message').textContent = error.message; return; }
        state.saving = true;
        $('save-btn').disabled = true;
        const { error } = await (state.editingId
            ? db.from(TABLE).update(body).eq('id', state.editingId).select().single()
            : db.from(TABLE).insert(body).select().single());
        state.saving = false;
        $('save-btn').disabled = false;
        if (error) { console.error(error); $('edit-message').textContent = '저장하지 못했어요. 편집 권한과 입력값을 확인해 주세요.'; return; }
        $('edit-dialog').close();
        notice(state.editingId ? '수정했어요.' : '추가했어요.');
        await load();
    }
    async function remove() {
        const r = state.rows.find(x => x.id === state.editingId);
        if (!r || !state.isEditor || state.saving) return;
        if (!confirm(`'${r.title}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
        state.saving = true;
        const { error } = await db.from(TABLE).delete().eq('id', r.id);
        state.saving = false;
        if (error) { $('edit-message').textContent = '삭제하지 못했어요.'; return; }
        $('edit-dialog').close();
        notice('삭제했어요.');
        await load();
    }

    $('search').addEventListener('input', e => { state.query = e.target.value; render(); });
    $('year-filter').addEventListener('change', e => { state.year = e.target.value; render(); });
    $('reset').addEventListener('click', () => { state.query = ''; state.kind = ''; state.year = ''; $('search').value = ''; renderFilters(); render(); });
    $('retry').addEventListener('click', load);
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
        if (changed) render();
    });
    load();
})();
