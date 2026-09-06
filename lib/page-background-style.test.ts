import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageBackgroundStyle, PAGE_BACKGROUND_BASE } from './page-background-style';

const ART = "/api/proxy-image?url=https%3A%2F%2Fcdn.example%2Fa.jpg&enhance=true";

test('no artwork paints the opaque base', () => {
  const style = buildPageBackgroundStyle(null) as Record<string, unknown>;
  assert.equal(style.background, PAGE_BACKGROUND_BASE);
  // No `url()` to wait on, so nothing to be transparent behind.
  assert.equal(style.backgroundImage, undefined);
});

test('null, undefined and empty string all take the no-artwork branch', () => {
  for (const empty of [null, undefined, '']) {
    const style = buildPageBackgroundStyle(empty) as Record<string, unknown>;
    assert.equal(style.background, PAGE_BACKGROUND_BASE, `empty value: ${JSON.stringify(empty)}`);
  }
});

test('artwork keeps the opaque base UNDERNEATH it — this is issue #201', () => {
  // The regression: the layer used to be scrim + url() only. Both of those are
  // see-through until the image loads, so /stablekraft-rocket.webp (app/layout.tsx,
  // z-0) showed through this z-1 layer on every album-page navigation.
  const style = buildPageBackgroundStyle(ART) as Record<string, string>;
  const layers = style.backgroundImage;

  assert.ok(layers.includes(`url('${ART}')`), 'artwork layer is present');
  assert.ok(layers.includes(PAGE_BACKGROUND_BASE), 'opaque base layer is present');

  // Order is load-bearing: background-image paints front-to-back, so the base
  // must come LAST or it covers the artwork instead of backing it.
  assert.ok(
    layers.indexOf(`url('${ART}')`) < layers.indexOf(PAGE_BACKGROUND_BASE),
    'the opaque base must be the last (bottom-most) layer'
  );

  // And the scrim must stay on top of the artwork, or the artwork is unscrimmed.
  assert.ok(
    layers.indexOf('rgba(0,0,0,0.4)') < layers.indexOf(`url('${ART}')`),
    'the readability scrim must be the first (top-most) layer'
  );
});

test('the base gradient is fully opaque', () => {
  // Every colour stop must be a bare rgb()/hex. One rgba() with alpha < 1 here
  // and the rocket is visible through the layer again, with no other symptom.
  assert.ok(!/rgba|transparent|hsla/.test(PAGE_BACKGROUND_BASE), PAGE_BACKGROUND_BASE);
});

test('both branches sit fixed at z-1, above the global layout background', () => {
  for (const style of [buildPageBackgroundStyle(null), buildPageBackgroundStyle(ART)]) {
    assert.equal(style.position, 'fixed');
    assert.equal(style.zIndex, 1);
  }
});

test('the no-artwork branch is pinned to the viewport edges', () => {
  const style = buildPageBackgroundStyle(null);
  // It carries no blur, so it needs no bleed and must not be oversized.
  assert.equal(style.top, 0);
  assert.equal(style.bottom, 0);
  assert.equal(style.left, 0);
  assert.equal(style.right, 0);
});

test('the blurred artwork branch is grown past the viewport on all four sides', () => {
  // `filter: blur(4px)` fades the layer's OWN alpha at its box boundary, so a
  // layer pinned to inset:0 is see-through in a band around the whole screen and
  // the rocket wallpaper bleeds through it — measured at 2891px on a 1280x800
  // viewport even with the opaque base already in place. All four sides matter:
  // three out of four still leaks along the fourth edge.
  const style = buildPageBackgroundStyle(ART) as Record<string, number>;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.ok(
      typeof style[side] === 'number' && style[side] <= -12,
      `${side} must clear the 4px blur by a margin, got ${style[side]}`
    );
  }
});

test('the artwork branch still carries the quality treatment', () => {
  const style = buildPageBackgroundStyle(ART) as Record<string, unknown>;
  assert.equal(style.backgroundSize, 'cover');
  assert.equal(style.backgroundPosition, 'center');
  assert.equal(style.backgroundAttachment, 'fixed');
  assert.equal(style.filter, 'blur(4px) contrast(0.9) brightness(0.95)');
});
