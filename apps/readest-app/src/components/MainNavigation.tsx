import { FC } from 'react';
import { useRouter } from 'next/navigation';

interface MainNavigationProps {
  currentPage: 'library' | 'vocabulary' | 'bookstore';
}

const MainNavigation: FC<MainNavigationProps> = ({ currentPage }) => {
  const router = useRouter();

  const handleNavigation = (page: 'library' | 'vocabulary' | 'bookstore') => {
    switch (page) {
      case 'library':
        router.push('/library');
        break;
      case 'vocabulary':
        router.push('/vocabulary');
        break;
      case 'bookstore':
        router.push('/bookstore');
        break;
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center bg-base-100 shadow-2xl rounded-full border border-base-300 backdrop-blur-sm bg-opacity-90 p-1">
        <button
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            currentPage === 'library' 
              ? 'bg-primary text-primary-content shadow-md' 
              : 'text-base-content hover:bg-base-200'
          }`}
          onClick={() => handleNavigation('library')}
        >
          Library
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            currentPage === 'vocabulary' 
              ? 'bg-primary text-primary-content shadow-md' 
              : 'text-base-content hover:bg-base-200'
          }`}
          onClick={() => handleNavigation('vocabulary')}
        >
          Vocabulary
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            currentPage === 'bookstore' 
              ? 'bg-primary text-primary-content shadow-md' 
              : 'text-base-content hover:bg-base-200'
          }`}
          onClick={() => handleNavigation('bookstore')}
        >
          Bookstore
        </button>
      </div>
    </div>
  );
};

export default MainNavigation;
