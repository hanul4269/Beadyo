const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Pure local fixtures only: this test never loads the board or connects to its database.
const emoji = require('../comment-emoticons.js');
const root = path.resolve(__dirname, '..');
const firstId = emoji.catalog[0]?.id;
const secondId = emoji.catalog[1]?.id || firstId;
const token = id => emoji.tokenFor(id);
const plain = value => emoji.parse(value).filter(part => part.type === 'text').map(part => part.text).join('');

test('the sticker catalog has stable unique IDs and only registered IDs become tokens', () => {
    assert.ok(emoji.catalog.length > 0);
    assert.equal(new Set(emoji.catalog.map(item => item.id)).size, emoji.catalog.length);
    assert.equal(emoji.MAX_LENGTH, 1000);
    for (const item of emoji.catalog) {
        assert.match(item.id, /^[a-zA-Z0-9_-]+$/);
        assert.equal(token(item.id), `[[beadyo:${item.id}]]`);
    }
    for (const id of ['', 'missing-fixture-id', '__proto__', 'constructor', 'toString', '../secret', 'x"><script>']) {
        assert.equal(token(id), '');
    }
});

test('the removed 단발슬요AI sticker is unavailable without reinterpreting any stored comment', () => {
    const removedId = 'danbal-seulyo-ai', oldText = `이전 댓글 [[beadyo:${removedId}]] 😀`;
    assert.equal(emoji.catalog.some(item => item.id === removedId || item.label === '단발슬요AI'), false);
    assert.equal(emoji.tokenFor(removedId), '');
    assert.equal(emoji.encode('[테스트용] 댓글', [removedId]), '[테스트용] 댓글');
    assert.equal(emoji.render(oldText), oldText);
    assert.deepEqual(emoji.decode(oldText), { text: oldText, stickers: [] });
});

test('ordinary Korean text, line breaks and OS Unicode emoji survive parsing and rendering', () => {
    const text = '테스트용 댓글 👨‍👩‍👧‍👦 👍🏽 🇰🇷 ❤️\n둘째 줄 😀';
    assert.equal(plain(text), text);
    assert.equal(emoji.render(text), text);
    const decoded = emoji.decode(text);
    assert.equal(decoded.text, text);
    assert.deepEqual(decoded.stickers, []);
    assert.equal(emoji.encode(decoded.text, decoded.stickers), text);
});

test('mixed text and repeated custom stickers preserve token identity and order', () => {
    const content = `앞 😀 ${token(firstId)} 가운데 ${token(secondId)} ${token(firstId)} 끝`;
    const parts = emoji.parse(content);
    assert.deepEqual(parts.filter(part => part.type === 'sticker').map(part => part.id), [firstId, secondId, firstId]);
    assert.equal(parts[0].type, 'text');
    assert.equal(parts[0].text, '앞 😀 ');
    assert.equal(parts.at(-1).type, 'text');
    assert.equal(parts.at(-1).text, ' 끝');
    assert.equal(plain(content), '앞 😀  가운데   끝');
});

test('unknown, malformed and path-like tokens stay visible as ordinary text', () => {
    for (const text of [
        '[[beadyo:missing-fixture-id]]', '[[beadyo:../secret]]', '[[beadyo:__proto__]]',
        `[beadyo:${firstId}]`, `[[beadyo:${firstId}]`, '[[beadyo:]]',
        `[[BEADYO:${firstId}]]`, '[[beadyo:https://example.invalid/x.png]]',
    ]) {
        assert.equal(plain(text), text);
        assert.equal(emoji.parse(text).some(part => part.type === 'sticker'), false);
        assert.equal(emoji.render(text).includes('<img'), false);
        assert.equal(emoji.decode(text).text, text);
    }
});

test('untrusted comment HTML is escaped while approved sticker tokens still render', () => {
    const attack = '<img src=x onerror="alert(1)"><script>alert(2)</script> & \'quoted\'';
    const html = emoji.render(`${attack}\n${token(firstId)}`);
    assert.match(html, /&lt;img src=x/);
    assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
    assert.match(html, /&amp;/);
    assert.doesNotMatch(html, /<script|<img src=x|<[^>]+\sonerror\s*=/);
    assert.equal((html.match(/<img\b/g) || []).length, 1);
    assert.ok(html.includes('quoted'));
});

