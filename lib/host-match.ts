/**
 * Dot-boundary hostname matching, shared by the two allowlists that need it.
 *
 * Kept separate from both so a client bundle (lib/native-app-identity.ts) does
 * not have to import a module that reaches for Prisma.
 */

/**
 * True when `hostname` is, or is a subdomain of, one of `allowed`.
 *
 * Matches on a DOT boundary, never String.includes. A bare `includes` would
 * accept `wavlake.com.attacker.net` for `wavlake.com`, which is the classic way
 * an allowlist becomes decorative.
 */
export function hostMatches(hostname: string, allowed: Iterable<string>): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  for (const raw of allowed) {
    const entry = raw.toLowerCase().replace(/^\.+/, '').replace(/\.$/, '');
    if (!entry) continue;
    if (host === entry || host.endsWith(`.${entry}`)) return true;
  }
  return false;
}
