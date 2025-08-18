import { FC, useRef } from 'react';

interface ImportSectionProps {
  onImportFile: (file: File) => void;
  loading: boolean;
}

const ImportSection: FC<ImportSectionProps> = ({
  onImportFile,
  loading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.txt'))) {
      onImportFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-base-content mb-2">
          Import Wordlist
        </h2>
        <p className="text-sm text-base-content/60">
          Import custom wordlists from JSON or TXT files
        </p>
      </div>

      <div className="bg-base-100 rounded-lg border border-base-300 p-6">
        <div
          className="border-2 border-dashed border-base-300 rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-base-content/40 mb-4">
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-base-content mb-2">
            Drop JSON or TXT file here
          </h3>
          <p className="text-sm text-base-content/60 mb-4">
            or click to browse files
          </p>
          
          <button
            className="btn btn-primary"
            disabled={loading}
            type="button"
          >
            {loading && (
              <span className="loading loading-spinner loading-sm"></span>
            )}
            Select File
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="bg-base-100 rounded-lg border border-base-300 p-4">
        <h3 className="font-medium text-base-content mb-3">
          File Format Requirements
        </h3>
        
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-base-content">
              Format:
            </span>
            <span className="text-base-content/60 ml-2">
              JSON array of strings or TXT (one word per line)
            </span>
          </div>
          
          <div>
            <span className="font-medium text-base-content">
              JSON Example:
            </span>
            <div className="mockup-code mt-2 text-xs">
              <pre data-prefix="1">
                <code>[</code>
              </pre>
              <pre data-prefix="2">
                <code>  &quot;word1&quot;,</code>
              </pre>
              <pre data-prefix="3">
                <code>  &quot;word2&quot;,</code>
              </pre>
              <pre data-prefix="4">
                <code>  &quot;word3&quot;</code>
              </pre>
              <pre data-prefix="5">
                <code>]</code>
              </pre>
            </div>
          </div>
          
          <div>
            <span className="font-medium text-base-content">
              TXT Example:
            </span>
            <div className="mockup-code mt-2 text-xs">
              <pre data-prefix="1">
                <code>word1</code>
              </pre>
              <pre data-prefix="2">
                <code>word2</code>
              </pre>
              <pre data-prefix="3">
                <code>word3</code>
              </pre>
            </div>
          </div>
          
          <div>
            <span className="font-medium text-base-content">
              File size:
            </span>
            <span className="text-base-content/60 ml-2">
              Maximum 10MB
            </span>
          </div>
        </div>
      </div>

      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-info mt-0.5">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-info mb-1">
              Tips for importing wordlists:
            </p>
            <ul className="list-disc list-inside space-y-1 text-info/80">
              <li>Ensure words are in lowercase for better matching</li>
              <li>Remove duplicate words before importing</li>
              <li>Large wordlists may take some time to process</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportSection;
