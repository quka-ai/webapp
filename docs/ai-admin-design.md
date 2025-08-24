# AI管理功能设计文档

## 项目概述

基于 LLM API Manager API 实现的 AI 模型管理界面，用于管理 AI 模型提供商、模型配置和系统使用配置。

## 功能模块

### 1. 模型提供商管理
- **功能**: 管理 OpenAI、Azure OpenAI 等 API 提供商
- **操作**: 创建、编辑、删除、启用/禁用提供商
- **字段**: 名称、描述、API地址、API密钥、配置参数

### 2. 模型配置管理  
- **功能**: 管理具体模型配置（GPT-4、embedding等）
- **操作**: 创建、编辑、删除、启用/禁用模型配置
- **字段**: 模型名称、显示名称、模型类型、多模态支持、配置参数

### 3. AI系统管理
- **功能**: 系统状态监控和配置重载
- **操作**: 查看系统状态、重载配置、监控各模块状态
- **信息**: 各类型模型数量、最后重载时间

### 4. 使用配置管理
- **功能**: 配置各功能模块使用的模型
- **操作**: 为chat、embedding、vision等功能选择模型
- **配置**: 6个功能模块的模型映射

## 页面结构设计

```
/dashboard/:spaceID/ai-admin/
├── /                    # 主页面(默认跳转到providers)
├── providers            # 提供商管理
├── models              # 模型配置管理  
├── system              # 系统管理
└── usage               # 使用配置
```

## 组件架构设计

```
src/pages/dashboard/ai-admin/
├── ai-admin.tsx                 # 主页面布局和路由
├── providers/
│   ├── providers.tsx           # 提供商列表页
│   ├── provider-form.tsx       # 提供商表单弹窗
│   └── provider-card.tsx       # 提供商卡片
├── models/
│   ├── models.tsx             # 模型配置列表页
│   ├── model-form.tsx         # 模型配置表单弹窗
│   └── model-card.tsx         # 模型配置卡片
├── system/
│   ├── system.tsx             # 系统状态页
│   ├── usage-config.tsx       # 使用配置组件
│   └── status-card.tsx        # 状态卡片
└── components/
    ├── delete-confirm.tsx     # 删除确认弹窗
    ├── status-badge.tsx       # 状态徽章
    └── model-type-badge.tsx   # 模型类型标签
```

## 数据结构设计

### 提供商数据结构
```typescript
interface Provider {
  id: string;
  name: string;
  description: string;
  api_url: string;
  api_key: string;
  status: 0 | 1; // 0=禁用, 1=启用
  config: {
    timeout: number;
    max_retries: number;
    [key: string]: any;
  };
  created_at: number;
  updated_at: number;
}
```

### 模型配置数据结构
```typescript
interface ModelConfig {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  model_type: 'chat' | 'embedding' | 'vision' | 'rerank' | 'reader' | 'enhance';
  is_multi_modal: boolean;
  status: 0 | 1;
  config: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    [key: string]: any;
  };
  created_at: number;
  updated_at: number;
  provider: {
    id: string;
    name: string;
    api_url?: string;
  };
}
```

### 系统状态数据结构
```typescript
interface SystemStatus {
  chat_drivers_count: number;
  embed_drivers_count: number;
  vision_drivers_count: number;
  rerank_drivers_count: number;
  reader_drivers_count: number;
  enhance_drivers_count: number;
  last_reload_time: number;
}
```

### 使用配置数据结构
```typescript
interface UsageConfig {
  chat: string;
  embedding: string;
  vision: string;
  rerank: string;
  reader: string;
  enhance: string;
}
```

## 状态管理设计

### 提供商状态
```typescript
interface ProviderStore {
  providers: Provider[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  filters: {
    name: string;
    status: number | null;
  };
}
```

### 模型配置状态
```typescript
interface ModelStore {
  models: ModelConfig[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  filters: {
    provider_id: string;
    model_type: string;
    status: number | null;
  };
}
```

### 系统状态
```typescript
interface SystemStore {
  status: SystemStatus | null;
  usageConfig: UsageConfig | null;
  loading: boolean;
  error: string | null;
  reloading: boolean;
}
```

## UI设计规范

### 主色调
- 使用项目现有的主题色系
- 状态颜色: 成功(绿色)、警告(黄色)、错误(红色)、禁用(灰色)

### 组件规范
- 使用 HeroUI 组件库
- 响应式设计，支持移动端
- 保持与现有页面一致的设计风格

### 布局规范
- 主导航: Tab 导航，4个主要模块
- 列表展示: 卡片式布局，支持分页
- 表单: 模态框表单，支持验证
- 操作按钮: 主要操作使用 primary 色调

## 权限控制

### 访问权限
- 需要管理员权限才能访问 AI 管理功能
- 使用 JWT Token 进行身份验证
- 在路由层面进行权限检查

### 操作权限
- 所有 CRUD 操作需要管理员权限
- 敏感操作（删除、重载）需要二次确认

## 错误处理

### API 错误处理
- 统一的错误提示机制
- 网络错误重试机制
- 超时处理

### 用户体验
- 友好的错误提示信息
- 操作反馈（加载状态、成功提示）
- 表单验证错误提示

## 性能优化

### 数据加载
- 分页加载数据
- 搜索防抖
- 缓存机制

### 渲染优化
- 虚拟滚动（如果数据量大）
- 组件懒加载
- 状态更新优化

## 国际化支持

### 多语言支持
- 中文、英文界面
- 错误信息本地化
- 日期时间格式化

### 文案规范
- 统一的术语使用
- 清晰的操作提示
- 帮助文档链接