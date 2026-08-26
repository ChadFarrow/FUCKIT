import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeFetch,
  readCappedArrayBuffer,
  readCappedText,
  declaredLengthExceeds,
  cappedStream,
  type FetchLike,
} from './safe-fetch';

/** A fetch stand-in driven by a URL → Response table. */
function stubFetch(routes: Record<string, () => Response>): {
  impl: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const impl: FetchLike = async (input) => {
    calls.push(input);
    const make = routes[input];
    if (!make) throw new Error(`unexpected fetch: ${input}`);
    return make();
  };
  return { impl, calls };
}

function redirectTo(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

test('rejects a private URL up front', async () => {
  const { impl, calls } = stubFetch({});
  const r = await safeFetch('http://169.254.169.254/latest/meta-data/', {
    allowHttp: true,
    fetchImpl: impl,
  });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /Private URLs/);
  assert.equal(calls.length, 0, 'must not issue a request at all');
});

test('rejects a non-HTTPS URL when http is not allowed', async () => {
  const { impl } = stubFetch({});
  const r = await safeFetch('http://example.com/feed.xml', { fetchImpl: impl });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /Only HTTPS/);
});

test('rejects file: and other schemes', async () => {
  for (const url of ['file:///etc/passwd', 'gopher://example.com/', 'ftp://example.com/x']) {
    const r = await safeFetch(url, { allowHttp: true, fetchImpl: stubFetch({}).impl });
    assert.equal(r.ok, false, `${url} must be refused`);
  }
});

// THE regression this module exists for.
test('refuses a redirect to a private address', async () => {
  const { impl, calls } = stubFetch({
    'https://attacker.example/a.png': () => redirectTo('http://169.254.169.254/'),
  });
  const r = await safeFetch('https://attacker.example/a.png', { fetchImpl: impl });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /Redirect target refused/);
  assert.deepEqual(calls, ['https://attacker.example/a.png'],
    'must stop before requesting the private address');
});

test('refuses a redirect to localhost and to a 10.x address', async () => {
  for (const target of ['http://localhost:5432/', 'http://10.0.0.5/admin', 'http://127.0.0.1/']) {
    const { impl } = stubFetch({
      'https://attacker.example/x': () => redirectTo(target),
    });
    const r = await safeFetch('https://attacker.example/x', { fetchImpl: impl });
    assert.equal(r.ok, false, `${target} must be refused`);
  }
});

test('refuses a private address reached on the second hop', async () => {
  const { impl, calls } = stubFetch({
    'https://a.example/1': () => redirectTo('https://b.example/2'),
    'https://b.example/2': () => redirectTo('http://192.168.1.1/'),
  });
  const r = await safeFetch('https://a.example/1', { fetchImpl: impl });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 2);
});

test('follows a redirect chain to a public host and returns the final URL', async () => {
  const { impl, calls } = stubFetch({
    'https://a.example/1': () => redirectTo('https://b.example/2'),
    'https://b.example/2': () => new Response('done', { status: 200 }),
  });
  const r = await safeFetch('https://a.example/1', { fetchImpl: impl });
  assert.equal(r.ok, true);
  assert.equal((r as { finalUrl: URL }).finalUrl.toString(), 'https://b.example/2');
  assert.deepEqual(calls, ['https://a.example/1', 'https://b.example/2']);
});

test('resolves a relative Location against the current URL', async () => {
  const { impl, calls } = stubFetch({
    'https://a.example/dir/1': () => redirectTo('/other/2'),
    'https://a.example/other/2': () => new Response('ok', { status: 200 }),
  });
  const r = await safeFetch('https://a.example/dir/1', { fetchImpl: impl });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['https://a.example/dir/1', 'https://a.example/other/2']);
});

test('stops after maxRedirects instead of looping forever', async () => {
  const { impl, calls } = stubFetch({
    'https://a.example/loop': () => redirectTo('https://a.example/loop'),
  });
  const r = await safeFetch('https://a.example/loop', { maxRedirects: 2, fetchImpl: impl });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /Too many redirects/);
  assert.equal(calls.length, 3, 'initial request plus 2 hops');
});

test('a 3xx with no Location is handed back, not followed', async () => {
  const { impl } = stubFetch({
    'https://a.example/x': () => new Response(null, { status: 302 }),
  });
  const r = await safeFetch('https://a.example/x', { fetchImpl: impl });
  assert.equal(r.ok, true);
  assert.equal((r as { response: Response }).response.status, 302);
});

test('the upstream error text never reaches the caller', async () => {
  const impl: FetchLike = async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.7:5432');
  };
  const r = await safeFetch('https://a.example/x', { fetchImpl: impl });
  assert.equal(r.ok, false);
  const { error } = r as { error: string };
  assert.equal(error, 'Upstream request failed');
  assert.doesNotMatch(error, /10\.0\.0\.7|ECONNREFUSED/);
});

test('declaredLengthExceeds reads content-length', () => {
  const big = new Response('x', { headers: { 'content-length': '999999' } });
  const small = new Response('x', { headers: { 'content-length': '10' } });
  const none = new Response('x');
  assert.equal(declaredLengthExceeds(big, 1000), true);
  assert.equal(declaredLengthExceeds(small, 1000), false);
  assert.equal(declaredLengthExceeds(none, 1000), false, 'unknown length is not a refusal');
});

test('refuses a body whose declared length is over the cap, without reading it', async () => {
  const res = new Response('short', { headers: { 'content-length': '50000000' } });
  const r = await readCappedArrayBuffer(res, 1024);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /exceeds 1024 bytes/);
});

test('refuses a body that lies about its length', async () => {
  // No content-length; the real bytes are what get counted.
  const payload = 'a'.repeat(5000);
  const res = new Response(payload);
  res.headers.delete('content-length');
  const r = await readCappedArrayBuffer(res, 1024);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /exceeds 1024 bytes/);
});

test('accepts a body under the cap and decodes it', async () => {
  const r = await readCappedText(new Response('<rss>ok</rss>'), 1024);
  assert.equal(r.ok, true);
  assert.equal((r as { value: string }).value, '<rss>ok</rss>');
});

test('cappedStream errors once the cap is passed', async () => {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(600));
      controller.enqueue(new Uint8Array(600));
      controller.close();
    },
  });
  const reader = cappedStream(source, 1000).getReader();
  await reader.read(); // first chunk is under the cap
  await assert.rejects(() => reader.read(), /exceeds 1000 bytes/);
});

test('cappedStream passes a body that stays under the cap', async () => {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(100));
      controller.close();
    },
  });
  const reader = cappedStream(source, 1000).getReader();
  const first = await reader.read();
  assert.equal(first.value?.byteLength, 100);
  assert.equal((await reader.read()).done, true);
});
