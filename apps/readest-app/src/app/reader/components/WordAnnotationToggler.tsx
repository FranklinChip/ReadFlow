import React, { useEffect, useState, useCallback } from 'react';
import { LuWholeWord } from 'react-icons/lu';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
import { saveViewSettings } from '../utils/viewSettingsHelper';
import Button from '@/components/Button';

const WordAnnotationToggler = ({ bookKey }: { bookKey: string }) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getViewSettings, setViewSettings, setHoveredBookKey, getView } = useReaderStore();

  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey)!;
  const [wordAnnotationEnabled, setWordAnnotationEnabled] = useState(
    viewSettings.wordAnnotationEnabled,
  );
  const [wordAnnotationAvailable, setWordAnnotationAvailable] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleToggleClick = useCallback(() => {
    const newState = !wordAnnotationEnabled;
    
    // 设置新状态
    setWordAnnotationEnabled(newState);
    
    // 触发实时注释事件
    if (newState) {
      window.dispatchEvent(new CustomEvent('real-time-annotation-request', {
        detail: { bookKey, type: 'both' }
      }));
    }
  }, [wordAnnotationEnabled, bookKey]);

  useEffect(() => {
    if (wordAnnotationEnabled === viewSettings.wordAnnotationEnabled) return;
    if (appService?.isMobile) {
      setHoveredBookKey('');
    }
    saveViewSettings(envConfig, bookKey, 'wordAnnotationEnabled', wordAnnotationEnabled, true, false);
    viewSettings.wordAnnotationEnabled = wordAnnotationEnabled;
    setViewSettings(bookKey, { ...viewSettings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordAnnotationEnabled]);

  useEffect(() => {
    setWordAnnotationEnabled(viewSettings.wordAnnotationEnabled);
  }, [viewSettings.wordAnnotationEnabled]);

  // Check if word annotation is available asynchronously
  useEffect(() => {
    const checkAvailability = () => {
      // 通过 readerStore 获取当前视图
      const view = getView(bookKey);
      if (!view?.renderer) {
        setWordAnnotationAvailable(false);
        return;
      }

      try {
        // 通过 renderer.getContents() 获取当前内容
        const contents = view.renderer.getContents();
        let hasTextContent = false;
        
        if (contents && contents.length > 0) {
          // 获取第一个内容的文档
          const currentDoc = contents[0]?.doc;
          if (currentDoc) {
            // 检查是否有文本内容（段落、句子等）
            const textElements = currentDoc.querySelectorAll('p, div, span, section');
            hasTextContent = textElements.length > 0;
          }
        }
        
        setWordAnnotationAvailable(hasTextContent);
      } catch (error) {
        console.warn('Error checking text content:', error);
        setWordAnnotationAvailable(false);
      }
    };
    
    // 立即检查一次
    checkAvailability();
    
    // 如果还没有找到文本内容，设置一个延迟检查
    const timer = setTimeout(checkAvailability, 1000);
    
    return () => clearTimeout(timer);
  }, [bookData, wordAnnotationEnabled, bookKey, getView]);

  // 监听LLM注释状态
  useEffect(() => {
    const handleAnnotationStart = () => setIsWaiting(true);
    const handleAnnotationEnd = () => setIsWaiting(false);

    window.addEventListener('llm-annotation-start', handleAnnotationStart);
    window.addEventListener('llm-annotation-end', handleAnnotationEnd);

    return () => {
      window.removeEventListener('llm-annotation-start', handleAnnotationStart);
      window.removeEventListener('llm-annotation-end', handleAnnotationEnd);
    };
  }, []);

  return (
    <Button
      icon={
        isWaiting ? (
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        ) : (
          <LuWholeWord className={wordAnnotationEnabled ? 'text-blue-500' : 'text-base-content'} />
        )
      }
      disabled={!wordAnnotationAvailable || isWaiting}
      onClick={handleToggleClick}
      tooltip={
        wordAnnotationAvailable
          ? isWaiting
            ? _('Processing Words...')
            : wordAnnotationEnabled
            ? _('Disable Word Annotation')
            : _('Enable Word Annotation')
          : _('Word Annotation Not Available')
      }
      tooltipDirection='bottom'
    ></Button>
  );
};

export default WordAnnotationToggler;
