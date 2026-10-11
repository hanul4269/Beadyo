const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const section = (name, start, end) => { const s=source(name); return s.slice(s.indexOf(start), s.indexOf(end,s.indexOf(start))); };

test('page messages only accept the current non-opaque origin', () => {
    const code = section('beadyo-common.js','    function allowedMessageOrigin','    const UNIFIED_SEARCH_CACHE_KEY');
    for (const current of ['https://beadyo.com','http://localhost:3000','http://127.0.0.1:3000','null']) {
        const ctx=vm.createContext({global:{location:{origin:current}},ALLOWED_MESSAGE_ORIGINS:new Set(['https://beadyo.com','http://localhost:3000','http://127.0.0.1:3000'])});
        vm.runInContext(code,ctx);
        for (const incoming of ['https://beadyo.com','http://localhost:3000','http://127.0.0.1:3000','https://attacker.test','null'])
            assert.equal(ctx.allowedMessageOrigin(incoming), incoming===current && current!=='null', `${current} received ${incoming}`);
    }
});

test('LIVE fallback rejects future, expired and malformed timestamps', () => {
    const ctx=vm.createContext({Date});
    vm.runInContext(section('index-app.js','function isFreshRuntimeCache','function checkLiveStatus'),ctx);
    const now=Date.now();
    assert.equal(ctx.isFreshRuntimeCache({updated:new Date(now-1000).toISOString()},30000),true);
    for (const updated of ['invalid',new Date(now+86400000).toISOString(),new Date(now-60000).toISOString()])
        assert.equal(ctx.isFreshRuntimeCache({updated},30000),false);
});

function calendar() {
    let status, reloads=0, next=0;
    const intervals=new Map();
    const channel={on(){return this;},subscribe(fn){status=fn;return this;}};
    const ctx=vm.createContext({document:{visibilityState:'visible'},console,
        _calendarRealtimeChannel:null,_calendarFallbackPollTimer:null,_calendarRealtimeReloadTimer:null,
        _ensureDb:async()=>{},db:{channel:()=>channel},loadEvents:async()=>{reloads++;},
        setInterval:(fn,ms)=>{const id=++next;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
    vm.runInContext(section('app.js','function startCalendarFallbackPolling','function eventOrderValue'),ctx);
    return {ctx,intervals,status:s=>status(s),reloads:()=>reloads};
}
test('connected calendar reduces polling but keeps a safety refresh; failure restores fast fallback',async()=>{
    const h=calendar();await h.ctx.initCalendarRealtime();
    assert.equal([...h.intervals.values()][0].ms,30000);
    h.status('SUBSCRIBED');assert.equal(h.intervals.size,1);assert.equal([...h.intervals.values()][0].ms,120000);
    h.status('CHANNEL_ERROR');assert.equal(h.intervals.size,1);assert.equal([...h.intervals.values()][0].ms,30000);
    h.status('SUBSCRIBED');h.ctx.document.visibilityState='hidden';await [...h.intervals.values()][0].fn();assert.equal(h.reloads(),0);
    h.ctx.document.visibilityState='visible';await [...h.intervals.values()][0].fn();assert.equal(h.reloads(),1);
});

function monthly(reader) {
    const ctx=vm.createContext({D:require('../monthly-data.js'), E:{readAll:reader,deadline:p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),10))])},
        cache:new Map(),pending:new Map(),Date,Promise});
    vm.runInContext(section('monthly.js','    async function read(','    function counts('),ctx);
    return ctx;
}
test('monthly stalled sources settle independently and remain retryable',async()=>{
    let blocked=true,calls=0;
    const h=monthly(async table=>{calls++;if(table==='youtube_songs' && blocked)return new Promise(()=>{});return [];});
    const first=await Promise.race([h.read('2026-10'),new Promise(resolve=>setTimeout(()=>resolve('stalled'),60))]);
    assert.notEqual(first,'stalled');assert.equal(first.music.status,'error');assert.equal(first.live.status,'success');
    blocked=false;const second=await h.read('2026-10');assert.equal(second.music.status,'success');assert.equal(calls,6);
});
test('monthly partial errors never poison the five-minute cache',async()=>{
    let fail=true;
    const h=monthly(async table=>{if(fail&&table==='content_archive')throw Error('offline');return [];});
    assert.equal((await h.read('2026-10')).content.status,'error');
    fail=false;assert.equal((await h.read('2026-10')).content.status,'success');
});

