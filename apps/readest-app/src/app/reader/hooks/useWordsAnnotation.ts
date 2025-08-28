import { useCallback, useEffect, useRef } from 'react';
import { FoliateView } from '@/types/view';
import { useReaderStore } from '@/store/readerStore';
import { useVocabularyStore } from '@/store/vocabularyStore';
import { getAnnotationProvider, WordAnnotation, ProperNounAnnotation, MWEAnnotation, TokenUsage } from '@/services/annotationLLMs';
import { walkTextNodes } from '@/utils/walk';
import { debounce } from '@/utils/debounce';
import { getLocale } from '@/utils/misc';

interface UseWordsAnnotationOptions {
  provider?: string;
  enabled?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
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
    retryDelay = 1000
  } = options;

  const { getViewSettings, getViewState, getProgress } = useReaderStore();
  const { hasWord } = useVocabularyStore();
  const viewSettings = getViewSettings(bookKey);
  const viewState = getViewState(bookKey);
  const progress = getProgress(bookKey);

  const enabledRef = useRef(enabled && viewSettings?.wordAnnotationEnabled);
  const currentLangRef = useRef(viewSettings?.wordAnnotationLanguage);
  const currentProviderRef = useRef(provider);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const annotatedElements = useRef<HTMLElement[]>([]);
  const allTextNodes = useRef<HTMLElement[]>([]);
  const processingQueue = useRef<Set<HTMLElement>>(new Set());

  // 切换注释可见性（这个好像没用）
  const toggleAnnotationVisibility = useCallback((visible: boolean) => {
    annotatedElements.current.forEach((element) => {
      const annotationTargets = element.querySelectorAll('ruby.word');
      annotationTargets.forEach((target) => {
        if (visible) {
          target.classList.remove('hidden');
        } else {
          target.classList.add('hidden');
        }
      });
    });
  }, []);

  // 观察文本节点（类似translation的observeTextNodes）
  const observeTextNodes = useCallback(() => {
    if (!view || !enabledRef.current) return;
    
    const observer = createAnnotationObserver();
    observerRef.current = observer;
    const nodes = walkTextNodes(view);
    console.log('Observing text nodes for annotation:', nodes.length);
    allTextNodes.current = nodes;
    nodes.forEach((el) => observer.observe(el));
  }, [view]);

  // 更新注释（类似translation的updateTranslation）
  const updateAnnotation = useCallback(() => {
    annotatedElements.current.forEach((element) => {
      // 完全恢复到原始状态 - 类似useTextTranslation的清理方式
      if (element.hasAttribute('original-text-stored')) {
        const originalTexts = JSON.parse(element.getAttribute('original-text-nodes') || '[]');
        
        // 清除所有子元素，恢复原始文本节点
        element.innerHTML = '';
        originalTexts.forEach((text: string) => {
          element.appendChild(document.createTextNode(text));
        });
        
        element.removeAttribute('original-text-stored');
        element.removeAttribute('original-text-nodes');
      } else {
        // 如果没有存储原始文本，尝试提取纯文本内容
        const textContent = element.textContent || '';
        element.innerHTML = '';
        element.appendChild(document.createTextNode(textContent));
      }
      
      // 清理注释相关的类名和属性
      element.classList.remove('annotated', 'processing-annotation');
      element.removeAttribute('word-annotation-mark');
    });

    annotatedElements.current = [];
  }, []);

  // 创建注释观察器（类似translation的createTranslationObserver）
  const createAnnotationObserver = useCallback(() => {
    return new IntersectionObserver(
      (entries) => {
        let beforeIntersectedElement: HTMLElement | null = null;
        let lastIntersectedElement: HTMLElement | null = null;
        
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            if (!lastIntersectedElement) {
              beforeIntersectedElement = entry.target as HTMLElement;
            }
            continue;
          }
          
          const currentElement = entry.target as HTMLElement;
          annotateElement(currentElement);
          lastIntersectedElement = currentElement;
        }
        
        if (beforeIntersectedElement) {
          annotateElement(beforeIntersectedElement);
        }
        
        if (lastIntersectedElement) {
          preAnnotateNextElements(lastIntersectedElement, 2);
        }
      },
      {
        rootMargin: '1280px',
        threshold: 0,
      }
    );
  }, []);

  // 预注释下一批元素（类似translation的preTranslateNextElements）
  const preAnnotateNextElements = useCallback((currentElement: HTMLElement, count: number) => {
    if (!allTextNodes.current || count <= 0) return;
    
    const currentIndex = allTextNodes.current.indexOf(currentElement);
    if (currentIndex === -1) return;

    const nextElements = allTextNodes.current.slice(currentIndex + 1, currentIndex + 1 + count);
    nextElements.forEach((element, index) => {
      setTimeout(() => {
        annotateElement(element);
      }, index * 1000); 
    });
  }, []);

  // 重新创建注释观察器（类似translation的recreateTranslationObserver）
  const recreateAnnotationObserver = useCallback(() => {
    const observer = createAnnotationObserver();
    observerRef.current?.disconnect();
    observerRef.current = observer;
    allTextNodes.current.forEach((el) => observer.observe(el));
  }, [createAnnotationObserver]);

  // 检查元素是否已被注释
  const isElementAnnotated = useCallback((element: HTMLElement): boolean => {
    return element.hasAttribute('word-annotation-mark') || 
           element.querySelectorAll('ruby.word').length > 0 ||
           element.classList.contains('annotated') ||
           element.classList.contains('processing-annotation');
  }, []);

  // 文本 token 化函数 - 简化版本：单词和符号分别作为token
  const tokenizeText = useCallback((text: string): string[] => {
    // 首先处理换行符问题：将\n替换为空格，避免单词被错误合并
    const normalizedText = text.replace(/\n/g, ' ');
    
    const tokens: string[] = [];
    const regex = /(\s+)|(\w+|[^\w\s])/g;
    let match;
    
    while ((match = regex.exec(normalizedText)) !== null) {
      if (match[1]) {
        tokens.push(match[1]); // 空白字符
      } else if (match[2]) {
        tokens.push(match[2]); // 单词或符号
      }
    }
    
    return tokens;
  }, []);

  // 创建单个单词的ruby标签
  const createSingleWordRuby = useCallback((word: string, annotation: WordAnnotation, index: number, targetLang: string): string => {
    const langClass = targetLang === 'zh-CN' ? 'zh' : targetLang === 'en' ? 'en' : targetLang;
    const posAttr = annotation.pos ? ` pos="${annotation.pos}"` : '';
    
    // 基于词汇表判断已知/未知状态
    const isKnown = hasWord(annotation.lemma);
    const knownClass = isKnown ? 'known' : 'unknown';
    
    return `<ruby class="annotation-node word ${knownClass}" lemma="${annotation.lemma}"${posAttr} data-word-index="${index}">${word}<rt class="${langClass} annotation-target">${annotation.annotation}</rt></ruby>`;
  }, [hasWord]);

  // 标准化文本函数，处理中英文引号等字符差异
  const normalizeText = useCallback((text: string): string => {
    return text
      .toLowerCase()
      // 统一各种引号
      .replace(/[''`]/g, "'")      // 将中文单引号、反引号统一为英文单引号
      .replace(/[""]/g, '"')       // 将中文双引号统一为英文双引号
      // 去除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }, []);

  // 顺序匹配单词的函数 - 新版本：从前往后顺序匹配，连续3次失败后跳过
  const createOrderedWordRubyAnnotations = useCallback((text: string, annotations: { words: WordAnnotation[] }, targetLang: string): string => {
    const tokens = tokenizeText(text);
    const llmWords = annotations.words;
    
    const resultTokens = [...tokens];
    let llmIndex = 0;
    let tokenIndex = 0;
    let wordIndex = 0;
    let totalMatched = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    const processedRanges: Set<number> = new Set();

    while (llmIndex < llmWords.length && tokenIndex < tokens.length) {
      const currentWord = llmWords[llmIndex];
      if (!currentWord) {
        llmIndex++;
        continue;
      }

      let found = false;
      let currentFailureStartToken = tokenIndex; // 记录本次单词开始搜索的位置

      // 从当前位置开始向前搜索，但限制搜索范围
      const maxSearchDistance = 10; // 最多向前搜索10个token
      const searchEnd = Math.min(tokenIndex + maxSearchDistance, tokens.length);

      for (let searchIndex = tokenIndex; searchIndex < searchEnd; searchIndex++) {
        if (processedRanges.has(searchIndex)) {
          continue;
        }

        const token = tokens[searchIndex];
        if (!token || /^\s+$/.test(token)) {
          continue;
        }
        
        const tokenLower = normalizeText(token);
        const wordLower = normalizeText(currentWord.word);

        // 1. 单token匹配
        if (tokenLower === wordLower) {
          resultTokens[searchIndex] = createSingleWordRuby(token, currentWord, wordIndex, targetLang);
          processedRanges.add(searchIndex);
          wordIndex++;
          totalMatched++;
          tokenIndex = searchIndex + 1;
          consecutiveFailures = 0; // 重置连续失败计数
          found = true;
          break;
        }

        // 2. 新增：LLM单词token化匹配 - 处理像"grown-up"这样的复合词
        const llmWordTokens = tokenizeText(currentWord.word);
        if (llmWordTokens.length > 1 && llmWordTokens.length <= 4) {
          // 检查是否有足够的原文token来匹配
          const endIndex = searchIndex + llmWordTokens.length;
          if (endIndex <= tokens.length) {
            // 检查范围内的token是否已被处理
            let hasProcessedToken = false;
            for (let i = searchIndex; i < endIndex; i++) {
              if (processedRanges.has(i)) {
                hasProcessedToken = true;
                break;
              }
            }
            
            if (!hasProcessedToken) {
              // 提取原文对应范围的token
              const originalTokens = tokens.slice(searchIndex, endIndex);
              
              // 逐个比较token（都标准化后比较）
              let allMatch = true;
              for (let i = 0; i < llmWordTokens.length; i++) {
                const llmToken = normalizeText(llmWordTokens[i] || '');
                const originalToken = normalizeText(originalTokens[i] || '');
                if (llmToken !== originalToken) {
                  allMatch = false;
                  break;
                }
              }
              
              if (allMatch) {
                // 创建跨token的ruby标签，保持原始token的组合显示
                const combinedDisplay = originalTokens.join('');
                const multiTokenRuby = createSingleWordRuby(combinedDisplay, currentWord, wordIndex, targetLang);
                
                // 在第一个token位置创建ruby标签
                resultTokens[searchIndex] = multiTokenRuby;
                // 标记其他token位置为已处理（设为空字符串）
                for (let i = searchIndex + 1; i < endIndex; i++) {
                  resultTokens[i] = '';
                  processedRanges.add(i);
                }
                
                processedRanges.add(searchIndex);
                wordIndex++;
                totalMatched++;
                tokenIndex = endIndex;
                consecutiveFailures = 0;
                found = true;
                break;
              }
            }
          }
        }

        // 3. 跨token合并匹配 (2-4个token) - 只匹配真正需要合并的情况
        for (let combineLength = 2; combineLength <= Math.min(4, searchEnd - searchIndex); combineLength++) {
          const endIndex = searchIndex + combineLength;
          
          // 检查组合范围内的token是否已被处理
          let hasProcessedToken = false;
          for (let i = searchIndex; i < endIndex; i++) {
            if (processedRanges.has(i)) {
              hasProcessedToken = true;
              break;
            }
          }
          
          if (hasProcessedToken) {
            continue;
          }

          // 提取并合并token
          const combineTokens = tokens.slice(searchIndex, endIndex);
          const combinedText = normalizeText(combineTokens.join(''));
          const combinedDisplay = combineTokens.join('');

          // 关键修复：严格检查这个组合是否真的有意义
          // 1. 如果组合后的文本包含空格，且LLM单词不包含空格，则跳过
          const hasSpaceInCombined = combinedDisplay.includes(' ');
          const hasSpaceInWord = currentWord.word.includes(' ');
          
          if (hasSpaceInCombined && !hasSpaceInWord) {
            continue;
          }

          // 2. 检查是否包含多个单词token（非标点符号、非空格）
          const wordTokensInCombine = combineTokens.filter(t => t && !/^\s+$/.test(t) && /\w/.test(t));
          if (wordTokensInCombine.length > 1 && !hasSpaceInWord) {
            continue;
          }

          if (combinedText === wordLower) {
            // 创建跨token的ruby标签 - 但要确保合理性
            const multiTokenRuby = createSingleWordRuby(combinedDisplay, currentWord, wordIndex, targetLang);
            
            // 只在第一个token处创建ruby标签，其他token保持原样但标记为已处理
            resultTokens[searchIndex] = multiTokenRuby;
            for (let i = searchIndex + 1; i < endIndex; i++) {
              // 保持原始token，但标记为已处理（这样不会影响其他匹配）
              processedRanges.add(i);
            }
            
            processedRanges.add(searchIndex);
            wordIndex++;
            totalMatched++;
            tokenIndex = endIndex;
            consecutiveFailures = 0; // 重置连续失败计数
            found = true;
            break;
          }
        }

        if (found) break;
      }

      if (!found) {
        consecutiveFailures++;
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          llmIndex++; // 跳过这个LLM单词
          consecutiveFailures = 0; // 重置计数
          // tokenIndex保持不变，从当前位置开始匹配下一个单词
        } else {
          // 没有达到最大失败次数，继续向前移动token指针
          tokenIndex = currentFailureStartToken + 1;
          
          // 跳过空白token
          while (tokenIndex < tokens.length && tokens[tokenIndex] && /^\s+$/.test(tokens[tokenIndex]!)) {
            tokenIndex++;
          }
          
          if (tokenIndex >= tokens.length) {
            llmIndex++;
            consecutiveFailures = 0;
          }
        }
      } else {
        llmIndex++;
      }
    }

    console.log(`🎯 Word matching completed: ${totalMatched}/${llmWords.length} words matched (${((totalMatched / llmWords.length) * 100).toFixed(1)}%)`);
    
    return resultTokens.join('');
  }, [tokenizeText, createSingleWordRuby, normalizeText]);

  // 从HTML中提取ruby单词数组（基于索引）
  const extractRubyWordsArray = useCallback((htmlText: string): string[] => {
    // 安全检查
    if (!htmlText || typeof htmlText !== 'string') {
      return [];
    }
    
    // 首先检查是否包含ruby标签
    const hasRubyTags = htmlText.includes('<ruby');
    if (!hasRubyTags) {
      return [];
    }
    
    // 检查是否包含data-word-index属性
    const hasWordIndex = htmlText.includes('data-word-index');
    if (!hasWordIndex) {
      return [];
    }
    
    const rubyWords: string[] = [];
    const rubyPattern = /<ruby[^>]*data-word-index="(\d+)"[^>]*>(.*?)<\/ruby>/gs;
    let match;
    let matchCount = 0;
    
    try {
      while ((match = rubyPattern.exec(htmlText)) !== null) {
        const wordIndex = parseInt(match[1]!, 10);
        const rubyContent = match[2]!;
        
        // 提取ruby标签内的主要单词内容（去掉rt标签）
        const wordText = rubyContent.replace(/<rt[^>]*>.*?<\/rt>/gs, '').trim();
        
        // 确保数组大小足够
        while (rubyWords.length <= wordIndex) {
          rubyWords.push('');
        }
        
        rubyWords[wordIndex] = wordText.toLowerCase();
        matchCount++;
      }
    } catch (error) {
      console.error('❌ Error during regex matching:', error);
      return [];
    }
    
    console.log(`🔍 Extracted ${matchCount} ruby words for phrase matching`);
    
    return rubyWords;
  }, []);

  // 基于索引匹配词组和专有名词
  const matchPhraseWithIndexes = useCallback((rubyWords: string[], targetPhrase: string): { startIndex: number, endIndex: number } | null => {
    const phraseWords = targetPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (phraseWords.length === 0) return null;
    
    let bestMatch: { startIndex: number, endIndex: number, matchedCount: number } | null = null;
    
    // 在ruby单词数组中寻找匹配
    for (let searchStart = 0; searchStart < rubyWords.length; searchStart++) {
      const startWord = rubyWords[searchStart];
      
      // 跳过空字符串
      if (!startWord || startWord.length === 0) {
        continue;
      }
      
      // 检查是否匹配第一个词组单词
      if (startWord === phraseWords[0]) {
        // 尝试匹配完整词组
        const matchedWords: number[] = [searchStart];
        let currentPhraseIndex = 1;
        let currentSearchIndex = searchStart + 1;
        let skippedNonEmpty = 0; // 跳过的非空单词计数
        
        while (currentPhraseIndex < phraseWords.length && currentSearchIndex < rubyWords.length) {
          const targetWord = phraseWords[currentPhraseIndex]!;
          const searchWord = rubyWords[currentSearchIndex];
          
          if (!searchWord || searchWord.length === 0) {
            // 跳过空位置
            currentSearchIndex++;
            continue;
          }
          
          if (searchWord === targetWord) {
            matchedWords.push(currentSearchIndex);
            currentPhraseIndex++;
            currentSearchIndex++;
            skippedNonEmpty = 0; // 重置跳过计数
          } else {
            // 不匹配，跳过这个单词
            currentSearchIndex++;
            skippedNonEmpty++;
            
            // 如果跳过太多不匹配的单词，放弃这次尝试
            if (skippedNonEmpty > 3) {
              break;
            }
          }
        }
        
        // 检查是否完全匹配
        if (currentPhraseIndex === phraseWords.length) {
          const startIndex = matchedWords[0]!;
          const endIndex = matchedWords[matchedWords.length - 1]!;
          return { startIndex, endIndex };
        } else {
          // 计算匹配度
          const matchRatio = currentPhraseIndex / phraseWords.length;
          
          // 如果匹配度达到70%且至少匹配了2个单词，记录为候选
          if (matchRatio >= 0.7 && currentPhraseIndex >= 2 && matchedWords.length >= 2) {
            const startIndex = matchedWords[0]!;
            const endIndex = matchedWords[matchedWords.length - 1]!;
            
            if (!bestMatch || currentPhraseIndex > bestMatch.matchedCount) {
              bestMatch = { startIndex, endIndex, matchedCount: currentPhraseIndex };
            }
          }
        }
      }
      
      // 如果当前词没有匹配第一个词组单词，但我们正在寻找后续单词（部分匹配策略）
      for (let phraseIndex = 1; phraseIndex < phraseWords.length; phraseIndex++) {
        if (startWord === phraseWords[phraseIndex]) {
          // 从这个位置开始尝试匹配剩余部分
          const matchedWords: number[] = [searchStart];
          let currentPhraseIndex = phraseIndex + 1;
          let currentSearchIndex = searchStart + 1;
          let skippedNonEmpty = 0;
          
          while (currentPhraseIndex < phraseWords.length && currentSearchIndex < rubyWords.length) {
            const targetWord = phraseWords[currentPhraseIndex]!;
            const searchWord = rubyWords[currentSearchIndex];
            
            if (!searchWord || searchWord.length === 0) {
              currentSearchIndex++;
              continue;
            }
            
            if (searchWord === targetWord) {
              matchedWords.push(currentSearchIndex);
              currentPhraseIndex++;
              currentSearchIndex++;
              skippedNonEmpty = 0;
            } else {
              currentSearchIndex++;
              skippedNonEmpty++;
              
              if (skippedNonEmpty > 3) {
                break;
              }
            }
          }
          
          // 计算总匹配数（包括之前匹配的一个词）
          const totalMatched = 1 + (currentPhraseIndex - phraseIndex - 1);
          const matchRatio = totalMatched / phraseWords.length;
          
          if (matchRatio >= 0.7 && totalMatched >= 2 && matchedWords.length >= 2) {
            const startIndex = matchedWords[0]!;
            const endIndex = matchedWords[matchedWords.length - 1]!;
            
            if (!bestMatch || totalMatched > bestMatch.matchedCount) {
              bestMatch = { startIndex, endIndex, matchedCount: totalMatched };
            }
          }
          
          break; // 只尝试第一个匹配的后续单词
        }
      }
    }
    
    if (bestMatch) {
      return { startIndex: bestMatch.startIndex, endIndex: bestMatch.endIndex };
    }
    
    return null;
  }, []);

  // 创建基于索引的词组和专有名词注释
  const createIndexBasedPhraseAnnotations = useCallback((htmlText: string, annotations: { mwes: MWEAnnotation[], proper_nouns: ProperNounAnnotation[] }, targetLang: string): string => {
    // 首先提取ruby单词数组
    const rubyWords = extractRubyWordsArray(htmlText);
    
    if (rubyWords.length === 0) {
      return htmlText;
    }
    
    // 合并处理词组和专有名词
    const allPhrases = [
      ...annotations.mwes.map(mwe => ({ ...mwe, type: 'mwe' as const, text: mwe.phrase })),
      ...annotations.proper_nouns.map(pn => ({ ...pn, type: 'proper_noun' as const, text: pn.phrase }))
    ]
      .filter(item => item.text && item.text.trim());

    // 去重逻辑：如果一个词组/专有名词包含在另一个更长的词组/专有名词中，则移除较短的
    const dedupedPhrases = [];
    const phrasesSet = new Set(allPhrases.map(p => p.text.toLowerCase().trim()));
    
    for (const phrase of allPhrases) {
      const phraseText = phrase.text.toLowerCase().trim();
      let isContained = false;
      
      // 检查是否被其他更长的词组包含
      for (const otherPhraseText of phrasesSet) {
        if (otherPhraseText !== phraseText && 
            otherPhraseText.length > phraseText.length && 
            otherPhraseText.includes(phraseText)) {
          isContained = true;
          console.log(`🔍 Phrase "${phraseText}" is contained in longer phrase "${otherPhraseText}", removing shorter one`);
          break;
        }
      }
      
      if (!isContained) {
        dedupedPhrases.push(phrase);
      }
    }
    
    // 按长度降序处理，确保长词组优先处理
    const finalPhrases = dedupedPhrases.sort((a, b) => b.text.length - a.text.length);
    
    console.log(`🎯 After deduplication: ${finalPhrases.length}/${allPhrases.length} phrases remaining`);
    if (finalPhrases.length !== allPhrases.length) {
      console.log('Remaining phrases:', finalPhrases.map(p => p.text));
    }

    let resultHTML = htmlText;
    const processedRanges = new Set<string>(); // 记录已处理的索引范围
    let processedCount = 0;
    
    const langClass = targetLang === 'zh-CN' ? 'zh' : targetLang === 'en' ? 'en' : targetLang;

    for (const item of finalPhrases) {
      const phrase = item.text.trim();
      
      // 使用索引匹配查找词组
      const match = matchPhraseWithIndexes(rubyWords, phrase);
      
      if (!match) {
        continue;
      }
      
      const { startIndex, endIndex } = match;
      const rangeKey = `${startIndex}-${endIndex}`;
      
      // 检查是否已经处理过这个范围
      if (processedRanges.has(rangeKey)) {
        continue;
      }
      
      // 标记这个范围为已处理
      processedRanges.add(rangeKey);
      
      // 找到对应的ruby标签范围
      const startPattern = new RegExp(`<ruby[^>]*data-word-index="${startIndex}"[^>]*>`, 'g');
      
      const startMatch = startPattern.exec(resultHTML);
      
      if (!startMatch) {
        continue;
      }
      
      // 找到结束位置（第endIndex个ruby标签的结束）
      let endMatch: RegExpMatchArray | null = null;
      const searchPos = startMatch.index;
      
      // 重置正则表达式的lastIndex
      const rubyEndPattern = new RegExp(`<ruby[^>]*data-word-index="(\\d+)"[^>]*>.*?</ruby>`, 'g');
      rubyEndPattern.lastIndex = searchPos;
      
      let rubyMatch;
      while ((rubyMatch = rubyEndPattern.exec(resultHTML)) !== null) {
        const currentIndex = parseInt(rubyMatch[1]!, 10);
        
        if (currentIndex === endIndex) {
          endMatch = rubyMatch;
          break;
        }
      }
      
      if (!endMatch) {
        continue;
      }
      
      const startPos = startMatch.index;
      const endPos = endMatch.index! + endMatch[0].length;
      const matchedText = resultHTML.substring(startPos, endPos);
      
      // 基于词汇表判断词组/专有名词的已知/未知状态
      // 使用原始词组文本进行判断
      const isKnown = hasWord(phrase.toLowerCase());
      const knownClass = isKnown ? 'known' : 'unknown';
      
      // 生成span标签
      let spanTag: string;
      
      if (item.type === 'proper_noun') {
        spanTag = `<span class="annotation-node PROPN ${knownClass}">${matchedText}<span class="${langClass} annotation-target">(${item.annotation})</span></span>`;
      } else {
        // MWE类型
        spanTag = `<span class="annotation-node mwe ${knownClass}">${matchedText}<span class="${langClass} annotation-target">(${item.annotation})</span></span>`;
      }
      
      // 替换
      resultHTML = resultHTML.slice(0, startPos) + spanTag + resultHTML.slice(endPos);
      processedCount++;
    }

    console.log(`🎯 Phrase matching completed: ${processedCount}/${finalPhrases.length} phrases matched`);
    return resultHTML;
  }, [extractRubyWordsArray, matchPhraseWithIndexes, hasWord]);

  // 带重试机制的单词注释处理（第一步：只获取单词）
  const annotateWordsWithRetry = useCallback(async (text: string, targetLang: string, attempts = 0): Promise<{ words: WordAnnotation[], usage?: TokenUsage } | null> => {
    try {
      const annotationProvider = getAnnotationProvider(provider);
      if (!annotationProvider) {
        throw new Error(`Annotation provider '${provider}' not found`);
      }

      console.log('❤️ Calling LLM for words:', text.substring(0, 50));
      const result = await annotationProvider.annotate(`words:${text}`, targetLang);
      
      // 打印 LLM 返回的 JSON 内容
      console.log('🔤 LLM Words Response JSON:', JSON.stringify(result, null, 2));
      
      return { words: result.words || [], usage: result.usage };
    } catch (error) {
      console.error(`Words annotation attempt ${attempts + 1} failed:`, error);
      
      if (attempts < retryAttempts) {
        const delay = retryDelay * Math.pow(2, attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        return annotateWordsWithRetry(text, targetLang, attempts + 1);
      }
      
      return { words: [] };
    }
  }, [provider, retryAttempts, retryDelay]);

  // 带重试机制的词组和专有名词注释处理（第二步：获取词组和多词专有名词）
  const annotatePhrasesAndProperNounsWithRetry = useCallback(async (text: string, targetLang: string, attempts = 0): Promise<{ mwes: MWEAnnotation[], proper_nouns: ProperNounAnnotation[], usage?: TokenUsage } | null> => {
    try {
      const annotationProvider = getAnnotationProvider(provider);
      if (!annotationProvider) {
        throw new Error(`Annotation provider '${provider}' not found`);
      }

      console.log('🏷️ Calling LLM for phrases and proper nouns:', text.substring(0, 50));
      const result = await annotationProvider.annotate(`phrases:${text}`, targetLang);
      
      // 打印 LLM 返回的 JSON 内容
      console.log('🏷️ LLM Phrases Response JSON:', JSON.stringify(result, null, 2));
      
      return { mwes: result.mwes || [], proper_nouns: result.proper_nouns || [], usage: result.usage };
    } catch (error) {
      console.error(`Phrases annotation attempt ${attempts + 1} failed:`, error);
      
      if (attempts < retryAttempts) {
        const delay = retryDelay * Math.pow(2, attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        return annotatePhrasesAndProperNounsWithRetry(text, targetLang, attempts + 1);
      }
      
      return { mwes: [], proper_nouns: [] };
    }
  }, [provider, retryAttempts, retryDelay]);

  // 注释单个元素（类似translation的translateElement）
  const annotateElement = useCallback(async (el: HTMLElement) => {
    if (!enabledRef.current) return;
    
    // 关键修复：正确处理换行符，将\n替换为空格而不是直接删除
    const text = el.textContent?.replace(/\n/g, ' ').trim();
    if (!text || text.length < 3) return;

    // 跳过已注释的元素
    if (isElementAnnotated(el)) return;

    // 跳过特定类型的元素
    if (el.classList.contains('annotation-target') || 
        ['pre', 'code', 'math', 'ruby', 'style', 'script'].includes(el.tagName.toLowerCase())) {
      return;
    }

    // 关键修复：检查是否有未完成的注释任务 - 严格等待之前的节点处理完成
    const currentlyProcessing = document.querySelectorAll('.processing-annotation');
    if (currentlyProcessing.length > 0) {
      console.log(`⏳ Waiting for ${currentlyProcessing.length} nodes to finish processing before starting new annotation`);
      
      // 等待更长时间并递归重试，确保完全完成前不开始新的注释
      setTimeout(() => {
        annotateElement(el);
      }, 2000);
      return;
    }

    // 避免重复处理
    if (processingQueue.current.has(el)) {
      console.log(`⚠️ Element already in processing queue, skipping`);
      return;
    }
    
    processingQueue.current.add(el);

    // 添加处理中标记
    el.classList.add('processing-annotation');
    console.log(`🚀 Starting annotation for element: "${text.substring(0, 50)}..."`);
    console.log(`📊 Current processing queue size: ${processingQueue.current.size}`);

    try {
      // 保存原始文本节点（类似translation的updateSourceNodes逻辑）
      const hasDirectText = Array.from(el.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== ''
      );
      
      if (hasDirectText && !el.hasAttribute('original-text-stored')) {
        const textNodes = Array.from(el.childNodes).filter(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== ''
        );
        
        el.setAttribute(
          'original-text-nodes',
          JSON.stringify(textNodes.map((node) => node.textContent))
        );
        el.setAttribute('original-text-stored', 'true');
      }

      // 获取目标语言
      const targetLang = viewSettings?.wordAnnotationLanguage || getLocale();

      // 第一步：获取单词注释（基于纯文本，按顺序）
      console.log(`🔤 Requesting word annotations for: "${text}"`);
      const wordsAnnotations = await annotateWordsWithRetry(text, targetLang);
      
      // 第二步：获取词组和多词专有名词的注释（基于同样的纯文本）
      console.log(`🏷️ Requesting phrase annotations for: "${text}"`);
      const phrasesAnnotations = await annotatePhrasesAndProperNounsWithRetry(text, targetLang);
      
      // 第三步：先处理单词，创建ruby标签（使用新的顺序匹配算法）
      let processedHTML = text;
      if (wordsAnnotations && wordsAnnotations.words.length > 0 && enabledRef.current) {
        console.log(`🔤 Processing ${wordsAnnotations.words.length} word annotations`);
        processedHTML = createOrderedWordRubyAnnotations(text, wordsAnnotations, targetLang);
        console.log('After word annotations:', processedHTML.substring(0, 200));
      }

      // 第四步：在ruby标签基础上添加词组和专有名词span包装
      if (phrasesAnnotations && (phrasesAnnotations.mwes.length > 0 || phrasesAnnotations.proper_nouns.length > 0) && 
          enabledRef.current && (viewSettings?.phraseAnnotationEnabled || viewSettings?.wordAnnotationEnabled)) {
        console.log(`🏷️ Processing ${phrasesAnnotations.mwes.length} MWEs and ${phrasesAnnotations.proper_nouns.length} proper nouns`);
        console.log('🔍 About to call createIndexBasedPhraseAnnotations');
        processedHTML = createIndexBasedPhraseAnnotations(processedHTML, phrasesAnnotations, targetLang);
        console.log('🔍 After phrase and proper noun annotations:', processedHTML.substring(0, 200));
      }

      // 第五步：更新元素内容（只有在内容发生变化时才更新）
      if (enabledRef.current && processedHTML !== text) {
        el.innerHTML = processedHTML;
        el.setAttribute('word-annotation-mark', '1');
        
        // 标记为已注释
        if (!annotatedElements.current.includes(el)) {
          annotatedElements.current.push(el);
        }
        
        // 添加完成标记，移除处理中标记
        el.classList.add('annotated');
        el.classList.remove('processing-annotation');
        
        // 触发注释开始事件
        window.dispatchEvent(new CustomEvent('annotation-start'));
        console.log(`✅ Annotation completed for element: "${text.substring(0, 50)}..."`);
        console.log('Final HTML set for element:', processedHTML.substring(0, 200));
      } else {
        console.log('No annotations found or content unchanged, skipping HTML update');
        // 即使没有注释，也要标记为已处理
        el.classList.add('annotated');
        el.classList.remove('processing-annotation');
      }
    } catch (error) {
      console.error('Failed to annotate element:', error);
      // 出错时也要移除处理中标记
      el.classList.remove('processing-annotation');
      window.dispatchEvent(new CustomEvent('annotation-error', {
        detail: { error }
      }));
    } finally {
      // 从处理队列中移除
      processingQueue.current.delete(el);
      console.log(`🏁 Element processing completed. Queue size: ${processingQueue.current.size}`);
      
      // 检查是否所有处理都完成
      if (processingQueue.current.size === 0) {
        console.log(`🎉 All annotation tasks completed!`);
        window.dispatchEvent(new CustomEvent('annotation-end'));
      }
    }
  }, [enabledRef, isElementAnnotated, annotateWordsWithRetry, annotatePhrasesAndProperNounsWithRetry, createOrderedWordRubyAnnotations, createIndexBasedPhraseAnnotations, viewSettings?.phraseAnnotationEnabled, viewSettings?.wordAnnotationEnabled]);

  // 在范围内注释（类似translation的translateInRange）
  const annotateInRange = useCallback(
    debounce((range: Range) => {
      const nodes = allTextNodes.current;
      if (nodes.length === 0) return;
      
      // 找到范围内的节点
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      
      let startIndex = -1;
      let endIndex = -1;
      
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (node === startContainer || node.contains(startContainer)) {
          if (startIndex === -1) startIndex = i;
        }
        if (node === endContainer || node.contains(endContainer)) {
          endIndex = i;
        }
      }
      
      if (startIndex === -1) return;
      if (endIndex === -1) endIndex = startIndex;
      
      const beforeStart = Math.max(0, startIndex - 2);
      const afterEnd = Math.min(nodes.length - 1, endIndex + 2);
      
      for (let i = beforeStart; i <= afterEnd; i++) {
        const node = nodes[i];
        if (node) {
          annotateElement(node);
        }
      }
    }, 500),
    [annotateElement]
  );

  // 监听TTS进度变化（类似translation的TTS监听）
  useEffect(() => {
    if (viewState?.ttsEnabled && progress && document.hidden) {
      const { range } = progress;
      annotateInRange(range);
    }
  }, [viewState?.ttsEnabled, progress, annotateInRange]);

  // 响应设置变化
  useEffect(() => {
    if (!viewSettings) return;

    const enabledChanged = enabledRef.current !== (viewSettings.wordAnnotationEnabled && enabled);
    const providerChanged = currentProviderRef.current !== provider;
    // 添加语言变化检测
    const languageChanged = currentLangRef.current !== viewSettings.wordAnnotationLanguage;

    if (enabledChanged) {
      enabledRef.current = viewSettings.wordAnnotationEnabled && enabled;
    }
    
    if (providerChanged) {
      currentProviderRef.current = provider;
    }
    
    if (languageChanged) {
      currentLangRef.current = viewSettings.wordAnnotationLanguage;
    }

    if (enabledChanged) {
      toggleAnnotationVisibility(!!enabledRef.current);
      if (enabledRef.current) {
        observeTextNodes();
      }
    } else if ((providerChanged || languageChanged) && enabledRef.current) {
      // 当provider或语言变化时重新注释（类似useTextTranslation的处理）
      console.log('🔄 Annotation settings changed (provider or language), updating annotations...');
      updateAnnotation();
      // 重新创建观察器
      if (viewSettings?.wordAnnotationEnabled && view) {
        recreateAnnotationObserver();
      }
    }
  }, [bookKey, viewSettings, enabled, provider, toggleAnnotationVisibility, observeTextNodes, updateAnnotation, recreateAnnotationObserver]);

  // 监听view变化
  useEffect(() => {
    if (!view || !enabledRef.current) return;

    if ('renderer' in view) {
      view.addEventListener('load', observeTextNodes);
    } else {
        console.log('📌 Direct view detected, observing text nodes immediately');
      observeTextNodes();
    }

    return () => {
      if ('renderer' in view) {
        view.removeEventListener('load', observeTextNodes);
      }
      observerRef.current?.disconnect();
      annotatedElements.current = [];
    };
  }, [view, observeTextNodes]);

  return {
    annotateElement,
    toggleAnnotationVisibility,
    isAnnotating: processingQueue.current.size > 0,
  };
}
