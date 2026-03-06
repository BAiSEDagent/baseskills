# baseskills

Base-native skill system inspired by ETHSkills, focused on executable workflows.

## Modules
- `packages/core` — base primitives (auth, paymaster, batching, manifests)
- `packages/miniapps` — mini app scaffolding + submit gates
- `packages/contracts` — contract + deploy + audit workflows
- `packages/growth` — discovery, sharing, retention patterns
- `packages/ci` — policy checks and PR gate integrations

## Status
- v0 scaffold initialized
- `@baised/baseskills-miniapps` now imports shipbook CLI from `base-miniapp-pipeline` as module #1

## Next Milestones
1. Import miniapp shipbook rules from `base-miniapp-pipeline`
2. Add machine-checkable Base docs ruleset
3. Publish first installable skill bundle

## Masterplan
- `docs/V1_MASTERPLAN.md`
