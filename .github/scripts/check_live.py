import json, subprocess, sys
from datetime import datetime, timezone

result = subprocess.run(
    ['curl', '-s', '--max-time', '10',
     '-X', 'POST', '-d', 'bid=beadyo97',
     '-H', 'Referer: https://play.sooplive.com/',
     '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     'https://live.sooplive.com/afreeca/player_live_api.php'],
    capture_output=True, text=True
)
print('HTTP response length:', len(result.stdout))

try:
    d = json.loads(result.stdout)
    ch = d.get('CHANNEL', {})
    is_live = bool(ch.get('BNO'))
    title = (ch.get('TITLE') or '').strip()
    print(f'live={is_live}, title={title!r}')
except Exception as e:
    print('parse error:', e, '| raw:', result.stdout[:200])
    sys.exit(0)

output = {
    'live': is_live,
    'title': title,
    'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open('live.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)
print('live.json written:', output)
