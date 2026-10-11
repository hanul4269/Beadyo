const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../home-soop.js');
const now = Date.parse('2026-10-10T16:00:00Z');
const post = (id, date, extra = {}) => ({ titleNo: id, bbsNo: 91491306, userId: 'beadyo97', authNo: 101, isGeoblock: false,
    titleName: '실제 공지', userNick: '실제 작성자', profileImage: 'https://profile.img.sooplive.com/LOGO/be/beadyo97/beadyo97.jpg', regDate: date, ...extra });
const board = (contents = [], noticeData = []) => ({ contents, noticeData, meta: { currentPage: 1 } });
test('latest public post compares pinned and normal arrays by actual Korean date, not array position', () => {
    const result = S.latestNotice(board([post(2, '2026-10-10 22:00:00')], [post(1, '2026-10-02 14:00:00')]), now);
    assert.equal(result.length, 1); assert.equal(result[0].id, '2');
    assert.equal(result[0].postedAt, '2026-10-10T13:00:00.000Z');
    assert.equal(result[0].href, 'https://www.sooplive.com/station/beadyo97/post/2');
    assert.equal(result[0].author, '실제 작성자');
});
test('restricted, blocked, other author and other board posts are not displayed', () => {
    const rows = [{ authNo: 102 }, { isGeoblock: true }, { userId: 'other' }, { bbsNo: 1 }].map((extra, i) => post(i + 1, '2026-10-10 22:00:00', extra));
    assert.deepEqual(S.latestNotice(board(rows), now), []);
});
test('empty successful board is distinct from an error or incompatible response', () => {
    assert.deepEqual(S.latestNotice(board(), now), []);
    for (const payload of [null, {}, { error: 'unavailable' }, { contents: [], noticeData: [] }, { ...board(), meta: { currentPage: 2 } }]) assert.throws(() => S.latestNotice(payload, now));
    for (const row of [null, {}, post(1, '2026-10-10 22:00:00', { authNo: undefined })]) assert.throws(() => S.latestNotice(board([row]), now));
});
test('invalid, rolled-over and future timestamps and unsafe post IDs do not become valid notices', () => {
    for (const extra of [{ regDate: '2026-02-30 12:00:00' }, { regDate: '2026-10-10 24:00:00' }, { regDate: '2026-10-11 03:00:00' }, { titleNo: '../secret' }, { titleNo: 9007199254740992 }, { titleName: '' }]) {
        assert.throws(() => S.latestNotice(board([post(1, '2026-10-10 22:00:00', extra)]), now));
    }
});
test('only SOOP HTTPS profile images are accepted; title and author stay plain data', () => {
    for (const image of ['javascript:alert(1)', 'https://evilsooplive.com/x', 'http://profile.img.sooplive.com/x', 'https://user:pass@profile.img.sooplive.com/x']) {
        const result = S.latestNotice(board([post(1, '2026-10-10 22:00:00', { profileImage: image, titleName: '<img onerror=alert(1)>' })]), now);
        assert.equal(result[0].profile, ''); assert.equal(result[0].title, '<img onerror=alert(1)>');
    }
});
test('public board is fetched without cookies, with timeout and actual board ID', async () => {
    const result = await S.read(async (url, ms, options) => {
        assert.equal(new URL(url).searchParams.get('bbsNo'), '91491306');
        assert.equal(ms, 6000); assert.equal(options.credentials, 'omit');
        return { ok: true, json: async () => board() };
    });
    assert.deepEqual(result, []);
    await assert.rejects(S.read(async () => ({ ok: false })));
    await assert.rejects(S.read(async () => { throw Error('offline'); }));
});
test('notice rendering escapes external text and retains actual original URL and timestamp', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(require.resolve('../home.js'), 'utf8');
    const body = source.slice(source.indexOf('    function renderSoop()'), source.indexOf('    function renderContent()'));
    let html = '';
    const data = S.latestNotice(board([post(1, '2026-10-10 22:00:00', { titleName: '<script>bad</script>', userNick: 'a&b' })]), now);
    const render = new Function('sources', 'stateHtml', 'setHtml', 'esc', 'refreshNotice', body + ';return renderSoop;')(
        { soop: { data } }, () => '', (_, value) => { html = value; }, text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'), () => '');
    render();
    assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script>/); assert.match(html, /a&amp;b/);
    assert.match(html, /datetime="2026-10-10T13:00:00.000Z"/); assert.match(html, /\/post\/1"/);
});
