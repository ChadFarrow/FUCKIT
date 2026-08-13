import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateSessionId } from './session-utils';

test('generates a v4-shaped uuid', () => {
  assert.match(
    generateSessionId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('does not repeat across many draws', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(generateSessionId());
  assert.equal(seen.size, 1000);
});
