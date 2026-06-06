#!/usr/bin/env python3
import argparse
import datetime
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid


def default_config_path():
    if os.environ.get("QUKA_AI_CONFIG"):
        return os.environ["QUKA_AI_CONFIG"]
    home = os.environ.get("HERMES_HOME") or os.path.join(os.path.expanduser("~"), ".hermes")
    return os.path.join(home, "quka-ai", "config.json")


def load_config():
    path = default_config_path()
    if not os.path.exists(path):
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "Quka AI is not configured. Open a Quka space in the desktop app first.",
            "config_path": path,
        }, ensure_ascii=False, indent=2))
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["api_base_url"] = cfg.get("api_base_url") or cfg.get("host")
    token_type = str(cfg.get("token_type") or "").strip().lower()
    if token_type not in ("access", "authorization"):
        token_type = "authorization" if cfg.get("auth_token") else "access"
    token = cfg.get("access_token") if token_type == "access" else cfg.get("auth_token")
    if not token:
        token = cfg.get("auth_token") or cfg.get("access_token")
    cfg["token_type"] = token_type
    cfg["credential_token"] = token
    missing = [key for key in ("api_base_url", "credential_token", "space_id") if not cfg.get(key)]
    if missing:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "Quka AI config is missing required fields.",
            "missing": missing,
            "config_path": path,
        }, ensure_ascii=False, indent=2))
    return cfg


def api_request(cfg, method, path, payload=None, params=None, client_source="app"):
    base = str(cfg["api_base_url"]).rstrip("/")
    url = base + path
    if params:
        clean_params = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean_params:
            separator = "&" if "?" in url else "?"
            url = url + separator + urllib.parse.urlencode(clean_params)
    data = None
    headers = {
        "Accept": "application/json",
        "Accept-Language": os.environ.get("LANG", "zh-CN").split(".")[0].replace("_", "-"),
    }
    if client_source:
        headers["X-Client-Source"] = client_source
    if cfg.get("token_type") == "authorization":
        headers["X-Authorization"] = cfg["credential_token"]
    else:
        headers["X-Access-Token"] = cfg["credential_token"]
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(json.dumps({
            "ok": False,
            "status": e.code,
            "url": url,
            "error": body,
        }, ensure_ascii=False, indent=2))
    except urllib.error.URLError as e:
        raise SystemExit(json.dumps({
            "ok": False,
            "url": url,
            "error": str(e.reason),
        }, ensure_ascii=False, indent=2))

    try:
        body = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {"ok": True, "raw": raw}

    meta = body.get("meta") if isinstance(body, dict) else None
    if isinstance(meta, dict) and meta.get("code") not in (None, 0, 200):
        return {"ok": False, "meta": meta, "data": body.get("data")}
    if isinstance(body, dict) and "data" in body:
        return {"ok": True, "data": body.get("data"), "meta": meta}
    return {"ok": True, "data": body}


def space_path(cfg, suffix):
    return "/" + urllib.parse.quote(str(cfg["space_id"]), safe="") + suffix


def journal_space_path(cfg, suffix):
    return "/space/" + urllib.parse.quote(str(cfg["space_id"]), safe="") + suffix


def print_json(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def parse_date(value, field_name):
    try:
        return datetime.datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": f"{field_name} must use yyyy-mm-dd format",
            "value": value,
        }, ensure_ascii=False, indent=2)) from exc


def command_journal_get(args):
    cfg = load_config()
    date = parse_date(args.date, "date")
    params = {"date": date.isoformat()}
    raw_response = api_request(cfg, "GET", journal_space_path(cfg, "/journal"), params=params, client_source="")
    markdown_response = api_request(cfg, "GET", journal_space_path(cfg, "/journal"), params=params, client_source="app")
    print_json(enrich_journal_response(raw_response, markdown_response))


