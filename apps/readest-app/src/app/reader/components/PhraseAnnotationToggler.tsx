import React, { useEffect, useState, useCallback } from 'react';
import { MdTextFields } from 'react-icons/md';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
import { saveViewSettings } from '../utils/viewSettingsHelper';
import Button from '@/components/Button';

const PhraseAnnotationToggler = ({ bookKey }: { bookKey: string }) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getViewSettings, setViewSettings, setHoveredBookKey, getView } = useReaderStore();

  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey)!;
  const [phraseAnnotationEnabled, setPhraseAnnotationEnabled] = useState(
    viewSettings.phraseAnnotationEnabled,
  );
  const [phraseAnnotationAvailable, setPhraseAnnotationAvailable] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const handleToggleClick = useCallback(() => {
    const newState = !phraseAnnotationEnabled;
    
    // 设置新状态
    setPhraseAnnotationEnabled(newState);
    
    // 如果启用了词组注释，同时触发单词注释（确保两阶段处理）
    if (newState && !viewSettings.wordAnnotationEnabled) {
      // 如果单词注释未启用，先启用单词注释
      viewSettings.wordAnnotationEnabled = true;
      setViewSettings(bookKey, { ...viewSettings });
      saveViewSettings(envConfig, bookKey, 'wordAnnotationEnabled', true, true, false);
    }
    
    // 触发实时注释事件
    if (newState) {
      window.dispatchEvent(new CustomEvent('real-time-annotation-request', {
        detail: { bookKey, type: 'both' }
      }));
    }
  }, [phraseAnnotationEnabled, viewSettings, bookKey, setViewSettings, envConfig]);

  useEffect(() => {
    if (phraseAnnotationEnabled === viewSettings.phraseAnnotationEnabled) return;
    if (appService?.isMobile) {
      setHoveredBookKey('');
    }
    saveViewSettings(envConfig, bookKey, 'phraseAnnotationEnabled', phraseAnnotationEnabled, true, false);
    viewSettings.phraseAnnotationEnabled = phraseAnnotationEnabled;
    setViewSettings(bookKey, { ...viewSettings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseAnnotationEnabled]);

  useEffect(() => {
    setPhraseAnnotationEnabled(viewSettings.phraseAnnotationEnabled);
  }, [viewSettings.phraseAnnotationEnabled]);

  // Check if phrase annotation is available asynchronously
  useEffect(() => {
    const checkAvailability = () => {
      // 通过 readerStore 获取当前视图
      const view = getView(bookKey);
      console.log('PhraseAnnotationToggler - view:', view);
      
      if (!view?.renderer) {
        console.log('PhraseAnnotationToggler - no renderer');
        setPhraseAnnotationAvailable(false);
        return;
      }

      try {
        // 通过 renderer.getContents() 获取当前内容
        const contents = view.renderer.getContents();
        console.log('PhraseAnnotationToggler - contents:', contents);
        
        let hasTextContent = false;
        
        if (contents && contents.length > 0) {
          // 获取第一个内容的文档
          const currentDoc = contents[0]?.doc;
          if (currentDoc) {
            // 检查是否有文本内容（段落、句子等）
            const textElements = currentDoc.querySelectorAll('p, div, span, section');
            hasTextContent = textElements.length > 0;
            console.log('PhraseAnnotationToggler - text elements found:', textElements.length);
          }
        }
        
        setPhraseAnnotationAvailable(hasTextContent);
        console.log('PhraseAnnotationToggler - availability set to:', hasTextContent);
      } catch (error) {
        console.warn('Error checking text content:', error);
        setPhraseAnnotationAvailable(false);
      }
    };
    
    // 立即检查一次
    checkAvailability();
    
    // 如果还没有找到文本内容，设置一个延迟检查
    const timer = setTimeout(checkAvailability, 1000);
    
    return () => clearTimeout(timer);
  }, [bookData, phraseAnnotationEnabled, bookKey, getView]);

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

  console.log('PhraseAnnotationToggler rendering:', {
    bookKey,
    phraseAnnotationEnabled,
    phraseAnnotationAvailable,
    isWaiting
  });

  return (
    <Button
      icon={
        isWaiting ? (
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        ) : (
          <MdTextFields className={phraseAnnotationEnabled ? 'text-blue-500' : 'text-base-content'} />
        )
      }
      disabled={!phraseAnnotationAvailable || isWaiting}
      onClick={handleToggleClick}
      tooltip={
        phraseAnnotationAvailable
          ? isWaiting
            ? _('Processing Phrases...')
            : phraseAnnotationEnabled
            ? _('Disable Phrase Annotation')
            : _('Enable Phrase Annotation')
          : _('Phrase Annotation Not Available')
      }
      tooltipDirection='bottom'
    />
  );
};

export default PhraseAnnotationToggler;