test('a late CONTENT editor check cannot restore controls after logout',async()=>{
    let resolve;
    const button={hidden:true};
    const ctx=vm.createContext({state:{isEditor:false,detailId:null},editorGeneration:0,
        checkEditor:user=>user?new Promise(r=>{resolve=r;}):Promise.resolve(false),
        $:()=>button,renderGrid(){},openDetail(){}});
    vm.runInContext(section('content.js','    async function setEditorFromUser','    async function initAuth'),ctx);
    const signIn=ctx.setEditorFromUser({id:'editor'});
    await ctx.setEditorFromUser(null);resolve(true);await signIn;
    assert.equal(ctx.state.isEditor,false);assert.equal(button.hidden,true);
});

test('MUSIC ignores other origins and cannot restore an old editor check after logout',async()=>{
    let listener,resolve;
    const ctx=vm.createContext({window:{location:{origin:'https://beadyo.com'},addEventListener:(type,fn)=>{listener=fn;}},
        beadyoAllowedMessageOrigin:o=>o==='https://beadyo.com',state:{isEditor:true},editorGeneration:0,
        document:{body:{classList:{toggle(){},remove(){}}}},checkEditor:user=>user?new Promise(r=>{resolve=r;}):Promise.resolve(false)});
    vm.runInContext(section('songs.html',"        window.addEventListener('message', async event",'        // ─── 초기 로드'),ctx);
    await listener({origin:'http://localhost:3000',data:{type:'beadyo-auth-sync',user:null}});
    assert.equal(resolve,undefined);
    assert.equal(ctx.state.isEditor,true);
    const signIn=listener({origin:'https://beadyo.com',data:{type:'beadyo-auth-sync',user:{id:'editor'}}});
    await listener({origin:'https://beadyo.com',data:{type:'beadyo-auth-sync',user:null}});
    resolve(true);await signIn;assert.equal(ctx.state.isEditor,false);
});

test('calendar runtime fallback cannot hang on a stalled JSON body',async()=>{
    const app=source('app.js');
    const start=app.includes('async function readCalendarJson')?'async function readCalendarJson':'async function fetchRuntimeCache';
    const ctx=vm.createContext({AbortController,SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'test-public',
        fetch:async()=>({ok:true,json:()=>new Promise(()=>{})}),setTimeout:fn=>setTimeout(fn,10),clearTimeout});
    vm.runInContext(section('app.js',start,'async function fetchActiveUpEvents'),ctx);
    const result=await Promise.race([ctx.fetchRuntimeCache('live_status').then(()=> 'resolved',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('stalled'),60))]);
    assert.equal(result,'rejected');
});

test('a late calendar broadcast-info read cannot overwrite a newer month',async()=>{
    let resolve;
    const old=new Promise(r=>{resolve=r;});
    const fetcher=async url=>({ok:true,json:()=>url.includes('gte.old')?old:Promise.resolve([{id:'new'}])});
    const ctx=vm.createContext({state:{broadcastInfos:[]},_loadRequestSequence:1,console,
        SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'test-public',fetch:fetcher,
        BeadyoCommon:{fetchWithTimeout:fetcher},readCalendarJson:r=>r.json()});
    vm.runInContext(section('app.js','async function loadBroadcastInfos','function eventsForDate'),ctx);
    const first=ctx.loadBroadcastInfos('old','old',1);
    ctx._loadRequestSequence=2;await ctx.loadBroadcastInfos('new','new',2);
    resolve([{id:'old'}]);await first;assert.equal(ctx.state.broadcastInfos[0].id,'new');
});

test('a late calendar memo read cannot replace the newly selected month',async()=>{
    for (const rejectOld of [false,true]) {
        let resolve,reject;
        const old=new Promise((a,b)=>{resolve=a;reject=b;});
        const fetcher=async url=>({ok:true,json:()=>url.includes('eq.2026-09')?old:Promise.resolve([{id:'new'}])});
        const ctx=vm.createContext({state:{year:2026,month:8,memoCards:[]},_memoCardsRequestSequence:0,console,
            SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'test-public',
            BeadyoCommon:{fetchWithTimeout:fetcher},readCalendarJson:r=>r.json(),renderMemoSidebar(){}});
        vm.runInContext(section('app.js','async function loadMemoCards','function renderMemoSidebar'),ctx);
        const first=ctx.loadMemoCards();await Promise.resolve();
        ctx.state.month=9;await ctx.loadMemoCards();
        if(rejectOld)reject(Error('old request failed'));else resolve([{id:'old'}]);
        await first;assert.equal(ctx.state.memoCards[0]?.id,'new');
    }
});
