/**
 * Pure decision helpers for the one-time Android battery-optimization hint.
 * No DOM / React dependencies so they are unit-testable in node:test.
 */

/**
 * Whether the first-play battery hint should be shown.
 * Shows only on an Android browser (not the native Capacitor app) that has
 * not already dismissed it.
 */
export function shouldShowAndroidBatteryHint(input: {
  isAndroid: boolean;
  isNative: boolean;
  dismissed: boolean;
}): boolean {
  return input.isAndroid && !input.isNative && !input.dismissed;
}

/**
 * Human-readable browser name for the hint steps. Edge must be checked
 * before Chrome because Edge's UA string contains both "Chrome" and "Edg".
 * `isBrave` is the awaited result of navigator.brave?.isBrave() (Brave hides
 * itself in the UA string, so it needs the dedicated API).
 */
export function resolveBrowserName(input: { ua: string; isBrave: boolean }): string {
  if (input.isBrave) return 'Brave';
  if (/Firefox/i.test(input.ua)) return 'Firefox';
  if (/Edg/i.test(input.ua)) return 'Edge';
  if (/Chrome/i.test(input.ua)) return 'Chrome';
  return 'your browser';
}
