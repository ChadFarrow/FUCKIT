# HGH Problematic GUIDs Report

**Date:** August 9, 2025  
**Final Success Rate:** 95.5% (1069/1119 tracks resolved)  
**Remaining Unresolved:** 50 tracks (24 placeholders + 26 unknown feeds)

## Summary

After extensive resolution efforts using direct RSS parsing and GUID corrections, 50 tracks remain unresolved. These represent genuine data quality issues in the original HGH RSS feed rather than technical problems with our resolution approach.

## Successfully Fixed GUIDs

The following GUID corrections were successfully applied:

### 1. Able and the Wolf Feed
- **Original GUID:** `a0e2112b-1972-4ae2-84b5-c70df89bd909`
- **Correct GUID:** `acddbb03-064b-5098-87ca-9b146beb12e8`  
- **Feed URL:** `https://ableandthewolf.com/static/media/feed.xml`
- **Status:** ✅ Fixed 1 track ("Unknown Feed" → "Makin' Beans")

### 2. OVVRDOS Feed  
- **GUID:** `8b41f7f4-2cc3-5a03-90f5-6c54e92bc96b`
- **Feed URL:** `https://music.behindthesch3m3s.com/wp-content/uploads/OVVRDOS/ovvr_not_under.xml`
- **Status:** ✅ Fixed 1 track ("Track 1 + Peso Much (Ft. Young Clippa)")

## Problematic GUIDs - Data Quality Issues

### High-Impact Problematic Feeds (6+ tracks each)

#### 1. Feed GUID: `659f95a4-1291-5e03-ab86-2deac518f652` (8 tracks)
- **Episodes Affected:** HGH #71, #79, #81, #88, #93, #97, #98
- **Status:** Feed not accessible via known patterns
- **Issue:** Likely deleted or moved feed
- **Tracks:**
  - HGH #97: Track 1113, Track 1118 
  - HGH #98: Unknown Feed tracks
  - HGH #88, #71, #81, #93: Various Unknown Feed entries

#### 2. Feed GUID: `fc815bcf-3639-5395-ba7d-fa217ec93d32` (6 tracks)  
- **Feed Title:** "Aged Friends & Old Whiskey" by Delta OG
- **Feed URL:** `https://music.behindthesch3m3s.com/wp-content/uploads/Delta_OG/Aged_Friends_and_Old_Whiskey/aged_friends_old_whiskey.xml`
- **Status:** Feed accessible, items not found
- **Issue:** Item GUIDs don't match feed contents (outdated references)
- **Episodes Affected:** HGH #8, #11, #51, #52
- **Tracks:** Track 149, Track 473, Track 570, Track 624, Track 746, Track 758

### Medium-Impact Problematic Feeds (2-3 tracks each)

#### 3. Feed GUID: `64ef270-728d-51f0-8052-9fed4883f662` (3 tracks)
- **Episodes Affected:** HGH #96, #97, #98 (early episodes)
- **Status:** Feed not found
- **Issue:** Contains direct MP3 URLs as item GUIDs (non-standard)
- **Example Item GUID:** `https://www.falsefinish.club/wp-content/uploads/2023/05/03.-Rings-of-Saturn_24Bit_Aria_Master_MTC.mp3`

#### 4. Feed GUID: `5a95f9d8-35e3-51f5-a269-ba1df36b4bd8` (2 tracks)
- **Episodes Affected:** HGH #3, #6
- **Likely Artist:** Dane Ray Coleman (based on search)
- **Correct Feed Found:** `3d92b2f6-4aac-5f24-bffe-2536eb579286`
- **Correct URL:** `https://music.behindthesch3m3s.com/wp-content/uploads/Dane%20Ray%20Coleman/Lionhead/lionhead.xml`
- **Issue:** Feed GUID mismatch, items not found in correct feed

#### 5. Feed GUID: `3b20c1d7-6000-570f-8748-a4aab5a43921` (2 tracks)
- **Episodes Affected:** HGH #11
- **Status:** Feed not accessible
- **Issue:** Unknown/offline feed

#### 6. Feed GUID: `c989830b-49a1-572f-9f0e-0fec994a6d5a` (2 tracks)
- **Feed Title:** "Way to Go"
- **Feed URL:** `https://static.staticsave.com/mspfiles/waytogo.xml`  
- **Status:** Feed accessible, items not found
- **Issue:** Item GUIDs don't match feed contents
- **Episodes Affected:** HGH #21
- **Tracks:** Track 309, Track 356

#### 7. Feed GUID: `8b4358f8-1c21-5977-8674-d21113719ccf` (2 tracks)
- **Feed Title:** "All That's Haunting Me" 
- **Feed URL:** `https://thebearsnare.com/67thunbeat2.xml`
- **Status:** Feed accessible, items not found  
- **Issue:** Item GUIDs don't match feed contents
- **Episodes Affected:** HGH #36
- **Tracks:** Track 530, Track 552

