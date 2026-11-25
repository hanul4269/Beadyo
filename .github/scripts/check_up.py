import json, re, sys, urllib.request, urllib.parse
from datetime import datetime, timezone
from runtime_cache import upsert_runtime_cache

SUPABASE_URL      = 'https://qlmcwobfldgmhwhptkfz.supabase.co'
SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR'

def parse_soop_url(url):
    url = url.split('#')[0]
    m = re.search(r'/(?:station/)?(\w+)/post/(\d+)', url)
    if m:
        return m.group(1), m.group(2)
    return None, None

def fetch_replies(bj_id, post_no):
    try:
        from curl_cffi import requests as cffi_req
        all_items = []
        page = 1
        while True:
            url = (f'https://api-channel.sooplive.com/v1.1/channel/{bj_id}/post/{post_no}'
                   f'/comment?page={page}&orderBy=reg_date&cCommentNo=0&perPage=100')
            r = cffi_req.get(url, impersonate='chrome124', headers={
                'Accept': 'application/json',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Referer': 'https://www.sooplive.com/',
                'Origin': 'https://www.sooplive.com',
            }, timeout=15)
            print(f'  [page {page}] status={r.status_code}')
            if r.status_code != 200:
                return None
            d = r.json()
            data = d.get('data')
            total = d.get('meta', {}).get('lastPage')
            if (not isinstance(data, list) or isinstance(total, bool)
                    or not isinstance(total, (str, int)) or not str(total).isdigit()):
                return None
            last_page = int(total)
            if ((last_page == 0 and (page != 1 or data))
                    or (last_page > 0 and last_page < page)
                    or (not data and (page > 1 or last_page > 1))):
                return None
            for item in data:
                if item.get('pCommentNo'):
                    all_items.append({
                        'bj_id':       str(item.get('userId', '')).strip(),
                        'name':        str(item.get('userNick', '')).strip(),
                        'profile_url': str(item.get('profileImage', '')).strip(),
                        'timestamp':   str(item.get('regDate', '')).strip(),
                        'up_count':    int(item.get('likeCnt', 0) or 0),
                        'reply_no':    str(item.get('pCommentNo', '')),
                    })
            print(f'  page {page}/{last_page}, got {len(data)} items')
            if page >= last_page:
                break
            page += 1
        return [r for r in all_items if r['bj_id']]
    except Exception as e:
        print(f'  curl_cffi error: {e}')
        return None


# ── Supabase 이벤트 조회 (supabase-py 우선, urllib 폴백) ──
print('Fetching UP events from Supabase...')

def validate_supabase_events(payload):
    if not isinstance(payload, list):
        raise ValueError('UP event response must be a list')
    for event in payload:
        if (not isinstance(event, dict)
                or not isinstance(event.get('id'), (int, str))
                or isinstance(event.get('id'), bool)
                or not all(isinstance(event.get(field), str)
                           for field in ('tab_name', 'title', 'soop_url'))):
            raise ValueError('UP event response contains an invalid row')
    return payload

def fetch_supabase_events_urllib():
    url = f'{SUPABASE_URL}/rest/v1/up_events?is_active=eq.true&order=sort_order'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    resp = sb.table('up_events').select('*').eq('is_active', True).order('sort_order').execute()
    events = validate_supabase_events(resp.data)
    print(f'[supabase-py] Found {len(events)} events: {[e.get("tab_name") for e in events]}')
except Exception as e:
    print(f'[supabase-py] Failed: {e}')
    try:
        events = validate_supabase_events(fetch_supabase_events_urllib())
        print(f'[urllib] Found {len(events)} events: {[e.get("tab_name") for e in events]}')
    except Exception as e2:
        print(f'[urllib] Also failed: {e2}', file=sys.stderr)
        sys.exit(1)

