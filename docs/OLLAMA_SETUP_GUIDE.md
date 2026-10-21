# AltSpace Local AI: Complete Ollama Setup & Optimization Guide

Welcome to local, private developer intelligence. AltSpace is built with a **Zero-Tax Local AI** philosophy: you can run state-of-the-art open-source LLMs directly on your Windows PC with **100% privacy, zero subscription fees, zero token limits, and zero cloud telemetry**.

This guide walks you through installing, configuring, and optimizing [Ollama](https://ollama.com/) for AltSpace on Windows 10 & 11 in under 3 minutes.

---

## 🚀 Quick Start (Under 2 Minutes)

### Method 1: Via Windows Terminal (Recommended)

Open **PowerShell** or **Windows Terminal** and run:

```powershell
winget install Ollama.Ollama
```

*Press `Y` if prompted to accept source agreements.*

### Method 2: Direct Installer

1. Download the official Windows installer from: **[ollama.com/download/windows](https://ollama.com/download/windows)**
2. Double-click `OllamaSetup.exe` and follow the prompt.
3. Once installed, Ollama will automatically start as a background service and display an icon in your Windows taskbar system tray.

### Step 2: Verify Installation

Open a terminal and run:

```powershell
ollama --version
```

If it prints `ollama version 0.x.x`, Ollama is ready!

---

## 🧠 Choosing the Best Model for Your PC

Ollama allows you to pull and run models with a single command. Depending on your PC's available RAM and GPU VRAM, choose the model that fits your hardware:

| Model Name | Download Size | Minimum RAM / VRAM | Best For | Pull Command |
| :--- | :--- | :--- | :--- | :--- |
| **`llama3.2`** *(Recommended Default)* | ~2.0 GB | 8 GB RAM / 2 GB VRAM | Fast general questions, definitions, regex, shell syntax | `ollama run llama3.2` |
| **`qwen2.5-coder:7b`** | ~4.7 GB | 16 GB RAM / 6 GB VRAM | Elite coding, TypeScript, Rust, Python, Dockerfiles | `ollama run qwen2.5-coder:7b` |
| **`deepseek-r1:7b`** | ~4.7 GB | 16 GB RAM / 6 GB VRAM | Step-by-step reasoning, tricky debugging, algorithm design | `ollama run deepseek-r1:7b` |
| **`phi3.5`** | ~2.2 GB | 8 GB RAM / 2 GB VRAM | Ultra-efficient lightweight model designed by Microsoft | `ollama run phi3.5` |
| **`mistral:7b`** | ~4.1 GB | 16 GB RAM / 6 GB VRAM | Excellent balance of technical depth and creative writing | `ollama run mistral` |

### Starting Your First Model

To download and immediately test your model, run:

```powershell
ollama run llama3.2
```

Ollama will stream the download progress. Once downloaded, you can chat with it in the terminal, or simply close the terminal—Ollama keeps the model loaded in the background for AltSpace!

---

## ⚡ Using AI in AltSpace

Once Ollama is installed, AltSpace automatically detects it on `http://localhost:11434`.

1. Press <kbd>Alt</kbd> + <kbd>Space</kbd> anywhere in Windows.
2. Type `?` followed by your question:
   ```text
   ? how to write a rust function that reads a file asynchronously
   ```
   or
   ```text
   ? explain the difference between a mutex and a semaphore
   ```
3. AltSpace will stream the answer into the right-hand preview card.
4. Press <kbd>Enter</kbd> or click **Copy** to copy the code or answer directly to your clipboard.

> [!TIP]
> **Deterministic Fast Path (<1ms, No AI Required)**:
> Queries like `? fix 5173`, `? reclaim memory`, or `? clean docker` don't require Ollama at all. AltSpace uses a deterministic local rule engine to inspect ports, WSL distros, and Docker containers instantly.

---

## 🛠️ Windows Power User Configurations

### 1. Save C: Drive Space (Move Models to D: or E: Drive)

By default, Ollama stores downloaded models in `C:\Users\<YourUsername>\.ollama\models`. If your `C:` drive has limited space, you can easily point Ollama to a secondary SSD.

1. Create a folder on your other drive (e.g., `D:\OllamaModels`).
2. Open PowerShell as your standard user and run:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\OllamaModels', 'User')
   ```
3. Restart Ollama:
   - Right-click the Ollama llama icon in your system tray and click **Quit**.
   - Launch **Ollama** again from the Windows Start menu.
4. Future model downloads will now save directly to your `D:` drive!

### 2. Allow WSL2 & Docker Access (`OLLAMA_HOST`)

By default, Ollama only listens on `127.0.0.1`. If you want your WSL2 Linux distributions or Docker containers to talk to Ollama:

```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0:11434', 'User')
```

Then restart Ollama from your system tray.

### 3. GPU Hardware Acceleration

Ollama automatically detects and utilizes:
- **NVIDIA GPUs** (CUDA)
- **AMD GPUs** (ROCm)
- **Intel Arc GPUs**

To verify if your GPU is being used during inference, open Windows Task Manager (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Esc</kbd>) and watch the **GPU Dedicated Memory / Compute Engine** graph while AltSpace generates an answer.

---

## ❓ Troubleshooting & FAQs

### Q: AltSpace displays "Ollama is not running on localhost:11434"
- **Cause**: The Ollama background process is stopped or has not been installed yet.
- **Solution**: Search for **Ollama** in your Windows Start menu and launch it, or run `ollama serve` in a terminal. Check your system tray to ensure the Ollama icon is visible.

### Q: Port 11434 is already in use by another app
- **Solution**: Open AltSpace (<kbd>Alt</kbd>+<kbd>Space</kbd>), type `:11434` to find the process holding the port, and click **Kill Process** to free it.

### Q: Windows Defender / Firewall Warning
- **Solution**: When first launched, Windows Defender may ask if Ollama can accept connections. Click **Allow access** for **Private networks**.

### Q: Can I use cloud models like Claude 3.7 or GPT-4o instead?
- **Yes!** AltSpace includes a **BYOK (Bring Your Own Key)** hardware-secured vault.
- Press <kbd>Ctrl</kbd> + <kbd>,</kbd> to open AltSpace Settings.
- Under **Local Copilot**, add your Anthropic, OpenAI, or DeepSeek API key. Keys are encrypted with Windows DPAPI and never sent to any third party.

---

## 📚 Official Resources

- [Official Ollama Website](https://ollama.com/)
- [Ollama Model Library](https://ollama.com/library)
- [Official Ollama GitHub Repository](https://github.com/ollama/ollama)
- [AltSpace GitHub Repository](https://github.com/codecheesee/altspace)
