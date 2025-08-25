import React, { useEffect, useState, useCallback } from 'react';
import { TbCircleLetterA } from 'react-icons/tb';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useBookDataStore } from '@/store/bookDataStore';
import { saveViewSettings } from '../utils/viewSettingsHelper';
import Button from '@/components/Button';

const AnnotationToggler = ({ bookKey }: { bookKey: string }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getViewSettings, setViewSettings, getView } = useReaderStore();

  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey)!;
  const [annotationEnabled, setAnnotationEnabled] = useState(viewSettings.wordAnnotationEnabled!);
  const [annotationAvailable, setAnnotationAvailable] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);

  const handleToggleClick = useCallback(() => {
    const newState = !annotationEnabled;
    
    // 设置新状态
    setAnnotationEnabled(newState);
    
    // 保存设置
    const updatedSettings = {
      ...viewSettings,
      wordAnnotationEnabled: newState,
      phraseAnnotationEnabled: newState
    };
    
    setViewSettings(bookKey, updatedSettings);
    saveViewSettings(envConfig, bookKey, 'wordAnnotationEnabled', newState, true, false);
    saveViewSettings(envConfig, bookKey, 'phraseAnnotationEnabled', newState, true, false);
  }, [annotationEnabled, bookKey, viewSettings, setViewSettings, envConfig]);

  // Check if annotation is available asynchronously
  useEffect(() => {
    const checkAvailability = () => {
      // 通过 readerStore 获取当前视图
      const view = getView(bookKey);
      
      if (!view?.renderer) {
        setAnnotationAvailable(false);
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
        
        setAnnotationAvailable(hasTextContent);
      } catch (error) {
        console.warn('Error checking text content:', error);
        setAnnotationAvailable(false);
      }
    };
    
    // 立即检查一次
    checkAvailability();
    
    // 如果还没有找到文本内容，设置一个延迟检查
    const timer = setTimeout(checkAvailability, 1000);
    
    return () => clearTimeout(timer);
  }, [bookData, annotationEnabled, bookKey, getView]);

  // 监听注释状态
  useEffect(() => {
    const handleAnnotationStart = () => setIsAnnotating(true);
    const handleAnnotationEnd = () => setIsAnnotating(false);
    const handleAnnotationError = (event: CustomEvent) => {
      setIsAnnotating(false);
      console.error('Annotation error:', event.detail?.error);
    };

    window.addEventListener('annotation-start', handleAnnotationStart);
    window.addEventListener('annotation-end', handleAnnotationEnd);
    window.addEventListener('annotation-error', handleAnnotationError as EventListener);

    return () => {
      window.removeEventListener('annotation-start', handleAnnotationStart);
      window.removeEventListener('annotation-end', handleAnnotationEnd);
      window.removeEventListener('annotation-error', handleAnnotationError as EventListener);
    };
  }, []);

  // 同步设置状态
  useEffect(() => {
    setAnnotationEnabled(viewSettings.wordAnnotationEnabled || false);
  }, [viewSettings.wordAnnotationEnabled]);

  return (
    <Button
      icon={
        isAnnotating ? (
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        ) : (
          <TbCircleLetterA className={annotationEnabled ? 'text-blue-500' : 'text-base-content'} />
        )
      }
      disabled={!annotationAvailable || isAnnotating}
      onClick={handleToggleClick}
      tooltip={
        annotationAvailable
          ? isAnnotating
            ? _('Annotating...')
            : annotationEnabled
            ? _('Disable Word Annotation')
            : _('Enable Word Annotation')
          : _('Word Annotation Not Available')
      }
      tooltipDirection='bottom'
    />
  );
};

export default AnnotationToggler;
