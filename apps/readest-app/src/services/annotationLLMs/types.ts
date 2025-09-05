// 词性标签定义（基于通用的POS标签体系）
export type PartOfSpeech = 
  | 'NOUN'      // 名词
  | 'VERB'      // 动词
  | 'ADJ'       // 形容词
  | 'ADV'       // 副词
  | 'PRON'      // 代词
  | 'DET'       // 限定词
  | 'ADP'       // 介词/后置词
  | 'NUM'       // 数词
  | 'CONJ'      // 连词
  | 'PRT'       // 小品词
  | 'PUNCT'     // 标点
  | 'X'         // 其他
  | 'PROPN'     // 专有名词
  | 'AUX'       // 助动词
  | 'CCONJ'     // 并列连词
  | 'SCONJ'     // 从属连词
  | 'INTJ'      // 感叹词
  | 'SYM';      // 符号

export interface WordAnnotation {
  word: string;
  lemma: string;
  pos: PartOfSpeech;
  annotation: string; // 改为单一目标语言注释
}

export interface MWEAnnotation {
  phrase: string;
  lemma: string;
  annotation: string; // 改为单一目标语言注释
}

export interface ProperNounAnnotation {
  phrase: string; // 改为phrase以支持多词专有名词
  annotation: string; // 改为单一目标语言注释
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AnnotationResponse {
  mwes: MWEAnnotation[];
  proper_nouns: ProperNounAnnotation[];
  words: WordAnnotation[];
  usage?: TokenUsage; // 可选的token使用统计
}

export interface AnnotationProvider {
  name: string;
  label: string;
  annotate: (text: string, targetLanguage?: string, signal?: AbortSignal) => Promise<AnnotationResponse>;
}



export const ErrorCodes = {
  LLM_API_ERROR: 'LLM API Error',
  PARSE_ERROR: 'Parse Error',
  NETWORK_ERROR: 'Network Error',
  QUOTA_EXCEEDED: 'Quota Exceeded',
} as const;
