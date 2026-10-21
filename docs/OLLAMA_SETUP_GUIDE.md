# AltSpace Local AI: Ollama Setup and Configuration Guide

This document describes the installation, configuration, and optimization procedures for running local language models with AltSpace on Windows 10 and Windows 11 (x64) via [Ollama](https://ollama.com/).

AltSpace connects to Ollama endpoints running on `localhost:11434` using standard HTTP and Model Context Protocol (MCP) conventions. All model inference occurs locally on device with zero cloud data transmission, zero subscription fees, and no external API keys required.

---

## 1. Installation

### Option A: Windows Package Manager (winget)

Execute the following command in PowerShell or Windows Terminal:

```powershell
winget install Ollama.Ollama
```

### Option B: Executable Installer

1. Download the installer from the official distribution endpoint: [ollama.com/download/windows](https://ollama.com/download/windows).
2. Run `OllamaSetup.exe` to complete the installation.
3. The installer registers `ollama.exe` in the system path (`%LOCALAPPDATA%\Programs\Ollama`) and launches the background daemon in the Windows notification area (system tray).

### Verification

Verify that the CLI binary is available and listening:

```powershell
ollama --version
```

Verify that the local API endpoint responds:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags"
```

---

## 2. Model Selection and Memory Profiles

Local model selection depends on the host system memory and GPU VRAM capacity:

| Model Identifier | Parameter Count | Disk Footprint | Minimum Memory / VRAM | Recommended Workload | Pull Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `llama3.2` | 3B | ~2.0 GB | 8 GB RAM / 2 GB VRAM | Fast general queries, syntax explanation, terminal assistance | `ollama run llama3.2` |
| `qwen2.5-coder:7b` | 7B | ~4.7 GB | 16 GB RAM / 6 GB VRAM | Source code generation, TypeScript, Rust, PowerShell | `ollama run qwen2.5-coder:7b` |
| `deepseek-r1:7b` | 7B | ~4.7 GB | 16 GB RAM / 6 GB VRAM | Multi-step reasoning, architectural planning, debugging | `ollama run deepseek-r1:7b` |
| `phi3.5` | 3.8B | ~2.2 GB | 8 GB RAM / 2 GB VRAM | Low-footprint reasoning and text structuring | `ollama run phi3.5` |
| `mistral:7b` | 7B | ~4.1 GB | 16 GB RAM / 6 GB VRAM | Technical summarization and command translation | `ollama run mistral` |

### Pulling a Model

To download and initialize the default recommended model, execute:

```powershell
ollama run llama3.2
```

Once the model weights are retrieved, the Ollama service maintains the model in memory. The terminal window may be closed; AltSpace communicates directly with the background daemon.

---

## 3. AltSpace Integration

Once the Ollama daemon is active on `http://localhost:11434`, AltSpace detects the endpoint automatically.

1. Invoke the AltSpace palette using the global hotkey (`Alt + Space`).
2. Prefix queries with `?`:
   ```text
   ? explain how to configure windows named pipes in rust
   ```
3. AltSpace streams the response tokens into the contextual preview pane.
4. Press <kbd>Enter</kbd> or click **Copy** to place the result on the system clipboard.

> [!NOTE]
> **Deterministic Fast-Path Execution**:
> Commands such as `? fix 5173`, `? reclaim memory`, and `? clean docker` do not execute model inference. They are evaluated in under 1 millisecond by AltSpace's local deterministic rule engine, which directly queries Win32 network tables, Hyper-V interfaces, and Docker daemon sockets.

---

## 4. Host Environment Configuration

### Custom Storage Path (`OLLAMA_MODELS`)

By default, model blobs are stored under `%USERPROFILE%\.ollama\models`. To store weights on a secondary storage volume:

1. Create a target directory (for example, `D:\OllamaModels`).
2. Set the environment variable via PowerShell:
   ```powershell
   [System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\OllamaModels', 'User')
   ```
3. Restart the Ollama daemon via the system tray context menu.

### Network Binding for WSL2 and Containers (`OLLAMA_HOST`)

By default, Ollama binds exclusively to the loopback interface (`127.0.0.1:11434`). To permit inbound connections from WSL2 distributions or local Docker containers:

```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0:11434', 'User')
```

Restart the daemon after modifying this variable.

### Hardware Acceleration

Ollama automatically detects and initializes supported compute backends:
- NVIDIA GPUs via CUDA
- AMD GPUs via ROCm
- Intel GPUs via oneAPI / Level Zero

GPU offloading and layer allocation can be verified during generation via Windows Task Manager (`Ctrl + Shift + Esc`) under the Performance tab.

---

## 5. Troubleshooting

### Port Collision (11434)
If port 11434 is occupied by an external service, query the owning process using AltSpace:
1. Type `:11434` into the AltSpace omnibar.
2. Review the process identifier and binary name.
3. Terminate the blocking process using the palette action.

### Connection Timeout
If AltSpace indicates that Ollama is offline:
1. Verify that `ollama.exe` is running in Task Manager.
2. Check `http://127.0.0.1:11434/api/tags` in a browser or via `curl.exe http://127.0.0.1:11434/api/tags`.
3. If the daemon is stopped, start it via the Start Menu shortcut or by running `ollama serve`.

### Alternative Cloud Inference (BYOK)
For users requiring frontier cloud models alongside local inference, AltSpace includes a hardware-backed DPAPI key vault:
1. Press `Ctrl + ,` to open Settings.
2. Select **Local Copilot**.
3. Provide an Anthropic, OpenAI, or DeepSeek API key. The key is encrypted via Windows DPAPI and stored locally without external telemetry.

---

## 6. Upstream Documentation

- [Ollama Official Documentation](https://ollama.com/)
- [Ollama Model Repository](https://ollama.com/library)
- [Ollama GitHub Project](https://github.com/ollama/ollama)
