'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getSessionId } from '@/lib/session-utils';

interface SessionContextType {
  sessionId: string | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType>({
  sessionId: null,
  isLoading: true
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get or create session ID on mount
    try {
      const id = getSessionId();
      setSessionId(id);
    } catch (error) {
      console.error('Error initializing session:', error);
      setSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sessionValue = useMemo(() => ({ sessionId, isLoading }), [sessionId, isLoading]);

  return (
    <SessionContext.Provider value={sessionValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  
  return context;
}

