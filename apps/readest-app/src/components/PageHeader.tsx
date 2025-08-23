'use client';

import clsx from 'clsx';
import React, { useRef, useEffect } from 'react';
import { MdArrowBackIosNew } from 'react-icons/md';
import { useRouter } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import WindowButtons from '@/components/WindowButtons';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  children,
  className,
}) => {
  const router = useRouter();
  const { appService } = useEnv();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const {
    isTrafficLightVisible,
    initializeTrafficLightStore,
    initializeTrafficLightListeners,
    setTrafficLightVisibility,
    cleanupTrafficLightListeners,
  } = useTrafficLightStore();
  const insets = useSafeAreaInsets();
  const headerRef = useRef<HTMLDivElement>(null);
  const iconSize20 = useResponsiveSize(20);

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    initializeTrafficLightStore(appService);
    initializeTrafficLightListeners();
    setTrafficLightVisibility(true);
    return () => {
      cleanupTrafficLightListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  if (!insets) return null;

  return (
    <div
      ref={headerRef}
      className={clsx(
        'titlebar bg-base-200 z-10 flex h-[52px] w-full items-center py-2 pr-4 sm:h-[48px] sm:pr-6',
        isTrafficLightVisible ? 'pl-16' : 'pl-0 sm:pl-2',
        className,
      )}
      style={{
        marginTop: appService?.hasSafeAreaInset
          ? `max(${insets.top}px, ${systemUIVisible ? statusBarHeight : 0}px)`
          : '0px',
      }}
    >
      <div className='flex w-full items-center justify-between space-x-6 sm:space-x-12'>
        <div className='exclude-title-bar-mousedown relative flex w-full items-center pl-4'>
          {showBackButton && (
            <button
              onClick={handleBack}
              className='ml-[-6px] mr-4 flex h-7 min-h-7 w-7 items-center p-0'
            >
              <div className='lg:tooltip lg:tooltip-bottom' data-tip='Go Back'>
                <MdArrowBackIosNew size={iconSize20} />
              </div>
            </button>
          )}
          
          <div className='flex items-center'>
            <h1 className='text-lg font-semibold text-base-content'>{title}</h1>
          </div>
        </div>

        <div className='flex h-full items-center gap-x-2 sm:gap-x-4'>
          {children}
          
          {appService?.hasWindowBar && (
            <WindowButtons
              headerRef={headerRef}
              showMinimize={windowButtonVisible}
              showMaximize={windowButtonVisible}
              showClose={windowButtonVisible}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
