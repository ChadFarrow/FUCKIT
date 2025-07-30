'use client';

import React, { useEffect } from 'react';

interface ClientErrorBoundaryProps {
  children: React.ReactNode;
}

const ClientErrorBoundary: React.FC<ClientErrorBoundaryProps> = ({ children }) => {
  useEffect(() => {
    // Global error handler for debugging
    const handleError = (event: ErrorEvent) => {
      console.error('🔍 Global error caught:', event.error);
      
      // Log additional context for debugging
      if (event.error && event.error.stack) {
        console.error('Stack trace:', event.error.stack);
      }
    };

    // Global unhandled rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🔍 Global promise rejection caught:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};

export default ClientErrorBoundary; 