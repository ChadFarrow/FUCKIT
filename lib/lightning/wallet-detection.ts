/**
 * Wallet detection utilities for Bitcoin Connect integration
 * Detects wallet provider type and infers Lightning Address for Coinos users
 */

export type WalletProviderType = 'coinos' | 'alby' | 'alby-hub' | 'nwc' | 'extension' | 'unknown';

export interface WalletInfo {
  alias: string;
  pubkey: string;
  lightningAddress?: string;
  providerType: WalletProviderType;
  providerName: string;
  supportsBalance: boolean;
  supportsKeysend: boolean;
  // Coinos-specific fields
  avatarUrl?: string;
  username?: string;
}

/**
 * Detect wallet provider type from Bitcoin Connect connector config
 */
export async function detectWalletProviderType(): Promise<{
  type: WalletProviderType;
  name: string;
  nwcPubkey?: string;
}> {
  try {
    const { getConnectorConfig } = await import('@getalby/bitcoin-connect');
    const config = getConnectorConfig();

    if (!config) {
      // No Bitcoin Connect config — check for a WebLN browser extension (e.g. Alby)
      if (typeof window !== 'undefined' && (window as any).webln) {
        return { type: 'extension', name: 'WebLN Extension' };
      }
      return { type: 'unknown', name: 'Unknown Wallet' };
    }

    const connectorType = config.connectorType?.toLowerCase() || '';
    const connectorName = config.connectorName || 'Unknown Wallet';

    // Try to extract NWC pubkey + relay from connection string
    // NWC URL format: nostr+walletconnect://<pubkey>?relay=<url>&secret=...
    let nwcPubkey: string | undefined;
    let nwcRelay: string | undefined;
    const nwcUrl: string | undefined = (config as any).nwcUrl;
    if (nwcUrl) {
      const pubkeyMatch = nwcUrl.match(/nostr\+walletconnect:\/\/([a-f0-9]+)/i);
      if (pubkeyMatch) {
        nwcPubkey = pubkeyMatch[1];
      }
      const relayMatch = nwcUrl.match(/[?&]relay=([^&]+)/i);
      if (relayMatch) {
        try {
          nwcRelay = decodeURIComponent(relayMatch[1]).toLowerCase();
        } catch {
          nwcRelay = relayMatch[1].toLowerCase();
        }
      }
    }

    // Detect specific providers
    if (connectorType.includes('coinos')) {
      return { type: 'coinos', name: 'Coinos', nwcPubkey };
    }
    if (connectorType.includes('albyhub')) {
      return { type: 'alby-hub', name: 'Alby Hub', nwcPubkey };
    }
    if (connectorType.includes('alby')) {
      return { type: 'alby', name: 'Alby', nwcPubkey };
    }
    if (connectorType.startsWith('nwc')) {
      // Bitcoin Connect's "Generic NWC" paste form always returns connectorType
      // 'nwc.generic' regardless of which wallet's NWC URL was pasted. Inspect the
      // NWC relay param to disambiguate Alby Hub / Coinos pastes from truly generic
      // wallets (Primal, etc.) — without this, pasted Alby Hub NWC strings get
      // treated as plain 'nwc' and the keysend whitelist rejects them, so autoboost
      // skips keysend even though Alby Hub fully supports it.
      console.log('🔌 NWC connector detected:', { connectorType, connectorName, nwcRelay });
      if (nwcRelay) {
        if (nwcRelay.includes('getalby.com')) {
          return { type: 'alby-hub', name: 'Alby Hub', nwcPubkey };
        }
        if (nwcRelay.includes('coinos.io')) {
          return { type: 'coinos', name: 'Coinos', nwcPubkey };
        }
      }
      return { type: 'nwc', name: connectorName, nwcPubkey };
    }
    if (connectorType.includes('extension')) {
      return { type: 'extension', name: connectorName };
    }

    return { type: 'unknown', name: connectorName };
  } catch (error) {
    console.warn('Failed to detect wallet provider:', error);
    return { type: 'unknown', name: 'Unknown Wallet' };
  }
}

