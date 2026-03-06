#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateManifest, validateLocalAssets, validateAssociationForDomain } from './validators.js';

const RULES_VERSION = 'base-v2026-03-05';
const RULES = {
  R001: { severity: 'submit_blocker', text: 'manifest not reachable (non-200)' },
  R002: { severity: 'submit_blocker', text: 'manifest invalid JSON' },
  R003: { severity: 'submit_blocker', text: 'accountAssociation incomplete' },
  R004: { severity: 'submit_blocker', text: 'required frame fields missing' },
  R005: { severity: 'submit_blocker', text: 'frame.subtitle must be <= 30 chars' },
  R006: { severity: 'submit_blocker', text: 'frame.primaryCategory missing' },
  R007: { severity: 'submit_blocker', text: 'frame.tags missing' },
  R008: { severity: 'submit_blocker', text: 'accountAssociation domain/key validation failed' },
  R009: { severity: 'submit_blocker', text: 'embed metadata missing (fc:miniapp)' },
  R010: { severity: 'submit_blocker', text: 'webhook synthetic POST failed' },
  R101: { severity: 'feature_risk', text: 'frame.description missing' },
  R102: { severity: 'feature_risk', text: 'frame.screenshotUrls missing' },
  R103: { severity: 'feature_risk', text: 'frame.heroImageUrl missing' },
  R104: { severity: 'feature_risk', text: 'og fields incomplete' },
  R105: { severity: 'feature_risk', text: 'frame.webhookUrl missing' },
  R201: { severity: 'growth_gap', text: 'frame.tagline missing' },
  R202: { severity: 'growth_gap', text: 'frame.imageUrl missing (embed conversion risk)' }
};

const args = process.argv.slice(2);
const cmd = args[0];

