# Hermes 对话轮次结束态修复计划

## 问题描述和背景

Wails 客户端使用本地集成的 Hermes Agent 时，出现 chat 实际仍在执行工具或后续步骤，但输入框中的 AI response 状态已经结束、发送按钮提前恢复可点击的问题。

当前状态链路里，Hermes bridge 主要发送 `message.start`、`message.delta`、`message.complete`、`tool.start`、`tool.complete` 等事件；Wails Go 层把 `message.complete` 同时映射为 assistant done 和 turn done；前端 desktop 模式还会在 assistant/tool/agent 单条消息结束后通过 idle 判断关闭 `hermesTurnActive`。这会把“某段 assistant 文本结束”误当成“整轮 Hermes turn 结束”。

## 改造目标

- 将 assistant message 结束态和 Hermes turn 结束态分离。
- 只有 bridge 明确发出整轮完成事件时，前端才关闭输入框的生成中状态。
- 工具、sub-agent、terminal 的完成/失败状态仍独立展示。
- 避免通过短延迟 idle 猜测提前解锁输入框。

## 实施方案

1. 在 `quka-desktop/hermes-runtime/quka_hermes_bridge.py` 的 `_run_turn` 末尾新增 `turn.complete` 事件。
2. 在 `quka-desktop/hermes.go` 中：
   - `message.complete` 只负责 assistant done/failed。
   - 新增 `turn.complete` case，映射为 `eventTurnDone`。
   - `error` 事件只补发 assistant failed，不再直接结束 turn。
3. 在 `src/pages/dashboard/chat/chat-session.tsx` 中：
   - desktop 模式下不再通过 `settleHermesTurnIfIdle` 关闭 `hermesTurnActive` 和 `aiTyping`。
   - 保留关闭 streaming indicator 的行为。
   - `EVENT_TURN_DONE` 仍是唯一关闭 Hermes turn 的入口。
4. 增加 Go 单元测试覆盖：
   - `message.complete` 不再清理 turn。
   - `turn.complete` 才发 turn done。

## 关键考虑点

- `message.complete` 仍需要保留，因为它决定 assistant 消息卡片是否 success/failed。
- `turn.complete` 需要放在 `_run_turn` 的 `finally` 尾部，覆盖成功、失败、中断和 fake agent 模式。
- 对旧 bridge 二进制，如果不包含 `turn.complete`，desktop turn 状态会等待更久；实际发布应同步构建 bridge runtime。

## 时间线和状态追踪

- 2026-09-07：定位 Wails/Hermes 状态映射问题并实施修复。

## 需要确认的问题

- 是否需要在后续版本增加 bridge protocol version，用于前端/Go 层兼容旧 bridge 事件语义。

## 相关文件列表

- `quka-desktop/hermes-runtime/quka_hermes_bridge.py`
- `quka-desktop/hermes.go`
- `quka-desktop/hermes_test.go`
- `src/pages/dashboard/chat/chat-session.tsx`
