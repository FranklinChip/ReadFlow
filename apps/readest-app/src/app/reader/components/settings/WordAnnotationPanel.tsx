import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveViewSettings } from '../../utils/viewSettingsHelper';
import { SettingsPanelPanelProp } from './SettingsDialog';
import Select from '@/components/Select';
import ColorInput from './ColorInput';
import NumberInput from './NumberInput';

export type WordAnnotationLanguage = 'zh' | 'en';
export type WordAnnotationPosition = 'over' | 'under';
export type WordAnnotationBaseStyle = 'none' | 'underline' | 'highlight' | 'color';

const WordAnnotationPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey)!;
  
  // 使用ref来避免在effect依赖中包含对象引用
  const isInitializedRef = useRef(false);
  
  // 优化的设置保存函数
  const saveSettingsOptimized = useCallback((key: keyof typeof viewSettings, value: string | number | boolean) => {
    // 只在组件已初始化后才保存设置，避免初始化时的不必要调用
    if (isInitializedRef.current) {
      saveViewSettings(envConfig, bookKey, key, value, false, false);
    }
  }, [envConfig, bookKey]);
  
  // 词汇标注相关状态
  const [wordAnnotationEnabled, setWordAnnotationEnabled] = useState(viewSettings.wordAnnotationEnabled ?? false);
  const [wordAnnotationLanguage, setWordAnnotationLanguage] = useState(viewSettings.wordAnnotationLanguage ?? 'zh');
  const [wordAnnotationPosition, setWordAnnotationPosition] = useState(viewSettings.wordAnnotationPosition ?? 'under');
  const [wordAnnotationBaseStyle, setWordAnnotationBaseStyle] = useState(viewSettings.wordAnnotationBaseStyle ?? 'underline');
  const [wordAnnotationFontSize, setWordAnnotationFontSize] = useState(viewSettings.wordAnnotationFontSize ?? 0.8);
  const [wordAnnotationOpacity, setWordAnnotationOpacity] = useState(viewSettings.wordAnnotationOpacity ?? 0.8);
  const [wordAnnotationColor, setWordAnnotationColor] = useState(viewSettings.wordAnnotationColor ?? '#666666');
  const [wordAnnotationBaseHighlightColor, setWordAnnotationBaseHighlightColor] = useState(viewSettings.wordAnnotationBaseHighlightColor ?? '#ffeb3b');
  const [wordAnnotationBaseTextColor, setWordAnnotationBaseTextColor] = useState(viewSettings.wordAnnotationBaseTextColor ?? '#000000');

  // 短语标注相关状态
  const [phraseAnnotationEnabled, setPhraseAnnotationEnabled] = useState(viewSettings.phraseAnnotationEnabled ?? true);
  const [phraseAnnotationBaseStyle, setPhraseAnnotationBaseStyle] = useState(viewSettings.phraseAnnotationBaseStyle ?? 'none');
  const [phraseAnnotationBaseHighlightColor, setPhraseAnnotationBaseHighlightColor] = useState(viewSettings.phraseAnnotationBaseHighlightColor ?? '#e3f2fd');
  const [phraseAnnotationBaseTextColor, setPhraseAnnotationBaseTextColor] = useState(viewSettings.phraseAnnotationBaseTextColor ?? '#000000');

  const handleReset = () => {
    // 简化重置逻辑，不使用复杂的类型
  };

  // 标记组件已初始化
  useEffect(() => {
    isInitializedRef.current = true;
    if (onRegisterReset) {
      onRegisterReset(handleReset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 优化的设置保存逻辑 - 即时保存的设置
  useEffect(() => {
    saveSettingsOptimized('phraseAnnotationEnabled', phraseAnnotationEnabled);
  }, [phraseAnnotationEnabled, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationEnabled', wordAnnotationEnabled);
  }, [wordAnnotationEnabled, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationLanguage', wordAnnotationLanguage);
  }, [wordAnnotationLanguage, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationPosition', wordAnnotationPosition);
  }, [wordAnnotationPosition, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationBaseStyle', wordAnnotationBaseStyle);
  }, [wordAnnotationBaseStyle, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('phraseAnnotationBaseStyle', phraseAnnotationBaseStyle);
  }, [phraseAnnotationBaseStyle, saveSettingsOptimized]);

  // 其他设置的保存逻辑
  useEffect(() => {
    saveSettingsOptimized('wordAnnotationFontSize', wordAnnotationFontSize);
  }, [wordAnnotationFontSize, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationOpacity', wordAnnotationOpacity);
  }, [wordAnnotationOpacity, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationColor', wordAnnotationColor);
  }, [wordAnnotationColor, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationBaseHighlightColor', wordAnnotationBaseHighlightColor);
  }, [wordAnnotationBaseHighlightColor, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('wordAnnotationBaseTextColor', wordAnnotationBaseTextColor);
  }, [wordAnnotationBaseTextColor, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('phraseAnnotationBaseHighlightColor', phraseAnnotationBaseHighlightColor);
  }, [phraseAnnotationBaseHighlightColor, saveSettingsOptimized]);

  useEffect(() => {
    saveSettingsOptimized('phraseAnnotationBaseTextColor', phraseAnnotationBaseTextColor);
  }, [phraseAnnotationBaseTextColor, saveSettingsOptimized]);

  // 选项数据
  const getLanguageOptions = () => [
    { value: 'zh', label: _('Chinese') },
    { value: 'en', label: _('English') },
  ];

  const getPositionOptions = () => [
    { value: 'over', label: _('Above') },
    { value: 'under', label: _('Below') },
  ];

  const getBaseStyleOptions = () => [
    { value: 'none', label: _('None') },
    { value: 'highlight', label: _('Highlight') },
    { value: 'underline', label: _('Underline') },
    { value: 'color', label: _('Color') },
  ];

  const handleSelectLanguage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setWordAnnotationLanguage(event.target.value as WordAnnotationLanguage);
  };

  const handleSelectPosition = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setWordAnnotationPosition(event.target.value as WordAnnotationPosition);
  };

  const handleSelectWordBaseStyle = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setWordAnnotationBaseStyle(event.target.value as WordAnnotationBaseStyle);
  };

  const handleSelectPhraseBaseStyle = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPhraseAnnotationBaseStyle(event.target.value as WordAnnotationBaseStyle);
  };

  return (
    <div className='w-full space-y-4'>
      {/* 基本设置 */}
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('Basic Settings')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <div className='divide-base-200 divide-y'>
            <div className='config-item'>
              <span className=''>{_('Enable Word Annotation')}</span>
              <input
                type='checkbox'
                className='toggle'
                checked={wordAnnotationEnabled}
                onChange={() => setWordAnnotationEnabled(!wordAnnotationEnabled)}
              />
            </div>
            <div className='config-item'>
              <span className=''>{_('Enable Phrase Annotation')}</span>
              <input
                type='checkbox'
                className='toggle'
                checked={phraseAnnotationEnabled}
                onChange={() => setPhraseAnnotationEnabled(!phraseAnnotationEnabled)}
              />
            </div>
            
            {wordAnnotationEnabled && (
              <>
                <div className='config-item'>
                  <span className=''>{_('Language')}</span>
                  <Select
                    value={wordAnnotationLanguage}
                    options={getLanguageOptions()}
                    onChange={handleSelectLanguage}
                  />
                </div>
                <div className='config-item'>
                  <span className=''>{_('Position')}</span>
                  <Select
                    value={wordAnnotationPosition}
                    options={getPositionOptions()}
                    onChange={handleSelectPosition}
                  />
                </div>
                <div className='config-item'>
                  <span className='min-w-20'>{_('Font Size')}</span>
                  <NumberInput
                    label=""
                    value={wordAnnotationFontSize}
                    min={0.2}
                    max={2.0}
                    step={0.1}
                    onChange={setWordAnnotationFontSize}
                  />
                </div>
                <div className='config-item'>
                  <span className='min-w-20'>{_('Opacity')}</span>
                  <NumberInput
                    label=""
                    value={wordAnnotationOpacity}
                    min={0.1}
                    max={1}
                    step={0.1}
                    onChange={setWordAnnotationOpacity}
                  />
                </div>

                <div className='config-item'>
                  <span className=''>{_('Annotation Color')}</span>
                  <ColorInput
                    value={wordAnnotationColor}
                    onChange={setWordAnnotationColor}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 词汇设置 */}
      {wordAnnotationEnabled && (
        <div className='w-full'>
          <h2 className='mb-2 font-medium'>{_('Word Settings')}</h2>
          <div className='card border-base-200 bg-base-100 border shadow'>
            <div className='divide-base-200 divide-y'>
              <div className='config-item'>
                <span className=''>{_('Word Base Style')}</span>
                <Select
                  value={wordAnnotationBaseStyle}
                  options={getBaseStyleOptions()}
                  onChange={handleSelectWordBaseStyle}
                />
              </div>
              <div className='config-item'>
                <span className=''>{_('Word Base Highlight Color')}</span>
                <ColorInput
                  value={wordAnnotationBaseHighlightColor}
                  onChange={setWordAnnotationBaseHighlightColor}
                />
              </div>
              <div className='config-item'>
                <span className=''>{_('Word Base Text Color')}</span>
                <ColorInput
                  value={wordAnnotationBaseTextColor}
                  onChange={setWordAnnotationBaseTextColor}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 词组设置 */}
      {wordAnnotationEnabled && phraseAnnotationEnabled && (
        <div className='w-full'>
          <h2 className='mb-2 font-medium'>{_('Phrase Settings')}</h2>
          <div className='card border-base-200 bg-base-100 border shadow'>
            <div className='divide-base-200 divide-y'>
              <div className='config-item'>
                <span className=''>{_('Phrase Base Style')}</span>
                <Select
                  value={phraseAnnotationBaseStyle}
                  options={getBaseStyleOptions()}
                  onChange={handleSelectPhraseBaseStyle}
                />
              </div>
              <div className='config-item'>
                <span className=''>{_('Phrase Base Highlight Color')}</span>
                <ColorInput
                  value={phraseAnnotationBaseHighlightColor}
                  onChange={setPhraseAnnotationBaseHighlightColor}
                />
              </div>
              <div className='config-item'>
                <span className=''>{_('Phrase Base Text Color')}</span>
                <ColorInput
                  value={phraseAnnotationBaseTextColor}
                  onChange={setPhraseAnnotationBaseTextColor}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordAnnotationPanel;
