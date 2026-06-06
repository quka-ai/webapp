"""Local hidden-value redaction for QukaAI's embedded Hermes runtime."""

from __future__ import annotations

import copy
import secrets
import threading
from dataclasses import dataclass, field
from typing import Any


PLACEHOLDER_PREFIX = "__QUKA_HIDDEN_"
PLACEHOLDER_SUFFIX = "__"
MAX_BUFFER_CHARS = 256


@dataclass
class _SessionMap:
    turn_nonce: str = field(default_factory=lambda: secrets.token_hex(4))
    counter: int = 0
    values: dict[str, str] = field(default_factory=dict)


class HiddenRedactionStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sessions: dict[str, _SessionMap] = {}

    def begin_turn(self, session_id: str) -> None:
        key = _session_key(session_id)
        with self._lock:
            self._sessions[key] = _SessionMap()

    def redact_text(self, session_id: str, text: str) -> str:
        if "$hidden[" not in text:
            return text
        key = _session_key(session_id)
        with self._lock:
            mapping = self._sessions.setdefault(key, _SessionMap())
            return _redact_text_with_mapping(text, mapping)

    def restore_text(self, session_id: str, text: str) -> str:
        if PLACEHOLDER_PREFIX not in text:
            return text
        key = _session_key(session_id)
        with self._lock:
            mapping = self._sessions.get(key)
            if mapping is None:
                return text
            for placeholder, original in mapping.values.items():
                text = text.replace(placeholder, original)
            return text

    def protect_text(self, session_id: str, text: str) -> str:
        if PLACEHOLDER_PREFIX not in text:
            return text
        key = _session_key(session_id)
        with self._lock:
            mapping = self._sessions.get(key)
            if mapping is None:
                return text
            for placeholder, original in mapping.values.items():
                text = text.replace(placeholder, _hidden_marker(original))
            return text

    def redact_value(self, session_id: str, value: Any) -> Any:
        return _walk(value, lambda text: self.redact_text(session_id, text), mutate=True)

    def restore_value(self, session_id: str, value: Any) -> Any:
        return _walk(value, lambda text: self.restore_text(session_id, text), mutate=False)

    def protect_value(self, session_id: str, value: Any) -> Any:
        return _walk(value, lambda text: self.protect_text(session_id, text), mutate=False)

    def stats(self, session_id: str) -> dict[str, Any]:
        key = _session_key(session_id)
        with self._lock:
            mapping = self._sessions.get(key)
            return {
                "session_id": key,
                "count": len(mapping.values) if mapping else 0,
                "enabled": True,
            }


class HiddenStreamRestorer:
    """Restore placeholders from streamed chunks without splitting tokens."""

    def __init__(self, session_id: str, store: HiddenRedactionStore | None = None) -> None:
        self.session_id = _session_key(session_id)
        self.store = store or hidden_redaction_store
        self._buffer = ""

    def push(self, chunk: str | None) -> str:
        display, _protected = self.push_pair(chunk)
        return display

    def push_pair(self, chunk: str | None) -> tuple[str, str]:
        if not chunk:
            return "", ""
        self._buffer += chunk
        restored = self.store.restore_text(self.session_id, self._buffer)
        protected = self.store.protect_text(self.session_id, self._buffer)
        keep = _trailing_placeholder_prefix_len(restored)
        if keep > 0:
            emit = restored[:-keep]
            protected_emit = protected[:-keep]
            self._buffer = restored[-keep:]
        else:
            emit = restored
            protected_emit = protected
            self._buffer = ""
        if len(self._buffer) > MAX_BUFFER_CHARS:
            overflow = self._buffer[:-MAX_BUFFER_CHARS]
            self._buffer = self._buffer[-MAX_BUFFER_CHARS:]
            emit += overflow
            protected_emit += overflow
        return emit, protected_emit

    def flush(self) -> str:
        display, _protected = self.flush_pair()
        return display

    def flush_pair(self) -> tuple[str, str]:
        if not self._buffer:
            return "", ""
        restored = self.store.restore_text(self.session_id, self._buffer)
        protected = self.store.protect_text(self.session_id, self._buffer)
        self._buffer = ""
        return restored, protected


