import test from 'node:test';
import assert from 'node:assert/strict';
import { androidVersion } from './android-version.mjs';

test('versions remain ordered across patch, minor and major releases', () => {
  assert.deepEqual(androidVersion('v2.0.0', '19999'), { name: '2.0.0', code: 20000 });
  assert.equal(androidVersion('v2.0.1', '20000').code, 20001);
  assert.equal(androidVersion('v2.1.0', '20099').code, 20100);
  assert.equal(androidVersion('v3.0.0', '29999').code, 30000);
});

test('rejects reused or decreasing Play version codes', () => {
  for (const tag of ['v2.0.0', 'v1.9.9']) assert.throws(() => androidVersion(tag, '20000'), /must exceed/);
});

test('requires a known previous Play build instead of guessing', () => {
  for (const previous of [undefined, '', '-1', '1.5', 'abc', '2100000001']) {
    assert.throws(() => androidVersion('v2.0.1', previous), /ANDROID_LAST_PUBLISHED_VERSION_CODE/);
  }
});

test('rejects malformed tags, colliding components and Play overflow', () => {
  for (const tag of ['main', '2.0.1', 'v02.0.1', 'v2.0.1-beta', 'v2.100.0', 'v2.0.100', 'v0.0.0', 'v210000.0.1']) {
    assert.throws(() => androidVersion(tag, '0'));
  }
  assert.equal(androidVersion('v210000.0.0', '2099999999').code, 2100000000);
});
