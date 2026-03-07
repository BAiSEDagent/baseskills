
---

## Step 10 — Register in Warpcast Developer Settings (REQUIRED)

**This step is mandatory before the app is testable or submittable.**

Even with a perfect manifest and account association, the mini app will NOT:
- Appear in Base App search
- Auto-connect the frame wallet (`farcasterFrame` connector)
- Show in `accounts.base.org` connected apps

**How to register:**
1. Open Warpcast on mobile
2. Settings → Developer → Mini Apps
3. Tap "Add" → enter your domain (e.g. `baserank-miniapp.vercel.app`)
4. Warpcast reads the manifest and registers the app to your FID
5. App is now testable inside Base App and the frame wallet initializes

**Gate rule:** R203 — `warpcast_developer_registration`  
**Severity:** SUBMIT BLOCKER

**Lesson learned (BaseRank 2026-03-06):** Spent time debugging wallet connection failures. Root cause was missing Warpcast registration. The farcasterFrame connector requires the app to be registered to receive the frame context from the host client.
