import json, subprocess, re, sys
from datetime import datetime, timezone

SUPABASE_URL      = 'https://qlmcwobfldgmhwhptkfz.supabase.co'
SUPABASE_ANON_KEY = 'sb_publishable_jMhCscf87Dtt38Wk_ASKrw_dRtQExSR'

HEADERS_SOOP = [
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: application/json, text/plain, */*',
    '-H', 'Accept-Language: ko-KR,ko;q=0.9',
    '-H', 'Referer: https://www.sooplive.co.kr/',
    '-H', 'Origin: https://www.sooplive.co.kr',
]

def curl_soop(url):
    cmd = ['curl', '-s', '--max-time', '15'] + HEADERS_SOOP + [url]
    return subprocess.run(cmd, capture_output=True, text=True).stdout

def parse_soop_url(url):
    url = url.split('#')[0]
    m = re.search(r'/(?:station/)?(\w+)/post/(\d+)', url)
    if m:
        return m.group(1), m.group(2)
    return None, None

def profile_url(bj_id):
    return f'https://profile.img.sooplive.co.kr/LOGO/{bj_id}/{bj_id}.jpg'

def fetch_replies(bj_id, post_no):
    endpoints = [
        f'https://api.m.afreecatv.com/station/board/reply/list?szBjId={bj_id}&nTitleNo={post_no}&nPageNo=1&nListCnt=200',
        f'https://api.m.sooplive.co.kr/station/board/reply/list?szBjId={bj_id}&nTitleNo={post_no}&nPageNo=1&nListCnt=200',
    ]
    for url in endpoints:
        raw = curl_soop(url)
        if not raw:
            continue
        try:
            d = json.loads(raw)
            replies = parse_reply_data(d)
            if replies is not None:
                print(f'  API OK ({url.split("/")[2]}): {len(replies)} replies')
                return replies
            else:
                print(f'  API response unexpected: {str(d)[:120]}')
        except Exception as e:
            print(f'  Parse error: {e} | raw: {raw[:80]}')
    print(f'  All API attempts failed for {bj_id}/post/{post_no}')
    return None

def parse_reply_data(d):
    if d.get('result') not in (1, '1') and 'data' not in d:
        return None
    data = d.get('data', d)
    items = data.get('list', data.get('reply_list', []))
    if not isinstance(items, list):
        return None
    replies = []
    for item in items:
        if item.get('depth', 0) != 0 or item.get('parent_no', 0) != 0:
            continue
        bj_id = str(item.get('user_id', '')).strip()
        if not bj_id:
            continue
        replies.append({
            'bj_id':       bj_id,
            'name':        str(item.get('user_nick', bj_id)).strip(),
            'profile_url': profile_url(bj_id),
            'timestamp':   str(item.get('comment_write_date', item.get('reg_date', ''))).strip(),
            'up_count':    int(item.get('recommend_cnt', item.get('up_cnt', 0)) or 0),
            'reply_no':    str(item.get('comment_no', item.get('reply_no', ''))),
        })
    return replies

# ── supabase-py로 이벤트 조회 ──
print('Fetching UP events from Supabase...')
try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    resp = sb.table('up_events').select('*').eq('is_active', True).order('sort_order').execute()
    events = resp.data or []
    print(f'Found {len(events)} active events: {[e.get("tab_name") for e in events]}')
except Exception as e:
    print(f'Supabase fetch error: {e}')
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