test('rendered catalog stickers resolve to existing local images with accessible labels', () => {
    for (const item of emoji.catalog) {
        const html = emoji.render(token(item.id));
        assert.equal((html.match(/<img\b/g) || []).length, 1, item.id);
        const src = html.match(/\bsrc="([^"]+)"/)?.[1];
        assert.ok(src, item.id);
        assert.doesNotMatch(src, /^(?:[a-z]+:|\/\/)|[<>]/i);
        const localPath = path.resolve(root, decodeURIComponent(src.split(/[?#]/)[0]));
        assert.ok(localPath.startsWith(root + path.sep), item.id);
        assert.ok(fs.statSync(localPath).isFile(), item.id);
        assert.match(html, /\balt="[^"]+"/);
    }
});

test('decoding an existing sticker-only comment makes it editable without exposing storage tokens', () => {
    const content = `${token(firstId)}\n${token(secondId)}`;
    const decoded = emoji.decode(content);
    assert.equal(decoded.text.trim(), '');
    assert.deepEqual(decoded.stickers, [firstId, secondId]);
    const encoded = emoji.encode(decoded.text, decoded.stickers);
    assert.deepEqual(emoji.decode(encoded).stickers, [firstId, secondId]);
    assert.ok(encoded.trim().length > 0);
});

test('saving an edited mixed comment retains selected stickers and Unicode text', () => {
    const saved = emoji.encode('  수정한 테스트용 댓글 👩🏽‍💻\n다음 줄  ', [firstId, secondId, firstId]);
    assert.ok(saved.startsWith('수정한 테스트용 댓글 👩🏽‍💻\n다음 줄\n'));
    const decoded = emoji.decode(saved);
    assert.equal(decoded.text.trim(), '수정한 테스트용 댓글 👩🏽‍💻\n다음 줄');
    assert.deepEqual(decoded.stickers, [firstId, secondId, firstId]);
});

test('encoding ignores unregistered selections and removing all selected stickers leaves only text', () => {
    assert.equal(emoji.encode('  테스트용 댓글  ', []), '테스트용 댓글');
    assert.equal(emoji.encode('  테스트용 댓글  ', ['missing-fixture-id', '__proto__']), '테스트용 댓글');
    assert.equal(emoji.encode(' \n ', []), '');
    assert.equal(emoji.encode('', ['missing-fixture-id']), '');
    assert.deepEqual(emoji.decode(emoji.encode('', [firstId, 'missing-fixture-id', secondId])).stickers, [firstId, secondId]);
});

test('inserting OS emoji uses the current caret and returns its new UTF-16 position', () => {
    assert.deepEqual(emoji.insertText('앞뒤', 1, 1, '😀'), { value: '앞😀뒤', position: 3 });
    assert.deepEqual(emoji.insertText('😀 뒤', 2, 2, '🇰🇷'), { value: '😀🇰🇷 뒤', position: 6 });
});

test('emoji insertion replaces selected text instead of appending to another location', () => {
    assert.deepEqual(emoji.insertText('앞 선택 뒤', 2, 4, '👨‍👩‍👧‍👦'), {
        value: '앞 👨‍👩‍👧‍👦 뒤', position: 2 + '👨‍👩‍👧‍👦'.length,
    });
    assert.deepEqual(emoji.insertText('모두 선택', 0, 5, '👍🏽'), { value: '👍🏽', position: '👍🏽'.length });
});

test('insertion respects the existing 1000-unit textarea limit without truncating an emoji sequence', () => {
    const accepted = emoji.insertText('가'.repeat(998), 998, 998, '😀');
    assert.equal(accepted.value.length, 1000);
    assert.ok(accepted.value.endsWith('😀'));
    assert.equal(accepted.position, 1000);
    assert.equal(emoji.insertText('가'.repeat(999), 999, 999, '😀'), null);
    assert.equal(emoji.insertText('가'.repeat(999), 999, 999, '👨‍👩‍👧‍👦'), null);
});

test('replacing a selection can free capacity at the limit and a custom limit is honored', () => {
    const accepted = emoji.insertText('가'.repeat(1000), 20, 22, '😀');
    assert.equal(accepted.value.length, 1000);
    assert.equal(accepted.position, 22);
    assert.deepEqual(emoji.insertText('12', 1, 2, '😀', 3), { value: '1😀', position: 3 });
    assert.equal(emoji.insertText('12', 1, 1, '😀', 3), null);
});

test('the complete native catalog is available locally with unique emoji and readable labels', () => {
    const data = require('../comment-native-emojis-data.js');
    assert.ok(data.length > 3000, 'the picker must contain the full emoji catalog rather than a favorites subset');
    assert.equal(emoji.nativeCatalog.length, data.length);
    assert.equal(new Set(emoji.nativeCatalog.map(item => item.emoji)).size, data.length);
    assert.ok(new Set(emoji.nativeCatalog.map(item => item.group)).size >= 9);
    for (const item of emoji.nativeCatalog) {
        assert.equal(typeof item.emoji, 'string');
        assert.ok(item.emoji.length > 0);
        assert.equal(typeof item.label, 'string');
        assert.ok(item.label.trim().length > 0);
        assert.equal(typeof item.group, 'string');
        assert.ok(item.group.trim().length > 0);
    }
    for (const sequence of ['😀', '👩🏽‍💻', '👍🏽', '🇰🇷', '👨‍👩‍👧‍👦']) {
        assert.ok(emoji.nativeCatalog.some(item => item.emoji === sequence), sequence);
    }
});

test('empty native search exposes every emoji and Korean, English and emoji searches are supported', () => {
    assert.deepEqual(emoji.filterNativeEmojis(''), emoji.nativeCatalog);
    assert.deepEqual(emoji.filterNativeEmojis('  \n  '), emoji.nativeCatalog);
    assert.ok(emoji.filterNativeEmojis('배구').some(item => item.emoji === '🏐'));
    assert.ok(emoji.filterNativeEmojis('volleyball').some(item => item.emoji === '🏐'));
    assert.ok(emoji.filterNativeEmojis('🇰🇷').some(item => item.emoji === '🇰🇷'));
    assert.ok(emoji.filterNativeEmojis('피부').some(item => item.emoji === '👍🏽'));
});

test('native search normalizes surrounding and repeated whitespace, letter case and fullwidth text', () => {
    const expected = emoji.filterNativeEmojis('grinning face');
    assert.ok(expected.length > 0);
    assert.deepEqual(emoji.filterNativeEmojis('  GRINNING   FACE  '), expected);
    assert.deepEqual(emoji.filterNativeEmojis('ＶＯＬＬＥＹＢＡＬＬ'), emoji.filterNativeEmojis('volleyball'));
    assert.deepEqual(emoji.filterNativeEmojis('  배구  '), emoji.filterNativeEmojis('배구'));
});

test('native search has an honest empty state and never falls back to unrelated favorites', () => {
    const query = '존재하지않는테스트용이모지_990001';
    assert.deepEqual(emoji.filterNativeEmojis(query), []);
    assert.doesNotMatch(emoji.renderNativeEmojis(query), /data-insert-emoji=/);
    assert.ok(emoji.renderNativeEmojis(query).trim().length > 0, 'the empty state should explain why the grid is empty');
});

test('native popup markup provides every emoji directly and preserves group headings and accessible labels', () => {
    const markup = emoji.renderNativeEmojis();
    const choices = [...markup.matchAll(/data-insert-emoji="([^"]+)"/g)].map(match => match[1]);
    assert.equal(choices.length, emoji.nativeCatalog.length);
    assert.equal(new Set(choices).size, emoji.nativeCatalog.length);
    assert.equal((markup.match(/<h3\b/g) || []).length, new Set(emoji.nativeCatalog.map(item => item.group)).size);
    assert.equal((markup.match(/class="native-emoji"/g) || []).length, emoji.nativeCatalog.length);
    assert.equal((markup.match(/aria-label="[^"]+"/g) || []).length, emoji.nativeCatalog.length);
    assert.doesNotMatch(markup, /Control|Windows 키|Space|단축키/);
    const searched = emoji.renderNativeEmojis('배구');
    assert.equal((searched.match(/data-insert-emoji=/g) || []).length, emoji.filterNativeEmojis('배구').length);
});

test('untrusted native labels and headings are escaped before being inserted into popup HTML', () => {
    const label = '<script>fixture</script> "quoted" & \'label\'';
    const group = '<img src=x onerror="fixture">';
    const sandbox = { module: { exports: {} }, require(name) {
        if (name === './comment-native-emojis-data.js') return [{ emoji: '😀', label, group, keywords: [] }];
        if (name === './comment-emoticons-data.js') return [];
        throw Error(name);
    } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'comment-emoticons.js'), 'utf8'), sandbox);
    const markup = sandbox.module.exports.renderNativeEmojis();
    assert.match(markup, /&lt;script&gt;fixture&lt;\/script&gt;/);
    assert.match(markup, /&quot;quoted&quot;/);
    assert.match(markup, /&amp;/);
    assert.match(markup, /&lt;img/);
    assert.doesNotMatch(markup, /<script|<img\b|<[^>]+\sonerror\s*=/);
});

test('each native selection inserts and saves its complete Unicode sequence without losing skin tones, joins or flags', () => {
    for (const { emoji: sequence } of emoji.nativeCatalog) {
        const inserted = emoji.insertText('[앞][뒤]', 3, 3, sequence);
        assert.deepEqual(inserted, { value: `[앞]${sequence}[뒤]`, position: 3 + sequence.length });
        assert.equal(emoji.encode(inserted.value, []), inserted.value);
        assert.equal(emoji.decode(inserted.value).text, inserted.value);
        assert.equal(emoji.render(inserted.value), inserted.value);
        assert.deepEqual(emoji.insertText('가'.repeat(999), 999, 999, sequence), sequence.length > 1 ? null : {
            value: '가'.repeat(999) + sequence, position: 1000,
        });
    }
});

function nativeSearchHarness() {
    const listeners = {}, hint = { textContent: '' };
    const grid = { innerHTML: '', scrollTop: 0, classList: classList(), setAttribute() {} };
    const search = { value: '', hidden: true, matches(selector) { return selector === '[data-search-emoji]'; },
        closest(selector) { assert.equal(selector, '.comment-emoji-panel'); return panel; } };
    const panel = { dataset: { kind: 'native' }, querySelector(selector) {
        if (selector === '[data-search-emoji]') return search;
        if (selector === '.comment-emoji-hint') return hint;
        if (selector === '.comment-emoji-grid') return grid;
        throw Error(selector);
    }, querySelectorAll(selector) { assert.equal(selector, '[data-emoji-kind]'); return []; } };
    const localRoot = { addEventListener(type, callback) { listeners[type] = callback; },
        querySelectorAll() { return []; }, ownerDocument: {
            addEventListener() {}, defaultView: { addEventListener() {} },
        },
    };
    emoji.mount(localRoot);
    return { panel, search, grid, hint, input(value) { search.value = value; listeners.input({ target: search }); },
        enter(isComposing = false) {
            let prevented = false;
            listeners.keydown({ key: 'Enter', isComposing, target: search, preventDefault() { prevented = true; } });
            return prevented;
        },
    };
}

test('typing into native search refreshes its result count and grid while preserving the same input', () => {
    const h = nativeSearchHarness(), input = h.search;
    h.input('배구');
    assert.equal(h.search, input);
    assert.equal(h.search.value, '배구');
    assert.equal(h.search.hidden, false);
    assert.match(h.grid.innerHTML, /data-insert-emoji="🏐"/);
    assert.match(h.hint.textContent, new RegExp(`검색 결과 ${emoji.filterNativeEmojis('배구').length}개`));
    h.input('존재하지않는테스트용이모지_990001');
    assert.match(h.grid.innerHTML, /role="status"/);
    assert.match(h.hint.textContent, /검색 결과 0개/);
    h.input('');
    assert.equal((h.grid.innerHTML.match(/data-insert-emoji=/g) || []).length, emoji.nativeCatalog.length);
    assert.match(h.hint.textContent, /전체 이모지/);
});

test('pressing Enter in native search cannot submit the comment form and does not interrupt IME composition', () => {
    const h = nativeSearchHarness();
    assert.equal(h.enter(), true);
    assert.equal(h.enter(true), false);
});

test('switching to custom stickers keeps their complete catalog independent of native search', () => {
    const h = nativeSearchHarness();
    h.panel.dataset.kind = 'custom';
    h.input('존재하지않는테스트용이모지_990001');
    assert.equal(h.search.hidden, true);
    assert.equal((h.grid.innerHTML.match(/data-insert-sticker=/g) || []).length, emoji.catalog.length);
    assert.equal(h.grid.classList.contains('custom'), true);
    assert.doesNotMatch(h.grid.innerHTML, /data-insert-emoji=|danbal-seulyo-ai/);
});

test('new and edit composers accept a sticker-only comment and escape their text', () => {
    for (const editing of [false, true]) {
        const markup = emoji.composer({ key: '[test-only] "key"', value: `<script>test</script>\n${token(firstId)}`, editing });
        const textarea = markup.match(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/);
        assert.ok(textarea);
        assert.doesNotMatch(textarea[1], /\brequired(?:\s|=|$)/);
        assert.match(textarea[2], /&lt;script&gt;test&lt;\/script&gt;/);
        assert.doesNotMatch(textarea[2], /\[\[beadyo:/);
        assert.match(markup, new RegExp(`data-sticker-id="${firstId}"`));
        assert.match(markup, /&quot;key&quot;/);
        assert.doesNotMatch(markup, /<script>/);
    }
});

test('new and edit composers expose a collapsed popup trigger instead of an inline disclosure', () => {
    const panelIds = new Set();
    for (const editing of [false, true]) {
        const markup = emoji.composer({ key: `test-only:${editing ? 'edit' : 'new'}`, editing });
        assert.doesNotMatch(markup, /<details\b|<summary\b/);
        const trigger = markup.match(/<button\b[^>]*data-toggle-emoji\b[^>]*>/)?.[0];
        assert.ok(trigger);
        assert.match(trigger, /type="button"/);
        assert.match(trigger, /aria-expanded="false"/);
        assert.match(trigger, /aria-haspopup="dialog"/);
        assert.match(markup, /class="comment-emoji-panel"/);
        assert.match(markup, /popover="auto"/);
        assert.match(markup, /role="dialog"/);
        const panelId = markup.match(/<div id="([^"]+)" class="comment-emoji-panel"/)?.[1];
        assert.ok(panelId);
        assert.ok(trigger.includes(`aria-controls="${panelId}"`));
        assert.ok(trigger.includes(`popovertarget="${panelId}"`));
        assert.equal(panelIds.has(panelId), false, 'separate comment editors need separate popup targets');
        panelIds.add(panelId);
    }
});

for (const width of [320, 375, 1280]) {
    test(`popup placement stays within the ${width}px viewport at either edge and above or below its trigger`, () => {
        const viewport = { width, height: 720 };
        for (const left of [0, width / 2, width - 32]) {
            for (const top of [0, 280, 680]) {
                const position = emoji.popupPosition({ left, top, bottom: top + 32 }, viewport);
                assert.ok(position.left >= 12);
                assert.ok(position.left + position.width <= width - 12);
                assert.ok(position.top >= 12);
                assert.ok(position.top + position.height <= viewport.height - 12);
                assert.ok(position.width > 0 && position.width <= 400);
                assert.ok(position.height > 0 && position.height <= 460);
            }
        }
    });
}

test('popup placement uses the visible keyboard or zoom viewport offset and available height', () => {
    const viewport = { left: 35, top: 320, width: 320, height: 230 };
    const position = emoji.popupPosition({ left: 24, top: 500, bottom: 532 }, viewport);
    assert.ok(position.left >= viewport.left + 12);
    assert.ok(position.left + position.width <= viewport.left + viewport.width - 12);
    assert.ok(position.top >= viewport.top + 12);
    assert.ok(position.top + position.height <= viewport.top + viewport.height - 12);
    assert.ok(position.height > 0 && position.height < 230);
});

test('popup placement opens above a low trigger and below a trigger near the top', () => {
    const viewport = { width: 1280, height: 800 };
    const nearBottom = { left: 650, top: 740, bottom: 772 };
    const above = emoji.popupPosition(nearBottom, viewport);
    assert.ok(above.top + above.height <= nearBottom.top - 8);
    const nearTop = { left: 650, top: 20, bottom: 52 };
    const below = emoji.popupPosition(nearTop, viewport);
    assert.ok(below.top >= nearTop.bottom + 8);
});

test('a short keyboard viewport gives the popup usable height instead of squeezing it beside the trigger', () => {
    const viewport = { width: 320, height: 300 };
    const position = emoji.popupPosition({ left: 30, top: 140, bottom: 172 }, viewport);
    assert.deepEqual(position, { left: 12, top: 12, width: 296, height: 276 });
    assert.ok(position.top + position.height <= viewport.height - 12);
    const shifted = emoji.popupPosition({ left: 65, top: 460, bottom: 492 }, { ...viewport, left: 35, top: 320 });
    assert.deepEqual(shifted, { left: 47, top: 332, width: 296, height: 276 });
});

function classList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        contains(value) { return values.has(value); },
        toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); },
    };
}

