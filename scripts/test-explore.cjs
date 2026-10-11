const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const D = require('../explore-data.js');
const root = path.join(__dirname, '..');
test('platform identity recognizes real media variants and rejects lookalike domains', () => {
    assert.equal(D.mediaKey('https://youtu.be/UQ97A08KrbU?si=abc'), D.mediaKey('https://www.youtube.com/watch?v=UQ97A08KrbU&t=20'));
    assert.equal(D.mediaKey('https://vod.sooplive.co.kr/player/158011685'), D.mediaKey('https://vod.sooplive.com/player/158011685?change_second=0'));
    for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=UQ97A08KrbU', 'https://vod.sooplive.com.evil.test/player/158011685', 'https://www.youtube.com/@beadyo97', 'https://youtu.be/too-short', 'https://cafe.naver.com/beadyo/158011685']) assert.equal(D.mediaKey(url), '');
});
test('matching titles and dates alone never create song or replay relationships', () => {
    const song = { title: '같은 제목', clip_url: 'https://youtu.be/UQ97A08KrbU' };
    const live = [{ id: 1, title: song.title, clip_url: 'https://youtu.be/Yv4p3ht3nfY' }];
    assert.deepEqual(D.liveForSong(song, live), []);
    assert.deepEqual(D.musicForSong(song, [{ title: song.title, youtube_url: live[0].clip_url }]), []);
    assert.deepEqual(D.songsForClip('', [{ title: song.title, clip_url: null }]), []);
    assert.deepEqual(D.contentForMedia([''], [{ replays: [{ status: '정상', url: '' }] }]), []);
});
test('same-media records keep IDs, unpublished replay entries do not create links', () => {
    const clip = 'https://vod.sooplive.co.kr/player/158011685';
    assert.deepEqual(D.liveForSong({ clip_url: clip }, [{ id: 2341, clip_url: clip }]).map(r => r.id), [2341]);
    assert.deepEqual(D.contentForMedia([clip], [{ id: 'ok', replays: [{ status: '정상', url: clip }] }, { id: 'private', replays: [{ status: '비공개', url: clip }] }]).map(r => r.id), ['ok']);
});
test('date targets reject invalid dates and accept leap days', () => {
    assert.equal(D.validDate('2024-02-29'), '2024-02-29');
    for (const value of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-01-01<script>', '', null]) assert.equal(D.validDate(value), '');
});
test('navigation retains route identities and moves SCHEDULE out of MORE', () => {
    assert.deepEqual(D.menus.map(m => m.index).sort((a,b) => a-b), [0,1,2,3,4,5,6,7]);
    assert.deepEqual(D.menus.map(m => m.route).sort(), ['calendar','content','games','home','live','music','schedule','songbook']);
    assert.ok(D.menus.every(m => /^[A-Z ]+$/.test(m.label) && m.description));
    assert.deepEqual(D.menus.filter(m => !m.hidden).map(m => m.index).sort((a,b) => a-b), [0,2,3,4,5,6,7]);
});
test('automatic UP policy never opens a modal or reads/writes the old hide preference', async () => {
    const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const fn = source.match(/async function maybeOpenUpModalOnStart\(\) \{[^}]*\}/)[0];
    const context = vm.createContext({ _upAutoPopupChecked: false, localStorage: new Proxy({}, {get(){throw new Error('Old preference accessed');}}), openUpModal(){throw new Error('Unexpected popup');} });
    await vm.runInContext(`${fn}; maybeOpenUpModalOnStart();`, context);
    assert.equal(context._upAutoPopupChecked, true);
    assert.ok(!source.includes('setTimeout(() => { maybeOpenUpModalOnStart(); }, 700)'));
    assert.ok(source.includes("const UP_AUTO_POPUP_HIDE_UNTIL_KEY = 'beadyoUpAutoPopupHideUntil'"));
});
test('guide selections use stable registered IDs and retain supplied attribution', () => {
    const guide = JSON.parse(fs.readFileSync(path.join(root, 'start-here.json'), 'utf8'));
    assert.equal(guide.source.revision, '2026-10-02 11:59:54');
    assert.equal(guide.source.license, 'CC BY-NC-SA 2.0 KR');
    assert.ok(guide.source.adaptation && guide.terms.length > 0);
    assert.ok([...guide.musicIds, ...guide.contentIds].every(id => /^[0-9a-f-]{36}$/.test(id)));
});
function readerContext(fetchWithTimeout, timers = {setTimeout, clearTimeout}) {
    const window = { BeadyoExploreData: D, BeadyoCommon: { esc: String, SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'public-test-key', fetchWithTimeout } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'explore.js'), 'utf8'), { window, document: {addEventListener(){}}, ...timers, URL, location: {origin: 'https://example.test'} });
    return window.BeadyoExplore;
}
test('read-only reader paginates fully; failed later pages never cache partial rows', async () => {
    const calls = [];
    let fail = true;
    const E = readerContext(async url => {
        const offset = Number(new URL(url).searchParams.get('offset'));
        calls.push(offset);
        if (offset && fail) return {ok:false,status:503};
        const rows = Array.from({length: offset ? 2 : 1000}, (_,i) => ({id:offset+i}));
        return {ok:true,json:async()=>rows};
    });
    await assert.rejects(E.readAll('live_songs', 'id'), /HTTP 503/);
    fail = false;
    assert.equal((await E.readAll('live_songs', 'id')).length, 1002);
    assert.equal((await E.readAll('live_songs', 'id')).length, 1002);
    assert.deepEqual(calls, [0,1000,0,1000]);
});
test('valid empty rows are success; a never-settling dependency reaches the deadline', async () => {
    const E = readerContext(async()=>({ok:true,json:async()=>[]}));
    assert.equal((await E.readAll('songbook', 'id')).length, 0);
    await assert.rejects(E.deadline(new Promise(()=>{}), 15), /Read timeout/);
});
test('simultaneous identical reads share pagination; different queries remain independent', async () => {
    const calls = [];
    const E = readerContext(async url => {
        calls.push(url);
        await new Promise(resolve => setImmediate(resolve));
        const offset = Number(new URL(url).searchParams.get('offset'));
        return { ok: true, json: async () => Array.from({ length: offset ? 1 : 1000 }, (_, i) => ({ id: offset + i })) };
    });
    const [a, b] = await Promise.all([E.readAll('songbook', 'id'), E.readAll('songbook', 'id')]);
    assert.equal(a.length, 1001); assert.equal(a, b); assert.equal(calls.length, 2);
    await E.readAll('songbook', 'id,title'); assert.equal(calls.length, 4);
});
test('failed shared reads release the request so a retry can succeed', async () => {
    let calls = 0, fail = true;
    const E = readerContext(async () => { calls++; await new Promise(resolve => setImmediate(resolve)); return { ok: !fail, status: 503, json: async () => [{ id: 1 }] }; });
    const results = await Promise.allSettled([E.readAll('songbook', 'id'), E.readAll('songbook', 'id')]);
    assert.ok(results.every(r => r.status === 'rejected')); assert.equal(calls, 1);
    fail = false; assert.equal((await E.readAll('songbook', 'id')).length, 1); assert.equal(calls, 2);
});
test('guide ID reads filter on the server and skip empty or invalid selections', async () => {
    const id = '425ed5b5-2ed4-4e31-aa3d-d9e69d544380';
    const calls = [];
    const E = readerContext(async url => { calls.push(new URL(url)); return { ok: true, json: async () => [{ id }] }; });
    assert.equal((await E.readIds('content_archive', 'id,title', [id])).length, 1);
    assert.equal(calls[0].searchParams.get('id'), `in.(${id})`);
    assert.equal((await E.readIds('content_archive', 'id,title', [])).length, 0);
    await assert.rejects(E.readIds('content_archive', 'id,title', ['x),id.neq.null']), /Invalid selection/);
    assert.equal(calls.length, 1);
});
test('a response with stalled body parsing also reaches the deadline', async () => {
    const E = readerContext(async()=>({ok:true,json:()=>new Promise(()=>{})}), {
        setTimeout: callback => setTimeout(callback, 15), clearTimeout,
    });
    await assert.rejects(E.readAll('songbook', 'id'), /Read timeout/);
});
test('song detail reuses complete archive reads but rejects and retries an incomplete year', async () => {
    const source = fs.readFileSync(path.join(root, 'songbook.html'), 'utf8');
    const fetchSource = source.match(/async function fetchAll\([\s\S]*?\n\}/)[0];
    const detailSource = source.match(/async function ensureLiveAllForSongDetail\([\s\S]*?\n\}/)[0];
    let fail = true;
    let calls = 0;
    const incompleteLiveYears = new Set(['2025']);
    const S = {liveCache:{all:[{id:1}],2022:[],2023:[],2024:[],2025:[{id:1}],2026:[]}};
    const context = vm.createContext({S, incompleteLiveYears, _songDetailLivePromise:null, ensureDb:async()=>{}, showToast(){}, db:{from(){
        calls++;
        const query = {select(){return this;},range(){return this;},eq(){return this;},order(){return this;},then(resolve){
            return Promise.resolve(fail ? {error:new Error('Archive unavailable')} : {data:[{id:2,performed_date:'2025-04-22'}]}).then(resolve);
        }};
        return query;
    }}});
    vm.runInContext(`${fetchSource}\n${detailSource}`, context);
    await assert.rejects(context.ensureLiveAllForSongDetail(), /Archive unavailable/);
    assert.equal(S.liveCache.all[0].id, 1);
    fail = false;
    assert.equal((await context.ensureLiveAllForSongDetail())[0].id, 2);
    assert.equal(incompleteLiveYears.size, 0);
    await context.ensureLiveAllForSongDetail();
    assert.equal(calls, 2);
});
