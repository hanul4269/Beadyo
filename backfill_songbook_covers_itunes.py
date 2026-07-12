#!/usr/bin/env python3
"""
iTunes Search API로 songbook.cover_url을 채우는 로컬 백필 스크립트.

필수 환경변수:
  SUPABASE_SERVICE_KEY

기본은 dry-run입니다. 실제 저장은 --apply를 붙여 실행하세요.
"""
import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher


SUPABASE_URL = "https://qlmcwobfldgmhwhptkfz.supabase.co"
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
PAGE_SIZE = 500
DEFAULT_COUNTRIES = ("KR", "JP", "US")
DEFAULT_MIN_SCORE = 0.88
DEFAULT_MIN_TITLE_SCORE = 0.88
DEFAULT_MIN_ARTIST_SCORE = 0.62
JPOP_SEARCH_TITLE_SCORE = 0.9
JPOP_SEARCH_TITLE_MAX_RANK = 4
MAX_QUERIES_PER_SONG = 14

ctx = ssl._create_unverified_context()


def env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"[필수] {name} 환경변수가 없습니다.", file=sys.stderr)
        sys.exit(1)
    return value


def http_json(method, url, headers=None, body=None, retries=2):
    data = None
    if body is not None:
        if isinstance(body, bytes):
            data = body
        else:
            data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                raw = resp.read()
                if not raw:
                    return resp.status, None
                return resp.status, json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as e:
            raw = e.read()
            msg = raw.decode("utf-8", "replace") if raw else ""
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(1 + attempt)
                continue
            return e.code, {"error": msg}
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(1 + attempt)
                continue
            return 0, {"error": str(e)}


def supabase_headers(service_key):
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def fetch_songbook_rows(service_key, force=False, limit=None):
    rows = []
    start = 0
    headers = supabase_headers(service_key)
    while True:
        params = {
            "select": "id,title,artist,category,cover_url",
            "order": "id.asc",
        }
        if not force:
            params["or"] = "(cover_url.is.null,cover_url.eq.)"
        url = f"{SUPABASE_URL}/rest/v1/songbook?{urllib.parse.urlencode(params)}"
        req_headers = dict(headers)
        req_headers["Range"] = f"{start}-{start + PAGE_SIZE - 1}"
        status, data = http_json("GET", url, headers=req_headers)
        if status not in (200, 206):
            print(f"[오류] songbook 조회 실패: {status} {data}", file=sys.stderr)
            sys.exit(1)
        batch = data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        start += PAGE_SIZE
        if limit and len(rows) >= limit:
            break
    return rows[:limit] if limit else rows


def update_cover(service_key, song_id, cover_url):
    url = f"{SUPABASE_URL}/rest/v1/songbook?id=eq.{int(song_id)}"
    status, data = http_json(
        "PATCH",
        url,
        headers=supabase_headers(service_key),
        body={"cover_url": cover_url},
    )
    return status in (200, 204), status, data


