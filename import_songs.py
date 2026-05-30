"""
구슬요 노래 데이터 Supabase 임포트 스크립트
Usage:
  python3 import_songs.py
  → Supabase service role key 입력 프롬프트 (Project Settings > API > service_role)
"""
import json, os, sys, ssl
import urllib.request, urllib.error

ctx = ssl._create_unverified_context()

SUPABASE_URL  = 'https://qlmcwobfldgmhwhptkfz.supabase.co'
SONGBOOK_JSON = '/tmp/songbook.json'
LIVE_JSON     = '/tmp/live_songs.json'
BATCH         = 300

def get_key():
    key = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()
    if not key:
        key = input('Supabase service role key: ').strip()
    return key

def req(method, path, key, body=None):
    url = SUPABASE_URL + path
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    })
    try:
        with urllib.request.urlopen(r, context=ctx) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def clear_table(table, key):
    status, body = req('DELETE', f'/rest/v1/{table}?id=gt.0', key)
    if status not in (200, 204):
        print(f'  [경고] 삭제 실패 {status}: {body[:200]}')

def insert_batch(table, records, key):
    total = len(records)
    for i in range(0, total, BATCH):
        chunk = records[i:i+BATCH]
        status, body = req('POST', f'/rest/v1/{table}', key, chunk)
        if status not in (200, 201):
            print(f'  [오류] {status}: {body[:300]}')
            return False
        print(f'  {i+len(chunk)}/{total}건 완료')
    return True

def main():
    key = get_key()
    if not key:
        print('key가 없습니다. 종료합니다.')
        sys.exit(1)

    # ── 노래책 ──────────────────────────────────
    print('\n[ 노래책 임포트 ]')
    with open(SONGBOOK_JSON, encoding='utf-8') as f:
        songs = json.load(f)
    print('  기존 데이터 삭제 중...')
    clear_table('songbook', key)
    print(f'  {len(songs)}곡 삽입 중...')
    if not insert_batch('songbook', songs, key):
        print('\n[실패] service role key가 맞는지 확인해주세요.')
        sys.exit(1)

    # ── 라이브 기록 ─────────────────────────────
    print('\n[ 라이브 기록 임포트 ]')
    with open(LIVE_JSON, encoding='utf-8') as f:
        live = json.load(f)
    print('  기존 데이터 삭제 중...')
    clear_table('live_songs', key)
    print(f'  {len(live)}건 삽입 중...')
    if not insert_batch('live_songs', live, key):
        print('\n[실패] service role key가 맞는지 확인해주세요.')
        sys.exit(1)

    print('\n✓ 임포트 완료!')

if __name__ == '__main__':
    main()
