'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { useNostr } from '@/contexts/NostrContext';

export interface UserSettings {
  // NIP-38 auto-status publishing
  nip38AutoStatus: boolean;

  // Lightning/Boost settings
  defaultBoostAmount?: number;
  defaultBoostName?: string;

  // Auto-boost settings
  autoBoostEnabled: boolean;   // Send boost automatically when track ends and on chapter transitions
  autoBoostAmount: number;     // Amount in sats for auto-boosts

  // Future settings can be added here
  // theme?: 'light' | 'dark' | 'auto';
  // notifications?: boolean;
  // etc.
}

interface UserSettingsContextType {
  settings: UserSettings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  nip38AutoStatus: false, // Default to disabled (opt-in)
  defaultBoostAmount: 21, // Default boost amount in sats
  defaultBoostName: '', // Default boost name (empty, will use "StableKraft.app user" as fallback)
  autoBoostEnabled: false, // Default to disabled (opt-in)
  autoBoostAmount: 50, // Default auto-boost amount in sats
};

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'user_settings';

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useNostr();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastPubkeyRef = useRef<string | null | undefined>(undefined);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Reset on identity change so per-account preferences don't bleed across logins on the same device.
  useEffect(() => {
    const pubkey = user?.nostrPubkey ?? null;
    if (lastPubkeyRef.current === undefined) {
      lastPubkeyRef.current = pubkey;
      return;
    }
    if (lastPubkeyRef.current === pubkey) return;
    const prev = lastPubkeyRef.current;
    lastPubkeyRef.current = pubkey;
    // Only wipe when switching between two distinct logged-in accounts.
    // null → pubkey is initial session restore on page load, not a user switch.
    if (prev !== null && pubkey !== null) {
      setSettings(defaultSettings);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear user settings:', error);
      }
    }
  }, [user?.nostrPubkey]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save user settings:', error);
      }
    }
  }, [settings, isLoaded]);

  // useCallback: both close over nothing but the setter, so they are stable
  // and the memo below can hold across setting changes it does not care about.
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const value: UserSettingsContextType = useMemo(
    () => ({ settings, isLoaded, updateSettings, resetSettings }),
    [settings, isLoaded, updateSettings, resetSettings]
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextType {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within UserSettingsProvider');
  }
  return context;
}