# 이전 랭킹 로드: 로컬 up.json이 있으면 그것을, 없으면(GitHub Actions) 공개
# 런타임 캐시를 읽는다. 수집이 실패한 이벤트는 이 값을 그대로 유지한다.
def fetch_previous_cache():
    url = (f'{SUPABASE_URL}/rest/v1/site_runtime_cache'
           '?cache_key=eq.up_ranking&select=payload')
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        rows = json.loads(resp.read().decode())
    if not isinstance(rows, list):
        raise ValueError('runtime cache response must be a list')
    if not rows:
        return {'events': []}
    payload = rows[0].get('payload') if isinstance(rows[0], dict) else None
    if not isinstance(payload, dict):
        raise ValueError('runtime cache payload must be an object')
    return payload

def load_previous():
    try:
        with open('up.json', 'r', encoding='utf-8') as f:
            return json.load(f), 'up.json'
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f'up.json unreadable: {e}')
    return fetch_previous_cache(), 'runtime cache'

try:
    prev, prev_source = load_previous()
    prev_events = prev.get('events', [])
    if not isinstance(prev_events, list):
        raise ValueError('previous events must be a list')
    prev_map = {e['id']: {**e, 'live_updated_at': e.get('live_updated_at') or prev.get('updated')}
                for e in prev_events if isinstance(e, dict) and 'id' in e}
    prev_loaded = True
    print(f'Previous ranking loaded from {prev_source}: {len(prev_map)} events')
except Exception as e:
    print(f'Previous ranking unavailable: {e}')
    prev_map = {}
    prev_loaded = False

events_out = []
collection_failures = 0
for ev in events:
    bj_id, post_no = parse_soop_url(ev['soop_url'])
    if not bj_id or not post_no:
        print(f'Could not parse URL (no post): {ev["soop_url"]}')
        events_out.append({
            'id':       ev['id'],
            'tab':      ev['tab_name'],
            'title':    ev['title'],
            'soop_url': ev['soop_url'],
            'ranking':  prev_map.get(ev['id'], {}).get('ranking', []),
            'live_updated_at': prev_map.get(ev['id'], {}).get('live_updated_at'),
        })
        continue
    print(f'Processing: [{ev["tab_name"]}] {ev["title"]} ({bj_id}/post/{post_no})')
    replies = fetch_replies(bj_id, post_no)

    if replies is None:
        collection_failures += 1
        if ev['id'] in prev_map:
            # 수집 실패: 탭·제목만 최신으로 두고 랭킹·글 주소·수집 시각은 기존 값을 유지
            # (글 주소를 바꾼 직후라면 랭킹과 주소가 같은 글을 가리키도록 함께 유지)
            print(f'  Collection failed; keeping previous ranking')
            previous = prev_map[ev['id']]
            events_out.append({
                **previous,
                'tab':      ev['tab_name'],
                'title':    ev['title'],
            })
        elif not prev_loaded:
            # 기존 값을 확인할 수 없으면 빈 랭킹으로 덮어쓸 위험이 있으니 저장하지 않는다.
            print('Collection failed and previous ranking is unavailable; '
                  'leaving stored ranking untouched.', file=sys.stderr)
            sys.exit(1)
        else:
            # 기존 값이 없는 새 이벤트: 덮어쓸 랭킹이 없으므로 빈 목록으로 시작
            events_out.append({
                'id':       ev['id'],
                'tab':      ev['tab_name'],
                'title':    ev['title'],
                'soop_url': ev['soop_url'],
                'ranking':  [],
            })
        continue

    replies.sort(key=lambda x: x['up_count'], reverse=True)
    for i, r in enumerate(replies):
        r['rank'] = i + 1

    events_out.append({
        'id':       ev['id'],
        'tab':      ev['tab_name'],
        'title':    ev['title'],
        'soop_url': ev['soop_url'],
        'ranking':  replies,
        'live_updated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    })

output = {
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'events':  events_out,
}
with open('up.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print(f'up.json written: {len(events_out)} events')
upsert_runtime_cache('up_ranking', output, output['updated'])
if collection_failures:
    print(f'::warning::UP comment collection failed for {collection_failures} event(s); '
          'previous rankings were kept.')