function popupFixture(composer, { open = false, native = true } = {}) {
    let nativeOpen = open, hides = 0;
    const trigger = { disabled: false, attributes: { 'aria-expanded': String(open) }, focused: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { this.focused = true; },
    };
    const panel = { classList: classList(open ? ['is-open'] : []),
        closest(selector) { assert.equal(selector, '[data-comment-composer]'); return composer(); },
        matches(selector) { assert.equal(selector, ':popover-open'); return nativeOpen; },
    };
    if (native) {
        panel.hidePopover = () => { nativeOpen = false; hides++; };
        panel.showPopover = () => { nativeOpen = true; };
    }
    return { panel, trigger, hides: () => hides, nativeOpen: () => nativeOpen };
}

function draftComposer(key, text, ids = []) {
    let selected = [...ids];
    const textarea = { value: text, maxLength: 1000, selectionStart: 0, selectionEnd: 0,
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
    const selectedBox = { hidden: ids.length === 0, set innerHTML(html) {
        selected = [...html.matchAll(/data-sticker-id="([^"]+)"/g)].map(match => match[1]);
    } };
    const composer = { dataset: { commentComposer: key }, querySelector(selector) {
        if (selector === 'textarea') return textarea;
        if (selector === '.comment-selected-stickers') return selectedBox;
        throw Error(selector);
    }, querySelectorAll(selector) {
        assert.equal(selector, '[data-sticker-id]');
        return selected.map(stickerId => ({ dataset: { stickerId } }));
    } };
    return { composer, textarea, selectedBox, selected: () => selected };
}

for (const native of [true, false]) {
    test(`saving closes the ${native ? 'native' : 'fallback'} popup and prevents selection without losing a draft`, () => {
        const draft = draftComposer('new:test-only', '[테스트용] 저장 대기 😀', [firstId]);
        const popup = popupFixture(() => draft.composer, { open: true, native });
        const attributes = {}, insert = { disabled: false }, search = { disabled: false };
        const originalQuery = draft.composer.querySelector, originalQueryAll = draft.composer.querySelectorAll;
        draft.composer.setAttribute = (name, value) => { attributes[name] = value; };
        draft.composer.querySelector = selector => {
            if (selector === '.comment-emoji-panel') return popup.panel;
            if (selector === '[data-toggle-emoji]') return popup.trigger;
            return originalQuery(selector);
        };
        draft.composer.querySelectorAll = selector => selector === 'textarea, input, button, select'
            ? [draft.textarea, popup.trigger, insert, search] : originalQueryAll(selector);
        const content = emoji.getContent(draft.composer);
        emoji.setBusy(draft.composer, true);
        assert.equal(attributes['aria-busy'], 'true');
        assert.equal(popup.panel.classList.contains('is-open'), false);
        assert.equal(popup.trigger.attributes['aria-expanded'], 'false');
        assert.equal(popup.hides(), native ? 1 : 0);
        assert.equal(popup.trigger.focused, false);
        for (const control of [draft.textarea, popup.trigger, insert, search]) assert.equal(control.disabled, true);
        emoji.setBusy(draft.composer, false);
        assert.equal(attributes['aria-busy'], 'false');
        for (const control of [draft.textarea, popup.trigger, insert, search]) assert.equal(control.disabled, false);
        assert.equal(popup.panel.classList.contains('is-open'), false);
        assert.equal(emoji.getContent(draft.composer), content);
    });
}

test('draft capture and restore preserve raw whitespace, selection and each comment’s own stickers', () => {
    const a = draftComposer(`new:${REQUEST_ID}`, '  [테스트용] 작성 중 😀\n  ', [firstId, firstId]);
    const b = draftComposer(`edit:${COMMENT_ID}`, '[테스트용] 다른 댓글 ', [secondId]);
    a.textarea.setSelectionRange(2, 8);
    b.textarea.setSelectionRange(0, 4);
    const oldRoot = { querySelectorAll(selector) { assert.equal(selector, '[data-comment-composer]'); return [a.composer, b.composer]; } };
    const drafts = emoji.capture(oldRoot);
    const freshA = draftComposer(`new:${REQUEST_ID}`, ''), freshB = draftComposer(`edit:${COMMENT_ID}`, 'saved value');
    const freshRoot = { querySelectorAll(selector) { assert.equal(selector, '[data-comment-composer]'); return [freshB.composer, freshA.composer]; } };
    emoji.restore(freshRoot, drafts);
    assert.equal(freshA.textarea.value, a.textarea.value);
    assert.equal(freshB.textarea.value, b.textarea.value);
    assert.deepEqual(freshA.selected(), [firstId, firstId]);
    assert.deepEqual(freshB.selected(), [secondId]);
    assert.equal(freshA.textarea.selectionStart, 2);
    assert.equal(freshA.textarea.selectionEnd, 8);
    assert.equal(freshB.textarea.selectionStart, 0);
    assert.equal(freshB.textarea.selectionEnd, 4);
    assert.equal(freshA.selectedBox.hidden, false);
    assert.equal(emoji.getContent(freshA.composer), emoji.encode(a.textarea.value, [firstId, firstId]));
});

test('restoring attachments reserves their storage length and restores full capacity after removing them', () => {
    const draft = draftComposer('new:test-only', '[테스트용]', [firstId]);
    const localRoot = { querySelectorAll: () => [draft.composer] };
    emoji.restore(localRoot, new Map());
    assert.equal(draft.textarea.maxLength, emoji.MAX_LENGTH - token(firstId).length - 1);
    draft.selectedBox.innerHTML = '';
    emoji.restore(localRoot, new Map());
    assert.equal(draft.textarea.maxLength, 1000);
    assert.equal(draft.selectedBox.hidden, true);
});

const board = fs.readFileSync(path.join(root, 'development-requests.html'), 'utf8');
function boardSection(from, until) {
    const start = board.indexOf(from), end = board.indexOf(until, start);
    assert.ok(start >= 0 && end > start, from);
    return board.slice(start, end);
}
const REQUEST_ID = 990001, COMMENT_ID = 990002;
function commentHarness({ text = '[테스트용] 댓글 😀', stickers = [firstId], result = 'success', admin = false, owner = true } = {}) {
    const busy = {}, notices = [], renders = [], calls = [];
    const popup = popupFixture(() => composer, { open: true });
    const textarea = { value: text, disabled: false, focused: false, focus() { this.focused = true; }, closest(selector) {
        assert.equal(selector, '[data-comment-composer]'); return composer;
    } };
    const stickerNodes = stickers.map(stickerId => ({ dataset: { stickerId } }));
    const pickerButton = popup.trigger;
    const composer = { dataset: { commentComposer: '' },
        setAttribute(name, value) { busy[name] = value; },
        closest(selector) { assert.equal(selector, '.comment-form, .comment-edit-form'); return form; },
        querySelector(selector) {
            if (selector === 'textarea') return textarea;
            if (selector === '.comment-emoji-panel') return popup.panel;
            if (selector === '[data-toggle-emoji]') return popup.trigger;
            throw Error(selector);
        },
        querySelectorAll(selector) {
            if (selector === '[data-sticker-id]') return stickerNodes;
            if (selector === 'textarea, input, button, select') return [textarea, pickerButton];
            throw Error(selector);
        },
    };
    const button = { dataset: { commentId: String(COMMENT_ID) }, disabled: false, textContent: '등록', closest(selector) {
        assert.equal(selector, '.comment-item'); return { querySelector(selector) { assert.equal(selector, '.comment-edit-content'); return textarea; } };
    } };
    const form = { dataset: { requestId: String(REQUEST_ID) }, querySelector(selector) {
        if (selector === '.comment-content') return textarea;
        if (selector === '.comment-submit-btn' || selector === '.comment-submit-btn, [data-action="save-comment-edit"]') return button;
        if (selector === '[data-comment-composer]') return composer;
        throw Error(selector);
    }, querySelectorAll(selector) { assert.equal(selector, '.comment-submit-btn, .comment-actions button'); return [button]; } };
    const original = { id: COMMENT_ID, request_id: REQUEST_ID, author_id: owner ? 'test-user-only' : 'other-fixture-user', content: '[테스트용] 기존 댓글' };
    const state = { user: { id: 'test-user-only' }, isAdmin: admin, comments: { [REQUEST_ID]: [original] }, editingCommentId: COMMENT_ID };
    let resolvePending;
    const pending = result === 'pending' ? new Promise(resolve => { resolvePending = resolve; }) : null;
    function response(call) {
        if (result === 'throw') return Promise.reject(new Error('fixture-only rejected write'));
        if (result === 'error') return Promise.resolve({ error: { message: 'fixture-only returned error' } });
        if (pending) return pending;
        return Promise.resolve({ data: { id: 990003, ...call.payload }, error: null });
    }
    const db = { from(table) {
        assert.equal(table, 'development_request_comments');
        return {
            insert(payload) {
                const call = { kind: 'insert', payload, eq: [] }; calls.push(call);
                return { select() { return { single() { return response(call); } }; } };
            },
            update(payload) {
                const call = { kind: 'update', payload, eq: [] }; calls.push(call);
                const query = { eq(key, value) { call.eq.push([key, value]); return query; }, then(resolve, reject) { return response(call).then(resolve, reject); } };
                return query;
            },
        };
    } };
    const commentPending = new Set(), commentDiscardDrafts = new Set();
    const ctx = vm.createContext({ state, db, BeadyoCommentEmoji: emoji, commentPending, commentDiscardDrafts,
        document: { querySelectorAll(selector) { assert.equal(selector, '[data-comment-composer]'); return [composer]; } },
        currentUserName: () => '[테스트용] 사용자', currentUserAvatar: () => '',
        showToast: (message, type) => notices.push({ message, type }), renderRequests: key => renders.push(key),
        console: { error() {} },
    });
    vm.runInContext(boardSection('        function commentsForRequest(', '        function commentActions('), ctx);
    vm.runInContext(boardSection('        function applyCommentPending(', '        function renderRequests('), ctx);
    vm.runInContext(boardSection('        async function submitComment(', '        function startCommentEdit('), ctx);
    vm.runInContext(boardSection('        async function saveCommentEdit(', '        async function deleteComment('), ctx);
    return { state, original, textarea, button, form, composer, busy, popup, notices, renders, calls, commentPending, commentDiscardDrafts,
        finish() { resolvePending({ data: { id: 990003, request_id: REQUEST_ID, content: emoji.getContent(composer) }, error: null }); },
        run(kind) {
            composer.dataset.commentComposer = `${kind === 'insert' ? 'new' : 'edit'}:${kind === 'insert' ? REQUEST_ID : COMMENT_ID}`;
            return kind === 'insert' ? ctx.submitComment(form) : ctx.saveCommentEdit(button);
        },
        runWithFreshButton(kind) {
            const freshButton = { ...button, disabled: false };
            const freshForm = { ...form, querySelector(selector) {
                return selector === '.comment-submit-btn' ? freshButton : form.querySelector(selector);
            } };
            return kind === 'insert' ? ctx.submitComment(freshForm) : ctx.saveCommentEdit(freshButton);
        },
    };
}

for (const kind of ['insert', 'update']) {
    test(`${kind}: existing board handler saves OS text and custom tokens through the ordinary content field`, async () => {
        const h = commentHarness();
        await h.run(kind);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].kind, kind);
        assert.equal(h.calls[0].payload.content, emoji.encode('[테스트용] 댓글 😀', [firstId]));
        assert.equal(h.renders[0], `${kind === 'insert' ? 'new' : 'edit'}:${kind === 'insert' ? REQUEST_ID : COMMENT_ID}`);
        if (kind === 'insert') {
            assert.equal(h.calls[0].payload.request_id, REQUEST_ID);
            assert.equal(h.state.comments[REQUEST_ID].length, 2);
            assert.equal(h.original.content, '[테스트용] 기존 댓글');
        } else {
            assert.deepEqual(h.calls[0].eq, [['id', COMMENT_ID], ['author_id', 'test-user-only']]);
            assert.equal(h.original.content, h.calls[0].payload.content);
            assert.equal(h.state.editingCommentId, null);
        }
        assert.equal(h.button.disabled, false);
        assert.equal(h.textarea.disabled, false);
        assert.equal(h.busy['aria-busy'], 'false');
    });

    test(`${kind}: a sticker without text is valid while a completely empty comment makes no request`, async () => {
        const stickerOnly = commentHarness({ text: '   ', stickers: [firstId] });
        await stickerOnly.run(kind);
        assert.equal(stickerOnly.calls[0].payload.content, token(firstId));
        const empty = commentHarness({ text: ' \n ', stickers: [] });
        await empty.run(kind);
        assert.equal(empty.calls.length, 0);
        assert.equal(empty.textarea.focused, true);
        assert.equal(empty.notices[0].type, 'error');
    });

    test(`${kind}: the serialized text plus sticker tokens must fit the existing limit`, async () => {
        const h = commentHarness({ text: '가'.repeat(999), stickers: [firstId] });
        await h.run(kind);
        assert.equal(h.calls.length, 0);
        assert.equal(h.renders.length, 0);
        assert.match(h.notices[0].message, /1,000/);
        assert.equal(h.button.disabled, false);
        const boundary = commentHarness({ text: '가'.repeat(1000), stickers: [] });
        await boundary.run(kind);
        assert.equal(boundary.calls[0].payload.content.length, 1000);
    });

    for (const result of ['error', 'throw']) {
        test(`${kind}: a ${result} response preserves the draft and record, then releases controls`, async () => {
            const h = commentHarness({ result });
            const draft = emoji.getContent(h.composer);
            await h.run(kind);
            assert.equal(h.calls.length, 1);
            assert.equal(h.renders.length, 0);
            assert.equal(emoji.getContent(h.composer), draft);
            assert.equal(h.original.content, '[테스트용] 기존 댓글');
            assert.equal(h.state.comments[REQUEST_ID].length, 1);
            assert.equal(h.button.disabled, false);
            assert.equal(h.textarea.disabled, false);
            assert.equal(h.busy['aria-busy'], 'false');
            assert.equal(h.notices.at(-1).type, 'error');
        });
    }

    test(`${kind}: repeated clicks during an in-flight save issue only one write`, async () => {
        const h = commentHarness({ result: 'pending' });
        const first = h.run(kind);
        assert.equal(h.button.disabled, true);
        assert.equal(h.textarea.disabled, true);
        assert.equal(h.busy['aria-busy'], 'true');
        assert.equal(h.popup.nativeOpen(), false);
        assert.equal(h.popup.panel.classList.contains('is-open'), false);
        assert.equal(h.popup.trigger.attributes['aria-expanded'], 'false');
        await h.run(kind);
        assert.equal(h.calls.length, 1);
        h.finish();
        await first;
        assert.equal(h.calls.length, 1);
        assert.equal(h.button.disabled, false);
        assert.equal(h.textarea.disabled, false);
        assert.equal(h.busy['aria-busy'], 'false');
        assert.equal(h.commentPending.size, 0);
    });

    test(`${kind}: replacing the submit DOM with an enabled control cannot bypass the pending-key lock`, async () => {
        const h = commentHarness({ result: 'pending' });
        const first = h.run(kind);
        assert.equal(h.commentPending.size, 1);
        await h.runWithFreshButton(kind);
        assert.equal(h.calls.length, 1);
        h.finish();
        await first;
        assert.equal(h.calls.length, 1);
        assert.equal(h.commentPending.size, 0);
    });

    test(`${kind}: a successfully saved draft waiting for IME render cannot be submitted again`, async () => {
        const h = commentHarness();
        h.commentDiscardDrafts.add(`${kind === 'insert' ? 'new' : 'edit'}:${kind === 'insert' ? REQUEST_ID : COMMENT_ID}`);
        await h.run(kind);
        assert.equal(h.calls.length, 0);
        assert.equal(h.renders.length, 0);
    });
}