function getArg(name, fallback = undefined) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function logResult(title, ok, details = []) {
  console.log(`${ok ? '✅' : '❌'} ${title}`);
  if (details.length) details.forEach((d) => console.log(`  - ${d}`));
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function fetchText(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function fetchJson(url, method = 'GET', body = undefined) {
  const res = await fetch(url, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function classifyGates(json, status, appUrl, extras = {}) {
  const submitBlockers = [];
  const featureRisks = [];
  const growthGaps = [];

  const pushRule = (id) => {
    const r = RULES[id];
    const item = `[${id}] ${r.text}`;
    if (r.severity === 'submit_blocker') submitBlockers.push(item);
    if (r.severity === 'feature_risk') featureRisks.push(item);
    if (r.severity === 'growth_gap') growthGaps.push(item);
  };

  if (status !== 200) pushRule('R001');
  if (!json) pushRule('R002');
  if (!json) return { submitBlockers, featureRisks, growthGaps };

  const valid = validateManifest(json);
  if (valid.errors.some((e) => e.includes('accountAssociation'))) pushRule('R003');
  if (valid.errors.some((e) => e.includes('frame.') && e.includes('missing'))) pushRule('R004');
  if (valid.errors.some((e) => e.includes('subtitle'))) pushRule('R005');

  const assocCheck = validateAssociationForDomain(json, appUrl);
  if (!assocCheck.ok) pushRule('R008');

  const frame = json.frame ?? {};
  if (!frame.primaryCategory) pushRule('R006');
  if (!Array.isArray(frame.tags) || frame.tags.length === 0) pushRule('R007');

  if (!frame.description) pushRule('R101');
  if (!frame.screenshotUrls || frame.screenshotUrls.length === 0) pushRule('R102');
  if (!frame.heroImageUrl) pushRule('R103');
  if (!frame.ogTitle || !frame.ogDescription || !frame.ogImageUrl) pushRule('R104');
  if (!frame.webhookUrl) pushRule('R105');

  if (!frame.tagline) pushRule('R201');
  if (!frame.imageUrl) pushRule('R202');

  if (!extras.embedOk) pushRule('R009');
  if (!extras.webhookPostOk) pushRule('R010');

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

function checkEmbedMetadata(html) {
  return /fc:miniapp|farcaster:miniapp/i.test(html);
}

async function verify() {
  const url = getArg('--url');
  if (!url) throw new Error('Missing --url');
  const manifestUrl = `${url.replace(/\/$/, '')}/.well-known/farcaster.json`;
  const out = await fetchJson(manifestUrl);
  const homepage = await fetchText(url);

  const checks = [];
  checks.push({ name: 'Manifest fetch status 200', ok: out.status === 200, details: [`status=${out.status}`] });
  checks.push({ name: 'Manifest JSON parse', ok: !!out.json, details: out.json ? [] : ['invalid JSON body'] });
  checks.push({ name: 'Embed metadata present', ok: checkEmbedMetadata(homepage.text), details: ['expects fc:miniapp meta'] });

  let schemaOk = false;
  if (out.json) {
    const m = validateManifest(out.json);
    schemaOk = m.ok;
    checks.push({ name: 'Manifest validity', ok: m.ok, details: m.errors });

    const webhook = out.json?.frame?.webhookUrl;
    if (webhook) {
      const w = await fetchJson(webhook);
      const wp = await fetchJson(webhook, 'POST', { type: 'baseskills.synthetic.test' });
      checks.push({ name: 'Webhook health (GET)', ok: w.status >= 200 && w.status < 500, details: [`status=${w.status}`] });
      checks.push({ name: 'Webhook synthetic POST', ok: wp.status >= 200 && wp.status < 300, details: [`status=${wp.status}`] });
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
  const asJson = hasFlag('--json');
  if (!url) throw new Error('Missing --url');
  const manifestUrl = `${url.replace(/\/$/, '')}/.well-known/farcaster.json`;
  const out = await fetchJson(manifestUrl);

  const homepage = await fetchText(url);
  const embedOk = checkEmbedMetadata(homepage.text);

  let webhookPostOk = false;
  const webhook = out.json?.frame?.webhookUrl;
  if (webhook) {
    const wp = await fetchJson(webhook, 'POST', { type: 'baseskills.synthetic.test' });
    webhookPostOk = wp.status >= 200 && wp.status < 300;
  }

  const { submitBlockers, featureRisks, growthGaps } = classifyGates(out.json, out.status, url, { embedOk, webhookPostOk });
  const pass = submitBlockers.length === 0;

  if (asJson) {
    console.log(JSON.stringify({
      ruleset: RULES_VERSION,
      verdict: pass ? 'PASS' : 'FAIL',
      submitBlockers,
      featureRisks,
      growthGaps
    }, null, 2));
    if (!pass) process.exit(1);
    return;
  }

  console.log(`Ruleset: ${RULES_VERSION}`);
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

function normalizeToHttps(u) {
  if (!u || typeof u !== 'string') return u;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return u;
}

async function autoFix() {
  const manifestPath = getArg('--manifest', path.join(process.cwd(), 'public/.well-known/farcaster.json'));
  const m = await readJson(manifestPath);
  m.accountAssociation ??= { header: '', payload: '', signature: '' };
  m.frame ??= {};
  const f = m.frame;

  if (typeof f.subtitle === 'string' && f.subtitle.length > 30) {
    f.subtitle = `${f.subtitle.slice(0, 27)}...`;
  }

  const homepage = f.homeUrl || 'https://example.vercel.app';
  const domain = (() => { try { return new URL(homepage).origin; } catch { return 'https://example.vercel.app'; } })();

  f.version ??= '1';
  f.name ??= 'BaseMiniApp';
  f.iconUrl = normalizeToHttps(f.iconUrl ?? `${domain}/assets/icon-1024.png`);
  f.homeUrl = normalizeToHttps(f.homeUrl ?? domain);
  f.imageUrl = normalizeToHttps(f.imageUrl ?? `${domain}/assets/cover-1200x630.png`);
  f.splashImageUrl = normalizeToHttps(f.splashImageUrl ?? `${domain}/assets/icon-1024.png`);
  f.splashBackgroundColor ??= '#0A0A0C';
  f.primaryCategory ??= 'finance';
  f.tags ??= ['base', 'miniapp'];
  f.description ??= 'Built with BaseSkills miniapp shipbook defaults.';
  f.screenshotUrls ??= [normalizeToHttps(`${domain}/assets/cover-1200x630.png`)];
  f.heroImageUrl ??= normalizeToHttps(`${domain}/assets/cover-1200x630.png`);
  f.ogTitle ??= f.name;
  f.ogDescription ??= f.description;
  f.ogImageUrl ??= f.heroImageUrl;
  f.webhookUrl ??= normalizeToHttps(`${domain}/api/webhook/notifications`);

  await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + '\n');
  console.log(`✅ Auto-fixed manifest: ${manifestPath}`);
}

async function scaffold() {
  const name = args[1];
  if (!name) throw new Error('Missing app name: create-base-miniapp <name>');

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
  const content = `# ${name} — Base Mini App Engineering Playbook Plan\n\n## Auto-complete technical checklist\n- [ ] Scaffold app shell + manifest + webhook route\n- [ ] Implement accountAssociation in /.well-known/farcaster.json\n- [ ] Complete frame metadata (primaryCategory, tags, og fields, webhookUrl)\n- [ ] Wire wallet auth and keep flow in-app\n- [ ] Sponsor tx path via paymaster + fallback\n- [ ] Batch tx where applicable (EIP-5792)\n- [ ] Run preflight\n- [ ] Run verify against deployed URL\n- [ ] Run submit-ready and resolve blockers\n\n## ONLY remaining for UI/UX review\n- [ ] Visual direction and hierarchy\n- [ ] Microcopy tone and onboarding script\n- [ ] Empty/loading/error state polish\n- [ ] Motion tuning and tactile feel\n\n## Command flow\n\n\`\`\`bash\nbaseskills-miniapps create-base-miniapp ${name}\nbaseskills-miniapps preflight\nbaseskills-miniapps verify --url https://${name}.vercel.app\nbaseskills-miniapps can-submit --url https://${name}.vercel.app\n\`\`\`\n`;
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
    if (cmd === 'autofix') return await autoFix();

    console.log('Usage:');
    console.log('  baseskills-miniapps create-base-miniapp <name>');
    console.log('  baseskills-miniapps preflight [--manifest <path>]');
    console.log('  baseskills-miniapps verify --url <https://app.vercel.app>');
    console.log('  baseskills-miniapps submit-ready --url <https://app.vercel.app> [--json]');
    console.log('  baseskills-miniapps ship-report --url <https://app.vercel.app> [--json]');
    console.log('  baseskills-miniapps shipbook-plan <name> [--out ./plan.md]');
    console.log('  baseskills-miniapps autofix [--manifest <path>]');
    process.exit(1);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
})();
