import { LNURLService } from './lnurl';
import type { ValueRecipient } from './value-parser';

/**
 * Fountain routing.
 *
 * Fountain asked that we pay their users over LNURL-pay rather than keysend. The obstacle is that
 * a Fountain recipient almost never *looks* like a Lightning Address in a feed — it is published
 * as a node recipient pointing at Fountain's shared node, with the account identified by a custom
 * TLV record and the Lightning Address, if present at all, sitting in the human-readable `name`:
 *
 *   { name: "middleseasonmusic@fountain.fm", type: "node",
 *     address: "03b6f613…54b79", split: 10,
 *     customKey: "906608", customValue: "01h4XlHtbf6uDlRYEcHnlR" }
 *
 * So the old `recipient.address.endsWith('@fountain.fm')` test never matched a single real
 * recipient in the catalog: `address` is a hex pubkey. Detection has to key off the node pubkey
 * and the routing custom key instead.
 */

/**
 * Fountain's shared node pubkeys. Payments to these are Fountain payments no matter what the
 * recipient calls itself.
 */
export const FOUNTAIN_NODE_PUBKEYS = new Set([
  '03b6f613e88bd874177c28c6ad83b3baba43c4c656f56be1f8df84669556054b79',
  '0332d57355d673e217238ce3e4be8491aa6b2a13f95494133ee243e57df1653ace',
]);

/**
 * Custom (TLV) keys Fountain uses to say which account a keysend belongs to.
 *
 * In the catalog these are 1:1 with the pubkeys above — every recipient carrying 906608 is on
 * 03b6f613…, and that pubkey never appears with any other key. Both signals are kept anyway,
 * because several adapters between the feed and the payment layer drop `customKey` while
 * `address` survives everywhere, and vice versa when a feed omits the pubkey.
 */
export const FOUNTAIN_CUSTOM_KEYS = new Set(['906608', '112111100']);

/** The domain Fountain actually serves Lightning Addresses on. */
export const FOUNTAIN_CANONICAL_DOMAIN = 'fountain.fm';

/**
 * Misspellings of the canonical domain that appear in real feeds.
 *
 * `fountain.me` is a typo, not a second Fountain domain: the catalog has the same artist, same
 * `customValue` (`Ek7o8H3hZJor1uWXd3hb`) and same node, published under both spellings. Left
 * as-is it would be handed to LNURL resolution against a domain that does not serve these
 * accounts, so the recipient would go unpaid where keysend used to work — the typo has to be
 * corrected, not merely recognised.
 */
export const FOUNTAIN_TYPO_DOMAINS = ['fountain.me'];

/** Every domain that identifies a Fountain account, canonical or misspelled. */
export const FOUNTAIN_DOMAINS = [FOUNTAIN_CANONICAL_DOMAIN, ...FOUNTAIN_TYPO_DOMAINS];

function fountainDomainOf(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase();
  return FOUNTAIN_DOMAINS.find(domain => lower.endsWith(`@${domain}`));
}

function isFountainAddress(value: string | undefined | null): boolean {
  return fountainDomainOf(value) !== undefined;
}

/** Rewrite a misspelled Fountain domain to the one that actually resolves. */
function canonicalizeFountainAddress(address: string): string {
  const trimmed = address.trim();
  const domain = fountainDomainOf(trimmed);
  if (!domain || domain === FOUNTAIN_CANONICAL_DOMAIN) return trimmed;
  return `${trimmed.slice(0, trimmed.length - domain.length)}${FOUNTAIN_CANONICAL_DOMAIN}`;
}

type FountainRecipient = Pick<ValueRecipient, 'name' | 'type' | 'address'> &
  Partial<Pick<ValueRecipient, 'customKey' | 'customValue'>>;

/**
 * Whether this recipient is a Fountain account, by any of the three signals a feed might carry.
 */
export function isFountainRecipient(recipient: FountainRecipient | null | undefined): boolean {
  if (!recipient) return false;

  const address = (recipient.address || '').trim().toLowerCase();

  if (isFountainAddress(address)) return true;
  if (address && FOUNTAIN_NODE_PUBKEYS.has(address)) return true;
  if (recipient.customKey != null && FOUNTAIN_CUSTOM_KEYS.has(String(recipient.customKey).trim())) {
    return true;
  }

  return false;
}

/**
 * The Lightning Address to pay this Fountain recipient over LNURL, if the feed gives us one.
 *
 * Roughly half the Fountain recipients in the catalog identify the artist only by an opaque
 * account id in `customValue` and a plain display name ("Elijah Lied"). There is nothing to build
 * a `.well-known/lnurlp/` URL out of for those, so this returns undefined and the caller keysends
 * instead — an artist being paid the old way beats an artist not being paid.
 *
 * Only addresses on a Fountain domain are returned. A Fountain node entry naming some other
 * wallet ("artist@getalby.com") is not an invitation to pay that wallet instead: the feed asked
 * for a keysend to Fountain crediting a specific account, and redirecting it elsewhere would pay
 * the wrong destination.
 */
export function deriveFountainLightningAddress(
  recipient: FountainRecipient | null | undefined
): string | undefined {
  if (!recipient) return undefined;

  // Already published as a Lightning Address — use it as-is.
  const address = (recipient.address || '').trim();
  if (
    recipient.type === 'lnaddress' &&
    LNURLService.isLightningAddress(address) &&
    isFountainAddress(address)
  ) {
    return canonicalizeFountainAddress(address);
  }

  // The common case: a node recipient whose `name` is the artist's Lightning Address.
  const name = (recipient.name || '').trim();
  if (LNURLService.isLightningAddress(name) && isFountainAddress(name)) {
    return canonicalizeFountainAddress(name);
  }

  return undefined;
}