test('finishing one comment save does not close a different comment being edited', async () => {
    const h = commentHarness({ result: 'pending' });
    const saved = h.run('update');
    h.state.editingCommentId = 990004;
    h.finish();
    await saved;
    assert.equal(h.state.editingCommentId, 990004);
    assert.deepEqual(h.renders, [`edit:${COMMENT_ID}`]);
});

test('edit ownership is still enforced, while the existing admin scope targets only the chosen comment', async () => {
    const forbidden = commentHarness({ owner: false });
    await forbidden.run('update');
    assert.equal(forbidden.calls.length, 0);
    assert.equal(forbidden.original.content, '[테스트용] 기존 댓글');
    const admin = commentHarness({ owner: false, admin: true });
    await admin.run('update');
    assert.equal(admin.calls.length, 1);
    assert.deepEqual(admin.calls[0].eq, [['id', COMMENT_ID]]);
});

function renderHarness() {
    const savedKey = `new:${REQUEST_ID}`, activeKey = 'new:990010';
    const listeners = {}, timers = [], focused = [], count = { textContent: '' };
    const commentDrafts = new Map(), commentPending = new Set(), commentComposing = new Set(), commentDiscardDrafts = new Set();
    const state = { filter: 'all', requests: [{ id: REQUEST_ID, status: 'received' }, { id: 990010, status: 'received' }] };
    let children, renderCount = 0, document;
    function element(key, text, stickers) {
        const draft = draftComposer(key, text, stickers);
        const button = { disabled: false, textContent: '등록' };
        const popup = popupFixture(() => draft.composer);
        const originalQuery = draft.composer.querySelector, originalQueryAll = draft.composer.querySelectorAll;
        draft.composer.querySelector = selector => {
            if (selector === '.comment-emoji-panel') return popup.panel;
            if (selector === '[data-toggle-emoji]') return popup.trigger;
            return originalQuery(selector);
        };
        draft.composer.querySelectorAll = selector => selector === 'textarea, input, button, select' ? [draft.textarea, button, popup.trigger] : originalQueryAll(selector);
        draft.composer.setAttribute = () => {};
        draft.composer.closest = selector => {
            assert.equal(selector, '.comment-form, .comment-edit-form');
            return { querySelectorAll: () => [button], querySelector: () => button };
        };
        draft.textarea.closest = selector => { assert.equal(selector, '[data-comment-composer]'); return draft.composer; };
        draft.textarea.matches = selector => selector === 'textarea';
        draft.textarea.focus = options => { focused.push({ key, options }); document.activeElement = draft.textarea; };
        return draft;
    }
    children = [element(savedKey, '[테스트용] 이미 저장된 초안 ', [firstId]), element(activeKey, '  [테스트용] 다른 댓글 조합 중  ', [secondId])];
    const list = {
        addEventListener(type, callback) { listeners[type] = callback; },
        querySelectorAll(selector) { assert.equal(selector, '[data-comment-composer]'); return children.map(child => child.composer); },
        contains(target) { return children.some(child => child.textarea === target); },
        set innerHTML(value) {
            assert.equal(typeof value, 'string'); renderCount++;
            children = state.requests.map(request => element(`new:${request.id}`, '', []));
        },
    };
    document = { activeElement: children[1].textarea,
        getElementById(id) { if (id === 'request-list') return list; if (id === 'request-count') return count; throw Error(id); },
        querySelectorAll(selector) { return list.querySelectorAll(selector); },
    };
    const ctx = vm.createContext({ document, state, commentDrafts, commentPending, commentComposing, commentDiscardDrafts,
        commentRenderDeferred: false, BeadyoCommentEmoji: emoji, requestCard: request => `<article data-test-id="${request.id}"></article>`,
        setTimeout(callback, delay) { assert.equal(delay, 0); timers.push(callback); },
    });
    vm.runInContext(boardSection('        function applyCommentPending(', '        async function loadRequests('), ctx);
    vm.runInContext(boardSection("            const commentList = document.getElementById('request-list');", "            const textarea = document.getElementById('request-content');"), ctx);
    return { savedKey, activeKey, ctx, document, commentDrafts, commentPending, commentComposing, commentDiscardDrafts, focused,
        child(key) { return children.find(child => child.composer.dataset.commentComposer === key); },
        renderCount: () => renderCount,
        start(target) { listeners.compositionstart({ target }); },
        end(target) { listeners.compositionend({ target }); },
        flush() { while (timers.length) timers.shift()(); },
    };
}

