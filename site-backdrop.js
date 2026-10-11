(() => {
    'use strict';

    // Trial switch: set false and reload to restore every existing page background.
    const SITE_BACKDROP_ENABLED = true;
    if (!SITE_BACKDROP_ENABLED) return;

    const root = document.documentElement;
    root.dataset.siteBackdrop = 'home';
    root.dataset.siteBackdropEmbedded = window.self === window.top ? 'false' : 'true';
})();
