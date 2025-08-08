'use client';

import PlaylistAlbum, { PlaylistConfig } from './PlaylistAlbum';

// Static resolved songs data - served directly from component (114 songs)
// This is the complete ITDV playlist with all resolved song metadata
const RESOLVED_SONGS = [
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
  },
  {
    "feedGuid": "011c3a82-d716-54f7-9738-3d5fcacf65be",
    "itemGuid": "c2ba80cc-add9-42ad-9a8f-b490436826ae",
    "title": "Quiet Day",
    "artist": "Lara J",
    "feedUrl": "https://wavlake.com/feed/music/79f5f4f0-a774-40ed-abdf-90ada1980a71",
    "feedTitle": "Abyss / Quiet day",
    "episodeId": 39685112503,
    "feedId": 7406941
  },
  {
    "feedGuid": "0ab5bc9d-c9fb-52f4-8b8c-64be5edf322f",
    "itemGuid": "7bc23b30-5d37-4e03-8256-543b7bf17ba8",
    "title": "it can be erased",
    "artist": "Nate Johnivan",
    "feedUrl": "https://wavlake.com/feed/music/d7a1d7bc-ae06-4b3b-a3fa-4e203d68dbaf",
    "feedTitle": "it can be erased",
    "episodeId": 19754379965,
    "feedId": 6816636
  },
  {
    "feedGuid": "187f22db-79cb-5ac4-aa60-54e424e3915e",
    "itemGuid": "83b608cb-fbb8-4cc4-895e-bd1cf2b08ae3",
    "title": "It's Christmastime Again! (lofi beats mix)",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi.xml",
    "feedTitle": "HeyCitizen's Lo-Fi Hip-Hop Beats to Study and Relax to",
    "episodeId": 31122108876,
    "feedId": 6996400
  },
  {
    "feedGuid": "265706d5-d6a1-5e96-b4c8-5db454844254",
    "itemGuid": "fe6b1845-6b98-425d-aa07-9531474939de",
    "title": "Leaving The Country",
    "artist": "bennyjeans",
    "feedUrl": "https://www.wavlake.com/feed/6f9ec822-9e9c-497d-b90a-f49035a40f0f",
    "feedTitle": "Sad Songs",
    "episodeId": 15565794242,
    "feedId": 6422472
  },
  {
    "feedGuid": "6bf3785f-e053-57f4-9f70-261ee5e3747f",
    "itemGuid": "f9683d28-70df-4112-95c4-490c0383c3c9",
    "title": "Hyssop Branches",
    "artist": "Doerfel Family Bluegrass",
    "feedUrl": "https://www.doerfelverse.com/feeds/dfbv2.xml",
    "feedTitle": "DFB Volume 2",
    "episodeId": 26915554132,
    "feedId": 6998605
  },
  {
    "feedGuid": "6bf3785f-e053-57f4-9f70-261ee5e3747f",
    "itemGuid": "d60032f3-ce45-45c4-81fc-26ff0394a248",
    "title": "Bipolar",
    "artist": "Doerfel Family Bluegrass",
    "feedUrl": "https://www.doerfelverse.com/feeds/dfbv2.xml",
    "feedTitle": "DFB Volume 2",
    "episodeId": 26915554139,
    "feedId": 6998605
  },
  {
    "feedGuid": "6bf3785f-e053-57f4-9f70-261ee5e3747f",
    "itemGuid": "a12d4410-03e0-44fd-bc8b-890760541a93",
    "title": "C.R.V.P.",
    "artist": "Doerfel Family Bluegrass",
    "feedUrl": "https://www.doerfelverse.com/feeds/dfbv2.xml",
    "feedTitle": "DFB Volume 2",
    "episodeId": 26915554155,
    "feedId": 6998605
  },
  {
    "feedGuid": "de032037-63e0-5c6b-820d-13d4319a2b19",
    "itemGuid": "e046f9dd-aca3-4c7a-b396-2148a90ac0f2",
    "title": "Breathe",
    "artist": "The Greensands",
    "feedUrl": "https://wavlake.com/feed/music/169e65e4-c3fa-471f-a473-b75f3890848b",
    "feedTitle": "Breathe EP",
    "episodeId": 36065182527,
    "feedId": 7295699
  },
  {
    "feedGuid": "377602c1-b049-5c14-bddf-eb4e349bee5c",
    "itemGuid": "3634469f-61ad-4e42-97f2-f1335c6ad267",
    "title": "Going Gold",
    "artist": "The Greensands",
    "feedUrl": "https://wavlake.com/feed/music/87c4f77c-f400-4548-bb7d-78f1ec8a7fa9",
    "feedTitle": "Going Gold Single",
    "episodeId": 36065182528,
    "feedId": 7295700
  },
  {
    "feedGuid": "de032037-63e0-5c6b-820d-13d4319a2b19",
    "itemGuid": "24f655ae-8918-4089-8f2c-4c5ef612088b",
    "title": "Kid Yourself EP",
    "artist": "The Greensands",
    "feedUrl": "https://wavlake.com/feed/music/169e65e4-c3fa-471f-a473-b75f3890848b",
    "feedTitle": "Breathe EP",
    "episodeId": 36065182526,
    "feedId": 7295699
  },
  {
    "feedGuid": "092e8cd8-6f44-5189-b574-9c0a5881b334",
    "itemGuid": "35e81e15-6820-4f83-9a3d-4ef2cf0da14b",
    "title": "Endless Deja Vu",
    "artist": "My Friend Jimi",
    "feedUrl": "https://wavlake.com/feed/music/2b5b26a9-3b7a-4f78-9db2-424d94b182d8",
    "feedTitle": "Endless Deja Vu",
    "episodeId": 21060896668,
    "feedId": 6867688
  },
  {
    "feedGuid": "e1e1fed5-4ca3-55b0-9370-182287ec24e5",
    "itemGuid": "86a439b0-6b51-46a4-86f3-2490b7ca34ad",
    "title": "Kid Yourself",
    "artist": "The Greensands",
    "feedUrl": "https://wavlake.com/feed/music/ec5905f8-0f48-4ce8-ab8e-9a4a959a2104",
    "feedTitle": "Kid Yourself Single",
    "episodeId": 36065182529,
    "feedId": 7295701
  },
  {
    "feedGuid": "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
    "itemGuid": "9ff8f18b-cc79-474c-a3e9-2948113b8bf5",
    "title": "Luv Song 4 U",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml",
    "feedTitle": "The Heycitizen Experience",
    "episodeId": 37420640562,
    "feedId": 6650997
  },
  {
    "feedGuid": "d6fe0d1c-bd8d-552b-ac66-cce620391810",
    "itemGuid": "cf8a54a4-5cc2-4263-9ee2-a8d99697578a",
    "title": "Through The Mic",
    "artist": "Elijah Lied",
    "feedUrl": "https://www.doerfelverse.com/artists/elijahlied/throughthemic/through-the-mic.xml",
    "feedTitle": "Through The Mic - Single",
    "episodeId": 38268733927,
    "feedId": 7365050
  },
  {
    "feedGuid": "18843839-f79f-5b22-a842-241d0f6b12ea",
    "itemGuid": "7bf430ff-6f92-4b44-bd3e-c4d0366e7508",
    "title": "Hiding vs. Bad News",
    "artist": "Nate Johnivan",
    "feedUrl": "https://wavlake.com/feed/music/0ed13237-aca9-446f-9a03-de1a2d9331a3",
    "feedTitle": "Fight!",
    "episodeId": 20063167196,
    "feedId": 6830161
  },
  {
    "feedGuid": "57203632-2003-55d2-b710-c699db963f18",
    "itemGuid": "1f7e025c-e8f7-4e10-b12b-9715c9c460c7",
    "title": "Better Days",
    "artist": "Ryan Fonda",
    "feedUrl": "https://www.wavlake.com/feed/6bece1b8-5385-4a33-9224-09e7f3ee6965",
    "feedTitle": "Think Of Me In Color",
    "episodeId": 15572580619,
    "feedId": 6559576
  },
  {
    "feedGuid": "5d5be024-321d-5342-838e-988d1653296b",
    "itemGuid": "191c7fee-5fde-4bdd-96c3-d7af3b4b8585",
    "title": "All We Know",
    "artist": "Seth Fonda",
    "feedUrl": "https://wavlake.com/feed/music/2663f4e8-aa52-4398-89e7-d26381b65545",
    "feedTitle": "Finding Lavender",
    "episodeId": 16978838756,
    "feedId": 6707451
  },
  {
    "feedGuid": "08604071-83cc-5810-bec2-bea0f0cd0033",
    "itemGuid": "0e4191ef-92d1-49a7-8691-8e691d6bfdda",
    "title": "Night Shift",
    "artist": "Ben Doerfel",
    "feedUrl": "https://www.doerfelverse.com/feeds/ben-doerfel.xml",
    "feedTitle": "Ben Doerfel",
    "episodeId": 33979796256,
    "feedId": 6604977
  },
  {
    "feedGuid": "82235f8b-da8c-52a5-ba6b-1f11c199f526",
    "itemGuid": "c6e47574-4fcd-4a56-b2df-9e404a556d15",
    "title": "Smell the Roses",
    "artist": "The Johner Boys",
    "feedUrl": "https://wavlake.com/feed/music/9e673dbf-0c6e-49f1-85fa-5b3bdd9b9f08",
    "feedTitle": "II",
    "episodeId": 25020443644,
    "feedId": 6962881
  },
  {
    "feedGuid": "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4",
    "itemGuid": "bfe9ed47-ac2a-4fc6-be19-6ab94f75c4c4",
    "title": "What Did You Mean (When You Said Love) [Live in London and Amsterdam]",
    "artist": "Theo Katzman",
    "feedUrl": "https://wavlake.com/feed/music/8aaf0d1e-7ac3-4f7d-993b-6f59f936d780",
    "feedTitle": "Live From the Other Side",
    "episodeId": 33874518619,
    "feedId": 7216277
  },
  {
    "feedGuid": "1dc549bf-c1ef-5a30-813f-a2918d37b38d",
    "itemGuid": "f5f51623-49f7-4c8d-ad7a-e1bafa10bab8",
    "title": "Inside Out",
    "artist": "Middle Season",
    "feedUrl": "https://www.doerfelverse.com/artists/middleseason/inside-out.xml",
    "feedTitle": "Inside Out - Single",
    "episodeId": 37382371148,
    "feedId": 7337962
  },
  {
    "feedGuid": "47768d25-74d9-5ba4-82db-aeaa7f50e29c",
    "itemGuid": "b1d3af49-e178-4153-94ab-8427e69429e4",
    "title": "Autumn",
    "artist": "CityBeach",
    "feedUrl": "https://www.doerfelverse.com/feeds/autumn.xml",
    "feedTitle": "Autumn",
    "episodeId": 20671369466,
    "feedId": 6852907
  },
  {
    "feedGuid": "618f9e01-0ebb-5d59-b334-b428f7ebcc78",
    "itemGuid": "22adf983-754f-47af-bf44-2224443c8f28",
    "title": "As Long As It's Rock",
    "artist": "Climbing The Mountain (1979-1990)",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/2023/07/Tempest.xml",
    "feedTitle": "Tempest",
    "episodeId": 15572842779,
    "feedId": 6544134
  },
  {
    "feedGuid": "b39fc3b2-2742-5944-a800-e87c42a093a3",
    "itemGuid": "9db6d76b-fe9e-4914-bcc4-c429e0d75d6b",
    "title": "The HeyCitizen Experience - Love Song 4 U",
    "artist": "The Satellite Skirmish",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/the_satellite_skirmish_album.xml",
    "feedTitle": "The Satellite Skirmish",
    "episodeId": 25021381312,
    "feedId": 6962941
  },
  {
    "feedGuid": "1b59e954-db0a-5096-8116-2ef3638cbb66",
    "itemGuid": "117e8cfe-2da4-5c5c-9060-0ac55808a137",
    "title": "The Lightning",
    "artist": "The Trusted",
    "feedUrl": "https://feeds.rssblue.com/the-lightning",
    "feedTitle": "The Lightning",
    "episodeId": 28656593463,
    "feedId": 7034922
  },
  {
    "feedGuid": "9e3cea98-d04d-5190-88b3-46ee6030d4ea",
    "itemGuid": "e020b55d-3439-40a1-8271-ba2d59081608",
    "title": "Trailer",
    "artist": "The Satellite Skirmish",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/sproutingsymphonies/rss/satspotlightsymphony.xml",
    "feedTitle": "The Satellite Spotlight",
    "episodeId": 36565430950,
    "feedId": 7235124
  },
  {
    "feedGuid": "5bb8f186-2460-54dc-911d-54f642e8adf6",
    "itemGuid": "213ba1ef-4751-4fc9-a33e-52c49f61c63a",
    "title": "Animosity",
    "artist": "CityBeach",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml",
    "feedTitle": "CityBeach",
    "episodeId": 15573087568,
    "feedId": 6560745
  },
  {
    "feedGuid": "0ca05681-c035-5e50-b538-6e42328f0dfd",
    "itemGuid": "454d3146-049c-49b1-b25e-c6551c083265",
    "title": "West Coast Drive",
    "artist": "My Friend Jimi",
    "feedUrl": "https://wavlake.com/feed/music/ed3d6bdf-011b-4416-ab87-591672c07145",
    "feedTitle": "West Coast Drive",
    "episodeId": 30781413382,
    "feedId": 7122319
  },
  {
    "feedGuid": "f314df41-22c1-5fde-bc55-6f48e1625d96",
    "itemGuid": "2ebf7868-7696-4520-9c9c-ff4900978427",
    "title": "Chasing Waterfalls",
    "artist": "My Friend Jimi",
    "feedUrl": "https://wavlake.com/feed/music/ef800a88-9a1c-4f8e-a7c5-f83d7d9b1c87",
    "feedTitle": "Chasing Waterfalls",
    "episodeId": 33062434739,
    "feedId": 7190186
  },
  {
    "feedGuid": "69c634ad-afea-5826-ad9a-8e1f06d6470b",
    "itemGuid": "2b8cef29-6aa5-4e2f-a726-92f916f2424a",
    "title": "Call Me Medley",
    "artist": "Kurtisdrums",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml",
    "feedTitle": "Kurtisdrums",
    "episodeId": 15572708375,
    "feedId": 6560977
  },
  {
    "feedGuid": "b39fc3b2-2742-5944-a800-e87c42a093a3",
    "itemGuid": "2fabcf8b-2c9a-4a0a-b895-3274043e5013",
    "title": "Empath Eyes - Apathy",
    "artist": "The Satellite Skirmish",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/the_satellite_skirmish_album.xml",
    "feedTitle": "The Satellite Skirmish",
    "episodeId": 25021381324,
    "feedId": 6962941
  },
  {
    "feedGuid": "999c4870-396c-5a6b-b22e-4c05ee46127d",
    "itemGuid": "3f239db2-6d3c-4164-86c0-92c84f5caafa",
    "title": "Bullet Train",
    "artist": "My Friend Jimi",
    "feedUrl": "https://wavlake.com/feed/music/b6d8f17c-f448-4085-8ce2-8b247eb26e63",
    "feedTitle": "Bullet Train",
    "episodeId": 23656247926,
    "feedId": 6933466
  },
  {
    "feedGuid": "85e076c0-d4e3-5ae4-9586-0ab862dadf64",
    "itemGuid": "8e175c89-437c-4543-ae0a-aba553da0e05",
    "title": "Mrs Valentine",
    "artist": "My Friend Jimi",
    "feedUrl": "https://wavlake.com/feed/music/3d8c7279-6aa6-41e7-be1c-2680e57af6c8",
    "feedTitle": "Mrs Valentine",
    "episodeId": 36071881385,
    "feedId": 7295876
  },
  {
    "feedGuid": "a599fabe-6b73-58f3-88b8-a7b78a2976b5",
    "itemGuid": "660c8516-ba38-480a-9ce7-e70a17427842",
    "title": "Once Had A Girl",
    "artist": "Jdog",
    "feedUrl": "https://www.thisisjdog.com/media/ring-that-bell.xml",
    "feedTitle": "Ring That Bell",
    "episodeId": 15576638989,
    "feedId": 6601983
  },
  {
    "feedGuid": "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
    "itemGuid": "ae81976d-a05e-4ff9-9adf-cdb11a33fff9",
    "title": "Porkchops Fried",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml",
    "feedTitle": "The Heycitizen Experience",
    "episodeId": 29660147084,
    "feedId": 6650997
  },
  {
    "feedGuid": "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
    "itemGuid": "7cececef-67c0-4e13-9192-943826d3eddd",
    "title": "Not To Worry",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml",
    "feedTitle": "The Heycitizen Experience",
    "episodeId": 28844375342,
    "feedId": 6650997
  },
  {
    "feedGuid": "187f22db-79cb-5ac4-aa60-54e424e3915e",
    "itemGuid": "17313b1e-3585-4bfa-9fb4-288636b84313",
    "title": "The Platform (lofi beats mix)",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi.xml",
    "feedTitle": "HeyCitizen's Lo-Fi Hip-Hop Beats to Study and Relax to",
    "episodeId": 26847970639,
    "feedId": 6996400
  },
  {
    "feedGuid": "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
    "itemGuid": "d2346732-acc5-4256-afe5-0a0f3e670e6b",
    "title": "The Platform",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml",
    "feedTitle": "The Heycitizen Experience",
    "episodeId": 16279720760,
    "feedId": 6650997
  },
  {
    "feedGuid": "99d74aa0-2f55-5b2c-9c7a-47a3f31357f3",
    "itemGuid": "b9b7d326-b583-477a-894b-b810da5b1f2e",
    "title": "I Want Love",
    "artist": "Blackstone Valley",
    "feedUrl": "https://music.jimmyv4v.com/bands/blackstone-valley/blackstone-valley-collection/blackstone-valley-collection-rss.xml",
    "feedTitle": "Blackstone Valley - Songs",
    "episodeId": 30924182735,
    "feedId": 6757401
  },
  {
    "feedGuid": "a599fabe-6b73-58f3-88b8-a7b78a2976b5",
    "itemGuid": "849fa935-bf48-49c6-89e8-5d5b8dd024a2",
    "title": "Ring That Bell",
    "artist": "Jdog",
    "feedUrl": "https://www.thisisjdog.com/media/ring-that-bell.xml",
    "feedTitle": "Ring That Bell",
    "episodeId": 15576638986,
    "feedId": 6601983
  },
  {
    "feedGuid": "dbad52b9-6253-4a9b-bfab-246b9e839815",
    "itemGuid": "fabc3e64-e470-4f97-bf4a-3957e481e23b",
    "title": "Pour Me Some Water",
    "artist": "Jimmy V",
    "feedUrl": "https://music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/jimmy_v-jimmy_v_collection-rss.xml",
    "feedTitle": "Jimmy V - Music",
    "episodeId": 18097393112,
    "feedId": 6734639
  },
  {
    "feedGuid": "dbad52b9-6253-4a9b-bfab-246b9e839815",
    "itemGuid": "9c017289-79a4-40c2-a4fa-451041335db2",
    "title": "Give it Up",
    "artist": "Jimmy V",
    "feedUrl": "https://music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/jimmy_v-jimmy_v_collection-rss.xml",
    "feedTitle": "Jimmy V - Music",
    "episodeId": 29877167158,
    "feedId": 6734639
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "bbc9bfe3-3db1-400b-9ff0-613f57899614",
    "title": "Long As You're Loving Me",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 34643825587,
    "feedId": 6642704
  },
  {
    "feedGuid": "dbad52b9-6253-4a9b-bfab-246b9e839815",
    "itemGuid": "339085cc-c70c-4a5f-ae9f-ecc745ac8a45",
    "title": "I Believe",
    "artist": "Jimmy V",
    "feedUrl": "https://music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/jimmy_v-jimmy_v_collection-rss.xml",
    "feedTitle": "Jimmy V - Music",
    "episodeId": 27987738512,
    "feedId": 6734639
  },
  {
    "feedGuid": "acddbb03-064b-5098-87ca-9b146beb12e8",
    "itemGuid": "0d616fe3-16ab-40be-a33c-98468f81fc11",
    "title": "Stay Awhile (reprise)",
    "artist": "Able and The Wolf",
    "feedUrl": "https://ableandthewolf.com/static/media/feed.xml",
    "feedTitle": "Stay Awhile",
    "episodeId": 34162516760,
    "feedId": 4630863
  },
  {
    "feedGuid": "95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4",
    "itemGuid": "3587c342-cd4a-481c-838c-de242e5beb0b",
    "title": "Hard Work [Live in Amsterdam]",
    "artist": "Theo Katzman",
    "feedUrl": "https://wavlake.com/feed/music/8aaf0d1e-7ac3-4f7d-993b-6f59f936d780",
    "feedTitle": "Live From the Other Side",
    "episodeId": 33874518605,
    "feedId": 7216277
  },
  {
    "feedGuid": "c73b1a23-1c28-5edb-94c3-10d1745d0877",
    "itemGuid": "5342bf75-528c-417e-844b-1d2c69677aeb",
    "title": "This Pain I've Grown",
    "artist": "The Death of Rock and Roll",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/2023/08/The-Death-of-Rock-and-Roll.xml",
    "feedTitle": "The Death of Rock and Roll",
    "episodeId": 15573573048,
    "feedId": 6571305
  },
  {
    "feedGuid": "c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b",
    "itemGuid": "fe393a12-8545-440d-b88b-64e6568936fc",
    "title": "A Sight To See Remix",
    "artist": "Ryan Fonda",
    "feedUrl": "https://www.wavlake.com/feed/0934bb2d-210c-4988-8055-9cd54c9817f7",
    "feedTitle": "A Sight To See Remix",
    "episodeId": 15573378264,
    "feedId": 6568971
  },
  {
    "feedGuid": "08604071-83cc-5810-bec2-bea0f0cd0033",
    "itemGuid": "2b77f75d-7f9b-4d47-864b-ccf495d4b1f4",
    "title": "Honor You",
    "artist": "Ben Doerfel",
    "feedUrl": "https://www.doerfelverse.com/feeds/ben-doerfel.xml",
    "feedTitle": "Ben Doerfel",
    "episodeId": 33979796260,
    "feedId": 6604977
  },
  {
    "feedGuid": "70b4915d-0c0b-5f7a-9980-82831d2a9ba2",
    "itemGuid": "b9471140-0674-4884-bbb5-39ce9c4a000f",
    "title": "All Apology (EP track)",
    "artist": "Sara Jade",
    "feedUrl": "https://wavlake.com/feed/0a131404-899f-4a7d-a2f3-3dbb61622887",
    "feedTitle": "Sink or Swim (EP)",
    "episodeId": 17721952323,
    "feedId": 6734165
  },
  {
    "feedGuid": "52786c48-86b4-5fd9-b4fe-7b44dcc3e4ba",
    "itemGuid": "13468078-1a54-4b0e-92bc-2faea2999ae7",
    "title": "St. Joan",
    "artist": "R.O. Shapiro",
    "feedUrl": "https://wavlake.com/feed/music/d3ee6d16-fc74-4661-a810-4059f745426d",
    "feedTitle": "St. Joan",
    "episodeId": 22535444451,
    "feedId": 6909501
  },
  {
    "feedGuid": "c8d77c9c-e661-5d79-8d5f-735cfe9a95b7",
    "itemGuid": "17249ca4-fc26-45bb-afa3-d86212c9b2f8",
    "title": "Bringing Em Down",
    "artist": "Ryan Fonda",
    "feedUrl": "https://www.wavlake.com/feed/4a0dac66-22c0-49f9-9ec2-bcfdf4b4ef10",
    "feedTitle": "Bringing Em Down",
    "episodeId": 15573000643,
    "feedId": 6564932
  },
  {
    "feedGuid": "3074902b-b2dc-5877-bfc3-30f5df0fbe6a",
    "itemGuid": "c59c7ffe-3847-4d55-ac27-5a1c1fbe6140",
    "title": "Let Go (What's holding you back)",
    "artist": "Middle Season",
    "feedUrl": "https://www.doerfelverse.com/feeds/middle-season-let-go.xml",
    "feedTitle": "Let Go (What's holding you back)",
    "episodeId": 15600524147,
    "feedId": 6651863
  },
  {
    "feedGuid": "2c5f77fe-25d9-5a2d-97ef-236718c627df",
    "itemGuid": "469fb1ea-6b9e-4df4-96d3-0b61e9b1b5ca",
    "title": "Calibrating Broadcast​.​.​.",
    "artist": "Mellow Cassette",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Mellow Cassette/Radio_Brigade/radio_brigade.xml",
    "feedTitle": "Radio Brigade",
    "episodeId": 24524846426,
    "feedId": 6952640
  },
  {
    "feedGuid": "2c5f77fe-25d9-5a2d-97ef-236718c627df",
    "itemGuid": "c5071214-ba27-4327-ae0b-4769fc9cac06",
    "title": "Radio Brigade",
    "artist": "Mellow Cassette",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Mellow Cassette/Radio_Brigade/radio_brigade.xml",
    "feedTitle": "Radio Brigade",
    "episodeId": 24524846427,
    "feedId": 6952640
  },
  {
    "feedGuid": "b9ee4d5d-77e7-56a4-a195-397ae28a3dfe",
    "itemGuid": "e92721f0-4291-4b50-a621-f658d875e640",
    "title": "Hello Stranger feat. Helen Tess",
    "artist": "Charlie Crown",
    "feedUrl": "https://wavlake.com/feed/c5b7d7f5-bf48-41c7-b0cc-8139e300185e",
    "feedTitle": "Hello Stranger feat. Helen Tess",
    "episodeId": 18262910063,
    "feedId": 6754545
  },
  {
    "feedGuid": "beeeef0b-51e9-52ac-b8d7-9ed54d5be3b0",
    "itemGuid": "8ed4bcfe-a4f9-42a7-9529-d30c3d634656",
    "title": "A Chemical to Balance",
    "artist": "Death by Lions",
    "feedUrl": "https://wavlake.com/feed/e9ae5762-130d-4a16-b8b2-98804cc1802e",
    "feedTitle": "The Sheer Magnitude Of it All",
    "episodeId": 16063862260,
    "feedId": 6670333
  },
  {
    "feedGuid": "08604071-83cc-5810-bec2-bea0f0cd0033",
    "itemGuid": "bb9c21e4-6c98-44b9-bf0b-125d244bd013",
    "title": "Emma Rose",
    "artist": "Ben Doerfel",
    "feedUrl": "https://www.doerfelverse.com/feeds/ben-doerfel.xml",
    "feedTitle": "Ben Doerfel",
    "episodeId": 34098709956,
    "feedId": 6604977
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "3aaaebf8-e10f-4058-82af-509b4a61689f",
    "title": "They Don't Know",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492666,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "3b60e3d7-93c2-404e-8679-c541668fa121",
    "title": "Possible",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 24514971941,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "765a7360-3c4c-4df6-becb-121abe595f4d",
    "title": "What Love Is",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 33535170265,
    "feedId": 6642704
  },
  {
    "feedGuid": "537df90e-0cc4-535b-84d0-dcb3ca87f1f8",
    "itemGuid": "33932ccc-c707-411b-b914-4e9a94ec7e89",
    "title": "Bad People",
    "artist": "Nate Johnivan",
    "feedUrl": "https://wavlake.com/feed/music/d677db67-0310-4813-970e-e65927c689f1",
    "feedTitle": "Tinderbox",
    "episodeId": 15565789001,
    "feedId": 6422170
  },
  {
    "feedGuid": "d518a5ad-4df1-413e-a4a4-f2c7e146e650",
    "itemGuid": "7470d39e-6a8a-4356-9349-b9887d0970be",
    "title": "Hardware Store Lady",
    "artist": "Fletcher and Blaney",
    "feedUrl": "https://hogstory.net/uploads/everything_is_lit_feed.xml",
    "feedTitle": "Everything Is Lit",
    "episodeId": 15575208242,
    "feedId": 6587677
  },
  {
    "feedGuid": "d577b6cd-8c41-548b-abba-60e1502a94df",
    "itemGuid": "https://justcast.com/shows/44721/audioposts/1246165",
    "title": "That's How It Goes",
    "artist": "Robert Willey",
    "feedUrl": "https://feed.justcast.com/shows/true-blue/audioposts.rss",
    "feedTitle": "True Blue",
    "episodeId": 7134620807,
    "feedId": 5208028
  },
  {
    "feedGuid": "c1dc15c3-a6e6-577b-8b4e-a7eae58fd40b",
    "itemGuid": "https://justcast.com/shows/44808/audioposts/1248738",
    "title": "Out of the Blue",
    "artist": "Robert Willey",
    "feedUrl": "https://feed.justcast.com/shows/peace-pieces/audioposts.rss",
    "feedTitle": "Peace Pieces",
    "episodeId": 7382196771,
    "feedId": 5198344
  },
  {
    "feedGuid": "70456036-6a9c-5165-8fa7-84352259d602",
    "itemGuid": "ba10024a-d040-4b31-b61d-ea1fca19387d",
    "title": "The Poet Barfly - Demo",
    "artist": "Nate Johnivan",
    "feedUrl": "https://wavlake.com/feed/music/f6bbce4b-4d7a-42ba-9464-6a870b4a387e",
    "feedTitle": "The Poet Barfly - Demo",
    "episodeId": 31817816293,
    "feedId": 7152550
  },
  {
    "feedGuid": "121c26b0-33f8-5cb9-9e14-d706bd3f5db8",
    "itemGuid": "c2747138-3458-4a7d-b5be-7d2c637295bc",
    "title": "Kerouac",
    "artist": "White Triangles",
    "feedUrl": "https://www.whitetriangles.com/rss.xml",
    "feedTitle": "White Triangles",
    "episodeId": 32132471531,
    "feedId": 6609129
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "41339be2-3d61-4223-9641-3e7dd12be2b0",
    "title": "So Far Away",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492671,
    "feedId": 6642704
  },
  {
    "feedGuid": "bcd811d1-9fda-51d9-b2a6-9337f0131b66",
    "itemGuid": "ddc7dff4-121b-43ac-81b2-74c9ab618e59",
    "title": "I Do It Cuz It's Bad",
    "artist": "Cole Hansen",
    "feedUrl": "https://wavlake.com/feed/music/82700713-4ecc-4fc1-94d9-2c0b765504eb",
    "feedTitle": "Vote For Love",
    "episodeId": 20105599384,
    "feedId": 6831667
  },
  {
    "feedGuid": "7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93",
    "itemGuid": "3a5a784f-642f-41ab-b552-8c710415b8c6",
    "title": "Beer Run",
    "artist": "Jessica Lynne Witty",
    "feedUrl": "https://www.wavlake.com/feed/b337bd2b-46c5-4bd0-a57f-f93bca81ebea",
    "feedTitle": "Take The Lead",
    "episodeId": 15574850045,
    "feedId": 6583475
  },
  {
    "feedGuid": "1ef2b1d6-c4c0-5ef5-b534-bfc025e4193e",
    "itemGuid": "46aa7bd5-4355-5e6c-976d-323a4dd7b7ab",
    "title": "Girls at Kroger",
    "artist": "Luke Jenison",
    "feedUrl": "https://feeds.rssblue.com/girls-at-kroger",
    "feedTitle": "Girls at Kroger",
    "episodeId": 29307670194,
    "feedId": 7055219
  },
  {
    "feedGuid": "d3e9bb7a-3df8-5b7e-8f52-0b01decf2b66",
    "itemGuid": "360106a8-ddd8-4ee3-8bdf-2ef967b400ab",
    "title": "Midnight Comin'",
    "artist": "Vertigo Kidd",
    "feedUrl": "https://www.wavlake.com/feed/733fe358-6754-4135-a640-d75bc704c85d",
    "feedTitle": "Cold Neon Blues",
    "episodeId": 15565710637,
    "feedId": 6421029
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "7f2eb92d-289e-4408-ac6c-47fea5905dc1",
    "title": "If I Promise(Demo)",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492662,
    "feedId": 6642704
  },
  {
    "feedGuid": "94c8a0bf-f76e-5f8c-ba1d-c0c15a642271",
    "itemGuid": "b8c2544f-88ec-4cc2-a30f-98d3e4c25aea",
    "title": "Phatty The Grasshopper",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/phatty-the-grasshopper.xml",
    "feedTitle": "Phatty The Grasshopper",
    "episodeId": 19222240526,
    "feedId": 6797653
  },
  {
    "feedGuid": "babd1567-2803-5ede-9a19-302c2fbf9eae",
    "itemGuid": "a2bf5272-8811-4882-aa39-a730c290af4d",
    "title": "Railroad Tracks",
    "artist": "Late Night Special",
    "feedUrl": "https://www.wavlake.com/feed/05b4cf50-f79b-4296-9f04-02c9223182c5",
    "feedTitle": "Halfway To Somwhere",
    "episodeId": 15565790231,
    "feedId": 6422233
  },
  {
    "feedGuid": "2ec344a8-d756-5f8f-bde1-8a034321f1cb",
    "itemGuid": "c341b8f3-28b7-43c2-baff-b59eb6d8de8b",
    "title": "Wonder Woman",
    "artist": "Matt Johner",
    "feedUrl": "https://wavlake.com/feed/music/7c295d64-8b85-4b4f-be2c-72f3954fdcaa",
    "feedTitle": "Wonder Woman",
    "episodeId": 31912163412,
    "feedId": 7154909
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "2f1fabc9-54c0-4e96-93d8-98737356b448",
    "title": "Now I Know",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 32662749312,
    "feedId": 6642704
  },
  {
    "feedGuid": "87ef86af-9d75-5876-97f9-5ea46e6094f7",
    "itemGuid": "eab9f1bd-94da-4c3c-afa7-3b4bc0c50c70",
    "title": "What's Your New Love Like",
    "artist": "The No Good Redwood Ramblers",
    "feedUrl": "https://www.wavlake.com/feed/26a5d908-afa5-418d-a076-dac457bd7fa3",
    "feedTitle": "Shoot From the Hip, Straight to the Heart",
    "episodeId": 17600554516,
    "feedId": 6729847
  },
  {
    "feedGuid": "a2d2e313-9cbd-5169-b89c-ab07b33ecc33",
    "itemGuid": "c2264e2b-a564-43d2-bf7e-5be6298e2ea2",
    "title": "Pay The Bills",
    "artist": "HeyCitizen",
    "feedUrl": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/the heycitizen experience.xml",
    "feedTitle": "The Heycitizen Experience",
    "episodeId": 32553900134,
    "feedId": 6650997
  },
  {
    "feedGuid": "69c634ad-afea-5826-ad9a-8e1f06d6470b",
    "itemGuid": "584953af-7321-4bfe-882d-7cadd697e807",
    "title": "Feeling Bout You",
    "artist": "Kurtisdrums",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml",
    "feedTitle": "Kurtisdrums",
    "episodeId": 30911813741,
    "feedId": 6560977
  },
  {
    "feedGuid": "f511794d-437f-5cbd-8fcd-c541652a7931",
    "itemGuid": "088c8c1b-4753-4bc6-9ae3-08bcbddb3aa1",
    "title": "Playing God",
    "artist": "Opus",
    "feedUrl": "https://www.doerfelverse.com/artists/opus/opus/opus.xml",
    "feedTitle": "Opus",
    "episodeId": 31346450344,
    "feedId": 7141355
  },
  {
    "feedGuid": "028e9f67-e0fc-558f-b598-25f06179cea3",
    "itemGuid": "f6ee3774-c452-4e25-b8f4-c8330ff00f43",
    "title": "That's the Life",
    "artist": "Theo Katzman",
    "feedUrl": "https://wavlake.com/feed/music/6f724ceb-0688-40d5-a93f-4d0b6ec1c797",
    "feedTitle": "Be the Wheel",
    "episodeId": 30604410647,
    "feedId": 7114678
  },
  {
    "feedGuid": "4ab3741a-4a10-5631-a026-a9d0eb62fe11",
    "itemGuid": "b24f24f6-6e49-4685-afc9-c9fa856a9f1e",
    "title": "Grow",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/your-chance.xml",
    "feedTitle": "Your Chance",
    "episodeId": 30992374699,
    "feedId": 7131341
  },
  {
    "feedGuid": "82235f8b-da8c-52a5-ba6b-1f11c199f526",
    "itemGuid": "e580458f-ee8d-4674-b851-2e271cc3ff8e",
    "title": "Let You Down",
    "artist": "The Johner Boys",
    "feedUrl": "https://wavlake.com/feed/music/9e673dbf-0c6e-49f1-85fa-5b3bdd9b9f08",
    "feedTitle": "II",
    "episodeId": 25018216113,
    "feedId": 6962881
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "26071e5e-74f4-4dd6-bb4f-19bfa259801f",
    "title": "Happy New Year(demo)",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492649,
    "feedId": 6642704
  },
  {
    "feedGuid": "6335b366-6a83-5df4-ba62-d356ede08d70",
    "itemGuid": "62767045-5cc0-4280-a552-145a56e6964a",
    "title": "Change Your Mind",
    "artist": "Ainsley Costello",
    "feedUrl": "https://wavlake.com/feed/music/2cc8ce94-6b15-4426-8a6d-ed974d3258e5",
    "feedTitle": "Change Your Mind",
    "episodeId": 28415868718,
    "feedId": 7029052
  },
  {
    "feedGuid": "cb086537-5673-57a8-9c78-72542da2a7d4",
    "itemGuid": "9a29c9f0-649f-4ddd-8888-55ed84d7c2ab",
    "title": "That Duck",
    "artist": "Sir Seat Sitter",
    "feedUrl": "https://music.behindthesch3m3s.com/wp-content/uploads/Sir Seat Sitter/that_duck.xml",
    "feedTitle": "That Duck",
    "episodeId": 18609803143,
    "feedId": 6769013
  },
  {
    "feedGuid": "e0658b29-1cd3-55b8-ac51-0997764ce334",
    "itemGuid": "32dd5103-548b-4b0a-ba56-13088637c1d5",
    "title": "Big Sciota",
    "artist": "Generation Gap",
    "feedUrl": "https://www.doerfelverse.com/feeds/generation-gap.xml",
    "feedTitle": "Generation Gap",
    "episodeId": 29726403424,
    "feedId": 7074495
  },
  {
    "feedGuid": "6eef0b66-bb86-5d0c-b260-099bcc920b7c",
    "itemGuid": "bd305f20-3c55-47b1-9722-6d68aeeaede7",
    "title": "Sensitive Guy",
    "artist": "Miles Fonda",
    "feedUrl": "https://www.doerfelverse.com/feeds/sensitive-guy.xml",
    "feedTitle": "Sensitive Guy",
    "episodeId": 29277505057,
    "feedId": 7053881
  },
  {
    "feedGuid": "545a3589-88e6-57c5-8448-bdc056cc3dfb",
    "itemGuid": "e7d7bf4f-811c-4644-9897-3f78cd2afa00",
    "title": "Secrets",
    "artist": "Jordan Dedo",
    "feedUrl": "https://www.doerfelverse.com/artists/jordandedo/secrets-single.xml",
    "feedTitle": "Secrets - Single",
    "episodeId": 29863899351,
    "feedId": 7080422
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "ae930ad6-5966-4033-b17f-b4e39519701d",
    "title": "Worth Fighting For",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492652,
    "feedId": 6642704
  },
  {
    "feedGuid": "5bb8f186-2460-54dc-911d-54f642e8adf6",
    "itemGuid": "f69cd5a5-2018-411b-afc1-00ab12142e83",
    "title": "You",
    "artist": "CityBeach",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml",
    "feedTitle": "CityBeach",
    "episodeId": 15573087569,
    "feedId": 6560745
  },
  {
    "feedGuid": "5bb8f186-2460-54dc-911d-54f642e8adf6",
    "itemGuid": "3c506193-5247-41bf-9d5d-6d8c7571142c",
    "title": "Safe",
    "artist": "CityBeach",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/CityBeach.xml",
    "feedTitle": "CityBeach",
    "episodeId": 15573087570,
    "feedId": 6560745
  },
  {
    "feedGuid": "66740bed-5dca-540f-98ff-0411593dab82",
    "itemGuid": "c660daaf-c499-4c36-af7c-f41171d9b612",
    "title": "Hallucinations",
    "artist": "Victoria Fragoso",
    "feedUrl": "https://www.wavlake.com/feed/24449797-c9b7-4151-a31a-8b9a74b1dd86",
    "feedTitle": "Hallucinations",
    "episodeId": 15574339381,
    "feedId": 6578496
  },
  {
    "feedGuid": "ec20d4ed-76c2-50dc-b4d9-0ba407f8cd81",
    "itemGuid": "55e1640d-5de7-448f-94ec-7cc2797e245a",
    "title": "Ordinary",
    "artist": "Tyson Froese",
    "feedUrl": "https://music.jimmyv4v.com/bands/tyson_froese/tyson_froese_collection/tyson_froese_collection-rss.xml",
    "feedTitle": "Tyson Froese - Songs",
    "episodeId": 27986794568,
    "feedId": 6776902
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "eb69c0a1-c8b3-4898-8eef-af496d04a4e5",
    "title": "Maybe It's You",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492658,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "caae8d61-bedd-40d9-ad57-8c86c1509020",
    "title": "Make It",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 29226577249,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "58c9b50a-6d5f-4dcd-90ae-e3a76a9d2c0e",
    "title": "Sing For You",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492657,
    "feedId": 6642704
  },
  {
    "feedGuid": "b84c3345-55db-54e0-ac41-4b1cc6f3df67",
    "itemGuid": "6941fa17-0b82-4acf-aba0-79bdb219c98f",
    "title": "Pour Over",
    "artist": "CityBeach",
    "feedUrl": "https://www.doerfelverse.com/feeds/pour-over.xml",
    "feedTitle": "Pour Over",
    "episodeId": 19631378254,
    "feedId": 6811872
  },
  {
    "feedGuid": "bba99401-378c-5540-bf95-c456b3d4de26",
    "itemGuid": "804099cb-264f-42cc-8026-18f989c08f2b",
    "title": "So Far Away",
    "artist": "The Doerfels",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/So-Far-Away.xml",
    "feedTitle": "So Far Away",
    "episodeId": 15580771691,
    "feedId": 6567874
  },
  {
    "feedGuid": "69c634ad-afea-5826-ad9a-8e1f06d6470b",
    "itemGuid": "3e3d88cd-d20e-4999-9239-70a8c762749b",
    "title": "Worthy Lofi",
    "artist": "Kurtisdrums",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1.xml",
    "feedTitle": "Kurtisdrums",
    "episodeId": 18539322328,
    "feedId": 6560977
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "a58d266a-2421-4772-9ae9-83ebbeb80d79",
    "title": "Breakaway (demo)",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492645,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "fedb7f31-c90a-4aca-9ab8-87db350af674",
    "title": "Thought It Was Real",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492667,
    "feedId": 6642704
  },
  {
    "feedGuid": "2b62ef49-fcff-523c-b81a-0a7dde2b0609",
    "itemGuid": "be4da809-a7d3-42fb-aec9-7050144bf814",
    "title": "Morning Love",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/music-from-the-doerfelverse.xml",
    "feedTitle": "Music From The Doerfel-Verse",
    "episodeId": 20951492654,
    "feedId": 6642704
  },
  {
    "feedGuid": "1e7ed1fa-0456-5860-9b34-825d1335d8f8",
    "itemGuid": "5334a806-1c60-481e-a978-7577ce988b56",
    "title": "SWEATS",
    "artist": "CityBeach",
    "feedUrl": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Nostalgic.xml",
    "feedTitle": "Nostalgic",
    "episodeId": 15573087115,
    "feedId": 6560821
  },
  {
    "feedGuid": "d13eab76-a4c4-5e4b-a0fb-25ed1386bc51",
    "itemGuid": "58cf0bcf-bf66-46a1-8759-314def6d76e5",
    "title": "Possible",
    "artist": "The Doerfels",
    "feedUrl": "https://www.doerfelverse.com/feeds/possible.xml",
    "feedTitle": "Possible",
    "episodeId": 24076872504,
    "feedId": 6942961
  }
].filter(song => song.title && song.artist); // Filter out null titles/artists

