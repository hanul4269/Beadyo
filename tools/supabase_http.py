"""Verified HTTPS transport for Beadyo's server-side Supabase credentials."""
import urllib.request


SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co'


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Even a same-host redirect can change a POST into a GET.
        return None


def supabase_key_headers(key):
    """Headers for a server-side key.

    Legacy anon/service_role keys are JWTs and also go in Authorization.
    The newer sb_secret_/sb_publishable_ keys are not JWTs, so Supabase
    expects them only in the apikey header. Legacy keys stop working at the
    end of 2026, so the GitHub secret can be swapped to sb_secret_ safely.
    """
    headers = {'apikey': key}
    if not key.startswith(('sb_secret_', 'sb_publishable_')):
        headers['Authorization'] = f'Bearer {key}'
    return headers


def open_supabase(req, timeout=30):
    if not req.full_url.startswith(SUPABASE_URL + '/'):
        raise ValueError('Refusing to send Supabase credentials outside the project')
    return urllib.request.build_opener(_NoRedirect).open(req, timeout=timeout)
