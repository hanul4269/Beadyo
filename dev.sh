#!/bin/bash
echo "beadyo 로컬 서버 시작 중..."
echo "브라우저에서 http://localhost:3000 으로 접속하세요"
echo "(종료: Ctrl+C)"
python3 -m http.server 3000
