# Manual UI Testing Checklist

Manual smoke tests for browser-facing behaviour that automated tests don't cover — keyboard
shortcuts, scroll behaviour, share targets, responsiveness, theming.

**This is not the test suite.** Automated checks are:

```bash
npm run typecheck    # tsc --noEmit
npm run test:all     # tsx --test lib/*.test.ts lib/*/*.test.ts
npx next lint
```

CI runs all three on every push and PR. Run them first; use this checklist for what they can't see.

> **Verify layout changes by measuring, not eyeballing.** For anything involving safe-area insets,
> the player bar, or mobile layout, drive puppeteer-core against the real component and assert all
> four edges — several bugs here survived a sweep that only checked one. See the `mobile-layout`
> skill.

---

## Feature Testing Guide

### 1. **Keyboard Shortcuts** ⌨️

Test these keyboard controls anywhere on the page:

#### **Space Bar** - Play/Pause
1. Click on any album to load a track
2. Press `Space` to start playback
3. Press `Space` again to pause
4. ✅ Verify: Track plays/pauses smoothly

#### **Arrow Keys** - Next/Previous Track
1. Load an album with multiple tracks
2. Press `→` (Right Arrow) to go to next track
3. Press `←` (Left Arrow) to go to previous track
4. ✅ Verify: Tracks change correctly

#### **Slash `/`** - Focus Search
1. Press `/` (forward slash)
2. ✅ Verify: Search box gets focused (should highlight)
3. Type to search immediately

#### **Escape `Esc`** - Close Modals
1. Open any modal/fullscreen view
2. Press `Esc` key
3. ✅ Verify: Modal closes and fullscreen exits

---

### 2. **Back-to-Top Button** ↑

#### Test 1: Visibility
1. Page is loaded at the top
2. ✅ Verify: Back-to-top button is **NOT visible** (bottom-right)
3. Scroll down at least 300px
4. ✅ Verify: Button **appears** in bottom-right corner (teal/cyan color)

#### Test 2: Functionality
1. Scroll back to the top
2. ✅ Verify: Button **disappears** automatically
3. Scroll down and click the button
4. ✅ Verify: Smooth scroll animation to top (not instant jump)
5. ✅ Verify: Button is **teal/orange** colored with arrow icon

---

### 3. **Share Button** 🔗

Located in the top navigation bar (should be visible).

#### Test 1: Mobile/Share Menu (if on mobile)
1. Look for share icon in header
2. Click the share button
3. ✅ Verify: Native share menu appears with:
   - Title: "Project StableKraft"
   - URL: Current page URL

#### Test 2: Desktop (Copy to Clipboard)
1. Look for share icon in header
2. Click the share button
3. ✅ Verify: Link is copied to clipboard
4. ✅ Verify: Confirmation message appears (toast notification)
5. Paste the link somewhere to confirm it copied

---

### 4. **Loading States** ⏳

#### Test: Skeleton Loaders
1. Hard refresh the page (`Ctrl+Shift+R`)
2. Watch carefully for the first ~2 seconds
3. ✅ Verify: See skeleton cards loading
4. ✅ Verify: Skeleton cards have **shimmer animation** (left-to-right wave effect)
5. ✅ Verify: Skeleton cards match the album card layout

---

### 5. **SEO & Metadata** 🔍

#### Test: Open Graph Tags (Social Sharing)
1. Open DevTools (`F12`)
2. Go to the `<head>` section
3. Look for these meta tags:
   - `<meta property="og:title">`
   - `<meta property="og:description">`
   - `<meta property="og:image">`
   - `<meta property="twitter:card">`
4. ✅ Verify: All tags are present with correct values

#### Test: Browser Title
1. Look at browser tab title
2. ✅ Verify: Shows "Project StableKraft - Music & Podcast Hub"

---

### 6. **Filter & View** 🎛️

#### Test: Filter Buttons
1. Click on filter buttons: **All**, **Albums**, **EPs**, **Singles**, **Publishers**, **Playlists**, **Videos**
2. ✅ Verify: Each filter updates the content
3. ✅ Verify: Selected filter is highlighted (teal background)

#### Test: Search
1. Press `/` or click search box
2. Type an artist name (e.g., "The Last Confidence")
3. ✅ Verify: Results filter in real-time
4. ✅ Verify: Search works correctly

---

### 7. **Album Cards** 🎵

#### Test: Interactive Elements
1. Hover over an album card
2. ✅ Verify: Card has subtle hover effect (slight shadow/scale change)
3. Click on a card
4. ✅ Verify: Album opens with track list
5. ✅ Verify: Click the heart/favorite icon
6. ✅ Verify: Favorite status updates

---

### 8. **Accessibility** ♿

#### Test: ARIA Labels
1. Open DevTools (`F12`)
2. Go to **Accessibility** tab
3. Click on interactive buttons
4. ✅ Verify: Buttons have descriptive `aria-label` attributes
5. ✅ Verify: Semantic HTML structure is correct

