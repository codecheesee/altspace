# AltSpace Contributor Treasury & Governance Specification

This document defines the financial architecture, allocation guidelines, legal framework, and bounty disbursement procedures governing the **AltSpace** open-source project.

---

## 1. Economic Framework: The 70 / 20 / 10 Revenue Allocation

AltSpace is maintained as an open-core, sustainable engineering project. All core source code is licensed under the **Apache License 2.0**. Revenue generated from optional Supporter Licenses, commercial support, and enterprise tooling is partitioned strictly according to the following audited allocation schedule:

```
                      ┌──────────────────────────────────────────────┐
                      │         TOTAL SUPPORTER REVENUE (100%)       │
                      └──────────────────────┬───────────────────────┘
                                             │
                ┌─────────────────────────────┼─────────────────────────────┐
                ▼                             ▼                             ▼
   ┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
   │     CORE MAINTENANCE      ││   CONTRIBUTOR TREASURY    ││  INFRASTRUCTURE & COMPLIANCE│
   │           70%             ││           20%             ││           10%             │
   ├───────────────────────────┤├───────────────────────────┤├───────────────────────────┤
   │ • Rust backend engineering││ • Funded GitHub Bounties  ││ • Windows EV Code Signing │
   │ • Low-level Win32 systems ││ • Extension development   ││   (Authenticode certs)    │
   │ • Security reviews & CVEs ││ • Critical bug fixes      ││ • Build runners & CI/CD   │
   │ • Release engineering     ││ • Performance enhancements││ • Infrastructure hosting  │
   └───────────────────────────┘└───────────────────────────┘└───────────────────────────┘
```

### Allocation Breakdown
1. **70% — Core Maintenance and Engineering**:
   Allocated directly to lead maintainers for full-time engineering, architecture design, low-level Win32 integration, security audits, and continuous maintenance.
2. **20% — Public Contributor Bounty Treasury**:
   Reserved exclusively for community contributors who author approved extensions, fix verified bugs, or implement prioritized system features.
3. **10% — Infrastructure, Signing, and Compliance**:
   Dedicated to project overhead, including Windows Authenticode Extended Validation (EV) code signing certificates to ensure clean SmartScreen verification, high-performance CI build runners, and domain infrastructure.

---

## 2. Creator Sponsorships and Tipping Policy

AltSpace supports independent open-source developers through direct monetization rails:
- **Zero Intermediation**: Extension author cards displayed within the in-app Store include direct links to the author's independent sponsorship profile (GitHub Sponsors, Ko-fi, BuyMeACoffee).
- **100% Retained by Authors**: AltSpace retains zero commission, processing fee, or take-rate from direct community tips sent to extension developers.

---

## 3. Bounty Classification and Valuation Matrix

When funds accumulate in the Contributor Treasury, maintainers allocate bounties to public GitHub issues labeled [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty). Bounties adhere to the following complexity tiers:

| Tier | Category | Valuation (INR) | Valuation (USD Equiv.) | Scope and Qualifying Criteria |
| :---: | :--- | :---: | :---: | :--- |
| **Tier 1** | Maintenance & Small Utilities | **₹1,000** | ~$12 | Edge-case bug resolutions, localized script utilities, documentation or translation packs. |
| **Tier 2** | Standard Community Extensions | **₹2,000 – ₹3,500** | ~$25 – ~$42 | Fully functional extension package with manifest, error handling, and icon assets (e.g. Docker, Spotify, Obsidian). |
| **Tier 3** | Core Systems Integration | **₹5,000 – ₹10,000** | ~$60 – ~$120 | Complex low-level Win32 integrations, IPC pipelines, performance optimizations, or virtual desktop subsystem enhancements. |

---

## 4. Legal Compliance and Cross-Border Tax Architecture

To adhere to international financial and tax regulations, all disbursements from the Contributor Treasury operate through a designated **Merchant of Record (MoR)**:

1. **Merchant of Record Protocol**:
   - Payouts are executed via **Polar.sh** or **Open Collective**.
   - The MoR assumes legal responsibility as the disbursement entity and manages automated tax compliance:
     - **United States Residents**: Automated generation and filing of IRS Form 1099.
     - **Non-US Contributors**: Automated submission and verification of IRS Form W-8BEN / W-8BEN-E.
     - **Indian Contributors**: PAN collection and compliance with Tax Deducted at Source (TDS) under applicable provisions of the Indian Income Tax Act.
2. **Disbursement Channels**:
   - Payouts are transferred through Stripe Connect, standard wire transfer, or direct bank deposit in the recipient's domestic currency.
3. **Independent Contractor Status**:
   - Contributors receive bounty payments strictly as independent open-source grant recipients or external contractors. Bounty awards do not establish an employer-employee relationship or partnership with the maintainers of AltSpace.

---

## 5. Contribution and Bounty Disbursement Protocol

To claim a funded bounty, contributors must follow this procedural workflow:

1. **Identify a Funded Issue**:
   Select an open issue labeled [`bounty`](https://github.com/codecheesee/altspace/issues?q=is%3Aissue+is%3Aopen+label%3Abounty).
2. **Intent to Implement**:
   Submit a comment on the target issue outlining the proposed technical design, target APIs, and test strategy. A repository maintainer will review the approach and assign the issue.
3. **Pull Request Requirements**:
   - The pull request must reference the issue number.
   - All automated continuous integration checks must pass:
     - `cargo test` in `frontend/src-tauri` (all unit and integration tests).
     - `npm run build` in `frontend` (zero TypeScript and bundling errors).
     - Full compliance with capability broker policies, input sanitization, and cryptographic manifest standards.
4. **Code Review, Merge, and Disbursement**:
   Upon formal code review approval and merge into the `main` branch, the bounty is released via the connected Polar.sh or Open Collective payout rail.

---

## 6. Quality Assurance and Anti-Abuse Standards

To preserve the architectural integrity of the AltSpace ecosystem:
- Low-effort pull requests, automated AI-generated submissions without human review, and trivial aesthetic modifications are strictly ineligible for bounty compensation.
- Security-sensitive contributions must demonstrate memory safety, sanitize input parameters, and prevent execution privilege escalation.
