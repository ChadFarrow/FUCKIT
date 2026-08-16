/**
 * Normalising CSP violation reports into something countable.
 *
 * The policy in `next.config.js` ships as `Content-Security-Policy-Report-Only`
 * and had no `report-uri`, so for its whole life it collected nothing — the
 * instruction it carries ("watch the browser console for violations on every
 * major surface") needed a human to browse eight pages by hand, which is why it
 * never happened. This module is the parsing half of making those reports land
 * somewhere a person will actually look.
 *
 * Everything here is pure so it can be tested without a browser or a database.
 */

/** Reports we keep are folded into `ClientErrorReport` under this category. */
export const CSP_CATEGORY = 'csp';

export interface CspViolation {
  /** The directive that fired, e.g. `worker-src`. Never carries its source list. */
  directive: string;
  /** Origin or keyword of what was blocked — `blob`, `inline`, `eval`, `https://x.com`. */
  blockedUri: string;
  /** Path of the document that violated, no query string. */
  documentPath: string;
}

/**
 * Schemes injected by the user's own browser extensions.
 *
 * These are the single largest source of noise in any real CSP report stream, and
 * none of them can ever be caused by our policy being wrong about our own app —
 * an extension injecting a script into the page violates a policy the extension
 * never agreed to. Counting them would bury the reports that mean something.
 */
const EXTENSION_SCHEMES = [
  'chrome-extension:',
  'moz-extension:',
  'safari-extension:',
  'safari-web-extension:',
  'webkit-masked-url:',
  'chrome:',
  'resource:',
];

/** Keywords a browser reports in place of a URL. Kept verbatim — they are the answer. */
const KEYWORDS = new Set(['inline', 'eval', 'self', 'data', 'blob', 'wasm-eval', 'unsafe-eval']);

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * `violated-directive` historically carried the whole source list ("script-src
 * 'self' 'unsafe-inline'"), while `effective-directive` is just the name. Prefer
 * the latter, and take only the first token of the former, or the same violation
 * produces a different string every time the policy is edited.
 */
function normaliseDirective(effective: unknown, violated: unknown): string {
  const value = str(effective) || str(violated);
  const name = value.trim().split(/\s+/)[0] || '';
  return name.slice(0, 40);
}

/**
 * Collapse a blocked URL to its origin.
 *
 * Row growth in `ClientErrorReport` is bounded by DISTINCT MESSAGES PER DAY, and
 * the message embeds this value — so keeping full URLs would let one misbehaving
 * page mint unbounded rows from an unauthenticated endpoint. An origin answers
 * "what is being blocked" just as well as a path does.
 */
function normaliseBlockedUri(raw: unknown): string {
  const value = str(raw).trim();
  if (!value) return 'unknown';
  if (KEYWORDS.has(value)) return value;

  // `blob:https://site/uuid` and `data:image/png;base64,...` — the scheme is the
  // whole story, and the tail is either a random id or an entire payload.
  const scheme = value.split(':')[0]?.toLowerCase();
  if (scheme === 'blob' || scheme === 'data' || scheme === 'filesystem') return scheme;

  try {
    const origin = new URL(value).origin;
    // Opaque origins (extension schemes, `about:`) stringify to the literal
    // "null", which would erase the scheme and make every one of them collide
    // in a single meaningless bucket. Keep the scheme instead.
    if (!origin || origin === 'null') return scheme ? `${scheme}:` : value.slice(0, 60);
    return origin.slice(0, 100);
  } catch {
    // Not a URL and not a keyword — a bare scheme, or something malformed.
    return value.slice(0, 60);
  }
}

/** Path only: a query string can carry search terms or ids, and adds cardinality. */
function normaliseDocumentPath(raw: unknown): string {
  const value = str(raw).trim();
  if (!value) return 'unknown';
  try {
    return new URL(value).pathname.slice(0, 120) || '/';
  } catch {
    return value.split('?')[0].slice(0, 120);
  }
}

export function isExtensionNoise(blockedUri: string): boolean {
  const value = blockedUri.toLowerCase();
  return EXTENSION_SCHEMES.some((scheme) => value.startsWith(scheme));
}

/**
 * Pull violations out of a report body, whichever shape the browser used.
 *
 * `report-uri` sends `{ "csp-report": {...} }` with hyphenated keys; the newer
 * Reporting API (`report-to`) sends an ARRAY of `{ type, body }` with camelCase
 * keys and a different name for the blocked URL. Both are live in the field, so
 * both are handled rather than picking one and silently dropping the other
 * browser's reports.
 *
 * Returns [] for anything unrecognised — this endpoint is unauthenticated, so a
 * body that isn't a CSP report is expected traffic, not an error.
 */
export function parseCspReport(body: unknown): CspViolation[] {
  const raw: unknown[] = [];

  if (Array.isArray(body)) {
    // Reporting API batch. Other report types (deprecation, intervention) share
    // the envelope, so filter by type rather than assuming.
    for (const item of body) {
      const type = str((item as any)?.type);
      if (type && type !== 'csp-violation') continue;
      const inner = (item as any)?.body;
      if (inner && typeof inner === 'object') raw.push(inner);
    }
  } else if (body && typeof body === 'object') {
    const legacy = (body as any)['csp-report'];
    if (legacy && typeof legacy === 'object') raw.push(legacy);
    else raw.push(body);
  }

  const out: CspViolation[] = [];

  for (const r of raw) {
    const rec = r as Record<string, unknown>;

    const directive = normaliseDirective(
      rec['effectiveDirective'] ?? rec['effective-directive'],
      rec['violatedDirective'] ?? rec['violated-directive']
    );
    if (!directive) continue;

    // Tested against the RAW value, before normalisation. `new URL()` gives an
    // opaque origin for extension schemes, so normalising first would throw the
    // scheme away and let every extension report through as something else.
    const rawBlocked = str(rec['blockedURL'] ?? rec['blocked-uri']).trim();
    if (isExtensionNoise(rawBlocked)) continue;

    const blockedUri = normaliseBlockedUri(rawBlocked);

    out.push({
      directive,
      blockedUri,
      documentPath: normaliseDocumentPath(rec['documentURL'] ?? rec['document-uri']),
    });
  }

  return out;
}

/**
 * The `message` a violation is bucketed under.
 *
 * Deliberately excludes the document path: the same missing directive fires on
 * every page, and keying by path would scatter one policy bug across dozens of
 * rows. The path rides along as `samplePath` instead.
 */
export function violationKey(v: CspViolation): string {
  return `${v.directive} blocked ${v.blockedUri}`;
}
