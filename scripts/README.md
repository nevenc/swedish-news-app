# Local translation schedule (macOS launchd)

`translate-local.sh` translates pending items with `claude -p` on the machine's Claude Code
subscription, imports them, and pushes the changed `content/` files. It is designed to run
hourly on an always-on Mac next to the GitHub Actions ingest workflow:

- Actions (every 15 min): fetch feeds, write new items, rebuild `docs/`, push.
- This job (every hour): translate pending items, push `content/` only.
- The next Actions run rebuilds `docs/` with the translations, so the site catches up within 15 minutes.

Install (once), from the app directory:

```
sed -e "s|__APP__|$PWD|g" -e "s|__HOME__|$HOME|g" scripts/com.swedlines.translate.plist \
  > ~/Library/LaunchAgents/com.swedlines.translate.plist
launchctl load ~/Library/LaunchAgents/com.swedlines.translate.plist
```

Run now: `launchctl start com.swedlines.translate` (or `bash scripts/translate-local.sh`).
Logs: `~/Library/Logs/swedlines-translate.log`.
Remove: `launchctl unload ~/Library/LaunchAgents/com.swedlines.translate.plist`.

Requirements: `claude` logged in for the user running the job, `git` push access to the content repo,
and a checkout of it at `content-repo/` (or set `SWEDLINES_CONTENT`).
