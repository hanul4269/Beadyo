/* HOME artwork repeats while visible; confirmed broadcasts use SOOP's live image. */
(function () {
    'use strict';
    const root = document.getElementById('frame-7');
    if (!root) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const figures = new Set();
    const failed = new WeakSet();
    const failedBroadcasts = new Set();
    function visible(figure) {
        const rect = figure.getBoundingClientRect();
        const bounds = root.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > Math.max(0, bounds.top) &&
            rect.top < Math.min(window.innerHeight, bounds.bottom) && rect.right > Math.max(0, bounds.left) &&
            rect.left < Math.min(window.innerWidth, bounds.right);
    }
    function stop(figure) {
        if (figure.dataset.playing === 'true') {
            figure.dataset.playing = 'false';
            const image = figure.querySelector('[data-home-animation]');
            image.src = image.dataset.homePoster;
        }
    }
    function sync(figure) {
        if (document.hidden || !root.classList.contains('active') || reducedMotion.matches ||
            figure.hidden || failed.has(figure) || !visible(figure)) { stop(figure); return; }
        if (figure.dataset.playing !== 'true') {
            figure.dataset.playing = 'true';
            const image = figure.querySelector('[data-home-animation]');
            image.src = image.dataset.homeAnimation;
        }
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) sync(entry.target); else stop(entry.target); });
    }, { root, threshold: 0 }) : null;
    function activate() {
        root.querySelectorAll('[data-home-motion-frame]').forEach(figure => {
            if (!figures.has(figure)) { figures.add(figure); observer?.observe(figure); }
            sync(figure);
        });
    }
    function setBroadcast(broadNo) {
        const media = root.querySelector?.('[data-home-live-media]');
        if (!media) return;
        const thumbnail = media.querySelector('[data-home-live-thumbnail]');
        const artwork = media.querySelector('[data-home-motion-frame]');
        const id = /^[1-9]\d*$/.test(String(broadNo || '')) ? String(broadNo) : '';
        // Keep the same image and GIF nodes across polling; no forced reload or flashing.
        if (thumbnail.dataset.broadNo === id) return;
        thumbnail.dataset.broadNo = id;
        thumbnail.hidden = true;
        artwork.hidden = false;
        const image = thumbnail.querySelector('[data-home-broadcast-image]');
        if (id && !failedBroadcasts.has(id)) image.src = `https://liveimg.sooplive.co.kr/m/${id}`;
        else image.removeAttribute('src');
        activate();
    }
    root.addEventListener('load', event => {
        const image = event.target;
        if (!image.matches?.('[data-home-broadcast-image]')) return;
        const thumbnail = image.closest('[data-home-live-thumbnail]');
        if (!thumbnail.dataset.broadNo || failedBroadcasts.has(thumbnail.dataset.broadNo)) return;
        if (!image.naturalWidth || !image.naturalHeight) return;
        thumbnail.hidden = false;
        thumbnail.parentElement.querySelector('[data-home-motion-frame]').hidden = true;
        activate();
    }, true);
    root.addEventListener('error', event => {
        const image = event.target;
        if (image.matches?.('[data-home-broadcast-image]')) {
            const thumbnail = image.closest('[data-home-live-thumbnail]');
            if (thumbnail.dataset.broadNo) failedBroadcasts.add(thumbnail.dataset.broadNo);
            thumbnail.hidden = true;
            thumbnail.parentElement.querySelector('[data-home-motion-frame]').hidden = false;
            activate();
            return;
        }
        if (!image.matches?.('[data-home-animation]')) return;
        const figure = image.closest('[data-home-motion-frame]');
        if (figure.dataset.playing !== 'true') return;
        failed.add(figure);
        stop(figure);
        figure.querySelector('figcaption').hidden = false;
        figure.querySelector('.home-motion-note').textContent = '움직이는 이미지를 불러오지 못했습니다.';
    }, true);
    window.addEventListener('beadyo-tab-change', event => {
        if (event.detail?.index !== 7) figures.forEach(stop);
        else activate();
    });
    document.addEventListener('visibilitychange', activate);
    reducedMotion.addEventListener('change', activate);
    // Legacy browsers without IntersectionObserver still pause artwork outside the viewport.
    if (!observer) {
        root.addEventListener('scroll', activate, { passive: true });
        window.addEventListener('resize', activate);
    }
    window.BeadyoHomeVisual = Object.freeze({ activate, setBroadcast });
    activate();
})();
