/**
 * V4V (Value4Value) Utility Functions
 *
 * Provides consistent helpers for working with v4v payment data across the codebase.
 *
 * Background:
 * - v4vRecipient: Simple string containing primary recipient's Lightning address or node pubkey
 * - v4vValue: Complex JSON with full payment spec including multiple recipients and splits
 *
 * These two fields are always populated together during RSS feed parsing, but serve
 * different purposes - v4vRecipient for quick keysend, v4vValue for split payments.
 */

export interface V4VRecipient {
  name?: string;
  address: string;
  type?: 'node' | 'lnaddress';
  split?: number;
  fee?: boolean | string | null;
  /**
   * Routing TLV the receiving node uses to identify the account (Fountain's 906608, Alby's
   * routing key, …). These must survive every hop from the feed to the payment layer — a keysend
   * that loses them lands on a shared node with no artist attached to it.
   */
  customKey?: string;
  customValue?: string;
}

export interface V4VValue {
  type?: string;
  method?: string;
  recipients?: V4VRecipient[];
  destinations?: V4VRecipient[];
  recipient?: string;
  lightningAddress?: string;
  suggestedAmount?: number;
  customKey?: string;
  customValue?: string;
}

export interface V4VItem {
  v4vRecipient?: string | null;
  v4vValue?: V4VValue | any | null;
}

/**
 * Check if an item has any V4V payment configuration
 */
export function hasV4V(item: V4VItem | null | undefined): boolean {
  if (!item) return false;

  // Check for simple recipient
  if (item.v4vRecipient) return true;

  // Check for value splits
  if (item.v4vValue) {
    const v4v = item.v4vValue;
    // Has recipients array with non-fee entries
    if (v4v.recipients?.some((r: V4VRecipient) => !r.fee)) return true;
    // Has destinations array with non-fee entries
    if (v4v.destinations?.some((r: V4VRecipient) => !r.fee)) return true;
    // Has simple recipient string
    if (v4v.recipient) return true;
    // Has lightning address
    if (v4v.lightningAddress) return true;
  }

  return false;
}

/**
 * Get the primary recipient address from v4v data
 * Prefers v4vValue recipients over v4vRecipient for consistency
 */
export function getPrimaryRecipient(item: V4VItem | null | undefined): string | undefined {
  if (!item) return undefined;

  // First try v4vValue for structured data
  if (item.v4vValue) {
    const v4v = item.v4vValue;

    // Get first non-fee recipient from recipients array
    const recipients = v4v.recipients || v4v.destinations || [];
    const primaryRecipient = recipients.find((r: V4VRecipient) => !r.fee);
    if (primaryRecipient?.address) return primaryRecipient.address;

    // Try simple recipient string
    if (v4v.recipient) return v4v.recipient;

    // Try lightning address
    if (v4v.lightningAddress) return v4v.lightningAddress;
  }

  // Fall back to simple v4vRecipient
  return item.v4vRecipient || undefined;
}

/**
 * Get all non-fee recipients from v4v data for split payments
 */
export function getV4VRecipients(item: V4VItem | null | undefined): V4VRecipient[] {
  if (!item?.v4vValue) return [];

  const v4v = item.v4vValue;
  const recipients = v4v.recipients || v4v.destinations || [];

  return recipients
    .filter((r: V4VRecipient) => r.fee !== true && r.fee !== 'true')
    .map((r: V4VRecipient) => ({
      name: r.name || 'Unknown',
      address: r.address || '',
      type: r.type || 'node',
      split: typeof r.split === 'number' ? r.split : parseInt(r.split as any) || 100,
      customKey: r.customKey,
      customValue: r.customValue
    }));
}

/**
 * Get the primary recipient as a full object rather than just its address.
 *
 * getPrimaryRecipient returns a bare string, which loses `type`, `customKey` and `customValue` —
 * everything the payment layer needs to decide between LNURL and keysend and to route a keysend
 * to the right account. Single-recipient payment paths need this one.
 */
export function getPrimaryRecipientObject(item: V4VItem | null | undefined): V4VRecipient | undefined {
  if (!item?.v4vValue) return undefined;

  const v4v = item.v4vValue;
  const recipients = v4v.recipients || v4v.destinations || [];
  const primary = recipients.find((r: V4VRecipient) => !r.fee && r.address);
  if (!primary) return undefined;

  return {
    name: primary.name,
    address: primary.address,
    type: primary.type || 'node',
    split: typeof primary.split === 'number' ? primary.split : parseInt(primary.split as any) || 100,
    customKey: primary.customKey,
    customValue: primary.customValue
  };
}

/**
 * Check if v4v data has multiple recipients (requires split payments)
 */
export function hasMultipleRecipients(item: V4VItem | null | undefined): boolean {
  return getV4VRecipients(item).length > 1;
}

/**
 * Format value splits for BoostButton component
 */
export function formatValueSplitsForBoost(item: V4VItem | null | undefined, fallbackArtistName?: string): Array<{
  name: string;
  address: string;
  split: number;
  type: 'node' | 'lnaddress';
  customKey?: string;
  customValue?: string;
}> | undefined {
  const recipients = getV4VRecipients(item);

  if (recipients.length === 0) return undefined;

  return recipients.map(r => ({
    name: r.name || fallbackArtistName || 'Unknown',
    address: r.address,
    split: r.split || 100,
    type: (r.type === 'lnaddress' ? 'lnaddress' : 'node') as 'node' | 'lnaddress',
    customKey: r.customKey,
    customValue: r.customValue
  }));
}
