"""Offline regression checks; the fixture contains only needed public fields."""

import copy
from contextlib import redirect_stderr
from datetime import datetime, timezone
from email.message import Message
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error


SCRIPT = Path(__file__).with_name("update-cafe-posts.py")
SPEC = importlib.util.spec_from_file_location("cafe_posts", SCRIPT)
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)
FIXTURE = json.loads(Path(__file__).with_name("fixtures").joinpath("cafe-posts-public.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 10, 17, 14, tzinfo=timezone.utc)


class CafePostsTests(unittest.TestCase):
    def setUp(self):
        self.articles = copy.deepcopy(FIXTURE["articles"])
        self.notices = copy.deepcopy(FIXTURE["notices"])

    def rows(self):
        return self.articles["result"]["articleList"]

    def collect(self):
        return C.public_posts(self.articles, self.notices, NOW)

    def fetcher(self, articles=None, notices=None, html=None):
        sources = {C.BOARD_URL: html if html is not None else FIXTURE["boardHtml"],
                   C.ARTICLES_URL: json.dumps(articles if articles is not None else self.articles),
                   C.NOTICES_URL: json.dumps(notices if notices is not None else self.notices)}
        return lambda url, _: sources[url]

    def test_real_public_fixture_normalizes_five_posts_and_korean_dates(self):
        result = self.collect()
        self.assertEqual([post["id"] for post in result], ["40216", "40213", "40207", "40203", "40195"])
        self.assertEqual(result[0]["title"], "일어나써")
        self.assertEqual(result[0]["publishedAt"], "2026-10-17T13:30:34.443+09:00")
        self.assertEqual(result[1]["publishedAt"], "2026-10-17T05:43:29.410+09:00")
        self.assertEqual(result[0]["href"], "https://cafe.naver.com/f-e/cafes/31098081/articles/40216")
        self.assertEqual(set(result[0]), {"id", "title", "publishedAt", "href"})

    def test_actual_dates_sort_shuffled_rows_and_exact_duplicates_are_deduplicated(self):
        self.rows().reverse()
        self.rows().append(copy.deepcopy(self.rows()[-1]))
        self.assertEqual([post["id"] for post in self.collect()], ["40216", "40213", "40207", "40203", "40195"])

    def test_notices_and_non_article_rows_cannot_fill_the_five_posts(self):
        self.notices["result"]["articleList"].append(copy.deepcopy(self.rows()[0]))
        self.rows().insert(0, {"type": "NOTICE", "item": {"subject": "not a general article"}})
        self.assertEqual([post["id"] for post in self.collect()], ["40213", "40207", "40203", "40195", "40192"])

    def test_nonpublic_blind_and_restricted_posts_are_excluded(self):
        for field, value in (("openArticle", False), ("blindArticle", True), ("restrictMenu", True)):
            with self.subTest(field=field):
                original = self.rows()[0]["item"][field]
                self.rows()[0]["item"][field] = value
                self.assertNotIn("40216", [post["id"] for post in self.collect()])
                self.rows()[0]["item"][field] = original

    def test_unknown_visibility_wrong_board_and_malformed_fields_fail_closed(self):
        for field, value in (("menuId", 32), ("cafeId", 1), ("openArticle", None), ("restrictMenu", "false"),
                             ("articleId", True), ("articleId", "40216"), ("subject", "  "),
                             ("writeDateTimestamp", True), ("writeDateTimestamp", 1792211434),
                             ("writeDateTimestamp", 9999999999999999)):
            with self.subTest(field=field, value=value):
                original = self.rows()[0]["item"][field]
                self.rows()[0]["item"][field] = value
                with self.assertRaises(C.CollectionError):
                    self.collect()
                self.rows()[0]["item"][field] = original
        del self.rows()[0]["item"]["blindArticle"]
        with self.assertRaises(C.CollectionError):
            self.collect()

    def test_conflicting_duplicate_and_future_date_are_rejected(self):
        duplicate = copy.deepcopy(self.rows()[0])
        duplicate["item"]["subject"] = "inconsistent response"
        self.rows().append(duplicate)
        with self.assertRaises(C.CollectionError):
            self.collect()
        self.rows().pop()
        self.rows()[0]["item"]["writeDateTimestamp"] = int(NOW.timestamp() * 1000) + 1
        with self.assertRaises(C.CollectionError):
            self.collect()

    def test_titles_are_plain_text_with_decoded_entities_and_normalized_spaces(self):
        self.rows()[0]["item"]["subject"] = " \n &lt;img src=x onerror=alert(1)&gt; &amp; 부기\t "
        self.assertEqual(self.collect()[0]["title"], "<img src=x onerror=alert(1)> & 부기")
        self.rows()[0]["item"]["subject"] = "invalid\x00title"
        with self.assertRaises(C.CollectionError):
            self.collect()

    def test_title_limit_matches_javascript_utf16_units_after_space_normalization(self):
        for title in ("가" * 300, "😀" * 150, "가" * 298 + "😀", "  " + "가" * 300 + " \n"):
            with self.subTest(accepted=title[:10]):
                self.assertEqual(C.plain_title(title), title.strip())
        for title in ("가" * 301, "😀" * 150 + "가", "가" * 299 + "😀"):
            with self.subTest(rejected=title[:10]):
                with self.assertRaises(C.CollectionError):
                    C.plain_title(title)

    def test_invisible_format_characters_and_joiner_only_titles_are_not_publishable(self):
        prohibited = ("\x00", "\x01", "\x7f", "\x80", "\x9f", "\u200b", "\u200e", "\u200f",
                      "\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2060", "\u206f", "\ufeff")
        for character in prohibited:
            with self.subTest(codepoint=hex(ord(character))):
                with self.assertRaises(C.CollectionError):
                    C.plain_title("일정" + character + "제목")
        for title in ("\u200c", "\u200d", " \u200c\u200d \u200c "):
            with self.subTest(invisible=repr(title)):
                with self.assertRaises(C.CollectionError):
                    C.plain_title(title)
        self.assertEqual(C.plain_title("가족 👨‍👩‍👧‍👦"), "가족 👨‍👩‍👧‍👦")

    def test_board_header_must_match_and_login_or_other_board_is_not_an_empty_success(self):
        C.validate_board(FIXTURE["boardHtml"])
        for html in ("<title>슬요 똥글</title><p>로그인해 주세요</p>",
                     FIXTURE["boardHtml"].replace("💩슬요 똥글💩", "다른 게시판"), ""):
            with self.subTest(html=html):
                with self.assertRaises(C.CollectionError):
                    C.validate_board(html)
        self.articles = {"result": {"articleList": []}}
        self.assertEqual(self.collect(), [])
        for invalid in ({"error": "login required"}, {"result": {}}, {"result": {"articleList": None}}):
            with self.assertRaises(C.CollectionError):
                C.public_posts(invalid, self.notices, NOW)

    def test_cache_schema_and_failed_collection_keep_previous_bytes_and_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "cafe-posts.json"
            payload = C.update_cache(output, self.fetcher(), NOW)
            original = output.read_bytes()
            self.assertEqual(set(payload), {"schemaVersion", "cafeId", "menuId", "boardTitle", "fetchedAt", "posts"})
            self.assertEqual(payload["fetchedAt"], "2026-10-17T14:00:00.000Z")
            for fetch in (self.fetcher(html="<p>로그인</p>"), self.fetcher(articles={"result": {}}),
                          self.fetcher(notices={"result": {}})):
                with self.assertRaises(C.CollectionError):
                    C.update_cache(output, fetch, NOW)
                self.assertEqual(output.read_bytes(), original)
            for title in ("가" * 301, "일정\u200b제목", "\u200c\u200d"):
                self.rows()[0]["item"]["subject"] = title
                with self.assertRaises(C.CollectionError):
                    C.update_cache(output, self.fetcher(), NOW)
                self.assertEqual(output.read_bytes(), original)
            def unavailable(*_):
                raise urllib.error.URLError("offline")
            with self.assertRaises(urllib.error.URLError):
                C.update_cache(output, unavailable, NOW)
            self.assertEqual(output.read_bytes(), original)

    def test_atomic_replace_failure_preserves_old_file_and_cleans_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "cafe-posts.json"
            output.write_text("previous cache\n", encoding="utf-8")
            with patch.object(C.os, "replace", side_effect=OSError("read only")):
                with self.assertRaises(OSError):
                    C.update_cache(output, self.fetcher(), NOW)
            self.assertEqual(output.read_text(encoding="utf-8"), "previous cache\n")
            self.assertEqual(sorted(path.name for path in Path(directory).iterdir()), ["cafe-posts.json"])

    def test_cli_failure_exits_nonzero_without_changing_the_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "cafe-posts.json"
            output.write_text("previous cache\n", encoding="utf-8")
            errors = io.StringIO()
            with patch.object(C, "update_cache", side_effect=urllib.error.URLError("offline")):
                with redirect_stderr(errors):
                    self.assertEqual(C.main(["--output", str(output)]), 1)
            self.assertIn("existing cache was kept", errors.getvalue())
            self.assertEqual(output.read_text(encoding="utf-8"), "previous cache\n")

    def test_network_reader_omits_credentials_rejects_redirects_and_limits_content(self):
        class Response:
            status = 200
            def __init__(self, body=b"{}", content_type="application/json"):
                self.body = body
                self.headers = Message()
                self.headers["Content-Type"] = content_type
            def read(self, size):
                return self.body[:size]
            def __enter__(self):
                return self
            def __exit__(self, *_):
                pass
        with patch.object(C.urllib.request, "build_opener") as build:
            build.return_value.open.return_value = Response()
            self.assertEqual(C.fetch_public(C.ARTICLES_URL, "application/json"), "{}")
            request = build.return_value.open.call_args.args[0]
            self.assertNotIn("cookie", {name.lower() for name in request.headers})
            self.assertNotIn("authorization", {name.lower() for name in request.headers})
            self.assertEqual(build.call_args.args[0].proxies, {})
            self.assertEqual(build.return_value.open.call_args.kwargs["timeout"], 15)
            for response in (Response(content_type="text/html"), Response(body=b"x" * (C.MAX_BYTES + 1))):
                build.return_value.open.return_value = response
                with self.assertRaises(C.CollectionError):
                    C.fetch_public(C.ARTICLES_URL, "application/json")
        with self.assertRaises(C.CollectionError):
            C.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://nid.naver.com/")


if __name__ == "__main__":
    unittest.main()
