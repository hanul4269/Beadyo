(function () {
    'use strict';
    const D = window.BeadyoMonthlyData, E = window.BeadyoExplore, C = window.BeadyoCommon;
    const esc = C.esc;
    const cache = new Map(), pending = new Map();
    let mounted = false, dialog, summary, body, picker, generation = 0, lastFocused;
    const titles = { live:'노래 기록', music:'음악 · 커버 영상', content:'등록 콘텐츠' };
    async function read(month, force = false) {
        const key = month + ':' + D.dayKey();
        if (!force && cache.has(key) && Date.now() - cache.get(key).at < 300000) return cache.get(key).data;
        if (pending.has(key)) return pending.get(key);
        const { start, end } = D.bounds(month);
        const task = (async () => {
            const results = await Promise.allSettled([
                E.deadline(E.readAll('live_songs', 'id,title,artist,performed_date,clip_url,exclude_from_stats', `&performed_date=gte.${start}&performed_date=lte.${end}`)),
                E.deadline(E.readAll('youtube_songs', 'id,title,type,upload_date,youtube_url,created_at')),
                E.deadline(E.readAll('content_archive', 'id,title,summary,broadcast_date,cast_members,created_at')),
            ]);
            const data = {};
            ['live','music','content'].forEach((name, i) => {
                const result = results[i];
                data[name] = result.status === 'fulfilled' ? { status:'success', rows:D.select(result.value, {live:'performed_date', music:'upload_date', content:'broadcast_date'}[name], month, D.dayKey(), name === 'live') } : { status:'error' };
            });
            if (results.every(result => result.status === 'fulfilled')) cache.set(key, { at:Date.now(), data });
            return data;
        })().finally(() => pending.delete(key));
        pending.set(key, task); return task;
    }
    function counts(data) {
        return Object.keys(titles).map(key => `<span><strong>${data[key].status === 'success' ? data[key].rows.length.toLocaleString('ko-KR')+'건' : '확인 불가'}</strong> ${titles[key]}</span>`).join('');
    }
    function basis(row, label) { return row.basis === 'registered' ? `${row.date} · 등록 시각 기준 (${label} 미등록)` : `${row.date} · ${label} 기준`; }
    function local(href, label) { return `<a class="home-link" href="${esc(href)}">${esc(label)} →</a>`; }
    function original(href, label) { const safe = C.safeUrl(href, ''); return safe ? `<a class="home-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : ''; }
    function list(key, state) {
        if (state.status !== 'success') return '<p class="home-state home-error">자료를 확인하지 못했습니다.</p>';
        if (!state.rows.length) return '<p class="home-state">등록된 기록이 없습니다.</p>';
        return `<ul class="monthly-list">${state.rows.map(row => {
            let link, date;
            if (key === 'live') { link = original(row.clip_url, row.title) || local(`songbook.html?view=live&date=${row.date}`, row.title); date = basis(row, '부른 날짜'); }
            else if (key === 'music') { link = original(row.youtube_url, row.title) || local('index.html#music', row.title); date = basis(row, '공개일'); }
            else { link = local(`content.html?content=${encodeURIComponent(row.id)}`, [row.title, row.summary].filter(Boolean).join(' · ')); date = basis(row, '방송일'); }
            return `<li>${link}<small>${esc(date)}${key === 'music' ? ' · '+esc({original:'오리지널',cover:'커버',live:'라이브 영상'}[row.type] || '음악') : ''}${key === 'content' && Array.isArray(row.cast_members) && row.cast_members.length ? ' · 출연 '+esc(row.cast_members.join(', ')) : ''}</small></li>`;
        }).join('')}</ul>`;
    }
    function urlMonth(month) {
        const u = new URL(location.href); u.searchParams.delete('tab'); u.searchParams.set('month', month); u.hash = 'home';
        return u;
    }
    async function renderMonth(month) {
        const token = ++generation;
        picker.value = month;
        body.innerHTML = '<p class="home-state" role="status">월간 기록을 불러오는 중…</p>';
        const data = await read(month);
        if (token !== generation || !dialog.open) return;
        body.innerHTML = `<div class="monthly-counts">${counts(data)}</div>${['music','content','live'].map(key => key === 'live' ? `<section><details><summary>노래 기록 · 등록 행 목록 보기</summary>${list(key,data[key])}</details></section>` : `<section><h3>${titles[key]}</h3>${list(key,data[key])}</section>`).join('')}${Object.values(data).some(s => s.status === 'error') ? '<button class="home-action" type="button" data-month-retry>자료 다시 확인</button>' : ''}`;
        body.querySelector('[data-month-retry]')?.addEventListener('click', () => { cache.delete(month + ':' + D.dayKey()); void renderMonth(month); });
    }
    function open(month = D.dayKey().slice(0,7), update = true) {
        if (!D.validMonth(month) || month > D.dayKey().slice(0,7)) month = D.dayKey().slice(0,7);
        if (!dialog.open) { lastFocused = document.activeElement; dialog.showModal(); }
        if (update) { const u = urlMonth(month); history.replaceState(null, '', u.pathname + u.search + u.hash); }
        void renderMonth(month);
    }
    async function renderSummary() {
        const month = D.dayKey().slice(0,7);
        if (!summary.innerHTML) summary.innerHTML = '<p class="home-state" role="status">이번 달 기록을 불러오는 중…</p>';
        const data = await read(month);
        summary.innerHTML = `<p class="home-meta">${esc(month)} · 사이트에 등록된 기록 기준</p><div class="monthly-counts">${counts(data)}</div><a class="home-action home-primary" href="${esc(urlMonth(month).pathname + urlMonth(month).search + '#home')}" data-month-open>월간 돌아보기 →</a>`;
        summary.querySelector('[data-month-open]').addEventListener('click', event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); open(month); });
    }
    function mount(root) {
        if (mounted) return;
        mounted = true; summary = root.querySelector('#home-monthly');
        root.insertAdjacentHTML('beforeend', `<dialog class="monthly-dialog" aria-labelledby="monthly-title"><header class="monthly-head"><h2 id="monthly-title">월간 돌아보기</h2><button class="home-action" type="button" data-month-close aria-label="월간 돌아보기 닫기">닫기</button></header><p class="monthly-note">사이트에 등록된 기록 기준 · 한국 시간<br>노래는 부른 날짜, 음악은 공개일, 콘텐츠는 방송일을 기준으로 표시합니다. 활동 날짜가 없으면 등록 시각 기준임을 항목에 표시합니다. 예정된 일정과 미래 날짜는 포함하지 않습니다. 노래 기록은 방송 횟수나 시간을 의미하지 않습니다. 노래의 통계 제외 설정도 따릅니다.</p><div class="monthly-controls"><label>월 선택 <input type="month" id="monthly-picker" max="${D.dayKey().slice(0,7)}"></label><button class="home-action" type="button" data-month-share>이 달의 주소 복사</button><span class="monthly-share-state" role="status"></span></div><div id="monthly-body" aria-live="polite"></div></dialog>`);
        dialog = root.querySelector('.monthly-dialog'); body = root.querySelector('#monthly-body'); picker = root.querySelector('#monthly-picker');
        root.querySelector('[data-month-close]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { generation++; const u = new URL(location.href); u.searchParams.delete('month'); history.replaceState(null, '', u.pathname + u.search + u.hash); lastFocused?.focus?.(); });
        picker.addEventListener('change', () => { if (D.validMonth(picker.value)) open(picker.value); });
        root.querySelector('[data-month-share]').addEventListener('click', async () => { const state = root.querySelector('.monthly-share-state'); try { await navigator.clipboard.writeText(urlMonth(picker.value).href); state.textContent = '주소를 복사했습니다'; } catch { state.textContent = '주소창의 URL을 복사해 주세요'; } });
        window.addEventListener('popstate', () => { const month = new URLSearchParams(location.search).get('month'); if (month) open(month,false); else if (dialog.open) dialog.close(); });
        void renderSummary();
        const month = new URLSearchParams(location.search).get('month'); if (month) open(month);
    }
    window.BeadyoMonthly = Object.freeze({ mount, refresh:() => { if (mounted) void renderSummary(); } });
})();
