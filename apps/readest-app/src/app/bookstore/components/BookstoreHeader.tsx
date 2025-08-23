import { FC } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import PageHeader from '@/components/PageHeader';

interface BookstoreHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  loading: boolean;
}

const BookstoreHeader: FC<BookstoreHeaderProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  loading,
}) => {
  const _ = useTranslation();

  const categories = [
    { id: 'all', name: _('All') },
    { id: 'fiction', name: _('Fiction') },
    { id: 'science', name: _('Science') },
    { id: 'technology', name: _('Technology') },
    { id: 'history', name: _('History') },
    { id: 'philosophy', name: _('Philosophy') },
  ];

  return (
    <>
      <PageHeader title={_('Bookstore')}>
        {loading && (
          <div className="flex items-center space-x-2">
            <span className="loading loading-spinner loading-sm"></span>
            <span className="text-sm text-base-content/60">
              {_('Loading...')}
            </span>
          </div>
        )}
      </PageHeader>
      
      <div className="bg-base-100 border-b border-base-300 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder={_('Search books...')}
                className="input input-bordered w-full"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            
            <div className="flex-shrink-0">
              <select
                className="select select-bordered w-full sm:w-auto"
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BookstoreHeader;
