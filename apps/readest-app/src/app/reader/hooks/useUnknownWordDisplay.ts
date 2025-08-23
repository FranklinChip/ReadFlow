import { useCallback, useEffect, useRef } from 'react';
import { FoliateView } from '@/types/view';
import { useAnnotationCSS } from './useAnnotationCSS';
import { useVocabularyStore } from '@/store/vocabularyStore';
import { eventDispatcher } from '@/utils/event';

export function useUnknownWordDisplay(bookKey: string, view: FoliateView | HTMLElement | null) {
  const processedDocsRef = useRef<Set<Document>>(new Set());
  const { generateCSS, settings } = useAnnotationCSS(bookKey);
  const { hasWord } = useVocabularyStore();

  const updateSpecificWord = useCallback((targetLemma: string, wordType: 'word' | 'phrase', isKnown: boolean) => {
    if (!view || !settings?.wordAnnotationEnabled) return;

    const updateElementsInDoc = (doc: Document) => {
      if (wordType === 'word') {
        const rubies = doc.querySelectorAll('ruby.word');
        
        rubies.forEach((ruby) => {
          const element = ruby as HTMLElement;
          
          // 直接使用 ruby 标签的 lemma 属性
          const elementLemma = element.getAttribute('lemma');
          
          // 检查是否是我们要更新的单词
          if (elementLemma === targetLemma) {
            if (isKnown) {
              element.classList.add('known');
              element.classList.remove('unknown');
            } else {
              element.classList.add('unknown');
              element.classList.remove('known');
            }
          }
        });
      } else if (wordType === 'phrase') {
        // 处理新的词组结构（MWE 和 PROPN）
        const mweSpans = doc.querySelectorAll('.mwe, .PROPN');
        
        mweSpans.forEach((span) => {
          const element = span as HTMLElement;
          
          // 获取词组的文本内容（从ruby标签中提取）
          const rubyElements = element.querySelectorAll('ruby');
          const phraseWords: string[] = [];
          
          rubyElements.forEach((ruby) => {
            const text = ruby.textContent?.trim();
            if (text) {
              phraseWords.push(text);
            }
          });
          
          const phraseText = phraseWords.join(' ').toLowerCase().trim();
          
          // 检查是否是我们要更新的词组
          if (phraseText === targetLemma.toLowerCase()) {
            if (isKnown) {
              element.classList.add('known');
              element.classList.remove('unknown');
            } else {
              element.classList.add('unknown');
              element.classList.remove('known');
            }
          }
        });
      }
    };

    if ('renderer' in view && view.renderer && typeof view.renderer.getContents === 'function') {
      const contents = view.renderer.getContents();
      contents.forEach(({ doc }) => {
        if (doc) {
          updateElementsInDoc(doc);
        }
      });
    } else if (view instanceof HTMLElement) {
      const doc = view.ownerDocument;
      if (doc) {
        updateElementsInDoc(doc);
      }
    }
  }, [view, settings?.wordAnnotationEnabled]);

  const classifyUnknownWords = useCallback((doc: Document) => {
    // 清除已处理文档缓存以确保重新分类
    const processedDocs = processedDocsRef.current;
    processedDocs.clear();
    processedDocs.add(doc);

    // 处理单词 ruby 标签
    const wordRubies = doc.querySelectorAll('ruby.word');
    wordRubies.forEach((ruby) => {
      const element = ruby as HTMLElement;
      
      // 直接使用 ruby 标签的 lemma 属性
      const lemma = element.getAttribute('lemma');
      
      // 基于词汇表判断已知/未知
      if (lemma && hasWord(lemma)) {
        element.classList.add('known');
        element.classList.remove('unknown');
      } else {
        element.classList.add('unknown');
        element.classList.remove('known');
      }
    });

    // 处理词组（MWE）和专有名词（PROPN）- 新的span结构
    if (settings?.phraseAnnotationEnabled) {
      const mweSpans = doc.querySelectorAll('.mwe, .PROPN');
      mweSpans.forEach((span) => {
        const element = span as HTMLElement;
        
        // 获取词组的文本内容（从ruby标签中提取）
        const rubyElements = element.querySelectorAll('ruby');
        const phraseWords: string[] = [];
        
        rubyElements.forEach((ruby) => {
          const text = ruby.textContent?.trim();
          if (text) {
            phraseWords.push(text);
          }
        });
        
        const phraseText = phraseWords.join(' ').toLowerCase().trim();
        
        // 基于词汇表判断已知/未知
        if (phraseText && hasWord(phraseText)) {
          element.classList.add('known');
          element.classList.remove('unknown');
        } else {
          element.classList.add('unknown');
          element.classList.remove('known');
        }
      });
    }
  }, [settings?.phraseAnnotationEnabled, hasWord]);

  const injectCSS = useCallback((doc: Document) => {
    const id = 'annotation-styles';
    const existingStyle = doc.getElementById(id);
    
    // 总是更新CSS以反映最新设置
    if (existingStyle) {
      existingStyle.textContent = generateCSS();
    } else {
      const style = doc.createElement('style');
      style.id = id;
      style.textContent = generateCSS();
      doc.head.appendChild(style);
    }
  }, [generateCSS]);

  const processDocuments = useCallback(() => {
    if (!view) return;

    if ('renderer' in view && view.renderer && typeof view.renderer.getContents === 'function') {
      const contents = view.renderer.getContents();
      contents.forEach(({ doc }) => {
        if (doc) {
          // 总是注入CSS以反映最新设置
          injectCSS(doc);
          // 只有在启用词汇标注时才分类单词
          if (settings?.wordAnnotationEnabled) {
            classifyUnknownWords(doc);
          }
        }
      });
    } else if (view instanceof HTMLElement) {
      const doc = view.ownerDocument;
      if (doc) {
        // 总是注入CSS以反映最新设置
        injectCSS(doc);
        // 只有在启用词汇标注时才分类单词
        if (settings?.wordAnnotationEnabled) {
          classifyUnknownWords(doc);
        }
      }
    }
  }, [view, settings, classifyUnknownWords, injectCSS]);

  useEffect(() => {
    processDocuments();
  }, [processDocuments]);

  // 监听词汇表变更事件
  useEffect(() => {
    const handleVocabularyChange = () => {
      // 清除处理缓存并重新处理所有文档（全局更新）
      processedDocsRef.current.clear();
      processDocuments();
    };

    const handleLocalVocabularyChange = (event: CustomEvent) => {
      // 只更新特定单词，无需重新处理整个文档
      const { lemma, wordType, isAdded } = event.detail;
      updateSpecificWord(lemma, wordType, isAdded);
    };

    const handleSettingsChange = () => {
      // 设置变更时只更新当前页面的CSS和分类
      processDocuments();
    };

    eventDispatcher.on('vocabulary-changed', handleVocabularyChange);
    eventDispatcher.on('vocabulary-changed-local', handleLocalVocabularyChange);
    eventDispatcher.on('annotation-settings-changed', handleSettingsChange);
    
    return () => {
      eventDispatcher.off('vocabulary-changed', handleVocabularyChange);
      eventDispatcher.off('vocabulary-changed-local', handleLocalVocabularyChange);
      eventDispatcher.off('annotation-settings-changed', handleSettingsChange);
    };
  }, [processDocuments, updateSpecificWord]);

  return {
    processDocuments,
    classifyUnknownWords,
    updateSpecificWord,
  };
}
