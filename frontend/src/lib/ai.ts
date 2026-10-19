/**
 * Local AI & LLM Engine for AltSpace (2026 Free & Open-Source Architecture)
 * Connects directly to local Ollama (http://localhost:11434) for zero-latency,
 * private, offline AI text generation with streaming support.
 */

export const OLLAMA_DEFAULT_HOST = "http://localhost:11434";
export const OLLAMA_DEFAULT_MODEL = "llama3.2"; // 100% free, fast local model

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
}

export async function checkOllamaAvailability(host = OLLAMA_DEFAULT_HOST): Promise<{
  isAvailable: boolean;
  version?: string;
  models?: string[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${host}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
      return { isAvailable: true, models };
    }
    return { isAvailable: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return {
      isAvailable: false,
      error: "Ollama service is not running or unreachable at " + host,
    };
  }
}

export async function streamOllamaResponse({
  prompt,
  model = OLLAMA_DEFAULT_MODEL,
  host = OLLAMA_DEFAULT_HOST,
  onToken,
  onDone,
  onError,
  signal,
}: {
  prompt: string;
  model?: string;
  host?: string;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: 0.7,
        },
      }),
      signal,
    });

    if (!res.ok) {
      onError(`Ollama error (${res.status}): ${res.statusText}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError("Streaming response body is unavailable.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            onToken(parsed.response);
          }
          if (parsed.done) {
            onDone();
            return;
          }
        } catch (_) {
          // Incomplete chunk
        }
      }
    }
    onDone();
  } catch (err: any) {
    if (err.name === "AbortError") {
      onDone();
      return;
    }
    onError(err.message || "Failed to communicate with local Ollama instance.");
  }
}
