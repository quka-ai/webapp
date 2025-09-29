# Centrifuge WebSocket 迁移计划

## 项目概述
将现有的 FireTower WebSocket 实现迁移到 Centrifuge 实时通信框架。

## 当前实现分析

### 现有架构
- 使用自定义的 FireTower 类包装原生 WebSocket
- 消息格式：嵌套的消息结构 - `FireTowerMsg` 包含 `data.data` 的业务数据
- 频道格式：使用 `/chat_session/{sessionID}` 格式订阅聊天频道
- 连接管理：在 `routes/index.tsx` 中调用 `buildTower` 建立连接
- 消息处理：在聊天组件中处理各种 EventType（ASSISTANT_INIT, ASSISTANT_CONTINUE 等）

### 主要变更点
1. **依赖替换**：`FireTower` → `Centrifuge`
2. **实现框架**：从自定义的 FireTower 实现切换到标准的 Centrifuge 客户端库
3. **消息格式**：保持兼容，但结构更简洁
4. **频道格式**：保持不变，文档中的示例仅为说明用途
5. **EventType数值**：字符串形式（"1", "2" 等）
6. **订阅方式**：从手动订阅改为 Centrifuge 的订阅机制

## 迁移行动项

### 高优先级任务
1. [x] 安装 Centrifuge 依赖包
2. [x] 创建新的 Centrifuge WebSocket 管理类
3. [x] 更新 socket store 以使用 Centrifuge 替代 FireTower  
4. [x] 更新消息格式适配 - 将 FireTowerMsg 格式转换为 Centrifuge 格式
5. [x] 更新聊天组件中的消息处理逻辑
6. [x] 测试验证新的 WebSocket 实现

### 中优先级任务
7. [x] 频道格式保持不变 - 文档示例仅为说明
8. [x] 更新知识库状态监听逻辑  
9. [x] 添加错误处理和自动重连机制
10. [x] 更新 TypeScript 类型定义

### 低优先级任务
11. [x] 移除旧的 FireTower 相关代码

## 技术实现要点

1. **消息兼容性**：服务端已保持消息格式兼容，只需适配 type 字段为字符串
2. **认证方式**：复用现有 JWT Token，无需修改认证逻辑
3. **错误处理**：利用 Centrifuge 的自动重连机制
4. **性能优化**：实现订阅管理器避免重复订阅

## 风险控制

1. **渐进式迁移**：保留原代码作为回退方案
2. **充分测试**：在开发环境验证所有功能正常
3. **监控机制**：密切关注控制台日志和错误报告

## 验收标准

- [ ] 所有聊天功能正常工作
- [ ] 实时消息接收无延迟
- [ ] 断线重连功能正常
- [ ] 知识库状态更新正常
- [ ] 错误处理机制完善
- [ ] 无内存泄漏问题