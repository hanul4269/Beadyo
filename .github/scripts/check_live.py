import json, subprocess, sys
from datetime import datetime, timezone
from runtime_cache import upsert_runtime_cache

result = subprocess.run(
    ['curl', '-s', '--max-time', '10',
     '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     '-H', 'Accept: application/json',
     '-H', 'Origin: https://www.sooplive.co.kr',
     '-H', 'Referer: https://www.sooplive.co.kr/',
     'https://chapi.sooplive.co.kr/api/beadyo97/station'],
    capture_output=True, text=True
)
print('Response length:', len(result.stdout))

is_live = False
title = ''

try:
    d = json.loads(result.stdout)
    broad = d.get('broad')
    is_live = isinstance(broad, dict) and bool(broad.get('broad_no'))
    title = (broad.get('broad_title') or '').strip() if is_live else ''
    print(f'live={is_live}, title={title!r}')
except Exception as e:
    print('Parse error:', e, '| raw:', result.stdout[:200])
    is_live = False
    title = ''
    print('API 파싱 실패 → live=false 처리')

output = {
    'live': is_live,
    'title': title,
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open('live.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print('live.json written:', output)
upsert_runtime_cache('live_status', output, output['updated'])
