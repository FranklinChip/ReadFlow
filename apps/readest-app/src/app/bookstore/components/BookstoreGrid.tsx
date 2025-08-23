import { FC, useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverUrl?: string;
  downloadUrl?: string;
  format: string;
  fileSize: string;
}

interface BookstoreGridProps {
  searchQuery: string;
  selectedCategory: string;
  loading: boolean;
}

const BookstoreGrid: FC<BookstoreGridProps> = ({
  searchQuery,
  selectedCategory,
  loading,
}) => {
  const _ = useTranslation();
  const [books, setBooks] = useState<Book[]>([]);

  // Mock data - in real implementation, this would come from an API
  useEffect(() => {
    const mockBooks: Book[] = [
      {
        id: '1',
        title: 'The Art of Programming',
        author: 'John Smith',
        category: 'technology',
        description: 'A comprehensive guide to modern programming techniques.',
        format: 'EPUB',
        fileSize: '2.5 MB',
      },
      {
        id: '2',
        title: 'Introduction to Science',
        author: 'Jane Doe',
        category: 'science',
        description: 'Basic principles of natural sciences explained clearly.',
        format: 'PDF',
        fileSize: '8.1 MB',
      },
      {
        id: '3',
        title: 'World History Chronicles',
        author: 'Bob Wilson',
        category: 'history',
        description: 'An in-depth look at major historical events.',
        format: 'EPUB',
        fileSize: '4.2 MB',
      },
      {
        id: '4',
        title: 'Philosophy of Mind',
        author: 'Alice Johnson',
        category: 'philosophy',
        description: 'Exploring consciousness and human thought.',
        format: 'MOBI',
        fileSize: '1.8 MB',
      },
      {
        id: '5',
        title: 'Modern Fiction Tales',
        author: 'David Brown',
        category: 'fiction',
        description: 'A collection of contemporary short stories.',
        format: 'EPUB',
        fileSize: '3.7 MB',
      },
    ];

    // Filter books based on search and category
    let filteredBooks = mockBooks;
    
    if (selectedCategory !== 'all') {
      filteredBooks = filteredBooks.filter(book => book.category === selectedCategory);
    }
    
    if (searchQuery) {
      filteredBooks = filteredBooks.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setBooks(filteredBooks);
  }, [searchQuery, selectedCategory]);

  const handleDownload = (book: Book) => {
    // In real implementation, this would download the book
    console.log('Download book:', book);
    alert(`${_('Download started for')} "${book.title}"`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-base-content/40 mb-2">
          <svg
            className="w-16 h-16 mx-auto"
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
        <h3 className="text-lg font-medium text-base-content mb-2">
          {_('No books found')}
        </h3>
        <p className="text-base-content/60">
          {searchQuery
            ? _('Try adjusting your search terms')
            : _('No books available in this category')
          }
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => (
        <div
          key={book.id}
          className="card bg-base-100 shadow-lg border border-base-300 hover:shadow-xl transition-shadow"
        >
          <div className="card-body p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="card-title text-base font-semibold">
                  {book.title}
                </h3>
                <p className="text-sm text-base-content/70 mt-1">
                  {_('by')} {book.author}
                </p>
              </div>
            </div>

            <p className="text-sm text-base-content/60 mb-4">
              {book.description}
            </p>

            <div className="flex items-center justify-between text-xs text-base-content/50 mb-4">
              <span className="badge badge-outline badge-sm">
                {book.format}
              </span>
              <span>{book.fileSize}</span>
            </div>

            <div className="card-actions justify-end">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleDownload(book)}
              >
                {_('Download')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookstoreGrid;
