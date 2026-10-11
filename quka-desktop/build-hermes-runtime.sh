#!/bin/bash
set -euo pipefail

APP_PATH="${1:-build/bin/QukaAI.app}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build/hermes-runtime-build"
VENV_DIR="$BUILD_DIR/venv"
DIST_DIR="$BUILD_DIR/dist"
SOURCE_DIR="$BUILD_DIR/hermes-agent-source"
CACHE_ROOT="$SCRIPT_DIR/build/hermes-runtime-cache"
DEST_DIR="$APP_PATH/Contents/Resources/hermes-agent"
BRIDGE_SCRIPT="$SCRIPT_DIR/hermes-runtime/quka_hermes_bridge.py"
PLUGIN_DIR="$SCRIPT_DIR/hermes-runtime/plugins"
SKILL_DIR="$SCRIPT_DIR/hermes-runtime/skills"
DEFAULT_HERMES_AGENT_REPO="https://github.com/NousResearch/hermes-agent.git"
DEFAULT_HERMES_AGENT_REF="a1da384c6d968000773ba0d1617d6931dfe25748"

log() {
    echo "[build-hermes-runtime] $*"
}

cleanup_build_dir() {
    if [ "${HERMES_RUNTIME_KEEP_BUILD_DIR:-0}" = "1" ]; then
        return
    fi
    rm -rf "$BUILD_DIR"
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
        echo "${HERMES_AGENT_REPO:-$DEFAULT_HERMES_AGENT_REPO}#${HERMES_AGENT_REF:-$DEFAULT_HERMES_AGENT_REF}"
    fi
}

hash_file() {
    shasum -a 256 "$1" | awk '{print $1}'
}

source_identity() {
    local source="$1"
    if [ -d "$source" ]; then
        if git -C "$source" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            local rev
            rev="$(git -C "$source" rev-parse HEAD)"
            if [ -n "$(git -C "$source" status --porcelain)" ]; then
                echo "local-git-dirty:$source:$rev"
            else
                echo "local-git:$source:$rev"
            fi
        else
            echo "local-path:$source"
        fi
        return
    fi
    echo "$source"
}

materialize_hermes_source() {
    local source="$1"

    if [ -d "$source" ]; then
        if ! is_installable_python_source "$source"; then
            log "Hermes Agent source is not installable: $source"
            log "expected pyproject.toml or setup.py; set HERMES_AGENT_SOURCE to an installable package root"
            exit 1
        fi
        HERMES_SOURCE_DIR="$source"
        return
    fi

    local repo="$source"
    local ref=""
    if [[ "$source" == git+* ]]; then
        repo="${source#git+}"
    fi
    if [[ "$repo" == *"#"* ]]; then
        ref="${repo##*#}"
        repo="${repo%#*}"
    elif [[ "$repo" == *"@"* ]]; then
        ref="${repo##*@}"
        repo="${repo%@*}"
    fi
    if [ -z "$ref" ]; then
        ref="${HERMES_AGENT_REF:-$DEFAULT_HERMES_AGENT_REF}"
    fi

    rm -rf "$SOURCE_DIR"
    log "cloning Hermes Agent source: $repo"
    git clone --filter=blob:none --quiet "$repo" "$SOURCE_DIR"
    log "checking out Hermes Agent ref: $ref"
    git -C "$SOURCE_DIR" checkout --quiet "$ref"
    HERMES_SOURCE_DIR="$SOURCE_DIR"
}

install_hermes_agent_editable() {
    local source="$1"
    materialize_hermes_source "$source"
    log "installing Hermes Agent editable from: $HERMES_SOURCE_DIR"
    if command -v uv >/dev/null 2>&1; then
        uv pip install -e "$HERMES_SOURCE_DIR"
    else
        python -m pip install -e "$HERMES_SOURCE_DIR"
    fi
}

