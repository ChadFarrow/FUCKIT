import { NextResponse } from 'next/server';

// Embedded resolved songs data (114 songs)
const resolvedSongsData = [
  {
    "feedGuid": "3ae285ab-434c-59d8-aa2f-59c6129afb92",
    "itemGuid": "d8145cb6-97d9-4358-895b-2bf055d169aa",
    "title": "Neon Hawk",
    "artist": "John Depew Trio",
    "feedUrl": "https://wavlake.com/feed/music/99ed143c-c461-4f1a-9d0d-bee6f70d8b7e",
    "feedTitle": "Bell of Hope",
    "episodeId": 40262390560,
    "feedId": 7422180
  },
  {
    "feedGuid": "6fc2ad98-d4a8-5d70-9c68-62e9efc1209c",
    "itemGuid": "aad6e3b1-6589-4e22-b8ca-521f3d888263",
    "title": "Grey's Birthday",
    "artist": "Big Awesome",
    "feedUrl": "https://wavlake.com/feed/music/5a07b3f1-8249-45a1-b40a-630797dc4941",
    "feedTitle": "Birdfeeder (EP)",
    "episodeId": 29982854680,
    "feedId": 7086035
  },
  {
    "feedGuid": "dea01a9d-a024-5b13-84aa-b157304cd3bc",
    "itemGuid": "52007112-2772-42f9-957a-a93eaeedb222",
    "title": "Smokestacks",
    "artist": "Herbivore",
    "feedUrl": "https://wavlake.com/feed/music/328f61b9-20b1-4338-9e2a-b437abc39f7b",
    "feedTitle": "Smokestacks",
    "episodeId": 16429855198,
    "feedId": 6685399
  },
  {
    "feedGuid": "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4",
    "itemGuid": "d79f242f-0651-4b12-be79-c2bac234cfde",
    "title": "Hit the Target [Live in Amsterdam]",
    "artist": "Theo Katzman",
    "feedUrl": "https://wavlake.com/feed/music/8aaf0d1e-7ac3-4f7d-993b-6f59f936d780",
    "feedTitle": "Live From the Other Side",
    "episodeId": 33874518602,
    "feedId": 7216277
  },
  {
    "feedGuid": "3058af0c-1807-5732-9a08-9114675ef7d6",
    "itemGuid": "c51ecaa4-f237-4707-9c62-2de611820e4b",
    "title": "Lost Summer",
    "artist": "Ollie",
    "feedUrl": "https://wavlake.com/feed/music/883ea557-39c0-4bec-9618-c75978bc63b5",
    "feedTitle": "Lost Summer",
    "episodeId": 39446986829,
    "feedId": 7400497
  }
];

export async function GET() {
  try {
    console.log('📊 Serving resolved songs data:', resolvedSongsData.length, 'songs');
    
    return NextResponse.json(resolvedSongsData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error serving resolved songs data:', error);
    return NextResponse.json(
      { error: 'Failed to load resolved songs data' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
