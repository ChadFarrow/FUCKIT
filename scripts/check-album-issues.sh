#!/bin/bash

# Album Issues Checker
# 
# This script automatically detects albums with duplicate tracks, 
# missing metadata, or other issues without requiring manual knowledge.
# 
# Usage: ./scripts/check-album-issues.sh

API_BASE=${API_BASE:-"http://localhost:3000"}

echo "🔍 Checking for album issues..."
echo ""

# Get diagnostics data
RESPONSE=$(curl -s "$API_BASE/api/albums/diagnostics")

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
    echo "❌ Error: Could not fetch diagnostics data. Make sure the server is running."
    exit 1
fi

# Check if response contains error
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ API Error: $(echo "$RESPONSE" | jq -r '.error')"
    exit 1
fi

# Print statistics
echo "📊 ALBUM DIAGNOSTICS SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq -r '
"Total Albums Analyzed: \(.stats.totalAlbums)",
"Albums with Duplicates: \(.stats.albumsWithDuplicates)", 
"Albums with Many Tracks: \(.stats.albumsWithManyTracks)",
"Albums with Suspicious Patterns: \(.stats.albumsWithSuspiciousPatterns)",
"Albums with Missing Metadata: \(.stats.albumsWithMissingMetadata)",
"Total Duplicate Tracks Removed: \(.stats.totalDuplicatesRemoved)"'
echo ""

# Print recommendations
echo "💡 RECOMMENDATIONS"
echo "═══════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq -r '.summary.recommendations[]' | while read -r rec; do
    echo "• $rec"
done
echo ""

# Print most problematic albums
echo "🚨 MOST PROBLEMATIC ALBUMS"
echo "═══════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq -r '.summary.mostProblematicAlbums[] | 
if .severity == "high" then "🔴 [HIGH] \(.album)"
elif .severity == "medium" then "🟡 [MEDIUM] \(.album)" 
else "🟢 [LOW] \(.album)" end,
"   Type: \(.type | gsub("_"; " "))",
"   Issue: \(.description)",
""'

# Show duplicate tracks detail
echo "🔄 DUPLICATE TRACKS DETAIL (Top 5)"
echo "═══════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq -r '.issues[] | select(.type == "duplicate_tracks") | 
"📀 \(.album)",
"   Original: \(.originalTracks) tracks → Deduplicated: \(.deduplicatedTracks) tracks", 
"   Removed: \(.duplicateCount) duplicates",
if (.duplicatedTitles | length) > 0 then "   Duplicated: \(.duplicatedTitles | join(", "))" else empty end,
""' | head -30

# Show albums with many tracks
echo "📈 ALBUMS WITH MANY TRACKS"
echo "═══════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq -r '.issues[] | select(.type == "excessive_tracks") |
"📀 \(.album) - \(.trackCount) tracks",
"   \(.description)",
""'

# Final status
TOTAL_ISSUES=$(echo "$RESPONSE" | jq '.issues | length')
TOTAL_ALBUMS=$(echo "$RESPONSE" | jq '.stats.totalAlbums')
TIMESTAMP=$(echo "$RESPONSE" | jq -r '.timestamp')

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo "✅ No issues found! All albums look good."
else
    echo "⚠️  Found $TOTAL_ISSUES issues across $TOTAL_ALBUMS albums."
    echo "   Most duplicate track issues are automatically fixed by the deduplication system."
fi

echo ""
echo "Last checked: $(date -d "$TIMESTAMP" 2>/dev/null || date)"

# Make script executable if run directly
chmod +x "$0" 2>/dev/null || true