'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useNostr } from '@/contexts/NostrContext';
import { useBitcoinConnect } from '@/components/Lightning/BitcoinConnectProvider';
import { useAudio } from '@/contexts/AudioContext';
import Link from 'next/link';
import { Menu, Zap, Settings, LogOut, User, Wallet, Info, Download, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/Toast';
import { WalletInfoDisplay } from '@/components/Lightning/WalletInfoDisplay';

// Lazy load LoginModal
const LoginModal = dynamic(() => import('./Nostr/LoginModal'), {
  loading: () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6">
        <div className="text-gray-700">Loading...</div>
      </div>
    </div>
  ),
  ssr: false
});

interface UserMenuProps {
  className?: string;
}

export default function UserMenu({ className = '' }: UserMenuProps) {
  const { user, isAuthenticated, logout } = useNostr();
  const { isConnected, connect, disconnect, isLoading, openBackupOffer } = useBitcoinConnect();

  // Nostr backup status for the connected NWC wallet. 'hidden' means the row
  // isn't applicable at all: no NWC string to save (an extension connection has
  // none), not signed in, or a signer that can't encrypt (NIP-55 / read-only
  // nip05 / an extension without window.nostr.nip44).
  const [backupStatus, setBackupStatus] = useState<
    'hidden' | 'checking' | 'saved' | 'none' | 'unknown' | 'saving' | 'removing'
  >('hidden');
  const { setFullscreenMode } = useAudio();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // A broken avatar URL must fall back to the placeholder, not vanish — see the
  // trigger below for why disappearing is worse than showing no picture.
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Determine icon color based on connection status
  const getIconColor = () => {
    if (isConnected) return 'text-green-400'; // Wallet connected (green for good)
    return 'text-yellow-400'; // Wallet not connected (yellow to draw attention)
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      console.log('Disconnecting wallet...');

      // Close dropdown first to force a clean state
      setShowDropdown(false);

      // Then disconnect
      await disconnect();
      console.log('Wallet disconnected successfully');

      // Force a small delay to ensure state propagates
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      alert('Failed to disconnect wallet. Please try again.');
    }
  };

  const handleSwitchWallet = async () => {
    try {
      // Close dropdown first
      setShowDropdown(false);

      // Disconnect current wallet
      await disconnect();
      console.log('Disconnected, now showing wallet selection...');

      // Small delay to ensure disconnect completes
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now show wallet selection modal
      await connect();
    } catch (error) {
      console.error('Failed to switch wallet:', error);
      alert('Failed to switch wallet. Please try again.');
    }
  };

  /**
   * Resolve backup status when the menu opens.
   *
   * Deliberately triggered by opening the menu rather than on page load: the
   * check hits relays, and an already-connected, already-signed-in user would
   * otherwise pay for it on every single load. Opening the menu is a user
   * action, and the result is cached per pubkey for the rest of the session.
   */
  const refreshBackupStatus = useCallback(async (force = false) => {
    try {
      const pubkey = user?.nostrPubkey;
      if (!isConnected || !isAuthenticated || !pubkey) {
        setBackupStatus('hidden');
        return;
      }
      const { getConnectedNwcUri, signerSupportsNip44, getCachedBackupExists, checkBackupExists } =
        await import('@/lib/nostr/nwc-backup');

      // An extension connection has no connection string, so there is nothing
      // this row could back up.
      if (!getConnectedNwcUri() || !(await signerSupportsNip44())) {
        setBackupStatus('hidden');
        return;
      }

      const cached = force ? undefined : getCachedBackupExists(pubkey);
      if (cached !== undefined) {
        setBackupStatus(cached ? 'saved' : 'none');
        return;
      }
      setBackupStatus('checking');
      const status = await checkBackupExists(pubkey, { force });
      // 'unknown' means the relays could not be reached. Showing "Not saved"
      // there is a lie that gets users to re-save a backup they already have.
      setBackupStatus(status === 'saved' ? 'saved' : status === 'none' ? 'none' : 'unknown');
    } catch {
      setBackupStatus('hidden');
    }
  }, [isConnected, isAuthenticated, user?.nostrPubkey]);

  useEffect(() => {
    if (!showDropdown) return;
    refreshBackupStatus();
  }, [showDropdown, refreshBackupStatus]);

  const handleBackupAction = async () => {
    if (backupStatus === 'unknown') {
      // Couldn't reach relays last time — retry the check rather than acting
      // on an answer we don't have.
      void refreshBackupStatus(true);
      return;
    }
    if (backupStatus === 'none') {
      // Reuse the same offer screen the connect flow and post-login prompt use,
      // so the explanation and the consent are worded identically everywhere.
      setShowDropdown(false);
      openBackupOffer();
      return;
    }
    if (backupStatus !== 'saved') return;

    const pubkey = user?.nostrPubkey;
    if (!pubkey) return;
    setBackupStatus('removing');
    try {
      const { deleteNwcBackup } = await import('@/lib/nostr/nwc-backup');
      await deleteNwcBackup(pubkey);
      setBackupStatus('none');
      // "where reachable" is not hedging for its own sake: the tombstone only
      // reaches the relays we publish to now, which need not be every relay the
      // original landed on.
      toast.success('Backup removed from Nostr (where reachable)');
    } catch (error) {
      console.error('Failed to remove NWC backup:', error);
      setBackupStatus('saved');
      toast.error('Could not remove the backup. Try again.');
    }
  };

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const handleSignIn = () => {
    setShowDropdown(false);
    setShowLoginModal(true);
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2">
          {/* Signed-in indicator: the profile picture only. The display name used to
              sit beside it, but this cluster is fixed over page content and the name
              made it wide enough to cover album card titles.

              The avatar slot ALWAYS renders when authenticated — never gate the whole
              thing on `user.avatar`. The hamburger next to it is drawn whether or not
              you're signed in, and its colour encodes *wallet* state, not auth. So a
              user with no profile picture (or a broken avatar URL) would look exactly
              logged out, which is the one thing this cluster exists to convey. The
              placeholder mirrors the dropdown's. */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-2">
              {user.avatar && !avatarFailed ? (
                <img
                  src={user.avatar}
                  alt={user.displayName || 'User'}
                  title={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div
                  className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0"
                  title={user.displayName || 'User'}
                >
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          )}

          {/* Menu Trigger Button */}
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`p-2 rounded-lg transition-colors ${getIconColor()} hover:bg-gray-700/50`}
            title="User Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Dropdown Menu Portal */}
        {showDropdown && typeof window !== 'undefined' && createPortal(
          <>
            {/* Backdrop - invisible click catcher to close menu */}
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setShowDropdown(false)}
            />

            {/* Dropdown Menu */}
            <div
              className="w-72 sm:w-72 max-w-[calc(100vw-2rem)] bg-gray-900 border-2 border-gray-700 rounded-lg shadow-lg z-[61]"
              style={{
                position: 'fixed',
                top: '80px',
                right: '1rem',
                isolation: 'isolate'
              }}
            >
              <div className="p-4">
                {/* Profile Section - Show if authenticated */}
                {isAuthenticated && user && (
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.displayName || 'User'}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {user.displayName || 'User'}
                      </h3>
                      <p className="text-sm text-gray-400">Nostr Connected</p>
                    </div>
                  </div>
                )}

                {/* Wallet Section */}
                <div className="mb-4 pb-4 border-b border-gray-700">
                  {isConnected ? (
                    <div className="space-y-3">
                      {/* Enhanced Wallet Info Display */}
                      <WalletInfoDisplay variant="full" showAddress={false} showExternalLink={false} />

                      {/* Wallet Actions */}
                      <div className="space-y-2 pt-3 border-t border-gray-700/50">
                        <button
                          onClick={handleSwitchWallet}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <Wallet className="w-4 h-4" />
                          Switch Wallet
                        </button>
                        {/* The Nostr backup, showing its own status. This is the
                            only entry point for someone already signed in with a
                            wallet already connected — the offer otherwise fires
                            only on a fresh NWC paste or a fresh login, so without
                            this row existing users would never come across the
                            feature.

                            Sits above Disconnect so the destructive action stays
                            last in the group. */}
                        {backupStatus !== 'hidden' && (
                          <button
                            onClick={handleBackupAction}
                            disabled={backupStatus === 'checking' || backupStatus === 'removing'}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-default"
                          >
                            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 min-w-0">NWC Backup</span>
                            <span
                              className={`text-xs flex-shrink-0 ${
                                backupStatus === 'saved' ? 'text-green-400' : 'text-gray-500'
                              }`}
                            >
                              {backupStatus === 'checking' && 'Checking…'}
                              {backupStatus === 'removing' && 'Removing…'}
                              {backupStatus === 'saved' && 'Saved'}
                              {backupStatus === 'none' && 'Not saved'}
                              {backupStatus === 'unknown' && 'Unavailable'}
                            </span>
                          </button>
                        )}

                        <button
                          onClick={handleDisconnect}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Disconnect Wallet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        setShowDropdown(false);
                        await handleConnect();
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      Connect Lightning Wallet
                    </button>
                  )}
                </div>

                {/* Settings & Authentication */}
                <div className="space-y-2">
                  <Link
                    href="/downloads"
                    onClick={() => { setShowDropdown(false); setFullscreenMode(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Downloads
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => { setShowDropdown(false); setFullscreenMode(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>

                  <Link
                    href="/about"
                    onClick={() => { setShowDropdown(false); setFullscreenMode(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    About & Support
                  </Link>

                  {isAuthenticated ? (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Sign in with Nostr
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}
