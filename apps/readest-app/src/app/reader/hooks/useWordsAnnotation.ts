import { useCallback, useEffect, useRef } from 'react';
import { FoliateView } from '@/types/view';
import { useReaderStore } from '@/store/readerStore';
import { getAnnotationProvider, WordAnnotation, ProperNounAnnotation, MWEAnnotation } from '@/services/annotationLLMs';
import { walkTextNodes } from '@/utils/walk';
import { debounce } from '@/utils/debounce';

interface UseWordsAnnotationOptions {
  provider?: string;
  enabled?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  preloadOffset?: number;
}

export function useWordsAnnotation(
  bookKey: string,
  view: FoliateView | HTMLElement | null,
  options: UseWordsAnnotationOptions = {}
) {
  const {
    provider = 'qwen', 
    enabled = true,
    retryAttempts = 3,
    retryDelay = 1000,
    preloadOffset = 3 // 增加预加载范围
  } = options;

  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);

  const enabledRef = useRef(enabled && viewSettings?.wordAnnotationEnabled);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const annotatedElements = useRef<Set<HTMLElement>>(new Set());
  const allTextNodes = useRef<HTMLElement[]>([]);
  const processingQueue = useRef<Set<HTMLElement>>(new Set());
  const isProcessingBatchRef = useRef(false);
  const currentBatchElements = useRef<Set<HTMLElement>>(new Set());
  const cancelCurrentProcessing = useRef<(() => void) | null>(null);
  const pageSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 新增：LLM请求状态跟踪
  const llmRequestsInProgress = useRef<Set<string>>(new Set()); // 跟踪正在进行的LLM请求
  const hasStartedLLMRequests = useRef<boolean>(false); // 标记是否已经开始LLM请求
  
  // 新增：预处理状态管理
  const preProcessingQueue = useRef<Set<HTMLElement>>(new Set());
  const viewAnnotationStatus = useRef<Map<string, 'pending' | 'processing' | 'completed'>>(new Map());
  const currentViewId = useRef<string>('');
  const pendingViewElements = useRef<Map<string, HTMLElement[]>>(new Map());

  // 生成视图ID的函数
  const generateViewId = useCallback((elements: HTMLElement[]): string => {
    if (elements.length === 0) return '';
    // 使用第一个和最后一个元素的文本内容片段生成ID
    const firstText = elements[0]?.textContent?.substring(0, 20) || '';
    const lastText = elements[elements.length - 1]?.textContent?.substring(0, 20) || '';
    return btoa(firstText + lastText).substring(0, 16);
  }, []);

  // 检查当前视图是否需要注释
  const checkCurrentViewAnnotationStatus = useCallback((elements: HTMLElement[]): boolean => {
    // 过滤出有效的文本元素（长度大于3的才考虑）
    const validElements = elements.filter(el => {
      const text = el.textContent?.trim();
      return text && text.length > 3;
    });
    
    // 找出未注释的有效元素
    const unannotatedElements = validElements.filter(el => {
      // 检查是否在我们的已注释列表中
      const isInAnnotatedList = annotatedElements.current.has(el);
      
      // 检查是否已经有注释标签
      const hasAnnotationTags = el.querySelector('ruby.word, .mwe, .PROPN') !== null;
      
      // 只有既不在已注释列表中，也没有注释标签的元素才算未注释
      return !isInAnnotatedList && !hasAnnotationTags;
    });
    
    const isFullyAnnotated = unannotatedElements.length === 0;
    
    console.log(`📊 View annotation status:`);
    console.log(`  - Total elements: ${elements.length}`);
    console.log(`  - Valid elements (>3 chars): ${validElements.length}`);
    console.log(`  - Unannotated elements: ${unannotatedElements.length}`);
    console.log(`  - Fully annotated: ${isFullyAnnotated}`);
    
    // 如果有未注释的元素，打印具体信息
    if (unannotatedElements.length > 0) {
      console.log(`  - First unannotated: "${unannotatedElements[0]?.textContent?.substring(0, 50)}..."`);
    }
    
    return isFullyAnnotated;
  }, []);

  // 触发全局等待状态事件
  const emitAnnotationStart = useCallback(() => {
    console.log('🚦 Emitting llm-annotation-start event');
    window.dispatchEvent(new CustomEvent('llm-annotation-start'));
    
    // 添加CSS隐藏注释内容
    if (view) {
      const docs: Document[] = [];
      
      if ('renderer' in view && view.renderer && typeof view.renderer.getContents === 'function') {
        const contents = view.renderer.getContents();
        contents.forEach(({ doc }) => {
          if (doc) docs.push(doc);
        });
      } else if (view instanceof HTMLElement) {
        const doc = view.ownerDocument;
        if (doc) docs.push(doc);
      }
      
      docs.forEach(doc => {
        // 先移除可能存在的旧样式
        const existingStyle = doc.getElementById('annotation-processing-style');
        if (existingStyle) {
          existingStyle.remove();
        }
        
        // 添加新的处理样式
        const style = doc.createElement('style');
        style.id = 'annotation-processing-style';
        style.textContent = `
          ruby.word rt,
          .mwe .annotation,
          .PROPN .annotation {
            display: none !important;
          }
        `;
        doc.head.appendChild(style);
        console.log('Added processing style to hide annotations');
      });
    }
  }, [view]);

  const emitAnnotationEnd = useCallback(() => {
    console.log('🚦 Emitting llm-annotation-end event');
    window.dispatchEvent(new CustomEvent('llm-annotation-end'));
    
    // 移除隐藏注释的CSS
    if (view) {
      const docs: Document[] = [];
      
      if ('renderer' in view && view.renderer && typeof view.renderer.getContents === 'function') {
        const contents = view.renderer.getContents();
        contents.forEach(({ doc }) => {
          if (doc) docs.push(doc);
        });
      } else if (view instanceof HTMLElement) {
        const doc = view.ownerDocument;
        if (doc) docs.push(doc);
      }
      
      docs.forEach(doc => {
        // 强制移除所有可能的处理样式
        const existingStyles = doc.querySelectorAll('#annotation-processing-style');
        existingStyles.forEach(style => {
          console.log('Removing processing style:', style);
          style.remove();
        });
        
        // 为了确保移除，也尝试通过类名删除
        const allStyles = doc.querySelectorAll('style');
        allStyles.forEach(style => {
          if (style.textContent?.includes('ruby.word rt') && 
              style.textContent?.includes('display: none !important')) {
            console.log('Removing orphaned processing style:', style);
            style.remove();
          }
        });
      });
      
      // 延迟触发重新渲染以确保样式更新
      setTimeout(() => {
        console.log('Processing styles cleanup completed');
      }, 100);
    }
  }, [view]);

  // 取消当前处理的函数 - 智能取消逻辑
  const cancelProcessing = useCallback(() => {
    // 检查是否已经开始LLM请求
    if (hasStartedLLMRequests.current && llmRequestsInProgress.current.size > 0) {
      console.log('🔄 LLM requests already in progress, continuing current task to prevent resource waste');
      console.log('Active LLM requests:', llmRequestsInProgress.current.size);
      // 不取消，让当前任务完成
      return;
    }
    
    console.log('⏹️ No LLM requests in progress, proceeding with cancellation');
    
    // 重置LLM状态
    hasStartedLLMRequests.current = false;
    llmRequestsInProgress.current.clear();
    
    // 取消当前批处理
    isProcessingBatchRef.current = false;
    
    // 清理处理队列
    processingQueue.current.clear();
    currentBatchElements.current.clear();
    
    // 触发结束事件（这会清理样式）
    emitAnnotationEnd();
    
    // 执行取消回调
    if (cancelCurrentProcessing.current) {
      cancelCurrentProcessing.current();
      cancelCurrentProcessing.current = null;
    }
    
    console.log('Processing cancelled and cleaned up');
  }, [emitAnnotationEnd]);

  // 清理已注释元素的函数（用于重新处理）
  const clearAnnotatedElements = useCallback(() => {
    annotatedElements.current.clear();
    console.log('Cleared annotated elements');
  }, []);

  // 文本 token 化函数
  const tokenizeText = useCallback((text: string): string[] => {
    // 改进的文本分词，保留空格信息避免额外空格问题
    const tokens: string[] = [];
    const regex = /(\s+)|(\b\w+(?:'\w+)?\b|\b\w+(?:-\w+)+\b|[^\w\s])/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        // 空格token
        tokens.push(match[1]);
      } else if (match[2]) {
        // 单词或符号token
        tokens.push(match[2]);
      }
    }
    
    return tokens;
  }, []);

  // 创建单个单词的ruby标签（带索引）
  const createSingleWordRuby = useCallback((word: string, annotation: WordAnnotation, index: number): string => {
    return `<ruby class="word" lemma="${annotation.lemma}" data-word-index="${index}">${word}<rt class="zh-meaning">${annotation.zh}</rt><rt class="en-meaning">${annotation.en}</rt></ruby>`;
  }, []);

  // 顺序匹配单词的函数 - 使用滑动窗口（带索引）
  const createOrderedWordRubyAnnotations = useCallback((text: string, annotations: { words: WordAnnotation[] }): string => {
    const tokens = tokenizeText(text);
    const llmWords = annotations.words;
    
    console.log('Original tokens:', tokens);
    console.log('LLM words:', llmWords.map(w => w.word));

    const resultTokens = [...tokens];
    let llmIndex = 0; // LLM 单词索引
    let tokenIndex = 0; // 当前 token 索引
    let wordIndex = 0; // ruby标签索引

    const processedRanges: Set<number> = new Set(); // 记录已处理的 token 索引

    while (llmIndex < llmWords.length && tokenIndex < tokens.length) {
      const currentWord = llmWords[llmIndex];
      if (!currentWord) {
        llmIndex++;
        continue;
      }

      const windowSize = 5;
      
      // 创建滑动窗口
      const windowEnd = Math.min(tokenIndex + windowSize, tokens.length);
      let found = false;

      // 在窗口内搜索匹配
      for (let searchIndex = tokenIndex; searchIndex < windowEnd; searchIndex++) {
        if (processedRanges.has(searchIndex)) continue;

        // 跳过空格token
        const token = tokens[searchIndex];
        if (!token || /^\s+$/.test(token)) continue;
        
        const tokenLower = token.toLowerCase();
        const wordLower = currentWord.word.toLowerCase();

        if (tokenLower === wordLower) {
          // 直接匹配成功
          if (!processedRanges.has(searchIndex)) {
            resultTokens[searchIndex] = createSingleWordRuby(token, currentWord, wordIndex);
            processedRanges.add(searchIndex);
            wordIndex++; // 增加ruby索引
          }
          tokenIndex = searchIndex + 1;
          found = true;
          break;
        }

        // 尝试跨 token 合并匹配（处理连字符词等）
        if (searchIndex < windowEnd - 1) {
          const combinations = [
            // 连字符组合: word1-word2
            { pattern: [searchIndex, searchIndex + 1, searchIndex + 2], joiner: '' },
            // 更复杂的组合
            { pattern: [searchIndex, searchIndex + 1, searchIndex + 2, searchIndex + 3], joiner: '' },
            { pattern: [searchIndex, searchIndex + 1, searchIndex + 2, searchIndex + 3, searchIndex + 4], joiner: '' }
          ];

          for (const combo of combinations) {
            const { pattern, joiner } = combo;
            const validIndices = pattern.filter(idx => idx < tokens.length && !processedRanges.has(idx) && tokens[idx] && !/^\s+$/.test(tokens[idx]));
            
            if (validIndices.length >= 2) {
              const combinedText = validIndices.map(idx => tokens[idx]).join(joiner);
              const combinedLower = combinedText.toLowerCase();

              if (combinedLower === wordLower) {
                // 合并匹配成功
                const ruby = createSingleWordRuby(combinedText, currentWord, wordIndex);
                
                // 替换第一个token为ruby，其余设为空字符串（不能删除空格token）
                const firstIndex = validIndices[0];
                if (firstIndex !== undefined) {
                  resultTokens[firstIndex] = ruby;
                  for (let i = 1; i < validIndices.length; i++) {
                    const idx = validIndices[i];
                    if (idx !== undefined) {
                      resultTokens[idx] = '';
                    }
                  }
                  
                  validIndices.forEach(idx => processedRanges.add(idx));
                  const lastIndex = validIndices[validIndices.length - 1];
                  if (lastIndex !== undefined) {
                    tokenIndex = lastIndex + 1;
                  }
                  wordIndex++; // 增加ruby索引
                  found = true;
                  break;
                }
              }
            }
          }
          
          if (found) break;
        }
      }

      if (!found) {
        // 如果在当前窗口没找到，移动到下一个非空格token
        do {
          tokenIndex++;
        } while (tokenIndex < tokens.length && tokens[tokenIndex] && /^\s+$/.test(tokens[tokenIndex]!));
        
        if (tokenIndex >= tokens.length) {
          // 如果token用完了但还有LLM单词，跳过剩余的LLM单词
          console.warn(`Could not find token for LLM word: ${currentWord.word}`);
          llmIndex++;
        }
      } else {
        llmIndex++;
      }
    }

    return resultTokens.join('');
  }, [tokenizeText, createSingleWordRuby]);

  // 从HTML中提取ruby单词数组（基于索引）
  const extractRubyWordsArray = useCallback((htmlText: string): string[] => {
    console.log('🔍 extractRubyWordsArray called');
    
    // 安全检查
    if (!htmlText || typeof htmlText !== 'string') {
      console.log('❌ Invalid HTML text input:', typeof htmlText, htmlText);
      return [];
    }
    
    console.log('🔍 HTML text length:', htmlText.length);
    console.log('🔍 HTML text sample (first 300 chars):', htmlText.substring(0, 300) + '...');
    
    // 首先检查是否包含ruby标签
    const hasRubyTags = htmlText.includes('<ruby');
    console.log('🔍 HTML contains ruby tags:', hasRubyTags);
    
    if (!hasRubyTags) {
      console.log('⚠️ No ruby tags found in HTML, returning empty array');
      return [];
    }
    
    // 检查是否包含data-word-index属性
    const hasWordIndex = htmlText.includes('data-word-index');
    console.log('🔍 HTML contains data-word-index:', hasWordIndex);
    
    if (!hasWordIndex) {
      console.log('⚠️ No data-word-index attributes found in HTML, returning empty array');
      return [];
    }
    
    const rubyWords: string[] = [];
    const rubyPattern = /<ruby[^>]*data-word-index="(\d+)"[^>]*>(.*?)<\/ruby>/gs;
    let match;
    let matchCount = 0;
    
    console.log('🔍 Starting regex matching with pattern:', rubyPattern.source);
    
    try {
      while ((match = rubyPattern.exec(htmlText)) !== null) {
        matchCount++;
        const index = parseInt(match[1]!, 10);
        const rubyContent = match[2]!;
        
        console.log(`🔍 Found ruby match ${matchCount}:`, {
          index,
          fullMatch: match[0].substring(0, 100) + '...',
          content: rubyContent.substring(0, 50) + '...'
        });
        
        // 提取ruby标签内的实际单词（去除rt标签和多余空白）
        const wordText = rubyContent.replace(/<rt[^>]*>.*?<\/rt>/gs, '').replace(/\s+/g, ' ').trim();
        
        console.log(`🔍 Extracted word text: "${wordText}" at index ${index}`);
        
        // 确保数组足够大
        while (rubyWords.length <= index) {
          rubyWords.push('');
        }
        
        rubyWords[index] = wordText.toLowerCase();
        
        // 防止无限循环
        if (matchCount > 1000) {
          console.warn('⚠️ Too many matches, breaking to prevent infinite loop');
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error during regex matching:', error);
      return [];
    }
    
    console.log(`🔍 Total ruby matches found: ${matchCount}`);
    console.log('🔍 Final ruby words array:', rubyWords);
    console.log('🔍 Ruby words array length:', rubyWords.length);
    console.log('🔍 Non-empty words in array:', rubyWords.filter(w => w.length > 0).length);
    
    return rubyWords;
  }, []);

  // 基于索引匹配词组和专有名词
  const matchPhraseWithIndexes = useCallback((rubyWords: string[], targetPhrase: string): { startIndex: number, endIndex: number } | null => {
    const phraseWords = targetPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (phraseWords.length === 0) return null;
    
    console.log(`🔍 matchPhraseWithIndexes: "${targetPhrase}"`);
    console.log(`🔍 Target phrase words:`, phraseWords);
    console.log(`🔍 Ruby words array:`, rubyWords);
    console.log(`🔍 Ruby words length: ${rubyWords.length}, phrase words length: ${phraseWords.length}`);
    
    // 在ruby单词数组中寻找连续匹配（严格模式）
    for (let searchStart = 0; searchStart < rubyWords.length; searchStart++) {
      const startWord = rubyWords[searchStart];
      
      // 跳过空字符串
      if (!startWord || startWord.length === 0) {
        continue;
      }
      
      // 检查是否匹配第一个词组单词
      if (startWord === phraseWords[0]) {
        console.log(`\n🔍 Found potential start at index ${searchStart}: "${startWord}"`);
        
        let matchedWords: number[] = [searchStart]; // 记录匹配的索引
        let currentPhraseIndex = 1; // 下一个要匹配的词组单词
        let currentSearchIndex = searchStart + 1; // 下一个搜索位置
        
        // 尝试匹配剩余的词组单词
        while (currentPhraseIndex < phraseWords.length && currentSearchIndex < rubyWords.length) {
          const targetWord = phraseWords[currentPhraseIndex]!;
          let found = false;
          
          console.log(`  🔍 Looking for phrase word "${targetWord}" starting from index ${currentSearchIndex}`);
          
          // 在限定范围内寻找下一个单词（最多跳过2个非空单词）
          let skippedNonEmpty = 0;
          for (let i = currentSearchIndex; i < rubyWords.length; i++) {
            const rubyWord = rubyWords[i];
            
            // 跳过空字符串
            if (!rubyWord || rubyWord.length === 0) {
              console.log(`    ⚠️ Skipping empty at index ${i}`);
              continue;
            }
            
            console.log(`    🔍 Checking index ${i}: "${rubyWord}" vs "${targetWord}"`);
            
            if (rubyWord === targetWord) {
              console.log(`    ✅ Match found at index ${i}`);
              matchedWords.push(i);
              currentSearchIndex = i + 1;
              currentPhraseIndex++;
              found = true;
              break;
            }
            
            // 非空但不匹配的单词
            skippedNonEmpty++;
            console.log(`    ❌ Non-matching word "${rubyWord}", skipped: ${skippedNonEmpty}`);
            
            // 如果跳过太多非空单词，放弃这次匹配
            if (skippedNonEmpty > 2) {
              console.log(`    ❌ Skipped too many non-matching words (${skippedNonEmpty}), giving up`);
              break;
            }
          }
          
          if (!found) {
            console.log(`  ❌ Could not find "${targetWord}", breaking`);
            break;
          }
        }
        
        // 检查是否完全匹配
        if (currentPhraseIndex === phraseWords.length) {
          const startIndex = matchedWords[0]!;
          const endIndex = matchedWords[matchedWords.length - 1]!;
          console.log(`🎯 Found complete phrase match:`);
          console.log(`  - Matched words at indexes: [${matchedWords.join(', ')}]`);
          console.log(`  - Range: ${startIndex} to ${endIndex}`);
          console.log(`  - Matched ${phraseWords.length}/${phraseWords.length} words`);
          return { startIndex, endIndex };
        } else {
          console.log(`❌ Incomplete match: ${currentPhraseIndex}/${phraseWords.length} words found`);
        }
      }
    }
    
    console.log(`❌ No match found for phrase "${targetPhrase}"`);
    return null;
  }, []);

  // 创建基于索引的词组和专有名词注释
  const createIndexBasedPhraseAnnotations = useCallback((htmlText: string, annotations: { mwes: MWEAnnotation[], proper_nouns: ProperNounAnnotation[] }): string => {
    console.log('🔍 createIndexBasedPhraseAnnotations called with:');
    console.log('  - HTML text length:', htmlText.length);
    console.log('  - HTML preview:', htmlText.substring(0, 200) + '...');
    console.log('  - MWEs count:', annotations.mwes.length);
    console.log('  - Proper nouns count:', annotations.proper_nouns.length);
    
    // 首先提取ruby单词数组
    const rubyWords = extractRubyWordsArray(htmlText);
    console.log('🔍 Extracted ruby words:', rubyWords);
    
    if (rubyWords.length === 0) {
      console.log('❌ No ruby words found, skipping phrase annotation');
      return htmlText;
    }
    
    // 合并处理词组和专有名词，按长度降序处理
    const allPhrases = [
      ...annotations.mwes.map(mwe => ({ ...mwe, type: 'mwe' as const, text: mwe.phrase })),
      ...annotations.proper_nouns.map(pn => ({ ...pn, type: 'proper_noun' as const, text: pn.phrase }))
    ]
      .filter(item => item.text && item.text.trim())
      .sort((a, b) => b.text.length - a.text.length);

    console.log('🔍 All phrases to process:', allPhrases.map(item => `"${item.text}" (${item.type})`));
    console.log('🔍 Processing phrases and proper nouns with index-based matching:', allPhrases.length, 'total items');

    let resultHTML = htmlText;
    const processedRanges = new Set<string>(); // 记录已处理的索引范围

    for (const item of allPhrases) {
      const phrase = item.text.trim();
      console.log(`\n🔍 Processing phrase: "${phrase}" (${item.type})`);
      
      // 使用索引匹配查找词组
      const match = matchPhraseWithIndexes(rubyWords, phrase);
      console.log('🔍 Match result:', match);
      
      if (!match) {
        console.log(`❌ No match found for phrase "${phrase}"`);
        continue;
      }
      
      const { startIndex, endIndex } = match;
      const rangeKey = `${startIndex}-${endIndex}`;
      console.log(`🔍 Found match for "${phrase}" at range ${rangeKey}`);
      
      // 检查是否已经处理过这个范围
      if (processedRanges.has(rangeKey)) {
        console.log(`⚠️ Range ${rangeKey} already processed, skipping`);
        continue;
      }
      
      // 标记这个范围为已处理
      processedRanges.add(rangeKey);
      
      console.log(`✅ Processing phrase "${phrase}" at indexes ${startIndex}-${endIndex}`);
      
      // 找到对应的ruby标签范围
      const startPattern = new RegExp(`<ruby[^>]*data-word-index="${startIndex}"[^>]*>`, 'g');
      console.log('🔍 Start pattern:', startPattern.source);
      
      let startMatch = startPattern.exec(resultHTML);
      console.log('🔍 Start match result:', startMatch);
      
      if (!startMatch) {
        console.log(`❌ Could not find start ruby tag for index ${startIndex}`);
        continue;
      }
      
      console.log(`🔍 Found start ruby tag at position ${startMatch.index}`);
      
      // 找到结束位置（第endIndex个ruby标签的结束）
      let endMatch: RegExpMatchArray | null = null;
      let searchPos = startMatch.index;
      
      console.log(`🔍 Searching for end ruby tag from position ${searchPos}`);
      
      // 重置正则表达式的lastIndex
      const rubyEndPattern = new RegExp(`<ruby[^>]*data-word-index="(\\d+)"[^>]*>.*?</ruby>`, 'g');
      rubyEndPattern.lastIndex = searchPos;
      
      let rubyMatch;
      let foundEndTag = false;
      while ((rubyMatch = rubyEndPattern.exec(resultHTML)) !== null) {
        const index = parseInt(rubyMatch[1]!, 10);
        console.log(`🔍 Found ruby tag with index ${index} at position ${rubyMatch.index}`);
        
        if (index >= startIndex && index <= endIndex) {
          console.log(`🔍 Ruby tag index ${index} is in range ${startIndex}-${endIndex}`);
          if (index === endIndex) {
            endMatch = rubyMatch;
            foundEndTag = true;
            console.log(`🎯 Found end ruby tag for index ${endIndex}`);
            break;
          }
        }
      }
      
      if (!endMatch) {
        console.log(`❌ Could not find end ruby tag for index ${endIndex}`);
        console.log(`🔍 foundEndTag: ${foundEndTag}`);
        continue;
      }
      
      const startPos = startMatch.index;
      const endPos = endMatch.index! + endMatch[0].length;
      const matchedText = resultHTML.substring(startPos, endPos);
      
      console.log(`🔍 HTML range found: ${startPos}-${endPos}`);
      console.log(`🔍 Matched text: "${matchedText.substring(0, 100)}${matchedText.length > 100 ? '...' : ''}"`);
      
      // 生成span标签
      let spanTag: string;
      
      if (item.type === 'proper_noun') {
        // 专有名词使用 PROPN class
        const enAnnotation = item.en || '';
        const zhAnnotation = item.zh || '';
        spanTag = `<span class="PROPN">${matchedText}<span class="annotation en">(${enAnnotation})</span><span class="annotation zh">(${zhAnnotation})</span></span>`;
      } else {
        // 词组使用 mwe class
        const enAnnotation = (item as MWEAnnotation).en || '';
        const zhAnnotation = (item as MWEAnnotation).zh || '';
        spanTag = `<span class="mwe">${matchedText}<span class="annotation en">(${enAnnotation})</span><span class="annotation zh">(${zhAnnotation})</span></span>`;
      }
      
      console.log('🔍 Generated span tag:', spanTag.substring(0, 150) + '...');
      
      // 替换
      const beforeReplace = resultHTML.length;
      resultHTML = resultHTML.slice(0, startPos) + spanTag + resultHTML.slice(endPos);
      const afterReplace = resultHTML.length;
      
      console.log(`✅ Replacement completed. HTML length: ${beforeReplace} -> ${afterReplace}`);
      console.log(`🔍 New HTML preview: "${resultHTML.substring(startPos, startPos + 200)}..."`);
    }

    console.log(`\n🏁 Final result HTML length: ${resultHTML.length} (original: ${htmlText.length})`);
    console.log(`🏁 Processing completed for ${allPhrases.length} phrases`);
    return resultHTML;
  }, [extractRubyWordsArray, matchPhraseWithIndexes]);

  // 带重试机制的单词注释处理（第一步：只获取单词）
  const annotateWordsWithRetry = useCallback(async (text: string, attempts = 0): Promise<{ words: WordAnnotation[] } | null> => {
    const requestId = `words-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 标记LLM请求开始
      hasStartedLLMRequests.current = true;
      llmRequestsInProgress.current.add(requestId);
      
      // 调用LLM服务获取单词
      const annotationProvider = getAnnotationProvider(provider);
      if (!annotationProvider) {
        throw new Error(`Annotation provider '${provider}' not found`);
      }

      console.log('❤️ Calling LLM for words:', text.substring(0, 50));
      const result = await annotationProvider.annotate(`words:${text}`);
      
      // 打印 LLM 返回的 JSON 内容
      console.log('🔤 LLM Words Response JSON:', JSON.stringify(result, null, 2));
      
      console.log('LLM words result:', result);
      return { words: result.words || [] };
    } catch (error) {
      console.error(`Words annotation attempt ${attempts + 1} failed:`, error);
      
      if (attempts < retryAttempts) {
        // 指数退避重试
        const delay = retryDelay * Math.pow(2, attempts);
        console.log(`Retrying words annotation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return annotateWordsWithRetry(text, attempts + 1);
      }
      
      console.error('All words annotation attempts failed for text:', text.substring(0, 100));
      return { words: [] }; // 返回空结果而不是null
    } finally {
      // 请求完成，从跟踪中移除
      llmRequestsInProgress.current.delete(requestId);
    }
  }, [provider, retryAttempts, retryDelay]);

  // 带重试机制的词组和专有名词注释处理（第二步：获取词组和多词专有名词）
  const annotatePhrasesAndProperNounsWithRetry = useCallback(async (text: string, attempts = 0): Promise<{ mwes: MWEAnnotation[], proper_nouns: ProperNounAnnotation[] } | null> => {
    const requestId = `phrases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 标记LLM请求开始
      hasStartedLLMRequests.current = true;
      llmRequestsInProgress.current.add(requestId);
      
      // 调用LLM服务获取词组和专有名词
      const annotationProvider = getAnnotationProvider(provider);
      if (!annotationProvider) {
        throw new Error(`Annotation provider '${provider}' not found`);
      }

      console.log('Calling LLM for phrases and proper nouns:', text.substring(0, 50));
      const result = await annotationProvider.annotate(`phrases:${text}`);
      
      // 打印 LLM 返回的 JSON 内容
      console.log('📝 LLM Phrases Response JSON:', JSON.stringify(result, null, 2));
      
      console.log('LLM phrases result:', result);
      return { mwes: result.mwes || [], proper_nouns: result.proper_nouns || [] };
    } catch (error) {
      console.error(`Phrases annotation attempt ${attempts + 1} failed:`, error);
      
      if (attempts < retryAttempts) {
        // 指数退避重试
        const delay = retryDelay * Math.pow(2, attempts);
        console.log(`Retrying phrases annotation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return annotatePhrasesAndProperNounsWithRetry(text, attempts + 1);
      }
      
      console.error('All phrases annotation attempts failed for text:', text.substring(0, 100));
      return { mwes: [], proper_nouns: [] }; // 返回空结果而不是null
    } finally {
      // 请求完成，从跟踪中移除
      llmRequestsInProgress.current.delete(requestId);
    }
  }, [provider, retryAttempts, retryDelay]);

  // 处理单个元素 - 新的两步流程：先单词，再词组和专有名词
  const annotateElement = useCallback(async (element: HTMLElement): Promise<void> => {
    if (!enabledRef.current) return;
    
    // 检查是否已经注释过
    if (annotatedElements.current.has(element)) return;
    
    // 检查是否正在处理
    if (processingQueue.current.has(element)) return;
    
    // 检查是否已有我们的注释标签，如果有则跳过（永久保存原则）
    if (element.querySelector('ruby.word, .mwe, .PROPN')) {
      console.log('Element already has annotations, skipping:', element.textContent?.substring(0, 50));
      annotatedElements.current.add(element); // 标记为已处理
      return;
    }

    // 获取纯文本内容（不包含任何HTML标签）
    const originalText = element.textContent?.trim();
    if (!originalText || originalText.length < 3) return;

    console.log('Processing element with text:', originalText.substring(0, 100));

    // 添加到处理队列
    processingQueue.current.add(element);
    currentBatchElements.current.add(element);

    try {
      // 第一步：获取单词注释（基于纯文本，按顺序）
      const wordsAnnotations = await annotateWordsWithRetry(originalText);
      
      // 第二步：获取词组和多词专有名词的注释（基于同样的纯文本）
      const phrasesAnnotations = await annotatePhrasesAndProperNounsWithRetry(originalText);
      
      // 第三步：先处理单词，创建ruby标签（使用新的顺序匹配算法）
      let processedHTML = originalText;
      if (wordsAnnotations && wordsAnnotations.words.length > 0 && enabledRef.current) {
        processedHTML = createOrderedWordRubyAnnotations(originalText, wordsAnnotations);
        console.log('After word annotations:', processedHTML.substring(0, 200));
      }

      // 第四步：在ruby标签基础上添加词组和专有名词span包装
      if (phrasesAnnotations && (phrasesAnnotations.mwes.length > 0 || phrasesAnnotations.proper_nouns.length > 0) && 
          enabledRef.current && (viewSettings?.phraseAnnotationEnabled || viewSettings?.wordAnnotationEnabled)) {
        console.log('🔍 About to call createIndexBasedPhraseAnnotations');
        console.log('  - MWEs:', phrasesAnnotations.mwes.length);
        console.log('  - Proper nouns:', phrasesAnnotations.proper_nouns.length);
        console.log('  - Phrase annotation enabled:', viewSettings?.phraseAnnotationEnabled);
        console.log('  - Word annotation enabled:', viewSettings?.wordAnnotationEnabled);
        console.log('  - enabledRef.current:', enabledRef.current);
        console.log('  - processedHTML length before phrase annotation:', processedHTML.length);
        
        processedHTML = createIndexBasedPhraseAnnotations(processedHTML, phrasesAnnotations);
        console.log('🔍 After phrase and proper noun annotations:', processedHTML.substring(0, 200));
        console.log('  - processedHTML length after phrase annotation:', processedHTML.length);
      } else {
        console.log('🔍 Skipping phrase annotation because:');
        console.log('  - phrasesAnnotations exists:', !!phrasesAnnotations);
        console.log('  - MWEs count:', phrasesAnnotations?.mwes.length || 0);
        console.log('  - Proper nouns count:', phrasesAnnotations?.proper_nouns.length || 0);
        console.log('  - enabledRef.current:', enabledRef.current);
        console.log('  - phraseAnnotationEnabled:', viewSettings?.phraseAnnotationEnabled);
        console.log('  - wordAnnotationEnabled:', viewSettings?.wordAnnotationEnabled);
      }

      // 第五步：更新元素内容（只有在内容发生变化时才更新）
      if (enabledRef.current && processedHTML !== originalText) {
        element.innerHTML = processedHTML;
        console.log('Final HTML set for element:', processedHTML.substring(0, 200));
      } else {
        console.log('No annotations found or content unchanged, skipping HTML update');
      }

      // 标记为已注释（永久保存）
      annotatedElements.current.add(element);
    } catch (error) {
      console.error('Failed to annotate element:', error);
      // 即使失败也要标记为已处理，避免无限重试
      annotatedElements.current.add(element);
    } finally {
      // 从处理队列中移除
      processingQueue.current.delete(element);
      currentBatchElements.current.delete(element);
    }
  }, [annotateWordsWithRetry, createOrderedWordRubyAnnotations, annotatePhrasesAndProperNounsWithRetry, createIndexBasedPhraseAnnotations, viewSettings?.phraseAnnotationEnabled, viewSettings?.wordAnnotationEnabled]);

  // 批处理注释 - 管理等待状态和页面切换检测（支持后台处理）
  const processBatchAnnotation = useCallback(async (elements: HTMLElement[], isBackgroundProcessing = false) => {
    if (elements.length === 0) return;
    
    // 生成当前视图ID
    const viewId = generateViewId(elements);
    
    // 检查是否已经完全注释
    if (checkCurrentViewAnnotationStatus(elements)) {
      console.log(`📋 View (${viewId}) already fully annotated, skipping`);
      if (!isBackgroundProcessing) {
        viewAnnotationStatus.current.set(viewId, 'completed');
      }
      return;
    }
    
    // 如果已经在处理中且不是后台处理，取消之前的处理
    if (isProcessingBatchRef.current && !isBackgroundProcessing) {
      cancelProcessing();
    }
    
    // 如果是前台处理，立即显示等待状态（不管是否已经在处理）
    const needsWaitingState = !isBackgroundProcessing;
    
    if (needsWaitingState) {
      // 前台处理：开始批处理，发送等待状态
      isProcessingBatchRef.current = true;
      currentViewId.current = viewId;
      
      // 重置LLM请求状态
      hasStartedLLMRequests.current = false;
      llmRequestsInProgress.current.clear();
      
      emitAnnotationStart();
      console.log(`🎯 Foreground processing started for view (${viewId})`);
    } else {
      console.log(`🔄 Background processing started for view (${viewId})`);
    }

    // 更新视图状态
    if (!isBackgroundProcessing) {
      viewAnnotationStatus.current.set(viewId, 'processing');
    }

    // 设置页面切换检测（仅前台处理）
    let isCancelled = false;
    if (!isBackgroundProcessing) {
      cancelCurrentProcessing.current = () => {
        isCancelled = true;
      };

      // 设置500ms延迟检测
      if (pageSwitchTimeoutRef.current) {
        clearTimeout(pageSwitchTimeoutRef.current);
      }
      
      pageSwitchTimeoutRef.current = setTimeout(() => {
        if (isCancelled || !isProcessingBatchRef.current) {
          console.log('⚡ Page switch detected after 500ms');
          console.log(`📊 LLM Status - Started: ${hasStartedLLMRequests.current}, Active requests: ${llmRequestsInProgress.current.size}`);
          
          if (hasStartedLLMRequests.current && llmRequestsInProgress.current.size > 0) {
            console.log('💰 Preserving resources: LLM requests already in progress, continuing task');
          } else {
            console.log('🛑 No LLM requests active, safe to cancel');
          }
          
          cancelProcessing();
          return;
        }
      }, 500);
    }

    try {
      const processingType = isBackgroundProcessing ? 'Background' : 'Foreground';
      console.log(`${processingType} batch annotation for`, elements.length, 'elements');
      
      // 处理所有元素
      const promises = elements.map(async element => {
        if (isCancelled && !isBackgroundProcessing) return;
        try {
          return await annotateElement(element);
        } catch (error) {
          console.error('Error in annotateElement:', error);
          // 确保元素被标记为已处理
          annotatedElements.current.add(element);
        }
      });
      
      await Promise.all(promises);
      
      // 等待当前批次完成（仅前台处理需要严格等待）
      if (!isBackgroundProcessing) {
        let waitCount = 0;
        while (currentBatchElements.current.size > 0 && !isCancelled && waitCount < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        if (waitCount >= 50) {
          console.warn('Timeout waiting for batch completion, forcing end');
          currentBatchElements.current.clear();
        }
      }
      
      console.log(`${processingType} batch annotation completed for view (${viewId})`);
      
      // 更新视图状态
      viewAnnotationStatus.current.set(viewId, 'completed');
      
    } catch (error) {
      console.error('Error in batch annotation:', error);
    } finally {
      // 清理超时器（仅前台处理）
      if (!isBackgroundProcessing) {
        if (pageSwitchTimeoutRef.current) {
          clearTimeout(pageSwitchTimeoutRef.current);
          pageSwitchTimeoutRef.current = null;
        }
        
        // 强制结束批处理，清除等待状态
        isProcessingBatchRef.current = false;
        emitAnnotationEnd();
        
        // 清理取消函数
        cancelCurrentProcessing.current = null;
      }
      
      console.log(`${isBackgroundProcessing ? 'Background' : 'Foreground'} annotation cleanup completed for view (${viewId})`);
    }
  }, [annotateElement, emitAnnotationStart, emitAnnotationEnd, cancelProcessing, generateViewId, checkCurrentViewAnnotationStatus]);

  // 预先注释接下来的元素（智能预处理机制）
  const preAnnotateNextElements = useCallback((currentElement: HTMLElement, count: number, currentVisibleElements: HTMLElement[]) => {
    if (!allTextNodes.current || count <= 0) return;
    
    const currentIndex = allTextNodes.current.indexOf(currentElement);
    if (currentIndex === -1) return;

    console.log('🚀 Starting intelligent pre-processing for next', count, 'views');

    // 使用当前视口实际可见的段落数作为基准
    const elementsPerView = currentVisibleElements.length;
    const totalElementsToProcess = elementsPerView * count;
    const nextElements = allTextNodes.current.slice(currentIndex + 1, currentIndex + 1 + totalElementsToProcess);
    
    if (nextElements.length === 0) return;

    console.log(`📊 Current viewport has ${elementsPerView} elements, pre-processing ${totalElementsToProcess} elements (${count} views)`);

    // 按视图分组
    const viewGroups: HTMLElement[][] = [];
    for (let i = 0; i < nextElements.length; i += elementsPerView) {
      viewGroups.push(nextElements.slice(i, i + elementsPerView));
    }

    // 为每个视图生成ID并设置状态
    viewGroups.forEach((viewElements, index) => {
      const viewId = generateViewId(viewElements);
      
      // 检查该视图是否已经完全注释
      if (checkCurrentViewAnnotationStatus(viewElements)) {
        viewAnnotationStatus.current.set(viewId, 'completed');
        console.log(`📋 View ${index + 1} (${viewId}) already annotated, skipping`);
        return;
      }

      // 标记为待处理
      viewAnnotationStatus.current.set(viewId, 'pending');
      pendingViewElements.current.set(viewId, viewElements);
      
      console.log(`📋 View ${index + 1} (${viewId}) queued for pre-processing`);

      // 延迟处理，避免阻塞当前操作
      const delay = (index + 1) * 1000; // 每个视图延迟1秒处理
      setTimeout(async () => {
        console.log(`🔄 Pre-processing view ${index + 1} (${viewId})`);
        viewAnnotationStatus.current.set(viewId, 'processing');
        
        // 后台处理
        await processBatchAnnotation(viewElements, true); // 传入后台处理标记
        
        viewAnnotationStatus.current.set(viewId, 'completed');
        console.log(`✅ Pre-processing completed for view ${index + 1} (${viewId})`);
      }, delay);
    });
  }, [generateViewId, checkCurrentViewAnnotationStatus, processBatchAnnotation]);

  // 创建IntersectionObserver（支持智能预处理）
  const createAnnotationObserver = useCallback(() => {
    return new IntersectionObserver(
      (entries) => {
        const visibleElements: HTMLElement[] = [];
        let currentElement: HTMLElement | null = null;
        
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            visibleElements.push(element);
            currentElement = element;
          }
        }
        
        // 如果没有可见元素，跳过处理
        if (visibleElements.length === 0) return;
        
        // 生成当前视图ID
        const currentViewId = generateViewId(visibleElements);
        
        // 检查当前视图的注释状态
        const isCurrentViewFullyAnnotated = checkCurrentViewAnnotationStatus(visibleElements);
        
        console.log(`👁️ View changed to (${currentViewId})`);
        console.log(`  - View fully annotated: ${isCurrentViewFullyAnnotated}`);
        console.log(`  - Currently processing: ${isProcessingBatchRef.current}`);
        
        if (!isCurrentViewFullyAnnotated) {
          // 当前视图有未注释的元素，需要注释
          console.log(`🎯 Current view (${currentViewId}) has unannotated elements, processing immediately`);
          
          // 如果已经在处理其他批次，先取消
          if (isProcessingBatchRef.current) {
            console.log('🔄 Cancelling previous processing for new view');
            cancelProcessing();
          }
          
          // 立即处理当前视图（前台处理，显示等待状态）
          processBatchAnnotation(visibleElements, false);
        } else {
          // 当前视图所有元素都已经注释完成
          console.log(`✅ Current view (${currentViewId}) is fully annotated`);
          
          // 确保没有等待状态显示
          if (isProcessingBatchRef.current) {
            console.log('🛑 Stopping processing state for fully annotated view');
            isProcessingBatchRef.current = false;
            emitAnnotationEnd();
          }
        }
        
        // 预先注释下一批元素（后台处理）
        if (currentElement) {
          console.log(`🚀 Triggering pre-processing for next ${preloadOffset} views`);
          preAnnotateNextElements(currentElement, preloadOffset, visibleElements);
        }
      },
      {
        rootMargin: '500px', // 提前500px开始注释
        threshold: 0,
      }
    );
  }, [processBatchAnnotation, preAnnotateNextElements, preloadOffset, generateViewId, checkCurrentViewAnnotationStatus, emitAnnotationEnd]);

  // 观察文本节点
  const observeTextNodes = useCallback(() => {
    if (!view || !enabledRef.current) return;

    const observer = createAnnotationObserver();
    observerRef.current = observer;
    
    // 获取所有文本节点（段落级别）
    let allNodes: HTMLElement[] = [];
    
    if (view instanceof HTMLElement) {
      allNodes = walkTextNodes(view);
    } else {
      // 处理FoliateView
      const foliateView = view as FoliateView;
      if (foliateView.renderer && typeof foliateView.renderer.getContents === 'function') {
        const contents = foliateView.renderer.getContents();
        contents.forEach((content: { doc: Document; index?: number }) => {
          if (content.doc && content.doc.body) {
            const nodes = walkTextNodes(content.doc.body);
            allNodes.push(...nodes);
          }
        });
      }
    }
    
    // 过滤掉不需要注释的元素
    const nodes = allNodes.filter(node => {
      const tagName = node.tagName.toLowerCase();
      return !['pre', 'code', 'math', 'ruby', 'style', 'script'].includes(tagName);
    });
    console.log('Observing text nodes for annotation:', nodes.length);
    
    allTextNodes.current = nodes;
    nodes.forEach(node => observer.observe(node));
  }, [view, createAnnotationObserver]);

  // 延迟批量处理
  const debouncedObserve = useCallback(() => {
    debounce(observeTextNodes, 300)();
  }, [observeTextNodes]);

  // 响应设置变化
  useEffect(() => {
    const currentEnabled = enabled && viewSettings?.wordAnnotationEnabled;
    
    if (enabledRef.current !== currentEnabled) {
      enabledRef.current = currentEnabled;
      
      if (currentEnabled) {
        debouncedObserve();
      } else {
        // 停用时清理observer
        observerRef.current?.disconnect();
      }
    }
  }, [enabled, viewSettings?.wordAnnotationEnabled, debouncedObserve]);

  // 监听view变化
  useEffect(() => {
    if (!view || !enabledRef.current) return;

    if ('renderer' in view) {
      view.addEventListener('load', debouncedObserve);
    } else {
      debouncedObserve();
    }

    return () => {
      if ('renderer' in view) {
        view.removeEventListener('load', debouncedObserve);
      }
      observerRef.current?.disconnect();
      
      // 清理超时器
      if (pageSwitchTimeoutRef.current) {
        clearTimeout(pageSwitchTimeoutRef.current);
        pageSwitchTimeoutRef.current = null;
      }
      
      // 取消当前处理
      if (cancelCurrentProcessing.current) {
        cancelCurrentProcessing.current();
        cancelCurrentProcessing.current = null;
      }
      
      // 在cleanup中使用当前ref值
      const annotatedElementsRef = annotatedElements.current;
      const processingQueueRef = processingQueue.current;
      const preProcessingQueueRef = preProcessingQueue.current;
      const viewAnnotationStatusRef = viewAnnotationStatus.current;
      const pendingViewElementsRef = pendingViewElements.current;
      const llmRequestsRef = llmRequestsInProgress.current;
      
      annotatedElementsRef.clear();
      processingQueueRef.clear();
      preProcessingQueueRef.clear();
      viewAnnotationStatusRef.clear();
      pendingViewElementsRef.clear();
      llmRequestsRef.clear();
      
      // 重置LLM状态
      hasStartedLLMRequests.current = false;
      
      console.log('🧹 Cleaned up all annotation state including LLM tracking');
    };
  }, [view, debouncedObserve]);

  return {
    annotateElement,
    clearAnnotatedElements,
  };
}
