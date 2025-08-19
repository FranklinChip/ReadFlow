import { AnnotationProvider, AnnotationResponse, ErrorCodes } from '../types';

export const qwenProvider: AnnotationProvider = {
  name: 'qwen',
  label: 'Qwen Flash',
  
  annotate: async (text: string): Promise<AnnotationResponse> => {
    const apiKey = 'sk-f9c25a7cd97d4fa0b1f096d381ad63fb';
    const apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    const systemPrompt = `You are an expert English language assistant. Your task is to analyze English text and provide concise explanations for words, multi-word expressions (MWEs), and proper nouns.

For the given text, identify and explain:
1. **Multi-word expressions (MWEs)**: 
   - Idioms, phrasal verbs, compound expressions with figurative meanings
   - Multi-word proper nouns (person names, place names, organizations with multiple words)
   - Hyphenated compound words (e.g., "bell-hop", "post-war", "raw-boned", etc.)
2. **Single-word proper nouns**: Names of people, places, organizations (single words only, no hyphens)
3. **Regular words**: ALL other words including function words, content words, etc. (exclude only punctuation)

Return your findings in JSON format:
{
  "mwes": [
    {
      "phrase": "exact phrase from text",
      "lemma": "base form of the phrase", 
      "zh": "简洁中文解释(不超过10汉字)",
      "en": "concise English explanation (max 10 words)"
    }
  ],
  "proper_nouns": [
    {
      "word": "exact single-word proper noun from text",
      "zh": "具体中文翻译或背景解释(不超过10汉字)",
      "en": "specific translation or background (max 10 words)"
    }
  ],
  "words": [
    {
      "word": "exact word from text",
      "lemma": "base form of the word",
      "pos": "part of speech (NOUN, VERB, ADJ, ADV, etc.)",
      "zh": "简洁中文解释(不超过10汉字)",
      "en": "concise English explanation (max 10 words)"
    }
  ]
}

CRITICAL Requirements:
- For person names: provide actual Chinese translation (e.g., "约翰" not "人名")
- For place names: provide actual Chinese name (e.g., "伦敦" not "地名")
- For organizations: provide actual Chinese name or background context
- Multi-word proper nouns go in "mwes" section, not "proper_nouns"
- Hyphenated compound words (with hyphens) go in "mwes" section, not "words"
- Include ALL words except punctuation - no word should be skipped
- Explanations must be extremely concise (Chinese ≤10 characters, English ≤10 words)
- Return valid JSON only`;

    // 检测连字符词和所有格词
    const hyphenatedWords = text.match(/\b\w+(?:-\w+)+\b/g) || [];
    const possessiveWords = text.match(/\b\w+'\w+\b/g) || [];
    
    const userPrompt = `Analyze the following English text and provide explanations for:
1. ALL multi-word expressions (including multi-word proper nouns and hyphenated compounds)
2. ALL single-word proper nouns (with specific Chinese translations)
3. ALL other words (exclude only punctuation marks)

Text to analyze:
${text}

DETECTED HYPHENATED WORDS: ${hyphenatedWords.join(', ') || 'None'}
DETECTED POSSESSIVE WORDS: ${possessiveWords.join(', ') || 'None'}

CRITICAL RULES: 
- Person names: provide actual Chinese translation (e.g., "John" → "约翰", not "人名")
- Place names: provide actual Chinese name (e.g., "London" → "伦敦", not "地名") 
- Organizations: provide actual Chinese name or brief background
- Multi-word proper nouns should be in "mwes" section
- ALL HYPHENATED WORDS LISTED ABOVE MUST BE IN "mwes" SECTION, NEVER IN "words" OR "proper_nouns"
- ALL POSSESSIVE WORDS (containing apostrophe + s) MUST BE TREATED AS SINGLE UNITS: ${possessiveWords.join(', ')}
- Examples: "Italian's", "John's", "children's" should be treated as single words, not split
- This includes ALL words containing hyphens: ${hyphenatedWords.join(', ')}
- NO EXCEPTIONS: if it has a hyphen, it goes in "mwes"
- Include ALL words - every single word except punctuation should have an explanation

Return results in the specified JSON format with very concise explanations.`;

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
          max_tokens: 8192,
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
      
      try {
        const result = JSON.parse(content);
        
        // 验证响应格式
        if (!result.mwes || !result.proper_nouns || !result.words) {
          throw new Error('Invalid annotation response format');
        }

        return {
          mwes: result.mwes || [],
          proper_nouns: result.proper_nouns || [],
          words: result.words || []
        };
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
