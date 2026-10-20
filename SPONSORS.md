# AltSpace Sponsorship & Supporter License Specification

AltSpace is an open-source productivity platform funded through a transparent combination of community sponsorships and optional Supporter Licenses. All core application features remain permanently free under the Apache License 2.0.

---

## Supporter Licensing Schedule

To ensure accessibility for developers across differing economic regions, AltSpace utilizes a standardized **Purchasing Power Parity (PPP)** pricing schedule:

| Tier | Domestic (India) | International (Global) | Deliverables and Entitlements |
| :--- | :---: | :---: | :--- |
| **Community (Core)** | **₹0** | **$0** | Full access to Apache-2.0 core, sub-5ms search, dev port inspector, clipboard manager, local MCP AI execution, and community extensions. |
| **Supporter Annual** | **₹299 / year** | **$12 / year** | All core capabilities, Supporter badge in desktop UI, voting rights on GitHub bounty allocations, and priority issue triage. |
| **Team / Organization (5 Seats)** | **₹1,499 / year** | **$49 / year** | 5 multi-user license seats, shared internal extension directories, and priority technical consultation. |

---

## Revenue Distribution

All revenue collected from Supporter Licenses is audited and distributed according to the [AltSpace Treasury Governance Charter](TREASURY.md):
- **70%**: Dedicated core Rust systems engineering, performance optimizations, and security maintenance.
- **20%**: Deposited directly into the public GitHub Contributor Bounty Treasury for community developers.
- **10%**: Allocated to infrastructure, continuous integration runners, and Windows Authenticode EV code signing certificates.

---

## License Key Activation

AltSpace supporter keys are cryptographically validated offline without mandatory cloud telemetry.

1. Obtain a license key through the official checkout portal ([Polar.sh](https://polar.sh) or [GitHub Sponsors](https://github.com/sponsors/codecheesee)).
2. Keys follow the standardized format:
   ```text
   ALTSP-SUPPORTER-YYYYMMDD-HASH
   ```
3. Open AltSpace (<kbd>Alt</kbd> + <kbd>Space</kbd>).
4. Navigate to the Supporter modal by typing `:license` or clicking the **Supporter** indicator in the footer bar.
5. Enter the license key and select **Activate**. The supporter status will persist in local application storage.
