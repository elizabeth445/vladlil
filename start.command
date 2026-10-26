#!/bin/zsh
cd "$(dirname "$0")"
source "$HOME/.codex/bin/frontend-env.sh"
if curl --silent --fail http://127.0.0.1:3000 >/dev/null; then
  open http://127.0.0.1:3000
  exit 0
fi
(
  for attempt in {1..30}; do
    if curl --silent --fail http://127.0.0.1:3000 >/dev/null; then
      open http://127.0.0.1:3000
      break
    fi
    sleep 1
  done
) &
npm run dev
