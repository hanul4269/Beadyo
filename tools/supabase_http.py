"""Verified HTTPS transport for Beadyo's server-side Supabase credentials."""
import urllib.request


SUPABASE_URL = 'https://qlmcwobfldgmhwhptkfz.supabase.co'


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Even a same-host redirect can change a POST into a GET.
        return None


def open_supabase(req, timeout=30):
    if not req.full_url.startswith(SUPABASE_URL + '/'):
        raise ValueError('Refusing to send Supabase credentials outside the project')
    return urllib.request.build_opener(_NoRedirect).open(req, timeout=timeout)
