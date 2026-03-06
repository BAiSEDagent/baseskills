# BaseSkills V1 Masterplan

## Vision
Build the best Base operator hub: from zero context to production-ready, featured-grade mini app and secure onchain deployment faster than any competing workflow.

## Product Thesis
BaseSkills is not a docs mirror. It is an execution system with hard gates and deterministic outputs.

## User Promise
If you know nothing about Base, BaseSkills gets you to a launch-ready app with clear next actions and no hidden blockers.

---

## Architecture

### Layer 1 — Academy (compressed knowledge)
- Fast-start tracks (30–90 mins)
- Anti-patterns and failure mode library
- Base-specific checklists only

### Layer 2 — Execution (commands)
- `baseskills miniapps scaffold`
- `baseskills miniapps preflight`
- `baseskills miniapps verify`
- `baseskills miniapps can-submit`
- `baseskills contracts deploy-safe`
- `baseskills growth launch-check`

### Layer 3 — Governor (policy gates)
- SUBMIT BLOCKER
- FEATURE RISK
- GROWTH GAP
- fail closed on blockers with exact remediation commands

---

## V1 Module Scope

### `@baised/baseskills-core`
- environment sanity checks
- Base network/config presets
- shared validators

### `@baised/baseskills-miniapps`
- shipbook command suite
- manifest/embed/accountAssociation validation
- webhook and metadata verification

### `@baised/baseskills-contracts`
- secure deployment flow
- verification and role checks
- threat model + test gate wrappers

### `@baised/baseskills-growth`
- onboarding and referral loops
- notification cadence linting
- launch-readiness scoring

### `@baised/baseskills-ci`
- GitHub Action pack
- PR gating with blocker/risk/gap sections
- release evidence artifacts

---

## Quality Bar (non-negotiable)
- every command returns machine-checkable evidence
- no "done" without tests + security checks + deploy verification
- no silent pass states: every failure includes exact fix instructions
- production URL checks are mandatory
- deployment truth labeling is mandatory: explicitly state `Sepolia-tested` vs `Base mainnet live`
- never claim mainnet live without verified mainnet contract address + transaction evidence

---

## 30-Day Delivery Plan

### Week 1 — Foundation
- finalize CLI architecture and config format
- import `base-miniapp-pipeline` into `packages/miniapps`
- publish internal command map and rule schema

### Week 2 — Miniapps Excellence
- implement submit gate categories with full Base docs mapping
- add accountAssociation verification
- add embed metadata validation and preview probes

### Week 3 — Contracts + CI
- contracts safe deploy flow and required checks
- CI action for submit blocker enforcement
- release report generation

### Week 4 — Growth + Packaging
- growth diagnostics module
- docs site + examples
- package and release first public alpha

---

## Backlog (Priority Ordered)

1. Wire `base-miniapp-pipeline` into `@baised/baseskills-miniapps`
2. Implement versioned Base ruleset (`rules/base-vYYYY-MM-DD.json`)
3. Add live embed metadata checks
4. Add webhook synthetic POST test and schema assertions
5. Add accountAssociation signature/domain verifier
6. Add auth-flow lint rules (no forced external redirects)
7. Add paymaster/fallback requirement checks
8. Add EIP-5792 capability checks
9. Add CI templates and GitHub Action
10. Add `ship-report` markdown + json outputs

---

## Competitive Advantages vs ETHSkills
- Base-native constraints encoded as runnable rules
- live production verification (not static guidance)
- deterministic output for submission readiness
- integrated growth and distribution loops
- policy-enforced quality gates

---

## Definition of V1 Success
- New builder can ship a valid Base mini app in <72h
- `can-submit` catches >95% of preventable submission failures
- teams adopt CI gate to prevent regressions before merge
- reusable template + workflow beats current ad-hoc build time by 3x
