import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { eventDispatcher } from '@/utils/event';

export interface VocabularyWord {
  word: string; // 现在直接存储 lemma 形式
  addedAt: number;
  type: 'word' | 'phrase'; // 区分单词和词组
}

export interface WordlistInfo {
  id: string;
  name: string;
  description?: string;
  wordCount: number;
}

export interface PersonalWord {
  word: string;
  addedAt: number;
  type: 'word' | 'phrase';
}

export interface VocabularyState {
  words: VocabularyWord[];
  selectedWordlist: string;
  availableWordlists: WordlistInfo[];
  importedWordlists: WordlistInfo[]; // 用户导入的wordlists
  loadedWordlists: Set<string>;
  
  // Actions
  addWord: (word: string, type?: 'word' | 'phrase') => void;
  removeWord: (word: string) => void;
  setSelectedWordlist: (wordlist: string) => void;
  importWordsFromFile: (words: string[]) => void;
  initializeFromWordlist: (words: string[]) => void;
  clearVocabulary: () => void;
  hasWord: (word: string) => boolean;
  
  // New actions for UI
  initializeWordlist: (wordlistId: string) => Promise<void>;
  importWordlist: (name: string, words: string[]) => Promise<void>;
  clearPersonalVocabulary: () => Promise<void>;
  getPersonalWords: () => PersonalWord[];
  getAllWordlists: () => WordlistInfo[]; // 获取所有wordlists（默认+导入的）
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      words: [],
      selectedWordlist: '',
      importedWordlists: [],
      availableWordlists: [
        {
          id: 'basic-english',
          name: 'Basic English',
          description: 'Essential words for everyday communication',
          wordCount: 850
        },
        {
          id: 'academic-english',
          name: 'Academic English',
          description: 'Words commonly used in academic writing',
          wordCount: 570
        },
        {
          id: 'common-english',
          name: 'Common English',
          description: 'Most frequently used English words',
          wordCount: 3000
        },
        {
          id: 'advanced-english',
          name: 'Advanced English',
          description: 'Advanced vocabulary for proficient speakers',
          wordCount: 120
        },
        {
          id: 'cet-2200',
          name: 'CET(2200)不含常用词汇',
          description: 'CET 2200 words excluding common vocabulary',
          wordCount: 2200
        },
        {
          id: 'cet-4600',
          name: 'CET(4600)',
          description: 'Complete CET 4600 vocabulary',
          wordCount: 4600
        },
        {
          id: 'gre-8000',
          name: 'GRE(8000)不含常用词汇',
          description: 'GRE 8000 words excluding common vocabulary',
          wordCount: 8000
        },
        {
          id: 'toefl-4500',
          name: 'TOEFL(4500)不含常用词汇',
          description: 'TOEFL 4500 words excluding common vocabulary',
          wordCount: 4500
        },
        {
          id: 'zhongkao-2000',
          name: '中考2000',
          description: 'Essential 2000 words for middle school entrance exam',
          wordCount: 2000
        },
        {
          id: 'common-3000',
          name: '常用3000',
          description: 'Most common 3000 English words',
          wordCount: 3000
        },
        {
          id: 'common-5000',
          name: '常用5000',
          description: 'Most common 5000 English words',
          wordCount: 5000
        },
        {
          id: 'common-8000',
          name: '常用8000',
          description: 'Most common 8000 English words',
          wordCount: 8000
        },
        {
          id: 'english-major',
          name: '英语专业四八级(13000)',
          description: 'English major TEM-4 and TEM-8 vocabulary',
          wordCount: 13000
        }
      ],
      loadedWordlists: new Set<string>(),

      getPersonalWords: () => {
        return get().words.map(word => ({
          word: word.word,
          addedAt: word.addedAt,
          type: word.type,
        }));
      },

      getAllWordlists: () => {
        const { availableWordlists, importedWordlists } = get();
        return [...availableWordlists, ...importedWordlists];
      },

