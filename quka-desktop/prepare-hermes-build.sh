#!/bin/bash
set -euo pipefail

APP_PATH="${1:-build/bin/QukaAI.app}"
HERMES_DIR="$APP_PATH/Contents/Resources/hermes-agent"

if [ -d "$HERMES_DIR" ]; then
    chmod -R u+rwX "$HERMES_DIR" 2>/dev/null || true
fi
