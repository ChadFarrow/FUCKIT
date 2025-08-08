'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive?: boolean;
}

const FinampNavigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navigationItems: NavigationItem[] = [
    {
      label: 'Albums',
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      ),
    },
    {
      label: 'Artists',
      href: '/artists',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V16.5C15 17.9 13.9 19 12.5 19S10 17.9 10 16.5 11.1 14 12.5 14 15 15.1 15 16.5V10L21 9ZM7.5 12C9.43 12 11 13.57 11 15.5S9.43 19 7.5 19 4 17.43 4 15.5 5.57 12 7.5 12Z"/>
        </svg>
      ),
    },
    {
      label: 'Playlists',
      href: '/playlists',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
        </svg>
      ),
    },
    {
      label: 'Now Playing',
      href: '/now-playing',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      ),
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
        </svg>
      ),
    },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile App Bar */}
        <header 
          className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 backdrop-blur-md border-b"
          style={{
            backgroundColor: 'var(--finamp-surface-container)',
            borderColor: 'var(--finamp-outline-variant)'
          }}
        >
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="finamp-button finamp-button--icon mr-3"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          
          <h1 className="finamp-title-large" style={{ color: 'var(--finamp-on-surface)' }}>
            Project StableKraft
          </h1>
        </header>

        {/* Mobile Drawer */}
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-50 bg-black bg-opacity-50"
              onClick={() => setIsDrawerOpen(false)}
            />
            
            {/* Drawer */}
            <nav 
              className="fixed top-0 left-0 bottom-0 z-50 w-80 transform transition-transform duration-300"
              style={{
                backgroundColor: 'var(--finamp-surface-container)',
                transform: isDrawerOpen ? 'translateX(0)' : 'translateX(-100%)'
              }}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--finamp-primary)' }}
                  >
                    <svg className="w-6 h-6" style={{ color: 'var(--finamp-on-primary)' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="finamp-title-medium" style={{ color: 'var(--finamp-on-surface)' }}>
                      StableKraft
                    </h2>
                    <p className="finamp-body-small" style={{ color: 'var(--finamp-on-surface-variant)' }}>
                      Music Hub
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        isActiveRoute(item.href) 
                          ? 'shadow-sm' 
                          : 'hover:shadow-sm'
                      }`}
                      style={{
                        backgroundColor: isActiveRoute(item.href) 
                          ? 'var(--finamp-secondary-container)' 
                          : 'transparent',
                        color: isActiveRoute(item.href) 
                          ? 'var(--finamp-on-secondary-container)' 
                          : 'var(--finamp-on-surface-variant)'
                      }}
                    >
                      {item.icon}
                      <span className="finamp-body-large">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </>
        )}
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <nav 
          className="fixed top-0 left-0 bottom-0 w-64 z-40 border-r overflow-y-auto"
          style={{
            backgroundColor: 'var(--finamp-surface-container)',
            borderColor: 'var(--finamp-outline-variant)'
          }}
        >
          <div className="p-6">
            {/* Logo Section */}
            <div className="flex items-center gap-3 mb-8">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--finamp-primary)' }}
              >
                <svg className="w-7 h-7" style={{ color: 'var(--finamp-on-primary)' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <div>
                <h1 className="finamp-title-large" style={{ color: 'var(--finamp-on-surface)' }}>
                  StableKraft
                </h1>
                <p className="finamp-body-small" style={{ color: 'var(--finamp-on-surface-variant)' }}>
                  Music Discovery Hub
                </p>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                    isActiveRoute(item.href) 
                      ? 'shadow-sm' 
                      : 'hover:shadow-sm'
                  }`}
                  style={{
                    backgroundColor: isActiveRoute(item.href) 
                      ? 'var(--finamp-secondary-container)' 
                      : 'transparent',
                    color: isActiveRoute(item.href) 
                      ? 'var(--finamp-on-secondary-container)' 
                      : 'var(--finamp-on-surface-variant)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActiveRoute(item.href)) {
                      e.currentTarget.style.backgroundColor = 'var(--finamp-surface-variant)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActiveRoute(item.href)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div className="transition-transform group-hover:scale-110">
                    {item.icon}
                  </div>
                  <span className="finamp-body-large font-medium">{item.label}</span>
                  
                  {isActiveRoute(item.href) && (
                    <div 
                      className="ml-auto w-1 h-6 rounded-full"
                      style={{ backgroundColor: 'var(--finamp-primary)' }}
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* Bottom Section */}
            <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--finamp-outline-variant)' }}>
              <div className="text-center">
                <p className="finamp-label-small" style={{ color: 'var(--finamp-on-surface-variant)' }}>
                  Version 1.0.0
                </p>
                <p className="finamp-label-small mt-1" style={{ color: 'var(--finamp-on-surface-variant)', opacity: 0.7 }}>
                  Built with ❤️
                </p>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
};

export default FinampNavigation;
