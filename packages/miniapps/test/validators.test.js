import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, validateAssociationForDomain } from '../src/validators.js';

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

test('validateAssociationForDomain passes for matching payload domain', () => {
  const manifest = {
    accountAssociation: {
      header: b64urlJson({ key: '0xabc', fid: 1, type: 'custody' }),
      payload: b64urlJson({ domain: 'example.vercel.app' }),
      signature: 'sig'
    }
  };
  const out = validateAssociationForDomain(manifest, 'https://example.vercel.app');
  assert.equal(out.ok, true);
});

test('validateAssociationForDomain fails for domain mismatch', () => {
  const manifest = {
    accountAssociation: {
      header: b64urlJson({ key: '0xabc', fid: 1, type: 'custody' }),
      payload: b64urlJson({ domain: 'wrong.vercel.app' }),
      signature: 'sig'
    }
  };
  const out = validateAssociationForDomain(manifest, 'https://example.vercel.app');
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e.includes('domain mismatch')));
});
