import { useCallback } from 'react';
import { useReaderStore } from '@/store/readerStore';

export function useAnnotationCSS(bookKey: string) {
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);

  const generateCSS = useCallback(() => {
    if (!viewSettings) return '';

    const {
      wordAnnotationEnabled,
      wordAnnotationLanguage,
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
    } = viewSettings;

    if (!wordAnnotationEnabled) {
      // 当注释功能关闭时，隐藏所有rt元素
      return `
        ruby.word rt,
        .mwe .annotation,
        .PROPN .annotation
        {
          display: none !important;
        }
      `;
    }

    const showZh = wordAnnotationLanguage === 'zh' || wordAnnotationLanguage === 'both';
    const showEn = wordAnnotationLanguage === 'en' || wordAnnotationLanguage === 'both';
    const position = wordAnnotationPosition === 'over' ? 'over' : 'under';

    // 生成基础样式CSS函数
    const generateBaseStyle = (baseStyle: string, highlightColor: string, textColor: string) => {
      switch (baseStyle) {
        case 'underline':
          return `text-decoration: underline;`; // 下划线不改变颜色，使用默认颜色
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
      /* 阅读器容器级别的换行控制 */
      .foliate-viewer,
      .foliate-viewer * {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }

      /* 分列布局的特殊处理 */
      .foliate-viewer iframe {
        overflow: hidden !important;
      }

      /* 确保分列布局中的内容不会溢出 */
      body {
        overflow-x: hidden !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }

      /* 段落级别的换行控制 */
      p, div, span {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
        max-width: 100% !important;
      }

      /* Ruby 基础样式 */
      ruby.word.unknown {
        ruby-position: ${position};
        ruby-align: center;
        /* 确保ruby元素可以正常换行 */
        display: ruby;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        max-width: 100% !important;
        ${generateBaseStyle(wordAnnotationBaseStyle || 'none', wordAnnotationBaseHighlightColor || '#ffeb3b', wordAnnotationBaseTextColor || '#000000')}
      }

      /* 根据语言设置显示对应的注释 */
      ruby.word.unknown rt {
        font-size: ${wordAnnotationFontSize}em;
        color: ${wordAnnotationColor};
        opacity: ${wordAnnotationOpacity};
        font-family: inherit;
        user-select: none;
        pointer-events: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        /* 确保rt元素不会影响正常换行 */
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 根据语言设置显示对应的注释 */
      ${showZh && showEn ? `
      /* 同时显示中英文 */
      ruby.word.unknown rt.zh-meaning,
      ruby.word.unknown rt.en-meaning {
        display: ruby-text;
      }
      ruby.word.unknown rt.zh-meaning:after {
        content: " | ";
      }` : ''}

      ${showZh && !showEn ? `
      /* 只显示中文注释 */
      ruby.word.unknown rt.en-meaning {
        display: none;
      }
      ruby.word.unknown rt.zh-meaning {
        display: ruby-text;
      }` : ''}

      ${showEn && !showZh ? `
      /* 只显示英文注释 */
      ruby.word.unknown rt.zh-meaning {
        display: none;
      }
      ruby.word.unknown rt.en-meaning {
        display: ruby-text;
      }` : ''}

      /* 隐藏已知单词的注释 */
      ruby.word.known rt {
        display: none;
      }
    `;

    // 词组注释（MWE）和专有名词（PROPN）- 新的span结构
    if (phraseAnnotationEnabled) {
      css += `
        /* MWE Span 基础样式 */
        .mwe.unknown {
          display: inline;
          /* 确保span元素内容可以正常换行 */
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          max-width: 100% !important;
          ${generateBaseStyle(phraseAnnotationBaseStyle || 'none', phraseAnnotationBaseHighlightColor || '#e3f2fd', phraseAnnotationBaseTextColor || '#000000')}
        }

        /* PROPN Span 基础样式 - 与MWE保持一致 */
        .PROPN.unknown {
          display: inline;
          /* 确保span元素内容可以正常换行 */
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          max-width: 100% !important;
          ${generateBaseStyle(phraseAnnotationBaseStyle || 'none', phraseAnnotationBaseHighlightColor || '#e3f2fd', phraseAnnotationBaseTextColor || '#000000')}
        }

        /* MWE 和 PROPN 内部的ruby元素继承单词的注释样式 */
        .mwe ruby.word.unknown,
        .PROPN ruby.word.unknown {
          ruby-position: ${position};
          ruby-align: center;
          /* 确保内部ruby元素也可以正常换行 */
          display: ruby;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          max-width: 100% !important;
        }

        .mwe ruby.word.unknown rt,
        .PROPN ruby.word.unknown rt {
          font-size: ${wordAnnotationFontSize}em;
          color: ${wordAnnotationColor};
          opacity: ${wordAnnotationOpacity};
          font-family: inherit;
          user-select: none;
          pointer-events: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          /* 确保rt元素不会影响正常换行 */
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* MWE 和 PROPN 注释样式 */
        .mwe .annotation,
        .PROPN .annotation {
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
          /* 确保annotation元素不会导致布局问题 */
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline;
        }

        /* 根据语言设置显示词组和专有名词注释 */
        ${showZh && showEn ? `
        /* 同时显示中英文 */
        .mwe.unknown .annotation.zh,
        .mwe.unknown .annotation.en,
        .PROPN.unknown .annotation.zh,
        .PROPN.unknown .annotation.en {
          display: inline;
        }
        .mwe.unknown .annotation.zh:after,
        .PROPN.unknown .annotation.zh:after {
          content: " ";
        }` : ''}

        ${showZh && !showEn ? `
        /* 只显示中文注释 */
        .mwe.unknown .annotation.en,
        .PROPN.unknown .annotation.en {
          display: none;
        }
        .mwe.unknown .annotation.zh,
        .PROPN.unknown .annotation.zh {
          display: inline;
        }` : ''}

        ${showEn && !showZh ? `
        /* 只显示英文注释 */
        .mwe.unknown .annotation.zh,
        .PROPN.unknown .annotation.zh {
          display: none;
        }
        .mwe.unknown .annotation.en,
        .PROPN.unknown .annotation.en {
          display: inline;
        }` : ''}

        /* 隐藏已知词组和专有名词的注释 */
        .mwe.known .annotation,
        .PROPN.known .annotation {
          display: none;
        }

        /* MWE 和 PROPN 内部ruby的语言显示规则 */
        ${showZh && showEn ? `
        .mwe ruby.word.unknown rt.zh-meaning,
        .mwe ruby.word.unknown rt.en-meaning,
        .PROPN ruby.word.unknown rt.zh-meaning,
        .PROPN ruby.word.unknown rt.en-meaning {
          display: ruby-text;
        }
        .mwe ruby.word.unknown rt.zh-meaning:after,
        .PROPN ruby.word.unknown rt.zh-meaning:after {
          content: " | ";
        }` : ''}

        ${showZh && !showEn ? `
        .mwe ruby.word.unknown rt.en-meaning,
        .PROPN ruby.word.unknown rt.en-meaning {
          display: none;
        }
        .mwe ruby.word.unknown rt.zh-meaning,
        .PROPN ruby.word.unknown rt.zh-meaning {
          display: ruby-text;
        }` : ''}

        ${showEn && !showZh ? `
        .mwe ruby.word.unknown rt.zh-meaning,
        .PROPN ruby.word.unknown rt.zh-meaning {
          display: none;
        }
        .mwe ruby.word.unknown rt.en-meaning,
        .PROPN ruby.word.unknown rt.en-meaning {
          display: ruby-text;
        }` : ''}
      `;
    } else {
      // 当词组注释关闭时，隐藏所有mwe和PROPN的注释
      css += `
        .mwe .annotation,
        .PROPN .annotation {
          display: none !important;
        }
      `;
    }

    return css;
  }, [viewSettings]);

  return {
    generateCSS,
    settings: viewSettings,
  };
}
