"""Run: python3 .github/scripts/test_up_event_source.py (mocked DB and network)."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
import urllib.request
from unittest.mock import patch

SOURCE = (Path(__file__).parent / 'check_up.py').read_text()
PREVIOUS = {
    'updated': '2026-01-01T00:00:00Z',
    'events': [{'id': 900000001, 'ranking': [{'bj_id': 'isolated_previous', 'up_count': 99}]}],
}
EVENT = {
    'id': 900000001, 'tab_name': 'ISOLATED TEST', 'title': 'ISOLATED TEST',
    'soop_url': 'https://www.sooplive.co.kr/isolated/post/1',
}


class UpEventSourceTests(unittest.TestCase):
    def run_job(self, sdk_payload=None, urllib_payload=None, sdk_failure=False, urllib_failure=False):
        writes, fallbacks = [], []

        class Query:
            def table(self, *args): return self
            def select(self, *args): return self
            def eq(self, *args): return self
            def order(self, *args): return self
            def execute(self):
                if sdk_failure:
                    raise RuntimeError('ISOLATED event lookup failure')
                return types.SimpleNamespace(data=sdk_payload)

        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(urllib_payload).encode()

        def fallback(*args, **kwargs):
            fallbacks.append(True)
            if urllib_failure:
                raise RuntimeError('ISOLATED fallback failure')
            return Response()

        modules = {
            'runtime_cache': types.SimpleNamespace(upsert_runtime_cache=lambda *args: writes.append(args)),
            'supabase': types.SimpleNamespace(create_client=lambda *args: Query()),
            'curl_cffi': types.SimpleNamespace(requests=types.SimpleNamespace(get=lambda *args, **kwargs:
                types.SimpleNamespace(status_code=200, json=lambda: {'data': [], 'meta': {'lastPage': 0}}))),
        }
        with tempfile.TemporaryDirectory(prefix='isolated-up-event-source-') as temp:
            original_cwd = Path.cwd()
            try:
                os.chdir(temp)
                before = json.dumps(PREVIOUS)
                Path('up.json').write_text(before)
                status = 0
                with patch.dict(sys.modules, modules), patch('urllib.request.urlopen', side_effect=fallback), patch('socket.socket', side_effect=AssertionError('Network forbidden')), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    try:
                        exec(compile(SOURCE, 'check_up.py', 'exec'), {})
                    except SystemExit as error:
                        status = error.code
                after = Path('up.json').read_text()
                return status, before == after, json.loads(after), writes, len(fallbacks)
            finally:
                os.chdir(original_cwd)

    def assert_preserved_failure(self, result):
        status, unchanged, output, writes, fallback_count = result
        self.assertEqual(status, 1)
        self.assertTrue(unchanged)
        self.assertEqual(output, PREVIOUS)
        self.assertEqual(writes, [])
        self.assertEqual(fallback_count, 1)

    def test_both_event_lookups_fail_preserves_previous_file_and_cache(self):
        self.assert_preserved_failure(self.run_job(sdk_failure=True, urllib_failure=True))

    def test_urllib_fallback_success_still_refreshes_event_data(self):
        status, unchanged, output, writes, fallback_count = self.run_job(sdk_failure=True, urllib_payload=[EVENT])
        self.assertEqual(status, 0)
        self.assertFalse(unchanged)
        self.assertEqual(fallback_count, 1)
        self.assertEqual(output['events'][0]['id'], EVENT['id'])
        self.assertEqual(output['events'][0]['ranking'], [])
        self.assertNotEqual(output['events'][0]['live_updated_at'], PREVIOUS['updated'])
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0][0], 'up_ranking')
        self.assertEqual(writes[0][1], output)

    def test_valid_sdk_empty_list_replaces_previous_events(self):
        status, unchanged, output, writes, fallback_count = self.run_job(sdk_payload=[])
        self.assertEqual(status, 0)
        self.assertFalse(unchanged)
        self.assertEqual(fallback_count, 0)
        self.assertEqual(output['events'], [])
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0][1], output)

    def test_valid_urllib_empty_list_replaces_previous_events(self):
        status, unchanged, output, writes, fallback_count = self.run_job(sdk_failure=True, urllib_payload=[])
        self.assertEqual(status, 0)
        self.assertFalse(unchanged)
        self.assertEqual(fallback_count, 1)
        self.assertEqual(output['events'], [])
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0][1], output)

    def test_invalid_event_payloads_never_clear_existing_data(self):
        invalid = [None, False, 0, '', {}, {'message': 'temporary error'}, [None], [{}],
                   [{**EVENT, 'id': None}], [{**EVENT, 'id': True}],
                   [{**EVENT, 'soop_url': None}], [{**EVENT, 'title': []}], [EVENT, {}]]
        for payload in invalid:
            with self.subTest(payload=payload, route='sdk-invalid-fallback-fails'):
                self.assert_preserved_failure(self.run_job(sdk_payload=payload, urllib_failure=True))
            with self.subTest(payload=payload, route='sdk-fails-fallback-invalid'):
                self.assert_preserved_failure(self.run_job(sdk_failure=True, urllib_payload=payload))

    def test_invalid_sdk_payload_including_none_can_use_valid_urllib_fallback(self):
        for payload in [None, False, 0, '', {}, [{}]]:
            with self.subTest(payload=payload):
                status, _, output, writes, fallback_count = self.run_job(sdk_payload=payload, urllib_payload=[EVENT])
                self.assertEqual(status, 0)
                self.assertEqual(fallback_count, 1)
                self.assertEqual(output['events'][0]['id'], EVENT['id'])
                self.assertEqual(len(writes), 1)


if __name__ == '__main__':
    unittest.main()
