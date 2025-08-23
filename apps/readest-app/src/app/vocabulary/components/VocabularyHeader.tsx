import { FC } from 'react';
import PageHeader from '@/components/PageHeader';

interface VocabularyHeaderProps {
  activeTab: 'wordlists' | 'personal' | 'import';
  onTabChange: (tab: 'wordlists' | 'personal' | 'import') => void;
}

const VocabularyHeader: FC<VocabularyHeaderProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <>
     <PageHeader title="Vocabulary" className="select-none" />
      
      <div className="bg-base-100 border-b border-base-300 shadow-sm">
        <div className="px-4 py-3">
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
    </>
  );
};

export default VocabularyHeader;
