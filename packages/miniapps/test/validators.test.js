import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '../src/validators.js';

test('validateManifest flags long subtitle', () => {
  const out = validateManifest({
    accountAssociation: { header: 'a', payload: 'b', signature: 'c' },
    frame: {
      version: '1', name: 'x', iconUrl: 'https://a.com', homeUrl: 'https://a.com', splashImageUrl: 'https://a.com', splashBackgroundColor: '#000',
      subtitle: 'this subtitle is definitely over thirty chars'
    }
  });
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.includes('subtitle')));
});

test('validateManifest passes minimum valid frame', () => {
  const out = validateManifest({
    accountAssociation: { header: 'a', payload: 'b', signature: 'c' },
    frame: {
      version: '1', name: 'x', iconUrl: 'https://a.com', homeUrl: 'https://a.com', splashImageUrl: 'https://a.com', splashBackgroundColor: '#000'
    }
  });
  assert.equal(out.ok, true);
});
