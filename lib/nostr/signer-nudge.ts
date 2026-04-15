/**
 * Nudge-toast wrapper for long-running Nostr signer operations.
 *
 * NIP-46 sign/getPublicKey calls go over a relay to the user's signer app
 * (Amber, Primal, nsec.app, …). When the user backgrounds the signer or
 * ignores the approval prompt, the call can sit silently for tens of
 * seconds — no on-screen cue that the app is waiting. This helper shows a
 * dismissable toast after a short grace period reminding the user to
 * approve in their signer, and enforces a hard timeout so we never hang
 * indefinitely.
 *
 * Pattern adapted from soapbox-pub/ditto's signerWithNudge.ts.
 */

import { toast } from '@/components/Toast';

const NUDGE_DELAY_MS = 4_000;
// Must sit OUTSIDE the underlying NIP-46 client's 120s relay-request timeout
// (see `sendRelayRequest` in lib/nostr/nip46-client.ts). A shorter wrapper
// timeout pre-empts the client's richer error and breaks legitimate slow
// signers — Primal on iOS PWA in particular routinely takes 30-90s for the
// full publish → wake signer → approve → relay-deliver-response round-trip,
// especially after iOS kills the WebSocket while the user is in the signer
// app. Keep this slightly longer than the client's 120s so the underlying
// timeout (with its troubleshooting tips) fires first; the wrapper is just
// a safety net for cases where the underlying promise never settles.
const HARD_TIMEOUT_MS = 125_000;

/** Throttle: don't show another nudge toast within this window. */
const NUDGE_THROTTLE_MS = 8_000;
let lastNudgeShownAt = 0;

export type SignerOp = 'sign' | 'getPublicKey' | 'encrypt' | 'decrypt' | 'connect';

/**
 * Human-readable labels for event kinds shown in nudge toasts.
 * Keeps the "Waiting on Primal to approve X" message specific enough that
 * users know what they're being asked to sign. Pattern from soapbox-pub/ditto.
 */
const KIND_LABELS: Record<number, string> = {
  0: 'profile update',
  1: 'post',
  3: 'contact list update',
  5: 'deletion',
  6: 'repost',
  7: 'reaction',
  1111: 'comment',
  1984: 'report',
  9734: 'zap request',
  10000: 'mute list update',
  10001: 'pinned notes update',
  10002: 'relay list update',
  10003: 'bookmarks update',
  10015: 'interests update',
  22242: 'login',
  30000: 'user list update',
  30001: 'favorites update',
  30078: 'app settings',
  34139: 'favorites update',
};

interface NudgeOptions {
  /** Short label for the signer (e.g., 'Primal', 'Amber', 'nsec.app'). */
  signerLabel?: string;
  /** The operation being awaited — used to compose the toast message. */
  op?: SignerOp;
  /** Event kind (for `op: 'sign'`) — produces a more specific toast label. */
  kind?: number;
  /**
   * Optional callback checked at nudge-fire time. If it returns false we
   * swap the "Waiting…" message for a "relay unreachable" message so the
   * user knows the signer never got the request (iOS Safari kills WebSockets
   * when backgrounded; Primal/Amber never see the signing request and the
   * generic nudge is misleading).
   */
  isBunkerConnected?: () => boolean;
}

function messageFor(
  op: SignerOp | undefined,
  signerLabel: string,
  kind: number | undefined,
): string {
  const label = signerLabel || 'your signer';
  const subject = kind !== undefined ? KIND_LABELS[kind] : undefined;
  switch (op) {
    case 'sign':
      if (subject) return `Waiting on ${label} to approve ${subject}…`;
      return `Waiting on ${label} to approve signing…`;
    case 'encrypt':
    case 'decrypt':
      return `Waiting on ${label} to finish encryption…`;
    case 'connect':
      return `Waiting for ${label} to connect…`;
    case 'getPublicKey':
      return `Waiting on ${label} to share your pubkey…`;
    default:
      return `Waiting on ${label} — check the app to approve.`;
  }
}

function unreachableMessageFor(signerLabel: string): string {
  const label = signerLabel || 'your signer';
  return `${label} relay unreachable — check your connection and try again.`;
}

/**
 * Run a signer operation with a nudge toast after NUDGE_DELAY_MS and a
 * hard timeout at HARD_TIMEOUT_MS. Returns the op's result, or rejects
 * with an error if the timeout fires.
 */
export async function withSignerNudge<T>(
  op: () => Promise<T>,
  options: NudgeOptions = {},
): Promise<T> {
  let toastId: string | null = null;
  let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  let hardTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (nudgeTimer) clearTimeout(nudgeTimer);
    if (hardTimer) clearTimeout(hardTimer);
    if (toastId) {
      toast.dismiss(toastId);
      toastId = null;
    }
  };

  const scheduleNudge = () => {
    nudgeTimer = setTimeout(() => {
      const now = Date.now();
      if (now - lastNudgeShownAt < NUDGE_THROTTLE_MS) return;
      lastNudgeShownAt = now;
      const relayOk = options.isBunkerConnected ? options.isBunkerConnected() : true;
      const label = options.signerLabel || '';
      const message = relayOk
        ? messageFor(options.op, label, options.kind)
        : unreachableMessageFor(label);
      // Use warning (orange) when the relay looks dead — it's an actionable problem,
      // not just a slow signer.
      const show = relayOk ? toast.info : toast.warning;
      toastId = show(message, {
        // Long duration: the toast sticks until cleanup() or the user dismisses it
        duration: HARD_TIMEOUT_MS,
      });
    }, NUDGE_DELAY_MS);
  };

  const timeoutPromise = new Promise<T>((_, reject) => {
    hardTimer = setTimeout(() => {
      reject(new Error('Signer request timed out. Please try again.'));
    }, HARD_TIMEOUT_MS);
  });

  scheduleNudge();

  try {
    const result = await Promise.race([op(), timeoutPromise]);
    return result;
  } finally {
    cleanup();
  }
}
