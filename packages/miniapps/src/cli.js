#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateManifest, validateLocalAssets } from './validators.js';

const args = process.argv.slice(2);
const cmd = args[0];

function getArg(name, fallback = undefined) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

function logResult(title, ok, details = []) {
  console.log(`${ok ? '✅' : '❌'} ${title}`);
  if (details.length) details.forEach((d) => console.log(`  - ${d}`));
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function classifyGates(json, status) {
  const submitBlockers = [];
  const featureRisks = [];
  const growthGaps = [];

  if (status !== 200) submitBlockers.push('manifest not reachable (non-200)');
  if (!json) submitBlockers.push('manifest invalid JSON');
  if (!json) return { submitBlockers, featureRisks, growthGaps };

  const valid = validateManifest(json);
  submitBlockers.push(...valid.errors);

  const frame = json.frame ?? {};
  if (!frame.primaryCategory) submitBlockers.push('frame.primaryCategory missing');
  if (!Array.isArray(frame.tags) || frame.tags.length === 0) submitBlockers.push('frame.tags missing');

  if (!frame.description) featureRisks.push('frame.description missing');
  if (!frame.screenshotUrls || frame.screenshotUrls.length === 0) featureRisks.push('frame.screenshotUrls missing');
  if (!frame.heroImageUrl) featureRisks.push('frame.heroImageUrl missing');
  if (!frame.ogTitle || !frame.ogDescription || !frame.ogImageUrl) featureRisks.push('og fields incomplete');
  if (!frame.webhookUrl) featureRisks.push('frame.webhookUrl missing');

  if (!frame.tagline) growthGaps.push('frame.tagline missing');
  if (!frame.imageUrl) growthGaps.push('frame.imageUrl missing (embed conversion risk)');

  return { submitBlockers, featureRisks, growthGaps };
}

async function preflight() {
  const manifestPath = getArg('--manifest', path.join(process.cwd(), 'public/.well-known/farcaster.json'));
  const manifest = await readJson(manifestPath);
  const a = validateManifest(manifest);
  const b = validateLocalAssets(manifest, process.cwd());

  logResult('Manifest schema checks', a.ok, a.errors);
  logResult('Local asset checks', b.ok, b.errors);

  if (!a.ok || !b.ok) process.exit(1);
}

async function verify() {
  const url = getArg('--url');
  if (!url) throw new Error('Missing --url');
  const manifestUrl = `${url.replace(/\/$/, '')}/.well-known/farcaster.json`;
  const out = await fetchJson(manifestUrl);

  const checks = [];
  checks.push({ name: 'Manifest fetch status 200', ok: out.status === 200, details: [`status=${out.status}`] });
  checks.push({ name: 'Manifest JSON parse', ok: !!out.json, details: out.json ? [] : ['invalid JSON body'] });

  let schemaOk = false;
  if (out.json) {
    const m = validateManifest(out.json);
    schemaOk = m.ok;
    checks.push({ name: 'Manifest validity', ok: m.ok, details: m.errors });

    const webhook = out.json?.frame?.webhookUrl;
    if (webhook) {
      const w = await fetchJson(webhook);
      checks.push({ name: 'Webhook health', ok: w.status >= 200 && w.status < 500, details: [`status=${w.status}`] });
    } else {
      checks.push({ name: 'Webhook health', ok: false, details: ['frame.webhookUrl missing'] });
    }
  }

  let allOk = true;
  for (const c of checks) {
    logResult(c.name, c.ok, c.details);
    if (!c.ok) allOk = false;
  }

  if (!schemaOk || !allOk) process.exit(1);
}

async function submitReady() {
  const url = getArg('--url');
  if (!url) throw new Error('Missing --url');
  const manifestUrl = `${url.replace(/\/$/, '')}/.well-known/farcaster.json`;
  const out = await fetchJson(manifestUrl);

  const { submitBlockers, featureRisks, growthGaps } = classifyGates(out.json, out.status);
  const pass = submitBlockers.length === 0;

  console.log(pass ? 'PASS — YES: submit now' : 'FAIL — NO: fix blockers');
  console.log('\nSUBMIT BLOCKER:');
  if (!submitBlockers.length) console.log('- none');
  submitBlockers.forEach((b) => console.log(`- ${b}`));

  console.log('\nFEATURE RISK:');
  if (!featureRisks.length) console.log('- none');
  featureRisks.forEach((b) => console.log(`- ${b}`));

  console.log('\nGROWTH GAP:');
  if (!growthGaps.length) console.log('- none');
  growthGaps.forEach((b) => console.log(`- ${b}`));

  if (!pass) process.exit(1);
}

async function scaffold() {
  const name = args[1];
  if (!name) throw new Error('Missing app name: create-baseskills-miniapps <name>');

  const root = path.resolve(process.cwd(), name);
  await fs.mkdir(path.join(root, 'public/.well-known'), { recursive: true });
  await fs.mkdir(path.join(root, 'src/app/api/webhook/notifications'), { recursive: true });

  const manifest = {
    accountAssociation: { header: '', payload: '', signature: '' },
    frame: {
      version: '1',
      name,
      iconUrl: `https://${name}.vercel.app/assets/icon-1024.png`,
      homeUrl: `https://${name}.vercel.app`,
      imageUrl: `https://${name}.vercel.app/assets/cover-1200x630.png`,
      buttonTitle: 'Open',
      splashImageUrl: `https://${name}.vercel.app/assets/icon-1024.png`,
      splashBackgroundColor: '#0A0A0C',
      subtitle: 'Base mini app',
      description: 'Mini app built with Base-ready defaults.',
      primaryCategory: 'finance',
      tags: ['base', 'miniapp'],
      screenshotUrls: [`https://${name}.vercel.app/assets/cover-1200x630.png`],
      webhookUrl: `https://${name}.vercel.app/api/webhook/notifications`
    }
  };

  await fs.writeFile(path.join(root, 'public/.well-known/farcaster.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(root, 'src/app/api/webhook/notifications/route.ts'),
`import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ ok: true }); }
`);
  await fs.writeFile(path.join(root, 'README.md'), '# Base Mini App Scaffold\n\nRun `baseskills-miniapps preflight` after filling accountAssociation.\n');

  console.log(`✅ Scaffold created: ${root}`);
}

async function shipbookPlan() {
  const name = args[1] || 'my-base-miniapp';
  const outPath = getArg('--out', path.join(process.cwd(), `${name}-build-plan.md`));
  const content = `# ${name} — Base Mini App Engineering Playbook Plan\n\n## Auto-complete technical checklist\n- [ ] Scaffold app shell + manifest + webhook route\n- [ ] Implement accountAssociation in /.well-known/farcaster.json\n- [ ] Complete frame metadata (primaryCategory, tags, og fields, webhookUrl)\n- [ ] Wire wallet auth and keep flow in-app\n- [ ] Sponsor tx path via paymaster + fallback\n- [ ] Batch tx where applicable (EIP-5792)\n- [ ] Run preflight\n- [ ] Run verify against deployed URL\n- [ ] Run submit-ready and resolve blockers\n\n## ONLY remaining for UI/UX review\n- [ ] Visual direction and hierarchy\n- [ ] Microcopy tone and onboarding script\n- [ ] Empty/loading/error state polish\n- [ ] Motion tuning and tactile feel\n\n## Command flow\n\n\`\`\`bash\nbaseskills-miniapps create-baseskills-miniapps ${name}\nbaseskills-miniapps preflight\nbaseskills-miniapps verify --url https://${name}.vercel.app\nbaseskills-miniapps can-submit --url https://${name}.vercel.app\n\`\`\`\n`;
  await fs.writeFile(outPath, content);
  console.log(`✅ Shipbook plan written: ${outPath}`);
}

(async () => {
  try {
    if (cmd === 'preflight') return await preflight();
    if (cmd === 'verify') return await verify();
    if (cmd === 'submit-ready' || cmd === 'can-submit' || cmd === 'ship-report') return await submitReady();
    if (cmd === 'create-base-miniapp') return await scaffold();
    if (cmd === 'shipbook-plan' || cmd === 'bible-plan') return await shipbookPlan();

    console.log('Usage:');
    console.log('  baseskills-miniapps create-baseskills-miniapps <name>');
    console.log('  baseskills-miniapps preflight [--manifest <path>]');
    console.log('  baseskills-miniapps verify --url <https://app.vercel.app>');
    console.log('  baseskills-miniapps submit-ready --url <https://app.vercel.app>');
    console.log('  baseskills-miniapps ship-report --url <https://app.vercel.app>');
    console.log('  baseskills-miniapps shipbook-plan <name> [--out ./plan.md]');
    process.exit(1);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
})();
