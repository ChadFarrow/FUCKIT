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
    "revision": "7222398be0e93a5598d17d27a67f94bc"
  }, {
    "url": "/_next/build-manifest.json",
    "revision": "7a171affcdfa17fe8c82235b5cdc45a7"
  }, {
    "url": "/_next/react-loadable-manifest.json",
    "revision": "556b8653df7588485f9c298b1f1e3390"
  }, {
    "url": "/_next/server/middleware-build-manifest.js",
    "revision": "ea0aab4189e8b54c9e23d68ec9a01da8"
  }, {
    "url": "/_next/server/middleware-react-loadable-manifest.js",
    "revision": "8b457e3de7771163daebbb633717f3b0"
  }, {
    "url": "/_next/server/next-font-manifest.js",
    "revision": "8b814f56062a52e63f9fe54bb63ecf79"
  }, {
    "url": "/_next/server/next-font-manifest.json",
    "revision": "705ea294a39b0b15310687c6789e131b"
  }, {
    "url": "/_next/static/chunks//_error.js",
    "revision": "76d0f3525c6ca8e35d0da3356fda754a"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_AlbumCardLazy_tsx.js",
    "revision": "37825dd76266c518fd71f334d7c01b1e"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_AlbumCard_tsx.js",
    "revision": "60680a5fa8764f1eefe341ed86fda3ee"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_CDNImageLazy_tsx.js",
    "revision": "d9de070697493f22832baaa895de2b92"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_CDNImage_tsx.js",
    "revision": "6a06803297e22d4002c43e7e50cad607"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_ControlsBarLazy_tsx.js",
    "revision": "983d0417430ff4c5bc54d509ef0b5f49"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_components_ControlsBar_tsx.js",
    "revision": "4506513419bae79b292bd82bd8f853fe"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_data_hgh-artwork-urls_ts.js",
    "revision": "7fa92640f5c607cd3c87bbf996f5bb06"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_data_hgh-audio-urls_ts.js",
    "revision": "616877607c857fe629f21925d251ca19"
  }, {
    "url": "/_next/static/chunks/_app-pages-browser_data_hgh-resolved-songs_json.js",
    "revision": "202920869bd0bc2eb697595869744eaa"
  }, {
    "url": "/_next/static/chunks/app-pages-internals.js",
    "revision": "f5f81776f740358589e74f5c06d353c5"
  }, {
    "url": "/_next/static/chunks/app/error.js",
    "revision": "812da938d412c3291d23fa2dd81f16d8"
  }, {
    "url": "/_next/static/chunks/app/not-found.js",
    "revision": "6a952670c259e51a1aee875b55266368"
  }, {
    "url": "/_next/static/chunks/pages/_app.js",
    "revision": "411119a28969cf1a2f5c97a430474c9b"
  }, {
    "url": "/_next/static/chunks/pages/_error.js",
    "revision": "50d6eafc3c7b90fce46183e8023d58d2"
  }, {
    "url": "/_next/static/chunks/polyfills.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  }, {
    "url": "/_next/static/chunks/react-refresh.js",
    "revision": "101c0e35645529ee91315fcaffbddccb"
  }, {
    "url": "/_next/static/chunks/webpack.js",
    "revision": "5b46aa780b1d9bdd2e855ba7de53f2b3"
  }, {
    "url": "/_next/static/css/app/layout.css",
    "revision": "920b0c5652d285ef2f10739696a296ba"
  }, {
    "url": "/_next/static/development/_buildManifest.js",
    "revision": "bc359c6db1aab0d45919c5a1108ae213"
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
    "url": "/_next/static/webpack/d1a6285331ff9f40.webpack.hot-update.json",
    "revision": "development"
  }, {
    "url": "/_next/static/webpack/webpack.d1a6285331ff9f40.hot-update.js",
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
