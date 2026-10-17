(function (root, factory) {
    const commonJS = typeof module === 'object' && module.exports;
    const api = factory(commonJS ? require('./comment-emoticons-data.js') : root.BeadyoCommentEmoticons || [],
        commonJS ? require('./comment-native-emojis-data.js') : root.BeadyoNativeEmojis || []);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BeadyoCommentEmoji = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (items, nativeItems) {
    'use strict';
    const MAX_LENGTH = 1000;
    const catalog = items.filter(item => /^[a-z0-9-]+$/.test(item.id) &&
        /^assets\/comment-emoticons\/[a-z0-9-]+\.(png|gif|webp)$/.test(item.src));
    const byId = new Map(catalog.map(item => [item.id, item]));
    let panelSequence = 0;
    const mounted = new WeakSet();
    const nativeCatalog = [...new Map(nativeItems.map(item => [item.emoji, item])).values()];
    const normalizeSearch = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko').trim().replace(/\s+/g, ' ');
    const nativeSearch = nativeCatalog.map(item => ({ item, text: normalizeSearch([
        item.emoji, item.label, item.group, ...(Array.isArray(item.keywords) ? item.keywords : [item.keywords || '']),
    ].join(' ')) }));
    function filterNativeEmojis(query = '') {
        const words = normalizeSearch(query).split(' ').filter(Boolean);
        return words.length ? nativeSearch.filter(entry => words.every(word => entry.text.includes(word))).map(entry => entry.item) : nativeCatalog;
    }
    function renderNativeEmojis(query = '') {
        const results = filterNativeEmojis(query);
        if (!results.length) return '<p class="comment-emoji-empty" role="status">검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>';
        let previousGroup = '';
        return results.map(item => {
            const heading = item.group !== previousGroup ? `<h3 class="comment-emoji-heading">${escapeHtml(item.group)}</h3>` : '';
            previousGroup = item.group;
            return heading + `<button type="button" class="native-emoji" data-insert-emoji="${escapeHtml(item.emoji)}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}">${escapeHtml(item.emoji)}</button>`;
        }).join('');
    }
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
        character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    function tokenFor(id) { return byId.has(id) ? `[[beadyo:${id}]]` : ''; }
    function parse(content) {
        const value = String(content ?? ''), parts = [];
        let offset = 0;
        for (const match of value.matchAll(/\[\[beadyo:([a-z0-9-]+)\]\]/g)) {
            const item = byId.get(match[1]);
            if (!item) continue;
            if (match.index > offset) parts.push({ type: 'text', text: value.slice(offset, match.index) });
            parts.push({ type: 'sticker', id: item.id, item });
            offset = match.index + match[0].length;
        }
        if (offset < value.length) parts.push({ type: 'text', text: value.slice(offset) });
        return parts;
    }
    function image(item, className = 'comment-sticker') {
        return `<img class="${className}" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async">`;
    }
    function render(content) {
        return parse(content).map(part => part.type === 'text' ? escapeHtml(part.text) : image(part.item)).join('');
    }
    function decode(content) {
        const parts = parse(content), stickers = parts.filter(part => part.type === 'sticker').map(part => part.id);
        const text = parts.filter(part => part.type === 'text').map(part => part.text).join('');
        return { text: stickers.length ? text.trimEnd() : text, stickers };
    }
    function encode(text, stickers = []) {
        const body = String(text ?? '').trim(), tokens = stickers.map(tokenFor).join('');
        return body + (body && tokens ? '\n' : '') + tokens;
    }
    function insertText(value, start, end, insertion, maxLength = MAX_LENGTH) {
        const text = String(value), addition = String(insertion);
        const from = Math.max(0, Math.min(text.length, start)), to = Math.max(from, Math.min(text.length, end));
        const next = text.slice(0, from) + addition + text.slice(to);
        return next.length <= maxLength ? { value: next, position: from + addition.length } : null;
    }
    function selectedMarkup(stickers) {
        return stickers.map((id, index) => `<span class="comment-selected-sticker" data-sticker-id="${id}">
            ${image(byId.get(id))}<button type="button" data-remove-sticker="${index}" aria-label="${escapeHtml(byId.get(id).label)} 제거">×</button></span>`).join('');
    }
    function composer({ key, value = '', editing = false }) {
        const draft = decode(value), panelId = `comment-emoji-panel-${++panelSequence}`;
        return `<div class="comment-composer" data-comment-composer="${escapeHtml(key)}">
            <textarea class="${editing ? 'comment-edit-content' : 'comment-content'}" maxlength="1000" aria-label="${editing ? '댓글 내용 수정' : '댓글 내용'}" placeholder="댓글을 남겨주세요. 이모티콘만 보내도 좋아요.">${escapeHtml(draft.text)}</textarea>
            <div class="comment-selected-stickers" aria-label="선택한 구북티콘" ${draft.stickers.length ? '' : 'hidden'}>${selectedMarkup(draft.stickers)}</div>
            <button type="button" class="comment-emoji-trigger" data-toggle-emoji popovertarget="${panelId}" aria-haspopup="dialog" aria-expanded="false" aria-controls="${panelId}"><span aria-hidden="true">☺</span> 이모티콘</button>
            <div id="${panelId}" class="comment-emoji-panel" popover="auto" role="dialog" aria-label="이모티콘 선택"></div>
        </div>`;
    }
    const selectedIds = composer => [...composer.querySelectorAll('[data-sticker-id]')].map(item => item.dataset.stickerId);
    function getContent(composer) { return encode(composer.querySelector('textarea').value, selectedIds(composer)); }
    function sync(composer) {
        const ids = selectedIds(composer);
        composer.querySelector('textarea').maxLength = Math.max(0, MAX_LENGTH - (ids.length ? encode('', ids).length + 1 : 0));
        composer.querySelector('.comment-selected-stickers').hidden = ids.length === 0;
    }
    function capture(root) {
        return new Map([...root.querySelectorAll('[data-comment-composer]')].map(composer => {
            const textarea = composer.querySelector('textarea');
            return [composer.dataset.commentComposer, { text: textarea.value, stickers: selectedIds(composer),
                selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd }];
        }));
    }
    function restore(root, drafts) {
        root.querySelectorAll('[data-comment-composer]').forEach(composer => {
            if (drafts.has(composer.dataset.commentComposer)) {
                const draft = drafts.get(composer.dataset.commentComposer);
                const textarea = composer.querySelector('textarea');
                textarea.value = draft.text;
                textarea.setSelectionRange(draft.selectionStart, draft.selectionEnd);
                composer.querySelector('.comment-selected-stickers').innerHTML = selectedMarkup(draft.stickers);
            }
            sync(composer);
        });
    }
    function closePanel(panel, returnFocus = false) {
        if (!panel) return;
        if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
        panel.classList.remove('is-open');
        const trigger = panel.closest('[data-comment-composer]').querySelector('[data-toggle-emoji]');
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus && !trigger.disabled) trigger.focus({ preventScroll: true });
    }
    function setBusy(composer, busy) {
        composer.setAttribute('aria-busy', String(busy));
        if (busy) closePanel(composer.querySelector('.comment-emoji-panel'));
        composer.querySelectorAll('textarea, input, button, select').forEach(control => { control.disabled = busy; });
    }
    // Anchor to the button while staying inside the visible (including mobile keyboard) viewport.
    function popupPosition(anchor, viewport) {
        const margin = 12, gap = 8;
        const leftEdge = (viewport.left || 0) + margin, topEdge = (viewport.top || 0) + margin;
        const rightEdge = leftEdge + Math.max(0, viewport.width - margin * 2);
        const bottomEdge = topEdge + Math.max(0, viewport.height - margin * 2);
        const width = Math.min(400, rightEdge - leftEdge);
        const above = Math.max(0, Math.min(bottomEdge, anchor.top - gap) - topEdge);
        const below = Math.max(0, bottomEdge - Math.max(topEdge, anchor.bottom + gap));
        const useAbove = above >= 320 || above > below;
        const available = useAbove ? above : below;
        // A short viewport needs an overlay instead of an unusably thin strip beside the button.
        const height = Math.min(460, available < 240 ? bottomEdge - topEdge : available);
        const top = useAbove ? Math.min(bottomEdge, anchor.top - gap) - height : Math.max(topEdge, anchor.bottom + gap);
        return { left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
            top: Math.max(topEdge, Math.min(top, bottomEdge - height)), width, height };
    }
    function positionPanel(panel) {
        const composer = panel.closest('[data-comment-composer]'), doc = panel.ownerDocument, view = doc.defaultView;
        const viewport = view.visualViewport;
        const position = popupPosition(composer.querySelector('[data-toggle-emoji]').getBoundingClientRect(), {
            left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0,
            width: Math.min(viewport?.width || doc.documentElement.clientWidth, doc.documentElement.clientWidth),
            height: viewport?.height || view.innerHeight,
        });
        Object.entries(position).forEach(([name, value]) => { panel.style[name] = `${value}px`; });
    }
    function populateGrid(panel) {
        const custom = panel.dataset.kind === 'custom';
        const search = panel.querySelector('[data-search-emoji]');
        search.hidden = custom;
        const query = search.value;
        panel.querySelector('.comment-emoji-hint').textContent = custom
            ? `구북티콘 ${catalog.length}개 · 아래로 스크롤해 모두 볼 수 있어요.`
            : `${query.trim() ? '검색 결과' : '전체 이모지'} ${filterNativeEmojis(query).length.toLocaleString('ko-KR')}개 · 눌러서 입력하세요.`;
        panel.querySelectorAll('[data-emoji-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.emojiKind === panel.dataset.kind)));
        const grid = panel.querySelector('.comment-emoji-grid');
        grid.classList.toggle('custom', custom);
        grid.setAttribute('aria-label', custom ? '전체 구북티콘' : '기본 이모지');
        grid.innerHTML = custom ? catalog.map(item =>
            `<button type="button" data-insert-sticker="${item.id}" aria-label="${escapeHtml(item.label)} 추가">${image(item)}</button>`).join('')
            : renderNativeEmojis(query);
        grid.scrollTop = 0;
    }
    function preparePanel(panel) {
        if (panel.dataset.kind) return;
        panel.dataset.kind = 'custom';
        panel.innerHTML = `<div class="comment-emoji-types" role="group" aria-label="이모티콘 종류">
            <button type="button" data-emoji-kind="custom" aria-pressed="true">구북티콘</button>
            <button type="button" data-emoji-kind="native" aria-pressed="false">기본 이모지</button>
            <button type="button" data-close-emoji aria-label="이모티콘 선택 닫기">×</button></div>
            <input class="comment-emoji-search" type="search" data-search-emoji aria-label="기본 이모지 검색" placeholder="이모지 검색 (예: 하트, 동물, 배구)" maxlength="80" autocomplete="off" hidden>
            <p class="comment-emoji-hint" aria-live="polite"></p>
            <div class="comment-emoji-grid" role="group" aria-label="전체 구북티콘"></div>`;
        populateGrid(panel);
    }
    function mount(root, { notify = () => {} } = {}) {
        if (mounted.has(root)) return;
        mounted.add(root);
        root.addEventListener('beforetoggle', event => {
            if (!event.target.matches('.comment-emoji-panel') || event.newState !== 'closed') return;
            event.target.classList.remove('is-open');
            event.target.closest('[data-comment-composer]').querySelector('[data-toggle-emoji]').setAttribute('aria-expanded', 'false');
        }, true);
        root.addEventListener('click', event => {
            const button = event.target.closest('button'), composer = button?.closest('[data-comment-composer]');
            if (!composer || button.disabled || composer.getAttribute('aria-busy') === 'true') return;
            const panel = composer.querySelector('.comment-emoji-panel'), textarea = composer.querySelector('textarea');
            if (button.hasAttribute('data-toggle-emoji')) {
                event.preventDefault();
                if (panel.classList.contains('is-open')) { closePanel(panel, true); return; }
                root.querySelectorAll('.comment-emoji-panel.is-open').forEach(other => closePanel(other));
                preparePanel(panel);
                positionPanel(panel);
                if (typeof panel.showPopover === 'function') panel.showPopover();
                panel.classList.add('is-open');
                button.setAttribute('aria-expanded', 'true');
                panel.querySelector('[data-emoji-kind][aria-pressed="true"]').focus({ preventScroll: true });
            }
            if (button.dataset.emojiKind) { panel.dataset.kind = button.dataset.emojiKind; populateGrid(panel); }
            if (button.hasAttribute('data-close-emoji')) closePanel(panel, true);
            if (button.dataset.insertEmoji) {
                const next = insertText(textarea.value, textarea.selectionStart, textarea.selectionEnd, button.dataset.insertEmoji, textarea.maxLength);
                if (!next) { notify('댓글은 이모티콘을 포함해 최대 1,000자까지 입력할 수 있어요.', 'error'); return; }
                textarea.setRangeText(button.dataset.insertEmoji, textarea.selectionStart, textarea.selectionEnd, 'end');
                closePanel(panel);
                textarea.focus({ preventScroll: true });
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (button.dataset.insertSticker) {
                const id = button.dataset.insertSticker;
                if (!byId.has(id)) return;
                const ids = [...selectedIds(composer), id];
                if (encode(textarea.value, ids).length > MAX_LENGTH) { notify('댓글 길이가 가득 찼어요. 내용을 줄인 뒤 추가해주세요.', 'error'); return; }
                composer.querySelector('.comment-selected-stickers').innerHTML = selectedMarkup(ids);
                sync(composer);
                closePanel(panel);
                textarea.focus({ preventScroll: true });
            }
            if (button.hasAttribute('data-remove-sticker')) {
                const ids = selectedIds(composer), index = Number(button.dataset.removeSticker);
                ids.splice(index, 1);
                composer.querySelector('.comment-selected-stickers').innerHTML = selectedMarkup(ids);
                sync(composer);
                const next = composer.querySelectorAll('[data-remove-sticker]')[Math.min(index, ids.length - 1)];
                (next || textarea).focus({ preventScroll: true });
            }
        });
        root.addEventListener('input', event => {
            if (event.target.matches('[data-search-emoji]')) populateGrid(event.target.closest('.comment-emoji-panel'));
        });
        root.addEventListener('keydown', event => {
            // Searching in the picker must not submit the surrounding comment form.
            if (event.key === 'Enter' && !event.isComposing && event.target.matches('[data-search-emoji]')) {
                event.preventDefault();
                return;
            }
            if (event.key !== 'Escape' || event.isComposing) return;
            const panel = event.target.closest('[data-comment-composer]')?.querySelector('.comment-emoji-panel.is-open');
            if (!panel) return;
            event.preventDefault();
            event.stopPropagation();
            closePanel(panel, true);
        });
        root.ownerDocument.addEventListener('pointerdown', event => {
            root.querySelectorAll('.comment-emoji-panel.is-open').forEach(panel => {
                const trigger = panel.closest('[data-comment-composer]').querySelector('[data-toggle-emoji]');
                if (!panel.contains(event.target) && !trigger.contains(event.target)) closePanel(panel);
            });
        });
        const reposition = () => root.querySelectorAll('.comment-emoji-panel.is-open').forEach(positionPanel);
        const view = root.ownerDocument.defaultView;
        view.addEventListener('resize', reposition);
        view.visualViewport?.addEventListener('resize', reposition);
        view.visualViewport?.addEventListener('scroll', reposition);
        root.ownerDocument.addEventListener('scroll', event => {
            if (!event.target.closest?.('.comment-emoji-panel')) reposition();
        }, true);
        restore(root, new Map());
    }
    return { catalog, MAX_LENGTH, tokenFor, parse, render, decode, encode, insertText, nativeCatalog, filterNativeEmojis, renderNativeEmojis,
        composer, getContent, mount, capture, restore, setBusy, popupPosition };
});
