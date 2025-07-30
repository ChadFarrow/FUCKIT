1:"$Sreact.fragment"
2:I[4821,["9910","static/chunks/a4634e51-d4af25f22527e0a3.js","6874","static/chunks/6874-d27b54d0b28e3259.js","6766","static/chunks/6766-bbcb255d04691530.js","8984","static/chunks/8984-425525df254d75d1.js","7177","static/chunks/app/layout-8284469373c684e3.js"],"default"]
3:I[8984,["9910","static/chunks/a4634e51-d4af25f22527e0a3.js","6874","static/chunks/6874-d27b54d0b28e3259.js","6766","static/chunks/6766-bbcb255d04691530.js","8984","static/chunks/8984-425525df254d75d1.js","7177","static/chunks/app/layout-8284469373c684e3.js"],"AudioProvider"]
4:I[7555,[],""]
5:I[6678,["6874","static/chunks/6874-d27b54d0b28e3259.js","8039","static/chunks/app/error-fed893c1bf0bc7f3.js"],"default"]
6:I[1295,[],""]
7:I[6874,["6874","static/chunks/6874-d27b54d0b28e3259.js","4345","static/chunks/app/not-found-cccee4a9ca776a05.js"],""]
8:I[2415,["9910","static/chunks/a4634e51-d4af25f22527e0a3.js","6874","static/chunks/6874-d27b54d0b28e3259.js","6766","static/chunks/6766-bbcb255d04691530.js","8984","static/chunks/8984-425525df254d75d1.js","7177","static/chunks/app/layout-8284469373c684e3.js"],"default"]
9:I[4304,["9910","static/chunks/a4634e51-d4af25f22527e0a3.js","6874","static/chunks/6874-d27b54d0b28e3259.js","6766","static/chunks/6766-bbcb255d04691530.js","8984","static/chunks/8984-425525df254d75d1.js","7177","static/chunks/app/layout-8284469373c684e3.js"],"ToastContainer"]
a:I[5369,["9910","static/chunks/a4634e51-d4af25f22527e0a3.js","6874","static/chunks/6874-d27b54d0b28e3259.js","6766","static/chunks/6766-bbcb255d04691530.js","8984","static/chunks/8984-425525df254d75d1.js","7177","static/chunks/app/layout-8284469373c684e3.js"],"default"]
f:I[8393,[],""]
:HL["/_next/static/media/e4af272ccee01ff0-s.p.woff2","font",{"crossOrigin":"","type":"font/woff2"}]
:HL["/_next/static/css/2efc0053cd088b58.css","style"]
b:T671,
              // Cache busting and error prevention script
              (function() {
                console.log('🔧 Cache busting script loaded');
                
                // Prevent infinite recursion by limiting function calls
                let recursionCount = 0;
                const maxRecursion = 100;
                
                // Override console.error to catch recursion errors
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('too much recursion')) {
                    recursionCount++;
                    if (recursionCount > maxRecursion) {
                      console.warn('🛑 Too many recursion errors, stopping error logging');
                      return;
                    }
                    console.warn('🔄 Recursion error detected, count:', recursionCount);
                  }
                  originalError.apply(console, args);
                };
                
                // Clear any problematic state
                if (typeof window !== 'undefined') {
                  // Clear any cached audio contexts
                  if (window.audioContextCache) {
                    delete window.audioContextCache;
                  }
                  
                  // Force garbage collection if available
                  if (window.gc) {
                    window.gc();
                  }
                }
                
                console.log('✅ Cache busting script initialized');
              })();
            0:{"P":null,"b":"l3rkext0k9EWZ752x-jlU","p":"","c":["","test-mobile-images"],"i":false,"f":[[["",{"children":["test-mobile-images",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/2efc0053cd088b58.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"en","children":["$","body",null,{"className":"__className_e8ce0c","children":[["$","$L2",null,{"children":["$","$L3",null,{"children":[["$","div",null,{"className":"min-h-screen bg-gray-50","children":["$","$L4",null,{"parallelRouterKey":"children","error":"$5","errorStyles":[],"errorScripts":[],"template":["$","$L6",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","div",null,{"className":"min-h-screen bg-gray-950 flex items-center justify-center px-4","children":["$","div",null,{"className":"max-w-md w-full bg-gray-900 rounded-lg shadow-lg p-8 text-center","children":[["$","div",null,{"className":"flex justify-center mb-4","children":["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":2,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-search h-16 w-16 text-blue-500","children":[["$","circle","4ej97u",{"cx":"11","cy":"11","r":"8"}],["$","path","1qie3q",{"d":"m21 21-4.3-4.3"}],"$undefined"]}]}],["$","h1",null,{"className":"text-2xl font-bold text-white mb-2","children":"Page Not Found"}],["$","p",null,{"className":"text-gray-400 mb-6","children":"The page you're looking for doesn't exist or has been moved."}],["$","div",null,{"className":"flex flex-col sm:flex-row gap-3 justify-center","children":["$","$L7",null,{"href":"/","className":"flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors","children":[["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":2,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-home h-4 w-4","children":[["$","path","y5dka4",{"d":"m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}],["$","polyline","e2us08",{"points":"9 22 9 12 15 12 15 22"}],"$undefined"]}],"Go Home"]}]}]]}]}],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]}],["$","$L8",null,{}],["$","$L9",null,{}]]}]}],["$","$La",null,{}],["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$b"}}]]}]}]]}],{"children":["test-mobile-images","$Lc",{"children":["__PAGE__","$Ld",{},null,false]},null,false]},null,false],"$Le",false]],"m":"$undefined","G":["$f",[]],"s":false,"S":true}
