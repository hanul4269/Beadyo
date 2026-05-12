import json, subprocess, sys
from datetime import datetime, timezone

result = subprocess.run(
    ['curl', '-s', '--max-time', '10',
     '-X', 'POST', '-d', 'bid=beadyo97',
     '-H', 'Content-Type: application/x-www-form-urlencoded',
     '-H', 'Referer: https://play.sooplive.com/',
     '-H', 'Origin: https://play.sooplive.com',
     '-H', 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
     '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
     'https://live.sooplive.com/afreeca/player_live_api.php'],
    capture_output=True, text=True
)
print('Response length:', len(result.stdout))
print('Raw:', result.stdout[:300])

is_live = False
title = ''

try:
    d = json.loads(result.stdout)
    ch = d.get('CHANNEL', {})
    is_live = bool(ch.get('BNO'))
    title = (ch.get('TITLE') or '').strip()
    print(f'live={is_live}, title={title!r}')
except Exception as e:
    print('Primary API parse error:', e)

# 실패 시 station 페이지 HTML 파싱으로 fallback
if not is_live and len(result.stdout) < 50:
    print('Falling back to station page check...')
    r2 = subprocess.run(
        ['curl', '-s', '--max-time', '10', '-L',
         '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
         '-H', 'Accept-Language: ko-KR,ko;q=0.9',
         'https://www.sooplive.co.kr/station/beadyo97'],
        capture_output=True, text=True
    )
    html = r2.stdout
    print('Station page length:', len(html))
    if '"bno"' in html.lower() or 'liveOnAir' in html or 'on-air' in html.lower():
        is_live = True
        print('Station page indicates LIVE')
    else:
        print('Station page indicates NOT live')

output = {
    'live': is_live,
    'title': title,
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open('live.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print('live.json written:', output)
