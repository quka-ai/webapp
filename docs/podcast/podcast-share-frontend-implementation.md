# Podcast 分享功能前端实现文档

## 概述
基于后端设计文档，已完成 Podcast 分享功能的前端实现。

## 实施日期
2025-12-19

## 实现内容

### 1. API 接口对接 (`src/apis/share.ts`)

#### 1.1 创建 Podcast 分享链接
```typescript
export async function CreatePodcastShareURL(
    spaceID: string,
    embeddingURL: string,
    podcastID: string
): Promise<CreatePodcastShareURLResponse>
```
- **对接后端接口**: `POST /api/v1/space/:spaceid/podcast/share`
- **请求参数**:
  - `embedding_url`: 嵌入页面 URL（格式：`{origin}/s/p/{token}`）
  - `podcast_id`: Podcast ID
- **返回数据**:
  - `token`: 分享 token
  - `url`: 完整的分享 URL

#### 1.2 获取分享的 Podcast 信息
```typescript
export async function GetSharedPodcast(token: string): Promise<SharedPodcast>
```
- **对接后端接口**: `GET /api/v1/share/podcast/:token`
- **返回数据**: 包含用户信息、Podcast 完整信息和嵌入 URL

### 2. 分享页面组件 (`src/pages/podcast-share.tsx`)

#### 2.1 主要功能
- ✅ 通过 URL token 参数获取分享内容
- ✅ 显示分享者信息（头像、用户名）
- ✅ 音频播放器（支持已完成的 Podcast）
- ✅ 显示 Podcast 详细信息
- ✅ 状态展示（pending/processing/completed/failed）
- ✅ 响应式设计，支持移动端

#### 2.2 页面结构
```
- Header（Logo + 返回按钮）
- Main Content
  - Podcast 标题和状态
  - 音频播放器（根据状态显示不同内容）
  - 分享者信息卡片
  - 描述内容
  - 标签列表
  - 详细信息（TTS 提供商、模型、创建时间等）
  - 页脚说明
```

#### 2.3 状态处理
- **Loading**: 显示 Skeleton 加载动画
- **Error**: 显示错误提示
- **Pending**: 显示等待处理图标
- **Processing**: 显示生成中动画和提示
- **Failed**: 显示失败错误信息
- **Completed**: 显示完整音频播放器

### 3. 路由配置 (`src/routes/index.tsx`)

添加了新的公开分享路由：
```typescript
{
    path: '/s/p/:token', // /share/podcast
    element: <PodcastSharePage />
}
```

**URL 格式**: `https://yourdomain.com/s/p/{token}`
- 与其他分享类型保持一致（knowledge: `/s/k/`, session: `/s/s/`, space: `/s/sp/`）
- 无需登录即可访问

### 4. Podcast 详情页更新 (`src/pages/dashboard/podcast/[id].tsx`)

#### 4.1 修复分享功能
- **修改前**: 使用错误的 `CreateKnowledgeShareURL` API
- **修改后**: 使用正确的 `CreatePodcastShareURL` API

#### 4.2 分享按钮
- 位置：页面右上角标题区域
- 权限：仅 Pro 用户可见
- 条件：仅在 Podcast 状态为 `completed` 时显示
- 功能：点击生成分享链接，显示分享对话框

```typescript
{userIsPro && podcast.status === 'completed' && (
    <ShareButton genUrlFunc={getShareUrlFunc} text={t('Share')} />
)}
```

### 5. 国际化支持 (`src/lib/i18n/`)

#### 5.1 新增翻译键（所有语言文件）

**英文 (en.json)**:
```json
{
    "SharedBy": "Shared by",
    "UserID": "User ID",
    "ShareFailed": "Failed to create share link",
    "PodcastSharedFooter": "This podcast was shared with you. Sign up to create your own podcasts!"
}
```

**中文 (zh.json)**:
```json
{
    "SharedBy": "分享者",
    "UserID": "用户ID",
    "ShareFailed": "创建分享链接失败",
    "PodcastSharedFooter": "这是与您分享的播客。注册以创建您自己的播客！"
}
```

**日文 (ja.json)**:
```json
{
    "SharedBy": "共有者",
    "UserID": "ユーザーID",
    "ShareFailed": "共有リンクの作成に失敗しました",
    "PodcastSharedFooter": "このポッドキャストはあなたと共有されました。サインアップして自分のポッドキャストを作成しましょう！"
}
```

