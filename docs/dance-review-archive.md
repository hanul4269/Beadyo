# 춤영상 검토 페이지 보관 안내

2026-11-25에 춤영상 검토 페이지를 사이트에서 내렸습니다. 파일과 DB 자료는 지우지 않고 그대로 두었으니, 나중에 필요하면 아래 내용을 보고 고쳐서 다시 붙이면 됩니다.

공개 춤영상 페이지(`dance.html`, `dance-approved-data.js`)는 그대로 운영합니다.

## 내린 이유

- **새 영상이 들어오지 않음**: '새 데이터 가져오기' 버튼은 SOOP에서 새로 받아 오지 않습니다. 6월 28일에 만든 고정 파일 `dance-import-feed.js`를 다시 읽을 뿐입니다. 이 파일을 만든 수집 스크립트는 남아 있지 않습니다.
- **공개되면 안 되는 내용이 공개됨**: `dance-data.js`와 `dance-import-feed.js`가 공개 파일로 배포되고 있었습니다. 그래서 편집자가 숨긴 영상 목록과 검토 대기 상태를 누구나 받아 볼 수 있었습니다.

## 보관한 것 (저장소에는 있고, `_config.yml` exclude로 사이트 배포에서만 빠짐)

| 파일 | 내용 |
|---|---|
| `dance-archive.html` | 편집자용 검토 페이지 |
| `dance-data.js` | 영상 후보 991개 (2026-06-28 기준, 상태는 옛 값) |
| `dance-import-feed.js` | '새 데이터 가져오기' 버튼이 읽던 고정 파일 (991개) |
| `dance-thumbnail-backfill.js` | 썸네일 보정 자료 |

그 밖에 남아 있는 것:
- `tokens.css`의 `html[data-page="dance-archive"]` 스타일
- 테스트 `scripts/test-video-modal-focus.cjs`, `scripts/test-security-urls.cjs`, `scripts/test-standalone-theme.cjs`

## DB 자료 (그대로 둠)

- 테이블은 `dance_video_statuses`입니다.
- 2026-11-25 조회 기준 991건이고, 채택 694건, 숨김 297건, 검토 대기 0건입니다. 모두 2026-07-01에 한꺼번에 기록됐습니다.
- 상태만 저장돼 있고 제목·주소·썸네일은 비어 있습니다. 그래서 채택 694건 중 `dance-approved-data.js`에 없는 393건은 공개 페이지에 나오지 않습니다.
- 권한: 일반 방문자는 '채택' 행만 읽을 수 있고, 쓰기는 편집자만 할 수 있습니다(`restrict_editor_only_pages.sql`).

## 다시 붙일 때 할 일

1. **새 영상 수집 만들기**
   - SOOP 방송국 `beadyo97`의 캐치·VOD 클립을 매일 가져오는 수집기를 만듭니다.
   - 새 영상은 DB에 '검토 필요'로 추가만 하고, 이미 결정한 행은 덮어쓰지 않습니다.
2. **DB에 영상 정보 저장**: `dance_video_statuses`에 제목·주소·썸네일·제작자·게시일 열을 추가하고, 위 991건은 보관 파일에서 정보를 채웁니다.
3. **검토 페이지 고치기**
   - 고정 파일(`dance-data.js`, `dance-import-feed.js`) 대신 DB만 읽도록 바꿉니다.
   - '새 데이터 가져오기' 버튼은 "DB에서 다시 불러오기"로 바꿉니다.
4. **다시 연결하기**
   - `_config.yml`에서 `dance-archive.html`만 exclude에서 빼고, 데이터 파일 두 개는 계속 빼 둡니다.
   - `index-app.js` 계정 메뉴에 버튼을 다시 넣습니다(예전 함수 `openDanceReviewPage`, git 이력 참고).