// Import resolved audio URLs from the JSON file
const AUDIO_URL_MAP: { [key: string]: string } = {
  "Neon Hawk": "https://op3.dev/e,pg=3ae285ab-434c-59d8-aa2f-59c6129afb92/https://d12wklypp119aj.cloudfront.net/track/d8145cb6-97d9-4358-895b-2bf055d169aa.mp3",
  "Grey's Birthday": "https://op3.dev/e,pg=6fc2ad98-d4a8-5d70-9c68-62e9efc1209c/https://d12wklypp119aj.cloudfront.net/track/aad6e3b1-6589-4e22-b8ca-521f3d888263.mp3",
  "Smokestacks": "https://op3.dev/e,pg=dea01a9d-a024-5b13-84aa-b157304cd3bc/https://d12wklypp119aj.cloudfront.net/track/52007112-2772-42f9-957a-a93eaeedb222.mp3",
  "Hit the Target [Live in Amsterdam]": "https://op3.dev/e,pg=95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4/https://d12wklypp119aj.cloudfront.net/track/d79f242f-0651-4b12-be79-c2bac234cfde.mp3",
  "Lost Summer": "https://op3.dev/e,pg=3058af0c-1807-5732-9a08-9114675ef7d6/https://d12wklypp119aj.cloudfront.net/track/c51ecaa4-f237-4707-9c62-2de611820e4b.mp3",
  "Quiet Day": "https://op3.dev/e,pg=011c3a82-d716-54f7-9738-3d5fcacf65be/https://d12wklypp119aj.cloudfront.net/track/c2ba80cc-add9-42ad-9a8f-b490436826ae.mp3",
  "it can be erased": "https://op3.dev/e,pg=0ab5bc9d-c9fb-52f4-8b8c-64be5edf322f/https://d12wklypp119aj.cloudfront.net/track/7bc23b30-5d37-4e03-8256-543b7bf17ba8.mp3",
  "It's Christmastime Again! (lofi beats mix)": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi-christmastimeagain.mp3",
  "Leaving The Country": "https://op3.dev/e,pg=265706d5-d6a1-5e96-b4c8-5db454844254/https://d12wklypp119aj.cloudfront.net/track/fe6b1845-6b98-425d-aa07-9531474939de.mp3",
  "Hyssop Branches": "https://www.doerfelverse.com/tracks/01-hyssop-branches.mp3",
  "Bipolar": "https://www.doerfelverse.com/tracks/03-bipolar.mp3",
  "C.R.V.P.": "https://www.doerfelverse.com/tracks/08-crvp.mp3",
  "Breathe": "https://op3.dev/e,pg=de032037-63e0-5c6b-820d-13d4319a2b19/https://d12wklypp119aj.cloudfront.net/track/e046f9dd-aca3-4c7a-b396-2148a90ac0f2.mp3",
  "Going Gold": "https://op3.dev/e,pg=377602c1-b049-5c14-bddf-eb4e349bee5c/https://d12wklypp119aj.cloudfront.net/track/3634469f-61ad-4e42-97f2-f1335c6ad267.mp3",
  "Kid Yourself EP": "https://op3.dev/e,pg=de032037-63e0-5c6b-820d-13d4319a2b19/https://d12wklypp119aj.cloudfront.net/track/24f655ae-8918-4089-8f2c-4c5ef612088b.mp3",
  "Endless Deja Vu": "https://op3.dev/e,pg=092e8cd8-6f44-5189-b574-9c0a5881b334/https://d12wklypp119aj.cloudfront.net/track/35e81e15-6820-4f83-9a3d-4ef2cf0da14b.mp3",
  "Kid Yourself": "https://op3.dev/e,pg=e1e1fed5-4ca3-55b0-9370-182287ec24e5/https://d12wklypp119aj.cloudfront.net/track/86a439b0-6b51-46a4-86f3-2490b7ca34ad.mp3",
  "Luv Song 4 U": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/LuvSong4U.mp3",
  "Through The Mic": "https://www.doerfelverse.com/artists/elijahlied/throughthemic/through-the-mic.mp3",
  "Hiding vs. Bad News": "https://op3.dev/e,pg=18843839-f79f-5b22-a842-241d0f6b12ea/https://d12wklypp119aj.cloudfront.net/track/7bf430ff-6f92-4b44-bd3e-c4d0366e7508.mp3",
  "Better Days": "https://op3.dev/e,pg=57203632-2003-55d2-b710-c699db963f18/https://d12wklypp119aj.cloudfront.net/track/1f7e025c-e8f7-4e10-b12b-9715c9c460c7.mp3",
  "All We Know": "https://op3.dev/e,pg=5d5be024-321d-5342-838e-988d1653296b/https://d12wklypp119aj.cloudfront.net/track/191c7fee-5fde-4bdd-96c3-d7af3b4b8585.mp3",
  "Night Shift": "https://www.doerfelverse.com/tracks/night-shift.mp3",
  "Smell the Roses": "https://op3.dev/e,pg=82235f8b-da8c-52a5-ba6b-1f11c199f526/https://d12wklypp119aj.cloudfront.net/track/c6e47574-4fcd-4a56-b2df-9e404a556d15.mp3",
  "What Did You Mean (When You Said Love) [Live in London and Amsterdam]": "https://op3.dev/e,pg=95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4/https://d12wklypp119aj.cloudfront.net/track/bfe9ed47-ac2a-4fc6-be19-6ab94f75c4c4.mp3",
  "Inside Out": "https://www.doerfelverse.com/artists/middleseason/inside-out.mp3",
  "Autumn": "https://www.doerfelverse.com/tracks/autumn.mp3",
  "As Long As It's Rock": "https://music.behindthesch3m3s.com/wp-content/uploads/2023/07/Tempest_As-Long-As-Its-Rock.mp3",
  "The HeyCitizen Experience - Love Song 4 U": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/HeyCitizen/02_Love%20Song%204%20U_HeyCitizen_Sat%20Skirmish.wav.mp3",
  "The Lightning": "https://op3.dev/e,pg=1b59e954-db0a-5096-8116-2ef3638cbb66/media.rssblue.com/podcasts/the-lightning/the-lightning/audio.the-lightning-the-trusted.mp3",
  "Trailer": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/sproutingsymphonies/lavish%20heycitizen%20trailer.mp3",
  "Animosity": "https://www.doerfelverse.com/tracks/animosity.mp3",
  "West Coast Drive": "https://op3.dev/e,pg=0ca05681-c035-5e50-b538-6e42328f0dfd/https://d12wklypp119aj.cloudfront.net/track/454d3146-049c-49b1-b25e-c6551c083265.mp3",
  "Chasing Waterfalls": "https://op3.dev/e,pg=f314df41-22c1-5fde-bc55-6f48e1625d96/https://d12wklypp119aj.cloudfront.net/track/2ebf7868-7696-4520-9c9c-ff4900978427.mp3",
  "Call Me Medley": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/Kurtisdrums-V1_Call-Me-Medlay.mp3",
  "Empath Eyes - Apathy": "https://music.behindthesch3m3s.com/wp-content/uploads/Sat_Skirmish/Empath%20Eyes/03.%20Apathy%20-%20Empath%20Eyes.mp3",
  "Bullet Train": "https://op3.dev/e,pg=999c4870-396c-5a6b-b22e-4c05ee46127d/https://d12wklypp119aj.cloudfront.net/track/3f239db2-6d3c-4164-86c0-92c84f5caafa.mp3",
  "Mrs Valentine": "https://op3.dev/e,pg=85e076c0-d4e3-5ae4-9586-0ab862dadf64/https://d12wklypp119aj.cloudfront.net/track/8e175c89-437c-4543-ae0a-aba553da0e05.mp3",
  "Once Had A Girl": "https://www.thisisjdog.com/media/once-had-a-girl.mp3",
  "Porkchops Fried": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PorkchopsFried.mp3",
  "Not To Worry": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/NotToWorry.mp3",
  "The Platform (lofi beats mix)": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi-platform.mp3",
  "The Platform": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/ThePlatform.mp3",
  "I Want Love": "https://op3.dev/e/ipfspodcasting.net/e/music.jimmyv4v.com/bands/blackstone-valley/blackstone-valley-collection/blackstone_valley-i-want-love.mp3",
  "Ring That Bell": "https://www.thisisjdog.com/media/ring-that-bell.mp3",
  "Pour Me Some Water": "https://op3.dev/e/ipfspodcasting.net/e/music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/Pour_Me_Some_Water.mp3",
  "Give it Up": "https://op3.dev/e/ipfspodcasting.net/e/music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/give_it_up/give_it_up-jimmy_v.mp3",
  "Long As You're Loving Me": "https://www.doerfelverse.com/tracks/long-as-youre-loving-me.mp3",
  "I Believe": "https://op3.dev/e/ipfspodcasting.net/e/music.jimmyv4v.com/bands/jimmy-v/jimmy-v-collection/i_believe/i_believe-jimmy_v.mp3",
  "Stay Awhile (reprise)": "https://ableandthewolf.com/static/media/music/07_StayAwhileReprise.mp3",
  "Hard Work [Live in Amsterdam]": "https://op3.dev/e,pg=95e5f7a9-d88e-5e51-b2ae-f4b1865d19c4/https://d12wklypp119aj.cloudfront.net/track/3587c342-cd4a-481c-838c-de242e5beb0b.mp3",
  "This Pain I've Grown": "https://music.behindthesch3m3s.com/wp-content/uploads/2023/08/The-Death-of-Rock-and-Roll_This-Pain-Ive-Grown.mp3",
  "A Sight To See Remix": "https://op3.dev/e,pg=c76ef0a6-0181-5b9b-a4bc-dd85d4ed178b/https://d12wklypp119aj.cloudfront.net/track/fe393a12-8545-440d-b88b-64e6568936fc.mp3",
  "Honor You": "https://www.doerfelverse.com/tracks/honor-you.mp3",
  "All Apology (EP track)": "https://op3.dev/e,pg=70b4915d-0c0b-5f7a-9980-82831d2a9ba2/https://d12wklypp119aj.cloudfront.net/track/b9471140-0674-4884-bbb5-39ce9c4a000f.mp3",
  "St. Joan": "https://op3.dev/e,pg=52786c48-86b4-5fd9-b4fe-7b44dcc3e4ba/https://d12wklypp119aj.cloudfront.net/track/13468078-1a54-4b0e-92bc-2faea2999ae7.mp3",
  "Bringing Em Down": "https://op3.dev/e,pg=c8d77c9c-e661-5d79-8d5f-735cfe9a95b7/https://d12wklypp119aj.cloudfront.net/track/17249ca4-fc26-45bb-afa3-d86212c9b2f8.mp3",
  "Let Go (What's holding you back)": "https://www.doerfelverse.com/tracks/let-go.mp3",
  "Calibrating Broadcast...": "https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/01Mellow_Cassette_Calibrating%20Broadcast.mp3",
  "Radio Brigade": "https://music.behindthesch3m3s.com/wp-content/uploads/Mellow%20Cassette/Radio_Brigade/02Mellow_Cassette_Radio%20Brigade.mp3",
  "Hello Stranger feat. Helen Tess": "https://op3.dev/e,pg=b9ee4d5d-77e7-56a4-a195-397ae28a3dfe/https://d12wklypp119aj.cloudfront.net/track/e92721f0-4291-4b50-a621-f658d875e640.mp3",
  "A Chemical to Balance": "https://op3.dev/e,pg=beeeef0b-51e9-52ac-b8d7-9ed54d5be3b0/https://d12wklypp119aj.cloudfront.net/track/8ed4bcfe-a4f9-42a7-9529-d30c3d634656.mp3",
  "Emma Rose": "https://www.doerfelverse.com/tracks/emma-rose.mp3",
  "They Don't Know": "https://www.doerfelverse.com/tracks/theydontknow.mp3",
  "Possible": "https://www.doerfelverse.com/tracks/possible.mp3",
  "What Love Is": "https://www.doerfelverse.com/tracks/what-love-is.mp3",
  "Bad People": "https://op3.dev/e,pg=537df90e-0cc4-535b-84d0-dcb3ca87f1f8/https://d12wklypp119aj.cloudfront.net/track/33932ccc-c707-411b-b914-4e9a94ec7e89.mp3",
  "Hardware Store Lady": "https://www.hogstory.net/uploads/hardware_store_lady.mp3",
  "That's How It Goes": "https://backend-api.justcast.com/public_feeds/true-blue/episodes/1246165.mp3",
  "Out of the Blue": "https://backend-api.justcast.com/public_feeds/peace-pieces/episodes/1248738.mp3",
  "The Poet Barfly - Demo": "https://op3.dev/e,pg=70456036-6a9c-5165-8fa7-84352259d602/https://d12wklypp119aj.cloudfront.net/track/ba10024a-d040-4b31-b61d-ea1fca19387d.mp3",
  "Kerouac": "https://whitetriangles.com/Music/kerouac.mp3",
  "I Do It Cuz It's Bad": "https://op3.dev/e,pg=bcd811d1-9fda-51d9-b2a6-9337f0131b66/https://d12wklypp119aj.cloudfront.net/track/ddc7dff4-121b-43ac-81b2-74c9ab618e59.mp3",
  "Beer Run": "https://op3.dev/e,pg=7a0735a7-c2d2-5e2c-ad5a-8586a62bfc93/https://d12wklypp119aj.cloudfront.net/track/3a5a784f-642f-41ab-b552-8c710415b8c6.mp3",
  "Girls at Kroger": "https://op3.dev/e,pg=1ef2b1d6-c4c0-5ef5-b534-bfc025e4193e/media.rssblue.com/podcasts/girls-at-kroger/girls-at-kroger/audio.girls-at-kroger.mp3",
  "Midnight Comin'": "https://op3.dev/e,pg=d3e9bb7a-3df8-5b7e-8f52-0b01decf2b66/https://d12wklypp119aj.cloudfront.net/track/360106a8-ddd8-4ee3-8bdf-2ef967b400ab.mp3",
  "If I Promise(Demo)": "https://www.doerfelverse.com/tracks/if-i-promise-demo-version.mp3",
  "Phatty The Grasshopper": "https://www.doerfelverse.com/tracks/phatty-the-grasshopper.mp3",
  "Railroad Tracks": "https://op3.dev/e,pg=babd1567-2803-5ede-9a19-302c2fbf9eae/https://d12wklypp119aj.cloudfront.net/track/a2bf5272-8811-4882-aa39-a730c290af4d.mp3",
  "Wonder Woman": "https://op3.dev/e,pg=2ec344a8-d756-5f8f-bde1-8a034321f1cb/https://d12wklypp119aj.cloudfront.net/track/c341b8f3-28b7-43c2-baff-b59eb6d8de8b.mp3",
  "Now I Know": "https://www.doerfelverse.com/tracks/now-i-know.mp3",
  "What's Your New Love Like": "https://op3.dev/e,pg=87ef86af-9d75-5876-97f9-5ea46e6094f7/https://d12wklypp119aj.cloudfront.net/track/eab9f1bd-94da-4c3c-afa7-3b4bc0c50c70.mp3",
  "Pay The Bills": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PayTheBills.mp3",
  "Feeling Bout You": "https://www.doerfelverse.com/tracks/feeling-bout-you.mp3",
  "Playing God": "https://www.doerfelverse.com/artists/opus/opus/02-playing-god.mp3",
  "That's the Life": "https://op3.dev/e,pg=028e9f67-e0fc-558f-b598-25f06179cea3/https://d12wklypp119aj.cloudfront.net/track/f6ee3774-c452-4e25-b8f4-c8330ff00f43.mp3",
  "Grow": "https://www.doerfelverse.com/tracks/yourchancealbum/06-grow.mp3",
  "Let You Down": "https://op3.dev/e,pg=82235f8b-da8c-52a5-ba6b-1f11c199f526/https://d12wklypp119aj.cloudfront.net/track/e580458f-ee8d-4674-b851-2e271cc3ff8e.mp3",
  "Happy New Year(demo)": "https://www.doerfelverse.com/tracks/happy-new-year-demo.mp3",
  "Change Your Mind": "https://op3.dev/e,pg=6335b366-6a83-5df4-ba62-d356ede08d70/https://d12wklypp119aj.cloudfront.net/track/62767045-5cc0-4280-a552-145a56e6964a.mp3",
  "That Duck": "https://music.behindthesch3m3s.com/wp-content/uploads/Sir%20Seat%20Sitter/That%20Duck.mp3",
  "Big Sciota": "https://www.doerfelverse.com/tracks/generationgap/02-big-sciota.mp3",
  "Sensitive Guy": "https://www.doerfelverse.com/tracks/sensitive-guy.mp3",
  "Secrets": "https://www.doerfelverse.com/artists/jordandedo/secrets.mp3",
  "Worth Fighting For": "https://www.doerfelverse.com/tracks/worth-fighting-for.mp3",
  "You": "https://www.doerfelverse.com/tracks/you.mp3",
  "Safe": "https://www.doerfelverse.com/tracks/safe.mp3",
  "Hallucinations": "https://op3.dev/e,pg=66740bed-5dca-540f-98ff-0411593dab82/https://d12wklypp119aj.cloudfront.net/track/c660daaf-c499-4c36-af7c-f41171d9b612.mp3",
  "Ordinary": "https://op3.dev/e/ipfspodcasting.net/e/music.jimmyv4v.com/bands/tyson_froese/tyson_froese_collection/tyson_froese-ordinary.mp3",
  "Maybe It's You": "https://www.doerfelverse.com/tracks/maybe-its-you.mp3",
  "Make It": "https://www.doerfelverse.com/tracks/make-it.mp3",
  "Sing For You": "https://www.doerfelverse.com/tracks/sing-for-you.mp3",
  "Pour Over": "https://www.doerfelverse.com/tracks/pour-over.mp3",
  "So Far Away": "https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/So-Far-Away_So-Far-Away.mp3",
  "Worthy Lofi": "https://www.doerfelverse.com/tracks/worthy-lofi.mp3",
  "Breakaway (demo)": "https://www.doerfelverse.com/tracks/breakaway-demo.mp3",
  "Thought It Was Real": "https://www.doerfelverse.com/tracks/thought-it-was-real.mp3",
  "Morning Love": "https://www.doerfelverse.com/tracks/morning-love.mp3",
  "SWEATS": "https://www.doerfelverse.com/tracks/sweats.mp3"
};

