import fs from 'node:fs';

export function isHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
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
