// Run: node --test scripts/test-live-sync.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../index-app.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const notifications = between('async function loadLiveNotificationItems', 'function normalizeUpNotificationEvents');
const inbox = between('async function refreshNotificationInbox', 'function initNotificationInbox');
const live = between('const PROXY =', 'async function fetchRuntimeCache');
const fresh = between('function isFreshRuntimeCache', 'function checkLiveStatus');
const check = between('function checkLiveStatus', '\ncheckLiveStatus(true);');
const timers = between('setTimeout(checkLiveStatus, 3000);', '// ── 로그인 모달');
const settle = () => new Promise(resolve => setImmediate(resolve));
const defer = () => {let resolve; const promise = new Promise(r => {resolve = r}); return {promise, resolve};};
const response = (on, title = '방송 제목') => ({ok:true,json:async()=>({station:{user_id:'beadyo97'},broad:on?{broad_no:123,broad_title:title}:null})});
function harness() {
    let now = Date.now(), on = false, handler = () => response(on), badge = null;
    const calls = [], intervals = [], timeouts = [], events = {}, renders = [];
    class Clock extends Date {
        constructor(...args) {super(...(args.length ? args : [now]));}
        static now() {return now;}
    }
    const ctx = vm.createContext({Date:Clock, NOTIFICATION_REFRESH_INTERVAL_MS:120000,
        notificationState:{items:[{id:'notice:1',type:'notice',isRead:true}],loadedAt:0,loading:false,promise:null},
        notificationHash:value=>value, formatNotificationDate:value=>value,
        document:{getElementById:()=>({classList:{toggle:(_,value)=>{badge=value}}}),visibilityState:'visible',addEventListener:(name,fn)=>{events[name]=fn}},
        renderNotificationPanel:()=>renders.push({badge,live:ctx.notificationState.items.filter(i=>i.type==='live').map(i=>i.title)}),
        fetchWithTimeout:async url=>{calls.push({at:now,proxy:url.includes('deno.net')});return handler(url);},
        fetchRuntimeCache:async()=>null,
        loadPatchNotificationItems:async()=>[], loadNoticeNotificationItems:async()=>[{id:'notice:1',type:'notice',isRead:true}], loadUpNotificationItems:async()=>[],
        setInterval:(fn,ms)=>intervals.push({fn,ms}),setTimeout:(fn,ms)=>timeouts.push({fn,ms})});
    vm.runInContext(notifications+'\n'+inbox+'\n'+live+'\n'+fresh+'\n'+check+'\n'+timers,ctx);
    return {ctx,calls,intervals,timeouts,events,renders,setOn(v){on=v;},setHandler(fn){handler=fn;},advance(ms){now+=ms;},get badge(){return badge;},get item(){return ctx.notificationState.items.find(i=>i.type==='live');}};
}
test('simultaneous header, notification and forced refresh share one request', async()=>{
    const h=harness(), pending=defer(); h.setHandler(()=>pending.promise);
    const header=h.ctx.checkLiveStatus(true), panel=h.ctx.loadLiveNotificationItems(), forced=h.ctx.checkLiveStatus(true);
    assert.equal(h.calls.length,1);
    pending.resolve(response(true));
    const [a,items,b]=await Promise.all([header,panel,forced]);
    assert.equal(a.live,true);assert.equal(b.live,true);assert.equal(items[0].title,'LIVE 진행 중');
    assert.equal(h.badge,true);assert.equal(h.item.title,'LIVE 진행 중');
});
test('successful polling updates both UI consumers despite the two-minute inbox cache',async()=>{
    const h=harness();await h.ctx.refreshNotificationInbox();
    const loadedAt=h.ctx.notificationState.loadedAt;
    h.setOn(true);h.advance(60000);await h.intervals[0].fn();
    assert.equal(h.badge,true);assert.equal(h.item.title,'LIVE 진행 중');
    assert.equal(h.ctx.notificationState.loadedAt,loadedAt);
    assert.equal(h.ctx.notificationState.items.find(i=>i.type==='notice').isRead,true);
    await h.ctx.refreshNotificationInbox();
    assert.equal(h.calls.length,2);assert.equal(h.item.title,'LIVE 진행 중');
});
test('cached inbox independently refreshes expired LIVE state',async()=>{
    const h=harness();await h.ctx.refreshNotificationInbox();
    h.setOn(true);h.advance(56000);await h.ctx.refreshNotificationInbox();
    assert.equal(h.calls.length,2);assert.equal(h.badge,true);assert.equal(h.item.title,'LIVE 진행 중');
});
test('slow other notifications cannot restore an older LIVE snapshot',async()=>{
    const h=harness(), delayed=defer();
    h.ctx.loadNoticeNotificationItems=()=>delayed.promise;
    const inbox=h.ctx.refreshNotificationInbox();await settle();
    assert.equal(h.badge,false);
    h.setOn(true);h.advance(1000);await h.ctx.checkLiveStatus(true);
    delayed.resolve([{id:'notice:later',type:'notice'}]);await inbox;
    assert.equal(h.badge,true);assert.equal(h.item.title,'LIVE 진행 중');
    assert.equal(h.ctx.notificationState.items.filter(i=>i.type==='live').length,1);
});
test('visibility at 30s does not suppress the 60s scheduled network refresh',async()=>{
    const h=harness();await h.ctx.checkLiveStatus(true);
    h.advance(30000);h.setOn(true);h.events.visibilitychange();await settle();
    assert.equal(h.calls.length,2);assert.equal(h.badge,true);
    h.advance(30000);h.setOn(false);assert.equal(h.intervals[0].ms,60000);await h.intervals[0].fn();
    assert.equal(h.calls.length,3);assert.equal(h.badge,false);assert.equal(h.item.title,'LIVE 상태');
});
test('visibility and interval arriving during a slow request coalesce',async()=>{
    const h=harness(), pending=defer();h.setHandler(()=>pending.promise);
    const first=h.ctx.checkLiveStatus(true);h.events.visibilitychange();const interval=h.intervals[0].fn();
    assert.equal(h.calls.length,1);pending.resolve(response(true));await Promise.all([first,interval]);
    assert.equal(h.badge,true);
});
test('all-route failure preserves matching last known UI and allows a subsequent retry',async()=>{
    const h=harness();h.setOn(true);await h.ctx.checkLiveStatus(true);const previousTime=h.item.timestamp;
    h.advance(60000);h.setHandler(()=>({ok:false}));
    assert.equal(await h.ctx.checkLiveStatus(true),null);
    assert.equal(h.badge,true);assert.equal(h.item.title,'LIVE 진행 중');assert.equal(h.item.timestamp,previousTime);
    await h.ctx.refreshNotificationInbox();assert.equal(h.item.title,'LIVE 진행 중');
    h.setHandler(()=>response(false));await h.ctx.checkLiveStatus(true);
    assert.equal(h.badge,false);assert.equal(h.item.title,'LIVE 상태');
});
test('three-second startup check uses success memo but retries after total failure',async()=>{
    const success=harness();await success.ctx.checkLiveStatus(true);success.advance(3000);await success.timeouts[0].fn();assert.equal(success.calls.length,1);
    const failed=harness();failed.setHandler(()=>({ok:false}));await failed.ctx.checkLiveStatus(true);assert.equal(failed.calls.length,2);
    failed.advance(3000);failed.setHandler(()=>response(true));await failed.timeouts[0].fn();assert.equal(failed.calls.length,3);assert.equal(failed.badge,true);
});