def normalize(value):
    s = str(value or "").lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"（[^）]*）", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"\bfeat\.?\b|\bft\.?\b|\bwith\b", " ", s)
    s = re.sub(r"[\{\}'\"`~!@#$%^&*_+=|\\:;,.?/<>-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def similarity(a, b):
    a = normalize(a)
    b = normalize(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.86
    return SequenceMatcher(None, a, b).ratio()


def artist_aliases(artist):
    text = clean_query_part(artist)
    aliases = {
        "priz v": ["Priz", "Priz-V", "프리즈브이"],
        "priz": ["Priz-V", "프리즈브이"],
        "프리즈브이": ["Priz-V", "Priz"],
        "아이유": ["IU"],
        "iu": ["아이유"],
        "리사": ["LiSA"],
        "lisa": ["리사"],
        "오오츠카 아이": ["大塚 愛", "Ai Otsuka", "Otsuka Ai"],
        "大塚 愛": ["오오츠카 아이", "Ai Otsuka", "Otsuka Ai"],
        "ai otsuka": ["오오츠카 아이", "大塚 愛", "Otsuka Ai"],
        "otsuka ai": ["오오츠카 아이", "大塚 愛", "Ai Otsuka"],
        "유우리": ["Yuuri", "優里"],
        "yuuri": ["유우리", "優里"],
        "優里": ["유우리", "Yuuri"],
        "녹황색사회": ["Ryokuoushoku Shakai", "緑黄色社会"],
        "료쿠오우쇼쿠 샤카이": ["Ryokuoushoku Shakai", "緑黄色社会"],
        "ryokuoushoku shakai": ["녹황색사회", "료쿠오우쇼쿠 샤카이", "緑黄色社会"],
        "緑黄色社会": ["녹황색사회", "료쿠오우쇼쿠 샤카이", "Ryokuoushoku Shakai"],
        "츠키": ["tuki", "tuki."],
        "tuki": ["츠키", "tuki."],
        "gumi": ["Megpoid", "TOKOTOKO", "西沢さんP", "NishizawasanP", "Nishizawa-sanP"],
        "radwimps": ["래드윔프스"],
        "래드윔프스": ["RADWIMPS"],
        "귀멸의 칼날 ost": ["Go Shiina", "椎名豪", "Nami Nakagawa", "中川奈美", "Demon Slayer", "鬼滅の刃"],
        "너의 이름은 ost": ["RADWIMPS", "Your Name", "君の名は"],
        "나카시마 미카": ["Mika Nakashima", "中島美嘉"],
        "mika nakashima": ["나카시마 미카", "中島美嘉"],
        "中島美嘉": ["나카시마 미카", "Mika Nakashima"],
        "로쿠데나시": ["Rokudenashi", "ロクデナシ"],
        "rokudenashi": ["로쿠데나시", "ロクデナシ"],
        "ロクデナシ": ["로쿠데나시", "Rokudenashi"],
        "마츠다 세이코": ["Seiko Matsuda", "松田聖子"],
        "seiko matsuda": ["마츠다 세이코", "松田聖子"],
        "松田聖子": ["마츠다 세이코", "Seiko Matsuda"],
        "아이묭": ["Aimyon", "あいみょん"],
        "aimyon": ["아이묭", "あいみょん"],
        "あいみょん": ["아이묭", "Aimyon"],
        "용과같이7 ost": ["SEGA", "Kazuma Kiryu", "Takaya Kuroda", "Hidenori Shoji", "龍が如く", "Yakuza"],
        "우타다 히카루": ["Hikaru Utada", "宇多田ヒカル"],
        "hikaru utada": ["우타다 히카루", "宇多田ヒカル"],
        "宇多田ヒカル": ["우타다 히카루", "Hikaru Utada"],
        "요네즈 켄시": ["Kenshi Yonezu", "米津玄師"],
        "kenshi yonezu": ["요네즈 켄시", "米津玄師"],
        "米津玄師": ["요네즈 켄시", "Kenshi Yonezu"],
        "우타다 히카루 요네즈 켄시": ["Hikaru Utada", "宇多田ヒカル", "Kenshi Yonezu", "米津玄師"],
    }
    key = normalize(text)
    values = [text, *aliases.get(key, [])]
    deduped = []
    for value in values:
        if value and value not in deduped:
            deduped.append(value)
    return deduped


def best_artist_similarity(artist, *targets):
    return max(
        [0.0]
        + [
            similarity(alias, target)
            for alias in artist_aliases(artist)
            for target in targets
            if target
        ]
    )


def artist_exact_or_in_collection(artist, artist_name, collection_name):
    collection = normalize(collection_name)
    for alias in artist_aliases(artist):
        normalized = normalize(alias)
        if normalized and normalized == normalize(artist_name):
            return True
        if normalized and normalized in collection:
            return True
    return False


def is_jpop(row, country=""):
    category = normalize(row.get("category", "")).upper()
    country = str(country or "").upper()
    return "JPOP" in category or "J POP" in category or country in ("JP", "JPN")


def is_source_artist_label(artist):
    return bool(re.search(r"\bost\b|soundtrack|오리지널|사운드트랙", str(artist or ""), re.I))


def bracket_parts(value):
    text = str(value or "")
    parts = []
    for pattern in (r"\(([^)]*)\)", r"（([^）]*)）", r"\[([^\]]*)\]"):
        for part in (part.strip() for part in re.findall(pattern, text) if part.strip()):
            parts.append(part)
            if re.search(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]", part):
                parts.extend(token for token in re.split(r"\s+", part) if token)
    return parts


def title_aliases(title):
    text = clean_query_part(title)
    without_brackets = clean_query_part(
        re.sub(r"\([^)]*\)|（[^）]*）|\[[^\]]*\]", " ", text)
    )
    values = [
        text,
        without_brackets,
        without_brackets.replace(" ", ""),
        *bracket_parts(text),
        *known_title_aliases(text),
    ]
    deduped = []
    for value in values:
        if value and value not in deduped:
            deduped.append(value)
    return deduped


def known_title_aliases(title):
    text = clean_query_part(title)
    without_brackets = clean_query_part(
        re.sub(r"\([^)]*\)|（[^）]*）|\[[^\]]*\]", " ", text)
    )
    keys = [
        normalize(text),
        normalize(without_brackets),
        *(normalize(part) for part in bracket_parts(text)),
    ]
    aliases = {
        "밤새도록 널 생각해": ["夜もすがら君想ふ", "Yoru mo Sugara Kimi Omou", "Yomosugara Kimi Omou"],
        "참새": ["すずめ", "Suzume"],
        "탄지로의 노래": ["竈門炭治郎のうた", "Kamado Tanjiro no Uta", "Tanjiro no Uta"],
        "내가 죽으려고 생각한 것은": ["僕が死のうと思ったのは", "Boku ga Shinou to Omotta no wa"],
        "아무것도 아니야": ["なんでもないや", "Nandemonaiya", "Nandemo Naiya"],
        "그저 목소리 하나": ["ただ声一つ", "Tada Koe Hitotsu"],
        "푸른 산호초": ["青い珊瑚礁", "Aoi Sangosho", "Aoi Sangoshou"],
        "marigold": ["マリーゴールド", "마리골드"],
        "마리골드": ["マリーゴールド", "Marigold"],
        "바보같이": ["ばかみたい", "Baka Mitai", "Dame Da Ne", "Damedane"],
        "다메다네": ["ばかみたい", "Baka Mitai", "Dame Da Ne", "Damedane"],
        "jane doe": ["JANE DOE", "Jane Doe"],
        "제인도": ["JANE DOE", "Jane Doe"],
        "mela": ["Mela!"],
        "불꽃": ["炎", "Homura"],
    }
    values = []
    for key in keys:
        values.extend(aliases.get(key, []))
    return values


def query_has_title(row, query):
    compact_query = normalize(query).replace(" ", "")
    return any(
        compact_title in compact_query
        and (
            len(compact_title) >= 2
            or bool(re.search(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]", compact_title))
        )
        for compact_title in (normalize(alias).replace(" ", "") for alias in title_aliases(row.get("title")))
    )


def clean_query_part(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def query_variants(title, artist):
    title = clean_query_part(title)
    artist = clean_query_part(artist)
    variants = []
    titles = title_aliases(title)
    artists = artist_aliases(artist)
    for title_alias in titles:
        if artists and artists[0]:
            variants.append(f"{title_alias} {artists[0]}")
    for title_alias in titles:
        for artist_alias in artists[1:]:
            variants.append(f"{title_alias} {artist_alias}" if artist_alias else title_alias)
    for artist_alias in artists:
        if title and artist_alias:
            variants.append(f"{title} {artist_alias}")
    variants.extend(titles)
    deduped = []
    for query in variants:
        if query and query not in deduped:
            deduped.append(query)
    return deduped[:MAX_QUERIES_PER_SONG]


def upscale_artwork(url, size):
    if not url:
        return ""
    return re.sub(r"/\d+x\d+(bb)?\.", f"/{size}x{size}bb.", url)


def itunes_search(query, country, limit=8):
    params = {
        "term": query,
        "country": country,
        "media": "music",
        "entity": "song",
        "limit": str(limit),
    }
    url = ITUNES_SEARCH_URL + "?" + urllib.parse.urlencode(params)
    status, data = http_json("GET", url)
    if status != 200:
        return []
    return (data or {}).get("results") or []


def candidate_score(row, result, min_score, min_title_score, min_artist_score, query="", country="", rank=0):
    titles = title_aliases(row.get("title"))
    title_score = max([0.0] + [similarity(title, result.get("trackName")) for title in titles])
    has_artist = bool(normalize(row.get("artist"))) and not is_source_artist_label(row.get("artist"))
    artist_score = best_artist_similarity(
        row.get("artist"),
        result.get("artistName"),
        result.get("collectionName"),
    ) if has_artist else 0.5
    if not has_artist:
        artist_score = 0.5
    score = title_score * 0.68 + artist_score * 0.32
    title_exact = any(normalize(title) == normalize(result.get("trackName")) for title in titles)
    artist_exact = artist_exact_or_in_collection(
        row.get("artist"),
        result.get("artistName"),
        result.get("collectionName"),
    ) if has_artist else False
    search_title_supported = (
        is_jpop(row, country)
        and rank <= JPOP_SEARCH_TITLE_MAX_RANK
        and query_has_title(row, query)
        and (artist_exact or artist_score >= 0.86)
    )
    effective_title_score = max(title_score, JPOP_SEARCH_TITLE_SCORE) if search_title_supported else title_score
    score = effective_title_score * 0.68 + artist_score * 0.32
    if title_exact:
        score += 0.08
    score = min(score, 1.0)
    title_supported = title_exact or search_title_supported or effective_title_score >= min_title_score
    accepted = (
        score >= min_score
        and title_supported
        and (not has_artist or artist_exact or artist_score >= min_artist_score)
    )
    return score, accepted


def best_itunes_match(row, countries, min_score, min_title_score, min_artist_score, artwork_size):
    seen = set()
    best = None
    best_score = 0.0
    for country in countries:
        for query in query_variants(row.get("title"), row.get("artist")):
            for rank, result in enumerate(itunes_search(query, country)):
                track_id = result.get("trackId")
                if track_id and track_id in seen:
                    continue
                if track_id:
                    seen.add(track_id)
                artwork = result.get("artworkUrl100") or result.get("artworkUrl60") or ""
                if not artwork:
                    continue
                score, accepted = candidate_score(
                    row,
                    result,
                    min_score,
                    min_title_score,
                    min_artist_score,
                    query=query,
                    country=country,
                    rank=rank,
                )
                if not accepted:
                    continue
                if score > best_score:
                    best_score = score
                    best = {
                        "result": result,
                        "cover_url": upscale_artwork(artwork, artwork_size),
                        "country": country,
                        "score": score,
                    }
            if best_score >= 0.95:
                break
        if best_score >= 0.95:
            break
    if not best or best_score < min_score:
        return None
    return best


def main():
    parser = argparse.ArgumentParser(description="iTunes 앨범 커버로 songbook.cover_url 백필")
    parser.add_argument("--apply", action="store_true", help="실제로 Supabase에 저장합니다. 없으면 dry-run입니다.")
    parser.add_argument("--force", action="store_true", help="이미 cover_url이 있는 곡도 다시 검색합니다.")
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 곡 수")
    parser.add_argument("--min-score", type=float, default=DEFAULT_MIN_SCORE, help="저장할 최소 종합 매칭 점수")
    parser.add_argument("--min-title-score", type=float, default=DEFAULT_MIN_TITLE_SCORE, help="저장할 최소 제목 매칭 점수")
    parser.add_argument("--min-artist-score", type=float, default=DEFAULT_MIN_ARTIST_SCORE, help="가수가 있는 곡의 최소 가수 매칭 점수")
    parser.add_argument("--sleep", type=float, default=0.25, help="곡 처리 사이 대기 시간")
    parser.add_argument("--countries", default=",".join(DEFAULT_COUNTRIES), help="검색 국가 목록. 예: KR,JP,US")
    parser.add_argument("--artwork-size", type=int, default=600, help="저장할 커버 이미지 크기")
    args = parser.parse_args()

    service_key = env("SUPABASE_SERVICE_KEY")
    countries = [c.strip().upper() for c in args.countries.split(",") if c.strip()]
    if not countries:
        countries = list(DEFAULT_COUNTRIES)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] cover_url {'전체 재검색' if args.force else '빈 곡만'} 처리")
    print(
        f"검색 countries: {', '.join(countries)} / 최소 점수: {args.min_score} "
        f"/ 제목: {args.min_title_score} / 가수: {args.min_artist_score}"
    )

    rows = fetch_songbook_rows(service_key, force=args.force, limit=args.limit)
    print(f"대상 곡: {len(rows)}곡\n")

    matched = 0
    updated = 0
    missed = 0

    for idx, row in enumerate(rows, 1):
        label = f"{row.get('title') or ''} - {row.get('artist') or ''}".strip(" -")
        match = best_itunes_match(
            row,
            countries,
            args.min_score,
            args.min_title_score,
            args.min_artist_score,
            args.artwork_size,
        )
        if not match:
            missed += 1
            print(f"[{idx}/{len(rows)}] MISS  {label}")
            time.sleep(args.sleep)
            continue

        matched += 1
        result = match["result"]
        print(
            f"[{idx}/{len(rows)}] HIT   {label}\n"
            f"        -> {result.get('trackName')} - {result.get('artistName')} / {result.get('collectionName')} "
            f"(score={match['score']:.2f}, country={match['country']})"
        )

        if args.apply:
            ok, status, data = update_cover(service_key, row["id"], match["cover_url"])
            if ok:
                updated += 1
            else:
                print(f"        [저장 실패] {status} {data}")
        time.sleep(args.sleep)

    print("\n완료")
    print(f"  매칭: {matched}곡")
    print(f"  저장: {updated}곡")
    print(f"  실패/스킵: {missed}곡")
    if not args.apply:
        print("\n현재는 dry-run입니다. 결과가 괜찮으면 --apply를 붙여 다시 실행하세요.")


if __name__ == "__main__":
    main()
