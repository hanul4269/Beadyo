# AGENTS.md

## 실제 데이터 보호와 안전한 검증 — 모든 채팅에서 준수

- 기능 개발·수정·검증·배포 요청을 실제 등록 데이터의 생성·수정·삭제 승인으로 해석하지 않는다. **기존 일정 카드와 실제 등록 자료를 변경하거나 삭제하는 테스트는 금지한다.** 기존 카드에서 삭제 확인창을 여는 행위도 테스트로 하지 않는다.
- `localhost:3000`도 실제 운영 DB에 연결될 수 있다. 로컬 주소, 테스트 계정, 빈 날짜라는 이유만으로 안전하다고 판단하지 않는다. **실제 DB 연결과 외부 쓰기 요청이 차단된 메모리 DB·mock 등 분리된 검증 환경임을 먼저 확인한다.** 인증 동기화·realtime·초기 데이터 로딩이 운영 환경에 연결되지 않는지도 확인한다. 격리를 확인할 수 없으면 쓰기·삭제 검증을 진행하지 않는다.
- 일정 검증은 **분리된 환경의 다음 달 빈 날짜에 테스트용 임시 일정만 준비**해서 한다. 제목에 `[테스트용]` 또는 `가짜 자료`를 명시하고, 화면에도 실제 DB와 분리된 검증 환경임을 표시한다. 실제 일정의 제목·날짜를 그대로 재사용해 기존 일정으로 오인하게 만들지 않는다.
- 수정·삭제 대상은 현재 검증을 위해 준비한 임시 기록의 ID로 제한한다. 대상 ID가 임시 자료 목록에 포함되는지 확인하고, 제목·날짜만으로 대상을 추정하거나 같은 제목의 다른 기록을 함께 삭제하지 않는다. 테스트 정리를 이유로 전체 삭제·날짜 범위 삭제를 하지 않는다.
- 삭제·초기화 같은 파괴적 동작의 브라우저 확인창을 사용자 화면에 띄우거나 반복 호출하지 않는다. 확인/취소 분기는 분리된 검증 환경에서 제어 가능한 응답으로 검증하고, 실제 브라우저 확인창의 수동 승인까지 확인했다고 보고하지 않는다. 도구가 확인창 처리에 실패하면 같은 동작을 반복하지 않는다.
- 사용자 탭·로그인 상태·실제 데이터·작업 중인 화면을 보존한다. 테스트는 별도의 백그라운드 검증 탭에서 하고, 화면 크기 검사는 가능하면 검증용 프레임으로 격리한다. 임시 탭은 에이전트가 만든 것만 정리하며, 사용자 탭을 닫거나 다른 주소로 이동시키지 않는다.
- 자동 테스트, 이벤트/키 입력값 주입, 실제 브라우저 입력, 실제 DB 검증을 구분해 보고한다. 이벤트를 강제로 발생시킨 성공이나 mock 저장 성공만으로 실제 사용자 동작 또는 운영 DB 반영이 검증됐다고 말하지 않는다. 미확인 항목과 도구 한계를 완료 보고에 명시한다.
- 위 조건을 충족하는 로컬 코드 수정과 분리된 임시 자료 테스트는 승인된 기능 작업 범위에서 진행하며, 매번 재승인을 요구하지 않는다. 실제 데이터 변경이 꼭 필요하면 대상 환경·기록 ID·변경 내용에 대한 사용자의 구체적인 승인 없이 실행하지 않는다. 이미 승인된 동일 범위는 다시 묻지 않는다.
- 실데이터 연결이나 대상 혼동이 의심되면 즉시 쓰기·삭제 동작을 멈춘다. 복구를 보장할 수 있다는 전제로 진행하지 말고, 확인된 영향과 확인하지 못한 범위를 사용자에게 정확히 알린다.

## Deployment Safety

- Treat local changes as the default stopping point for all Beadyo work.
- Do not run `git push`, deployment commands, or any command that publishes changes to the live site unless the user explicitly asks to deploy, push, or reflect the work on the live site.
- Do not create commits unless the user explicitly asks for a commit, deploy, push, or release-ready checkpoint.
- Before any user-requested deploy, push, or release-ready checkpoint, run `node scripts/check-patch-note.js`. The local `.githooks/pre-push` hook also runs this check against the commit being pushed to `main`. If it fails, add an entry with `node scripts/add-patch-note.js --tag 관리 --item "변경 내용"` and rerun the check. Data-only automated updates such as `up.json` ranking refreshes are exempt unless they include user-visible behavior changes.
- 일반 수정 요청은 로컬 파일 수정에서 멈추고, 아래 작업 방식에 따라 검증하고 보고한다.
- 라이브 사이트 확인(예: curl)은 배포 후 확인을 사용자가 명시적으로 요청했을 때만 한다.
- If a task seems likely to require live changes, pause before publishing and ask for confirmation.

## 작업 방식

- 문제·이상 현상은 수정 전에 재현·측정하고, 원인과 관련 수치·측정 방법을 먼저 보고한다. 원인이 확정되지 않았으면 추측(근거 없음) 또는 확인 불가로 표시한다. 수치가 모순되면 측정 조건을 확인하고 다시 측정한다.
- 화면 수정은 로컬 브라우저에서 320px, 375px, 데스크톱 폭으로 확인한다. 실제 확인한 폭과 가로 스크롤·요소 겹침·콘솔 오류 여부를 보고한다. 확인하지 못한 항목은 확인 불가로 적고 검증 완료라고 말하지 않는다.
- 여러 파일 변경, Supabase 권한·RLS·SQL, 로그인, 데이터 변경이 필요한 작업은 수정 전에 범위·위험·검증 방법을 계획으로 보여주고 확인받는다. 이미 승인된 범위는 재승인받지 않으며, 범위가 커지면 다시 확인받는다. SQL 실행·DB 변경은 실행 내용에 대한 명시적 승인 없이 하지 않는다.
- 결과는 변경 파일 → 검증 방법과 결과 → 확인하지 못한 항목 순으로, 비전문가가 이해할 수 있는 말로 보고한다.

## 환경 확인

- 새 기기에서 커밋·푸시를 요청받으면 Git 사용자 정보, 원격 인증, Node, core.hooksPath를 먼저 확인하고 부족한 설정을 보고한다. 설정 변경은 승인받은 뒤 수행한다.

## 자동 로컬 미리보기

- Beadyo는 항상 `http://localhost:3000`에서 확인한다. Jeongwa의 4000번 포트와 바꾸지 않는다.
- 로그인 시 launchd가 서버를 자동 실행하고 종료 시 재시작한다. 미리보기 서버를 임의로 종료하거나 다른 프로젝트 서버로 바꾸지 않는다.
- 서버가 없으면 에이전트가 `python3 tools/local_preview.py`를 실행하고 3000번에서 검증한다. 사용자가 수동으로 실행하게 하지 않는다.
- 다른 서버가 해당 포트를 사용 중이면 자동 종료하지 않고 충돌을 보고한다.
