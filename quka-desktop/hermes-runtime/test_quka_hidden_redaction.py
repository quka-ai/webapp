import unittest
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from quka_hidden_redaction import (
    HiddenRedactionStore,
    HiddenStreamRestorer,
    PLACEHOLDER_PREFIX,
)


class HiddenRedactionTest(unittest.TestCase):
    def test_redacts_and_restores_hidden_text(self):
        store = HiddenRedactionStore()
        store.begin_turn("s1")

        redacted = store.redact_text("s1", "phone: $hidden[13800138000]")

        self.assertIn(PLACEHOLDER_PREFIX, redacted)
        self.assertNotIn("13800138000", redacted)
        self.assertEqual(store.restore_text("s1", redacted), "phone: 13800138000")
        self.assertEqual(store.protect_text("s1", redacted), "phone: $hidden[13800138000]")

    def test_redacts_nested_structures_in_place(self):
        store = HiddenRedactionStore()
        store.begin_turn("s1")
        payload = [{"role": "tool", "content": [{"type": "text", "text": "$hidden[secret]"}]}]

        out = store.redact_value("s1", payload)

        self.assertIs(out, payload)
        self.assertIn(PLACEHOLDER_PREFIX, payload[0]["content"][0]["text"])
        self.assertEqual(store.restore_value("s1", payload)[0]["content"][0]["text"], "secret")

    def test_supports_escaped_brackets(self):
        store = HiddenRedactionStore()
        store.begin_turn("s1")

        redacted = store.redact_text("s1", r"value=$hidden[a\]b]")

        self.assertEqual(store.restore_text("s1", redacted), "value=a]b")

    def test_stream_restorer_buffers_split_placeholders(self):
        store = HiddenRedactionStore()
        store.begin_turn("s1")
        redacted = store.redact_text("s1", "$hidden[secret]")
        first = redacted[:8]
        second = redacted[8:]
        restorer = HiddenStreamRestorer("s1", store)

        self.assertEqual(restorer.push_pair(first), ("", ""))
        self.assertEqual(restorer.push_pair(second), ("secret", "$hidden[secret]"))
        self.assertEqual(restorer.flush_pair(), ("", ""))

    def test_stream_restorer_keeps_provider_safe_history_for_all_splits(self):
        store = HiddenRedactionStore()
        store.begin_turn("s1")
        redacted = store.redact_text("s1", "before $hidden[secret] after")

        for split_size in range(1, len(redacted)):
            restorer = HiddenStreamRestorer("s1", store)
            display_parts = []
            protected_parts = []
            for index in range(0, len(redacted), split_size):
                display, protected = restorer.push_pair(redacted[index:index + split_size])
                display_parts.append(display)
                protected_parts.append(protected)
            display, protected = restorer.flush_pair()
            display_parts.append(display)
            protected_parts.append(protected)
            self.assertEqual("".join(display_parts), "before secret after")
            self.assertEqual("".join(protected_parts), "before $hidden[secret] after")


if __name__ == "__main__":
    unittest.main()
