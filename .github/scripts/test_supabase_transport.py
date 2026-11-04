"""Exercise all privileged HTTP callers using synthetic responses and no sockets."""
import contextlib
from email.message import Message
import io
import os
import socket
import unittest
import urllib.error
import urllib.request
import urllib.response
from unittest.mock import patch

import runtime_cache
import backfill_songbook_covers_itunes as covers
import import_songs
from tools.supabase_http import SUPABASE_URL, open_supabase


class SupabaseTransportTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.redirect = None
        self.key = 'isolated-test-key'
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.dict(os.environ, {'SUPABASE_SERVICE_ROLE_KEY': self.key}))
        self.stack.enter_context(patch.object(socket, 'socket', side_effect=AssertionError('Unexpected network')))
        self.stack.enter_context(patch.object(urllib.request, 'getproxies', return_value={}))
        self.stack.enter_context(patch.object(urllib.request.HTTPSHandler, 'https_open',
                                              autospec=True, side_effect=self.respond))

    def respond(self, handler, req):
        self.requests.append(req)
        headers = Message()
        code = 200
        if self.redirect and len(self.requests) == 1:
            headers['Location'] = self.redirect
            code = 302
        resp = urllib.response.addinfourl(io.BytesIO(b'[]'), headers, req.full_url, code)
        resp.msg = 'Mock response'
        return resp

    def operations(self):
        return (
            lambda: import_songs.req('POST', '/rest/v1/songbook', self.key, [{}])[0],
            lambda: covers.http_json('GET', SUPABASE_URL + '/rest/v1/songbook',
                                     headers=covers.supabase_headers(self.key))[0],
            lambda: runtime_cache.upsert_runtime_cache('test', {}),
        )

    def test_approved_origin_receives_credentials(self):
        for operation, expected in zip(self.operations(), (200, 200, True)):
            with self.subTest(operation=operation):
                self.requests.clear()
                self.assertEqual(operation(), expected)
                self.assertEqual(len(self.requests), 1)
                self.assertTrue(self.requests[0].full_url.startswith(SUPABASE_URL + '/'))
                self.assertEqual(self.requests[0].get_header('Apikey'), self.key)
                self.assertEqual(self.requests[0].get_header('Authorization'), 'Bearer ' + self.key)

    def test_redirects_never_issue_a_second_request(self):
        for self.redirect in ('https://other.invalid/collect', SUPABASE_URL + '/elsewhere'):
            for index, operation in enumerate(self.operations()):
                with self.subTest(redirect=self.redirect, caller=index):
                    self.requests.clear()
                    if index == 2:
                        with self.assertRaisesRegex(RuntimeError, 'HTTP 302'):
                            operation()
                    else:
                        self.assertEqual(operation(), 302)
                    self.assertEqual(len(self.requests), 1)

    def test_initial_http_or_other_origin_is_refused(self):
        for url in (SUPABASE_URL.replace('https:', 'http:') + '/data',
                    SUPABASE_URL + '.other.invalid/data', SUPABASE_URL + '@other.invalid/data'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                open_supabase(urllib.request.Request(url))
        self.assertEqual(self.requests, [])


if __name__ == '__main__':
    unittest.main()
