#!/bin/bash
set -euo pipefail

APP_PATH="${1:-build/bin/QukaAI.app}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build/hermes-runtime-build"
VENV_DIR="$BUILD_DIR/venv"
DIST_DIR="$BUILD_DIR/dist"
DEST_DIR="$APP_PATH/Contents/Resources/hermes-agent"
BRIDGE_SCRIPT="$SCRIPT_DIR/hermes-runtime/quka_hermes_bridge.py"
PLUGIN_DIR="$SCRIPT_DIR/hermes-runtime/plugins"
SKILL_DIR="$SCRIPT_DIR/hermes-runtime/skills"

log() {
    echo "[build-hermes-runtime] $*"
}

default_hermes_source() {
    if [ -n "${HERMES_AGENT_SOURCE:-}" ]; then
        echo "$HERMES_AGENT_SOURCE"
    elif [ -d "/tmp/hermes-agent" ]; then
        echo "/tmp/hermes-agent"
    else
        echo "git+https://github.com/NousResearch/hermes-agent.git"
    fi
}

if [ ! -d "$APP_PATH" ]; then
    log "app bundle not found: $APP_PATH"
    exit 1
fi

if [ ! -f "$BRIDGE_SCRIPT" ]; then
    log "bridge script not found: $BRIDGE_SCRIPT"
    exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
HERMES_SOURCE="$(default_hermes_source)"
BUILD_MODE="${HERMES_RUNTIME_BUILD_MODE:-fast}"

log "using Python: $($PYTHON_BIN --version 2>&1)"
log "using Hermes Agent source: $HERMES_SOURCE"
log "using build mode: $BUILD_MODE"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

"$PYTHON_BIN" -m venv "$VENV_DIR"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install "${HERMES_SOURCE}[web]"
python -m pip install "pyinstaller>=6.11,<7"

PYINSTALLER_ARGS=(
    --clean
    --noconfirm
    --onedir
    --name quka-hermes-bridge
    --distpath "$DIST_DIR"
    --workpath "$BUILD_DIR/pyinstaller"
    --specpath "$BUILD_DIR"
    --hidden-import run_agent
    --hidden-import model_tools
    --hidden-import toolsets
)

case "$BUILD_MODE" in
    fast|lite)
        log "using static dependency analysis for faster bridge cold starts"
        ;;
    full)
        log "using full Hermes package collection for maximum compatibility"
        PYINSTALLER_ARGS+=(
            --collect-all agent
            --collect-all tools
            --collect-all hermes_cli
            --collect-all gateway
            --collect-all cron
        )
        ;;
    *)
        log "unknown HERMES_RUNTIME_BUILD_MODE: $BUILD_MODE"
        log "expected one of: fast, lite, full"
        exit 1
        ;;
esac

rm -rf "$DIST_DIR"
pyinstaller "${PYINSTALLER_ARGS[@]}" "$BRIDGE_SCRIPT"

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -R "$DIST_DIR/quka-hermes-bridge/." "$DEST_DIR/"
chmod +x "$DEST_DIR/quka-hermes-bridge"
if [ -d "$PLUGIN_DIR" ]; then
    rm -rf "$DEST_DIR/plugins"
    mkdir -p "$DEST_DIR/plugins"
    cp -R "$PLUGIN_DIR/." "$DEST_DIR/plugins/"
    find "$DEST_DIR/plugins" -type d \( -name "__pycache__" -o -name "tests" \) -prune -exec rm -rf {} +
    find "$DEST_DIR/plugins" -type f -name "*.pyc" -delete
    log "bundled Hermes plugins from $PLUGIN_DIR"
fi
if [ -d "$SKILL_DIR" ]; then
    rm -rf "$DEST_DIR/skills"
    mkdir -p "$DEST_DIR/skills"
    cp -R "$SKILL_DIR/." "$DEST_DIR/skills/"
    find "$DEST_DIR/skills" -type d \( -name "__pycache__" -o -name "tests" \) -prune -exec rm -rf {} +
    find "$DEST_DIR/skills" -type f -name "*.pyc" -delete
    find "$DEST_DIR/skills" -type f -name "*.py" -exec chmod +x {} +
    log "bundled Hermes skills from $SKILL_DIR"
fi

log "embedded Hermes bridge bundled at $DEST_DIR/quka-hermes-bridge"
