#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def print_json(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def locate_bridge_binary():
    for key in ("QUKA_HERMES_BRIDGE_BIN", "HERMES_BRIDGE_BIN"):
        value = os.environ.get(key, "").strip()
        if value and os.path.exists(value):
            return value

    script_path = Path(__file__).resolve()
    hermes_agent_root = script_path.parents[3] if len(script_path.parents) >= 4 else None
    if hermes_agent_root:
        candidate = hermes_agent_root / "quka-hermes-bridge"
        if candidate.exists():
            return str(candidate)

    dev_bridge = script_path.parents[3] / "quka_hermes_bridge.py" if len(script_path.parents) >= 4 else None
    if dev_bridge and dev_bridge.exists():
        return str(dev_bridge)

    raise SystemExit(json.dumps({
        "ok": False,
        "error": "Unable to locate Quka Hermes bridge binary. QUKA_HERMES_BRIDGE_BIN is not set.",
    }, ensure_ascii=False, indent=2))


def read_request(args):
    if args.request_file and args.request_json:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "Use either --request-file or --request-json, not both.",
        }, ensure_ascii=False, indent=2))
    if args.request_file:
        with open(args.request_file, "r", encoding="utf-8") as request_file:
            raw = request_file.read()
    elif args.request_json:
        raw = args.request_json
    else:
        raw = sys.stdin.read()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "request must be valid JSON",
            "detail": str(exc),
        }, ensure_ascii=False, indent=2)) from exc
    if not isinstance(value, dict):
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "request must be a JSON object",
        }, ensure_ascii=False, indent=2))
    return value


def run_agents(args):
    request = read_request(args)
    bridge = locate_bridge_binary()
    command = [sys.executable, bridge, "--run-agents"] if bridge.endswith(".py") else [bridge, "--run-agents"]

    request_file = args.request_file
    tmp_file = None
    if not request_file:
        tmp_file = tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False)
        try:
            json.dump(request, tmp_file, ensure_ascii=False)
            tmp_file.flush()
            request_file = tmp_file.name
        finally:
            tmp_file.close()

    command.extend(["--request-file", request_file])
    parent_session_id = (
        os.environ.get("QUKA_HERMES_PARENT_SESSION_ID")
        or os.environ.get("HERMES_SESSION_ID")
        or os.environ.get("HERMES_SESSION_KEY")
        or ""
    )
    if parent_session_id:
        command.extend(["--parent-session-id", parent_session_id])

    try:
        completed = subprocess.run(command, text=True, capture_output=True, check=False, env=os.environ.copy())
    finally:
        if tmp_file is not None:
            try:
                os.unlink(tmp_file.name)
            except OSError:
                pass

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    if completed.returncode != 0:
        try:
            payload = json.loads(stdout) if stdout else {}
        except json.JSONDecodeError:
            payload = {}
        payload.setdefault("ok", False)
        payload.setdefault("status", "failed")
        payload.setdefault("error", stderr or stdout or f"bridge exited with code {completed.returncode}")
        if stderr:
            payload["stderr"] = stderr
        print_json(payload)
        raise SystemExit(completed.returncode)

    if stdout:
        print(stdout)
    else:
        print_json({"ok": False, "status": "failed", "error": "bridge returned empty output"})
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description="QukaAI Desktop multi-agent helper")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run-agents")
    run.add_argument("--request-file", default="")
    run.add_argument("--request-json", default="")
    run.set_defaults(func=run_agents)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
