import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowAndroidBatteryHint, resolveBrowserName } from './android-battery-hint';

test('shouldShowAndroidBatteryHint: only android + non-native + not-dismissed shows', () => {
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: false, dismissed: false }), true);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: false, isNative: false, dismissed: false }), false);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: true, dismissed: false }), false);
  assert.equal(shouldShowAndroidBatteryHint({ isAndroid: true, isNative: false, dismissed: true }), false);
});

test('resolveBrowserName: brave > firefox > edge > chrome > generic', () => {
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120', isBrave: true }), 'Brave');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Firefox/121', isBrave: false }), 'Firefox');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120 Edg/120', isBrave: false }), 'Edge');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Chrome/120', isBrave: false }), 'Chrome');
  assert.equal(resolveBrowserName({ ua: 'Mozilla/5.0 (Android) Weird/1', isBrave: false }), 'your browser');
});