      addWord: (word: string, type: 'word' | 'phrase' = 'word') => {
        const { words } = get();
        
        // 直接使用传入的 lemma，无需转换
        const trimmedWord = word.trim();
        if (!trimmedWord) return;
        
        // 检查是否已存在
        if (words.some(w => w.word === trimmedWord && w.type === type)) {
          return; // 已存在，不重复添加
        }
        
        const newWord: VocabularyWord = {
          word: trimmedWord,
          type,
          addedAt: Date.now(),
        };
        
        set({ words: [...words, newWord] });
        
        // 触发全局更新事件
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            eventDispatcher.dispatch('vocabulary-changed', {});
          }, 0);
        }
      },

      removeWord: (word: string) => {
        const { words } = get();
        
        // 直接使用传入的 lemma 进行匹配
        const trimmedWord = word.trim();
        if (!trimmedWord) return;
        
        set({ 
          words: words.filter(w => w.word !== trimmedWord)
        });
        
        // 触发全局更新事件
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            eventDispatcher.dispatch('vocabulary-changed', {});
          }, 0);
        }
      },

      setSelectedWordlist: (wordlist: string) => {
        set({ selectedWordlist: wordlist });
      },

      importWordsFromFile: (words: string[]) => {
        const { words: existingWords } = get();
        
        // 先去重输入的单词列表，直接使用传入的 lemma 形式
        const uniqueInputWords = Array.from(new Set(words.map(word => word.toLowerCase().trim())))
          .filter(word => word.length > 0);
        
        const newWords: VocabularyWord[] = [];
        
        uniqueInputWords.forEach(word => {
          if (!existingWords.some(w => w.word === word)) {
            newWords.push({
              word: word,
              addedAt: Date.now(),
              type: 'word', // 从文件导入的默认为单词
            });
          }
        });
        
        set({ words: [...existingWords, ...newWords] });
        
        // 触发全局更新事件
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            eventDispatcher.dispatch('vocabulary-changed', {});
          }, 0);
        }
      },

      initializeFromWordlist: (words: string[]) => {
        // 直接使用传入的 lemma 形式替换整个词汇表
        const uniqueWords = Array.from(new Set(words.map(word => word.toLowerCase().trim())))
          .filter(word => word.length > 0);
        
        const newWords: VocabularyWord[] = uniqueWords.map(word => ({
          word: word,
          addedAt: Date.now(),
          type: 'word',
        }));
        
        set({ words: newWords });
        
        // 触发全局更新事件
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            eventDispatcher.dispatch('vocabulary-changed', {});
          }, 0);
        }
      },

      clearVocabulary: () => {
        set({ words: [] });
      },

      hasWord: (word: string) => {
        const { words } = get();
        
        // 直接使用传入的 lemma 进行查找
        const trimmedWord = word.trim();
        return words.some(w => w.word === trimmedWord);
      },

      // New methods for UI
      initializeWordlist: async (wordlistId: string) => {
        const { loadedWordlists } = get();
        
        try {
          // Map wordlist IDs to their corresponding filenames
          const wordlistFileMap: Record<string, string> = {
            'basic-english': 'basic-english.json',
            'academic-english': 'academic-english.json',
            'common-english': 'common-english.json',
            'advanced-english': 'advanced-english.json',
            'cet-2200': 'CET(2200)不含常用词汇.txt',
            'cet-4600': 'CET(4600).txt',
            'gre-8000': 'GRE(8000)不含常用词汇.txt',
            'toefl-4500': 'TOEFL(4500)不含常用词汇.txt',
            'zhongkao-2000': '中考2000.txt',
            'common-3000': '常用3000.txt',
            'common-5000': '常用5000.txt',
            'common-8000': '常用8000.txt',
            'english-major': '英语专业四八级(13000).txt'
          };

          const filename = wordlistFileMap[wordlistId];
          if (!filename) {
            throw new Error(`Unknown wordlist ID: ${wordlistId}`);
          }

          const response = await fetch(`/vocabulary/wordlists/${filename}`);
          if (!response.ok) {
            throw new Error(`Failed to load wordlist: ${wordlistId}`);
          }
          
          let words: string[];
          
          // Handle different file formats
          if (filename.endsWith('.json')) {
            const jsonData = await response.json();
            if (!Array.isArray(jsonData)) {
              throw new Error('Invalid JSON wordlist format');
            }
            words = jsonData;
          } else if (filename.endsWith('.txt')) {
            const textData = await response.text();
            words = textData
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0 && !line.startsWith('#')); // Filter out empty lines and comments
          } else {
            throw new Error(`Unsupported file format: ${filename}`);
          }
          
          // 去重处理：使用 Set 来去除重复的单词
          const uniqueWords = Array.from(new Set(words.map(word => word.toLowerCase().trim())))
            .filter(word => word.length > 0);
          
          // Initialize vocabulary with this wordlist
          get().initializeFromWordlist(uniqueWords);
          
          // Mark as loaded
          const newLoadedWordlists = new Set(loadedWordlists);
          newLoadedWordlists.add(wordlistId);
          set({ loadedWordlists: newLoadedWordlists, selectedWordlist: wordlistId });
          
        } catch (error) {
          console.error('Error initializing wordlist:', error);
          throw error;
        }
      },

      importWordlist: async (name: string, words: string[]) => {
        try {
          // 先去重输入的单词列表
          const uniqueWords = Array.from(new Set(words.map(word => word.toLowerCase().trim())))
            .filter(word => word.length > 0);
          
          // Import words into personal vocabulary
          get().importWordsFromFile(uniqueWords);
          
          // Add to imported wordlists
          const { importedWordlists, loadedWordlists } = get();
          const newWordlist: WordlistInfo = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name,
            description: 'Imported wordlist',
            wordCount: uniqueWords.length // 使用去重后的数量
          };
          
          const newImportedWordlists = [...importedWordlists, newWordlist];
          const newLoadedWordlists = new Set(loadedWordlists);
          newLoadedWordlists.add(newWordlist.id);
          
          set({ 
            importedWordlists: newImportedWordlists,
            loadedWordlists: newLoadedWordlists,
            selectedWordlist: newWordlist.id
          });
          
        } catch (error) {
          console.error('Error importing wordlist:', error);
          throw error;
        }
      },

      clearPersonalVocabulary: async () => {
        set({ words: [] });
      },
    }),
    {
      name: 'vocabulary-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        words: state.words,
        selectedWordlist: state.selectedWordlist,
        importedWordlists: state.importedWordlists,
        loadedWordlists: Array.from(state.loadedWordlists),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 确保 loadedWordlists 是一个 Set
          const loadedWordlistsArray = state.loadedWordlists as string[] | Set<string>;
          state.loadedWordlists = new Set(Array.isArray(loadedWordlistsArray) 
            ? loadedWordlistsArray 
            : []
          );
          
          // 确保 importedWordlists 存在
          if (!state.importedWordlists) {
            state.importedWordlists = [];
          }
        }
      },
    }
  )
);
