import { hostMatches } from './host-match';

/**
 * Which native Android shell is loading this site.
 *
 * `capacitor.config.ts` sets `server.url: 'https://stablekraft.app'` and there is
 * no `output: 'export'`, so the APK bundles no web app — it is a WebView pointed
 * at production. Anyone can fork the repo, change `appId`, and ship an APK whose
 * every request (HTML, JS, artwork, audio streams, DB queries) is served by our
 * Railway instance. `app.unstablekraft` on zapstore is exactly that.
 *
 * Nothing on the SERVER can separate such a shell from ours: it loads our origin,
 * so its Origin, Referer and cookie domain are ours, and CORS does not apply to a
 * native WebView at all. Every server-side heuristic considered was worse than the
 * problem — blocking the `; wv)` user-agent token also blocks a stablekraft.app
 * link opened inside Damus, Amethyst or Primal, and a shared secret baked into an
 * APK is extractable from that APK.
 *
 * The Android applicationId is the one honest discriminator. Ours is
 * `app.stablekraft` (android/app/build.gradle). A fork CANNOT keep it — Android
 * refuses to install two packages with the same id and different signing certs —
 * and @capacitor/app reports it to the page. So the check costs no APK release
 * (existing installs of every vintage already answer `app.stablekraft`), touches
 * no browser, and runs inside JavaScript we serve, which a fork cannot patch.
 *
 * KNOWN LIMIT, and it is not fixable here: this is a client-side gate. A fork can
 * inject script from native code (WebView.evaluateJavascript at page start) to
 * fake the plugin response. That is a deliberate act; short of Play Integrity
 * attestation nothing prevents it. The per-IP limits in lib/rate-limit-guard.ts
 * are the backstop for that case.
 *
 * EVERY uncertain branch FAILS OPEN. An older APK that predates @capacitor/app
 * cannot answer, and bricking it would cost real users far more than the fork
 * costs in bandwidth. Only a positively-identified foreign id is ever blocked.
 */

/**
 * Deployments this gate defends. It runs ONLY when the page is served by one of
 * these hosts.
 *
 * Without this the gate would fire on ANY deployment of this code, so a fork that
 * self-hosts — the outcome this whole feature exists to encourage — would find
 * its own app blocked by its own server until it discovered an environment
 * variable. That is backwards: it puts friction exactly where we want none. The
 * point is to protect THIS backend, not to police package ids in general.
 *
 * The Railway hostname is listed as well as the domain. Leaving it out would let
 * a shell skip the gate entirely by pointing at *.up.railway.app directly, which
 * answers the same app from the same instance.
 */
export const DEFAULT_CANONICAL_HOSTS = [
  'stablekraft.app',
  'stablekraft-production.up.railway.app',
] as const;

/** Extra canonical hosts from NEXT_PUBLIC_CANONICAL_HOSTS, comma-separated. */
export function parseCanonicalHosts(raw: string | undefined): string[] {
  const extra = (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_CANONICAL_HOSTS, ...extra]));
}

/**
 * Whether the page is being served by a deployment this gate defends.
 *
 * Subdomains count, so radio.stablekraft.app is covered. Anything else — a
 * fork's own domain, a preview, localhost — makes the gate inert.
 */
export function isCanonicalDeployment(hostname: string, canonicalHosts: readonly string[]): boolean {
  return hostMatches(hostname, canonicalHosts);
}

/** The hostname currently serving the page, or null off the browser. */
export function currentHostname(): string | null {
  try {
    return typeof window !== 'undefined' ? window.location?.hostname?.toLowerCase() || null : null;
  } catch {
    return null;
  }
}

/** Package ids allowed to load this site inside a native Android shell. */
export const DEFAULT_ALLOWED_APP_IDS = ['app.stablekraft'] as const;

export type ForeignShellGateMode = 'block' | 'log' | 'off';

export type ShellDecision =
  /** Render the app. */
  | 'allow'
  /** Foreign, but the gate is in log mode: report it and render the app anyway. */
  | 'report'
  /** Foreign: report it and render nothing at all. */
  | 'block';

