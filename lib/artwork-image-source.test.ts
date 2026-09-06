import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveArtworkSource, unwrapProxyUrl, artworkBaseUrl } from './artwork-image-source';

const BASE = 'http://localhost:8080';

test('unwrapProxyUrl: pulls the target out of our proxy wrapper', () => {
  assert.equal(
    unwrapProxyUrl('/api/proxy-image?url=' + encodeURIComponent('https://cdn.wavlake.com/a.png')),
    'https://cdn.wavlake.com/a.png'
  );
  assert.equal(
    unwrapProxyUrl('http://localhost:8080/api/proxy-image?url=' + encodeURIComponent('https://x.com/b.jpg')),
    'https://x.com/b.jpg'
  );
  // Extra parameters after the target must not be swallowed into it.
  assert.equal(
    unwrapProxyUrl('/api/proxy-image?url=' + encodeURIComponent('https://x.com/c.png') + '&enhance=true'),
    'https://x.com/c.png'
  );
});

test('unwrapProxyUrl: leaves a plain URL alone', () => {
  assert.equal(unwrapProxyUrl('https://cdn.wavlake.com/a.png'), 'https://cdn.wavlake.com/a.png');
  assert.equal(unwrapProxyUrl('/stablekraft-rocket.png'), '/stablekraft-rocket.png');
  assert.equal(unwrapProxyUrl(''), '');
});

test('unwrapProxyUrl: malformed percent-encoding falls back to the raw parameter', () => {
  // Never fall back to the wrapper: its path is always /api/proxy-image, which
  // says nothing about the image. Same choice as isAnimatedArtworkUrl.
  assert.equal(unwrapProxyUrl('/api/proxy-image?url=%E0%A4%A'), '%E0%A4%A');
});

test('unwrapProxyUrl: a wrapper with no url parameter is not mangled', () => {
  assert.equal(unwrapProxyUrl('/api/proxy-image'), '/api/proxy-image');
  assert.equal(unwrapProxyUrl('/api/proxy-image?w=100'), '/api/proxy-image?w=100');
});

test('unwrapProxyUrl: a nested wrapper terminates instead of looping', () => {
  const once = '/api/proxy-image?url=' + encodeURIComponent('https://x.com/d.png');
  const twice = '/api/proxy-image?url=' + encodeURIComponent(once);
  assert.equal(unwrapProxyUrl(twice), 'https://x.com/d.png');
});

test('resolveArtworkSource: a public image is fetched directly, never through our own proxy', () => {
  assert.deepEqual(resolveArtworkSource('https://cdn.wavlake.com/a.png', BASE), {
    kind: 'remote',
    url: 'https://cdn.wavlake.com/a.png',
  });
  // The whole point: a wrapped URL resolves to the SAME direct fetch.
  assert.deepEqual(
    resolveArtworkSource('/api/proxy-image?url=' + encodeURIComponent('https://cdn.wavlake.com/a.png'), BASE),
    { kind: 'remote', url: 'https://cdn.wavlake.com/a.png' }
  );
});

test('resolveArtworkSource: an extensionless remote URL still resolves', () => {
  // The regression this guards. The old gate ran against the wrapper, whose
  // path contains "image", so it passed for everything. Gating the target on
  // isValidImageUrl instead would drop this one silently.
  assert.deepEqual(resolveArtworkSource('https://host.example/a/b/c123', BASE), {
    kind: 'remote',
    url: 'https://host.example/a/b/c123',
  });
});

test('resolveArtworkSource: our own asset stays on loopback, because safeFetch would refuse it', () => {
  // isSafePublicUrl rejects localhost by design. Routing a local placeholder
  // through safeFetch would refuse every one of them as an SSRF attempt.
  assert.deepEqual(resolveArtworkSource('/stablekraft-rocket.png', BASE), {
    kind: 'local',
    url: 'http://localhost:8080/stablekraft-rocket.png',
  });
  // A trailing slash on the base must not double up.
  assert.deepEqual(resolveArtworkSource('/a.png', 'http://localhost:8080/'), {
    kind: 'local',
    url: 'http://localhost:8080/a.png',
  });
});

test('resolveArtworkSource: http is kept as remote, not mistaken for a local path', () => {
  // Real catalog rows carry http:// artwork; safeFetch takes allowHttp.
  assert.deepEqual(resolveArtworkSource('http://thebearsnare.com/x/image-2.png', BASE), {
    kind: 'remote',
    url: 'http://thebearsnare.com/x/image-2.png',
  });
});

test('resolveArtworkSource: nothing fetchable returns none', () => {
  for (const value of ['', '   ', null, undefined, 'not a url', 'data:image/png;base64,AAAA', '//x.com/a.png']) {
    assert.deepEqual(resolveArtworkSource(value as string, BASE), { kind: 'none' }, `for ${String(value)}`);
  }
});

test('artworkBaseUrl: prefers the configured base, else loopback on PORT', () => {
  assert.equal(artworkBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://stablekraft.app' }), 'https://stablekraft.app');
  // Production has NEXT_PUBLIC_BASE_URL unset and Railway injects PORT=8080.
  assert.equal(artworkBaseUrl({ PORT: '8080' }), 'http://localhost:8080');
  assert.equal(artworkBaseUrl({}), 'http://localhost:3001');
});
