# Podcast 前端功能开发计划

## 概述

基于 Podcast API，设计并实现完整的前端播客功能，包括播客列表、详情页和在知识库/日记页面的播客快捷入口。

## 功能需求分析

### 1. Podcast 列表页（PodcastHob）
- **路径**: `/dashboard/:spaceid/podcasts`
- **布局**: 列表形式，一行一个播客
- **显示内容**:
  - 播客标题（可点击）
  - 标签
  - 描述（截断显示）
  - 音频状态（pending/processing/completed/failed）
  - 时长信息
  - 源类型标识（knowledge/journal/rss_digest）
- **交互**:
  - 点击卡片进入详情页
  - 支持按状态、源类型筛选
  - 支持搜索（标题、描述）
  - 重新生成、删除操作（如果已完成）

### 2. Podcast 详情页
- **路径**: `/dashboard/:spaceid/podcasts/:id`
- **布局**: 类似 KnowledgeModal 的全屏展示
- **显示内容**:
  - 标题和描述
  - 标签
  - 音频播放器（完成状态）
  - 状态指示器（处理中/失败）
  - 来源信息
  - 生成时间
- **交互**:
  - 右上角分享按钮（生成分享链接）
  - 重新生成按钮
  - 删除按钮

### 3. PodcastBar 组件
- **位置**: 在知识库详情页和日记详情页的标题上方
- **功能**:
  - 检查是否有关联播客
  - 如果有：显示播客标题和状态，点击跳转到播客详情页
  - 如果没有：显示"生成播客"按钮
  - 生成过程中显示加载状态和进度

## 技术架构设计

### 1. 状态管理（Store）
**文件**: `src/stores/podcast.ts`

使用 Valtio 创建 Podcast Store，包含：
- `podcasts`: 播客列表
- `currentPodcast`: 当前播客详情
- `loading`: 加载状态
- `creatingMap`: 正在创建的播客映射（source_id -> status）
- `pollingMap`: 轮询中的播客映射（id -> interval）

提供方法：
- `loadPodcasts()` - 加载播客列表
- `loadPodcast(id)` - 加载单个播客
- `createPodcast(sourceType, sourceId)` - 创建播客
- `checkPodcastBySource(sourceType, sourceId)` - 根据源检查播客
- `regeneratePodcast(id)` - 重新生成播客
- `deletePodcast(id)` - 删除播客
- `startPolling(id)` - 开始轮询状态
- `stopPolling(id)` - 停止轮询

### 2. API 接口
**文件**: `src/apis/podcast.ts`

封装所有 Podcast API 调用：
- `getPodcasts(spaceId, params)` - 获取播客列表
- `getPodcast(spaceId, id)` - 获取单个播客
- `getPodcastBySource(spaceId, sourceType, sourceId)` - 根据源获取播客
- `createPodcast(spaceId, sourceType, sourceId)` - 创建播客
- `batchCreatePodcasts(spaceId, sourceType, sourceIds)` - 批量创建播客
- `regeneratePodcast(spaceId, id)` - 重新生成播客
- `deletePodcast(spaceId, id)` - 删除播客

### 3. 页面组件

#### 3.1 PodcastBar 组件
**文件**: `src/components/podcast-bar.tsx`

Props:
```typescript
interface PodcastBarProps {
  sourceType: 'knowledge' | 'journal' | 'rss_digest';
  sourceId: string;
  className?: string;
}
```

功能：
- 加载时显示骨架屏
- 检查是否有播客
- 显示播客状态或生成按钮
- 处理创建流程和轮询

#### 3.2 PodcastList 页面
**文件**: `src/pages/dashboard/podcast/podcasts.tsx`

功能：
- 播客列表展示
- 筛选和搜索
- 卡片点击跳转
- 批量操作

#### 3.3 PodcastDetail 页面
**文件**: `src/pages/dashboard/podcast/[id].tsx`

功能：
- 播客详情展示
- 音频播放
- 分享功能
- 重新生成和删除

### 4. 路由配置
**文件**: `src/routes/index.tsx`

添加路由：
```typescript
{
  path: '/dashboard/:spaceid/podcasts',
  element: <PodcastList />
},
{
  path: '/dashboard/:spaceid/podcasts/:id',
  element: <PodcastDetail />
}
```

## 数据流设计

### 1. 播客创建流程

```
用户点击"生成播客"
    ↓
调用 createPodcast API
    ↓
返回 pending 状态的播客
    ↓
保存到 creatingMap
    ↓
开始轮询（每5秒）
    ↓
检查播客状态
    ↓
更新 UI 显示
    ↓
完成或失败时停止轮询
```

