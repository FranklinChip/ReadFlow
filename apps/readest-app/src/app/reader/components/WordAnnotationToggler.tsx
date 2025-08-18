import React, { useEffect, useState } from 'react';
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
        let rubyElements: NodeListOf<Element> | null = null;
        
        if (contents && contents.length > 0) {
          // 获取第一个内容的文档
          const currentDoc = contents[0]?.doc;
          if (currentDoc) {
            rubyElements = currentDoc.querySelectorAll('ruby.word, ruby.mwe');
          }
        }
        
        const available = rubyElements ? rubyElements.length > 0 : false;
        setWordAnnotationAvailable(available);
      } catch (error) {
        console.warn('Error checking ruby elements:', error);
        setWordAnnotationAvailable(false);
      }
    };
    
    // 立即检查一次
    checkAvailability();
    
    // 如果还没有找到ruby元素，设置一个延迟检查
    const timer = setTimeout(checkAvailability, 1000);
    
    return () => clearTimeout(timer);
  }, [bookData, wordAnnotationEnabled, bookKey]);

  return (
    <Button
      icon={
        <LuWholeWord className={wordAnnotationEnabled ? 'text-blue-500' : 'text-base-content'} />
      }
      disabled={!wordAnnotationAvailable}
      onClick={() => setWordAnnotationEnabled(!wordAnnotationEnabled)}
      tooltip={
        wordAnnotationAvailable
          ? wordAnnotationEnabled
            ? _('Disable Word Annotation')
            : _('Enable Word Annotation')
          : _('Word Annotation Not Available')
      }
      tooltipDirection='bottom'
    ></Button>
  );
};

export default WordAnnotationToggler;