hidden_redaction_store = HiddenRedactionStore()


def begin_hidden_turn(session_id: str) -> None:
    hidden_redaction_store.begin_turn(session_id)


def redact_hidden_value(session_id: str, value: Any) -> Any:
    return hidden_redaction_store.redact_value(session_id, value)


def restore_hidden_text(session_id: str, text: str) -> str:
    return hidden_redaction_store.restore_text(session_id, text)


def restore_hidden_value(session_id: str, value: Any) -> Any:
    return hidden_redaction_store.restore_value(session_id, value)


def protect_hidden_text(session_id: str, text: str) -> str:
    return hidden_redaction_store.protect_text(session_id, text)


def protect_hidden_value(session_id: str, value: Any) -> Any:
    return hidden_redaction_store.protect_value(session_id, value)


def hidden_redaction_stats(session_id: str) -> dict[str, Any]:
    return hidden_redaction_store.stats(session_id)


def _session_key(session_id: str) -> str:
    return (session_id or "default").strip() or "default"


def _redact_text_with_mapping(text: str, mapping: _SessionMap) -> str:
    parts: list[str] = []
    cursor = 0
    for start, end, secret in _iter_hidden_spans(text):
        parts.append(text[cursor:start])
        mapping.counter += 1
        placeholder = f"{PLACEHOLDER_PREFIX}{mapping.turn_nonce}_{mapping.counter:04d}{PLACEHOLDER_SUFFIX}"
        mapping.values[placeholder] = secret
        parts.append(placeholder)
        cursor = end
    if cursor == 0:
        return text
    parts.append(text[cursor:])
    return "".join(parts)


def _iter_hidden_spans(text: str):
    marker = "$hidden["
    index = 0
    while True:
        start = text.find(marker, index)
        if start < 0:
            return
        content_start = start + len(marker)
        pos = content_start
        escaped = False
        depth = 0
        while pos < len(text):
            ch = text[pos]
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "[":
                depth += 1
            elif ch == "]":
                if depth == 0:
                    raw = text[content_start:pos]
                    yield start, pos + 1, _unescape_hidden_content(raw)
                    index = pos + 1
                    break
                depth -= 1
            pos += 1
        else:
            return


def _unescape_hidden_content(value: str) -> str:
    result: list[str] = []
    escaped = False
    for ch in value:
        if escaped:
            result.append(ch)
            escaped = False
        elif ch == "\\":
            escaped = True
        else:
            result.append(ch)
    if escaped:
        result.append("\\")
    return "".join(result)


def _hidden_marker(value: str) -> str:
    return "$hidden[" + _escape_hidden_content(value) + "]"


def _escape_hidden_content(value: str) -> str:
    return (value or "").replace("\\", "\\\\").replace("]", "\\]")


def _walk(value: Any, transform_text, mutate: bool) -> Any:
    if isinstance(value, str):
        return transform_text(value)
    if isinstance(value, list):
        target = value if mutate else []
        if mutate:
            for index, item in enumerate(value):
                value[index] = _walk(item, transform_text, mutate=True)
            return value
        for item in value:
            target.append(_walk(item, transform_text, mutate=False))
        return target
    if isinstance(value, dict):
        target = value if mutate else {}
        items = list(value.items())
        for key, item in items:
            new_key = transform_text(key) if isinstance(key, str) else key
            new_value = _walk(item, transform_text, mutate=mutate)
            if mutate:
                if new_key != key:
                    value.pop(key, None)
                value[new_key] = new_value
            else:
                target[new_key] = new_value
        return target
    if isinstance(value, tuple):
        return tuple(_walk(item, transform_text, mutate=False) for item in value)
    if mutate:
        return value
    return copy.deepcopy(value)


def _trailing_placeholder_prefix_len(text: str) -> int:
    max_len = min(len(text), len(PLACEHOLDER_PREFIX) + 32)
    for length in range(max_len, 0, -1):
        suffix = text[-length:]
        if PLACEHOLDER_PREFIX.startswith(suffix) or suffix.startswith(PLACEHOLDER_PREFIX):
            return length
    return 0
