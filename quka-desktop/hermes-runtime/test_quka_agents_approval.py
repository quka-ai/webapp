import json
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

HAS_WEBSOCKETS = importlib.util.find_spec("websockets") is not None
if HAS_WEBSOCKETS:
    from quka_hermes_bridge import _assistant_messages_text, build_terminal_command_explanation, configure_desktop_tempdir, is_trusted_quka_agents_command
else:
    _assistant_messages_text = None
    build_terminal_command_explanation = None
    configure_desktop_tempdir = None
    is_trusted_quka_agents_command = None


@unittest.skipUnless(HAS_WEBSOCKETS, "quka_hermes_bridge runtime dependency websockets is not installed")
class QukaAgentsApprovalTest(unittest.TestCase):
    def setUp(self):
        self.previous = os.environ.get("QUKA_HERMES_BUNDLED_SKILLS_DIR")
        self.temp_dir = tempfile.TemporaryDirectory()
        self.skills_dir = Path(self.temp_dir.name) / "skills"
        self.script = self.skills_dir / "quka-agents" / "scripts" / "quka_agents.py"
        self.script.parent.mkdir(parents=True)
        self.script.write_text("# helper\n", encoding="utf-8")
        os.environ["QUKA_HERMES_BUNDLED_SKILLS_DIR"] = str(self.skills_dir)

    def tearDown(self):
        if self.previous is None:
            os.environ.pop("QUKA_HERMES_BUNDLED_SKILLS_DIR", None)
        else:
            os.environ["QUKA_HERMES_BUNDLED_SKILLS_DIR"] = self.previous
        self.temp_dir.cleanup()

    def command(self, request):
        return "python3 {script} run-agents --request-json {payload}".format(
            script=json.dumps(str(self.script)),
            payload=json.dumps(json.dumps(request)),
        )

    def test_accepts_bundled_quka_agents_helper(self):
        ok, reason = is_trusted_quka_agents_command(self.command({
            "user_request": "Check milestones",
            "nodes": [{"node_id": "github", "agent_id": "github-agent", "task": "Read milestones"}],
        }))

        self.assertTrue(ok, reason)

    def test_rejects_non_bundled_helper_path(self):
        other = Path(self.temp_dir.name) / "other" / "quka_agents.py"
        other.parent.mkdir()
        other.write_text("# helper\n", encoding="utf-8")
        command = "python3 {script} run-agents --request-json {payload}".format(
            script=json.dumps(str(other)),
            payload=json.dumps(json.dumps({"nodes": [{"node_id": "n", "agent_id": "a"}]})),
        )

        ok, reason = is_trusted_quka_agents_command(command)

        self.assertFalse(ok, reason)

    def test_rejects_shell_chaining(self):
        command = self.command({"nodes": [{"node_id": "n", "agent_id": "a"}]}) + " && echo unsafe"

        ok, reason = is_trusted_quka_agents_command(command)

        self.assertFalse(ok, reason)

    def test_rejects_unquoted_command_substitution(self):
        command = (
            "python3 {script} run-agents --request-json "
            '{{\"nodes\":[{{\"node_id\":\"n\",\"agent_id\":\"a\",\"task\":\"$(echo unsafe)\"}}]}}'
        ).format(script=json.dumps(str(self.script)))

        ok, reason = is_trusted_quka_agents_command(command)

        self.assertFalse(ok, reason)

    def test_explains_github_cli_commands_for_users(self):
        explanation = build_terminal_command_explanation("gh issue list --repo holdno/edgefn")

        self.assertIn("GitHub CLI", explanation)
        self.assertIn("holdno/edgefn", explanation)
        self.assertIn("issue 列表", explanation)
        self.assertNotIn("风险原因", explanation)
        self.assertNotIn("执行一条本地终端命令", explanation)

    def test_explains_shell_wrapped_github_milestone_command_for_users(self):
        command = (
            'export PATH="/opt/homebrew/bin:$PATH" GH_CONFIG_DIR=/tmp/quka-gh-config; '
            'gh api repos/holdno/edgefn/milestones --jq ".[].title"'
        )
        explanation = build_terminal_command_explanation(command)

        self.assertIn("GitHub API", explanation)
        self.assertIn("holdno/edgefn", explanation)
        self.assertIn("milestone", explanation)
        self.assertIn("项目里程碑", explanation)
        self.assertNotIn("执行一条本地终端命令", explanation)
        self.assertNotIn("调整命令执行环境", explanation)

    def test_explains_destructive_commands_for_users(self):
        explanation = build_terminal_command_explanation("rm -rf /tmp/demo", "Deletes files")

        self.assertIn("删除本地文件或目录", explanation)
        self.assertNotIn("Deletes files", explanation)

    def test_explains_python_inline_github_cli_work(self):
        explanation = build_terminal_command_explanation("python3 -c 'import subprocess; subprocess.run([\"gh\", \"issue\", \"list\"])'")

        self.assertIn("GitHub CLI", explanation)
        self.assertIn("获取或处理", explanation)

    def test_extracts_sub_agent_assistant_messages_as_output(self):
        text = _assistant_messages_text([
            {"role": "user", "content": "task"},
            {"role": "assistant", "content": "I inspected the milestone data."},
            {"role": "tool", "content": "tool result"},
            {"role": "assistant", "content": [{"type": "text", "text": "The next step is triage."}]},
        ])

        self.assertIn("I inspected the milestone data.", text)
        self.assertIn("The next step is triage.", text)
        self.assertNotIn("tool result", text)

    def test_configures_python_tempfile_to_desktop_tmp_dir(self):
        previous_env = {key: os.environ.get(key) for key in ("QUKA_DESKTOP_TMP_DIR", "TMPDIR", "TEMP", "TMP")}
        previous_tempdir = tempfile.tempdir
        desktop_tmp = Path(self.temp_dir.name) / "desktop-tmp"
        try:
            os.environ["QUKA_DESKTOP_TMP_DIR"] = str(desktop_tmp)
            for key in ("TMPDIR", "TEMP", "TMP"):
                os.environ.pop(key, None)
            tempfile.tempdir = None

            configure_desktop_tempdir()

            self.assertEqual(tempfile.gettempdir(), str(desktop_tmp))
            for key in ("TMPDIR", "TEMP", "TMP"):
                self.assertEqual(os.environ.get(key), str(desktop_tmp))
        finally:
            for key, value in previous_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            tempfile.tempdir = previous_tempdir


if __name__ == "__main__":
    unittest.main()
