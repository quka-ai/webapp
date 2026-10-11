# BlockNote 列表输入法错位修复计划

## 问题描述和背景

在 BlockNote 编辑器的列表模式中，用户换行、缩进后使用中文输入法输入内容时，输入法确认后会出现拼音残留在当前列表项，而中文内容被插入到新列表项的问题。截图现象显示 composition 中间文本和最终提交文本被拆到了不同的行。

## 改造目标和步骤

1. 在编辑器层记录输入法 composition 状态。
2. composition 期间暂停外部 `onValueChange` 回写，避免父组件用临时拼音内容触发 `replaceBlocks`。
3. composition 结束后刷新一次最终内容，确保保存的是中文落定后的文档。
4. 阻止紧随 composition 结束的确认 Enter 再次触发 BlockNote 列表拆分。
5. 使用现有构建命令验证 TypeScript 和 Vite 构建。

## 详细实施方案

- 在 `src/components/blocknote-editor/index.tsx` 中增加 composition 状态引用。
- 通过 BlockNote 的 `_tiptapOptions.editorProps.handleDOMEvents` 监听 `compositionstart`、`compositionend` 和 `keydown`。
- 在 `onChange` 中，如果仍处于 composition，取消已有 debounce 并标记待刷新；等 `compositionend` 后再调度保存。
- 对 composition 后短时间内的 `Enter` 键做一次性吞掉，避免输入法确认键被列表快捷键处理。
- 二次修复中补充 `beforeinput` 结构性输入拦截，并在 composition 活跃时阻止 BlockNote/ProseMirror keymap 接管确认键，同时保留输入法默认落字。
- 三次修复中针对“第一次换行后的第一次输入”补充空 inline block 的零宽文本锚点，解决 Wails/WebKit 在只有 trailing break 的空节点上无法稳定承载输入法 composition 的问题。
- 四次修复中将锚点从 `compositionstart` 改为普通 `Enter` 和后续空块变更完成后预置，避免在 IME 已经开始选择目标节点时修改 ProseMirror 文档；同时取消 composition 期间的 `keydown`/`beforeinput` 强拦截，让 ProseMirror 自带的 Safari composition 防护继续生效。保存时只对输出数据做锚点清洗，不提前删除编辑器中的预置锚点。该路径同时覆盖换行后再按 `Tab` 缩进、或空块被转换为引用块后才开始第一次中文输入的场景。

## 关键考虑点

- 不改变列表、缩进、普通输入的现有行为。
- 不在 composition 中调用 `replaceBlocks` 或 `updateBlock` 这类会改变 ProseMirror 文档结构的操作。
- 保留现有 500ms debounce，避免扩大自动保存频率。

## 时间线和状态追踪

- [x] 完成问题定位。
- [x] 编写计划文档。
- [x] 实施编辑器修复。
- [x] 运行构建验证：`npm run build` 被仓库既有 TypeScript 错误阻断；针对本次修改文件过滤后没有新增 `src/components/blocknote-editor/index.tsx` 报错，单文件 eslint 无错误。
- [x] 根据用户复测反馈完成二次修复，扩大到 composition 期间 keymap 与 `beforeinput` 的结构性换行拦截。
- [x] 根据“只在第一次换行后的第一次输入出现”继续完成三次修复，加入空 block composition 锚点与保存前清理。
- [x] 根据用户再次复测反馈完成四次修复，改为 Enter/缩进/空块转换后提前预置锚点，并收窄自定义事件拦截。

## 需要确认的问题

暂无。该修复按截图和现有代码路径判断，优先处理中文输入法确认 Enter 与 composition 临时内容回写的交叉问题。

## 相关文件列表

- `src/components/blocknote-editor/index.tsx`
- `docs/refactoring-plans/blocknote-ime-list-composition.md`
