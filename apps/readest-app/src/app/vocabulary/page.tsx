'use client';

import { useState, useRef } from 'react';
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { useVocabularyStore } from '@/store/vocabularyStore';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';
import { eventDispatcher } from '@/utils/event';

import MainNavigation from '@/components/MainNavigation';
import Dialog from '@/components/Dialog';
import VocabularyHeader from './components/VocabularyHeader';
import WordlistSection from './components/WordlistSection';
import PersonalVocabularySection from './components/PersonalVocabularySection';
import ImportSection from './components/ImportSection';

const VocabularyPage = () => {
  const insets = useSafeAreaInsets();
  const {
    loadedWordlists,
    initializeWordlist,
    importWordlist,
    clearPersonalVocabulary,
    getPersonalWords,
    getAllWordlists,
    removeWord
  } = useVocabularyStore();
  
  const personalWords = getPersonalWords();
  const allWordlists = getAllWordlists();
  console.log(allWordlists.length, allWordlists);
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'wordlists' | 'personal' | 'import'>('wordlists');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [wordToDelete, setWordToDelete] = useState<string | null>(null);
  
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });
  useUICSS();

  const handleInitializeWordlist = async (wordlistId: string) => {
    setLoading(true);
    try {
      await initializeWordlist(wordlistId);
      eventDispatcher.dispatch('toast', {
        message: 'Wordlist initialized successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to initialize wordlist:', error);
      eventDispatcher.dispatch('toast', {
        message: 'Failed to initialize wordlist',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setLoading(true);
    try {
      const content = await file.text();
      let words: string[];
      
      if (file.name.endsWith('.json')) {
        // Handle JSON format
        const jsonData = JSON.parse(content);
        if (!Array.isArray(jsonData) || !jsonData.every(word => typeof word === 'string')) {
          throw new Error('Invalid JSON file format. Expected an array of strings.');
        }
        words = jsonData;
      } else if (file.name.endsWith('.txt')) {
        // Handle TXT format
        words = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#')); // Filter out empty lines and comments
        
        if (words.length === 0) {
          throw new Error('TXT file is empty or contains no valid words.');
        }
      } else {
        throw new Error('Unsupported file format. Please use .json or .txt files.');
      }
      
      const fileName = file.name.replace(/\.(json|txt)$/, '');
      await importWordlist(fileName, words);
      eventDispatcher.dispatch('toast', {
        message: 'Wordlist imported successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to import wordlist:', error);
      eventDispatcher.dispatch('toast', {
        message: 'Failed to import wordlist. Please check file format.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearPersonalVocabulary = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearVocabulary = async () => {
    await clearPersonalVocabulary();
    eventDispatcher.dispatch('toast', {
      message: 'Personal vocabulary cleared',
      type: 'success',
    });
    setShowClearConfirm(false);
  };

  const cancelClearVocabulary = () => {
    setShowClearConfirm(false);
  };

  const handleDeleteWord = async (word: string) => {
    setWordToDelete(word);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteWord = async () => {
    if (wordToDelete) {
      await removeWord(wordToDelete);
      eventDispatcher.dispatch('toast', {
        message: 'Word removed from vocabulary',
        type: 'success',
      });
    }
    setShowDeleteConfirm(false);
    setWordToDelete(null);
  };

  const cancelDeleteWord = () => {
    setShowDeleteConfirm(false);
    setWordToDelete(null);
  };

  return (
    <div
      ref={pageRef}
      className="vocabulary-page flex h-screen w-full flex-col overflow-hidden bg-base-200"
      style={{
        paddingTop: `${insets?.top || 0}px`,
        paddingBottom: `${insets?.bottom || 0}px`,
        paddingLeft: `${insets?.left || 0}px`,
        paddingRight: `${insets?.right || 0}px`,
      }}
    >
      <MainNavigation currentPage="vocabulary" />
      <VocabularyHeader 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="relative flex-1 overflow-hidden" ref={containerRef}>
        <OverlayScrollbarsComponent
          ref={osRef}
          defer
          className="h-full w-full"
          options={{
            overflow: {
              x: 'hidden',
              y: 'scroll',
            },
            scrollbars: {
              theme: 'os-theme-dark',
              visibility: 'auto',
              autoHide: 'leave',
              autoHideDelay: 800,
            },
          }}
        >
          <div className="p-4 space-y-6">
            {activeTab === 'wordlists' && (
              <WordlistSection
                availableWordlists={allWordlists}
                loadedWordlists={loadedWordlists}
                onInitializeWordlist={handleInitializeWordlist}
                loading={loading}
              />
            )}

            {activeTab === 'personal' && (
              <PersonalVocabularySection
                personalWords={personalWords}
                onClearAll={handleClearPersonalVocabulary}
                onDeleteWord={handleDeleteWord}
                loading={loading}
              />
            )}

            {activeTab === 'import' && (
              <ImportSection
                onImportFile={handleImportFile}
                loading={loading}
              />
            )}
          </div>
        </OverlayScrollbarsComponent>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Dialog
          isOpen={showDeleteConfirm}
          title="Confirm Deletion"
          onClose={cancelDeleteWord}
          boxClassName="sm:!w-96"
        >
          <div className="p-4">
            <p className="text-base-content mb-6">
              Are you sure you want to delete &ldquo;{wordToDelete}&rdquo; from your vocabulary?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn btn-outline"
                onClick={cancelDeleteWord}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={confirmDeleteWord}
              >
                Delete
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <Dialog
          isOpen={showClearConfirm}
          title="Clear All Vocabulary"
          onClose={cancelClearVocabulary}
          boxClassName="sm:!w-96"
        >
          <div className="p-4">
            <p className="text-base-content mb-6">
              Are you sure you want to clear all personal vocabulary? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="btn btn-outline"
                onClick={cancelClearVocabulary}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={confirmClearVocabulary}
              >
                Clear All
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default VocabularyPage;
