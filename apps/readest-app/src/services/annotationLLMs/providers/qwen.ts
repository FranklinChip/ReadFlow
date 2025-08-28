import { AnnotationProvider, AnnotationResponse, ErrorCodes } from '../types';

export const qwenProvider: AnnotationProvider = {
  name: 'qwen',
  label: 'Qwen Flash',
  
  annotate: async (text: string, targetLanguage?: string): Promise<AnnotationResponse> => {
    // 获取API key的优先级：用户设置 > 环境变量 > 默认key（开发用）
    const getUserApiKey = () => {
      // 从本地存储获取用户设置的API key
      if (typeof window !== 'undefined') {
        const userApiKey = localStorage.getItem('qwen_api_key');
        if (process.env.NODE_ENV === 'development') {
          console.log('🔑 User API key from localStorage:', userApiKey ? `${userApiKey.substring(0, 8)}...` : 'null');
        }
        if (userApiKey && userApiKey.trim()) {
          return userApiKey.trim();
        }
      }
      
      // 从环境变量获取
      const envApiKey = process.env['NEXT_PUBLIC_QWEN_API_KEY'] || process.env['QWEN_API_KEY'];
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 Env API key:', envApiKey ? `${envApiKey.substring(0, 8)}...` : 'null');
      }
      if (envApiKey && envApiKey.trim()) {
        return envApiKey.trim();
      }
      
      // 开发环境默认key（生产环境应该被上面的覆盖）
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 No API key found');
      }
      return ''; // 移除硬编码的 API key，强制用户配置
    };

    const apiKey = getUserApiKey();
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    // 检查API key是否有效
    if (!apiKey || apiKey.length < 10) {
      throw new Error('请在设置 > 词汇注释 > API配置中添加有效的 Qwen API 密钥');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 Using API key:', apiKey.substring(0, 8) + '...');
    }
    
    // 根据缓存键前缀判断是查询单词还是词组/专有名词
    const isPhrasesQuery = text.startsWith('phrases:');
    const actualText = text.replace(/^(words:|phrases:)/, '');
    
    // 确定目标语言，默认为中文
    const targetLang = targetLanguage || 'zh-CN';
    
    // 根据目标语言确定解释语言
    const getLanguageName = (langCode: string) => {
      const langMap: Record<string, string> = {
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'en': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'it': 'Italian',
        'nl': 'Dutch'
      };
      return langMap[langCode] || 'Chinese (Simplified)';
    };
    
    const targetLanguageName = getLanguageName(targetLang);
    
    let systemPrompt = '';
    let userPrompt = '';
    
    if (isPhrasesQuery) {
      // 词组和多词专有名词查询的prompt
      systemPrompt = `You are an expert English language teacher. Your task is to identify all the meaningful phrases and multi-word proper nouns in English text.

Find and explain:
1. **Multi-word proper nouns** (it must be 2+ words): Names of people, places, organizations, brands, etc.
2. **Meaningful phrases**: Idioms, phrasal verbs, collocations

IMPORTANT: For annotations, provide DIRECT TRANSLATIONS, not categorical descriptions like "人名", "组织名称", "地名", etc.

Return your findings in JSON format:
{
  "proper_nouns": [
    {
      "phrase": "exact multi-word proper noun from text",
      "annotation": "direct translation in ${targetLanguageName} (≤10 words/characters)"
    }
  ],
  "mwes": [
    {
      "phrase": "exact phrase from text",
      "lemma": "base form of the phrase", 
      "annotation": "direct translation or meaning in ${targetLanguageName} (≤10 words/characters)"
    }
  ]
}

Requirements:
- Multi-word proper nouns: Only include names with 2+ words (e.g., "New York", "John Smith", "Apple Inc.")
- Annotations must be DIRECT TRANSLATIONS in ${targetLanguageName}, not categorical labels
- Keep annotations extremely concise (≤10 words/characters)
- Return valid JSON only`;

      userPrompt = `Find multi-word proper nouns (2+ words) and meaningful phrases in this text.

Text to analyze:
${actualText}

Look for:
1. Multi-word proper nouns: Names of people, places, organizations, brands (must be 2+ words)
2. Meaningful phrases: Idioms, phrasal verbs, collocations with special meanings

CRITICAL: Provide DIRECT TRANSLATIONS for annotations, NOT categorical descriptions.
- Good: "John Smith" -> "约翰·史密斯" (not "人名")
- Good: "New York" -> "纽约" (not "地名") 
- Good: "Apple Inc." -> "苹果公司" (not "公司名称")
- Good: "break down" -> "分解;故障" (not "短语动词")

Exclude:
- Single words
- Simple word combinations without special meanings
- Regular noun phrases

Return results in the specified JSON format with DIRECT TRANSLATIONS in ${targetLanguageName}.`;
      
    } else {
      // 单词查询的prompt - 按顺序返回所有单词
      systemPrompt = `You are an expert English language assistant. Your task is to analyze English text and provide explanations for ALL individual words in their original order.

CRITICAL REQUIREMENTS:
1. ONLY analyze the text provided by the user - DO NOT add any extra words
2. Return words in the EXACT SAME ORDER as they appear in the text
3. Include ALL words but exclude punctuation marks
4. Treat contractions as single words (e.g., "I've", "don't", "we're", "I'd")
5. Treat hyphenated words as single words (e.g., "forty-five", "well-known")
6. DO NOT include instructions, examples, or any other text beyond what the user provides

Valid POS tags: NOUN, VERB, ADJ, ADV, PRON, DET, ADP, NUM, CONJ, PRT, PUNCT, X, PROPN, AUX, CCONJ, SCONJ, INTJ, SYM

Return your findings in JSON format:
{
  "words": [
    {
      "word": "exact word from text (preserve original case)",
      "lemma": "base form of the word",
      "pos": "part-of-speech tag from the valid list above",
      "annotation": "only explanation in ${targetLanguageName} (≤10 words/characters),no POS here"
    }
  ]
}

Requirements:
- Words must be in EXACT ORDER of appearance
- Include ALL words except punctuation marks
- Annotations must be in ${targetLanguageName} and extremely concise (≤10 words/characters)
- Return valid JSON only
- DO NOT hallucinate or add extra words not in the original text`;

      userPrompt = `Analyze ONLY the following English text and provide explanations for ALL individual words in their EXACT ORDER of appearance.

IMPORTANT: Only analyze this exact text, do not add any other words:

"${actualText}"

CRITICAL RULES: 
- Return words in EXACT ORDER of appearance in the text
- Include ALL words except punctuation marks
- Treat hyphenated words as single units (e.g., "forty-five", "well-known")
- Treat contractions as single units (e.g., "I've", "don't", "we're")
- Use valid POS tags: NOUN, VERB, ADJ, ADV, PRON, DET, ADP, NUM, CONJ, PRT, PUNCT, X, PROPN, AUX, CCONJ, SCONJ, INTJ, SYM
- DO NOT include any words that are not in the original text above

Return results in the specified JSON format with annotations in ${targetLanguageName} and words in exact order.`;
    }

    try {
      // 检查运行环境
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
      const isDev = process.env.NODE_ENV === 'development';
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🌍 Environment check:', {
          isTauri,
          isDev,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'
        });
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Qwen API');
      }

      const content = data.choices[0].message.content;
      const usage = data.usage; // 获取token使用信息
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Token usage:', usage);
      }
    
      
      try {
        const result = JSON.parse(content);
        
        // 添加解析后的结果日志
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Parsed LLM Result:', JSON.stringify(result, null, 2));
        }
        
        // 根据查询类型验证响应格式
        if (isPhrasesQuery) {
          // 词组和多词专有名词查询 - 允许为空数组，但必须有这两个字段
          if (!Array.isArray(result.mwes) || !Array.isArray(result.proper_nouns)) {
            throw new Error('Invalid phrases response format: mwes and proper_nouns must be arrays');
          }
          return {
            mwes: result.mwes || [],
            proper_nouns: result.proper_nouns || [], // 多词专有名词
            words: [], // 词组查询不返回单词
            usage: usage // 添加token使用信息
          };
        } else {
          // 单词查询只需要验证 words
          if (!result.words) {
            throw new Error('Invalid words response format: missing words');
          }
          return {
            mwes: [], // 单词查询不返回词组
            proper_nouns: [], // 单词查询不返回专有名词（多词专有名词在第二次请求中处理）
            words: result.words || [],
            usage: usage // 添加token使用信息
          };
        }
      } catch (parseError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('JSON parse error:', parseError);
          console.error('Raw response:', content);
        }
        throw new Error(ErrorCodes.PARSE_ERROR);
      }
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Qwen annotation error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
      }
      
      // 检查是否是 CSP 相关错误
      if (error instanceof Error && (
        error.message.includes('Content Security Policy') ||
        error.message.includes('CSP') ||
        error.message.includes('net::ERR_BLOCKED_BY_CLIENT') ||
        error.message.includes('blocked by the client')
      )) {
        throw new Error('请求被安全策略阻止：需要在应用配置中添加 dashscope.aliyuncs.com 到允许列表。');
      }
      
      // 检查是否是 fetch 或加载相关错误
      if (error instanceof TypeError) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          throw new Error('网络连接错误：无法连接到Qwen服务。这可能是CSP配置问题，请检查应用安全设置。');
        }
        if (error.message.includes('load failed') || error.message.toLowerCase().includes('load')) {
          throw new Error('网络加载失败：可能是CSP安全策略阻止了外部API访问。请检查应用配置。');
        }
        if (error.message.includes('NetworkError') || error.message.includes('net::')) {
          throw new Error('网络错误：请检查应用是否允许访问外部API（CSP配置）。');
        }
      }
      
      // 检查是否是 CORS 或跨域问题（生产环境常见）
      if (error instanceof Error && (
        error.message.includes('CORS') || 
        error.message.includes('cross-origin') ||
        error.message.includes('blocked by CORS policy')
      )) {
        throw new Error('跨域访问被阻止：生产环境安全配置问题。请检查CSP设置是否允许访问 dashscope.aliyuncs.com。');
      }
      
      if (error instanceof Error) {
        // API key相关错误
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('API密钥无效或已过期。请检查您的Qwen API密钥设置。');
        }
        
        if (error.message.includes('quota') || error.message.includes('429')) {
          throw new Error('API配额已耗尽或请求过于频繁。请稍后重试或检查您的Qwen账户配额。');
        }
        
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          throw new Error('API访问被禁止。请检查您的Qwen API密钥权限设置。');
        }
        
        // 处理服务器错误
        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          throw new Error('Qwen服务器暂时不可用，请稍后重试。');
        }
        
        // 处理超时错误
        if (error.message.includes('timeout') || error.message.includes('TimeoutError')) {
          throw new Error('请求超时：网络连接过慢或服务器响应延迟。');
        }
        
        // 如果是我们自定义的错误，直接抛出
        if (error.message.includes('API Key未配置') || error.message.includes('API配置')) {
          throw error;
        }
        
        // 对于其他原始错误，也显示给用户以便调试
        throw new Error(`注释服务错误: ${error.message}`);
      }
      
      throw new Error('词汇注释服务暂时不可用，请稍后重试。');
    }
  }
};