### 2. 详情页访问流程

```
用户点击播客列表项
    ↓
导航到 /dashboard/:spaceid/podcasts/:id
    ↓
PodcastDetail 组件加载
    ↓
调用 getPodcast API
    ↓
显示播客详情
    ↓
音频播放器加载（如果已完成）
```

### 3. PodcastBar 检查流程

```
PodcastBar 组件挂载
    ↓
调用 getPodcastBySource
    ↓
有播客 → 显示播客信息和跳转按钮
    ↓
无播客 → 显示"生成播客"按钮
    ↓
用户点击生成 → 创建播客并开始轮询
```

## UI/UX 设计要点

### 1. 状态指示
- **Pending**: 橙色图标，显示"等待中"
- **Processing**: 蓝色加载动画，显示"生成中..."
- **Completed**: 绿色图标，显示音频时长
- **Failed**: 红色图标，显示"生成失败"和重试按钮

### 2. 音频播放器
- 使用原生 HTML5 `<audio>` 标签
- 自定义样式匹配应用主题
- 支持播放速度调节
- 显示播放进度和总时长

### 3. 加载状态
- 列表页：骨架屏加载
- 详情页：骨架屏 + 顶部进度条
- PodcastBar：紧凑型骨架屏

### 4. 错误处理
- API 错误：Toast 提示
- 音频加载失败：显示错误提示和重试按钮
- 网络异常：显示离线提示

## 国际化支持

需要添加的文案：
- "Podcast" → "播客"
- "Generate Podcast" → "生成播客"
- "Generating..." → "生成中..."
- "Regenerate" → "重新生成"
- "Delete" → "删除"
- "Share" → "分享"
- "Audio Duration" → "音频时长"
- "Source" → "来源"
- "Status" → "状态"
- "Created At" → "创建时间"
- "Retry" → "重试"

## 性能优化

### 1. 列表分页
- 默认每页 20 条
- 滚动加载更多
- 虚拟滚动（如果需要）

### 2. 音频优化
- 预签名 URL 缓存
- 音频预加载（hover 时）
- 懒加载音频元素

### 3. 轮询优化
- 只在用户可见时轮询
- 页面隐藏时暂停轮询
- 完成后自动停止轮询
- 5 分钟超时机制

## 安全考虑

### 1. 权限控制
- 只允许有编辑权限的用户创建/删除播客
- 播客详情页需要验证访问权限

### 2. URL 安全
- 分享链接使用随机 token
- 定期过期和刷新机制

## 测试计划

### 1. 单元测试
- Store 方法测试
- API 接口测试
- 组件渲染测试

### 2. 集成测试
- 播客创建流程测试
- 轮询机制测试
- 音频播放测试

### 3. E2E 测试
- 完整用户流程测试
- 跨页面跳转测试
- 错误场景测试

## 开发优先级

### 阶段一：核心功能（高优先级）
1. 创建 podcast store 和 API
2. 实现 PodcastBar 组件
3. 集成到知识库和日记页面

### 阶段二：列表和详情（中优先级）
1. 实现 PodcastList 页面
2. 实现 PodcastDetail 页面
3. 添加路由配置

### 阶段三：增强功能（低优先级）
1. 批量操作
2. 高级筛选
3. 性能优化
4. 详细测试

## 潜在风险和解决方案

### 1. 轮询性能问题
- **风险**: 大量播客同时生成时，频繁轮询可能影响性能
- **解决**: 实现指数退避算法，页面隐藏时暂停轮询

### 2. 音频 URL 过期
- **风险**: 预签名 URL 过期导致音频无法播放
- **解决**: 定期刷新 URL，播放前检查有效性

### 3. 状态同步问题
- **风险**: 多标签页间状态不同步
- **解决**: 使用 WebSocket 实时更新或定期同步

### 4. 大量数据渲染
- **风险**: 播客列表过多时渲染性能问题
- **解决**: 实现虚拟滚动或分页加载

## 后续扩展

### 1. 播客播放列表
- 支持添加多个播客到播放列表
- 连续播放功能

### 2. 播客分类和标签管理
- 用户自定义分类
- 标签过滤和搜索

### 3. 播客播放统计
- 播放次数统计
- 完播率分析

### 4. 播客订阅和通知
- 新播客生成时通知用户
- 播客更新提醒

---

## 总结

本计划详细描述了 Podcast 前端功能的完整实现方案，包括架构设计、数据流、UI/UX 设计和开发优先级。实施时建议按阶段进行，先实现核心功能，再逐步添加增强特性。
