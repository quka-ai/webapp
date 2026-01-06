# ResizableImageTool - 可调整大小的图片工具

这是一个为 Editor.js 开发的自定义图片工具，支持交互式拖拽调整图片大小。

## ✨ 功能特性

- ✅ **交互式调整大小**：拖拽右下角手柄即可调整图片宽度（20% - 100%）
- ✅ **实时预览**：调整时显示当前宽度百分比
- ✅ **数据持久化**：自动保存图片宽度设置
- ✅ **响应式设计**：支持移动端和桌面端
- ✅ **深色模式**：自动适配深色主题
- ✅ **只读模式**：在只读模式下自动隐藏调整手柄
- ✅ **自定义样式**：完全可定制的 CSS 样式系统

## 📦 文件结构

```
src/components/editor/
├── resizable-image-tool.tsx   # 主要功能实现
├── resizable-image-tool.css   # 样式文件
└── RESIZABLE_IMAGE_README.md  # 文档
```

## 🚀 使用方法

### 1. 基础集成

在你的 Editor.js 配置中使用：

```typescript
import EditorJS from '@editorjs/editorjs';
import ResizableImageTool from '@/components/editor/resizable-image-tool';

const editor = new EditorJS({
  tools: {
    image: {
      class: ResizableImageTool,
      config: {
        endpoints: {
          byFile: '/api/upload-image', // 你的上传接口
          byUrl: '/api/fetch-url'
        },
        field: 'image',
        types: 'image/*',
        captionPlaceholder: '图片描述...',
      }
    }
  }
});
```

### 2. 替换现有的 CustomImage

如果你想保留 AI 描述功能，可以修改 `resizable-image-tool.tsx` 继承自 `CustomImage`：

```typescript
// 修改第1行
import CustomImage from './image-tool';

// 修改第22行
export default class ResizableImageTool extends CustomImage {
  // ... 其余代码保持不变
}
```

### 3. 配置选项

支持所有 @editorjs/image 的配置选项：

```typescript
{
  endpoints: {
    byFile: string;      // 文件上传接口
    byUrl: string;       // URL 上传接口
  },
  field: string;         // 表单字段名（默认：'image'）
  types: string;         // 接受的文件类型（默认：'image/*'）
  captionPlaceholder: string; // 标题占位符
  additionalRequestData: object; // 额外请求数据
  additionalRequestHeaders: object; // 额外请求头
  uploader: {            // 自定义上传器
    uploadByFile: (file: Blob) => Promise<any>;
    uploadByUrl: (url: string) => Promise<any>;
  },
  features: {            // 功能开关
    border: boolean;     // 边框
    caption: boolean | 'optional'; // 标题
    stretch: boolean;    // 拉伸
    background: boolean; // 背景
  }
}
```

## 📊 数据格式

### 输入数据

```typescript
{
  file: {
    url: string;       // 图片 URL
  },
  caption: string;     // 图片标题
  withBorder: boolean; // 是否有边框
  withBackground: boolean; // 是否有背景
  stretched: boolean;  // 是否拉伸
  width?: number;      // 图片宽度（百分比，20-100）
}
```

### 输出数据

与输入格式相同，会自动保存 `width` 字段。

## 🎨 样式定制

### 修改调整手柄颜色

编辑 `resizable-image-tool.css`:

```css
.resize-handle {
    background: linear-gradient(135deg, transparent 50%, #your-color 50%);
}
```

### 修改宽度范围

编辑 `resizable-image-tool.tsx` 第 135 行：

```typescript
// 将 20-100 改为你想要的范围
const clampedWidth = Math.max(30, Math.min(90, newWidthPercent));
```

### 自定义图片边框样式

编辑 `resizable-image-tool.css`:

```css
.resizable-image-wrapper.image-tool--withBorder img {
    border: 3px solid #your-color;
    border-radius: 12px;
}
```

## 🔧 高级功能

### 添加宽度预设按钮

可以在 `renderSettings()` 中添加快速宽度设置：

```typescript
renderSettings(): TunesMenuConfig {
  const settings = super.renderSettings();

  return [
    ...settings,
    {
      icon: '25%',
      label: 'Small',
      onActivate: () => this.setWidth(25)
    },
    {
      icon: '50%',
      label: 'Medium',
      onActivate: () => this.setWidth(50)
    },
    {
      icon: '100%',
      label: 'Large',
      onActivate: () => this.setWidth(100)
    }
  ];
}

private setWidth(percent: number): void {
  this.currentWidth = percent;
  if (this.resizeWrapper) {
    this.resizeWrapper.style.width = `${percent}%`;
    this.resizeWrapper.setAttribute('data-width', `${percent}%`);
  }
}
```

### 支持固定像素宽度

如果需要支持像素宽度，修改 `handleResize` 方法：

```typescript
private handleResize = (e: MouseEvent): void => {
  if (!this.isResizing || !this.resizeWrapper) return;

  const deltaX = e.clientX - this.startX;
  const newWidth = this.startWidth + deltaX;

  // 限制最小/最大像素值
  const clampedWidth = Math.max(200, Math.min(1200, newWidth));

  this.currentWidth = clampedWidth;
  this.resizeWrapper.style.width = `${clampedWidth}px`;
};
```

## 🐛 常见问题

### 1. 图片宽度不保存？

确保在编辑器销毁前调用 `save()` 方法：

```typescript
const savedData = await editor.save();
```

### 2. 调整手柄不显示？

检查是否在只读模式下，或者 CSS 文件是否正确导入。

### 3. 样式冲突？

所有样式都使用 `.resizable-image-wrapper` 命名空间，避免与其他样式冲突。如果仍有问题，增加 CSS 选择器优先级：

```css
.codex-editor .resizable-image-wrapper {
  /* 你的样式 */
}
```

## 📝 开发路线图

- [ ] 支持高度调整
- [ ] 支持按住 Shift 等比例缩放
- [ ] 支持双击恢复原始大小
- [ ] 支持裁剪功能
- [ ] 支持旋转功能
- [ ] 添加对齐选项（左对齐、居中、右对齐）

## 📄 许可证

与项目保持一致

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