def command_journal_list(args):
    cfg = load_config()
    start = parse_date(args.start_date, "start_date")
    end = parse_date(args.end_date, "end_date")
    if end < start:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "end_date must be on or after start_date",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }, ensure_ascii=False, indent=2))
    if (end - start).days > 31:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": "Journal lookup supports a maximum range of 31 days",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }, ensure_ascii=False, indent=2))

    journals = []
    chunks = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + datetime.timedelta(days=9), end)
        params = {"start_date": cursor.isoformat(), "end_date": chunk_end.isoformat()}
        response = api_request(cfg, "GET", journal_space_path(cfg, "/journal/list"), params=params, client_source="")
        markdown_response = api_request(cfg, "GET", journal_space_path(cfg, "/journal/list"), params=params, client_source="app")
        response = enrich_journal_response(response, markdown_response)
        chunks.append(params)
        if not response.get("ok"):
            response["chunk"] = params
            print_json(response)
            return
        data = response.get("data") or []
        if isinstance(data, list):
            journals.extend(data)
        elif data:
            journals.append(data)
        cursor = chunk_end + datetime.timedelta(days=1)

    print_json({
        "ok": True,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "count": len(journals),
        "chunks": chunks,
        "data": journals,
    })


def read_json_argument(value, path, field_name):
    if value and path:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": f"Use either --{field_name}-json or --{field_name}-file, not both.",
        }, ensure_ascii=False, indent=2))
    if path:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
    elif value:
        raw = value
    else:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": f"Missing --{field_name}-json or --{field_name}-file.",
        }, ensure_ascii=False, indent=2))
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": f"{field_name} must be valid JSON",
            "detail": str(exc),
        }, ensure_ascii=False, indent=2)) from exc


def enrich_journal_item(raw_item, markdown_item):
    if not isinstance(raw_item, dict):
        return raw_item
    out = dict(raw_item)
    if "content" in raw_item:
        out["content_raw"] = raw_item.get("content")
    if isinstance(markdown_item, dict) and "content" in markdown_item:
        out["content_markdown"] = markdown_item.get("content")
    return out


def enrich_journal_response(raw_response, markdown_response):
    if not isinstance(raw_response, dict) or not raw_response.get("ok"):
        return raw_response
    out = dict(raw_response)
    data = raw_response.get("data")
    markdown_data = markdown_response.get("data") if isinstance(markdown_response, dict) else None
    if isinstance(data, dict):
        out["data"] = enrich_journal_item(data, markdown_data)
    elif isinstance(data, list):
        markdown_by_date = {}
        if isinstance(markdown_data, list):
            for item in markdown_data:
                if isinstance(item, dict) and item.get("date"):
                    markdown_by_date[str(item.get("date"))] = item
        out["data"] = [
            enrich_journal_item(item, markdown_by_date.get(str(item.get("date"))) if isinstance(item, dict) else None)
            for item in data
        ]
    return out


