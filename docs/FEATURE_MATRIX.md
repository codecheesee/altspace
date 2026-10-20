# AltSpace Two-Layer Product Feature Matrix

This document defines the architectural and commercial boundaries of the AltSpace ecosystem under **Apache License 2.0**.

---

## 1. Architectural Model

AltSpace operates on a clean two-layer model:

- **Layer A (Free Open-Source Core)**: Apache 2.0 licensed desktop client, 100% functional offline, privacy-first, and fully modifiable. Anyone can fork, inspect, and build from source.
- **Layer B (Server-Controlled Commercial Services)**: Hosted cloud infrastructure, remote AI model routing, multi-device sync, and official signed distribution channels. These services require cryptographic server-side authorization.

A modified fork can remove local client checks in its own build, but it **cannot** access private server-side services without a valid, cryptographically signed server lease.

---

## 2. Definitive Feature Matrix

| Feature | Layer | Runs locally? | Requires server? | Free or Paid? | Requires account? | Requires approval? | Stores sensitive data? | Can work offline? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Application Launcher** | Layer A (Core) | Yes | No | **Free Forever** | No | No | No | Yes |
| **Local File & Folder Search** | Layer A (Core) | Yes | No | **Free Forever** | No | No | No | Yes |
| **Calculator & Unit Converter** | Layer A (Core) | Yes | No | **Free Forever** | No | No | No | Yes |
| **Windows Settings Shortcuts** | Layer A (Core) | Yes | No | **Free Forever** | No | No | No | Yes |
| **Port Inspector & Killer (`:port`)** | Layer A (Core) | Yes | No | **Free Forever** | No | Level 3 (terminate) | No | Yes |
| **In-Memory Clipboard Manager** | Layer A (Core) | Yes | No | **Free Forever** | No | No | Masked in RAM | Yes |
| **Dynamic Themes & Accent Colors** | Layer A (Core) | Yes | No | **Free Forever** | No | No | No | Yes |
| **Local `.altconfig` Import/Export** | Layer A (Core) | Yes | No | **Free Forever** | No | Level 2 (import) | No | Yes |
| **Local Ollama AI (`localhost:11434`)**| Layer A (Core) | Yes | No | **Free Forever** | No | Level 1 (prompt) | No | Yes |
| **Community Plugin Runner** | Layer A (Core) | Yes | No | **Free Forever** | No | Level 2 (install/run) | Confinement | Yes |
| **Multi-Drive File Search** | Layer A (Core) | Yes | No | Trial / Pro | No | Level 1 | No | Yes |
| **Native Shell Command Runner (`>`)** | Layer A (Core) | Yes | No | Trial / Pro | No | Level 3 (confirm) | No | Yes |
| **Hosted / Remote AI Models** | Layer B (Cloud)| No | Yes | **Paid (Pro)** | Yes (Device Flow) | Level 2 | In-Transit | No |
| **Multi-Device Cloud Sync** | Layer B (Cloud)| Hybrid | Yes | **Paid (Pro)** | Yes | Level 2 | Encrypted | Grace Period |
| **Team Command Palette & Snippets**| Layer B (Cloud)| Hybrid | Yes | **Paid (Pro/Team)** | Yes (SSO/OAuth) | Level 2 | Encrypted | Grace Period |
| **Verified Plugin Marketplace** | Layer B (Cloud)| Hybrid | Yes | **Free/Paid** | Optional | Level 2 (install) | Verified Signatures | Cached |
| **Signed Entitlement Leases** | Layer B (Cloud)| Hybrid | Yes | **Commercial** | Yes | Level 1 (verify) | DPAPI Vault | 7-day Grace |
| **Official Signed Releases (Authenticode/MSIX)** | Layer B (Official) | Yes | CI/Release | **Official Brand** | No | No | No | Yes |

---

## 3. Quota & Trial Policy within the Matrix

- **Unmetered Forever (Zero Quota)**: App launching, local file search, calculator, settings, dev ports, clipboard, themes, `.altconfig`, and local Ollama inference.
- **Trial Actions (100 actions / 30-day window, warn at 80)**: Advanced local operations (explicit multi-drive indexing, direct terminal command runner) before requiring a Supporter or Pro license.
- **Server Gated**: Hosted AI APIs, cloud sync, team snippets, and commercial entitlement leases cannot be unlocked merely by patching local client binaries; requests to official servers will fail closed without a valid cryptographic signature.
