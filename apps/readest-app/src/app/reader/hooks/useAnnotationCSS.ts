import { useCallback } from 'react';
import { useReaderStore } from '@/store/readerStore';

export function useAnnotationCSS(bookKey: string) {
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);

  const generateCSS = useCallback(() => {
    if (!viewSettings) return '';

    const {
      wordAnnotationEnabled,
      wordAnnotationFontSize,
      wordAnnotationOpacity,
      wordAnnotationColor,
      wordAnnotationPosition,
      wordAnnotationBaseStyle,
      wordAnnotationBaseHighlightColor,
      wordAnnotationBaseTextColor,
      phraseAnnotationEnabled,
      phraseAnnotationBaseStyle,
      phraseAnnotationBaseHighlightColor,
      phraseAnnotationBaseTextColor,
      phraseWordAnnotationEnabled,
      propnAnnotationEnabled,
    } = viewSettings;

    if (!wordAnnotationEnabled) {
      // 当注释功能关闭时，隐藏所有annotation-target元素
      return `
        .annotation-target {
          display: none !important;
        }
      `;
    }

    const position = wordAnnotationPosition === 'over' ? 'over' : 'under';

    // 生成基础样式CSS函数
    const generateBaseStyle = (baseStyle: string, highlightColor: string, textColor: string) => {
      switch (baseStyle) {
        case 'underline':
          return `text-decoration: underline;`;
        case 'highlight':
          return `background-color: ${highlightColor}; color: ${textColor};`;
        case 'color':
          return `color: ${textColor};`;
        case 'none':
        default:
          return '';
      }
    };

    let css = `
      /* Ruby 基础样式 */
      ruby.word.unknown {
        ruby-position: ${position};
        ruby-align: center;
        ${generateBaseStyle(wordAnnotationBaseStyle || 'none', wordAnnotationBaseHighlightColor || '#ffeb3b', wordAnnotationBaseTextColor || '#000000')}
      }

      /* Ruby 注释样式 */
      ruby.unknown rt.annotation-target {
        font-size: ${wordAnnotationFontSize}em;
        color: ${wordAnnotationColor};
        opacity: ${wordAnnotationOpacity};
        font-family: inherit;
        user-select: none;
        pointer-events: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      ruby.known rt.annotation-target {
        display: none;
      }
    `;

    // 词组注释（MWE）和专有名词（PROPN）样式
    if (phraseAnnotationEnabled) {
      css += `
        /* MWE 和 PROPN 基础样式 */
        .mwe.unknown,
        .PROPN.unknown {
          ${generateBaseStyle(phraseAnnotationBaseStyle || 'none', phraseAnnotationBaseHighlightColor || '#e3f2fd', phraseAnnotationBaseTextColor || '#000000')}
        }

        .mwe.known,
        .PROPN.known {
          ${generateBaseStyle(phraseAnnotationBaseStyle || 'none', phraseAnnotationBaseHighlightColor || '#e3f2fd', phraseAnnotationBaseTextColor || '#000000')}
        }

        /* MWE 和 PROPN 注释样式 - 未知状态显示注释 */
        .mwe.unknown span.annotation-target,
        .PROPN.unknown span.annotation-target {
          font-size: ${wordAnnotationFontSize}em;
          color: ${wordAnnotationColor};
          opacity: ${wordAnnotationOpacity};
          font-family: inherit;
          margin-left: 0.2em;
          user-select: none;
          pointer-events: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        /* MWE 和 PROPN 注释样式 - 已知状态隐藏注释 */
        .mwe.known span.annotation-target,
        .PROPN.known span.annotation-target {
          display: none;
        }

      `;

      // 控制词组内单词注释的显示
      if (!phraseWordAnnotationEnabled) {
        css += `
          /* 隐藏词组内单词的注释 */
          .mwe ruby.word rt.annotation-target,
          .PROPN ruby.word rt.annotation-target {
            display: none !important;
          }
        `;
      }
    } else {
      // 当词组注释关闭时，隐藏所有mwe和PROPN的注释
      css += `
        .mwe span.annotation-target,
        .PROPN span.annotation-target {
          display: none !important;
        }
      `;
    }

    // 专有名词注释控制
    if (!propnAnnotationEnabled) {
      css += `
        /* 隐藏专有名词注释 */
        ruby.word[pos="PROPN"] rt.annotation-target,
        .PROPN span.annotation-target {
          display: none !important;
        }
      `;
    }

    return css;
  }, [
    viewSettings?.wordAnnotationEnabled,
    viewSettings?.wordAnnotationFontSize,
    viewSettings?.wordAnnotationOpacity,
    viewSettings?.wordAnnotationColor,
    viewSettings?.wordAnnotationPosition,
    viewSettings?.wordAnnotationBaseStyle,
    viewSettings?.wordAnnotationBaseHighlightColor,
    viewSettings?.wordAnnotationBaseTextColor,
    viewSettings?.phraseAnnotationEnabled,
    viewSettings?.phraseAnnotationBaseStyle,
    viewSettings?.phraseAnnotationBaseHighlightColor,
    viewSettings?.phraseAnnotationBaseTextColor,
    viewSettings?.phraseWordAnnotationEnabled,
    viewSettings?.propnAnnotationEnabled,
  ]);

  return {
    generateCSS,
    settings: viewSettings,
  };
}
