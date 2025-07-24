# Versioning System

This project uses an automatic versioning system that increments by 0.001 with each GitHub push.

## Version Format

- **Format**: `v1.XXX` (e.g., v1.000, v1.001, v1.023)
- **Starting Version**: v1.000
- **Increment**: +0.001 per GitHub push to main branch
- **Display Location**: Left sidebar menu (bottom section)

## How It Works

### 1. Version Display
The current version is displayed in the left sidebar menu at the bottom, showing as `v1.XXX`.

### 2. Auto-Increment Process
Every time you push changes to the main branch on GitHub:
1. Git pre-push hook runs automatically
2. Version increments by 0.001 (1.000 → 1.001 → 1.002, etc.)
3. Updated version is committed with your changes
4. Push continues to GitHub with new version

### 3. Version Rollover
- When patch reaches 999: v1.999 → v2.000
- System supports up to v9.999 (10,000 total increments)

## Files

- **`lib/version.ts`** - Version configuration and utilities
- **`scripts/increment-version.js`** - Version increment script
- **`.githooks/pre-push`** - Git hook for auto-increment
- **`scripts/setup-git-hooks.sh`** - Setup script (already run)

## Manual Version Management

### Test Version Increment
```bash
node scripts/increment-version.js
```

### Reset Version (if needed)
Edit `lib/version.ts` and modify the `currentVersion` object:
```typescript
export const currentVersion: AppVersion = {
  major: 1,
  minor: 0,
  patch: 0,  // Reset to 0
  build: 0   // Reset to 0
};
```

### Setup Git Hooks (if needed)
```bash
./scripts/setup-git-hooks.sh
```

## Version History Tracking

The system tracks:
- **Major**: Major version number (starts at 1)
- **Minor**: Currently unused (always 0)
- **Patch**: Increment counter (0-999)
- **Build**: Total number of builds/pushes

## Example Version Progression

1. v1.000 (initial)
2. v1.001 (first push)
3. v1.002 (second push)
4. v1.023 (twenty-third push)
5. v1.999 (999th push)
6. v2.000 (1000th push - rollover)

The version display updates automatically on the next page load after a push.