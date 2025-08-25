# 注释状态集成文档

## 📋 概述

本文档描述了 `useWordsAnnotation` 和 `useUnknownWordDisplay` 之间的状态更新集成机制。

## 🔧 集成机制

### 1. **useWordsAnnotation 提供状态回调**

```typescript
// useWordsAnnotation.ts 新增功能
const registerStatusUpdateCallback = useCallback((callback: () => void) => {
  statusUpdateCallbacksRef.current.add(callback);
  
  // 返回取消注册的函数
  return () => {
    statusUpdateCallbacksRef.current.delete(callback);
  };
}, []);

const triggerStatusUpdate = useCallback(() => {
  console.log('🔄 Triggering annotation status update callbacks');
  statusUpdateCallbacksRef.current.forEach(callback => {
    try {
      callback();
    } catch (error) {
      console.error('Error in status update callback:', error);
    }
  });
}, []);
```

### 2. **每个节点注释完成时触发状态更新**

```typescript
// 在 annotateElement 函数中，每个节点处理完成后
if (enabledRef.current && processedHTML !== text) {
  el.innerHTML = processedHTML;
  // ... 其他处理
  
  // 新增：单个节点注释完成后立即触发状态更新
  triggerStatusUpdate();
} else {
  // 即使没有注释变化，也触发状态更新以确保CSS分类正确
  triggerStatusUpdate();
}
```

### 3. **useUnknownWordDisplay 监听状态变化**

```typescript
// useUnknownWordDisplay.ts 已有功能
useEffect(() => {
  if (registerStatusUpdateCallback) {
    const unregister = registerStatusUpdateCallback(() => {
      console.log('📊 Chapter annotation status changed, reapplying CSS');
      processDocuments();
    });
    
    return unregister;
  }
  
  return undefined;
}, [registerStatusUpdateCallback, processDocuments]);
```

## 🚀 使用方式

### 在父组件中集成

```typescript
function ReaderComponent() {
  const wordsAnnotation = useWordsAnnotation(bookKey, view);
  
  const unknownWordDisplay = useUnknownWordDisplay(
    bookKey, 
    view,
    wordsAnnotation.registerStatusUpdateCallback // 传入状态回调注册函数
  );
  
  return <div>...</div>;
}
```

## 📊 工作流程

1. **注释开始**: `useWordsAnnotation` 开始处理单个文本节点
2. **注释进行中**: 单个节点正在处理（LLM调用、token匹配等）
3. **节点注释完成**: 单个节点处理完成，HTML更新
4. **状态更新**: 立即触发 `triggerStatusUpdate()` 
5. **CSS重新应用**: `useUnknownWordDisplay` 收到回调，执行 `processDocuments()`
6. **单词分类**: 重新分类当前文档中的已知/未知单词，应用正确的CSS样式
7. **继续处理**: 处理下一个节点，重复步骤1-6

## 🎯 优势

- ✅ **实时更新**: 每个节点注释完成后立即更新CSS
- ✅ **即时反馈**: 用户可以立即看到单词分类效果
- ✅ **避免等待**: 不需要等待整个章节完成才看到效果
- ✅ **性能平衡**: 在实时性和性能之间找到平衡点

## 🔍 调试日志

- `🔄 Triggering annotation status update callbacks` - 每个节点完成后的状态更新触发
- `📊 Chapter annotation status changed, reapplying CSS` - CSS重新应用
- `✅ Annotation completed for element: "..."` - 单个节点注释完成

## 📝 注意事项

- 回调函数会在**每个节点**注释完成后触发
- 支持多个回调函数注册
- 自动处理回调函数的注册和取消注册
- 错误处理确保单个回调失败不影响其他回调
- **频率控制**: 每个节点都会触发，需要确保CSS应用操作足够高效