10:I[894,[],"ClientPageRoot"]
11:I[995,["6766","static/chunks/6766-bbcb255d04691530.js","9049","static/chunks/app/test-mobile-images/page-1948e517fe6634b3.js"],"default"]
14:I[9665,[],"OutletBoundary"]
16:I[4911,[],"AsyncMetadataOutlet"]
18:I[9665,[],"ViewportBoundary"]
1a:I[9665,[],"MetadataBoundary"]
1b:"$Sreact.suspense"
c:["$","$1","c",{"children":[null,["$","$L4",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L6",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}]
d:["$","$1","c",{"children":[["$","$L10",null,{"Component":"$11","searchParams":{},"params":{},"promises":["$@12","$@13"]}],null,["$","$L14",null,{"children":["$L15",["$","$L16",null,{"promise":"$@17"}]]}]]}]
e:["$","$1","h",{"children":[null,[["$","$L18",null,{"children":"$L19"}],["$","meta",null,{"name":"next-size-adjust","content":""}]],["$","$L1a",null,{"children":["$","div",null,{"hidden":true,"children":["$","$1b",null,{"fallback":null,"children":"$L1c"}]}]}]]}]
12:{}
13:"$d:props:children:0:props:params"
19:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"}],["$","meta","2",{"name":"theme-color","content":"#1f2937"}]]
15:null
1d:I[8175,[],"IconMark"]
17:{"metadata":[["$","title","0",{"children":"DoerfelVerse - Music & Podcast Hub"}],["$","meta","1",{"name":"description","content":"Discover and listen to music and podcasts from the Doerfel family and friends"}],["$","link","2",{"rel":"manifest","href":"/manifest.json","crossOrigin":"$undefined"}],["$","meta","3",{"name":"apple-mobile-web-app-capable","content":"yes"}],["$","meta","4",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","meta","5",{"name":"apple-mobile-web-app-title","content":"DoerfelVerse"}],["$","meta","6",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","7",{"name":"format-detection","content":"telephone=no"}],["$","meta","8",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","9",{"name":"apple-mobile-web-app-title","content":"DoerfelVerse"}],["$","link","10",{"href":"/apple-touch-icon.png","media":"(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)","rel":"apple-touch-startup-image"}],["$","meta","11",{"name":"apple-mobile-web-app-status-bar-style","content":"black-translucent"}],["$","link","12",{"rel":"icon","href":"/favicon-16x16.png","sizes":"16x16","type":"image/png"}],["$","link","13",{"rel":"icon","href":"/favicon-32x32.png","sizes":"32x32","type":"image/png"}],["$","link","14",{"rel":"icon","href":"/icon-192x192.png","sizes":"192x192","type":"image/png"}],["$","link","15",{"rel":"icon","href":"/icon-512x512.png","sizes":"512x512","type":"image/png"}],["$","link","16",{"rel":"apple-touch-icon","href":"/apple-touch-icon.png","sizes":"180x180","type":"image/png"}],["$","link","17",{"rel":"apple-touch-icon","href":"/apple-touch-icon-152x152.png","sizes":"152x152","type":"image/png"}],["$","link","18",{"rel":"apple-touch-icon","href":"/apple-touch-icon-144x144.png","sizes":"144x144","type":"image/png"}],["$","link","19",{"rel":"apple-touch-icon","href":"/apple-touch-icon-120x120.png","sizes":"120x120","type":"image/png"}],["$","link","20",{"rel":"apple-touch-icon","href":"/apple-touch-icon-76x76.png","sizes":"76x76","type":"image/png"}],["$","$L1d","21",{}]],"error":null,"digest":"$undefined"}
1c:"$17:metadata"