test('renderRequests defers DOM replacement during IME and keeps successful-draft discard keys across repeated renders', () => {
    const h = renderHarness(), composing = h.child(h.activeKey).textarea;
    h.start(composing);
    h.ctx.renderRequests(h.savedKey);
    h.ctx.renderRequests();
    h.ctx.renderRequests();
    assert.equal(h.renderCount(), 0);
    assert.equal(h.ctx.commentRenderDeferred, true);
    assert.equal(h.commentComposing.has(composing), true);
    assert.equal(h.commentDiscardDrafts.has(h.savedKey), true);
    assert.equal(h.child(h.activeKey).textarea, composing);
    assert.equal(composing.value, '  [테스트용] 다른 댓글 조합 중  ');
    assert.equal(h.focused.length, 0);
});

test('compositionend flushes the real deferred renderer, clears only the saved draft and returns focus to the other comment', () => {
    const h = renderHarness(), composing = h.child(h.activeKey).textarea;
    h.start(composing);
    h.ctx.renderRequests(h.savedKey);
    composing.value = '  [테스트용] 한글 조합 완료 😀\n  ';
    composing.setSelectionRange(3, 11);
    h.end(composing);
    assert.equal(h.renderCount(), 0, 'render must wait until the compositionend input has completed');
    h.flush();
    assert.equal(h.renderCount(), 1);
    assert.equal(h.ctx.commentRenderDeferred, false);
    assert.equal(h.commentComposing.size, 0);
    assert.equal(h.commentDiscardDrafts.size, 0);
    assert.equal(h.commentDrafts.has(h.savedKey), false);
    assert.equal(h.child(h.savedKey).textarea.value, '');
    assert.deepEqual(h.child(h.savedKey).selected(), []);
    const restored = h.child(h.activeKey);
    assert.equal(restored.textarea.value, composing.value);
    assert.deepEqual(restored.selected(), [secondId]);
    assert.equal(restored.textarea.selectionStart, 3);
    assert.equal(restored.textarea.selectionEnd, 11);
    assert.equal(h.document.activeElement, restored.textarea);
    assert.equal(h.focused.length, 1);
    assert.equal(h.focused[0].key, h.activeKey);
    assert.equal(h.focused[0].options.preventScroll, true);
    h.flush();
    assert.equal(h.renderCount(), 1);
});

test('a rerender restores a pending comment draft but does not focus its disabled editor', () => {
    const h = renderHarness();
    h.commentPending.add(h.activeKey);
    h.ctx.renderRequests();
    assert.equal(h.renderCount(), 1);
    assert.equal(h.child(h.activeKey).textarea.value, '  [테스트용] 다른 댓글 조합 중  ');
    assert.deepEqual(h.child(h.activeKey).selected(), [secondId]);
    assert.equal(h.child(h.activeKey).textarea.disabled, true);
    assert.equal(h.focused.length, 0);
    assert.equal(h.commentPending.has(h.activeKey), true);
});
