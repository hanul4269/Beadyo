#!/bin/bash
cd "$(dirname "$0")"

python3 .github/scripts/check_up.py >> /tmp/beadyo_ranking.log 2>&1

git add up.json
if git diff --cached --quiet; then
  exit 0
fi

git commit -m "chore: update UP ranking"
git pull --rebase origin main
git push origin main
