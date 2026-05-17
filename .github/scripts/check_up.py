import json, re, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

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
                break
            d = r.json()
            data = d.get('data', [])
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
            meta = d.get('meta', {})
            print(f'  page {page}/{meta.get("lastPage", 1)}, got {len(data)} items')
            if page >= meta.get('lastPage', 1):
                break
            page += 1
        return [r for r in all_items if r['bj_id']] or None
    except Exception as e:
        print(f'  curl_cffi error: {e}')
        return None


# ── Supabase 이벤트 조회 (supabase-py 우선, urllib 폴백) ──
print('Fetching UP events from Supabase...')
events = []

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
    events = resp.data or []
    print(f'[supabase-py] Found {len(events)} events: {[e.get("tab_name") for e in events]}')
except Exception as e:
    print(f'[supabase-py] Failed: {e}')
    try:
        events = fetch_supabase_events_urllib()
        print(f'[urllib] Found {len(events)} events: {[e.get("tab_name") for e in events]}')
    except Exception as e2:
        print(f'[urllib] Also failed: {e2}')
        events = []

# 이전 up.json 로드
try:
    with open('up.json', 'r', encoding='utf-8') as f:
        prev = json.load(f)
    prev_map = {e['id']: e for e in prev.get('events', [])}
except Exception:
    prev_map = {}

events_out = []
for ev in events:
    bj_id, post_no = parse_soop_url(ev['soop_url'])
    if not bj_id or not post_no:
        print(f'Could not parse URL: {ev["soop_url"]}')
        continue
    print(f'Processing: [{ev["tab_name"]}] {ev["title"]} ({bj_id}/post/{post_no})')
    replies = fetch_replies(bj_id, post_no)

    if replies is None:
        if ev['id'] in prev_map:
            print(f'  Keeping previous data')
            events_out.append(prev_map[ev['id']])
        else:
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
    })

output = {
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'events':  events_out,
}
with open('up.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print(f'up.json written: {len(events_out)} events')
