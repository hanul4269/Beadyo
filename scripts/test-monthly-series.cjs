const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../monthly-data.js');
const S = require('../content-series.js');
const vm = require('node:vm'), fs = require('node:fs');

test('month boundaries use Korean time and validate leap days', () => {
    assert.equal(M.dayKey(new Date('2026-09-30T15:00:00Z')), '2026-10-01');
    assert.equal(M.dayKey(new Date('2026-09-30T14:59:59Z')), '2026-09-30');
    assert.deepEqual(M.bounds('2024-02'), {start:'2024-02-01',end:'2024-02-29'});
    assert.equal(M.validMonth('2026-13'), '');
    assert.equal(M.validDate('2026-02-29'), '');
});
test('actual activity date wins; only absent dates use explicitly zoned registration time', () => {
    assert.deepEqual(M.recordDate({upload_date:'2026-09-29',created_at:'2026-10-01T00:00:00Z'},'upload_date'), {date:'2026-09-29',basis:'activity'});
    assert.deepEqual(M.recordDate({upload_date:null,created_at:'2026-09-30T15:00:00Z'},'upload_date'), {date:'2026-10-01',basis:'registered'});
    for (const row of [{upload_date:'2026-02-30',created_at:'2026-10-01T00:00:00Z'}, {created_at:'2026-10-01T00:00:00'}, {created_at:'invalid'}, {}]) assert.equal(M.recordDate(row,'upload_date').date, '');
});
test('monthly counts exclude future rows and opted-out songs, count rows not times_sung', () => {
    const rows = [{id:1,performed_date:'2026-10-01',times_sung:99}, {id:2,performed_date:'2026-10-31'}, {id:3,performed_date:'2026-10-02',exclude_from_stats:true}, {id:4,performed_date:'2026-09-30'}, {id:5,performed_date:null}];
    assert.deepEqual(M.select(rows,'performed_date','2026-10','2026-10-11',true).map(r=>r.id), [1]);
    assert.deepEqual(M.select(rows,'performed_date','2021-01','2026-10-11',true), []);
});
test('series only assigns reviewed IDs or explicit metadata, never similar titles', () => {
    assert.equal(S.normalize({id:'240b01d3-c6b1-4aa7-ab7e-0fd8206c1fc2'}).episode_number, 1);
    assert.equal(S.normalize({id:'different',title:'하숙하숙해 4화'}).series_id, '');
    assert.equal(S.normalize({id:'7dfc9d39-2eb2-45e0-ae77-8070bb2ce522',title:'하숙해 멤버들과 하드코어 마인크래프트'}).series_id, '');
    const counts = Object.values(S.reviewed).reduce((acc,row) => {acc[row.series_id]=(acc[row.series_id]||0)+1; return acc;},{});
    assert.deepEqual(counts,{guquiz:12,radio2:5,hasuk:3});
});
test('editor tags preserve ordinary tags, support reassignment and clearing reviewed membership', () => {
    const tags = S.encode(['음악','beadyo-series:guquiz','beadyo-episode:4'],'hasuk',2);
    assert.deepEqual(tags,['음악','beadyo-series:hasuk','beadyo-episode:2']);
    assert.deepEqual(S.normalize({id:'new',tags}),{series_id:'hasuk',episode_number:2});
    assert.deepEqual(S.normalize({id:'240b01d3-c6b1-4aa7-ab7e-0fd8206c1fc2',tags:S.encode(['음악'],'',null)}),{series_id:'',episode_number:null});
    assert.equal(S.normalize({tags:['beadyo-series:hasuk','beadyo-episode:0']}).episode_number,null);
});
test('episode ordering is stable and unknown numbers use activity dates without invented numbers', () => {
    const rows = [{id:'c',episode_number:null,broadcast_date:'2025-02-01'},{id:'a',episode_number:2,broadcast_date:'2025-01-01'}, {id:'b',episode_number:1,broadcast_date:'2025-03-01'}, {id:'d',episode_number:null,broadcast_date:'2025-01-01'}];
    assert.deepEqual(S.sortEpisodes(rows).map(r=>r.id), ['b','a','d','c']);
    assert.equal(rows[0].episode_number,null);
});
function metadataHarness(fetcher, initial = {}) {
    const storage = new Map(Object.entries(initial)); let calls = 0;
    const context = vm.createContext({ Date, Map, JSON, URL, Number, String, Promise, AbortController, setTimeout, clearTimeout,
        localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
        fetch:async (...args)=>{calls++; return fetcher(...args);},
        window:{BeadyoExploreData:require('../explore-data.js'),BeadyoCommon:{safeUrl: (url)=>/^https?:\/\//.test(url || '')?url:''}} });
    vm.runInContext(fs.readFileSync(require.resolve('../video-metadata.js'),'utf8'),context);
    return {api:context.window.BeadyoVideoMetadata, storage, calls:()=>calls};
}
const href = 'https://youtu.be/Jj4aR7ZxKZM';
test('stored music titles win; watch links do not prove a regular video', async () => {
    const h=metadataHarness(()=>{throw Error('must not fetch');});
    assert.equal((await h.api.read(href,{title:'Registered title'})).title,'Registered title');
    assert.equal(h.calls(),0); assert.equal(h.api.type(href),'');
    assert.equal(h.api.type('https://www.youtube.com/shorts/Jj4aR7ZxKZM'),'Shorts');
});
test('metadata success is shared and persisted across reload; failure is cached without inventing titles', async () => {
    const h=metadataHarness(async ()=>({ok:true,json:async()=>({title:'Real title',thumbnail_url:'https://i.ytimg.com/vi/Jj4aR7ZxKZM/hqdefault.jpg'})}));
    const rows=await Promise.all([h.api.read(href),h.api.read(href)]);
    assert.equal(h.calls(),1);assert.equal(rows[0].title,'Real title');
    const reload=metadataHarness(()=>{throw Error('must reuse persisted metadata');},Object.fromEntries(h.storage));
    assert.equal((await reload.api.read(href)).title,'Real title');assert.equal(reload.calls(),0);
    const fail=metadataHarness(async()=>{throw Error('offline');});
    assert.equal((await fail.api.read(href)).title,'');await fail.api.read(href);assert.equal(fail.calls(),1);
});

test('corrupt, expired and future metadata cache entries are refetched safely', async () => {
    for (const value of ['not JSON', JSON.stringify({at:Date.now(),title:{bad:true},status:'ready'}), JSON.stringify({at:Date.now()-8*86400000,title:'old',status:'ready'}), JSON.stringify({at:Date.now()+86400000,title:'future',status:'ready'})]) {
        const h=metadataHarness(async()=>({ok:true,json:async()=>({title:'Fresh'})}), {'beadyo:video-metadata:v1:Jj4aR7ZxKZM':value});
        assert.equal((await h.api.read(href)).title,'Fresh');assert.equal(h.calls(),1);
    }
});
test('HOME removes repeated media IDs across news columns without dropping original links', () => {
    const source=fs.readFileSync(require.resolve('../home.js'),'utf8');
    const body=source.slice(source.indexOf('    function renderNews()'), source.indexOf('    function renderSoop()'));
    const sources={notices:{status:'success',data:[]},music:{data:[{youtube_url:href}]},videos:{data:[{url:href},{url:'https://www.youtube.com/watch?v=Jj4aR7ZxKZM'}, {url:'https://www.youtube.com/shorts/xVpX5koke54',date:'2026-10-07',metadata:{status:'unavailable'}}, {url:'https://youtu.be/xVpX5koke54'}]}};
    let output='';
    const render=new Function('sources','rows','newsItem','stateHtml','window','setHtml','refreshNotice',body+';return renderNews;')(sources,()=>'',(url,label)=>`<a href="${url}">${label}</a>`,()=>'',{BeadyoExploreData:require('../explore-data.js'),BeadyoVideoMetadata:{type:()=>''}},(_,html)=>{output=html;},()=> '');
    render();assert.equal((output.match(/<a /g)||[]).length,1);assert.match(output,/shorts\/xVpX5koke54/);assert.match(output,/영상 제목을 확인하지 못했습니다/);
});
test('all existing filters combine with a series; numbered and unnumbered series retain their order', () => {
    const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
    const body=source.slice(source.indexOf('    function filteredItems()'),source.indexOf('    function hasActiveFilters()'));
    const rows=[{id:'first',series_id:'hasuk',episode_number:2,broadcast_date:'2025-12-01',categories:['특집'],planning_type:'단독',title:'B',created_at:''}, {id:'second',series_id:'hasuk',episode_number:1,broadcast_date:'2025-12-10',categories:['특집'],planning_type:'단독',title:'A',created_at:''}, {id:'other',series_id:'',episode_number:null,broadcast_date:'2025-12-01',categories:['특집'],planning_type:'단독',title:'A',created_at:''}];
    const state={items:rows,query:'A',year:'2025',category:'특집',planningType:'단독',series:'hasuk',sort:'newest'};
    const filtered=new Function('state','Series','searchableText',body+';return filteredItems;')(state,S,row=>row.title.toLowerCase());
    assert.deepEqual(filtered().map(r=>r.id),['second']);state.query='';assert.deepEqual(filtered().map(r=>r.id),['second','first']);state.year='2024';assert.deepEqual(filtered(),[]);
});
