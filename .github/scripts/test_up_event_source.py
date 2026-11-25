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


CACHED = {
    'updated': '2026-02-02T00:00:00Z',
    'events': [{
        'id': 900000001, 'tab': 'OLD TAB', 'title': 'OLD TITLE',
        'soop_url': 'https://www.sooplive.co.kr/isolated/post/1',
        'ranking': [{'bj_id': 'isolated_cached', 'up_count': 42, 'rank': 1}],
        'live_updated_at': '2026-02-02T00:00:00Z',
    }],
}
COMMENT = {'pCommentNo': 7, 'userId': 'isolated_fan', 'userNick': '[테스트용]',
           'profileImage': '', 'regDate': '2026-02-03', 'likeCnt': 5}


class UpCollectionFailureTests(unittest.TestCase):
    """GitHub Actions에는 up.json이 없으므로 기존 값은 공개 런타임 캐시에서 읽는다.
    네트워크·DB는 모두 mock이며 실제 SOOP/Supabase에는 요청하지 않는다."""

    def run_job(self, collector='ok', cache='ok', local_previous=None):
        writes, urls = [], []

        class Response:
            def __init__(self, payload): self.payload = payload
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(self.payload).encode()

        def urlopen(req, *args, **kwargs):
            url = getattr(req, 'full_url', req)
            urls.append(url)
            if '/up_events' in url:
                return Response([EVENT])
            if '/site_runtime_cache' in url:
                if cache == 'error':
                    raise RuntimeError('ISOLATED cache lookup failure')
                if cache == 'empty':
                    return Response([])
                return Response([{'payload': CACHED}])
            raise AssertionError(f'unexpected request {url}')

        def soop_get(*args, **kwargs):
            if collector == 'http-error':
                return types.SimpleNamespace(status_code=503, json=lambda: {})
            return types.SimpleNamespace(status_code=200, json=lambda: {
                'data': [COMMENT], 'meta': {'lastPage': 1}})

        modules = {
            'runtime_cache': types.SimpleNamespace(upsert_runtime_cache=lambda *args: writes.append(args)),
            # supabase-py가 없는 Actions 환경처럼 urllib 경로를 탄다.
            'supabase': None,
            'curl_cffi': None if collector == 'missing' else
                types.SimpleNamespace(requests=types.SimpleNamespace(get=soop_get)),
        }
        with tempfile.TemporaryDirectory(prefix='isolated-up-collection-') as temp:
            original_cwd = Path.cwd()
            try:
                os.chdir(temp)
                if local_previous is not None:
                    Path('up.json').write_text(json.dumps(local_previous))
                status = 0
                with patch.dict(sys.modules, modules), patch('urllib.request.urlopen', side_effect=urlopen), patch('socket.socket', side_effect=AssertionError('Network forbidden')), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    try:
                        exec(compile(SOURCE, 'check_up.py', 'exec'), {})
                    except SystemExit as error:
                        status = error.code
                output = json.loads(Path('up.json').read_text()) if Path('up.json').exists() else None
                return status, output, writes, urls
            finally:
                os.chdir(original_cwd)

    def test_missing_curl_cffi_keeps_cached_ranking_instead_of_empty(self):
        status, output, writes, _ = self.run_job(collector='missing')
        self.assertEqual(status, 0)
        self.assertEqual(len(writes), 1)
        saved = writes[0][1]['events'][0]
        self.assertEqual(saved['ranking'], CACHED['events'][0]['ranking'])
        self.assertEqual(saved['live_updated_at'], CACHED['events'][0]['live_updated_at'])
        self.assertEqual(saved['tab'], EVENT['tab_name'])
        self.assertEqual(output, writes[0][1])

    def test_soop_http_error_keeps_cached_ranking(self):
        status, _, writes, _ = self.run_job(collector='http-error')
        self.assertEqual(status, 0)
        self.assertEqual(writes[0][1]['events'][0]['ranking'], CACHED['events'][0]['ranking'])

    def test_failure_without_readable_previous_never_writes_empty_ranking(self):
        status, output, writes, _ = self.run_job(collector='missing', cache='error')
        self.assertEqual(status, 1)
        self.assertEqual(writes, [])
        self.assertIsNone(output)

    def test_local_up_json_is_used_before_cache(self):
        status, _, writes, urls = self.run_job(collector='missing', local_previous=PREVIOUS)
        self.assertEqual(status, 0)
        self.assertEqual(writes[0][1]['events'][0]['ranking'], PREVIOUS['events'][0]['ranking'])
        self.assertFalse(any('/site_runtime_cache' in url for url in urls))

    def test_new_event_without_previous_value_starts_empty(self):
        status, _, writes, _ = self.run_job(collector='missing', cache='empty')
        self.assertEqual(status, 0)
        self.assertEqual(writes[0][1]['events'][0]['ranking'], [])

    def test_successful_collection_replaces_cached_ranking(self):
        status, _, writes, _ = self.run_job(collector='ok')
        self.assertEqual(status, 0)
        ranking = writes[0][1]['events'][0]['ranking']
        self.assertEqual([r['bj_id'] for r in ranking], ['isolated_fan'])
        self.assertEqual(ranking[0]['rank'], 1)


class UpWorkflowPinTests(unittest.TestCase):
    def test_workflow_installs_hash_pinned_collector(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / '.github/workflows/up-ranking.yml').read_text()
        requirements = (root / '.github/scripts/requirements-up.txt').read_text()
        self.assertIn('--require-hashes', workflow)
        self.assertIn('-r .github/scripts/requirements-up.txt', workflow)
        self.assertRegex(workflow, r'actions/setup-python@[0-9a-f]{40}')
        packages = [line.split()[0] for line in requirements.splitlines()
                    if line and not line.startswith((' ', '#'))]
        self.assertIn('curl_cffi==0.17.0', packages)
        for package in packages:
            self.assertRegex(package, r'^[\w.-]+==[\w.]+$')


if __name__ == '__main__':
    unittest.main()
