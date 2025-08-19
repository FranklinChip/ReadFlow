import { useCallback, useEffect, useRef } from 'react';
import { FoliateView } from '@/types/view';
import { useReaderStore } from '@/store/readerStore';
import { getAnnotationProvider, AnnotationResponse } from '@/services/annotationLLMs';
import { getFromCache, storeInCache } from '@/services/annotationLLMs/cache';
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
    preloadOffset = 2
  } = options;

  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);

  const enabledRef = useRef(enabled && viewSettings?.wordAnnotationEnabled);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const annotatedElements = useRef<Set<HTMLElement>>(new Set());
  const allTextNodes = useRef<HTMLElement[]>([]);
  const processingQueue = useRef<Set<HTMLElement>>(new Set());

  // 创建ruby标签注释
  const createRubyAnnotations = useCallback((text: string, annotations: AnnotationResponse): string => {
    let resultText = text;
    
    // 按照优先级处理: 先长词组，再短词，最后单词
    const allItems = [
      ...annotations.mwes.map(mwe => ({ ...mwe, type: 'mwe', text: mwe.phrase })),
      ...annotations.proper_nouns.map(pn => ({ ...pn, type: 'proper_noun', text: pn.word })),
      ...annotations.words.map(word => ({ ...word, type: 'word', text: word.word }))
    ].sort((a, b) => b.text.length - a.text.length);

    const processedRanges: Array<[number, number]> = [];

    const isProcessed = (start: number, end: number): boolean => {
      return processedRanges.some(([pStart, pEnd]) => !(end <= pStart || start >= pEnd));
    };

    for (const item of allItems) {
      if (!item.text) continue;
      
      // 安全地转义正则表达式特殊字符
      const escapedText = item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escapedText}\\b`, 'gi');
      let match;
      
      while ((match = pattern.exec(resultText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
        if (isProcessed(start, end)) continue;

        let rubyTag = '';
        const matchedText = match[0];
        
        if (item.type === 'mwe') {
          const mwe = item as { text: string; phrase: string; lemma: string; zh: string; en: string };
          rubyTag = `<ruby class="mwe" lemma="${mwe.lemma || mwe.phrase}">${matchedText}<rt class="en-meaning">${mwe.en || ''}</rt><rt class="zh-meaning">${mwe.zh || ''}</rt></ruby>`;
        } else if (item.type === 'proper_noun') {
          const pn = item as { text: string; word: string; zh: string; en: string };
          rubyTag = `<ruby class="word" lemma="${pn.word.toLowerCase()}" pos="PROPN">${matchedText}<rt class="en-meaning">${pn.en || ''}</rt><rt class="zh-meaning">${pn.zh || ''}</rt></ruby>`;
        } else {
          const word = item as { text: string; word: string; lemma?: string; pos?: string; zh: string; en: string };
          rubyTag = `<ruby class="word" lemma="${word.lemma || word.word}" pos="${word.pos || 'WORD'}">${matchedText}<rt class="en-meaning">${word.en || ''}</rt><rt class="zh-meaning">${word.zh || ''}</rt></ruby>`;
        }
        
        // 从后往前替换，避免索引偏移
        resultText = resultText.slice(0, start) + rubyTag + resultText.slice(end);
        processedRanges.push([start, start + rubyTag.length]);
        
        // 重置正则表达式位置，因为字符串长度改变了
        pattern.lastIndex = 0;
        break; // 处理完这个匹配后重新开始
      }
    }

    return resultText;
  }, []);

  // 带重试机制的注释处理
  const annotateWithRetry = useCallback(async (text: string, attempts = 0): Promise<AnnotationResponse | null> => {
    try {
      // 先检查缓存
      const cachedResult = await getFromCache(text);
      if (cachedResult) {
        return cachedResult;
      }

      // 调用LLM服务
      const annotationProvider = getAnnotationProvider(provider);
      if (!annotationProvider) {
        throw new Error(`Annotation provider '${provider}' not found`);
      }

      const result = await annotationProvider.annotate(text);
      
      // 缓存结果
      await storeInCache(text, result);
      
      return result;
    } catch (error) {
      console.error(`Annotation attempt ${attempts + 1} failed:`, error);
      
      if (attempts < retryAttempts) {
        // 指数退避重试
        const delay = retryDelay * Math.pow(2, attempts);
        await new Promise(resolve => setTimeout(resolve, delay));
        return annotateWithRetry(text, attempts + 1);
      }
      
      // 重试次数用完，返回null
      console.error('All annotation attempts failed for text:', text.substring(0, 100));
      return null;
    }
  }, [provider, retryAttempts, retryDelay]);

  // 处理单个元素
  const annotateElement = useCallback(async (element: HTMLElement): Promise<void> => {
    if (!enabledRef.current) return;
    
    // 检查是否已经注释过
    if (annotatedElements.current.has(element)) return;
    
    // 检查是否正在处理
    if (processingQueue.current.has(element)) return;
    
    // 检查是否已有ruby标签
    if (element.querySelector('ruby.word, ruby.mwe')) return;

    const text = element.textContent?.trim();
    if (!text || text.length < 3) return;

    // 添加到处理队列
    processingQueue.current.add(element);

    try {
      const annotations = await annotateWithRetry(text);
      
      if (annotations && enabledRef.current) {
        // 创建注释的HTML
        const annotatedHTML = createRubyAnnotations(text, annotations);
        
        // 替换元素内容
        element.innerHTML = annotatedHTML;
        
        // 标记为已注释
        annotatedElements.current.add(element);
      }
    } catch (error) {
      console.error('Failed to annotate element:', error);
    } finally {
      // 从处理队列中移除
      processingQueue.current.delete(element);
    }
  }, [annotateWithRetry, createRubyAnnotations]);

  // 预先注释接下来的元素
  const preAnnotateNextElements = useCallback((currentElement: HTMLElement, count: number) => {
    if (!allTextNodes.current || count <= 0) return;
    
    const currentIndex = allTextNodes.current.indexOf(currentElement);
    if (currentIndex === -1) return;

    const nextElements = allTextNodes.current.slice(currentIndex + 1, currentIndex + 1 + count);
    nextElements.forEach((element, index) => {
      // 分散处理时间，避免阻塞
      setTimeout(() => {
        annotateElement(element);
      }, index * 200);
    });
  }, [annotateElement]);

  // 创建IntersectionObserver
  const createAnnotationObserver = useCallback(() => {
    return new IntersectionObserver(
      (entries) => {
        let currentElement: HTMLElement | null = null;
        
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            annotateElement(element);
            currentElement = element;
          }
        }
        
        // 预先注释下一批元素
        if (currentElement) {
          preAnnotateNextElements(currentElement, preloadOffset);
        }
      },
      {
        rootMargin: '500px', // 提前500px开始注释
        threshold: 0,
      }
    );
  }, [annotateElement, preAnnotateNextElements, preloadOffset]);

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
  const debouncedObserve = useCallback(
    debounce(observeTextNodes, 300),
    [observeTextNodes]
  );

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
      // 在cleanup中使用当前ref值
      annotatedElements.current.clear();
      processingQueue.current.clear();
    };
  }, [view, debouncedObserve]);

  return {
    annotateElement,
    annotatedCount: annotatedElements.current.size,
    processingCount: processingQueue.current.size,
  };
}
