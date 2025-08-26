#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const musicData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'music-tracks.json'), 'utf8'));

console.log('📅 Date Analysis\n');

// Check all date fields
const dateFields = new Set();
const dateCounts = {};

musicData.musicTracks.forEach(track => {
    Object.keys(track).forEach(key => {
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
            dateFields.add(key);
            if (!dateCounts[key]) dateCounts[key] = { total: 0, nonNull: 0, values: new Set() };
            dateCounts[key].total++;
            if (track[key] !== null && track[key] !== undefined && track[key] !== '') {
                dateCounts[key].nonNull++;
                // Extract just the date part if it's a timestamp
                const dateValue = track[key].toString().split('T')[0];
                dateCounts[key].values.add(dateValue);
            }
        }
    });
});

console.log('Date fields found:', Array.from(dateFields).join(', '));
console.log('\n📊 Field Statistics:');

Object.entries(dateCounts).forEach(([field, stats]) => {
    console.log(`\n${field}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Non-null: ${stats.nonNull}`);
    console.log(`  Unique dates: ${stats.values.size}`);
    
    if (stats.values.size > 0 && stats.values.size < 20) {
        const dates = Array.from(stats.values).sort();
        console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
        
        // Check for future dates
        const today = new Date().toISOString().split('T')[0];
        const futureDates = dates.filter(d => d > today);
        if (futureDates.length > 0) {
            console.log(`  ⚠️  FUTURE DATES: ${futureDates.join(', ')}`);
        }
        
        // Check for placeholder dates like 1970-01-01 or 2000-01-01
        const suspiciousDates = dates.filter(d => 
            d === '1970-01-01' || 
            d === '2000-01-01' || 
            d === '1900-01-01' ||
            d.endsWith('-01-01') && d.startsWith('20')
        );
        if (suspiciousDates.length > 0) {
            console.log(`  ⚠️  SUSPICIOUS DATES: ${suspiciousDates.join(', ')}`);
        }
    }
});

// Check for tracks with all date fields null
const tracksWithNoDates = musicData.musicTracks.filter(track => {
    return Array.from(dateFields).every(field => !track[field] || track[field] === null);
});

console.log(`\n\n⚠️  Tracks with no date information: ${tracksWithNoDates.length} out of ${musicData.musicTracks.length}`);

// Sample some tracks with future dates
const futureAddedDates = musicData.musicTracks.filter(t => {
    if (!t.addedDate) return false;
    const date = t.addedDate.split('T')[0];
    return date >= '2025-01-01';
});

if (futureAddedDates.length > 0) {
    console.log(`\n🔍 Sample tracks with 2025+ dates (showing first 5):`);
    futureAddedDates.slice(0, 5).forEach(t => {
        console.log(`  - "${t.title}" by ${t.artist || 'Unknown'}: ${t.addedDate}`);
    });
    console.log(`  Total: ${futureAddedDates.length} tracks`);
}