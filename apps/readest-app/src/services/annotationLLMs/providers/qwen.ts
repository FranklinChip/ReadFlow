import { AnnotationProvider, AnnotationResponse, ErrorCodes } from '../types';

export const qwenProvider: AnnotationProvider = {
  name: 'qwen',
  label: 'Qwen Flash',
  
  annotate: async (text: string, targetLanguage?: string): Promise<AnnotationResponse> => {
    const apiKey = 'sk-f9c25a7cd97d4fa0b1f096d381ad63fb';
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
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
      
      console.log('🔍 Token usage:', usage);
    
      
      try {
        const result = JSON.parse(content);
        
        // 添加解析后的结果日志
        console.log('✅ Parsed LLM Result:', JSON.stringify(result, null, 2));
        
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
        console.error('JSON parse error:', parseError);
        console.error('Raw response:', content);
        throw new Error(ErrorCodes.PARSE_ERROR);
      }
      
    } catch (error) {
      console.error('Qwen annotation error:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(ErrorCodes.NETWORK_ERROR);
      }
      
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('429')) {
          throw new Error(ErrorCodes.QUOTA_EXCEEDED);
        }
        throw error;
      }
      
      throw new Error(ErrorCodes.LLM_API_ERROR);
    }
  }
};
