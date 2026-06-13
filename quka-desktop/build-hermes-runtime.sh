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

is_installable_python_source() {
    local source="$1"
    [ -d "$source" ] && { [ -f "$source/pyproject.toml" ] || [ -f "$source/setup.py" ]; }
}

default_hermes_source() {
    if [ -n "${HERMES_AGENT_SOURCE:-}" ]; then
        echo "$HERMES_AGENT_SOURCE"
    elif is_installable_python_source "/tmp/hermes-agent"; then
        echo "/tmp/hermes-agent"
    else
        echo "git+https://github.com/NousResearch/hermes-agent.git"
    fi
}

pip_install_hermes_agent() {
    local source="$1"
    local install_spec
    if [ -d "$source" ] && ! is_installable_python_source "$source"; then
        if [ -n "${HERMES_AGENT_SOURCE:-}" ]; then
            log "Hermes Agent source is not installable: $source"
            log "expected pyproject.toml or setup.py; set HERMES_AGENT_SOURCE to an installable package root"
            exit 1
        fi
        log "skipping non-installable local Hermes Agent source: $source"
        source="git+https://github.com/NousResearch/hermes-agent.git"
    fi
    install_spec="$source"
    log "installing Hermes Agent package from: $install_spec"
    python -m pip install "$install_spec"
}

require_supported_python() {
    local version
    if ! version="$("$PYTHON_BIN" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
raise SystemExit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 1)
PY
)"; then
        log "unsupported Python version: $version"
        log "Hermes Agent requires Python >=3.11,<3.14. Set PYTHON_BIN to a supported interpreter, for example: PYTHON_BIN=python3.11 $0"
        exit 1
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

"$SCRIPT_DIR/prepare-hermes-build.sh" "$APP_PATH"

PYTHON_BIN="${PYTHON_BIN:-python3}"
HERMES_SOURCE="$(default_hermes_source)"
BUILD_MODE="${HERMES_RUNTIME_BUILD_MODE:-fast}"

log "using Python: $($PYTHON_BIN --version 2>&1)"
log "using Hermes Agent source: $HERMES_SOURCE"
log "using build mode: $BUILD_MODE"
require_supported_python

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

"$PYTHON_BIN" -m venv "$VENV_DIR"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
pip_install_hermes_agent "$HERMES_SOURCE"
python -m pip install "websockets>=14,<16"
python -m pip install "pyinstaller>=6.11,<7"
python - <<'PY'
import os
os.environ.setdefault("TAVILY_API_KEY", "quka-build-smoke-placeholder")
from model_tools import get_tool_definitions

names = {
    tool.get("function", {}).get("name")
    for tool in get_tool_definitions(["web"], quiet_mode=True)
}
missing = {"web_search", "web_extract"} - names
if missing:
    raise SystemExit(f"Hermes web tool smoke failed; missing: {sorted(missing)}")
print("[build-hermes-runtime] Hermes web tools available:", ", ".join(sorted({"web_search", "web_extract"} & names)))
PY

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
    --collect-all tools
    --collect-all plugins.web
)

case "$BUILD_MODE" in
    fast|lite)
        log "using static dependency analysis for faster bridge cold starts"
        ;;
    full)
        log "using full Hermes package collection for maximum compatibility"
        PYINSTALLER_ARGS+=(
            --collect-all agent
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

"$SCRIPT_DIR/prepare-hermes-build.sh" "$APP_PATH"
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
    find "$DEST_DIR/skills" -type d -exec chmod 0555 {} +
    find "$DEST_DIR/skills" -type f -exec chmod 0444 {} +
    find "$DEST_DIR/skills" -type f -name "*.py" -exec chmod 0555 {} +
    log "bundled Hermes skills from $SKILL_DIR"
fi

log "embedded Hermes bridge bundled at $DEST_DIR/quka-hermes-bridge"