cache_key() {
    local source="$1"
    local python_version="$2"
    local build_mode="$3"
    {
        echo "cache-version=3"
        echo "source=$(source_identity "$source")"
        echo "python=$python_version"
        echo "build-mode=$build_mode"
        echo "bridge=$(hash_file "$BRIDGE_SCRIPT")"
        echo "builder=$(hash_file "$SCRIPT_DIR/build-hermes-runtime.sh")"
    } | shasum -a 256 | awk '{print substr($1, 1, 24)}'
}

copy_hermes_top_level_modules() {
    local target_dir="$1"
    local module

    mkdir -p "$target_dir"
    for module in "$HERMES_SOURCE_DIR"/*.py; do
        [ -f "$module" ] || continue
        cp "$module" "$target_dir/"
    done
}

verify_packaged_runtime() {
    local executable="$1"

    "$executable" --runtime-import-smoke
}

copy_runtime_payload() {
    local runtime_dir="$1"

    "$SCRIPT_DIR/prepare-hermes-build.sh" "$APP_PATH"
    rm -rf "$DEST_DIR"
    mkdir -p "$DEST_DIR"
    cp -R "$runtime_dir/." "$DEST_DIR/"
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

is_supported_python_bin() {
    local candidate="$1"
    "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if (3, 11) <= sys.version_info[:2] < (3, 14) else 1)
PY
}

detect_python_bin() {
    if [ -n "${PYTHON_BIN:-}" ]; then
        echo "$PYTHON_BIN"
        return
    fi

    local candidate
    for candidate in python3.13 python3.12 python3.11 python3 /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.13 /usr/local/bin/python3.12 /usr/local/bin/python3.11; do
        if command -v "$candidate" >/dev/null 2>&1 && is_supported_python_bin "$candidate"; then
            command -v "$candidate"
            return
        fi
    done

    echo "python3"
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

PYTHON_BIN="$(detect_python_bin)"
HERMES_SOURCE="$(default_hermes_source)"
BUILD_MODE="${HERMES_RUNTIME_BUILD_MODE:-fast}"
PYTHON_VERSION="$($PYTHON_BIN --version 2>&1)"
CACHE_KEY="$(cache_key "$HERMES_SOURCE" "$PYTHON_VERSION" "$BUILD_MODE")"
CACHE_DIR="$CACHE_ROOT/$CACHE_KEY"
CACHE_RUNTIME_DIR="$CACHE_DIR/quka-hermes-bridge"

log "using Python: $PYTHON_VERSION"
log "using Hermes Agent source: $HERMES_SOURCE"
log "using build mode: $BUILD_MODE"
require_supported_python

if [ "${HERMES_RUNTIME_REBUILD:-0}" != "1" ] && [ -x "$CACHE_RUNTIME_DIR/quka-hermes-bridge" ]; then
    log "using cached Hermes runtime: $CACHE_DIR"
    copy_runtime_payload "$CACHE_RUNTIME_DIR"
    cleanup_build_dir
    exit 0
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

"$PYTHON_BIN" -m venv "$VENV_DIR"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
install_hermes_agent_editable "$HERMES_SOURCE"
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
    --paths "$HERMES_SOURCE_DIR"
    --hidden-import run_agent
    --hidden-import model_tools
    --hidden-import toolsets
    --hidden-import agent
    --hidden-import hermes_cli
    --hidden-import gateway
    --hidden-import cron
    --collect-all tools
    --collect-all plugins.web
    --collect-all agent
    --collect-all hermes_cli
    --collect-all gateway
    --collect-all cron
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
copy_hermes_top_level_modules "$DIST_DIR/quka-hermes-bridge/_internal"
log "verifying packaged Hermes runtime imports"
verify_packaged_runtime "$DIST_DIR/quka-hermes-bridge/quka-hermes-bridge"

rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
cp -R "$DIST_DIR/quka-hermes-bridge" "$CACHE_RUNTIME_DIR"
log "cached Hermes runtime: $CACHE_DIR"

copy_runtime_payload "$CACHE_RUNTIME_DIR"
cleanup_build_dir
