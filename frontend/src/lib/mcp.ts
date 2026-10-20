/**
 * Model Context Protocol (MCP) Client for AltSpace (2026 Native Architecture)
 * Exposes local desktop capabilities (ports, files, terminal, window snapping)
 * to local AI models (Ollama / Llama 3.2 / Qwen 2.5) via standard tool specifications.
 */

import { tauriInvoke } from "./appStorage";

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export const ALTSPACE_MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: "kill_port",
    description: "Kills the running process occupying a specific TCP port (e.g. 3000, 5173, 8080)",
    parameters: {
      type: "object",
      properties: {
        port: {
          type: "number",
          description: "The TCP port number to free up",
        },
      },
      required: ["port"],
    },
  },
  {
    name: "list_listening_ports",
    description: "Lists all actively listening development ports, PIDs, and process names",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "search_files",
    description: "Searches local drives and workspace for files or applications matching a query",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The file name or pattern to search for",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "execute_shell_command",
    description: "Safely runs a command in PowerShell and captures stdout/stderr output",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The PowerShell command to execute",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "snap_window",
    description: "Snaps the foreground active window to a screen partition",
    parameters: {
      type: "object",
      properties: {
        position: {
          type: "string",
          description: "Target layout position",
          enum: ["left", "right", "top", "bottom", "maximize", "center"],
        },
      },
      required: ["position"],
    },
  },
];

export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    switch (toolName) {
      case "kill_port": {
        const port = Number(args.port);
        if (isNaN(port)) throw new Error("Invalid port number");
        const res = await tauriInvoke<string>("kill_process_by_port", { port });
        return { success: true, result: res || `Port ${port} terminated successfully.` };
      }

      case "list_listening_ports": {
        const ports = await tauriInvoke<any[]>("get_open_ports");
        const formatted = (ports || []).map((p) => ({
          port: p.port,
          process: p.process_name,
          pid: p.pid,
        }));
        return { success: true, result: formatted };
      }

      case "search_files": {
        const q = String(args.query || "");
        const results = await tauriInvoke<any[]>("search_apps_and_files", { query: q });
        return { success: true, result: (results || []).slice(0, 10) };
      }

      case "execute_shell_command": {
        const cmd = String(args.command || "");
        const res = await tauriInvoke<any>("execute_command", { command: cmd });
        return { success: true, result: res };
      }

      case "snap_window": {
        const pos = String(args.position || "maximize");
        await tauriInvoke("snap_window_action", { position: pos });
        return { success: true, result: `Window snapped to ${pos}` };
      }

      default:
        return { success: false, error: `Unknown MCP tool: ${toolName}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Intelligent Action Detector:
 * Checks if the user's natural language query matches an actionable local system task
 * (e.g. "kill port 3000", "free port 5173", "list ports", "snap left")
 */
export function detectActionIntent(query: string): {
  isAction: boolean;
  toolName?: string;
  args?: Record<string, any>;
  description?: string;
} {
  const q = query.trim().toLowerCase();

  // 1. Kill Port intent: "kill port 3000", "free port 8080", "kill :3000"
  const killPortMatch = q.match(/(?:kill|free|stop|close)\s+(?:port\s+)?:?(\d{2,5})/i);
  if (killPortMatch) {
    const port = parseInt(killPortMatch[1], 10);
    return {
      isAction: true,
      toolName: "kill_port",
      args: { port },
      description: `Kill process on port ${port}`,
    };
  }

  // 2. List ports intent: "list ports", "show ports", "open ports", "what ports are open"
  if (q.includes("list ports") || q.includes("show ports") || q.includes("open ports") || q.includes("what ports")) {
    return {
      isAction: true,
      toolName: "list_listening_ports",
      args: {},
      description: "List listening ports",
    };
  }

  // 3. Snap window intent: "snap left", "maximize window", "snap right"
  const snapMatch = q.match(/(?:snap|move window)\s+(left|right|top|bottom|maximize|center)/i);
  if (snapMatch) {
    const pos = snapMatch[1].toLowerCase();
    return {
      isAction: true,
      toolName: "snap_window",
      args: { position: pos },
      description: `Snap active window to ${pos}`,
    };
  }

  return { isAction: false };
}
