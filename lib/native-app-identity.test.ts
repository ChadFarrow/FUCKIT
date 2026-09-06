import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ALLOWED_APP_IDS,
  parseAllowedAppIds,
  parseGateMode,
  decideShellAccess,
  isNativeAndroid,
  readNativeAppId,
  checkNativeShell,
  parseCanonicalHosts,
  isCanonicalDeployment,
  DEFAULT_CANONICAL_HOSTS,
} from './native-app-identity';

/** Every checkNativeShell test runs as if served by our own deployment. */
const ON_CANONICAL = { hostname: 'stablekraft.app' } as const;

const ALLOWED = [...DEFAULT_ALLOWED_APP_IDS];

/** Install a fake Capacitor bridge on a fake `window`. Pass null for "no Capacitor at all". */
function stubShell(cap: unknown | null): void {
  (globalThis as any).window = cap === null ? {} : { Capacitor: cap };
}

/** A bridge that looks like the native Android app, with the given App.getInfo implementation. */
function androidShell(getInfo?: unknown) {
  return {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: getInfo === undefined ? {} : { App: { getInfo } },
  };
}

afterEach(() => {
  delete (globalThis as any).window;
});

test('parseAllowedAppIds: always keeps ours, adds trimmed extras, drops blanks and duplicates', () => {
  assert.deepEqual(parseAllowedAppIds(undefined), ['app.stablekraft']);
  assert.deepEqual(parseAllowedAppIds(''), ['app.stablekraft']);
  assert.deepEqual(parseAllowedAppIds('  '), ['app.stablekraft']);
  assert.deepEqual(parseAllowedAppIds('app.other'), ['app.stablekraft', 'app.other']);
  assert.deepEqual(parseAllowedAppIds(' app.other , , app.third '), ['app.stablekraft', 'app.other', 'app.third']);
  // Ours cannot be removed by misconfiguring the variable.
  assert.deepEqual(parseAllowedAppIds('app.stablekraft'), ['app.stablekraft']);
});

test('parseGateMode: block is the default, and an unrecognised value is block not off', () => {
  assert.equal(parseGateMode(undefined), 'block');
  assert.equal(parseGateMode(''), 'block');
  assert.equal(parseGateMode('block'), 'block');
  assert.equal(parseGateMode(' LOG '), 'log');
  assert.equal(parseGateMode('Off'), 'off');
  assert.equal(parseGateMode('nonsense'), 'block');
});

test('decideShellAccess: only a positively-identified foreign id is ever blocked', () => {
  const base = { allowedAppIds: ALLOWED, mode: 'block' as const };

  // The one blocking case.
  assert.equal(decideShellAccess({ ...base, isNativeAndroid: true, appId: 'app.unstablekraft' }), 'block');

  // Every fail-open case.
  assert.equal(decideShellAccess({ ...base, isNativeAndroid: false, appId: null }), 'allow', 'browser');
  assert.equal(decideShellAccess({ ...base, isNativeAndroid: false, appId: 'app.unstablekraft' }), 'allow', 'not native');
  assert.equal(decideShellAccess({ ...base, isNativeAndroid: true, appId: null }), 'allow', 'could not ask');
  assert.equal(decideShellAccess({ ...base, isNativeAndroid: true, appId: 'app.stablekraft' }), 'allow', 'ours');
});

test('decideShellAccess: log mode reports without blocking, off mode does neither', () => {
  const foreign = { isNativeAndroid: true, appId: 'app.unstablekraft', allowedAppIds: ALLOWED };
  assert.equal(decideShellAccess({ ...foreign, mode: 'log' }), 'report');
  assert.equal(decideShellAccess({ ...foreign, mode: 'off' }), 'allow');
  // The kill switch wins even over a foreign id.
  assert.equal(decideShellAccess({ ...foreign, mode: 'off', appId: 'anything' }), 'allow');
});

test('decideShellAccess: an extra allowed id is honoured', () => {
  assert.equal(
    decideShellAccess({
      isNativeAndroid: true,
      appId: 'app.other',
      allowedAppIds: parseAllowedAppIds('app.other'),
      mode: 'block',
    }),
    'allow'
  );
});

test('isNativeAndroid: true only for a native android bridge', () => {
  stubShell(null);
  assert.equal(isNativeAndroid(), false, 'no Capacitor');

  stubShell({ isNativePlatform: () => false, getPlatform: () => 'web' });
  assert.equal(isNativeAndroid(), false, 'browser PWA');

  stubShell({ isNativePlatform: () => true, getPlatform: () => 'ios' });
  assert.equal(isNativeAndroid(), false, 'iOS');

  stubShell({ isNativePlatform: () => { throw new Error('bridge exploded'); } });
  assert.equal(isNativeAndroid(), false, 'a throwing bridge must not propagate');

  stubShell(androidShell());
  assert.equal(isNativeAndroid(), true);
});

test('readNativeAppId: returns the id when the bridge answers', async () => {
  stubShell(androidShell(async () => ({ id: 'app.unstablekraft', name: 'UnstableKraft', version: '1.0' })));
  assert.equal(await readNativeAppId(), 'app.unstablekraft');

  // Whitespace is trimmed rather than producing a near-miss against the allowlist.
  stubShell(androidShell(async () => ({ id: '  app.stablekraft  ' })));
  assert.equal(await readNativeAppId(), 'app.stablekraft');
});

