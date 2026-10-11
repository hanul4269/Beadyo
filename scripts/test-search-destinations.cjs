const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function section(file, from, until) {
    const text = source(file), start = text.indexOf(from), end = text.indexOf(until, start);
    assert.ok(start >= 0 && end > start, from);
    return text.slice(start, end);
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
function element() {
    return { value:'', hidden:false, innerHTML:'', textContent:'', style:{}, parentElement:{style:{}}, classList:{add(){}, remove(){}, toggle(){}} };
}
const firstVideo = '6b3cdb6e-2ab0-4657-a05b-9fff232bbca4';
function music(search) {
    const nodes = Object.fromEntries(['search-input','sort-select','music-selection','songs-grid'].map(id => [id, element()]));
    const location = {search, href:'http://localhost:3000/songs.html'+search};
    const history = {state:{searchState:'preserved'}, replaceState(state, _, url) {this.state = state; location.href = new URL(url, location.href).href; location.search = new URL(location.href).search;}};
    const ctx = vm.createContext({location, history, URL, URLSearchParams, esc, jsArg:value=>esc(JSON.stringify(value)),
        document:{getElementById:id=>nodes[id],querySelectorAll:()=>[]},
        BeadyoCommon:{normalizeUnifiedSearchText:normalized},
    });
    vm.runInContext(section('songs.html', '        let state =', '        function renderSkeleton()'), ctx);
    vm.runInContext('readMusicRoute();', ctx);
    return {ctx,nodes,location,state:vm.runInContext('state',ctx)};
}
test('MUSIC ID route selects one record even when another video has the same title', () => {
    const h=music('?video='+firstVideo+'&q=unrelated');
    h.state.songs=[{id:firstVideo,title:'너와 나의 내일',youtube_url:'https://youtu.be/h3ZixFtGxIU'},{id:'other-id',title:'너와 나의 내일',youtube_url:'https://youtu.be/pkea5SglAHg'}];
    h.ctx.renderGrid();
    assert.match(h.nodes['songs-grid'].innerHTML,new RegExp('data-music-id="'+firstVideo+'"'));
    assert.doesNotMatch(h.nodes['songs-grid'].innerHTML,/data-music-id="other-id"/);
    assert.equal(h.nodes['music-selection'].hidden,false);
});
test('MUSIC query route normalizes case/spacing and includes registered collaborators', () => {
    const h=music('?q=%20SPOTLIGHT%20');
    h.state.songs=[{id:'a',title:'SPOTLiGHT',youtube_url:''},{id:'b',title:'다른 제목',collab:'Spot light',youtube_url:''},{id:'c',title:'별',youtube_url:''}];
    h.ctx.renderGrid();
    assert.match(h.nodes['songs-grid'].innerHTML,/data-music-id="a"/);
    assert.match(h.nodes['songs-grid'].innerHTML,/data-music-id="b"/);
    assert.doesNotMatch(h.nodes['songs-grid'].innerHTML,/data-music-id="c"/);
    assert.equal(h.nodes['search-input'].value,'SPOTLIGHT');
});
test('MUSIC edits release the exact selection and preserve query in the URL', () => {
    const h=music('?video='+firstVideo);
    h.ctx.onSearchInput('  Cruel Summer  ');
    assert.equal(h.state.videoId,'');
    assert.equal(new URL(h.location.href).searchParams.get('q'),'Cruel Summer');
    assert.equal(new URL(h.location.href).searchParams.has('video'),false);
    assert.equal(h.ctx.history.state.searchState,'preserved');
});
test('MUSIC route rejects invalid IDs, escapes query text and shows missing selected records honestly', () => {
    const h=music('?video=%3Cbad%3E&q=%3Cimg%20src%3Dx%3E');
    h.ctx.renderGrid();
    assert.equal(h.state.videoId,'');
    assert.match(h.nodes['songs-grid'].innerHTML,/&lt;img src=x&gt;/);
    assert.doesNotMatch(h.nodes['songs-grid'].innerHTML,/<img src=x>/);
    h.state.videoId='missing';h.ctx.renderGrid();
    assert.match(h.nodes['songs-grid'].innerHTML,/선택한 음악 영상을 찾지 못했어요/);
});
function live() {
    const nodes = Object.fromEntries(['live-list','stats-panel','result-info','explore-live-date'].map(id=>[id,element()]));
    const S={mainTab:'live',liveYear:2026,liveDate:'2026-10-01',liveTargetId:'42',query:'',session:null,liveCache:{2026:[{id:41,year:2026,title:'동일 제목',performed_date:'2026-10-01'},{id:42,year:2026,title:'동일 제목',performed_date:'2026-10-01'}]},liveFilter:{years:new Set([2026]),sort:'date',dir:'desc'}};
    const ctx=vm.createContext({S,document:{getElementById:id=>nodes[id],querySelector:element},loadLive:async()=>{},renderSkeleton(){},ensureStatsData:async()=>{},renderStats(){throw Error('Must show record');},updateResultInfo(){},liveStatKey:row=>row.title,esc,fmtDate:x=>x,emptyHtml:x=>x,safeUrl:x=>x,matches:()=>true});
    vm.runInContext(section('songbook.html','let liveRenderGeneration =','// ── 렌더: 통계'),ctx);
    return {ctx,nodes,S};
}
test('LIVE RECORD route retains exact identity among equal titles and dates',async()=>{
    const h=live();await h.ctx.renderLive();
    assert.match(h.nodes['live-list'].innerHTML,/data-live-record-id="42"/);
    assert.doesNotMatch(h.nodes['live-list'].innerHTML,/data-live-record-id="41"/);
    assert.match(h.nodes['explore-live-date'].innerHTML,/2026-10-01/);
    assert.match(h.nodes['explore-live-date'].innerHTML,/선택 해제/);
    h.S.liveTargetId='';await h.ctx.renderLive();
    assert.match(h.nodes['live-list'].innerHTML,/data-live-record-id="41"/);
    assert.match(h.nodes['live-list'].innerHTML,/data-live-record-id="42"/);
});

function liveRoute(search, recordId = '') {
    const location = new URL('http://localhost:3000/songbook.html' + search + '#keep');
    const S = { liveTargetId: recordId, liveDate: '2026-10-01', liveYear: 2026 };
    const history = { state: { searchState: 'preserved' }, replaceState(state, _, url) {
        this.state = state;
        location.href = new URL(url, location.href).href;
    } };
    const ctx = vm.createContext({ S, location, history, URL,
        document: { querySelectorAll: () => [] }, renderLive() {}, updateFab() {} });
    vm.runInContext(section('songbook.html', 'function clearLiveRecordRoute(', 'function toggleLiveFilter('), ctx);
    return { ctx, S, location, history };
}
test('clearing a date-only LIVE route or changing year removes the date from the reload URL', () => {
    for (const action of ['clearDate', 'changeYear']) {
        const h = liveRoute('?view=live&date=2026-10-01&q=keep');
        if (action === 'clearDate') h.ctx.clearLiveDate();
        else h.ctx.setLiveYear(2024);
        assert.equal(h.S.liveDate, '');
        assert.equal(h.location.searchParams.has('date'), false);
        assert.equal(h.location.searchParams.get('view'), 'live');
        assert.equal(h.location.searchParams.get('q'), 'keep');
        assert.equal(h.location.hash, '#keep');
        assert.equal(h.history.state.searchState, 'preserved');
        if (action === 'changeYear') assert.equal(h.S.liveYear, 2024);
    }
});
test('clearing just a LIVE selection retains its date, while clearing the date releases both constraints', () => {
    const h = liveRoute('?view=live&date=2026-10-01&record=42', '42');
    h.ctx.clearLiveRecord();
    assert.equal(h.S.liveTargetId, '');
    assert.equal(h.S.liveDate, '2026-10-01');
    assert.equal(h.location.searchParams.has('record'), false);
    assert.equal(h.location.searchParams.get('date'), '2026-10-01');
    h.ctx.clearLiveDate();
    assert.equal(h.S.liveDate, '');
    assert.equal(h.location.searchParams.has('date'), false);
});