def normalize_blocknote_inline_content(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [{"type": "text", "text": value, "styles": {}}]
    if not isinstance(value, list):
        raise ValueError("BlockNote inline content must be a string or an array")
    normalized = []
    for inline in value:
        if isinstance(inline, str):
            normalized.append({"type": "text", "text": inline, "styles": {}})
            continue
        if not isinstance(inline, dict):
            raise ValueError("BlockNote inline items must be objects")
        item = dict(inline)
        item.setdefault("type", "text")
        if item["type"] == "text":
            item.setdefault("text", "")
            item.setdefault("styles", {})
        elif item["type"] == "link":
            item.setdefault("href", "")
            item["content"] = normalize_blocknote_inline_content(item.get("content", []))
        normalized.append(item)
    return normalized


def normalize_blocknote_block(block):
    if not isinstance(block, dict):
        raise ValueError("Each BlockNote block must be an object")
    out = dict(block)
    out["id"] = str(out.get("id") or f"quka-agent-{uuid.uuid4().hex[:12]}")
    out["type"] = str(out.get("type") or "paragraph")
    props = out.get("props")
    out["props"] = props if isinstance(props, dict) else {}
    if out["type"] in ("image", "video", "audio", "file"):
        out.setdefault("content", [])
    elif out["type"] == "table":
        out.setdefault("content", {"type": "tableContent", "rows": []})
    else:
        out["content"] = normalize_blocknote_inline_content(out.get("content", []))
    children = out.get("children") or []
    if not isinstance(children, list):
        raise ValueError("BlockNote block children must be an array")
    out["children"] = [normalize_blocknote_block(child) for child in children]
    return out


def normalize_blocknote_blocks(value):
    if not isinstance(value, list):
        raise ValueError("Journal upsert content must be a BlockNote blocks array")
    return [normalize_blocknote_block(block) for block in value]


def command_journal_upsert(args):
    cfg = load_config()
    date = parse_date(args.date, "date")
    raw_blocks = read_json_argument(args.content_json, args.content_file, "content")
    try:
        blocks = normalize_blocknote_blocks(raw_blocks)
    except ValueError as exc:
        raise SystemExit(json.dumps({
            "ok": False,
            "error": str(exc),
        }, ensure_ascii=False, indent=2)) from exc
    payload = {
        "date": date.isoformat(),
        "content": blocks,
    }
    print_json(api_request(
        cfg,
        "PUT",
        journal_space_path(cfg, "/journal"),
        payload,
        client_source="",
    ))


def command_status(args):
    cfg = load_config()
    print_json({
        "ok": True,
        "api_base_url": cfg.get("api_base_url"),
        "space_id": cfg.get("space_id"),
        "resource": cfg.get("resource") or "knowledge",
        "updated_at": cfg.get("updated_at"),
    })


def command_knowledge_query(args):
    cfg = load_config()
    resource = args.resource or cfg.get("resource")
    payload = {"query": args.query}
    if args.agent:
        payload["agent"] = args.agent
    if resource:
        payload["resource"] = {"include": [resource]}
    print_json(api_request(cfg, "POST", space_path(cfg, "/knowledge/query"), payload))


def command_user_memory_recall(args):
    cfg = load_config()
    payload = {
        "query": args.query,
        "limit": args.limit,
        "include_evidence": args.include_evidence,
    }
    if args.scope:
        payload["scopes"] = args.scope
    if args.memory_type:
        payload["memory_types"] = args.memory_type
    if args.entity_key:
        payload["entity_keys"] = args.entity_key
    print_json(api_request(cfg, "POST", space_path(cfg, "/memory/recall"), payload))


def command_user_memory_get(args):
    cfg = load_config()
    print_json(api_request(cfg, "POST", space_path(cfg, "/memory/get"), {"memory_id": args.memory_id}))


def command_user_memory_remember(args):
    cfg = load_config()
    payload = {
        "resource": args.resource or cfg.get("resource") or "knowledge",
        "title": args.title or "",
        "content": args.content,
        "content_type": args.content_type,
        "kind": args.kind,
        "memory_type": args.memory_type,
        "scope": args.scope,
        "author_type": args.author_type,
        "epistemic_status": args.epistemic_status,
        "importance": args.importance,
        "confidence": args.confidence,
        "source_kind": args.source_kind,
        "source_ref": args.source_ref or "hermes-agent",
    }
    if args.entity_key:
        payload["entity_key"] = args.entity_key
    print_json(api_request(cfg, "POST", space_path(cfg, "/memory/remember"), payload))


def command_user_memory_update(args):
    cfg = load_config()
    payload = {"id": args.memory_id}
    optional_fields = {
        "status": args.status,
        "title": args.title,
        "content": args.content,
        "content_type": args.content_type,
        "importance": args.importance,
        "confidence": args.confidence,
        "author_type": args.author_type,
        "epistemic_status": args.epistemic_status,
        "entity_key": args.entity_key,
        "dedupe_key": args.dedupe_key,
        "conflict_state": args.conflict_state,
        "valid_from": args.valid_from,
        "valid_to": args.valid_to,
    }
    for key, value in optional_fields.items():
        if value is not None and value != "":
            payload[key] = value
    print_json(api_request(cfg, "POST", space_path(cfg, "/memory/update"), payload))


def command_user_memory_delete(args):
    cfg = load_config()
    payload = {
        "id": args.memory_id,
        "hard": args.hard,
        "delete_knowledge": args.delete_knowledge,
    }
    print_json(api_request(cfg, "POST", space_path(cfg, "/memory/delete"), payload))


def main():
    parser = argparse.ArgumentParser(description="Quka AI helper for Hermes skills")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status").set_defaults(func=command_status)

    p = sub.add_parser("journal-get")
    p.add_argument("--date", required=True)
    p.set_defaults(func=command_journal_get)

    p = sub.add_parser("journal-list")
    p.add_argument("--start-date", required=True)
    p.add_argument("--end-date", required=True)
    p.set_defaults(func=command_journal_list)

    p = sub.add_parser("journal-upsert")
    p.add_argument("--date", required=True)
    p.add_argument("--content-json", default="")
    p.add_argument("--content-file", default="")
    p.set_defaults(func=command_journal_upsert)

    p = sub.add_parser("knowledge-query")
    p.add_argument("--query", required=True)
    p.add_argument("--agent", default="")
    p.add_argument("--resource", default="")
    p.set_defaults(func=command_knowledge_query)

    p = sub.add_parser("user-memory-recall", aliases=["memory-recall"])
    p.add_argument("--query", required=True)
    p.add_argument("--limit", type=int, default=8)
    p.add_argument("--scope", action="append")
    p.add_argument("--memory-type", action="append")
    p.add_argument("--entity-key", action="append")
    p.add_argument("--include-evidence", action="store_true")
    p.set_defaults(func=command_user_memory_recall)

    p = sub.add_parser("user-memory-get", aliases=["memory-get"])
    p.add_argument("--memory-id", required=True)
    p.set_defaults(func=command_user_memory_get)

    p = sub.add_parser("user-memory-remember", aliases=["remember"])
    p.add_argument("--content", required=True)
    p.add_argument("--title", default="")
    p.add_argument("--resource", default="")
    p.add_argument("--content-type", default="markdown")
    p.add_argument("--kind", default="text")
    p.add_argument("--memory-type", default="semantic")
    p.add_argument("--scope", default="space")
    p.add_argument("--author-type", default="agent")
    p.add_argument("--epistemic-status", default="observed")
    p.add_argument("--entity-key", default="")
    p.add_argument("--importance", type=int, default=5)
    p.add_argument("--confidence", type=float, default=0.8)
    p.add_argument("--source-kind", default="chat")
    p.add_argument("--source-ref", default="")
    p.set_defaults(func=command_user_memory_remember)

    p = sub.add_parser("user-memory-update", aliases=["memory-update"])
    p.add_argument("--memory-id", required=True)
    p.add_argument("--status", default="")
    p.add_argument("--title", default="")
    p.add_argument("--content", default="")
    p.add_argument("--content-type", default="")
    p.add_argument("--importance", type=int)
    p.add_argument("--confidence", type=float)
    p.add_argument("--author-type", default="")
    p.add_argument("--epistemic-status", default="")
    p.add_argument("--entity-key", default="")
    p.add_argument("--dedupe-key", default="")
    p.add_argument("--conflict-state", default="")
    p.add_argument("--valid-from", type=int)
    p.add_argument("--valid-to", type=int)
    p.set_defaults(func=command_user_memory_update)

    p = sub.add_parser("user-memory-delete", aliases=["memory-delete"])
    p.add_argument("--memory-id", required=True)
    p.add_argument("--hard", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--delete-knowledge", action=argparse.BooleanOptionalAction, default=True)
    p.set_defaults(func=command_user_memory_delete)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()