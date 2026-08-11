#!/bin/bash
set -euo pipefail

# Nur in Claude Code auf dem Web ausfuehren — lokale Sitzungen haben das
# Pruefwerkzeug meist schon eingerichtet, und die App selbst braucht diesen
# Schritt nie (sie ist abhaengigkeitsfrei, siehe CLAUDE.md).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/tests"
npm install --no-audit --no-fund
