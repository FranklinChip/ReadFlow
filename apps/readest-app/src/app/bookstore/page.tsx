'use client';

import { useState, useRef } from 'react';
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';

import MainNavigation from '@/components/MainNavigation';
import PageHeader from '@/components/PageHeader';
import BookstoreHeader from './components/BookstoreHeader';
import BookstoreGrid from './components/BookstoreGrid';

const BookstorePage = () => {
  const insets = useSafeAreaInsets();
  
  const [loading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });
  useUICSS();

  return (
    <div
      ref={pageRef}
      className="bookstore-page flex h-screen w-full flex-col overflow-hidden bg-base-200"
      style={{
        paddingTop: `${insets?.top || 0}px`,
        paddingBottom: `${insets?.bottom || 0}px`,
        paddingLeft: `${insets?.left || 0}px`,
        paddingRight: `${insets?.right || 0}px`,
      }}
    >
      <MainNavigation currentPage="bookstore" />
      <BookstoreHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        loading={loading}
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
          <div className="p-4">
            <BookstoreGrid
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              loading={loading}
            />
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  );
};

export default BookstorePage;
