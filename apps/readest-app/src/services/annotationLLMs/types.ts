export interface WordAnnotation {
  word: string;
  lemma: string;
  zh: string;
  en: string;
}

export interface MWEAnnotation {
  phrase: string;
  lemma: string;
  zh: string;
  en: string;
}

export interface ProperNounAnnotation {
  phrase: string; // 改为phrase以支持多词专有名词
  zh: string;
  en: string;
}

export interface AnnotationResponse {
  mwes: MWEAnnotation[];
  proper_nouns: ProperNounAnnotation[];
  words: WordAnnotation[];
}

export interface AnnotationProvider {
  name: string;
  label: string;
  annotate: (text: string) => Promise<AnnotationResponse>;
}



export const ErrorCodes = {
  LLM_API_ERROR: 'LLM API Error',
  PARSE_ERROR: 'Parse Error',
  NETWORK_ERROR: 'Network Error',
  QUOTA_EXCEEDED: 'Quota Exceeded',
} as const;
