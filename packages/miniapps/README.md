# @baised/baseskills-miniapps

Mini app shipping module for Base.

## CLI

```bash
baseskills-miniapps create-base-miniapp <name>
baseskills-miniapps preflight
baseskills-miniapps verify --url https://your-app.vercel.app
baseskills-miniapps can-submit --url https://your-app.vercel.app
baseskills-miniapps ship-report --url https://your-app.vercel.app
baseskills-miniapps shipbook-plan <name>
```

Implements shipbook gates with output buckets:
- SUBMIT BLOCKER
- FEATURE RISK
- GROWTH GAP

## Ruleset
- `rules/base-v2026-03-05.json`
- `ship-report` prints rule IDs for traceability.
