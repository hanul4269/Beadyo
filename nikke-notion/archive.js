(() => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = lightbox.querySelector('img');
    let syncFrame = 0;

    function reportHeight() {
        cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(() => {
            const content = document.querySelector('.archive-shell');
            window.parent.postMessage({
                type: 'nikke:notion-height',
                path: window.location.pathname,
                height: Math.ceil(content.getBoundingClientRect().bottom)
            }, window.location.origin);
        });
    }

    document.querySelectorAll('a').forEach(link => {
        if (!link.classList.contains('image-open')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
    });

    document.querySelectorAll('.image-open').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            lightboxImage.src = link.href;
            lightbox.showModal();
        });
    });

    lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => {
        if (event.target === lightbox) lightbox.close();
    });
    document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', reportHeight));
    document.querySelectorAll('img').forEach(image => image.addEventListener('load', reportHeight));
    window.addEventListener('load', reportHeight);
    window.addEventListener('resize', reportHeight);
    new ResizeObserver(reportHeight).observe(document.querySelector('.archive-shell'));
    reportHeight();
})();