## 技术特性

### 1. 用户体验
- 🎨 使用 HeroUI 组件库保持界面一致性
- 📱 响应式设计，支持各种屏幕尺寸
- ⚡ Skeleton 加载动画提升体验
- 🔄 错误处理和友好提示
- 🎵 原生 HTML5 音频播放器

### 2. 安全性
- ✅ 公开访问分享页面（无需登录）
- ✅ 创建分享链接需要登录和 Pro 权限
- ✅ 只有完成的 Podcast 才能分享
- ✅ Token 过期由后端控制（7天有效期）

### 3. 一致性
- ✅ 与现有分享功能（Knowledge、Session、Space）保持相同的设计模式
- ✅ URL 结构统一：`/s/{type}/{token}`
- ✅ 使用相同的 ShareButton 组件
- ✅ 错误处理遵循项目规范

## 使用流程

### 创建分享链接
1. 用户在 Podcast 详情页点击"分享"按钮（需要 Pro 权限）
2. 系统调用 `CreatePodcastShareURL` API
3. 后端生成 token 并返回完整的分享 URL
4. 显示分享对话框，用户可以复制链接

### 访问分享页面
1. 访问者打开分享链接 `/s/p/{token}`
2. 前端调用 `GetSharedPodcast` API 获取数据
3. 显示 Podcast 内容和播放器
4. 用户可以直接播放音频（如果已完成）

## 相关文件

### 新增文件
- `src/pages/podcast-share.tsx` - Podcast 分享页面组件

### 修改文件
- `src/apis/share.ts` - 添加 Podcast 分享相关 API
- `src/routes/index.tsx` - 添加分享页面路由
- `src/pages/dashboard/podcast/[id].tsx` - 修复分享按钮 API 调用
- `src/lib/i18n/en/en.json` - 英文翻译
- `src/lib/i18n/zh/zh.json` - 中文翻译
- `src/lib/i18n/ja/ja.json` - 日文翻译

## 测试建议

### 功能测试
1. ✅ 在 Podcast 详情页创建分享链接（Pro 用户）
2. ✅ 复制分享链接并在新窗口打开
3. ✅ 验证分享页面显示正确的内容
4. ✅ 测试音频播放功能
5. ✅ 测试不同 Podcast 状态的显示

### 边界测试
1. ⚠️ 测试无效 token 的处理
2. ⚠️ 测试过期 token 的处理
3. ⚠️ 测试非 Pro 用户访问分享按钮
4. ⚠️ 测试未完成 Podcast 的分享按钮显示

### 响应式测试
1. 📱 测试移动端布局
2. 💻 测试桌面端布局
3. 📐 测试不同分辨率下的显示效果

## 后续优化建议

### 功能增强
1. 添加社交媒体分享按钮（Twitter、Facebook、LinkedIn 等）
2. 支持嵌入代码生成（iframe 嵌入）
3. 添加下载按钮（允许下载音频文件）
4. 支持分享预览图（Open Graph、Twitter Card）

### 用户体验
1. 添加播放进度记录（localStorage）
2. 支持播放速度调节
3. 添加评论功能
4. 支持点赞/收藏

### 分析统计
1. 记录分享链接访问次数
2. 统计音频播放次数
3. 分析用户行为数据

## 与后端接口对照

| 功能 | 前端调用 | 后端接口 | 状态 |
|------|---------|---------|------|
| 创建分享链接 | `CreatePodcastShareURL` | `POST /space/:spaceid/podcast/share` | ✅ 已实现 |
| 获取分享内容 | `GetSharedPodcast` | `GET /share/podcast/:token` | ✅ 已实现 |
| 访问分享页面 | 路由 `/s/p/:token` | `GET /s/p/:token` | ✅ 已实现 |

## 注意事项

1. **权限控制**: 只有 Pro 用户才能创建分享链接
2. **状态检查**: 只有 `completed` 状态的 Podcast 才能分享
3. **错误处理**: 所有 API 调用都有完善的错误处理
4. **用户反馈**: 使用 toast 提示用户操作结果
5. **默认头像**: 如果用户没有头像，使用 vercel.sh 生成默认头像

## 总结

Podcast 分享功能已完全实现，包括：
- ✅ API 接口对接
- ✅ 分享页面开发
- ✅ 路由配置
- ✅ 详情页集成
- ✅ 国际化支持

功能完整，代码规范，与现有系统无缝集成。
