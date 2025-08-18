import { FC } from 'react';

interface WordlistInfo {
  id: string;
  name: string;
  description?: string;
  wordCount: number;
}

interface WordlistSectionProps {
  availableWordlists: WordlistInfo[];
  loadedWordlists: Set<string>;
  onInitializeWordlist: (wordlistId: string) => void;
  loading: boolean;
}

const WordlistSection: FC<WordlistSectionProps> = ({
  availableWordlists,
  loadedWordlists,
  onInitializeWordlist,
  loading,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-base-content">
          Available Wordlists
        </h2>
        <div className="text-sm text-base-content/60">
          {loadedWordlists.size} / {availableWordlists.length} loaded
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {availableWordlists.map((wordlist) => {
          const isLoaded = loadedWordlists.has(wordlist.id);
          
          return (
            <div
              key={wordlist.id}
              className="card bg-base-100 shadow-md border border-base-300"
            >
              <div className="card-body p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="card-title text-base font-medium">
                      {wordlist.name}
                    </h3>
                    {wordlist.description && (
                      <p className="text-sm text-base-content/60 mt-1">
                        {wordlist.description}
                      </p>
                    )}
                    <div className="text-xs text-base-content/50 mt-2">
                      {wordlist.wordCount.toLocaleString()} words
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isLoaded && (
                      <div className="badge badge-success badge-sm">
                        Loaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions justify-end mt-3">
                  <button
                    className={`btn btn-sm ${
                      isLoaded ? 'btn-outline' : 'btn-primary'
                    }`}
                    disabled={loading}
                    onClick={() => onInitializeWordlist(wordlist.id)}
                  >
                    {loading && (
                      <span className="loading loading-spinner loading-xs"></span>
                    )}
                    {isLoaded ? 'Reload' : 'Load'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {availableWordlists.length === 0 && (
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <p className="text-base-content/60">
            No wordlists available
          </p>
          <p className="text-sm text-base-content/40 mt-1">
            Add wordlists to the vocabulary/wordlists folder
          </p>
        </div>
      )}
    </div>
  );
};

export default WordlistSection;
