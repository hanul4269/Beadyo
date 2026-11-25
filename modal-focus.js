/* Keyboard focus for overlay dialogs: move focus in, trap Tab, close on Escape, restore focus on close. */
(function () {
    'use strict';
    let active = null;
    // Dialogs opened with { nested: true } park the dialog underneath here until they close.
    const stack = [];
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
    function engage(entry) {
        entry.guards = [false, true].map(last => {
            const guard = document.createElement('span');
            guard.tabIndex = 0;
            guard.setAttribute('data-modal-focus-guard', '');
            guard.setAttribute('aria-hidden', 'true');
            guard.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
            guard.addEventListener('focus', () => focusEdge(!last));
            return guard;
        });
        // Guards also catch Tab as focus leaves a cross-origin video frame.
        entry.dialog.insertBefore(entry.guards[0], entry.dialog.firstChild);
        entry.dialog.appendChild(entry.guards[1]);
        entry.background = [];
        for (let branch = entry.modal; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
            [...branch.parentElement.children].filter(sibling => sibling !== branch).forEach(sibling => {
                entry.background.push([sibling, sibling.inert]);
                sibling.inert = true;
            });
        }
        active = entry;
    }
    function disengage(entry) {
        entry.guards.forEach(guard => guard.remove());
        entry.background.forEach(([element, inert]) => { element.inert = inert; });
    }
    function release(modal) {
        const parked = stack.findIndex(entry => entry.modal === modal);
        if (parked >= 0) { stack.splice(parked, 1); return; }
        if (!active || active.modal !== modal) return;
        const previous = active;
        active = null;
        disengage(previous);
        let outer = stack.pop();
        // Skip dialogs that were hidden without being released.
        while (outer && !(outer.modal.isConnected && outer.modal.getClientRects().length)) outer = stack.pop();
        if (outer) engage(outer);
        // A re-render may replace the opener while the dialog is open; options.restore finds its successor.
        const target = previous.trigger?.isConnected && previous.trigger.getClientRects().length
            ? previous.trigger : previous.restore?.();
        if (target) target.focus({ preventScroll: true });
        else if (outer) focusEdge();
    }
    function activate(modal, close, options = {}) {
        if (active?.modal === modal) { focusEdge(); return; }
        if (active && options.nested) {
            disengage(active);
            stack.push(active);
            active = null;
        } else if (active) {
            release(active.modal);
        }
        const dialog = modal.querySelector('[role="dialog"]') || modal;
        engage({ modal, dialog, trigger: document.activeElement, close, restore: options.restore });
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
