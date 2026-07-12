# AGENTS.md

## Deployment Safety

- Treat local changes as the default stopping point for all Beadyo work.
- Do not run `git push`, deployment commands, or any command that publishes changes to the live site unless the user explicitly asks to deploy, push, or reflect the work on the live site.
- Do not create commits unless the user explicitly asks for a commit, deploy, push, or release-ready checkpoint.
- For ordinary edit requests, modify files locally, verify locally when practical, and report the changed files and verification result.
- Do not use live-site checks such as `curl https://beadyo.com...` as part of normal local editing. Use them only after the user asks for deployment or live verification.
- If a task seems likely to require live changes, pause before publishing and ask for confirmation.