// Get real audio URL for a track title
function getStaticAudioUrl(title: string): string {
  // Return the actual resolved audio URL for this track
  return AUDIO_URL_MAP[title] || '';
}

// Generate realistic duration based on song characteristics
function generateRealisticDuration(song: any, index: number): number {
  // Create a deterministic seed from song data for consistent results
  const seed = (song.feedGuid?.charCodeAt(0) || 0) + 
               (song.itemGuid?.charCodeAt(0) || 0) + 
               (index * 7);
  
  // Different duration ranges based on song type/genre hints
  const title = song.title?.toLowerCase() || '';
  const artist = song.artist?.toLowerCase() || '';
  const feedTitle = song.feedTitle?.toLowerCase() || '';
  
  let baseRange = [180, 300]; // 3-5 minutes default
  
  // Adjust based on content clues
  if (title.includes('demo') || title.includes('reprise') || title.includes('(demo)')) {
    baseRange = [120, 240]; // 2-4 minutes for demos
  } else if (title.includes('live') || title.includes('[live') || feedTitle.includes('live')) {
    baseRange = [240, 420]; // 4-7 minutes for live performances
  } else if (title.includes('lofi') || artist.includes('lofi') || feedTitle.includes('lofi')) {
    baseRange = [150, 270]; // 2.5-4.5 minutes for lofi
  } else if (artist.includes('bluegrass') || feedTitle.includes('bluegrass')) {
    baseRange = [180, 360]; // 3-6 minutes for bluegrass
  } else if (title.length > 30 || feedTitle.includes('experience')) {
    baseRange = [210, 330]; // 3.5-5.5 minutes for longer titles/albums
  }
  
  // Generate duration using seed for consistency
  const range = baseRange[1] - baseRange[0];
  const random = ((seed * 9301 + 49297) % 233280) / 233280; // Simple PRNG
  const duration = Math.floor(baseRange[0] + (random * range));
  
  return duration;
}

