#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_SCRIPT="$SCRIPT_DIR/hermes-runtime/quka_hermes_bridge.py"
DEFAULT_BIN="$SCRIPT_DIR/build/hermes-runtime-build/dist/quka-hermes-bridge/quka-hermes-bridge"
BRIDGE_BIN="${HERMES_BRIDGE_BIN:-$DEFAULT_BIN}"
APP_PATH="${1:-$SCRIPT_DIR/build/bin/QukaAI.app}"

log() {
    echo "[test-hermes-smoke] $*"
}

if [ "${HERMES_BRIDGE_BIN:-}" = "" ]; then
    if [ ! -x "$BRIDGE_BIN" ] || [ "$BRIDGE_SCRIPT" -nt "$BRIDGE_BIN" ]; then
        if [ ! -d "$APP_PATH" ]; then
            log "app bundle not found: $APP_PATH"
            log "build the Wails app first, or pass the app bundle path as the first argument"
            exit 1
        fi
        log "building embedded Hermes bridge"
        "$SCRIPT_DIR/build-hermes-runtime.sh" "$APP_PATH"
    fi
fi

if [ ! -x "$BRIDGE_BIN" ]; then
    log "bridge binary is not executable: $BRIDGE_BIN"
    exit 1
fi

log "running smoke tests with bridge: $BRIDGE_BIN"
cd "$SCRIPT_DIR"
QUKA_HERMES_SMOKE=1 HERMES_BRIDGE_BIN="$BRIDGE_BIN" go test -run 'TestHermes.*Smoke' -count=1 -v
