"""Run: python3 .github/scripts/test_runtime_fallbacks.py (no network or DB writes)."""
import ast
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parent

class RuntimeFallbackTests(unittest.TestCase):
    def run_live(self, payload, returncode=0):
        writes = []
        runtime = types.SimpleNamespace(upsert_runtime_cache=lambda *args: writes.append(args))
        response = types.SimpleNamespace(returncode=returncode, stdout=json.dumps(payload))
        source = (ROOT / 'check_live.py').read_text()
        with tempfile.TemporaryDirectory() as temp:
            original = Path.cwd()
            try:
                os.chdir(temp)
                Path('live.json').write_text('previous')
                with patch.dict(sys.modules, {'runtime_cache': runtime}), patch('subprocess.run', return_value=response), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    code = 0
                    try:
                        exec(compile(source, 'check_live.py', 'exec'), {})
                    except SystemExit as ex:
                        code = ex.code
                return code, Path('live.json').read_text(), writes
            finally:
                os.chdir(original)

    def test_live_invalid_or_http_failure_preserves_existing_file_and_db(self):
        for payload, code in [({}, 0), ({'error': 'temporary'}, 0), (None, 0), ({'station': None}, 0), ({'station': {'user_id':'beadyo97'}}, 0), ({}, 22)]:
            with self.subTest(payload=payload, returncode=code):
                status, content, writes = self.run_live(payload, code)
                self.assertEqual(status, 1)
                self.assertEqual(content, 'previous')
                self.assertEqual(writes, [])

    def test_live_normal_off_and_on(self):
        for broad in [None, {'broad_no': 123, 'broad_title':' LIVE '}]:
            with self.subTest(broad=broad):
                status, content, writes = self.run_live({'station':{'user_id':'beadyo97'}, 'broad':broad})
                self.assertEqual(status, 0)
                self.assertEqual(json.loads(content)['live'], broad is not None)
                self.assertEqual(len(writes), 1)

    def fetch_replies(self, pages):
        source = ast.parse((ROOT / 'check_up.py').read_text())
        function = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'fetch_replies')
        iterator = iter(pages)
        requests = types.SimpleNamespace(get=lambda *a, **k: next(iterator))
        with patch.dict(sys.modules, {'curl_cffi':types.SimpleNamespace(requests=requests)}), contextlib.redirect_stdout(io.StringIO()):
            scope = {}
            exec(compile(ast.Module(body=[function], type_ignores=[]), 'check_up.py', 'exec'), scope)
            return scope['fetch_replies']('test', '1')

    def page(self, rows, last_page=1):
        return types.SimpleNamespace(status_code=200, json=lambda:{'data':rows, 'meta':{'lastPage':last_page}})

    def test_up_mid_page_failure_never_returns_partial_rows(self):
        result = self.fetch_replies([self.page([{'pCommentNo':1,'userId':'one'}], 2), types.SimpleNamespace(status_code=503)])
        self.assertIsNone(result)

    def test_up_malformed_pagination_never_returns_partial_rows(self):
        for response in [types.SimpleNamespace(status_code=200,json=lambda:{'data':[]}), self.page([],2)]:
            self.assertIsNone(self.fetch_replies([response]))

    def test_up_valid_empty_is_distinct_from_failure(self):
        self.assertEqual(self.fetch_replies([self.page([],0)]), [])
        self.assertEqual(self.fetch_replies([self.page([],1)]), [])

    def test_up_complete_pagination(self):
        result = self.fetch_replies([self.page([{'pCommentNo':1,'userId':'one'}],2), self.page([{'pCommentNo':2,'userId':'two'}],2)])
        self.assertEqual([x['bj_id'] for x in result], ['one','two'])

    def test_up_job_keeps_previous_ranking_and_timestamp_on_failure(self):
        previous = {'updated':'2026-01-01T00:00:00Z','events':[{'id':1,'ranking':[{'bj_id':'previous','up_count':99}]}]}
        row = {'id':1,'tab_name':'Test','title':'Test','soop_url':'https://www.sooplive.co.kr/test/post/1'}
        class Query:
            def table(self, *a): return self
            def select(self, *a): return self
            def eq(self, *a): return self
            def order(self, *a): return self
            def execute(self): return types.SimpleNamespace(data=[row])
        writes = []
        modules = {'runtime_cache':types.SimpleNamespace(upsert_runtime_cache=lambda *args:writes.append(args)),
                   'supabase':types.SimpleNamespace(create_client=lambda *a:Query()),
                   'curl_cffi':types.SimpleNamespace(requests=types.SimpleNamespace(get=lambda *a,**k:types.SimpleNamespace(status_code=503)))}
        source = (ROOT / 'check_up.py').read_text()
        with tempfile.TemporaryDirectory() as temp:
            original = Path.cwd()
            try:
                os.chdir(temp)
                Path('up.json').write_text(json.dumps(previous))
                with patch.dict(sys.modules, modules), contextlib.redirect_stdout(io.StringIO()):
                    exec(compile(source, 'check_up.py','exec'),{})
                result=json.loads(Path('up.json').read_text())['events'][0]
                self.assertEqual(result['ranking'], previous['events'][0]['ranking'])
                self.assertEqual(result['live_updated_at'], previous['updated'])
            finally:
                os.chdir(original)

if __name__ == '__main__':
    unittest.main()
