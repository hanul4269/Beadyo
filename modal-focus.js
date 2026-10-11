/* Keyboard focus for the existing video overlays; player behavior stays unchanged. */
(function () {
    'use strict';
    let active = null;
    function controls() {
        if (!active) return [];
        return [...active.dialog.querySelectorAll('button, a[href], input, select, textarea, iframe, [tabindex]')]
            .filter(element => !element.disabled && !element.hidden && element.tabIndex >= 0
                && !element.hasAttribute('data-modal-focus-guard') && element.getClientRects().length);
    }
    function focusEdge(last = false) {
        const items = controls();
        (last ? items[items.length - 1] : items[0])?.focus({ preventScroll: true });
    }
    function release(modal) {
        if (!active || active.modal !== modal) return;
        const previous = active;
        active = null;
        previous.guards.forEach(guard => guard.remove());
        previous.background.forEach(([element, inert]) => { element.inert = inert; });
        if (previous.trigger?.isConnected) previous.trigger.focus({ preventScroll: true });
    }
    function activate(modal, close) {
        if (active?.modal === modal) { focusEdge(); return; }
        if (active) release(active.modal);
        const dialog = modal.querySelector('[role="dialog"]') || modal;
        const trigger = document.activeElement;
        const guards = [false, true].map(last => {
            const guard = document.createElement('span');
            guard.tabIndex = 0;
            guard.setAttribute('data-modal-focus-guard', '');
            guard.setAttribute('aria-hidden', 'true');
            guard.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
            guard.addEventListener('focus', () => focusEdge(!last));
            return guard;
        });
        // Guards also catch Tab as focus leaves a cross-origin video frame.
        dialog.insertBefore(guards[0], dialog.firstChild);
        dialog.appendChild(guards[1]);
        const background = [];
        for (let branch = modal; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
            [...branch.parentElement.children].filter(sibling => sibling !== branch).forEach(sibling => {
                background.push([sibling, sibling.inert]);
                sibling.inert = true;
            });
        }
        active = { modal, dialog, trigger, guards, background, close };
        focusEdge();
    }
    document.addEventListener('keydown', event => {
        if (!active) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            active.close();
            return;
        }
        if (event.key !== 'Tab') return;
        const items = controls();
        if (!items.length) return;
        const current = document.activeElement;
        const startsOutside = current === active.dialog || !active.dialog.contains(current);
        const atBoundary = event.shiftKey ? current === items[0] : current === items[items.length - 1];
        if (startsOutside || atBoundary) {
            event.preventDefault();
            focusEdge(event.shiftKey);
        }
    }, true);
    document.addEventListener('focusin', event => {
        if (active && !active.dialog.contains(event.target)) focusEdge();
    });
    window.BeadyoModalFocus = Object.freeze({ activate, release });
})();
