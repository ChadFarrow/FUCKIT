(()=>{var a={};a.id=4015,a.ids=[4015],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4565:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z});var e=c(96559),f=c(48088),g=c(37719),h=c(26191),i=c(81289),j=c(261),k=c(92603),l=c(39893),m=c(14823),n=c(47220),o=c(66946),p=c(47912),q=c(99786),r=c(46143),s=c(86439),t=c(43365),u=c(32190),v=c(29021),w=c(33873);function x(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function y(a){let b=a.split(":").map(a=>parseInt(a)),c=0;return 2===b.length?c=60*b[0]+b[1]:3===b.length&&(c=3600*b[0]+60*b[1]+b[2]),c.toString()}async function z(a){try{let b=a.nextUrl.searchParams,c=b.get("feedId"),d=b.get("format")||"rss",e=(0,w.join)(process.cwd(),"data","parsed-feeds.json"),f=(0,v.readFileSync)(e,"utf8"),g=JSON.parse(f),h=c?g.feeds.filter(a=>a.id===c):g.feeds;if(c||(h=h.filter(a=>"intothedoerfelverse"!==a.id||(console.log(`🎵 Excluding podcast feed from general playlist: ${a.title}`),!1))),"intothedoerfelverse"===c){let a=[],b=1;for(let c of h)if(c.parsedData?.album?.tracks)for(let d of c.parsedData.album.tracks){let e=d.title.match(/Episode (\d+)/)?.[1];if(e)try{let f=`https://www.doerfelverse.com/chapters/dvep${e}.json`,g=await fetch(f);if(g.ok){let f=await g.json(),h=f.chapters.filter(a=>!a.title.includes("Episode")&&!a.title.includes("episode")&&!a.title.includes("Into The Doerfel-Verse")&&!a.title.includes("Doerfel-Jukebox")&&""!==a.title.trim()&&a.startTime>0);for(let g=0;g<h.length;g++){let i=h[g],j=h[g+1]||f.chapters[f.chapters.findIndex(a=>a===i)+1],k=Math.floor(i.startTime),l=j?Math.floor(j.startTime):Math.floor(i.startTime)+180,m=l-k;if(m<=0){console.log(`⚠️ Skipping track "${i.title}" with invalid duration: ${m}s`);continue}let n=Math.floor(m/60),o=m%60,p=`${n}:${o.toString().padStart(2,"0")}`;a.push({title:i.title,duration:p,url:`${d.url}#t=${k},${l}`,trackNumber:b++,subtitle:`From ${d.title}`,summary:`Music segment from ${d.title} at ${Math.floor(k/60)}:${(k%60).toString().padStart(2,"0")}`,image:i.img||d.image,explicit:!1,albumTitle:c.parsedData.album.title,albumArtist:c.parsedData.album.artist||"The Doerfels",albumCoverArt:i.img||c.parsedData.album.coverArt,feedId:c.id,globalTrackNumber:b-1,episodeTitle:d.title,episodeNumber:parseInt(e),startTime:k,endTime:l})}}}catch(a){console.error(`Failed to fetch chapters for episode ${e}:`,a)}}if(a.sort((a,b)=>a.episodeNumber!==b.episodeNumber?a.episodeNumber-b.episodeNumber:a.startTime-b.startTime),a.forEach((a,b)=>{a.trackNumber=b+1,a.globalTrackNumber=b+1}),"json"===d)return u.NextResponse.json({title:"Into The Doerfel-Verse - Music Segments",description:"Music tracks played during Into The Doerfel-Verse podcast episodes, extracted from chapter markers",tracks:a,totalTracks:a.length,feedId:c});let e=new Date().toUTCString(),f=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${x("Into The Doerfel-Verse - Music Segments")}</title>
    <description>Music tracks played during Into The Doerfel-Verse podcast episodes, extracted from chapter markers</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${e}</pubDate>
    <lastBuildDate>${e}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>doerfelverse-music-segments-2025</podcast:guid>
    
    <itunes:author>The Doerfels</itunes:author>
    <itunes:summary>Music tracks played during Into The Doerfel-Verse podcast episodes</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="Music" />
    <itunes:image href="https://www.doerfelverse.com/art/itdvchadf.png" />
    
    ${a.map((a,b)=>`
    <item>
      <title>${x(a.title)} - ${x(a.albumArtist)}</title>
      <description>From "${x(a.episodeTitle)}" at ${Math.floor(a.startTime/60)}:${(a.startTime%60).toString().padStart(2,"0")}</description>
      <guid isPermaLink="false">doerfelverse-music-segment-${a.globalTrackNumber}</guid>
      <pubDate>${new Date(Date.now()-36e5*b).toUTCString()}</pubDate>
      
      <enclosure url="${x(a.url)}" type="audio/mpeg" length="0" />
      
      <podcast:track>${a.globalTrackNumber}</podcast:track>
      ${a.image?`<podcast:images srcset="${x(a.image)} 3000w" />`:""}
      
      <itunes:title>${x(a.title)}</itunes:title>
      <itunes:artist>${x(a.albumArtist)}</itunes:artist>
      <itunes:album>${x(a.albumTitle)}</itunes:album>
      <itunes:duration>${y(a.duration)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${a.image?`<itunes:image href="${x(a.image)}" />`:""}
      
      <content:encoded><![CDATA[
        <p>Track: ${x(a.title)}</p>
        <p>Artist: ${x(a.albumArtist)}</p>
        <p>From: ${x(a.episodeTitle)}</p>
        <p>Time: ${Math.floor(a.startTime/60)}:${(a.startTime%60).toString().padStart(2,"0")} - ${Math.floor(a.endTime/60)}:${(a.endTime%60).toString().padStart(2,"0")}</p>
      ]]></content:encoded>
    </item>`).join("")}
  </channel>
</rss>`;return new u.NextResponse(f,{headers:{"Content-Type":"application/rss+xml; charset=utf-8","Cache-Control":"public, max-age=3600"}})}let i=[],j=1;h.forEach(a=>{a.parsedData?.album?.tracks&&a.parsedData.album.tracks.forEach(b=>{let c=b.duration.split(":").map(a=>parseInt(a)),d=0;if(2===c.length?d=60*c[0]+c[1]:3===c.length&&(d=3600*c[0]+60*c[1]+c[2]),d>900||b.title.toLowerCase().includes("episode"))return void console.log(`🎵 Filtering out podcast episode: "${b.title}" (${b.duration})`);i.push({...b,albumTitle:a.parsedData.album.title,albumArtist:a.parsedData.album.artist||"Various Artists",albumCoverArt:a.parsedData.album.coverArt,feedId:a.id,globalTrackNumber:j++})})});for(let a=i.length-1;a>0;a--){let b=Math.floor(Math.random()*(a+1));[i[a],i[b]]=[i[b],i[a]]}if("json"===d)return u.NextResponse.json({title:c?`${h[0]?.title||"Selected"} - Playlist`:"Project StableKraft - All Songs Playlist",description:c?`All songs from ${h[0]?.title||"the selected feed"}`:"A complete playlist of all songs from Project StableKraft",tracks:i,totalTracks:i.length,feedId:c||null});let k=new Date().toUTCString(),l=c&&h.length>0?`${h[0].title} - Playlist`:"Project StableKraft - All Songs Playlist",m=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${x(l)}</title>
    <description>${x(c?`All songs from ${h[0]?.title||"the selected feed"}`:"A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.")}</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${k}</pubDate>
    <lastBuildDate>${k}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <!-- Podcasting 2.0 Tags -->
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>stablekraft-all-songs-playlist-2025</podcast:guid>
    
    <!-- iTunes Tags -->
    <itunes:author>${x(c&&h.length>0&&h[0].parsedData?.album?.artist||"Project StableKraft")}</itunes:author>
    <itunes:summary>${x(c?`All songs from ${h[0]?.title||"the selected feed"}`:"A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.")}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>Project StableKraft</itunes:name>
      <itunes:email>contact@project-stablekraft.com</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Music" />
    <itunes:image href="https://www.doerfelverse.com/art/carol-of-the-bells.png" />
    
    <!-- Image -->
    <image>
      <url>${x(c&&h.length>0&&h[0].parsedData?.album?.coverArt?h[0].parsedData.album.coverArt:"https://www.doerfelverse.com/art/carol-of-the-bells.png")}</url>
      <title>${x(l)}</title>
      <link>https://project-stablekraft.com</link>
    </image>
    
    ${i.map((a,b)=>`
    <item>
      <title>${x(a.title)} - ${x(a.albumArtist)}</title>
      <description>From the album "${x(a.albumTitle)}" by ${x(a.albumArtist)}</description>
      <guid isPermaLink="false">stablekraft-playlist-track-${a.globalTrackNumber}</guid>
      <pubDate>${new Date(Date.now()-36e5*b).toUTCString()}</pubDate>
      
      <enclosure url="${x(a.url)}" type="audio/mpeg" length="0" />
      
      <!-- Podcasting 2.0 Tags -->
      <podcast:track>${a.globalTrackNumber}</podcast:track>
      ${a.image?`<podcast:images srcset="${x(a.image)} 3000w" />`:""}
      
      <!-- iTunes Tags -->
      <itunes:title>${x(a.title)}</itunes:title>
      <itunes:artist>${x(a.albumArtist)}</itunes:artist>
      <itunes:album>${x(a.albumTitle)}</itunes:album>
      <itunes:duration>${y(a.duration)}</itunes:duration>
      <itunes:explicit>${a.explicit?"true":"false"}</itunes:explicit>
      ${a.image?`<itunes:image href="${x(a.image)}" />`:""}
      
      <content:encoded><![CDATA[
        <p>Track: ${x(a.title)}</p>
        <p>Artist: ${x(a.albumArtist)}</p>
        <p>Album: ${x(a.albumTitle)}</p>
        ${a.summary?`<p>${x(a.summary)}</p>`:""}
      ]]></content:encoded>
    </item>`).join("")}
  </channel>
</rss>`;return new u.NextResponse(m,{headers:{"Content-Type":"application/rss+xml; charset=utf-8","Cache-Control":"public, max-age=3600"}})}catch(a){return console.error("Error generating playlist:",a),u.NextResponse.json({error:"Failed to generate playlist"},{status:500})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/playlist/route",pathname:"/api/playlist",filename:"route",bundlePath:"app/api/playlist/route"},distDir:".next",projectDir:"",resolvedPagePath:"/Users/chad-mini/Vibe/apps/FUCKIT/app/api/playlist/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/playlist/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:"false"});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{dynamicIO:!!w.experimental.dynamicIO,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},78335:()=>{},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4985,6055],()=>b(b.s=4565));module.exports=c})();