const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cafe = require('../home-cafe.js');
const source = fs.readFileSync(require.resolve('../home.js'), 'utf8');
const body = source.slice(source.indexOf('    function renderCafe()'), source.indexOf('    function renderEvents()'));
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const retiredNotes = /고정 공지를 제외한 최근 글|마지막 확인 후 시간이 지났습니다|목록을 새로고침하는 중|수집된 목록을 다시 불러왔습니다|정기 수집 후 반영/;
function refreshButton() {
    return { disabled: false, textContent: '새로고침', ariaBusy: 'false',
        setAttribute(name, value) { if (name === 'aria-busy') this.ariaBusy = String(value); },
        getAttribute(name) { return name === 'aria-busy' ? this.ariaBusy : null; } };
}
function render(state, button = refreshButton()) {
    let html;
    const document = { getElementById(id) { assert.equal(id, 'home-cafe-refresh'); return button; } };
    const fn = new Function('sources', 'setHtml', 'esc', 'document', body + ';return renderCafe;')(
        { cafe: state }, (id, text) => { assert.equal(id, 'home-cafe'); html = text; }, esc, document);
    fn();
    return html;
}
function payload() {
    const now = Date.now();
    return { schemaVersion: 1, cafeId: '31098081', menuId: '21', boardTitle: '슬요 똥글', fetchedAt: new Date(now).toISOString(),
        posts: Array.from({ length: 6 }, (_, i) => ({ id: String(10 + i), title: i === 5 ? '<img src=x onerror=alert(1)>' : `fixture ${i}`,
            publishedAt: new Date(now - (6 - i) * 3600000).toISOString(), href: `https://cafe.naver.com/f-e/cafes/31098081/articles/${10 + i}` })) };
}
test('normalized newest five render original links, Korean dates and escaped titles', () => {
    const data = cafe.normalize(payload());
    const html = render({ status: 'success', data });
    assert.equal((html.match(/class="home-item home-cafe-item"/g) || []).length, 5);
    assert.match(html, /articles\/15" target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(html, /articles\/10"|<img src=x/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)>/);
    assert.ok(html.indexOf('articles/15') < html.indexOf('articles/11'));
    assert.match(html, new RegExp(`datetime="${data.fetchedAt}"`));
    assert.match(html, /최근 업데이트 · <time/);
    assert.equal((html.match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(html, retiredNotes);
});
test('valid empty board is different from loading or an initial unavailable board', () => {
    assert.match(render(), /불러오는 중/);
    assert.match(render({ status: 'error' }), /불러오지 못했습니다/);
    assert.match(render({ status: 'error' }), /data-home-retry="cafe"/);
    const data = cafe.normalize({ ...payload(), posts: [] });
    const html = render({ status: 'success', data });
    assert.match(html, /현재 표시할 공개 게시글이 없습니다/);
    assert.doesNotMatch(html, /불러오지 못했습니다|불러오는 중/);
});
test('refresh failures and stored fallback keep the actual links and checked time', () => {
    const data = cafe.normalize(payload());
    for (const state of [{ status: 'success', data, refreshError: true }, { status: 'success', data: { ...data, fromCache: true, fetchFailed: true } }]) {
        const html = render(state);
        assert.match(html, /articles\/15"/);
        assert.match(html, /마지막으로 확인한 목록/);
        assert.match(html, /data-home-retry="cafe"/);
        assert.match(html, new RegExp(`datetime="${data.fetchedAt}"`));
    }
    assert.doesNotMatch(render({ status: 'success', data }), /갱신하지 못해|data-home-retry/);
});
test('old source timestamps retain the actual Korean update time without an extra stale-data explanation', () => {
    const data = cafe.normalize(payload());
    data.fetchedAt = '2020-01-01T00:00:00.000Z'; data.stale = true;
    const html = render({ status: 'success', data, at: Date.now() });
    assert.match(html, /datetime="2020-01-01T00:00:00.000Z"/);
    assert.match(html, /최근 업데이트 · <time datetime="2020-01-01T00:00:00\.000Z">2020\. 01\. 01\. 09:00<\/time>/);
    assert.equal((html.match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(html, retiredNotes);
});

test('the cafe card shell has one persistent refresh button with a delegated cafe action', () => {
    const shell = source.slice(source.indexOf('    function shell()'), source.indexOf('    function stateHtml('));
    const buttons = [...shell.matchAll(/<button\b[^>]*\bid="home-cafe-refresh"[^>]*>/g)];
    assert.equal(buttons.length, 1);
    assert.match(buttons[0][0], /type="button"/);
    assert.match(buttons[0][0], /data-home-refresh="cafe"/);
});

test('initial loading marks refresh as busy and disabled, then enables it on success or error', () => {
    const button = refreshButton(), data = cafe.normalize(payload());
    render({ status: 'loading' }, button);
    assert.equal(button.disabled, true); assert.equal(button.textContent, '갱신 중…'); assert.equal(button.ariaBusy, 'true');
    render({ status: 'success', data }, button);
    assert.equal(button.disabled, false); assert.equal(button.textContent, '새로고침'); assert.equal(button.ariaBusy, 'false');
    render({ status: 'loading' }, button);
    render({ status: 'error' }, button);
    assert.equal(button.disabled, false); assert.equal(button.textContent, '새로고침'); assert.equal(button.ariaBusy, 'false');
});

test('in-flight refresh renders keep the control disabled and the same five source links visible', () => {
    const button = refreshButton(), data = cafe.normalize(payload());
    render({ status: 'success', data }, button);
    for (let i = 0; i < 3; i++) {
        const html = render({ status: 'success', data, refreshing: true }, button);
        assert.equal(button.disabled, true); assert.equal(button.textContent, '갱신 중…'); assert.equal(button.ariaBusy, 'true');
        assert.equal((html.match(/class="home-item home-cafe-item"/g) || []).length, 5);
        for (const post of data.posts) assert.ok(html.includes(`href="${post.href}"`));
        assert.match(html, new RegExp(`datetime="${data.fetchedAt}"`));
        assert.equal((html.match(/<p\b/g) || []).length, 1);
        assert.doesNotMatch(html, retiredNotes);
        assert.doesNotMatch(html, /role="status"/);
        // The static header control stays outside the replaced list, preserving its focus and disabled state.
        assert.doesNotMatch(html, /id="home-cafe-refresh"|data-home-refresh="cafe"/);
    }
});

test('refresh completion reenables the header control while leaving only the update-time footer', () => {
    const button = refreshButton(), data = cafe.normalize(payload());
    render({ status: 'success', data, refreshing: true }, button);
    const html = render({ status: 'success', data }, button);
    assert.match(html, /최근 업데이트 · <time/);
    assert.equal((html.match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(html, retiredNotes);
    assert.doesNotMatch(html, /role="status"/);
    assert.doesNotMatch(source, /manualRefreshed/);
    assert.equal(button.disabled, false); assert.equal(button.textContent, '새로고침'); assert.equal(button.ariaBusy, 'false');
});

test('manual reload of a valid empty list is successful and never invents source posts', () => {
    const data = cafe.normalize({ ...payload(), posts: [] }), button = refreshButton();
    const html = render({ status: 'success', data }, button);
    assert.match(html, /현재 표시할 공개 게시글이 없습니다/);
    assert.match(html, /최근 업데이트 · <time/);
    assert.doesNotMatch(html, retiredNotes);
    assert.doesNotMatch(html, /class="home-item home-cafe-item"|갱신하지 못해/);
    assert.equal(button.disabled, false); assert.equal(button.ariaBusy, 'false');
});