/**
 * Look up Coinos user by pubkey (hex or npub)
 */
export async function fetchCoinosUserByPubkey(pubkey: string): Promise<{
  avatarUrl?: string;
  username?: string;
  npub?: string;
} | null> {
  try {
    const response = await fetch(`https://coinos.io/api/users/${encodeURIComponent(pubkey)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      avatarUrl: data.picture || undefined,
      username: data.username || undefined,
      npub: data.npub || undefined,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Infer Lightning Address from node alias based on provider type
 * For Coinos: if alias is a valid username, construct user@coinos.io
 */
export function inferLightningAddress(
  alias: string | undefined,
  providerType: WalletProviderType
): string | undefined {
  if (!alias) return undefined;

  // For Coinos, the alias is typically the username
  if (providerType === 'coinos') {
    // Validate: should be alphanumeric, underscore, or hyphen (valid username)
    const cleanAlias = alias.trim().toLowerCase();
    if (/^[a-z0-9_-]+$/i.test(cleanAlias) && cleanAlias.length > 0 && cleanAlias.length <= 30) {
      return `${cleanAlias}@coinos.io`;
    }
  }

  // For Alby, try to construct from alias if it looks like a username
  if (providerType === 'alby' || providerType === 'alby-hub') {
    const cleanAlias = alias.trim().toLowerCase();
    if (/^[a-z0-9_-]+$/i.test(cleanAlias) && cleanAlias.length > 0 && cleanAlias.length <= 30) {
      return `${cleanAlias}@getalby.com`;
    }
  }

  return undefined;
}

/**
 * Format balance in sats for display
 */
export function formatBalance(sats: number | null | undefined): string {
  if (sats === null || sats === undefined) return '---';

  if (sats >= 100_000_000) {
    // 1+ BTC
    return `${(sats / 100_000_000).toFixed(2)} BTC`;
  } else if (sats >= 1_000_000) {
    // 1M+ sats
    return `${(sats / 1_000_000).toFixed(2)}M sats`;
  } else if (sats >= 10_000) {
    // 10k+ sats
    return `${(sats / 1_000).toFixed(1)}k sats`;
  }

  return `${sats.toLocaleString()} sats`;
}

/**
 * Get the wallet provider's external URL for opening in browser
 */
export function getWalletExternalUrl(providerType: WalletProviderType): string | undefined {
  switch (providerType) {
    case 'coinos':
      return 'https://coinos.io';
    case 'alby':
    case 'alby-hub':
      return 'https://getalby.com';
    default:
      return undefined;
  }
}

/**
 * Fetch Coinos user profile by username
 * Returns avatar URL and other profile info
 */
export async function fetchCoinosProfile(username: string): Promise<{
  avatarUrl?: string;
  username?: string;
  npub?: string;
} | null> {
  try {
    const response = await fetch(`https://coinos.io/api/users/${encodeURIComponent(username)}`);
    if (!response.ok) {
      console.warn(`Failed to fetch Coinos profile for ${username}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return {
      avatarUrl: data.picture || undefined,
      username: data.username || username,
      npub: data.npub || undefined,
    };
  } catch (error) {
    console.warn('Failed to fetch Coinos profile:', error);
    return null;
  }
}

/**
 * Get provider-specific colors for UI styling
 */
export function getProviderColors(providerType: WalletProviderType): {
  primary: string;
  bg: string;
  hover: string;
} {
  switch (providerType) {
    case 'coinos':
      return {
        primary: 'text-orange-400',
        bg: 'bg-orange-600',
        hover: 'hover:bg-orange-700',
      };
    case 'alby':
    case 'alby-hub':
      return {
        primary: 'text-yellow-400',
        bg: 'bg-yellow-500',
        hover: 'hover:bg-yellow-600',
      };
    default:
      return {
        primary: 'text-green-400',
        bg: 'bg-green-600',
        hover: 'hover:bg-green-700',
      };
  }
}
