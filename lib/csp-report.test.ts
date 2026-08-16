import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCspReport, violationKey, isExtensionNoise, CSP_CATEGORY } from './csp-report';

/**
 * Vectors are literal report bodies as browsers actually send them, not objects
 * rendered back out of our own types — a round trip through our own shape cannot
 * catch us misreading the wire format, which is the only thing that can go wrong
 * here.
 */

describe('parseCspReport — report-uri shape (Chrome/Firefox/Safari)', () => {
  it('reads the hyphenated csp-report envelope', () => {
    const [v] = parseCspReport({
      'csp-report': {
        'document-uri': 'https://stablekraft.app/album/abc?from=search',
        'referrer': '',
        'violated-directive': 'worker-src',
        'effective-directive': 'worker-src',
        'original-policy': "default-src 'self'; worker-src 'self'",
        'blocked-uri': 'blob:https://stablekraft.app/f269bf9e-200a-4463',
        'status-code': 200,
      },
    });

    assert.equal(v.directive, 'worker-src');
    // blob: collapses to the scheme — the uuid is per-worker and unbounded.
    assert.equal(v.blockedUri, 'blob');
    // Query string dropped: it can carry search terms.
    assert.equal(v.documentPath, '/album/abc');
  });

  it('strips the source list some browsers put in violated-directive', () => {
    const [v] = parseCspReport({
      'csp-report': {
        'document-uri': 'https://stablekraft.app/',
        'violated-directive': "script-src 'self' 'unsafe-inline'",
        'blocked-uri': 'inline',
      },
    });
    // Without this the same violation re-keys every time the policy is edited.
    assert.equal(v.directive, 'script-src');
    assert.equal(v.blockedUri, 'inline');
  });
});

describe('parseCspReport — Reporting API shape (report-to)', () => {
  it('reads a batch and keeps only csp-violation entries', () => {
    const out = parseCspReport([
      {
        type: 'csp-violation',
        age: 12,
        url: 'https://stablekraft.app/favorites',
        body: {
          documentURL: 'https://stablekraft.app/favorites',
          effectiveDirective: 'connect-src',
          blockedURL: 'https://evil.example.com/beacon?id=1',
          disposition: 'report',
        },
      },
      // Same envelope, different report type — must not be counted as a violation.
      { type: 'deprecation', body: { id: 'PrefixedStorageInfo' } },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0].directive, 'connect-src');
    // Collapsed to origin: the path and query are unbounded cardinality.
    assert.equal(out[0].blockedUri, 'https://evil.example.com');
    assert.equal(out[0].documentPath, '/favorites');
  });
});

describe('extension noise', () => {
  for (const scheme of [
    'chrome-extension://abc/inject.js',
    'moz-extension://abc/inject.js',
    'safari-web-extension://abc/x.js',
  ]) {
    it(`drops ${scheme.split(':')[0]}`, () => {
      assert.equal(isExtensionNoise(scheme), true);
      assert.deepEqual(
        parseCspReport({
          'csp-report': {
            'document-uri': 'https://stablekraft.app/',
            'effective-directive': 'script-src',
            'blocked-uri': scheme,
          },
        }),
        []
      );
    });
  }

  it('keeps a real https origin', () => {
    assert.equal(isExtensionNoise('https://fonts.googleapis.com'), false);
  });
});

describe('parseCspReport — hostile and malformed input', () => {
  it('returns [] rather than throwing, for anything that is not a report', () => {
    // The endpoint is unauthenticated, so junk bodies are expected traffic.
    for (const body of [null, undefined, 42, 'string', [], {}, { 'csp-report': null }]) {
      assert.deepEqual(parseCspReport(body), [], `body: ${JSON.stringify(body)}`);
    }
  });

  it('drops a report with no directive rather than bucketing it as empty', () => {
    assert.deepEqual(
      parseCspReport({ 'csp-report': { 'blocked-uri': 'inline' } }),
      []
    );
  });

  it('bounds every field so one caller cannot mint unbounded rows', () => {
    const [v] = parseCspReport({
      'csp-report': {
        'document-uri': 'https://stablekraft.app/' + 'a'.repeat(500),
        'effective-directive': 'x'.repeat(200),
        'blocked-uri': 'https://' + 'b'.repeat(500) + '.com/path',
      },
    });
    assert.ok(v.directive.length <= 40, `directive ${v.directive.length}`);
    assert.ok(v.blockedUri.length <= 100, `blockedUri ${v.blockedUri.length}`);
    assert.ok(v.documentPath.length <= 120, `documentPath ${v.documentPath.length}`);
  });

  it('handles data: and filesystem: by scheme, not by payload', () => {
    const [v] = parseCspReport({
      'csp-report': {
        'document-uri': 'https://stablekraft.app/',
        'effective-directive': 'img-src',
        'blocked-uri': 'data:image/png;base64,' + 'A'.repeat(4000),
      },
    });
    assert.equal(v.blockedUri, 'data');
  });
});

describe('violationKey', () => {
  it('excludes the document path so one policy bug is ONE row', () => {
    const a = violationKey({ directive: 'worker-src', blockedUri: 'blob', documentPath: '/' });
    const b = violationKey({ directive: 'worker-src', blockedUri: 'blob', documentPath: '/album/x' });
    assert.equal(a, b);
  });

  it('separates different directives and different blocked origins', () => {
    const base = { documentPath: '/' };
    assert.notEqual(
      violationKey({ ...base, directive: 'worker-src', blockedUri: 'blob' }),
      violationKey({ ...base, directive: 'script-src', blockedUri: 'blob' })
    );
    assert.notEqual(
      violationKey({ ...base, directive: 'connect-src', blockedUri: 'https://a.com' }),
      violationKey({ ...base, directive: 'connect-src', blockedUri: 'https://b.com' })
    );
  });
});

describe('CSP_CATEGORY', () => {
  it('is a distinct bucket so CSP reports do not mix with client errors', () => {
    assert.equal(CSP_CATEGORY, 'csp');
  });
});
