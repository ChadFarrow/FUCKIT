/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-c008c882'], (function (workbox) { 'use strict';

  importScripts();
  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "/_next/app-build-manifest.json",
    "revision": "78fc6ba0f1afd8d374be01c940cd8b63"
  }, {
    "url": "/_next/build-manifest.json",
    "revision": "35f1562458fde1518b2c9808eefc3fc1"
  }, {
    "url": "/_next/react-loadable-manifest.json",
    "revision": "f82df41fadb3b5209a237dcac14babd5"
  }, {
    "url": "/_next/server/middleware-build-manifest.js",
    "revision": "4dc6647f58dedfc99e331e8429e885a0"
  }, {
    "url": "/_next/server/middleware-react-loadable-manifest.js",
    "revision": "b85a5b13797e184511198d0103890b2a"
  }, {
    "url": "/_next/server/next-font-manifest.js",
    "revision": "9f6af5cc971130478cc68f4693f9cc0a"
  }, {
    "url": "/_next/server/next-font-manifest.json",
    "revision": "31d3fd11c096a34ea94b78429df9d333"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_AlbumCardLazy_tsx.js",
    "revision": "5a94953d6cf463cc551939e8e7db0ab9"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_AlbumCard_tsx.js",
    "revision": "cae474fccd66169e78ed5100c460fb16"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_CDNImageLazy_tsx.js",
    "revision": "caca7794f76692eb5e981699334f6824"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_CDNImage_tsx.js",
    "revision": "18d50aa6042b6670294279daeab9ecb7"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_ControlsBarLazy_tsx.js",
    "revision": "73e97dd1027d02c1187cd237e7af28ff"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_ControlsBar_tsx.js",
    "revision": "a8f972b21f0423b990e4d8d375b2cf5d"
  }, {
    "url": "/_next/static/chunks/app-pages-internals.js",
    "revision": "fb0637ba838736a9dde4853f3c39f41a"
  }, {
    "url": "/_next/static/chunks/app/error.js",
    "revision": "0538a3b770f7f4192e5b02ae8fa00ed0"
  }, {
    "url": "/_next/static/chunks/app/not-found.js",
    "revision": "3fd88d9fdbc627c8cca3b9f18559cda5"
  }, {
    "url": "/_next/static/chunks/polyfills.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  }, {
    "url": "/_next/static/chunks/webpack.js",
    "revision": "9e6004ec86fde5ca8a8262311d2e720f"
  }, {
    "url": "/_next/static/css/app/layout.css",
    "revision": "53eebb614cc0f2127229276a1ebb7637"
  }, {
    "url": "/_next/static/development/_buildManifest.js",
    "revision": "97f1258b3dd30d37ba33a4c4ed741eed"
  }, {
    "url": "/_next/static/development/_ssgManifest.js",
    "revision": "abee47769bf307639ace4945f9cfd4ff"
  }, {
    "url": "/_next/static/media/26a46d62cd723877-s.woff2",
    "revision": "befd9c0fdfa3d8a645d5f95717ed6420"
  }, {
    "url": "/_next/static/media/55c55f0601d81cf3-s.woff2",
    "revision": "43828e14271c77b87e3ed582dbff9f74"
  }, {
    "url": "/_next/static/media/581909926a08bbc8-s.woff2",
    "revision": "f0b86e7c24f455280b8df606b89af891"
  }, {
    "url": "/_next/static/media/8e9860b6e62d6359-s.woff2",
    "revision": "01ba6c2a184b8cba08b0d57167664d75"
  }, {
    "url": "/_next/static/media/97e0cb1ae144a2a9-s.woff2",
    "revision": "e360c61c5bd8d90639fd4503c829c2dc"
  }, {
    "url": "/_next/static/media/df0a9ae256c0569c-s.woff2",
    "revision": "d54db44de5ccb18886ece2fda72bdfe0"
  }, {
    "url": "/_next/static/media/e4af272ccee01ff0-s.woff2",
    "revision": "65850a373e258f1c897a2b3d75eb74de"
  }, {
    "url": "/_next/static/webpack/633457081244afec._.hot-update.json",
    "revision": "development"
  }], {
    "ignoreURLParametersMatching": [/ts/]
  });
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute("/", new workbox.NetworkFirst({
    "cacheName": "start-url",
    plugins: [{
      cacheWillUpdate: async ({
        request,
        response,
        event,
        state
      }) => {
        if (response && response.type === 'opaqueredirect') {
          return new Response(response.body, {
            status: 200,
            statusText: 'OK',
            headers: response.headers
          });
        }
        return response;
      }
    }]
  }), 'GET');
  workbox.registerRoute(/.*/i, new workbox.NetworkOnly({
    "cacheName": "dev",
    plugins: []
  }), 'GET');

}));
