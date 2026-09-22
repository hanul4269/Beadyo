(function (global) {
    'use strict';

    if (global.BeadyoCommon) return;

    const SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR';
    const OWNER_EMAIL = 'riosniper12@gmail.com';
    const ALLOWED_MESSAGE_ORIGINS = new Set([
        'https://beadyo.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]);

    let supabaseClient = null;

    function getSupabaseClient(options = {}) {
        if (supabaseClient) return supabaseClient;
        if (!global.supabase?.createClient) {
            throw new Error('supabase.min.js must be loaded before beadyo-common.js');
        }
        supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        return supabaseClient;
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character]));
    }

    function safeUrl(value, fallback = '#', allowRelative = false) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback;
        try {
            const url = allowRelative ? new URL(raw, global.location.href) : new URL(raw);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
        } catch {
            return fallback;
        }
    }

    function safeImageUrl(value, fallback = '') {
        return safeUrl(value, fallback);
    }

    async function fetchWithTimeout(url, ms, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function allowedMessageOrigin(origin) {
        return origin === global.location.origin || ALLOWED_MESSAGE_ORIGINS.has(origin);
    }

    const STANDALONE_PAGES = new Set([
        'calendar.html',
        'songbook.html',
        'songs.html',
        'dance.html',
        'gembox.html',
        'tractor-service.html',
        'content.html',
        'games.html',
        'guide.html',
    ]);

    const STANDALONE_NAV_ITEMS = [
        { key: 'calendar', label: '일정', href: 'calendar.html' },
        { key: 'schedule', label: '주간편성', href: 'index.html?tab=schedule' },
        { key: 'songbook', label: '노래책', href: 'songbook.html?view=songbook' },
        { key: 'live', label: '라이브 기록', href: 'songbook.html?view=live' },
        { key: 'songs', label: '음악', href: 'songs.html' },
        { key: 'dance', label: '춤영상', href: 'dance.html' },
        { key: 'gembox', label: '보석함', href: 'gembox.html' },
        { key: 'tractor-service', label: '트랙터서비스', href: 'tractor-service.html' },
        { key: 'content', label: '콘텐츠', href: 'content.html' },
        { key: 'games', label: '게임', href: 'games.html' },
        { key: 'guide', label: '이용가이드', href: 'guide.html' },
    ];

    function currentStandalonePage(fileName) {
        if (fileName === 'songbook.html') {
            const view = new URLSearchParams(global.location.search).get('view');
            return view === 'live' ? 'live' : 'songbook';
        }
        return fileName.replace(/\.html$/, '');
    }

    function addStandaloneNavigationStyles() {
        if (document.querySelector('link[data-beadyo-standalone-nav]')) return;
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'standalone-nav.css?v=20260919';
        stylesheet.dataset.beadyoStandaloneNav = '';
        document.head.append(stylesheet);
    }

    function buildStandaloneNavigation(activePage) {
        const header = document.createElement('header');
        header.className = 'beadyo-standalone-header';
        header.dataset.beadyoStandaloneHeader = '';

        const inner = document.createElement('div');
        inner.className = 'beadyo-standalone-inner';

        const home = document.createElement('a');
        home.className = 'beadyo-standalone-brand';
        home.href = 'index.html';
        home.setAttribute('aria-label', 'BEADYO 전체 홈으로 이동');

        const mascot = document.createElement('img');
        mascot.src = 'stickers/kyabuki.gif';
        mascot.alt = '';
        mascot.width = 32;
        mascot.height = 32;
        mascot.decoding = 'async';

        const brandCopy = document.createElement('span');
        brandCopy.className = 'beadyo-standalone-brand-copy';
        const brandName = document.createElement('strong');
        brandName.textContent = 'BEADYO';
        const brandDescription = document.createElement('span');
        brandDescription.textContent = '비드요닷컴 — OFFICIAL';
        brandCopy.append(brandName, brandDescription);
        home.append(mascot, brandCopy);

        const homeAction = document.createElement('a');
        homeAction.className = 'beadyo-standalone-home-link';
        homeAction.href = 'index.html';
        homeAction.textContent = '전체 홈';
        homeAction.setAttribute('aria-label', 'BEADYO 전체 홈으로 이동');
        inner.append(home, homeAction);

        const navigation = document.createElement('nav');
        navigation.className = 'beadyo-standalone-nav';
        navigation.setAttribute('aria-label', 'BEADYO 주요 메뉴');

        const list = document.createElement('div');
        list.className = 'beadyo-standalone-nav-list';
        STANDALONE_NAV_ITEMS.forEach(item => {
            const link = document.createElement('a');
            link.className = 'beadyo-standalone-nav-link';
            link.href = item.href;
            link.textContent = item.label;
            if (item.key === activePage) {
                link.classList.add('is-active');
                link.setAttribute('aria-current', 'page');
            }
            list.append(link);
        });
        navigation.append(list);
        header.append(inner, navigation);
        return header;
    }

    function initStandaloneNavigation() {
        if (global.self !== global.top) return;

        const fileName = decodeURIComponent(global.location.pathname)
            .split('/')
            .filter(Boolean)
            .pop()
            ?.toLowerCase();
        if (!fileName || !STANDALONE_PAGES.has(fileName)) return;
        if (document.querySelector('[data-beadyo-standalone-header]')) return;

        addStandaloneNavigationStyles();
        const mount = () => {
            if (!document.body || document.querySelector('[data-beadyo-standalone-header]')) return;
            const header = buildStandaloneNavigation(currentStandalonePage(fileName));
            document.body.prepend(header);

            const navigation = header.querySelector('.beadyo-standalone-nav');
            const activeLink = header.querySelector('.beadyo-standalone-nav-link.is-active');
            if (navigation && activeLink) {
                requestAnimationFrame(() => {
                    navigation.scrollLeft = Math.max(
                        0,
                        activeLink.offsetLeft - (navigation.clientWidth - activeLink.offsetWidth) / 2,
                    );
                });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        } else {
            mount();
        }
    }

    const api = Object.freeze({
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        OWNER_EMAIL,
        getSupabaseClient,
        esc,
        safeUrl,
        safeImageUrl,
        fetchWithTimeout,
        allowedMessageOrigin,
    });

    Object.defineProperties(global, {
        BeadyoCommon: { value: api, enumerable: true, configurable: true },
        SUPABASE_URL: { value: SUPABASE_URL, configurable: true },
        SUPABASE_ANON_KEY: { value: SUPABASE_ANON_KEY, configurable: true },
        OWNER_EMAIL: { value: OWNER_EMAIL, configurable: true },
        getBeadyoSupabaseClient: { value: getSupabaseClient, configurable: true },
        esc: { value: esc, configurable: true },
        safeUrl: { value: safeUrl, configurable: true },
        safeImageUrl: { value: safeImageUrl, configurable: true },
        fetchWithTimeout: { value: fetchWithTimeout, configurable: true },
        beadyoAllowedMessageOrigin: { value: allowedMessageOrigin, configurable: true },
    });

    initStandaloneNavigation();
})(window);
