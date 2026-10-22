const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const archive = fs.readFileSync(path.join(root, 'dance-archive.html'), 'utf8');
const common = fs.readFileSync(path.join(root, 'beadyo-common.js'), 'utf8');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `Missing source section: ${start}`);
    return source.slice(from, to);
}

function harness() {
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { classList: { remove() {} }, removeAttribute() {} });
        return nodes.get(id);
    };
    const opened = [];
    const copied = [];
    const ctx = vm.createContext({
        URL, console,
        global: { location: { href: 'https://beadyo.com/dance-archive.html' } },
        document: { getElementById: node },
        navigator: { clipboard: { writeText: async value => copied.push(value) } },
        window: { open: (...args) => opened.push(args), BeadyoModalFocus: { activate() {} } },
        PLACEHOLDER_THUMBNAILS: new Set(['', 'banner.jpg', 'loading-img.png', 'songbook-char.png']),
        sourceLabels: { soop: 'SOOP' }, statusLabels: { review: '검토 필요' },
        selectedVideo: () => ctx.video,
        setVideoStatus() {}, closeVideoModal() {},
        setTimeout() {},
    });
    vm.runInContext(section(common, '    function safeUrl(', '    async function fetchWithTimeout('), ctx);
    ctx.BeadyoCommon = { safeUrl: ctx.safeUrl };
    vm.runInContext(section(common, '    function esc(', '    function safeUrl('), ctx);
    for (const [start, end] of [
        ['        function getYouTubeId(', '        function shouldExcludeVideo('],
        ['        function normalizeVideo(', '        function mergeVideos('],
        ['        function getVideoEmbedUrl(', '        function closeVideoModal('],
        ['        function renderDetail(', '        async function setVideoStatus('],
    ]) vm.runInContext(section(archive, start, end), ctx);
    return { ctx, node, opened, copied };
}

test('archive refuses executable, untrusted and malformed iframe URLs', () => {
    const { ctx } = harness();
    for (const url of [
        'javascript:void(0)', 'JaVaScRiPt:void(0)', 'data:text/html,inspection-only',
        'blob:https://beadyo.com/fake', 'about:blank', '/same-origin.html',
        'https://attacker.test/frame', 'https://youtube.com.attacker.test/watch?v=abc123_-XYZ',
        'https://attacker-youtu.be/abc123_-XYZ', 'https://sooplive.com.attacker.test/player/123',
        'https://www.youtube.com/watch?v=bad-id', 'not a URL', '',
    ]) assert.equal(ctx.getVideoEmbedUrl({ url }), 'about:blank', url);
});

test('archive preserves supported YouTube and SOOP embeds', () => {
    const { ctx } = harness();
    for (const url of [
        'https://youtu.be/abc123_-XYZ', 'https://www.youtube.com/watch?v=abc123_-XYZ',
        'https://www.youtube.com/shorts/abc123_-XYZ', 'https://www.youtube.com/embed/abc123_-XYZ',
    ]) assert.equal(ctx.getVideoEmbedUrl({ url }), 'https://www.youtube.com/embed/abc123_-XYZ?autoplay=1&rel=0');
    assert.equal(ctx.getVideoEmbedUrl({ url: 'https://vod.sooplive.com/player/123456/catch' }),
        'https://vod.sooplive.com/player/123456/embed?autoPlay=true&showChat=false&mutePlay=false');
});

test('all bundled video URLs still have supported embedded players', () => {
    const { ctx } = harness();
    vm.runInContext(fs.readFileSync(path.join(root, 'dance-data.js'), 'utf8'), ctx);
    for (const video of ctx.window.danceVideos) assert.notEqual(ctx.getVideoEmbedUrl(video), 'about:blank', video.id);
});

test('shared row normalization rejects script links and images before rendering', () => {
    const { ctx } = harness();
    const normalized = ctx.normalizeVideo({ id: 'test-only', url: 'javascript:void(0)', thumbnail: 'data:text/html,inspection-only' });
    assert.equal(normalized.url, '#');
    assert.equal(normalized.thumbnail, 'banner.jpg');
    const valid = ctx.normalizeVideo({ id: 'test-only', url: 'https://youtu.be/abc123_-XYZ', thumbnail: 'https://img.example.test/a.jpg' });
    assert.equal(valid.url, 'https://youtu.be/abc123_-XYZ');
    assert.equal(valid.thumbnail, 'https://img.example.test/a.jpg');
});

test('video dialog checks raw URL again at the iframe and original-link sinks', () => {
    const { ctx, node } = harness();
    ctx.openVideoModal({ title: '[테스트용] URL 보안 확인', url: 'javascript:void(0)' });
    assert.equal(node('videoModalFrame').src, 'about:blank');
    assert.equal(node('videoModalOriginal').href, '#');
    ctx.openVideoModal({ title: '[테스트용] 정상 영상', url: 'https://youtu.be/abc123_-XYZ' });
    assert.equal(node('videoModalOriginal').href, 'https://youtu.be/abc123_-XYZ');
});

test('detail actions never open or copy an executable scheme', async () => {
    const { ctx, node, opened, copied } = harness();
    ctx.video = { id: 'test-only', title: '[테스트용] 가짜 자료', url: 'javascript:void(0)', tags: [], source: 'soop', status: 'review' };
    ctx.renderDetail();
    assert.equal(node('openLinkBtn').disabled, true);
    assert.equal(node('copyLinkBtn').disabled, true);
    node('openLinkBtn').onclick();
    await node('copyLinkBtn').onclick();
    assert.equal(opened.length, 0);
    assert.equal(copied.length, 0);
    ctx.video.url = 'https://vod.sooplive.com/player/123456/catch';
    ctx.renderDetail();
    node('openLinkBtn').onclick();
    await node('copyLinkBtn').onclick();
    assert.equal(opened[0][0], ctx.video.url);
    assert.equal(copied[0], ctx.video.url);
});
