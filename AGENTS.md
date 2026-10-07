# AGENTS.md

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
