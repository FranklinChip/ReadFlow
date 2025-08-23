import { FC, useState } from 'react';
import { MdDelete } from 'react-icons/md';

interface PersonalWord {
  word: string;
  addedAt: number;
  type: 'word' | 'phrase';
}

interface PersonalVocabularySectionProps {
  personalWords: PersonalWord[];
  onClearAll: () => void;
  onDeleteWord: (word: string) => void;
  loading: boolean;
}

const PersonalVocabularySection: FC<PersonalVocabularySectionProps> = ({
  personalWords,
  onClearAll,
  onDeleteWord,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'word' | 'addedAt' | 'type'>('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'words' | 'phrases'>('words');

  const words = personalWords.filter(item => item.type === 'word');
  const phrases = personalWords.filter(item => item.type === 'phrase');

  const filteredAndSortedItems = (items: PersonalWord[]) => {
    const filtered = items.filter(item =>
      item.word.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'word':
          comparison = a.word.localeCompare(b.word);
          break;
        case 'addedAt':
          comparison = a.addedAt - b.addedAt;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const currentItems = activeTab === 'words' ? words : phrases;
  const filteredItems = filteredAndSortedItems(currentItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-base-content">
          Personal Vocabulary
        </h2>
        <div className="text-sm text-base-content/60">
          {words.length} words • {phrases.length} phrases
        </div>
      </div>

      {personalWords.length > 0 && (
        <div className="bg-base-100 rounded-lg border border-base-300 p-4">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4">
            <button
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'words' 
                  ? 'bg-primary text-primary-content' 
                  : 'text-base-content/60 hover:text-base-content/80'
              }`}
              onClick={() => setActiveTab('words')}
            >
              Words ({words.length})
            </button>
            <button
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'phrases' 
                  ? 'bg-primary text-primary-content' 
                  : 'text-base-content/60 hover:text-base-content/80'
              }`}
              onClick={() => setActiveTab('phrases')}
            >
              Phrases ({phrases.length})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                className="input input-bordered w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <select
                className="select select-bordered"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'word' | 'addedAt' | 'type')}
              >
                <option value="addedAt">Date Added</option>
                <option value="word">{activeTab === 'words' ? 'Word' : 'Phrase'}</option>
              </select>
              
              <button
                className="btn btn-outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <button
              className="btn btn-error btn-sm"
              onClick={onClearAll}
              disabled={loading}
            >
              {loading && (
                <span className="loading loading-spinner loading-xs"></span>
              )}
              Clear All
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredItems.map((item) => (
              <div
                key={item.word}
                className="flex items-center justify-between p-3 bg-base-50 rounded border border-base-200"
              >
                <div className="flex-1">
                  <span className="font-medium text-base-content">
                    {item.word}
                  </span>
                  <div className="text-xs text-base-content/50 mt-1">
                    Added: {new Date(item.addedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`badge badge-sm ${
                    item.type === 'word' ? 'badge-primary' : 'badge-secondary'
                  }`}>
                    {item.type === 'word' ? 'Word' : 'Phrase'}
                  </span>
                  <span className="badge badge-success badge-sm">
                    Known
                  </span>
                  <button
                    className="btn btn-error btn-xs"
                    onClick={() => onDeleteWord(item.word)}
                    disabled={loading}
                    title={`Delete ${item.type}`}
                  >
                    <MdDelete size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && searchTerm && (
            <div className="text-center py-4 text-base-content/60">
              {`No ${activeTab} found matching "${searchTerm}"`}
            </div>
          )}

          {filteredItems.length === 0 && !searchTerm && (
            <div className="text-center py-4 text-base-content/60">
              {`No ${activeTab} added yet`}
            </div>
          )}
        </div>
      )}

      {personalWords.length === 0 && (
        <div className="text-center py-8">
          <div className="text-base-content/40 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <p className="text-base-content/60">
            No personal vocabulary yet
          </p>
          <p className="text-sm text-base-content/40 mt-1">
            Words and phrases you mark as known will appear here
          </p>
        </div>
      )}
    </div>
  );
};

export default PersonalVocabularySection;
