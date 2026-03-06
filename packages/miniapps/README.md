# @baised/baseskills-miniapps

Mini app shipping module for Base.

## CLI

```bash
baseskills-miniapps create-base-miniapp <name>
baseskills-miniapps preflight
baseskills-miniapps verify --url https://your-app.vercel.app
baseskills-miniapps can-submit --url https://your-app.vercel.app
baseskills-miniapps ship-report --url https://your-app.vercel.app [--json]
baseskills-miniapps shipbook-plan <name>
baseskills-miniapps autofix [--manifest public/.well-known/farcaster.json]
```

Implements shipbook gates with output buckets:
- SUBMIT BLOCKER
- FEATURE RISK
- GROWTH GAP

## Critical learned steps
- Always call `sdk.actions.ready()` from `@farcaster/miniapp-sdk` on app mount.
- Without this, Builder shows `Ready call: Not Ready` even if manifest is valid.
- Before submission, explicitly confirm contract deployment status (Sepolia test vs Base mainnet live).
- Never claim "live" onchain unless Base mainnet contract address + tx are verified.

## Ruleset
- `rules/base-v2026-03-05.json`
- `ship-report` prints rule IDs for traceability.
