const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../home-visual.js'), 'utf8');
function setup({ reduced = false, mounted = true, observer = true, broadcast = false } = {}) {
    const callbacks = {};
    const root = { active: true, items: [], classList: { contains: () => root.active },
        getBoundingClientRect: () => ({ top: 0, bottom: 700, left: 0, right: 400 }),
        querySelectorAll: () => root.items, addEventListener: (name, fn) => { callbacks[`root:${name}`] = fn; } };
    const figure = { dataset: {}, hidden: false, top: 100, getBoundingClientRect: () => ({ top: figure.top, bottom: figure.top + 200, left: 20, right: 380, width: 360, height: 200 }),
        querySelector: selector => selector === '[data-home-animation]' ? image : selector === 'figcaption' ? caption : note };
    const thumbnail = {dataset:{},hidden:true,querySelector:()=>liveImage};
    const mediaNode = {querySelector:selector=>selector==='[data-home-live-thumbnail]'?thumbnail:figure};
    thumbnail.parentElement = mediaNode;
    const thumbnailWrites = [];
    const liveImage = {naturalWidth:640,naturalHeight:360,
        set src(value){thumbnailWrites.push(value);}, removeAttribute(name){assert.equal(name,'src');},
        matches:selector=>selector==='[data-home-broadcast-image]',closest:()=>thumbnail};
    root.querySelector = () => broadcast ? mediaNode : null;
    const writes = [];
    const image = { dataset: { homePoster: 'poster.webp', homeAnimation: 'motion.webp' }, alt: '캐릭터',
        set src(value) { writes.push(value); }, matches: selector => selector === '[data-home-animation]', closest: () => figure };
    const caption = { hidden: true };
    const note = { textContent: '' };
    const media = { matches: reduced, addEventListener: (name, fn) => { callbacks.media = fn; } };
    const document = { hidden: false, getElementById: () => root, addEventListener: (name, fn) => { callbacks[`document:${name}`] = fn; } };
    const window = { innerWidth: 400, innerHeight: 700, matchMedia: () => media,
        addEventListener: (name, fn) => { callbacks[`window:${name}`] = fn; } };
    if (mounted) root.items.push(figure);
    const Observer = observer ? class { constructor(fn) { callbacks.intersection = fn; } observe() {} } : undefined;
    vm.runInNewContext(source, { window, document, IntersectionObserver: Observer });
    return { root, figure, caption, note, media, document, window, writes, thumbnail, thumbnailWrites,
        broadcast: id => window.BeadyoHomeVisual.setBroadcast(id),
        thumbnailLoad: () => callbacks['root:load']({target:liveImage}),
        thumbnailError: () => callbacks['root:error']({target:liveImage}),
        activate: () => window.BeadyoHomeVisual.activate(),
        enter: () => callbacks.intersection([{ target: figure, isIntersecting: true }]),
        leave: () => callbacks.intersection([{ target: figure, isIntersecting: false }]),
        error: () => callbacks['root:error']({ target: image }),
        tab: index => { root.active = index === 7; callbacks['window:beadyo-tab-change']({ detail: { index } }); },
        visibility: hidden => { document.hidden = hidden; callbacks['document:visibilitychange'](); },
        reduce: value => { media.matches = value; callbacks.media(); },
        scroll: () => callbacks['root:scroll']() };
}
test('visible artwork starts without a click, and repeated activation does not restart it', () => {
    const s = setup(); assert.equal(s.figure.dataset.playing, 'true');
    s.activate(); s.enter(); assert.deepEqual(s.writes, ['motion.webp']);
});
test('artwork mounted on first HOME visit starts automatically', () => {
    const s = setup({ mounted: false }); assert.deepEqual(s.writes, []);
    s.root.items.push(s.figure); s.activate(); assert.deepEqual(s.writes, ['motion.webp']);
});
test('offscreen, tab and document pauses resume when the artwork becomes visible', () => {
    const s = setup(); s.figure.top = 900; s.leave(); assert.equal(s.figure.dataset.playing, 'false');
    s.figure.top = 100; s.enter(); assert.equal(s.figure.dataset.playing, 'true');
    s.tab(0); assert.equal(s.figure.dataset.playing, 'false'); s.tab(7); assert.equal(s.figure.dataset.playing, 'true');
    s.visibility(true); assert.equal(s.figure.dataset.playing, 'false'); s.visibility(false); assert.equal(s.figure.dataset.playing, 'true');
});
test('reduced motion is respected on first load and after a preference change', () => {
    const s = setup({ reduced: true }); assert.deepEqual(s.writes, []);
    s.reduce(false); assert.equal(s.figure.dataset.playing, 'true'); s.reduce(true); assert.equal(s.figure.dataset.playing, 'false');
});
test('animation failure restores the poster without an automatic retry loop', () => {
    const s = setup(); s.error(); assert.equal(s.figure.dataset.playing, 'false');
    assert.equal(s.writes.at(-1), 'poster.webp'); const count = s.writes.length;
    s.enter(); s.tab(0); s.tab(7); assert.equal(s.writes.length, count);
    assert.equal(s.caption.hidden, false); assert.ok(s.note.textContent);
});
test('without IntersectionObserver, scrolling still stops and resumes artwork', () => {
    const s = setup({ observer: false }); s.figure.top = 900; s.scroll(); assert.equal(s.figure.dataset.playing, 'false');
    s.figure.top = 100; s.scroll(); assert.equal(s.figure.dataset.playing, 'true');
});