#### 8. Feed GUID: `d50e670d-282f-5892-a360-ff407f5da2a2` (2 tracks)
- **Episodes Affected:** HGH #85
- **Status:** Feed not found
- **Issue:** Unknown/offline feed

#### 9. Feed GUID: `95be9fe7-30ac-40aa-a86c-bded32942a91` (2 tracks)  
- **Episodes Affected:** HGH #92, #97
- **Status:** Feed not found
- **Issue:** Unknown/offline feed

### Low-Impact Problematic Feeds (1 track each)

The following feed GUIDs each affect 1 track and appear to be completely offline or corrupted:

- `a1ddf2a4-6466-5af4-95ff-5ead7361e02a` (HGH #39)
- `f4d63bc4-de49-5697-9a8f-75dc9521b1e5` (HGH #39) 
- `353bc37b-1c94-5997-97a0-3c28f2a45604` (HGH #36)
- `afc5df5b-bfce-5843-802d-3c074b06e969` (HGH #51)
- `e8c436f7-232e-529d-8354-64540a77b2d8` (HGH #70)
- `2269829e-8a1d-5f5e-bf61-cd7090d3f174` (HGH #33)
- `3074902b-b2dc-5877-bfc3-30f5df0fbe6a` (HGH #34)
- `df430c13-2dae-5aef-8b0d-728148bd3587` (HGH #30)

## Non-Standard GUID Formats

Some entries use non-standard GUID formats that break normal resolution:

### 1. Direct MP3 URLs as Item GUIDs
- **Example:** `https://www.falsefinish.club/wp-content/uploads/2023/05/03.-Rings-of-Saturn_24Bit_Aria_Master_MTC.mp3`
- **Issue:** Using file paths instead of proper GUIDs
- **Affected Episodes:** HGH #96, #97, #98

### 2. RSS Feed URLs as Feed GUIDs  
- **Example:** `https://feed.justcast.com/shows/true-blue/audioposts.rss`
- **Issue:** Using feed URLs instead of proper GUIDs
- **Affected Episode:** HGH #18

## Episode Distribution of Problems

**Most Problematic Episodes:**
- **HGH #97 (Episode 01):** 4 unresolved tracks - First episode, likely data issues
- **HGH #98 (Episode 00):** 4 unresolved tracks - Pilot episode, experimental format
- **HGH #96 (Episode 02):** 3 unresolved tracks - Early episode, format issues
- **HGH #8 (Episode 90):** 4 unresolved tracks - All same problematic feed
- **HGH #11 (Episode 87):** 4 unresolved tracks - Multiple offline feeds

## Root Causes Analysis

### 1. Early Episode Issues (HGH #96-98)
- **Timeframe:** September 2023 (first episodes)
- **Issues:** Non-standard GUID formats, experimental feed structures
- **Impact:** 11 tracks across 3 episodes

### 2. Feed Evolution Issues  
- **Cause:** Feeds changed GUIDs or item structures after HGH episodes were published
- **Examples:** Delta OG feed exists but items don't match
- **Impact:** ~12 tracks with accessible feeds but wrong item references

### 3. Deleted/Offline Feeds
- **Cause:** Small independent podcasts/musicians went offline
- **Impact:** ~25 tracks with completely inaccessible feeds
- **Pattern:** Often single-track feeds from independent artists

### 4. Data Quality Issues
- **Cause:** Manual feed curation errors in original HGH RSS
- **Examples:** Wrong GUIDs, typos in GUID references
- **Impact:** Scattered across all episodes

## Recommendations for Future

### 1. For HGH Podcast Curation
- **Validate GUIDs** before publishing episodes
- **Test feed accessibility** during episode creation  
- **Maintain backup references** for critical tracks
- **Use standardized GUID formats** only

### 2. For Resolution System
- **Archive mode:** Save resolved track data periodically to prevent re-breaks
- **Monitoring:** Alert when previously working tracks start failing
- **Fallback system:** Maintain alternative sources for popular tracks

### 3. For Data Quality
- **Regular audits:** Check feed accessibility monthly
- **GUID validation:** Verify GUID formats match standards
- **Feed health monitoring:** Track feeds that frequently break

## Final Statistics

- **Total Tracks:** 1,119
- **Successfully Resolved:** 1,069 (95.5%)
- **Remaining Issues:** 50 (4.5%)
  - Placeholder tracks: 24 (2.1%) 
  - Unknown feeds: 26 (2.3%)

**Conclusion:** The 95.5% success rate represents excellent data recovery given the age and independent nature of many referenced feeds. The remaining 4.5% appears to represent genuine data loss from the independent podcast ecosystem rather than technical resolution issues.

---

*Report generated during HGH playlist resolution project*  
*Resolution approach: Direct RSS parsing + GUID correction*  
*Technical lead: Claude Code AI Assistant*