export default function ITDVPlaylistAlbum() {
  // Add static audio URLs to tracks
  const tracksWithAudio = RESOLVED_SONGS.map((song, index) => ({
    ...song,
    audioUrl: getStaticAudioUrl(song.title)
  }));

  const config: PlaylistConfig = {
    name: 'Into The Doerfel-Verse',
    description: 'Music playlist from Into The Doerfel-Verse podcast',
    coverArt: 'https://www.doerfelverse.com/art/itdvchadf.png',
    // Disable resolution since we have static URLs
    resolveAudioUrls: false,
    showResolutionStatus: false
  };

  const handleTrackResolved = (track: any) => {
    console.log(`✅ ITDV track resolved: ${track.title} by ${track.artist}`);
  };

  return (
    <>
      <PlaylistAlbum 
        tracks={tracksWithAudio} 
        config={config} 
        onTrackResolved={handleTrackResolved}
      />
      
      {/* ITDV-specific footer */}
      <div className="mt-4 p-4 bg-gray-800/20 rounded-lg">
        <p className="text-sm text-gray-400">
          Into The Doerfel-Verse playlist powered by Podcasting 2.0 and Value for Value. 
          <a href="https://www.doerfelverse.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 ml-1 transition-colors">
            Visit Doerfel-Verse →
          </a>
        </p>
      </div>
    </>
  );
}