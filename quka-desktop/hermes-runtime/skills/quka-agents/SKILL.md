---
name: quka-agents
description: "Coordinate multiple QukaAI Desktop Hermes sub agents for parallel or DAG-based specialist work."
version: 0.1.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [quka, quka-ai, agents, collaboration, multi-agent, dag]
    requires_toolsets: [terminal]
---

# QukaAI Multi-Agent Collaboration

Use this skill when a task benefits from several specialist agents working under the current main Hermes session.

Good fits:

- The user asks for multiple roles, reviewers, researchers, writers, critics, engineers, or parallel analysis.
- The task has independent research branches that can run at the same time.
- The task needs a researcher to gather facts and a critic/engineer/writer to evaluate or synthesize.
- The user mentions `@Agent` or asks QukaAI Desktop to delegate work to sub agents.
- The task clearly matches a user-created QukaAI Desktop agent profile, such as a GitHub agent handling milestones, issues, PRs, repositories, releases, or workflows.

You are the coordinator. Sub agents do not reply to the user directly. They run independent sub sessions under the current main session and return structured findings for you to merge into the final answer.

Run the helper from this skill directory:

```bash
python3 "${HERMES_SKILL_DIR}/scripts/quka_agents.py" run-agents --request-json '{"user_request":"...","nodes":[...]}'
```

This helper is QukaAI Desktop product runtime code. You may execute it, but do not edit, overwrite, chmod, delete, or regenerate `scripts/quka_agents.py` or other bundled QukaAI skill files.

`${HERMES_SKILL_DIR}` is a Hermes skill template variable. Hermes replaces it with the absolute skill directory when loading this SKILL.md; do not rewrite it as `$HERMES_SKILL_DIR`, because ordinary terminal shells do not receive a `HERMES_SKILL_DIR` environment variable.

In QukaAI Desktop chat, always use `--request-json` for sub-agent runs. The desktop UI creates one live sub session card per item in `nodes` as soon as the terminal tool starts. Do not use `--request-file` for normal delegated work, because the UI cannot know the N sub agents before the helper process has finished reading the file.

## Request Schema

The request must be a JSON object:

```json
{
  "strategy": "parallel",
  "user_request": "The user's original goal.",
  "coordinator_intent": "Why you are delegating and how you will use the results.",
  "max_parallelism": 4,
  "nodes": [
    {
      "node_id": "research",
      "agent_id": "researcher",
      "task": "Find the relevant facts and uncertainties.",
      "expected_output": "Concise findings with evidence.",
      "depends_on": [],
      "tool_policy": "read_only",
      "context": {
        "important_inputs": ["Only include the context this sub agent needs."]
      }
    },
    {
      "node_id": "critic",
      "agent_id": "critic",
      "task": "Review the research result for gaps and risks.",
      "expected_output": "Risks, counterexamples, and missing checks.",
      "depends_on": ["research"],
      "tool_policy": "read_only"
    }
  ]
}
```

`strategy` can be `parallel` or `dag`. Independent `read_only` or `no_tools` nodes may run in parallel. Nodes with dependencies wait for their `depends_on` results.

## Agent Roles

Built-in role profiles include:

- `researcher`: searches and extracts facts, evidence, and uncertainties.
- `knowledge-analyst`: retrieves and summarizes QukaAI knowledge.
- `journal-analyst`: reads QukaAI journal data and summarizes time ranges or memory candidates.
- `engineer`: inspects code and proposes implementation or fixes.
- `critic`: finds risks, omissions, regressions, and missing tests.
- `writer`: synthesizes material into a polished deliverable.

You may use another `agent_id`; it will run as a generic specialist.

User-created QukaAI Desktop agent profiles are stored in `$HERMES_HOME/agents/profiles.json`.
The main coordinator prompt lists the currently available profiles. When the user's request matches a user-created profile's id, name, description, system prompt, skills, or toolsets, prefer that user-created profile over a generic built-in role. You can target it by setting `agent_id` to the profile id.

## Tool Policies

- `no_tools`: analyze only the provided task context.
- `read_only`: may use Web, QukaAI skills, memory, and non-mutating terminal checks.
- `restricted`: prefer read-only work; use writes or risky commands only if the assigned task requires them.
- `workspace_write`: may write workspace files, but must report paths and avoid destructive operations.

## Coordinator Rules

- Give each sub agent a focused task context. Do not pass the entire chat history unless it is truly required.
- Include private QukaAI knowledge only when relevant. If it contains `__QUKA_HIDDEN_...__` placeholders, preserve them exactly.
- Wait for all sub agent results. Compare results, note disagreement or uncertainty, and then produce the final user-facing response yourself.
- Do not paste raw result JSON as the final answer unless the user explicitly asks for raw diagnostics.
- The helper writes traces to `$HERMES_HOME/agent-runs/<main-session>/<run-id>/`. Mention trace paths only when useful.

## Response Shape

The helper returns JSON:

```json
{
  "ok": true,
  "run_id": "agent-run-...",
  "parent_session_id": "quka-hermes-...",
  "status": "completed",
  "trace_dir": "...",
  "nodes": [
    {
      "node_id": "research",
      "agent_id": "researcher",
      "session_id": "quka-hermes-...:sub:agent-run-...:research",
      "status": "completed",
      "summary": "...",
      "result": "...",
      "trace_path": "..."
    }
  ]
}
```
