import json, re, subprocess, sys
from datetime import datetime, timezone
from runtime_cache import upsert_runtime_cache

result = subprocess.run(
    ['curl', '-s', '--fail', '--max-time', '10',
     '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     '-H', 'Accept: application/json',
     '-H', 'Origin: https://www.sooplive.co.kr',
     '-H', 'Referer: https://www.sooplive.co.kr/',
     'https://chapi.sooplive.co.kr/api/beadyo97/station'],
    capture_output=True, text=True
)
print('Response length:', len(result.stdout))
if result.returncode != 0:
    print('SOOP 요청 실패 → 기존 LIVE 캐시 유지', file=sys.stderr)
    sys.exit(1)

is_live = False
title = ''

try:
    d = json.loads(result.stdout)
    if not isinstance(d, dict) or d.get('station', {}).get('user_id') != 'beadyo97' or 'broad' not in d:
        raise ValueError('Invalid station response')
    broad = d['broad']
    if broad is not None and (not isinstance(broad, dict)
            or not re.fullmatch(r'[1-9]\d*', str(broad.get('broad_no')))
            or not isinstance(broad.get('broad_title'), str)):
        raise ValueError('Invalid broadcast response')
    is_live = broad is not None
    title = broad['broad_title'].strip() if is_live else ''
    print(f'live={is_live}, title={title!r}')
except Exception as e:
    print('Parse error:', e, '| raw:', result.stdout[:200])
    print('API 파싱 실패 → 기존 LIVE 캐시 유지', file=sys.stderr)
    sys.exit(1)

output = {
    'live': is_live,
    'title': title,
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open('live.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print('live.json written:', output)
upsert_runtime_cache('live_status', output, output['updated'])
