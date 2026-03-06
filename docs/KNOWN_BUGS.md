# Smart Contract Known Bug Registry

> Run this checklist BEFORE writing any new contract code or deployment script.
> Every entry is a real bug that was shipped or nearly shipped. Learn once, block forever.

---

## B001 — Wrong contract address in env (no bytecode)
**Project:** BaseRank (2026-03-06)  
**Symptom:** viem throws `Address invalid` or tx silently fails  
**Root cause:** Vercel env had a stale/wrong contract address with no deployed bytecode  
**Gate:** Run `cast code $MARKET_ADDRESS --rpc-url <rpc> | wc -c` — must be >3  
**Rule:** Always cross-check env address against on-chain bytecode after every deploy

---

## B002 — Sequential epochId instead of date-based
**Project:** BaseRank (2026-03-06)  
**Symptom:** Contract reverts `InvalidState` — market doesn't exist for that epoch  
**Root cause:** `WEEK_ID = BigInt(1)` hardcoded; contract uses `uint64 epochId = 20260306`  
**Gate:** Check contract's `marketState(epochId, marketType)` returns 1 (Open) before submitting  
**Rule:** Never use sequential integers for epochId on date-keyed contracts

---

## B003 — openTime = block.timestamp (race condition)
**Project:** BaseRank OpenMarkets.s.sol (2026-03-06)  
**Symptom:** `openMarket()` reverts `InvalidTime` on broadcast  
**Root cause:** `block.timestamp` in Forge script ≠ block.timestamp at tx execution  
**Gate:** Always use `block.timestamp + 30 minutes` minimum buffer  
**Rule:** Never set openTime = block.timestamp in deployment scripts

---

## B004 — Candidate count below MIN_CANDIDATES
**Project:** BaseRank OpenMarkets.s.sol (2026-03-06)  
**Symptom:** `openMarket()` reverts `InvalidConfig`  
**Root cause:** Script built 10-element arrays; contract enforces MIN_CANDIDATES=15  
**Gate:** `assert(candidates.length >= MIN_CANDIDATES && candidates.length <= MAX_CANDIDATES)`  
**Rule:** Always read contract constants before building candidate arrays

---

## B005 — Mixed environment config (mainnet + testnet vars simultaneously)
**Project:** BaseRank (2026-03-06)  
**Symptom:** CDP error logs show mainnet billing rejection; paymaster never hits correct chain  
**Root cause:** PAYMASTER_URL pointed at mainnet while contract was on Sepolia  
**Gate:** Run `baseskills env-check mainnet` before every prod deploy  
**Rule:** All env vars must point at the same network — no mixing

---

## B006 — Raw address string not normalized through getAddress()
**Project:** BaseRank (2026-03-06)  
**Symptom:** viem throws `Address "0x..." is invalid` even for correct addresses  
**Root cause:** Env var stored with wrong EIP-55 mixed-case checksum; viem strict-validates  
**Gate:** Always wrap env addresses: `getAddress(process.env.ADDRESS)`  
**Rule:** Never cast env address strings directly as `0x${string}` without normalization

---

## B007 — Silent fallback masking specific tx failure
**Project:** BaseRank (2026-03-06)  
**Symptom:** User sees generic toast "sponsored path unavailable"; actual error unknown  
**Root cause:** Outer catch swallowed all error types with one handler  
**Gate:** Every catch block must log specific error reason (`permit_sign_failed`, `sponsored_send_failed`, etc.)  
**Rule:** Never use bare `catch {}` on transaction flows — always label and surface the failure stage

---

## B008 — permit_sign_failed in Base App embedded wallet context
**Project:** BaseRank (2026-03-06)  
**Symptom:** `signTypedDataAsync` throws in Base App runtime; permit path always fails  
**Root cause:** Base App's embedded wallet does not support `eth_signTypedData` for USDC permit  
**Gate:** Test permit flow in desktop Coinbase Wallet extension, not Base Builder preview  
**Rule:** Always gate permit path with wallet capability check; graceful fallback to `predict()` required

---

## Pre-Build Checklist (run before writing any contract or deployment script)

- [ ] B001: Is contract address verified on-chain? (`cast code`)
- [ ] B002: Is epochId format correct for this contract?
- [ ] B003: Is openTime buffered at least 30 min from now?
- [ ] B004: Does candidate count satisfy MIN/MAX constants?
- [ ] B005: Do all env vars point at the same network? (`baseskills env-check`)
- [ ] B006: Are all address env vars wrapped in `getAddress()`?
- [ ] B007: Does every catch block surface a specific error label?
- [ ] B008: Is wallet capability checked before permit path?

---

## External Security Tools
- **Codex Security** (OpenAI) — agentic SSRF, auth, cross-tenant vuln detection  
  https://openai.com/index/codex-security-now-in-research-preview/  
  Use for: full repo scans before mainnet deploy; replaces manual triage for common web2 vulns
- **Slither** — static analysis for Solidity
- **Foundry fuzz tests** — property-based testing for contract invariants
- **gitleaks** — secret scanning before every push
