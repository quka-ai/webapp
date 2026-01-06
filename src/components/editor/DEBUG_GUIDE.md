# ResizableImageTool 调试指南

## 问题：width 字段保存时总是 100

### 调试步骤

#### 1. 打开浏览器控制台

确保打开浏览器的开发者工具（F12），切换到 Console 标签。

#### 2. 观察日志输出

当你进行以下操作时，控制台会输出详细日志：

**添加图片时：**
```
[Instance #1] Constructor called
[Instance #1] Input data: { file: {...}, ... }
[Instance #1] No width data, using default: 100
[Instance #1] Wrapper created with width: 100
```

**拖拽调整大小时：**
```
[Instance #1] Resizing to: 75
[Instance #1] Resizing to: 68
[Instance #1] ✅ Resize stopped, final width: 68
[Instance #1] ✅ savedWidth: 68
```

**保存数据时：**
```
[Instance #1] 💾 save() called
[Instance #1]   - currentWidth: 68
[Instance #1]   - savedWidth: 68
[Instance #1]   - data.width: 68
[Instance #1]   - Full data: { "file": {...}, "width": 68, ... }
```

#### 3. 检查可能的问题

根据日志输出，检查以下几种情况：

##### 情况 1：多个实例被创建

如果你看到多个不同的 Instance ID，说明 EditorJS 创建了多个工具实例：

```
[Instance #1] Constructor called
[Instance #2] Constructor called  ← 问题：为什么创建了两个实例？
```

**可能原因：**
- EditorJS 在内部重新渲染了 Block
- 你的代码多次初始化了 Editor

**解决方案：**
- 确保 Editor 只初始化一次
- 检查是否有热重载导致的重复初始化

##### 情况 2：save() 在调整大小之前被调用

```
[Instance #1] Wrapper created with width: 100
[Instance #1] 💾 save() called  ← 问题：还没调整大小就保存了
[Instance #1]   - currentWidth: 100
```

**可能原因：**
- 你在图片上传后立即保存
- onChange 回调过早触发

**解决方案：**
- 在调整大小后再保存
- 使用防抖（debounce）延迟保存

##### 情况 3：save() 调用了错误的实例

```
[Instance #1] ✅ Resize stopped, final width: 68
[Instance #2] 💾 save() called  ← 问题：保存的是另一个实例
[Instance #2]   - currentWidth: 100
```

**可能原因：**
- EditorJS 创建了新实例
- 旧实例被丢弃但新实例没有同步数据

**解决方案：**
- 检查 EditorJS 的配置
- 确保数据正确传递给新实例

##### 情况 4：data.width 被覆盖

```
[Instance #1] save() called
[Instance #1]   - currentWidth: 68
[Instance #1]   - savedWidth: 68
[Instance #1]   - data.width: 68  ← 这里是正确的
```

但最终提交的数据中 width 还是 100。

**可能原因：**
- save() 返回的数据被其他地方修改了
- 有其他代码覆盖了 width 字段
- EditorJS 的中间件或插件修改了数据

**解决方案：**
- 在保存后立即检查返回的数据
- 搜索项目中是否有修改 width 字段的代码

#### 4. 手动测试流程

执行以下步骤并记录控制台输出：

```javascript
// 1. 打开编辑器页面
// 控制台应该显示：[Instance #X] Constructor called

// 2. 添加一张图片
// 控制台应该显示：[Instance #X] Wrapper created with width: 100

// 3. 拖拽右下角手柄调整大小到约 70%
// 控制台应该显示：
// [Instance #X] Resizing to: 85
// [Instance #X] Resizing to: 78
// [Instance #X] Resizing to: 72
// [Instance #X] ✅ Resize stopped, final width: 70
// [Instance #X] ✅ savedWidth: 70

// 4. 保存数据（调用 editor.save()）
const data = await editor.save();
// 控制台应该显示：
// [Instance #X] 💾 save() called
// [Instance #X]   - currentWidth: 70
// [Instance #X]   - savedWidth: 70
// [Instance #X]   - data.width: 70

// 5. 检查返回的数据
console.log('Final data:', JSON.stringify(data, null, 2));
// 查看 blocks 中的 image block，确认 width 字段
```

#### 5. 常见问题排查

**Q: 为什么拖拽后没有任何日志输出？**

A: 可能是以下原因：
- 拖拽手柄没有显示（检查 CSS 是否正确加载）
- 事件监听器没有绑定（检查 `createResizeHandle` 是否被调用）
- 在只读模式下（检查 `isReadOnly` 的值）

**Q: 为什么 save() 永远不被调用？**

A:
- 检查你的保存逻辑，确保调用了 `editor.save()`
- 检查是否有错误阻止了 save() 的执行

**Q: 为什么有多个实例？**

A:
- EditorJS 可能在特定情况下重新创建 Block
- 这是正常的，但需要确保数据正确传递

#### 6. 添加额外的调试代码

在你的保存逻辑中添加：

```typescript
const data = await editor.save();

// 检查所有图片块
const imageBlocks = data.blocks.filter(b => b.type === 'image');
imageBlocks.forEach((block, index) => {
  console.log(`图片块 ${index + 1}:`, {
    url: block.data.file.url,
    width: block.data.width,
    caption: block.data.caption,
  });

  if (block.data.width === 100 || !block.data.width) {
    console.warn(`⚠️ 图片块 ${index + 1} 的 width 是默认值！`);
  }
});
```

### 下一步

1. 按照上述步骤执行测试
2. 收集所有控制台日志
3. 把日志发给开发者，包括：
   - 完整的操作步骤
   - 所有的 Instance 日志
   - save() 时的完整输出
   - 最终提交的数据

这样我们就能准确定位问题所在！
