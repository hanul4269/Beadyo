const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../home-data.js');
const now = new Date('2026-10-09T15:30:00Z'); // 10/10 00:30 KST
const live = value => ({ live: value, updated: now.toISOString(), title: '방송 제목' });
const scheduled = { id: 'one', date: '2026-10-10', type: 'song', start_time: '22:00:00', title: '노래 방송' };
const rest = { id: 'rest', date: '2026-10-10', type: 'rest', title: '휴방' };
test('Korean day changes at Korean midnight, independent of machine timezone', () => {
    assert.equal(D.dayKey(now), '2026-10-10');
    assert.equal(D.dayKey(new Date('2026-10-09T14:59:59Z')), '2026-10-09');
});
test('missing, stale, malformed and future LIVE samples never mean offline or rest', () => {
    for (const data of [null, {}, { live: false }, { live: 'false', updated: now.toISOString() },
        { live: false, updated: '2026-10-09T14:59:59Z' }, { live: true, updated: '2026-10-10T15:30:00Z' }]) {
        assert.equal(D.broadcastState(data, [rest], now).kind, 'unknown');
    }
});
test('actual LIVE takes priority over a rest schedule and a schedule outage', () => {
    assert.equal(D.broadcastState(live(true), [rest], now).kind, 'live');
    assert.equal(D.broadcastState(live(true), null, now).kind, 'live');
});
test('rest requires explicit registered rest and confirmed offline', () => {
    assert.equal(D.broadcastState(live(false), [rest], now).kind, 'rest');
    assert.equal(D.broadcastState(live(false), [{ ...rest, type: 'general', is_rest: true }], now).kind, 'rest');
    assert.equal(D.broadcastState(live(false), [], now).kind, 'unknown');
    assert.equal(D.broadcastState(live(false), null, now).kind, 'unknown');
});
test('mixed rest and broadcast records are treated as a conflict', () => {
    assert.equal(D.broadcastState(live(false), [rest, scheduled], now).kind, 'unknown');
});
test('scheduled time is interpreted in Korea; elapsed schedules do not promise a broadcast', () => {
    assert.equal(D.broadcastState(live(false), [scheduled], now).kind, 'scheduled');
    assert.equal(D.broadcastState(live(false), [{ ...scheduled, start_time: '00:01:00' }], now).kind, 'unknown');
    assert.equal(D.broadcastState(live(false), [{ ...scheduled, start_time: null }], now).kind, 'scheduled');
    assert.equal(D.broadcastState(live(false), [{ ...scheduled, date: '2026-10-11' }], now).next.date, '2026-10-11');
    assert.equal(D.broadcastState(live(false), [{ ...scheduled, type: 'cover' }], now).kind, 'unknown');
});
test('multi-day rest and month boundaries use actual registered dates', () => {
    assert.equal(D.onDay({ ...rest, date: '2026-10-09', end_date: '2026-10-11' }, '2026-10-10'), true);
    assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
    assert.ok(Number.isNaN(D.dayNumber('2026-02-30')));
});
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('all established hash and query routes keep their tab IDs; HOME adds ID 7', () => {
    const source = fs.readFileSync(path.join(__dirname, '../index-app.js'), 'utf8');
    const constants = ['CONTENT_TAB_INDEX', 'GAME_TAB_INDEX', 'HOME_TAB_INDEX', 'TAB_ROUTES', 'MUSIC_TAB_INDEX'].map(name => source.match(new RegExp(`^const ${name} = .*;$`, 'm'))[0]).join('\n');
    const functions = source.slice(source.indexOf('function routeToMusicPage()'), source.indexOf('\nconst readOnlyUrl'));
    const location = { search: '', hash: '', pathname: '/index.html', href: 'https://example.com/index.html' };
    const calls = [];
    const ctx = vm.createContext({ URLSearchParams, authServiceUnavailable: false, window: { location }, document: { title: 'Beadyo' },
        history: { pushState: (_, __, url) => calls.push(url), replaceState: (_, __, url) => calls.push(url) } });
    vm.runInContext(constants + "\nlet currentMusicPage = 'songs';\n" + functions, ctx);
    const routes = { calendar: 0, schedule: 1, songbook: 2, live: 3, music: 4, content: 5, games: 6, home: 7,
        songs: 4, gembox: 4, jewelbox: 4, tractor: 4, 'tractor-service': 4, tractorservice: 4,
        dance: 4, 'dance-video': 4, 'dance-videos': 4 };
    for (const [route, expected] of Object.entries(routes)) {
        location.hash = '#' + route; location.search = '';
        assert.equal(ctx.routeToTabIndex(), expected, '#' + route);
        location.hash = ''; location.search = '?tab=' + route;
        assert.equal(ctx.routeToTabIndex(), expected, '?tab=' + route);
    }
    location.search = ''; location.hash = '#game-preview'; assert.equal(ctx.routeToTabIndex(), 6);
    location.search = '?tab=game'; location.hash = ''; assert.equal(ctx.routeToTabIndex(), 6);
    location.search = ''; location.hash = ''; assert.equal(ctx.routeToTabIndex(), null);
    location.search = '?tab=home&keep=1'; location.hash = '#home'; location.href += '?tab=home&keep=1#home';
    ctx.syncTabUrl(0);
    assert.equal(calls.at(-1), '/index.html?keep=1#calendar');
});
test('one failed source leaves other HOME sources usable and never invents data', async () => {
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', disabled: false });
        return nodes.get(id);
    };
    const root = node('frame-7');
    root.classList = { contains: () => true };
    root.querySelector = () => node('refresh');
    root.addEventListener = () => {};
    const ctx = vm.createContext({ console, Date, Intl, Set, Promise, URL, URLSearchParams, setTimeout, clearTimeout, setInterval() {},
        document: { hidden: false, getElementById: node, addEventListener() {} },
        window: { location: { pathname: '/index.html', search: '?tab=home&keep=1' }, BeadyoHomeData: D, BeadyoHomeSoop: { boardUrl: require('../home-soop.js').boardUrl, read: async () => { throw new Error('SOOP unavailable'); } }, BeadyoExploreData: require('../explore-data.js'), BeadyoCommon: {
            esc: text => String(text ?? ''), safeUrl: text => text || '',
            unifiedSearchConfig: { cacheTtlMs: 3600000 },
            loadUnifiedSearchData: async () => { throw new Error('Removed HOME song must not load the songbook'); },
            fetchWithTimeout: async () => ({ ok: true, json: async () => ({ scheduleIds: [] }) }),
        } },
        fetchLiveStatus: async () => null,
        fetchSupabaseRest: async path => {
            if (path.startsWith('schedules?')) throw new Error('503');
            return [];
        },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../home.js'), 'utf8'), ctx);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(node('home-schedule').innerHTML, /불러오지 못했습니다/);
    assert.match(node('home-soop').innerHTML, /불러오지 못했습니다/);
    assert.match(node('home-live').innerHTML, /상태 확인 불가/);
    assert.doesNotMatch(node('home-news').innerHTML, /home-notices/);
    assert.match(node('home-news').innerHTML, /등록된 음악 영상이 없습니다/);
    assert.doesNotMatch(root.innerHTML, /home-up|home-fan|data-home-settings|home-all-hidden/);
    assert.match(node('home-cafe').innerHTML, /카페 글 목록을 불러오지 못했습니다/);
    assert.deepEqual([...root.innerHTML.matchAll(/data-home-card="([^"]+)"/g)].map(match => match[1]), ['live','schedule','news','content','cafe','monthly','events']);
    assert.doesNotMatch(root.innerHTML, /home-song|오늘의 한 곡/);
    assert.equal(nodes.has('home-song'), false);
    assert.equal(node('refresh').disabled, false);
    assert.match(root.innerHTML, /href="\/index.html\?keep=1#calendar"/);
    assert.doesNotMatch(root.innerHTML, /href="[^"]*tab=home/);
});

test('manual cafe refresh keeps five posts, bypasses cache once, and recovers after failure', async t => {
    const nodes = new Map(), listeners = new Map(), requests = [], deferred = [];
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', disabled: false });
        return nodes.get(id);
    };
    const root = node('frame-7');
    root.classList = { contains: () => true };
    root.querySelector = () => node('home-cafe-refresh');
    root.addEventListener = (type, handler) => listeners.set(type, handler);
    const fetchedAt = new Date().toISOString();
    const feed = prefix => ({ fetchedAt, stale: false, fetchFailed: false, posts: Array.from({ length: 5 }, (_, index) => ({
        id: String(40000 + index), title: `${prefix} ${index + 1}`,
        publishedAt: new Date(Date.parse(fetchedAt) - (index + 1) * 60000).toISOString(),
        href: `https://cafe.naver.com/f-e/cafes/31098081/articles/${40000 + index}`,
    })) });
    const initial = feed('기존 글');
    const fetchWithTimeout = async () => ({ ok: true, json: async () => ({ scheduleIds: [] }) });
    const readCafe = (fetch, options) => {
        requests.push({ fetch, force: options.force });
        if (requests.length === 1) return Promise.resolve(initial);
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        deferred.push({ resolve, reject });
        return promise;
    };
    t.after(() => deferred.forEach(request => request.resolve(initial)));
    const ctx = vm.createContext({ console, Date, Intl, Set, Promise, URL, URLSearchParams, setTimeout, clearTimeout, setInterval() {},
        document: { hidden: false, getElementById: node, addEventListener() {} },
        window: { location: { pathname: '/index.html', search: '?tab=home' }, BeadyoHomeData: D,
            BeadyoHomeSoop: { boardUrl: require('../home-soop.js').boardUrl, read: async () => [] },
            BeadyoHomeCafe: { boardUrl: 'https://cafe.naver.com/f-e/cafes/31098081/menus/21?viewType=L', read: readCafe },
            BeadyoExploreData: require('../explore-data.js'),
            BeadyoCommon: { esc: text => String(text ?? ''), safeUrl: text => text || '', fetchWithTimeout },
        },
        fetchLiveStatus: async () => null, fetchSupabaseRest: async () => [],
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../home.js'), 'utf8'), ctx);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    await settle();
    assert.match(root.innerHTML, /id="home-cafe-refresh"[^>]*data-home-refresh="cafe"/);
    assert.deepEqual([...root.innerHTML.matchAll(/data-home-card="([^"]+)"/g)].map(match => match[1]),
        ['live', 'schedule', 'news', 'content', 'cafe', 'monthly', 'events']);
    const button = node('home-cafe-refresh');
    button.dataset = { homeRefresh: 'cafe' };
    button.closest = () => button;
    const click = target => listeners.get('click')({ target, preventDefault() {} });
    const html = () => node('home-cafe').innerHTML;
    const list = () => html().match(/<ul class="home-list home-cafe-list">[\s\S]*?<\/ul>/)?.[0];
    const assertButton = busy => {
        assert.equal(button.disabled, busy);
        assert.equal(button.ariaBusy, String(busy));
        assert.equal(button.textContent, busy ? '갱신 중…' : '새로고침');
    };
    const assertFivePosts = prefix => {
        assert.equal([...html().matchAll(/class="home-item home-cafe-item"/g)].length, 5);
        for (let index = 1; index <= 5; index++) assert.match(html(), new RegExp(`${prefix} ${index}`));
    };
    assertButton(false);
    assertFivePosts('기존 글');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].force, false);
    const originalList = list();

    click(button);
    assertButton(true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].fetch, fetchWithTimeout);
    assert.equal(requests[1].force, true);
    assert.equal(list(), originalList);
    assertFivePosts('기존 글');
    assert.match(html(), /최근 업데이트 · <time/);
    assert.equal((html().match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(html(), /목록을 새로고침하는 중|수집된 목록을 다시 불러왔습니다|정기 수집 후 반영/);
    // Exercise the load guard even if a queued/programmatic click reaches a disabled button.
    click(button);
    click(button);
    assert.equal(requests.length, 2);
    deferred[0].resolve(feed('새 글'));
    await settle();
    assertButton(false);
    assertFivePosts('새 글');
    assert.doesNotMatch(html(), /기존 글/);
    assert.match(html(), /최근 업데이트 · <time/);
    assert.equal((html().match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(html(), /수집된 목록을 다시 불러왔습니다|정기 수집 후 반영|고정 공지를 제외한 최근 글/);
    assert.ok(html().includes(`datetime="${fetchedAt}"`));

    const updatedList = list();
    click(button);
    assertButton(true);
    assert.equal(requests.length, 3);
    assert.equal(requests[2].force, true);
    assert.equal(list(), updatedList);
    deferred[1].reject(new Error('Cafe cache unavailable'));
    await settle();
    assertButton(false);
    assertFivePosts('새 글');
    assert.equal(list(), updatedList);
    assert.match(html(), /마지막으로 확인한 목록/);
    assert.match(html(), /data-home-retry="cafe"/);
    assert.doesNotMatch(html(), /수집된 목록을 다시 불러왔습니다/);

    const retry = { dataset: { homeRetry: 'cafe' } };
    retry.closest = () => retry;
    click(retry);
    assertButton(true);
    assert.equal(requests.length, 4);
    assert.equal(requests[3].force, true);
    assert.equal(list(), updatedList);
    click(retry);
    click(button);
    assert.equal(requests.length, 4);
    deferred[2].resolve(feed('재시도 글'));
    await settle();
    assertButton(false);
    assertFivePosts('재시도 글');
    assert.doesNotMatch(html(), /data-home-retry="cafe"|마지막으로 확인한 목록|목록을 새로고침하는 중/);
});

test('fixed HOME ignores retired preferences; bare entry stays CALENDAR and explicit tabs survive', () => {
    const source = fs.readFileSync(path.join(__dirname,'../index-app.js'),'utf8');
    const boot = source.slice(source.indexOf('// 첫 탭 초기 로드'),source.indexOf('function handleTabRouteChange()'));
    for (const requested of [null, 7, 2, 3, 4, 5, 6]) {
        const calls = [];
        let reads = 0;
        const context = { updateGuideNewBadges(){}, applyTheme(){}, currentTheme:'light', currentMusicPage:'songs',
            routeToMusicPage:()=>null, MUSIC_PAGES:{ songs:{} }, routeToTabIndex:()=>requested,
            switchTab: index => calls.push(index), window:{location:{hash:'',pathname:'/'}},
            localStorage:{getItem(){reads++;return '{"start":"home","hidden":["live"]}';}} };
        vm.runInNewContext(boot, context);
        assert.equal(calls.at(-1),requested ?? 0);
        assert.equal(reads,0);
    }
});

test('news uses actual YouTube IDs and keeps safe links when an image cannot be derived', () => {
    const source = fs.readFileSync(path.join(__dirname,'../home.js'),'utf8');
    const helpers = source.slice(source.indexOf('    function newsThumbnail('),source.indexOf('    function scheduleItem('));
    const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    const E = require('../explore-data.js');
    const ctx = vm.createContext({ window:{BeadyoExploreData:E}, esc, url:E.safeUrl, routeHref:route=>'#'+route });
    vm.runInContext(helpers, ctx);
    for (const href of ['https://youtu.be/Yv4p3ht3nfY?si=real', 'https://www.youtube.com/watch?v=Yv4p3ht3nfY', 'https://www.youtube.com/shorts/Yv4p3ht3nfY']) {
        const html = ctx.newsItem(href, 'Actual title', '2026-10-10', 'music');
        assert.match(html, /https:\/\/img.youtube.com\/vi\/Yv4p3ht3nfY\/hqdefault.jpg/);
        assert.match(html, /loading="lazy"/);
        assert.match(html, /Actual title/);
        assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    }
    for (const href of ['https://example.com/watch?v=Yv4p3ht3nfY', 'https://youtu.be/invalid']) {
        const html = ctx.newsItem(href, 'Available link', '', 'calendar');
        assert.doesNotMatch(html, /<img/);
        assert.match(html, /썸네일 없음/);
        assert.match(html, /Available link/);
    }
    const unsafe = ctx.newsItem('javascript:alert(1)', '<script>', '', 'music');
    assert.doesNotMatch(unsafe, /javascript:|<script>/);
    assert.match(unsafe, /href="#music"/);
});
test('thumbnail failure hides only the image and leaves the link usable without retrying', () => {
    const source = fs.readFileSync(path.join(__dirname,'../home.js'),'utf8');
    const start = source.indexOf("            root.addEventListener('error', event => {");
    const handler = source.slice(start, source.indexOf("            root.addEventListener('click'",start));
    let onError;
    vm.runInNewContext(handler, {root:{addEventListener(type, fn, capture){assert.equal(type,'error');assert.equal(capture,true);onError=fn;}}});
    const message = {hidden:true,textContent:''};
    const image = {hidden:false,src:'real-thumbnail',matches:selector=>selector==='[data-home-thumbnail]',parentElement:{querySelector:()=>message}};
    onError({target:image});
    assert.equal(image.hidden,true);
    assert.equal(image.src,'real-thumbnail');
    assert.equal(message.hidden,false);
    assert.equal(message.textContent,'이미지를 불러올 수 없습니다');
    onError({target:{matches:()=>false}});
});

test('HOME shows the live image only for a fresh confirmed broadcast; stale/OFF/missing ID restore artwork', () => {
    const source = fs.readFileSync(path.join(__dirname,'../home.js'),'utf8');
    const body = source.slice(source.indexOf('    function renderLive()'),source.indexOf('    function renderSchedule()'));
    const selections = [];
    const sources = {schedule:{status:'success',data:[]}};
    const render = new Function('sources','D','setHtml','esc','eventDate','external','SOOP','refreshNotice','window',body+';return renderLive;')(
        sources,D,()=>{},String,()=>'',()=>'', '',()=>'',{BeadyoHomeVisual:{setBroadcast:value=>selections.push(value)}});
    for (const data of [
        {live:true,broad_no:'123',title:'LIVE',updated:new Date().toISOString()},
        {live:false,broad_no:'123',updated:new Date().toISOString()},
        {live:true,broad_no:'123',updated:'2000-01-01T00:00:00Z'},
        {live:true,updated:new Date().toISOString()}
    ]) {sources.live={status:'success',data};render();}
    assert.deepEqual(selections,['123',null,null,undefined]);
});
