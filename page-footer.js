/* Mount the existing contact footer in each tab's own scroll flow. */
(() => {
    'use strict';
    if (window.self !== window.top) return; // Embedded pages are mounted by the shell.
    const template = document.createElement('template');
    template.innerHTML = `<footer class="site-footer beadyo-page-footer">
            <div class="footer-line">
                <a class="footer-contact" href="mailto:hanul4269@kakao.com">
                    <strong>Contact</strong>
                    <span>hanul4269@kakao.com</span>
                    <span>(홈페이지 운영 & 버그 관련 문의)</span>
                </a>
                <a class="footer-discord" href="https://discord.gg/KemnCJmHyd" target="_blank" rel="noopener noreferrer" title="BEADYO Discord 서버에서 문의하기" aria-label="BEADYO Discord 서버에서 문의하기">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A18.8 18.8 0 0 0 15.7 3l-.2.3c-.2.4-.4.8-.5 1.2a17.4 17.4 0 0 0-6 0 8.2 8.2 0 0 0-.6-1.2L8.3 3a18.8 18.8 0 0 0-4.6 1.4C.8 8.8.1 13.1.5 17.4A18.9 18.9 0 0 0 6.1 20c.5-.6.9-1.3 1.2-2a11.8 11.8 0 0 1-1.9-.9l.4-.3a13.3 13.3 0 0 0 12.4 0l.4.3c-.6.4-1.2.7-1.9.9.4.7.8 1.4 1.2 2a18.8 18.8 0 0 0 5.6-2.6c.6-5-.9-9.2-3.2-13ZM8.2 14.7c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7.6 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/></svg>
                    <span>Discord</span>
                </a>
            </div>
            <div class="footer-line">© 2026 BEADYO 사이트 모든 저작물의 권리는 원저작자에게 있습니다.</div>
        </footer>`;
    const stylesheet = new URL('page-footer.css?v=release-20261011-all', location.href).href;
    const home = document.getElementById('frame-7');
    if (!home) {
        mountDocumentFooter(document, window);
        return;
    }
    const homeFooter = template.content.firstElementChild.cloneNode(true);
    function placeHomeFooter() {
        if (home.querySelector('.home-wrap') && homeFooter.parentElement !== home) home.append(homeFooter);
    }
    new MutationObserver(placeHomeFooter).observe(home, { childList: true });
    placeHomeFooter();

    function mountFrameFooter(frame) {
        let doc;
        try { doc = frame.contentDocument; } catch { return; }
        if (!doc?.body || !doc.location || doc.location.origin !== location.origin) return;
        mountDocumentFooter(doc, frame.contentWindow);
    }
    function mountDocumentFooter(doc, pageWindow) {
        if (doc.querySelector('.beadyo-page-footer')) return;
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = stylesheet;
        doc.head.append(link);
        const footer = doc.importNode(template.content.firstElementChild, true);
        const mobileList = doc.getElementById('mobileScheduleView');
        const media = pageWindow.matchMedia('(max-width: 640px)');
        function place() {
            doc.body.classList.toggle('page-footer-document', !mobileList || !media.matches);
            const target = mobileList && media.matches ? mobileList : doc.body;
            if (footer.parentElement !== target) target.append(footer);
        }
        place();
        if (mobileList) {
            // Calendar redraws this list after data loads and month changes.
            new MutationObserver(place).observe(mobileList, { childList: true });
            media.addEventListener('change', () => {
                if (media.matches && typeof pageWindow.renderMobileSchedule === 'function') {
                    pageWindow.renderMobileSchedule();
                }
                place();
            });
        }
    }
    document.querySelectorAll('iframe.sheet-frame').forEach(frame => {
        if (frame.id === 'frame-1') return; // The Google spreadsheet has a separate origin.
        frame.addEventListener('load', () => mountFrameFooter(frame));
        if (frame.contentDocument?.readyState === 'complete') mountFrameFooter(frame);
    });
    // Keep the spreadsheet footer in parent flow, below the embedded sheet.
    const externalFooter = template.content.firstElementChild.cloneNode(true);
    externalFooter.hidden = true;
    document.querySelector('.content').append(externalFooter);
    function updateExternalFooter() {
        externalFooter.hidden = !document.getElementById('frame-1').classList.contains('active');
    }
    window.addEventListener('beadyo-tab-change', updateExternalFooter);
    updateExternalFooter();
})();
