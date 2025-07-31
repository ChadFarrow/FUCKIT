/**
 * Application Version Management
 * Auto-increments on GitHub changes via git hooks
 */

export interface AppVersion {
  major: number;
  minor: number;
  patch: number;
  build: number;
}

// Current version - starts at 1.000
export const currentVersion: AppVersion = {
  major: 1,
  minor: 0,
  patch: 534,
  build: 459
};

/**
 * Format version as string (e.g., "1.001", "1.023")
 */
export function formatVersion(version: AppVersion = currentVersion): string {
  const minorPatch = (version.minor * 100 + version.patch).toString().padStart(3, '0');
  return `${version.major}.${minorPatch}`;
}

/**
 * Increment version by 0.001
 */
export function incrementVersion(version: AppVersion): AppVersion {
  let newPatch = version.patch + 1;
  let newMinor = version.minor;
  let newMajor = version.major;

  // Handle rollover: 0.999 -> 1.000
  if (newPatch >= 1000) {
    newPatch = 0;
    newMinor += 1;
    
    if (newMinor >= 10) {
      newMinor = 0;
      newMajor += 1;
    }
  }

  return {
    major: newMajor,
    minor: newMinor,
    patch: newPatch,
    build: version.build + 1
  };
}

/**
 * Get full version string with build number
 */
export function getFullVersionString(): string {
  return `v${formatVersion()} (build ${currentVersion.build})`;
}

/**
 * Get simple version string
 */
export function getVersionString(): string {
  return `v${formatVersion()}`;
}