test('live thumbnail loads before replacing the GIF; repeated polling keeps the same nodes', () => {
    const s = setup({broadcast:true});
    s.broadcast('297742403');
    assert.equal(s.thumbnail.hidden,true);assert.equal(s.figure.hidden,false);
    assert.deepEqual(s.thumbnailWrites,['https://liveimg.sooplive.co.kr/m/297742403']);
    s.thumbnailLoad();assert.equal(s.thumbnail.hidden,false);assert.equal(s.figure.hidden,true);
    assert.equal(s.figure.dataset.playing,'false');
    const writes = s.writes.length;
    s.broadcast('297742403');s.activate();
    assert.equal(s.thumbnailWrites.length,1);assert.equal(s.writes.length,writes);
    s.broadcast(null);assert.equal(s.thumbnail.hidden,true);assert.equal(s.figure.hidden,false);
    assert.equal(s.figure.dataset.playing,'true');
});
test('thumbnail failure returns to GIF and does not retry until a different broadcast', () => {
    const s = setup({broadcast:true});s.broadcast('123');s.thumbnailLoad();s.thumbnailError();
    assert.equal(s.thumbnail.hidden,true);assert.equal(s.figure.hidden,false);assert.equal(s.figure.dataset.playing,'true');
    s.broadcast('123');s.broadcast(null);s.broadcast('123');assert.equal(s.thumbnailWrites.length,1);
    s.broadcast('456');s.thumbnailLoad();assert.equal(s.thumbnail.hidden,false);assert.equal(s.thumbnailWrites.length,2);
});
test('unavailable, missing and invalid broadcast numbers keep the GIF and never request a URL', () => {
    const s = setup({broadcast:true});
    for (const id of [null,undefined,'',0,'0',-1,'https://example.com','123/evil']) s.broadcast(id);
    assert.equal(s.thumbnailWrites.length,0);assert.equal(s.figure.hidden,false);
});
test('switching off a broadcast does not show a late thumbnail load or bypass reduced motion', () => {
    const s = setup({broadcast:true,reduced:true});s.broadcast('123');s.broadcast(null);s.thumbnailLoad();
    assert.equal(s.thumbnail.hidden,true);assert.equal(s.figure.hidden,false);assert.equal(s.writes.length,0);
});
