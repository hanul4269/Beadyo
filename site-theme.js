/* Early theme initialization for standalone pages that share the site preference. */
(function () {
    'use strict';
    const key = 'beadyo:theme';
    function apply(value, persist = false) {
        const theme = value === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        if (persist) try { localStorage.setItem(key, theme); } catch {}
    }
    let stored = 'light';
    try { stored = localStorage.getItem(key); } catch {}
    apply(stored);
    window.addEventListener('storage', event => {
        if (event.storageArea && event.storageArea !== localStorage) return;
        if (event.key === key || event.key === null) apply(event.newValue);
    });
    window.addEventListener('message', event => {
        if (window.parent === window || event.source !== window.parent || event.origin !== location.origin) return;
        if (event.data?.type === 'beadyo-theme-sync') apply(event.data.theme, true);
    });
})();