#### Test: Keyboard Navigation
1. Press `Tab` key repeatedly
2. ✅ Verify: Can navigate through all buttons and inputs using Tab
3. ✅ Verify: Focus outline is visible (usually blue/yellow)

---

### 9. **Performance** ⚡

#### Test: Page Load Speed
1. Hard refresh page
2. Watch Network tab in DevTools
3. ✅ Verify: Page loads in under 5 seconds
4. ✅ Verify: No 404 errors or failed requests
5. ✅ Verify: CSS file loads (should be ~50-100KB)

#### Test: Console
1. Open DevTools Console (`F12` → Console)
2. ✅ Verify: No red error messages
3. ✅ Verify: No warnings about missing resources
4. ✅ Verify: No "Cannot find 'console.log' undefined" errors

---

### 10. **Responsiveness** 📱

#### Test: Mobile View
1. Press `F12` to open DevTools
2. Click responsive design mode (Ctrl+Shift+M)
3. Select **iPhone 12/13** or similar
4. ✅ Verify: Layout adapts properly
5. ✅ Verify: Album cards stack in grid
6. ✅ Verify: Back-to-top button still visible and works
7. ✅ Verify: Search bar is accessible

#### Test: Tablet View
1. Select **iPad** in responsive mode
2. ✅ Verify: 2-column or 3-column grid layout
3. ✅ Verify: All buttons are touch-friendly (large enough)

---

### 11. **Dark Mode / Theme** 🌙

#### Test: Color Scheme
1. Look at the page colors
2. ✅ Verify: Dark background (navy/dark blue)
3. ✅ Verify: Teal/cyan accents for buttons and highlights
4. ✅ Verify: Orange hover states on buttons
5. ✅ Verify: Text is readable on dark background

---

### 12. **Error Handling** ❌

#### Test: Error Component (if available)
1. Check if any error states appear
2. ✅ Verify: Errors display with clear message
3. ✅ Verify: "Retry" button is available if applicable
4. ✅ Verify: Error colors are red/pink

---

### 13. **Favorite/Heart Functionality** ❤️

#### Test: Add to Favorites
1. Click the heart icon on any album
2. ✅ Verify: Heart fills in (becomes solid)
3. ✅ Verify: Favorite is saved to your profile
4. Click again to remove
5. ✅ Verify: Heart empties out (becomes outline)

---

### 14. **Typography** 🔤

#### Test: Font Loading
1. Page should use **Inter** font
2. ✅ Verify: Text looks clean and modern
3. ✅ Verify: No font flashing (FOUT - Flash of Unstyled Text)

---

## 🎯 Priority Testing Order

1. **Must Test First** (Core Functionality):
   - [x] Site loads without errors
   - [ ] Keyboard shortcuts (Space, arrows)
   - [ ] Back-to-top button appears/works
   - [ ] Search works
   - [ ] Filters work

2. **Should Test** (User Experience):
   - [ ] Share button works
   - [ ] Skeleton loaders visible
   - [ ] Responsive on mobile
   - [ ] No console errors
   - [ ] Performance is good

3. **Nice to Test** (Polish):
   - [ ] Open Graph tags are correct
   - [ ] ARIA labels present
   - [ ] Colors match brand
   - [ ] Hover effects smooth

---

## 📸 Screenshot Checklist

Take screenshots to verify:
- [ ] Page loaded with album grid visible
- [ ] Back-to-top button visible after scrolling
- [ ] Search field highlighted after pressing `/`
- [ ] Share button clicked (menu/toast visible)
- [ ] Mobile responsive view looks good
- [ ] DevTools shows no errors

---

## Where these features live

| Feature | File |
|---------|------|
| Keyboard Shortcuts | `hooks/useKeyboardShortcuts.ts` |
| Back-to-Top Button | `components/BackToTop.tsx` |
| Share Button | `components/ShareButton.tsx` |
| Skeleton Loaders | `components/SkeletonCard.tsx` |
| SEO Metadata | `components/SEOHead.tsx` |
| Error Messages | `components/ErrorMessage.tsx` |
| Shared Types | `types/common.ts` |
| Constants | `lib/constants.ts` |

## Testing on a phone over the LAN

Two traps, both of which look like "my change didn't apply":

1. **The service worker serves stale content.** A production `npm run build` writes `public/sw.js`
   and `public/workbox-*.js`, and Next serves `public/` statically even in dev — so a phone that
   registered the worker keeps getting its cached HTML shell and CSS. A plain reload does not fix
   it. Delete both files (they're gitignored build artifacts) so `/sw.js` 404s, then reload twice,
   or use a private tab.

2. **Building over a live dev server breaks asset loading.** Both write `.next/`. Stop
   `npm run dev` before `npm run build`, or every asset request 400s until you
   `rm -rf .next` and restart.

## Reporting what you find

File an issue rather than recording results in this file — a checklist that accumulates one run's
findings stops being a checklist. For boost failures and client-side errors, check
`/api/admin/diagnostics` first; they're already captured there. See the `diagnostics` skill.
