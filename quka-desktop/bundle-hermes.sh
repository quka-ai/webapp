#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${HERMES_RUNTIME_BUILD_DISABLED:-0}" = "1" ]; then
    echo "[bundle-hermes] Hermes runtime build disabled by HERMES_RUNTIME_BUILD_DISABLED=1"
    if [ "${HERMES_BUNDLE_REQUIRED:-0}" = "1" ]; then
        exit 1
    fi
    exit 0
fi

exec "$SCRIPT_DIR/build-hermes-runtime.sh" "${1:-build/bin/QukaAI.app}"
