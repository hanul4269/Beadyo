(() => {
    'use strict';
    document.documentElement.dataset.archiveEmbedded = window.self === window.top ? 'false' : 'true';
    const key = 'beadyo:theme';
    function apply(theme) {
        const value = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = value;
        document.documentElement.style.colorScheme = value;
    }
    let initial = 'light';
    try { initial = localStorage.getItem(key); } catch {}
    apply(initial);
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== window.parent ||
            event.data?.type !== 'beadyo-theme-sync') return;
        apply(event.data.theme);
    });
    window.addEventListener('storage', event => {
        if (event.key === key) apply(event.newValue);
    });
})();