test('readNativeAppId: null for every shape that cannot answer', async () => {
  stubShell(null);
  assert.equal(await readNativeAppId(), null, 'no Capacitor');

  stubShell(androidShell());
  assert.equal(await readNativeAppId(), null, 'plugin missing (an old APK predating @capacitor/app)');

  stubShell(androidShell(async () => { throw new Error('bridge rejected'); }));
  assert.equal(await readNativeAppId(), null, 'getInfo rejects');

  stubShell(androidShell(() => { throw new Error('threw synchronously'); }));
  assert.equal(await readNativeAppId(), null, 'getInfo throws synchronously');

  stubShell(androidShell(async () => ({})));
  assert.equal(await readNativeAppId(), null, 'no id field');

  stubShell(androidShell(async () => ({ id: 42 })));
  assert.equal(await readNativeAppId(), null, 'non-string id');

  stubShell(androidShell(async () => ({ id: '   ' })));
  assert.equal(await readNativeAppId(), null, 'blank id');

  stubShell(androidShell(async () => null));
  assert.equal(await readNativeAppId(), null, 'null info');
});

test('readNativeAppId: a bridge that never answers times out instead of hanging', async () => {
  stubShell(androidShell(() => new Promise(() => {})));
  const started = Date.now();
  assert.equal(await readNativeAppId(30), null);
  assert.ok(Date.now() - started < 1000, 'must not wait on the never-settling promise');
});

test('checkNativeShell: blocks a foreign shell and reports the id it found', async () => {
  stubShell(androidShell(async () => ({ id: 'app.unstablekraft' })));
  assert.deepEqual(await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, ...ON_CANONICAL }), {
    decision: 'block',
    appId: 'app.unstablekraft',
  });
});

test('checkNativeShell: allows ours, browsers, and a shell that cannot answer', async () => {
  stubShell(androidShell(async () => ({ id: 'app.stablekraft' })));
  assert.deepEqual(await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, ...ON_CANONICAL }), {
    decision: 'allow',
    appId: 'app.stablekraft',
  });

  stubShell(null);
  assert.deepEqual(await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, ...ON_CANONICAL }), {
    decision: 'allow',
    appId: null,
  });

  stubShell(androidShell());
  assert.deepEqual(await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, ...ON_CANONICAL }), {
    decision: 'allow',
    appId: null,
  });
});

test('checkNativeShell: off mode never touches the bridge at all', async () => {
  let asked = false;
  stubShell(androidShell(async () => { asked = true; return { id: 'app.unstablekraft' }; }));
  assert.deepEqual(await checkNativeShell({ mode: 'off', allowedAppIds: ALLOWED, ...ON_CANONICAL }), {
    decision: 'allow',
    appId: null,
  });
  assert.equal(asked, false);
});

test('parseCanonicalHosts: keeps ours, including the Railway hostname', () => {
  assert.deepEqual(parseCanonicalHosts(undefined), [...DEFAULT_CANONICAL_HOSTS]);
  assert.ok(parseCanonicalHosts(undefined).includes('stablekraft-production.up.railway.app'),
    'omitting it would let a shell skip the gate by using the Railway host directly');
  assert.deepEqual(parseCanonicalHosts(' preview.example , '), [...DEFAULT_CANONICAL_HOSTS, 'preview.example']);
});

test('isCanonicalDeployment: our domain and its subdomains, nothing else', () => {
  const hosts = parseCanonicalHosts(undefined);
  assert.equal(isCanonicalDeployment('stablekraft.app', hosts), true);
  assert.equal(isCanonicalDeployment('radio.stablekraft.app', hosts), true, 'the radio subdomain');
  assert.equal(isCanonicalDeployment('stablekraft-production.up.railway.app', hosts), true);
  assert.equal(isCanonicalDeployment('unstablekraft.example', hosts), false);
  assert.equal(isCanonicalDeployment('localhost', hosts), false);
  assert.equal(isCanonicalDeployment('stablekraft.app.attacker.net', hosts), false);
});

test('the gate is INERT on a fork that self-hosts this code', async () => {
  // The outcome we want them to reach. Their own deployment must not block their
  // own app, or self-hosting costs them a support ticket and they stay put.
  stubShell(androidShell(async () => ({ id: 'app.unstablekraft' })));
  assert.deepEqual(
    await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, hostname: 'unstablekraft.example' }),
    { decision: 'allow', appId: null }
  );
});

test('the gate still fires for that same shell on OUR deployment', async () => {
  stubShell(androidShell(async () => ({ id: 'app.unstablekraft' })));
  assert.deepEqual(
    await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, hostname: 'stablekraft.app' }),
    { decision: 'block', appId: 'app.unstablekraft' }
  );
  // And via the Railway hostname, which is the way round it if left unlisted.
  assert.equal(
    (await checkNativeShell({
      mode: 'block', allowedAppIds: ALLOWED, hostname: 'stablekraft-production.up.railway.app',
    })).decision,
    'block'
  );
});

test('no hostname (SSR, or a non-browser context) leaves the gate inert', async () => {
  stubShell(androidShell(async () => ({ id: 'app.unstablekraft' })));
  assert.deepEqual(
    await checkNativeShell({ mode: 'block', allowedAppIds: ALLOWED, hostname: null }),
    { decision: 'allow', appId: null }
  );
});
