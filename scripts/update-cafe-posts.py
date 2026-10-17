#!/usr/bin/env python3
"""Cache five public, unpinned posts from Beadyo's Naver Cafe menu 21.

The read-only API paths and parameters below were verified on 2026-10-17 in
the menu page's own public script (page-be0118ae6161e0e6.js, module 81821):
https://cafe.naver.com/f-e/cafes/31098081/menus/21?viewType=L
The page links to that script on https://ca-fe.pstatic.net/pc/_next/static/.
No login, cookies, article bodies, or member information are used or saved.
Run manually with: python3 scripts/update-cafe-posts.py
"""

import argparse
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.error
import urllib.request


CAFE_ID = "31098081"
MENU_ID = "21"
BOARD_TITLE = "슬요 똥글"
BOARD_URL = f"https://cafe.naver.com/f-e/cafes/{CAFE_ID}/menus/{MENU_ID}?viewType=L"
API_BASE = f"https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/{CAFE_ID}"
ARTICLES_URL = f"{API_BASE}/menus/{MENU_ID}/articles?page=1&perPage=15"
NOTICES_URL = f"{API_BASE}/notices/menus/{MENU_ID}"
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "data" / "cafe-posts.json"
KST = timezone(timedelta(hours=9))
UTC = timezone.utc
MAX_BYTES = 2_000_000
MAX_SAFE_INTEGER = 9_007_199_254_740_991


class CollectionError(ValueError):
    """The public source could not be safely confirmed."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise CollectionError("Unexpected redirect from the public Cafe source")


def fetch_public(url, content_type):
    # An isolated opener has no CookieProcessor, credentials, or proxy settings.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; BeadyoPublicBoard/1.0)",
        "Accept": content_type,
        "Referer": BOARD_URL,
    })
    with opener.open(request, timeout=15) as response:
        if response.status != 200 or response.headers.get_content_type() != content_type:
            raise CollectionError("Unexpected public Cafe response")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise CollectionError("Public Cafe response is too large")
    return body.decode("utf-8")


class BoardHeader(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.headings = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        classes = dict(attrs).get("class", "").split()
        in_header = "BoardHeaderTitle" in classes or any("BoardHeaderTitle" in item[1] for item in self.stack)
        if tag == "h3" and in_header:
            self.current = []
        if tag not in self.VOID_TAGS:
            self.stack.append((tag, classes))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "h3" and self.current is not None:
            self.headings.append("".join(self.current))
            self.current = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, text):
        if self.current is not None:
            self.current.append(text)


def validate_board(source):
    parser = BoardHeader()
    parser.feed(source)
    parser.close()
    headings = [" ".join(value.split()).strip("💩\ufe0f ") for value in parser.headings]
    if headings != [BOARD_TITLE]:
        raise CollectionError("The expected public Cafe board title was not found")


def positive_id(value):
    if type(value) is not int or not 0 < value <= MAX_SAFE_INTEGER:
        raise CollectionError("Invalid Cafe article identifier")
    return str(value)


def article_rows(payload):
    if not isinstance(payload, dict) or "error" in payload:
        raise CollectionError("Invalid public Cafe response envelope")
    result = payload.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("articleList"), list):
        raise CollectionError("Public Cafe article list is unavailable")
    if len(result["articleList"]) > 100:
        raise CollectionError("Unexpected public Cafe article list size")
    return result["articleList"]


def pinned_ids(payload):
    ids = set()
    for row in article_rows(payload):
        if not isinstance(row, dict) or not isinstance(row.get("item"), dict):
            raise CollectionError("Invalid Cafe notice item")
        item = row["item"]
        if positive_id(item.get("cafeId")) != CAFE_ID:
            raise CollectionError("Cafe notice belongs to a different Cafe")
        # Cafe-wide notices can belong to other menus (currently 32 and 41).
        positive_id(item.get("menuId"))
        ids.add(positive_id(item.get("articleId")))
    return ids


def plain_title(value):
    if not isinstance(value, str):
        raise CollectionError("Cafe article title is unavailable")
    value = " ".join(unescape(value).split())
    if re.search(r"[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]", value):
        raise CollectionError("Invalid control character in Cafe title")
    # Match JavaScript string.length and the reader's title policy. Joiners are
    # allowed in visible emoji, but cannot form an otherwise invisible title.
    utf16_units = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
    if not re.search(r"[^\s\u200c\u200d]", value) or utf16_units > 300:
        raise CollectionError("Invalid Cafe article title")
    # Plain text only: HTML-looking characters remain text for the UI to escape.
    return value


def public_posts(payload, notices, now):
    rows = article_rows(payload)
    excluded = pinned_ids(notices)
    posts = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("type"), str):
            raise CollectionError("Invalid Cafe article wrapper")
        if row["type"] != "ARTICLE":
            continue
        item = row.get("item")
        if not isinstance(item, dict):
            raise CollectionError("Invalid Cafe article item")
        if positive_id(item.get("cafeId")) != CAFE_ID or positive_id(item.get("menuId")) != MENU_ID:
            raise CollectionError("Cafe article belongs to a different board")
        article_id = positive_id(item.get("articleId"))
        for flag in ("openArticle", "blindArticle", "restrictMenu"):
            if type(item.get(flag)) is not bool:
                raise CollectionError("Cafe article visibility cannot be confirmed")
        if article_id in excluded or not item["openArticle"] or item["blindArticle"] or item["restrictMenu"]:
            continue
        stamp = item.get("writeDateTimestamp")
        if type(stamp) is not int or not 0 < stamp <= MAX_SAFE_INTEGER:
            raise CollectionError("Invalid Cafe article timestamp")
        try:
            published = datetime(1970, 1, 1, tzinfo=UTC) + timedelta(milliseconds=stamp)
        except (OverflowError, ValueError) as error:
            raise CollectionError("Invalid Cafe article date") from error
        if published.year < 2000 or published > now:
            raise CollectionError("Cafe article date is outside the confirmed range")
        post = {"id": article_id, "title": plain_title(item.get("subject")),
                "publishedAt": published.astimezone(KST).isoformat(timespec="milliseconds"),
                "href": f"https://cafe.naver.com/f-e/cafes/{CAFE_ID}/articles/{article_id}"}
        if article_id in posts and posts[article_id] != (stamp, post):
            raise CollectionError("Conflicting duplicate Cafe article")
        posts[article_id] = (stamp, post)
    if rows and not posts:
        raise CollectionError("No ordinary public Cafe articles could be confirmed")
    return [post for _, post in sorted(posts.values(), key=lambda entry: (entry[0], int(entry[1]["id"])), reverse=True)[:5]]


def atomic_write(output, payload):
    content = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent,
                                         prefix=".cafe-posts-", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def update_cache(output=DEFAULT_OUTPUT, fetch=fetch_public, now=None):
    validate_board(fetch(BOARD_URL, "text/html"))
    articles = json.loads(fetch(ARTICLES_URL, "application/json"))
    notices = json.loads(fetch(NOTICES_URL, "application/json"))
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise CollectionError("A timezone-aware collection time is required")
    payload = {"schemaVersion": 1, "cafeId": CAFE_ID, "menuId": MENU_ID,
               "boardTitle": BOARD_TITLE,
               "fetchedAt": now.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
               "posts": public_posts(articles, notices, now)}
    atomic_write(output, payload)
    return payload


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    try:
        payload = update_cache(args.output)
    except (CollectionError, urllib.error.URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"Cafe collection failed; existing cache was kept: {error}", file=sys.stderr)
        return 1
    print(f"Cached {len(payload['posts'])} public Cafe posts in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
