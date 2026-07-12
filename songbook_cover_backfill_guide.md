# 노래책 커버 자동채우기

사이트 관리 버튼으로 `songbook.cover_url`을 채우는 절차입니다.

기본은 iTunes Search API로 앨범 커버를 찾습니다. 선택하면 iTunes에서 실패한 곡만 YouTube Data API로 한 번 더 찾고, 그 결과의 영상 썸네일을 저장합니다.

## 사이트 관리 버튼으로 실행

beadyo.com 또는 로컬 페이지에서 편집자 계정으로 로그인합니다.

1. 노래책 탭으로 이동
2. `KPOP`, `POP`, `JPOP` 같은 장르 탭으로 이동
3. 오른쪽 아래 `+` 버튼 클릭
4. `커버 자동채우기` 클릭
5. iTunes만 쓸 거면 바로 `현재 탭` 또는 `전체` 클릭
6. YouTube 보조 검색도 쓸 거면 `iTunes 실패곡만 YouTube로 보조 채우기` 체크
7. YouTube Data API 키를 입력하고 `현재 탭` 또는 `전체` 클릭

자동채우기는 `cover_url`이 비어있는 곡만 처리하므로 기존 커버는 유지됩니다.

## YouTube 보조 검색

YouTube는 앨범 커버가 아니라 영상 썸네일입니다. 그래서 iTunes에서 못 찾은 곡만 보조로 쓰는 것이 좋습니다.

필요한 것은 Google Cloud의 YouTube Data API v3 키입니다. 이 키는 Supabase에 넣지 않고, `커버 자동채우기` 창의 `YouTube Data API 키` 입력칸에 넣습니다. 입력한 키는 현재 브라우저의 localStorage에만 저장됩니다.

## 터미널 백업 방법

사이트 버튼이 막힐 때만 터미널 스크립트를 사용합니다.

```bash
cd "/Users/hanul/Desktop/Claude project/beadyo"

SUPABASE_SERVICE_KEY="Supabase service role key" \
python3 backfill_songbook_covers_itunes.py --apply
```

터미널 옵션:

- `--limit 20`: 앞에서 20곡만 테스트
- `--min-score 0.7`: 더 엄격하게 매칭
- `--countries KR,JP,US`: 검색 국가 순서 지정
- `--artwork-size 1200`: 더 큰 이미지 URL로 저장
- `--force`: 이미 커버가 있는 곡도 다시 검색
- `--sleep 0.4`: iTunes 요청 사이 대기 시간을 늘림

## 주의

- 매칭이 애매한 곡은 `MISS`로 남기고, 나중에 관리 화면에서 커버 URL을 직접 넣으면 됩니다.
