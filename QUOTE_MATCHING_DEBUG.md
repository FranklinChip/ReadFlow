# 引号匹配问题修复

## 问题描述

用户报告了一个匹配问题：
```
[Log]   - Trying 3-token combine [85-88): "I'd" (i'd) vs "I'd" (i'd)
```

明明看起来完全匹配，但却没有匹配成功。

## 根本原因分析

### 1. 字符编码差异
可能的原因是中英文引号的字符编码不同：
- 英文单引号: `'` (ASCII 39)
- 中文单引号: `'` `'` (Unicode 8216, 8217) 
- 反引号: ``` ` ``` (ASCII 96)

### 2. 其他可能的字符差异
- 连字符: `-` vs `—` vs `–` vs `−`
- 双引号: `"` vs `"` vs `"`
- 省略号: `...` vs `…`

## 解决方案

### 1. 新增字符标准化函数
```typescript
const normalizeText = useCallback((text: string): string => {
  return text
    .toLowerCase()
    // 统一各种引号
    .replace(/[''`]/g, "'")      // 将中文单引号、反引号统一为英文单引号
    .replace(/[""]/g, '"')       // 将中文双引号统一为英文双引号
    // 统一各种连字符和短横线
    .replace(/[—–−]/g, '-')      // 将长短横线统一为连字符
    // 统一省略号
    .replace(/…/g, '...')
    // 去除零宽字符
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}, []);
```

### 2. 更新匹配逻辑
替换原有的 `.toLowerCase()` 调用为 `normalizeText()` 调用：

**单token匹配**:
```typescript
const tokenLower = normalizeText(token);
const wordLower = normalizeText(currentWord.word);
```

**跨token合并匹配**:
```typescript
const combinedText = normalizeText(combineTokens.join(''));
```

### 3. 增强调试信息
新增字符编码对比日志：
```typescript
console.log(`  - Character codes: combined=[${Array.from(combinedText).map(c => c.charCodeAt(0)).join(',')}] vs word=[${Array.from(wordLower).map(c => c.charCodeAt(0)).join(',')}]`);
```

## 支持的字符标准化

| 原字符 | 标准化后 | 说明 |
|--------|----------|------|
| `'` `'` ``` ` ``` | `'` | 统一为英文单引号 |
| `"` `"` | `"` | 统一为英文双引号 |
| `—` `–` `−` | `-` | 统一为连字符 |
| `…` | `...` | 统一为三个点 |
| 零宽字符 | (删除) | 清理不可见字符 |

## 预期效果

修复后，以下情况都应该能正确匹配：
- `"I'd"` ← `["I", "'", "d"]` (中文单引号)
- `"I'd"` ← `["I", "'", "d"]` (英文单引号)
- `"I'd"` ← `["I", "`", "d"]` (反引号)
- `"don't"` ← `["don", "'", "t"]` (各种引号)
- `"well-known"` ← `["well", "—", "known"]` (长横线)

## 测试建议

1. 测试包含各种引号的文本
2. 测试包含不同连字符的复合词
3. 检查调试日志中的字符编码信息
4. 验证匹配成功率是否提升

这个修复应该能解决大部分因字符编码差异导致的匹配失败问题！🎯