/**
 * Extra allowed ids from NEXT_PUBLIC_ALLOWED_APP_IDS, so a second legitimate
 * build can be added without a code change. Comma-separated; blanks dropped.
 *
 * NEXT_PUBLIC_* bakes in at BUILD time, so this must be set in Railway before
 * the deploy that should use it — setting it afterwards changes nothing.
 */
export function parseAllowedAppIds(raw: string | undefined): string[] {
  const extra = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_APP_IDS, ...extra]));
}

/** NEXT_PUBLIC_FOREIGN_SHELL_GATE, defaulting to `block`. Anything unrecognised is `block`. */
export function parseGateMode(raw: string | undefined): ForeignShellGateMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'off') return 'off';
  if (value === 'log') return 'log';
  return 'block';
}

/**
 * The whole decision, as a pure function so every fail-open branch is testable
 * without a DOM. `appId: null` means "could not ask" — not native, no plugin,
 * a rejected call, or a call that never settled. All of those allow.
 */
export function decideShellAccess(input: {
  isNativeAndroid: boolean;
  appId: string | null;
  allowedAppIds: readonly string[];
  mode: ForeignShellGateMode;
}): ShellDecision {
  if (input.mode === 'off') return 'allow';
  if (!input.isNativeAndroid) return 'allow';
  if (!input.appId) return 'allow';
  if (input.allowedAppIds.includes(input.appId)) return 'allow';
  return input.mode === 'log' ? 'report' : 'block';
}

/** True only inside the native Capacitor Android app (not iOS/PWA/SSR). */
export function isNativeAndroid(): boolean {
  try {
    const cap = (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
    return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

/** How long to wait for the bridge before treating the shell as unidentifiable. */
export const APP_ID_TIMEOUT_MS = 2000;

/**
 * The shell's Android applicationId, or null if it cannot be established.
 *
 * Reads the bridge off `window.Capacitor.Plugins.App` rather than importing
 * @capacitor/app, matching playbackKeepAlive/nativeMedia in AudioContext: a shell
 * without the plugin then yields undefined instead of throwing at module load,
 * and the package never enters the web bundle.
 *
 * The timeout matters as much as the catch. `getInfo()` is a bridge round trip,
 * and a bridge that never answers would otherwise leave the gate pending forever.
 */
export async function readNativeAppId(timeoutMs: number = APP_ID_TIMEOUT_MS): Promise<string | null> {
  try {
    const cap = (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
    const getInfo = cap?.Plugins?.App?.getInfo;
    if (typeof getInfo !== 'function') return null;

    const info = await Promise.race([
      Promise.resolve(cap.Plugins.App.getInfo()),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    const id = (info as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/** The gate's full check: what shell is this, and may it render? */
export async function checkNativeShell(options?: {
  allowedAppIds?: readonly string[];
  mode?: ForeignShellGateMode;
  timeoutMs?: number;
  canonicalHosts?: readonly string[];
  hostname?: string | null;
}): Promise<{ decision: ShellDecision; appId: string | null }> {
  const mode = options?.mode ?? parseGateMode(process.env.NEXT_PUBLIC_FOREIGN_SHELL_GATE);
  const allowedAppIds = options?.allowedAppIds ?? parseAllowedAppIds(process.env.NEXT_PUBLIC_ALLOWED_APP_IDS);

  if (mode === 'off') return { decision: 'allow', appId: null };

  // Only defend our own deployments. On anyone else's copy of this code the gate
  // is inert, so a self-hosting fork needs no configuration to work.
  const hostname = options?.hostname !== undefined ? options.hostname : currentHostname();
  const canonicalHosts = options?.canonicalHosts ?? parseCanonicalHosts(process.env.NEXT_PUBLIC_CANONICAL_HOSTS);
  if (!hostname || !isCanonicalDeployment(hostname, canonicalHosts)) {
    return { decision: 'allow', appId: null };
  }

  const native = isNativeAndroid();
  if (!native) return { decision: 'allow', appId: null };

  const appId = await readNativeAppId(options?.timeoutMs);
  return { decision: decideShellAccess({ isNativeAndroid: true, appId, allowedAppIds, mode }), appId };
}
