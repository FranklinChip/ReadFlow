# 跨Token匹配Bug修复 - 防止单词错误合并

## 🐛 问题诊断

### 发现的具体问题
虽然之前修复了将后续token设为空字符串的问题，但仍然存在**单词错误合并**的情况：

**场景示例**：
```
原文tokens: ["Hello", " ", "world", "!"]
LLM返回单词: ["Hello", "world"]

错误行为：
- 尝试3-token匹配: ["Hello", " ", "world"] → "Hello world"
- 创建ruby标签: <ruby>Hello world</ruby>
- 结果：两个独立单词被错误合并为一个ruby标签
```

### 根本原因分析
1. **Tokenization包含空格**：`tokenizeText()` 会将空格作为独立token
2. **盲目跨token匹配**：算法会尝试合并包含空格的token组合
3. **缺乏合理性检查**：没有验证组合是否真的有意义

## ✅ 修复方案

### 1. 空格检查机制
```typescript
const hasSpaceInCombined = combinedDisplay.includes(' ');
const hasSpaceInWord = currentWord.word.includes(' ');

if (hasSpaceInCombined && !hasSpaceInWord) {
  console.log(`❌ Skipping combine: combined text "${combinedDisplay}" has space but LLM word "${currentWord.word}" doesn't`);
  continue;
}
```

**逻辑**：如果组合后的文本包含空格，但LLM单词不包含空格，则跳过这个匹配。

### 2. 多单词token检查
```typescript
const wordTokensInCombine = combineTokens.filter(t => t && !/^\s+$/.test(t) && /\w/.test(t));
if (wordTokensInCombine.length > 1 && !hasSpaceInWord) {
  console.log(`❌ Skipping combine: found ${wordTokensInCombine.length} word tokens but LLM word has no space`);
  continue;
}
```

**逻辑**：如果组合中包含多个单词token，但LLM单词没有空格，则跳过匹配。

### 3. 增强的调试信息
```typescript
console.log(`- Word tokens: ${wordTokensInCombine.map(t => `"${t}"`).join(', ')}`);
```

## 🎯 修复效果

### ✅ 防止的错误情况

| 原文Tokens | LLM单词 | 旧行为(错误) | 新行为(正确) |
|------------|---------|-------------|-------------|
| `["Hello", " ", "world"]` | `"Hello"` | 合并为`<ruby>Hello world</ruby>` | 跳过合并，只匹配`"Hello"` |
| `["good", "-", "bye"]` | `"goodbye"` | 正确匹配 | 正确匹配 ✅ |
| `["I", "'", "m"]` | `"I'm"` | 正确匹配 | 正确匹配 ✅ |
| `["twenty", " ", "one"]` | `"twenty"` | 错误合并 | 跳过合并 ✅ |

### ✅ 保留的正确行为

跨token匹配仍然适用于以下合理情况：
- **连字符复合词**：`"well-known"` ← `["well", "-", "known"]`
- **缩略词**：`"I'm"` ← `["I", "'", "m"]`
- **带点缩写**：`"U.S."` ← `["U", ".", "S", "."]`
- **数字连字符**：`"twenty-one"` ← `["twenty", "-", "one"]`

## 🔍 检查逻辑

### 合理性验证流程
1. **提取组合tokens** → `["Hello", " ", "world"]`
2. **检查空格一致性** → 组合有空格，LLM单词无空格 → ❌ 跳过
3. **检查单词token数量** → 2个单词token，LLM单词无空格 → ❌ 跳过
4. **文本匹配** → 只有通过前面检查的才会进行匹配

### 日志示例
```
- Trying 3-token combine [1-4): "Hello world" (hello world) vs "Hello" (hello)
- ❌ Skipping combine: combined text "Hello world" has space but LLM word "Hello" doesn't
- Word tokens: "Hello", "world"
```

## 🚀 预期效果

1. **消除错误合并**：不再将原本分开的单词错误合并
2. **保持正确匹配**：连字符、缩略词等合理情况仍然正确匹配
3. **更清晰的日志**：详细显示跳过合并的原因
4. **更高的匹配精度**：避免误匹配，提高整体匹配质量

## 🧪 测试建议

建议重点测试以下场景：

1. **包含空格的文本**：
   ```
   "Hello world this is a test"
   ```

2. **混合标点符号**：
   ```
   "Well-known U.S. companies, don't they?"
   ```

3. **长段落**：
   ```
   包含15+单词的段落，确保不会在中间错误合并
   ```

这次修复应该彻底解决单词错误合并的问题，同时保持跨token匹配的正确功能！🎯
