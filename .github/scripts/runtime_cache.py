import json
import os
import urllib.error
import urllib.request

SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co'


def upsert_runtime_cache(cache_key, payload, updated_at=None):
    service_key = (
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        or os.environ.get('SUPABASE_SERVICE_KEY')
    )
    if not service_key:
        message = 'SUPABASE_SERVICE_ROLE_KEY is not set; runtime cache was not updated.'
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            raise RuntimeError(message)
        print(message)
        return False

    row = {
        'cache_key': cache_key,
        'payload': payload,
    }
    if updated_at:
        row['updated_at'] = updated_at

    url = f'{SUPABASE_URL}/rest/v1/site_runtime_cache?on_conflict=cache_key'
    body = json.dumps([row], ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        method='POST',
        headers={
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status not in (200, 201, 204):
                raise RuntimeError(f'Unexpected Supabase status: {resp.status}')
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Supabase upsert failed: HTTP {error.code} {detail}') from error

    print(f'site_runtime_cache upserted: {cache_key}')
    return True
