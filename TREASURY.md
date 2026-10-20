# AltSpace Contributor Treasury & Governance Charter

This document outlines the financial allocation, legal payout rails, and bounty distribution model for **AltSpace**.

---

## 1. Core Economic Model (The 70 / 20 / 10 Split)

AltSpace operates as an **Open-Core Sustainable Ecosystem**. All source code is 100% free under the **Apache 2.0 License**. Revenue generated from pre-built signed binaries, enterprise packages, and Supporter Licenses is distributed according to this transparent formula:

```
                      ┌──────────────────────────────────────────────┐
                      │         TOTAL SUPPORTER REVENUE (100%)       │
                      └──────────────────────┬───────────────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
  ┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
  │     FOUNDER / OWNER       ││   CONTRIBUTOR TREASURY    ││  INFRA & SECURITY RESERVE │
  │           70%             ││           20%             ││           10%             │
  ├───────────────────────────┤├───────────────────────────┤├───────────────────────────┤
  │ • Core Rust engine design ││ • Funded GitHub Bounties  ││ • Authenticode EV Signing │
  │ • Win32 API low-level dev ││ • Community plugin grants ││   (removes SmartScreen)   │
  │ • Security & code reviews ││ • Bug hunter rewards      ││ • Build runners & CDN     │
  │ • Releases & operations   ││ • Docs & translations     ││ • Domain & infrastructure │
  └───────────────────────────┘└───────────────────────────┘└───────────────────────────┘
```

---

## 2. Direct Creator Sponsorships (100% to Authors)

In addition to the public Bounty Treasury:
- **Zero Platform Fee**: Every extension listed in the AltSpace Community Store includes a direct **"Tip Creator"** button linking to the author's personal GitHub Sponsors, Ko-fi, or BuyMeACoffee.
- **Direct Payout**: 100% of user tips go directly to the creator without AltSpace taking any intermediary cut or commission.

---

## 3. Bounty Tiers & Reward Schedule

Bounties are posted publicly on GitHub Issues and tagged with the [`bounty`](https://github.com/codecheesee/altspace/labels/bounty) label:

| Tier | Complexity | Bounty (INR) | Bounty (USD Equiv) | Example Deliverable |
| :---: | :--- | :---: | :---: | :--- |
| **Tier 1** | Minor Bug / Small Script | **₹1,000** | ~$12 | Fix a window positioning edge case or add a simple PowerShell script |
| **Tier 2** | Standard Community Extension | **₹2,000 – ₹3,500** | ~$25 – ~$42 | Bluetooth device switcher, Spotify controller, Obsidian note appender |
| **Tier 3** | Complex System Integration | **₹5,000 – ₹10,000** | ~$60 – ~$120 | Virtual desktop manager, GPU switcher, multi-monitor display profile manager |

---

## 4. Legal & Tax-Compliant Payout Rails

To protect both contributors and the project maintainer from cross-border tax liabilities:

1. **Merchant of Record (MoR) Integration**:
   - Payouts are handled via **Polar.sh** or **Open Collective**.
   - The platform acts as the legal Merchant of Record, automatically collecting required tax forms:
     - **Non-US Contributors**: Automatic W-8BEN filing.
     - **Indian Contributors**: PAN verification and TDS compliance.
     - **US Contributors**: Form 1099 generation.
2. **Global Payout Rails**:
   - Funds are disbursed directly to contributors via **Stripe Connect, Local Bank Transfer, or PayPal** in their local currency without exorbitant wire transfer fees.
3. **Founder Non-Liability**:
   - The maintainer does not act as an escrow middleman or employer. You receive your bounty as an independent open-source grant or contractor payment.

---

## 5. How to Claim a Bounty

1. **Find an Open Bounty**: Browse issues labeled [`bounty:open`](https://github.com/codecheesee/altspace/labels).
2. **Comment to Claim**: Post a comment on the issue stating your intent to work on it and outlining your proposed architectural approach. A maintainer will assign the issue to you.
3. **Submit Your Pull Request**:
   - Reference the issue (e.g., `Resolves #42`).
   - Ensure all automated checks pass:
     - `cargo test` in `frontend/src-tauri` (all 26+ tests must pass).
     - `npm run build` in `frontend` (zero TypeScript or Vite errors).
     - Respect security boundaries (no hardcoded path escapes, enforce timeouts).
4. **Merge & Payout**:
   - Once the PR is reviewed and merged into `main`, the bounty is automatically awarded to your connected Polar.sh or GitHub Sponsors account!

---

## 6. Anti-Spam & Quality Standards

To ensure long-term health and prevent PR spam:
- Low-effort, auto-generated, or AI-hallucinated PRs that do not add genuine utility will be rejected.
- Trivial 1-line changes or typo fixes do not qualify for cash bounties.
- All extensions must adhere to AltSpace's sandboxing rules (path validation, execution timeouts, non-destructive execution).
