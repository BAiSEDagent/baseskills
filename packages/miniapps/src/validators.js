import fs from 'node:fs';

export function isHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeBase64UrlToJson(input) {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4;
    const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
    const raw = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateAssociationForDomain(manifest, appUrl) {
  const errors = [];
  const assoc = manifest?.accountAssociation ?? {};
  if (!assoc.header || !assoc.payload || !assoc.signature) {
    errors.push('accountAssociation incomplete');
    return { ok: false, errors };
  }

  const header = decodeBase64UrlToJson(assoc.header);
  const payload = decodeBase64UrlToJson(assoc.payload);

  if (!header) errors.push('accountAssociation.header invalid base64url JSON');
  if (!payload) errors.push('accountAssociation.payload invalid base64url JSON');

  if (header && (!header.key || !String(header.key).startsWith('0x'))) {
    errors.push('accountAssociation.header.key missing/invalid');
  }

  if (payload?.domain && appUrl) {
    try {
      const host = new URL(appUrl).host;
      if (payload.domain !== host) {
        errors.push(`accountAssociation domain mismatch (payload=${payload.domain}, expected=${host})`);
      }
    } catch {
      errors.push('app URL invalid for domain verification');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateManifest(manifest) {
  const errors = [];
  const frame = manifest?.frame ?? {};
  const assoc = manifest?.accountAssociation ?? {};

  const required = ['version', 'name', 'iconUrl', 'homeUrl', 'splashImageUrl', 'splashBackgroundColor'];
  for (const key of required) {
    if (!frame[key]) errors.push(`frame.${key} missing`);
  }

  const urlFields = ['iconUrl', 'homeUrl', 'imageUrl', 'splashImageUrl', 'heroImageUrl', 'ogImageUrl', 'webhookUrl'];
  for (const key of urlFields) {
    if (frame[key] && !isHttpsUrl(frame[key])) errors.push(`frame.${key} must be https URL`);
  }

  if (frame.subtitle && frame.subtitle.length > 30) {
    errors.push('frame.subtitle must be <= 30 chars');
  }

  if (!assoc.header || !assoc.payload || !assoc.signature) {
    errors.push('accountAssociation incomplete');
  }

  return { ok: errors.length === 0, errors };
}

export function validateLocalAssets(manifest, rootDir = process.cwd()) {
  const frame = manifest?.frame ?? {};
  const maybeUrls = [frame.iconUrl, frame.imageUrl, frame.splashImageUrl, frame.heroImageUrl, frame.ogImageUrl].filter(Boolean);
  const missing = [];

  for (const u of maybeUrls) {
    try {
      const url = new URL(u);
      const p = url.pathname;
      if (p.startsWith('/')) {
        const local = `${rootDir}/public${p}`;
        if (!fs.existsSync(local)) missing.push(`missing local asset: ${local}`);
      }
    } catch {
      // handled by manifest validation
    }
  }

  return { ok: missing.length === 0, errors: missing };
}
