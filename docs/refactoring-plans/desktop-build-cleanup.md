# Desktop 构建目录清理修复计划

## 问题描述和背景

执行 `npm run build:desktop` 时，前端资源复制成功后进入 Wails 构建阶段，可能出现 `rm: build/bin: Directory not empty`，随后脚本报告 `Wails 应用构建失败`。该问题集中在桌面构建产物目录 `quka-desktop/build/bin` 的清理流程。

## 改造目标和步骤

1. 复现并确认失败阶段。
2. 保留脚本中已有的 `remove_build_path build/bin` 清理逻辑。
3. 避免 Wails `-clean` 再次清理同一目录，降低重复清理导致的目录残留/竞态风险。
4. 运行 `scripts/build-desktop.sh` 验证桌面构建。

## 详细实施方案

- 修改 `quka-desktop/build.sh`，将 `wails build -clean -platform "$PLATFORM"` 调整为 `wails build -platform "$PLATFORM"`。
- 由脚本显式调用的 `remove_build_path build/bin` 负责构建前清理，保留权限修复、`.DS_Store` 删除和兜底 `rmdir`。

## 关键考虑点

- 不改变构建架构参数和产物路径。
- 不影响前端 beta 构建、资源复制、Hermes runtime 打包和图标更新流程。
- 构建目录清理仍在 Wails 编译前执行。

## 时间线和状态追踪

- [x] 完成问题定位。
- [x] 编写计划文档。
- [x] 调整 Wails 构建清理参数。
- [x] 运行桌面构建验证：`bash scripts/build-desktop.sh` 成功生成 universal macOS 应用。

## 需要确认的问题

暂无。

## 相关文件列表

- `quka-desktop/build.sh`
- `scripts/build-desktop.sh`
