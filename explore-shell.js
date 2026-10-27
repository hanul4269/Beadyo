(function () {
    'use strict';
    const D = window.BeadyoExploreData;
    const E = window.BeadyoExplore;
    const esc = window.BeadyoCommon.esc;
    const more = document.getElementById('explore-more');
    const guide = document.getElementById('start-here');
    if (!D || !E || !more || !guide) return;
    const menuByIndex = index => D.menus.find(menu => menu.index === index);
    const primary = [7, 0, 2, 5];
    document.querySelectorAll('.tab[data-tab-index]').forEach(tab => {
        const menu = menuByIndex(Number(tab.dataset.tabIndex));
        if (menu) { tab.title = menu.description; tab.setAttribute('aria-description', menu.description); }
    });
    document.getElementById('explore-more-items').innerHTML = D.menus.filter(menu => !menu.hidden).map(menu =>
        `<button type="button" class="explore-menu-item" data-explore-tab="${menu.index}"><strong>${menu.label}</strong><span>${esc(menu.description)}</span></button>`).join('');
    function update(index) {
        const menu = menuByIndex(index);
        if (!menu) return;
        document.querySelectorAll('[data-explore-tab]').forEach(button => {
            const active = Number(button.dataset.exploreTab) === index;
            button.classList.toggle('active', active);
            if (active) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        const moreButton = document.getElementById('explore-more-toggle');
        const isMore = !primary.includes(index);
        moreButton.classList.toggle('active', isMore);
        if (isMore) moreButton.setAttribute('aria-current', 'page');
        else moreButton.removeAttribute('aria-current');
    }
    window.addEventListener('beadyo-tab-change', event => update(event.detail.index));
    update(Number(document.querySelector('.tab.active')?.dataset.tabIndex || 0));
    function showDialog(dialog) { if (!dialog.open) dialog.showModal(); }
    document.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.exploreTab !== undefined) {
            more.close();
            switchTab(Number(button.dataset.exploreTab));
        } else if (button.hasAttribute('data-explore-more')) showDialog(more);
        else if (button.hasAttribute('data-start-here')) { more.close(); showDialog(guide); void loadGuide(); }
        else if (button.hasAttribute('data-explore-close')) button.closest('dialog')?.close();
    });
    [more, guide].forEach(dialog => {
        dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    });
    let guideReady = false;
    let guideLoading = false;
    async function loadGuide() {
        if (guideReady || guideLoading) return;
        guideLoading = true;
        const body = document.getElementById('start-here-body');
        body.innerHTML = '<p class="explore-state" role="status">뉴북이 입문가이드를 불러오는 중…</p>';
        try {
            const response = await E.deadline(BeadyoCommon.fetchWithTimeout('start-here.json?v=start-copy-20261011', 6000, { cache: 'no-store' }));
            if (!response.ok) throw new Error('Guide unavailable');
            const config = await E.deadline(response.json());
            if (!Array.isArray(config.musicIds) || !Array.isArray(config.contentIds) || !Array.isArray(config.terms)) throw new Error('Invalid guide');
            const photoUrl = window.BeadyoCommon.safeUrl(config.photo?.src, '', true);
            const facts = (Array.isArray(config.profileFacts) ? config.profileFacts : [
                { label: '생년월일', value: config.birthDate },
                { label: 'MBTI', value: config.mbti },
                { label: '첫 방송', value: config.firstBroadcast },
                { label: '팬 이름', value: config.fanName },
            ]).filter(fact => fact?.label && fact?.value);
            const photo = photoUrl ? `<img class="start-profile-photo" src="${esc(photoUrl)}" alt="${esc(config.photo?.alt || '구슬요 캐릭터 사진')}" width="${esc(config.photo?.width || 2048)}" height="${esc(config.photo?.height || 1152)}" decoding="async">` : '';
            const factsHtml = `<dl class="start-profile-facts" aria-label="구슬요 소개">${facts.map(fact => `<div><dt>${fact.icon ? `<span aria-hidden="true">${esc(fact.icon)}</span>` : ''}${esc(fact.label)}</dt><dd>${esc(fact.value)}</dd></div>`).join('')}</dl>`;
            const profileSource = config.profileSource?.label ? `<p>소개 정보: ${config.profileSource.url ? E.link(config.profileSource.url, config.profileSource.label) : esc(config.profileSource.label)} · 확인 ${esc(config.profileSource.checkedAt || '')}</p>` : '';
            body.innerHTML = `<section class="start-profile"><h2>${esc(config.intro)}</h2><div class="start-profile-overview${photoUrl ? '' : ' without-photo'}">${photo}${factsHtml}</div></section><section class="start-selection"><h2>먼저 만나볼 곡과 콘텐츠</h2><p class="explore-note">${esc(config.selectionNote)}</p><div id="start-picks"></div></section><section class="start-terms"><h2>별명 및 방송에서 자주 쓰는 단어</h2><dl>${config.terms.map(term => `<div><dt>${esc(term.term)}</dt><dd>${esc(term.meaning)}</dd></div>`).join('')}</dl></section><section class="start-channels"><h2>공식 채널과 팬카페</h2><div>${E.link('https://www.sooplive.co.kr/station/beadyo97','SOOP · 구슬요')}${E.link('https://www.youtube.com/@beadyo97','YouTube · 구슬요')}${E.link('https://www.youtube.com/@beadyoo/shorts','YouTube · 마마마')}${E.link('https://cafe.naver.com/beadyo','떼굴떼굴 팬카페')}</div></section><section class="start-source"><h2>출처</h2><p>${E.link(config.source?.url, '나무위키 「구슬요」')} · ${esc(config.source?.credit)}</p>${profileSource}</section>`;
            const profilePhoto = body.querySelector('.start-profile-photo');
            profilePhoto?.addEventListener('error', () => {
                profilePhoto.closest('.start-profile-overview')?.classList.add('without-photo');
                profilePhoto.remove();
            }, { once: true });
            const picks = document.getElementById('start-picks');
            E.area(picks, '오리지널곡 1집', () => E.readIds('youtube_songs', 'id,title,type,youtube_url,upload_date', config.musicIds), rows => {
                const chosen = config.musicIds.map(id => rows.find(row => row.id === id)).filter(Boolean);
                return chosen.length ? `<ul>${chosen.map(row => `<li><strong>${esc(row.title)}</strong><span class="explore-meta">${esc(row.upload_date || '게시일 미등록')} · 오리지널</span>${E.link(row.youtube_url, 'MUSIC에 등록된 영상')}</li>`).join('')}</ul>` : '<p class="explore-state">소개할 곡의 등록 정보를 확인하지 못했습니다.</p>';
            });
            E.area(picks, '주요 컨텐츠', () => E.readIds('content_archive', 'id,title,summary,broadcast_date', config.contentIds), rows => {
                const chosen = config.contentIds.map(id => rows.find(row => row.id === id)).filter(Boolean);
                return chosen.length ? `<ul>${chosen.map(row => {
                    const intro = config.contentIntros?.[row.id];
                    const description = Array.isArray(intro?.description) ? intro.description.map(part => {
                        const url = D.safeUrl(part.url);
                        return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(part.text)}</a>` : esc(part.text);
                    }).join('') : '';
                    const label = intro?.title || row.title;
                    const meta = intro
                        ? `${esc(row.broadcast_date)} · ${description} ${esc(intro.guestDescription || '')}`
                        : esc(`${row.broadcast_date} · ${row.summary || ''}`);
                    return `<li>${E.localLink(`content.html?content=${encodeURIComponent(row.id)}`, label)}<span class="explore-meta start-content-meta">${meta}</span></li>`;
                }).join('')}</ul>` : '<p class="explore-state">소개할 콘텐츠의 등록 정보를 확인하지 못했습니다.</p>';
            });
            guideReady = true;
        } catch {
            body.innerHTML = '<p class="explore-state" role="status">뉴북이 입문가이드를 확인하지 못했습니다.</p><button class="explore-action" type="button" id="start-retry">다시 시도</button>';
            document.getElementById('start-retry').addEventListener('click', loadGuide);
        } finally { guideLoading = false; }
    }
    function goLocal(href) {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        const file = url.pathname.split('/').pop();
        if (file === 'calendar.html' && D.validDate(url.searchParams.get('date'))) {
            guide.close();
            openCalendarDate(url.searchParams.get('date'));
        } else if (file === 'songbook.html' && url.searchParams.get('song')) {
            guide.close();
            openSongbookSong(url.searchParams.get('song'), { detail: url.searchParams.get('detail') === '1' });
        } else if (file === 'songbook.html' && url.searchParams.get('view') === 'live' && D.validDate(url.searchParams.get('date'))) {
            guide.close();
            openLiveDate(url.searchParams.get('date'));
        } else if (['content.html', 'songbook.html'].includes(file)) {
            // Standalone URLs retain the existing detail and live archive views.
            location.assign(url.href);
        }
    }
    window.addEventListener('message', event => {
        if (event.origin !== location.origin) return;
        const sourceIsFrame = [...document.querySelectorAll('iframe.sheet-frame')].some(frame => frame.contentWindow === event.source);
        if (event.source === document.getElementById('frame-5')?.contentWindow && event.data?.type === 'beadyo-content-state' && typeof event.data.search === 'string' && event.data.search.length < 10000) {
            const child = new URLSearchParams(event.data.search), parent = new URL(location.href);
            ['q','year','category','planning','series','sort','content'].forEach(key => {
                const parentKey = ['series', 'content'].includes(key) ? key : 'content_' + key;
                if (child.get(key)) parent.searchParams.set(parentKey, child.get(key)); else parent.searchParams.delete(parentKey);
            });
            history.replaceState(null, '', parent.pathname + parent.search + parent.hash);
        }
        if (sourceIsFrame && event.data?.type === 'beadyo-explore-link'  && typeof event.data.href === 'string') goLocal(event.data.href);
    });
    document.addEventListener('click', event => {
        const anchor = event.target.closest('#start-here a[data-explore-link]');
        if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        goLocal(anchor.href);
    });
    window.BeadyoExploreShell = Object.freeze({ openGuide: () => { showDialog(guide); void loadGuide(); } });
})();
