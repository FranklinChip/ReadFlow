import { FC } from 'react';

interface VocabularyHeaderProps {
  activeTab: 'wordlists' | 'personal' | 'import';
  onTabChange: (tab: 'wordlists' | 'personal' | 'import') => void;
  loading: boolean;
}

const VocabularyHeader: FC<VocabularyHeaderProps> = ({
  activeTab,
  onTabChange,
  loading,
}) => {
  return (
    <div className="bg-base-100 border-b border-base-300 shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-base-content">
            Vocabulary
          </h1>
          {loading && (
            <div className="flex items-center space-x-2">
              <span className="loading loading-spinner loading-sm"></span>
              <span className="text-sm text-base-content/60">
                Loading...
              </span>
            </div>
          )}
        </div>

        <div className="tabs tabs-boxed bg-base-200">
          <button
            className={`tab ${activeTab === 'wordlists' ? 'tab-active' : ''}`}
            onClick={() => onTabChange('wordlists')}
          >
            Wordlists
          </button>
          <button
            className={`tab ${activeTab === 'personal' ? 'tab-active' : ''}`}
            onClick={() => onTabChange('personal')}
          >
            Personal
          </button>
          <button
            className={`tab ${activeTab === 'import' ? 'tab-active' : ''}`}
            onClick={() => onTabChange('import')}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default VocabularyHeader;
