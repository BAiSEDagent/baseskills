# Lesson: Multi-Environment Config Mismatch (BaseRank Launch Debug)

**Date:** 2026-03-06  
**Project:** BaseRank mini app  
**Time lost:** ~6 hours  
**Root cause:** Three environment variables pointing at three different networks simultaneously.

---

## What Happened

BaseRank was deployed with this broken config:

| Variable | Value | Expected |
|---|---|---|
| `PAYMASTER_URL` | `.../rpc/v1/base/...` (mainnet) | `.../rpc/v1/base-sepolia/...` (testnet) |
| `NEXT_PUBLIC_MARKET_ADDRESS` | `0x363423...` (no bytecode, wrong address) | `0xEfa149...` (actual Sepolia deployment) |
| `TARGET_CHAIN` in code | `baseSepolia.id` | consistent with contract |

Additionally:
- `WEEK_ID = BigInt(1)` hardcoded — contract uses date-based epochIds (`20260305`, `20260306`)
- USDC permit domain used `chainId: 84532` hardcoded instead of `base.id`
- Address checksum not normalized through `getAddress()` — viem rejected raw env var strings

All errors produced different symptoms, masking each other:
- Wrong contract address → `Address invalid` viem error (looked like checksum bug)
- Wrong paymaster URL → CDP error logs showed mainnet billing rejection
- Wrong epochId → contract would revert `InvalidState` (markets not open for epoch 1)

---

## Why It Happened

1. **No env-check gate** before deploy — config was never validated end-to-end as a set
2. **Multiple deploys across a session** with different env var versions accumulated drift
3. **Silent fallback** in the UI swallowed specific error reasons — user saw generic toast
4. **Wrong contract address in Vercel** — deployment broadcast JSON and Vercel env were never cross-checked after deploy

---

## Fixes Applied

1. Added `getAddress()` normalization for `NEXT_PUBLIC_MARKET_ADDRESS` at module load
2. Fixed `WEEK_ID` to match actual on-chain epochId (`20260306`)
3. Fixed `PAYMASTER_URL` to Base Sepolia endpoint
4. Fixed `NEXT_PUBLIC_MARKET_ADDRESS` to actual deployed contract (`0xEfa149...`)
5. Added explicit error labels in catch blocks (`permit_sign_failed`, `sponsored_send_failed`) — no more silent fallback
6. Added graceful fallback copy instead of scary error message
7. Built `env-check.js` gate in BaseSkills — validates all vars point to same network before deploy

---

## Rules Going Forward

### Rule 1: Always run `baseskills env-check mainnet` before prod deploy
```bash
PAYMASTER_URL=... NEXT_PUBLIC_MARKET_ADDRESS=... node baseskills/packages/miniapps/src/env-check.js mainnet
```

### Rule 2: Cross-check contract address after every deploy
```bash
cast code $NEXT_PUBLIC_MARKET_ADDRESS --rpc-url https://mainnet.base.org | wc -c
# Must be > 3. If 3 (= "0x\n"), address is wrong.
```

### Rule 3: epochId = date string, never sequential integers
BaseRankMarket uses `uint64 epochId` as a date: `20260306` = March 6 2026. Never use `1`, `2`, `3`.

### Rule 4: Never hardcode chainId — use chain constants
```ts
// ❌ Wrong
chainId: 84532

// ✅ Right
chainId: base.id  // or baseSepolia.id
```

### Rule 5: Always normalize addresses through getAddress()
```ts
// ❌ Wrong
const addr = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}`

// ✅ Right
const addr = process.env.NEXT_PUBLIC_MARKET_ADDRESS
  ? getAddress(process.env.NEXT_PUBLIC_MARKET_ADDRESS)
  : undefined
```

### Rule 6: Test permit path in desktop Coinbase Wallet, not Base Builder
Base Builder's embedded wallet does not support `eth_signTypedData` for USDC permit.
Always test transaction flows in desktop browser + Coinbase Wallet extension before declaring "working".

---

## Time Cost

~6 hours of debugging across two sessions that should have been a 15-minute env audit.
The `env-check` gate would have caught 4 of the 6 root causes in under 30 seconds.
