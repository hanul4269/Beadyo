// 참가 콘텐츠·같이 본 작품 페이지 공통 도우미 (테마, 임베드, Supabase, 편집자 권한)
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const params = new URLSearchParams(location.search);
    const themeParam = params.get('theme');
    function applyTheme(value) { document.documentElement.dataset.theme = value === 'dark' ? 'dark' : 'light'; }
    try { applyTheme(themeParam || localStorage.getItem('beadyo:theme')); } catch { applyTheme('light'); }

    const embedded = window.self !== window.top;
    if (embedded && $('standalone-nav')) $('standalone-nav').hidden = true;

    let db = null;
    try { db = window.getBeadyoSupabaseClient({ auth: { detectSessionInUrl: false, flowType: 'pkce' } }); } catch {}

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }
    function safeUrl(value) {
        try {
            const url = new URL(String(value || '').trim());
            return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
        } catch { return ''; }
    }
    function link(href, label, className = 'record-link') {
        const url = safeUrl(href);
        if (!url) return null;
        const a = el('a', className, label);
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        return a;
    }
    async function authStep(request) {
        let timer;
        try {
            return await Promise.race([request, new Promise(resolve => { timer = setTimeout(() => resolve(null), 5000); })]);
        } catch { return null; } finally { clearTimeout(timer); }
    }
    async function canEditNow() {
        if (!db) return false;
        const session = await authStep(db.auth.getSession());
        if (session?.error || !session?.data?.session?.user) return false;
        const permission = await authStep(db.rpc('is_beadyo_editor'));
        return !permission?.error && permission?.data === true;
    }
    function watchEditor(onChange) {
        let generation = 0;
        const refresh = async () => {
            const current = ++generation;
            onChange(false);
            const allowed = await canEditNow();
            if (current === generation) onChange(allowed);
        };
        window.addEventListener('message', event => {
            if (event.origin !== location.origin || event.source !== parent) return;
            if (event.data?.type === 'beadyo-theme-sync') applyTheme(event.data.theme);
            if (event.data?.type === 'beadyo-auth-sync') void refresh();
        });
        window.addEventListener('storage', event => { if (event.key === 'beadyo:theme') applyTheme(event.newValue); });
        if (db) { try { db.auth.onAuthStateChange(() => { setTimeout(() => { void refresh(); }, 0); }); } catch {} }
        void refresh();
    }
    async function copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch {}
        const area = el('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.className = 'copy-buffer';
        document.body.append(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch {}
        area.remove();
        return ok;
    }
    function trimOrNull(value, max) {
        const text = String(value ?? '').trim();
        if (text.length > max) throw new Error(`${max}자 이내로 입력해 주세요.`);
        return text || null;
    }
    function urlOrNull(value, label) {
        const text = String(value ?? '').trim();
        if (!text) return null;
        const url = safeUrl(text);
        if (!url) {
            const code = label.charCodeAt(label.length - 1) - 0xac00;
            const josa = code >= 0 && code < 11172 && code % 28 ? '을' : '를';
            throw new Error(`${label}${josa} http 또는 https 주소로 입력해 주세요.`);
        }
        return url;
    }

    // 사이트에 저장한 이미지(beadyo.com/assets/...)는 현재 주소(로컬·실서버) 기준으로 불러온다.
    function sitePath(value) {
        const url = safeUrl(value);
        if (!url) return '';
        try {
            const u = new URL(url);
            if (/^(www\.)?beadyo\.com$/.test(u.hostname) && u.pathname.startsWith('/assets/')) return u.pathname.slice(1);
        } catch {}
        return url;
    }

    // 카드형 / 리스트형 보기 전환 (플레이한 게임과 같은 모양)
    const VIEW_ICONS = {
        grid: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></svg>',
        list: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="3" height="3" rx=".6"/><rect x="3" y="8.5" width="3" height="3" rx=".6"/><rect x="3" y="14" width="3" height="3" rx=".6"/><path d="M9 4.5h8M9 10h8M9 15.5h8"/></svg>',
    };
    function viewToggle(host, storageKey, onChange) {
        let view = 'grid';
        try { if (localStorage.getItem(storageKey) === 'list') view = 'list'; } catch {}
        const buttons = [['grid', '카드'], ['list', '리스트']].map(([value, label]) => {
            const button = el('button');
            button.type = 'button';
            button.dataset.view = value;
            button.title = `${label}로 보기`;
            button.setAttribute('aria-label', `${label}로 보기`);
            button.innerHTML = VIEW_ICONS[value];
            button.append(el('span', '', label));
            button.addEventListener('click', () => {
                if (view === value) return;
                view = value;
                try { localStorage.setItem(storageKey, view); } catch {}
                sync();
                onChange(view);
            });
            return button;
        });
        function sync() { buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view))); }
        if (host) { host.replaceChildren(...buttons); sync(); }
        return () => view;
    }

    window.BeadyoRecords = { $, db, embedded, el, safeUrl, sitePath, link, viewToggle, watchEditor, copyText, trimOrNull, urlOrNull };
})();
