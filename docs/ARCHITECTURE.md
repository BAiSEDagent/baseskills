# baseskills architecture

## Goal
Convert Base docs + featured requirements into deterministic, executable workflows.

## Plan
- Rule engine layer (versioned doc-derived constraints)
- Skill runtime layer (OpenClaw skill surfaces)
- CLI layer (`baseskills` + module commands)
- CI layer (submit blockers / feature risks / growth gaps)

## First integration
`packages/miniapps` uses the existing `base-miniapp-pipeline` command model:
- `create-base-miniapp`
- `preflight`
- `verify`
- `can-submit`
- `ship-report`
- `shipbook-plan`
