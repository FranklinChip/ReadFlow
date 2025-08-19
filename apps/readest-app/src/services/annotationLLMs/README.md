# ReadFlow LLM注释功能技术文档

## 功能概述

ReadFlow的LLM注释功能提供了实时的词汇和短语注释，使用大语言模型为英文电子书内容添加中英文对照的ruby标签。该功能基于IntersectionObserver实现了高效的可视区域检测和预取机制。

## 架构设计

### 前后端分离架构

```
前端 (React/TypeScript)
├── 用户界面
├── 状态管理 (Zustand)  
├── DOM操作和ruby标签注入
├── 缓存管理 (IndexedDB/SessionStorage)
└── LLM API调用

后端服务 (外部LLM API)
├── Qwen API
├── 文本分析和注释生成
└── 错误处理和重试
```

### 关键组件

#### 1. Service Layer (`annotationLLMs/`)

**类型定义** (`types.ts`)
- `WordAnnotation`: 单词注释（词汇、词性、中英文翻译）
- `MWEAnnotation`: 多词表达式注释（短语、词根、翻译）
- `ProperNounAnnotation`: 专有名词注释（人名、地名等）
- `AnnotationResponse`: LLM返回的完整注释数据

**缓存系统** (`cache.ts`)
- 双层缓存机制：内存缓存 + IndexedDB持久化
- 缓存键基于文本内容的SHA-256哈希
- 自动过期和容量管理
- 降级到SessionStorage（如果IndexedDB不可用）

**LLM提供商** (`providers/`)
- `qwen.ts`: 通义千问API集成
- `index.ts`: 提供商选择和配置
- 支持多种LLM提供商的扩展架构

#### 2. Core Hook (`useWordsAnnotation.ts`)

**主要功能**
- 使用IntersectionObserver监控可视区域
- 批量处理文本节点注释
- 预取下一批次内容（性能优化）
- 持久化ruby标签（不会被清除）
- 智能重试机制

**性能优化策略**
- 防抖处理：避免频繁的DOM操作
- 分批处理：错开注释请求时间
- 预取机制：提前注释即将进入视野的内容
- 缓存优先：减少LLM API调用

#### 3. Integration (`FoliateViewer.tsx`)

将注释功能集成到主阅读器视图，支持：
- 自动检测电子书内容变化
- 响应用户设置变更
- 与现有wordAnnotation功能兼容

## 技术实现细节

### Ruby标签生成

```typescript
// 按优先级处理：长短语 > 短短语 > 单词
const allItems = [
  ...annotations.mwes.map(mwe => ({ ...mwe, type: 'mwe', text: mwe.phrase })),
  ...annotations.proper_nouns.map(pn => ({ ...pn, type: 'proper_noun', text: pn.word })),
  ...annotations.words.map(word => ({ ...word, type: 'word', text: word.word }))
].sort((a, b) => b.text.length - a.text.length);

// 生成ruby标签
<ruby class="word" lemma="word" pos="NOUN">
  word
  <rt class="en-meaning">English meaning</rt>
  <rt class="zh-meaning">中文含义</rt>
</ruby>
```

### 缓存策略

1. **内存缓存**: 当前会话期间的快速访问
2. **IndexedDB**: 跨会话的持久化存储
3. **降级处理**: 自动切换到SessionStorage
4. **缓存键**: 基于文本内容的哈希值

### 错误处理和重试

```typescript
// 指数退避重试策略
const delay = retryDelay * Math.pow(2, attempts);
await new Promise(resolve => setTimeout(resolve, delay));
```

## API集成

### Qwen API配置

```typescript
const QWEN_API = {
  baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  apiKey: 'YOUR_API_KEY', // 硬编码在代码中
  model: 'qwen-plus',
  timeout: 30000
};
```

### 请求格式

```json
{
  "model": "qwen-plus",
  "input": {
    "messages": [
      {
        "role": "user", 
        "content": "请分析这段英文文本并提供注释..."
      }
    ]
  },
  "parameters": {
    "result_format": "message"
  }
}
```

## 前后端职责分离

### 前端职责

1. **用户交互**
   - 设置管理（启用/禁用注释）
   - 可视化反馈（加载状态、错误提示）

2. **DOM操作**
   - 文本节点遍历和检测
   - Ruby标签注入和管理
   - 可视区域监控

3. **状态管理**
   - 注释状态跟踪
   - 缓存管理
   - 用户偏好设置

4. **性能优化**
   - 批量处理
   - 防抖和节流
   - 预取策略

### 后端职责 (LLM API)

1. **文本分析**
   - 词汇识别和分类
   - 语法分析（词性标注）
   - 多词表达式检测

2. **翻译服务**
   - 中英文对照翻译
   - 上下文相关的含义解释
   - 专业术语处理

3. **智能处理**
   - 语境理解
   - 歧义消解
   - 文化背景解释

## 数据流

```
1. 用户滚动阅读
   ↓
2. IntersectionObserver触发
   ↓
3. 检查缓存 (内存 → IndexedDB)
   ↓
4. 缓存未命中 → 调用LLM API
   ↓
5. 解析API响应
   ↓
6. 生成Ruby标签
   ↓
7. 注入DOM + 更新缓存
   ↓
8. 预取下一批内容
```

## 配置选项

```typescript
interface UseWordsAnnotationOptions {
  provider?: string;        // LLM提供商 ('qwen')
  enabled?: boolean;        // 是否启用注释
  retryAttempts?: number;   // 重试次数 (默认3次)
  retryDelay?: number;      // 重试延迟 (默认1000ms)
  preloadOffset?: number;   // 预取偏移量 (默认2个元素)
}
```

## 扩展性设计

### 支持新的LLM提供商

1. 在 `providers/` 目录下创建新的提供商文件
2. 实现 `AnnotationProvider` 接口
3. 在 `providers/index.ts` 中注册

### 支持新的注释类型

1. 在 `types.ts` 中定义新的注释接口
2. 更新 `AnnotationResponse` 类型
3. 在 `createRubyAnnotations` 中添加处理逻辑

## 性能指标

- **缓存命中率**: 目标 >80%
- **注释延迟**: <2秒（新内容）
- **内存使用**: <50MB（大型书籍）
- **API调用量**: 每段落1次（缓存后零调用）

## 安全考虑

1. **API密钥管理**: 当前硬编码，生产环境需要安全存储
2. **内容过滤**: 避免发送敏感内容到外部API
3. **缓存安全**: 本地缓存数据的隐私保护
4. **错误处理**: 避免敏感信息泄露

## 未来改进

1. **离线支持**: 集成本地NLP模型
2. **个性化**: 基于用户阅读历史的定制注释
3. **多语言**: 支持更多语言对的注释
4. **协作**: 用户贡献的注释数据库
5. **API优化**: 批量请求减少API调用次数
