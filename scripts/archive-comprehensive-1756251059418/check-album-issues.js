#!/usr/bin/env node

/**
 * Album Issues Checker
 * 
 * This script automatically detects albums with duplicate tracks, 
 * missing metadata, or other issues without requiring manual knowledge.
 * 
 * Usage:
 *   npm run check-albums
 *   node scripts/check-album-issues.js
 */

const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function checkAlbumIssues() {
  try {
    console.log('🔍 Checking for album issues...\n');
    
    const response = await fetch(`${API_BASE}/api/albums/diagnostics`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Print statistics
    console.log('📊 ALBUM DIAGNOSTICS SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Total Albums Analyzed: ${data.stats.totalAlbums}`);
    console.log(`Albums with Duplicates: ${data.stats.albumsWithDuplicates}`);
    console.log(`Albums with Many Tracks: ${data.stats.albumsWithManyTracks}`);
    console.log(`Albums with Suspicious Patterns: ${data.stats.albumsWithSuspiciousPatterns}`);
    console.log(`Albums with Missing Metadata: ${data.stats.albumsWithMissingMetadata}`);
    console.log(`Total Duplicate Tracks Removed: ${data.stats.totalDuplicatesRemoved}`);
    console.log('');
    
    // Print recommendations
    if (data.summary.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS');
      console.log('═'.repeat(50));
      data.summary.recommendations.forEach(rec => {
        console.log(`• ${rec}`);
      });
      console.log('');
    }
    
    // Print most problematic albums
    if (data.summary.mostProblematicAlbums.length > 0) {
      console.log('🚨 MOST PROBLEMATIC ALBUMS');
      console.log('═'.repeat(50));
      data.summary.mostProblematicAlbums.forEach(album => {
        const severity = album.severity.toUpperCase();
        const emoji = album.severity === 'high' ? '🔴' : album.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${emoji} [${severity}] ${album.album}`);
        console.log(`   Type: ${album.type.replace('_', ' ')}`);
        console.log(`   Issue: ${album.description}`);
        console.log('');
      });
    }
    
    // Print detailed issues by category
    const issuesByType = {};
    data.issues.forEach(issue => {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    });
    
    // Show duplicate tracks in detail
    if (issuesByType.duplicate_tracks) {
      console.log('🔄 DUPLICATE TRACKS DETAIL');
      console.log('═'.repeat(50));
      issuesByType.duplicate_tracks.slice(0, 5).forEach(issue => {
        console.log(`📀 ${issue.album}`);
        console.log(`   Original: ${issue.originalTracks} tracks → Deduplicated: ${issue.deduplicatedTracks} tracks`);
        console.log(`   Removed: ${issue.duplicateCount} duplicates`);
        if (issue.duplicatedTitles.length > 0) {
          console.log(`   Duplicated: ${issue.duplicatedTitles.join(', ')}`);
        }
        console.log('');
      });
    }
    
    // Show excessive tracks
    if (issuesByType.excessive_tracks) {
      console.log('📈 ALBUMS WITH MANY TRACKS');
      console.log('═'.repeat(50));
      issuesByType.excessive_tracks.forEach(issue => {
        console.log(`📀 ${issue.album} - ${issue.trackCount} tracks`);
        console.log(`   ${issue.description}`);
        console.log('');
      });
    }
    
    // Final status
    const totalIssues = data.issues.length;
    if (totalIssues === 0) {
      console.log('✅ No issues found! All albums look good.');
    } else {
      console.log(`⚠️  Found ${totalIssues} issues across ${data.stats.totalAlbums} albums.`);
      console.log('   Most duplicate track issues are automatically fixed by the deduplication system.');
    }
    
    console.log('');
    console.log(`Last checked: ${new Date(data.timestamp).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error checking album issues:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkAlbumIssues();
}

module.exports = { checkAlbumIssues };