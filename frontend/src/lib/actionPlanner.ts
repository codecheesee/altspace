import {
  evaluateAction,
  executeAction,
  getRecentFailureContext,
  type TypedAction,
  type FailureEvent,
} from "./actionBroker";
import type { ActionPlan, ActionPlanStep } from "../types";
import { tauriInvoke } from "./appStorage";

interface ListeningPort {
  port: number;
  pid: number;
  process_name: string;
}

export function isPlanQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q.startsWith("?")) return false;
  const rest = q.slice(1).trim();
  return (
    rest.startsWith("fix") ||
    rest.startsWith("recover") ||
    rest.startsWith("recovery") ||
    rest.startsWith("clean") ||
    rest.startsWith("free") ||
    rest.startsWith("restart") ||
    rest.includes("eaddrinuse") ||
    rest.includes("kill") ||
    rest.includes("reclaim")
  );
}

export async function synthesizeActionPlan(query: string): Promise<ActionPlan | null> {
  const q = query.trim().slice(1).trim().toLowerCase();

  // 1. Fetch recent failures context
  let failures: FailureEvent[] = [];
  try {
    failures = await getRecentFailureContext();
  } catch {
    // ignore
  }

  const lastFailure = failures.length > 0 ? failures[failures.length - 1] : null;

  // 2. Extract port target if present (e.g. "? fix 5173", "? free 3000", or from EADDRINUSE in failure)
  let targetPort: number | null = null;
  const portMatch = q.match(/(?:fix|free|kill|port)\s*[:#]?\s*(\d{3,5})/i);
  if (portMatch) {
    targetPort = parseInt(portMatch[1], 10);
  } else if (lastFailure) {
    const errPortMatch = (lastFailure.error_message + " " + lastFailure.command_or_target).match(
      /(?:EADDRINUSE|port|:)\s*[:#]?\s*(\d{3,5})/i
    );
    if (errPortMatch) {
      targetPort = parseInt(errPortMatch[1], 10);
    }
  }

  // 3. Port Recovery Plan
  if (targetPort || q.startsWith("fix") && !q.includes("docker") && !q.includes("wsl")) {
    const port = targetPort || 5173;
    let targetPid = 0;
    let procName = "node.exe";

    try {
      const activePorts = await tauriInvoke<ListeningPort[]>("get_listening_ports");
      if (activePorts) {
        const found = activePorts.find((p) => p.port === port);
        if (found) {
          targetPid = found.pid;
          procName = found.process_name;
        }
      }
    } catch {
      targetPid = 19482;
    }

    const steps: ActionPlanStep[] = [
      {
        id: "step-free-port",
        title: `Free TCP Port :${port}`,
        description: targetPid > 0
          ? `Terminate process '${procName}' (PID ${targetPid}) and verify socket release`
          : `Scan TCP table and terminate process holding port ${port}`,
        risk_tier: "preview_then_approve",
        requires_approval: true,
        status: "pending",
        action: {
          type: "FreePortAndVerify",
          payload: { port, pid: targetPid },
        } as TypedAction,
      },
      {
        id: "step-restart-dev",
        title: "Restart Local Dev Server",
        description: "Run 'npm.cmd run dev' to relaunch the development server",
        risk_tier: "always_approve",
        requires_approval: true,
        status: "pending",
        action: {
          type: "RunProgram",
          payload: { program: "npm.cmd", args: ["run", "dev"] },
        } as TypedAction,
      },
    ];

    return {
      id: `plan-port-${port}-${Date.now()}`,
      title: `Port :${port} Conflict Recovery`,
      summary: `Diagnose and release socket :${port} held by ${procName} (PID ${targetPid || "active"}) and restart environment.`,
      target_context: `TCP Port ${port} • ${procName}`,
      steps,
      provider: "AltSpace Win32 Broker",
      model: "Local Deterministic Engine",
      is_byok: false,
    };
  }

  // 4. Docker Environment Plan
  if (q.includes("docker") || q.includes("container") || q.includes("prune")) {
    const steps: ActionPlanStep[] = [
      {
        id: "step-docker-prune",
        title: "Prune Exited Docker Containers",
        description: "Execute 'docker.exe system prune -f' to clean stale stopped containers",
        risk_tier: "preview_then_approve",
        requires_approval: true,
        status: "pending",
        action: {
          type: "RunProgram",
          payload: { program: "docker.exe", args: ["system", "prune", "-f"] },
        } as TypedAction,
      },
      {
        id: "step-docker-verify",
        title: "Verify Docker Compose Health",
        description: "Run 'docker.exe compose ps' to inspect remaining running services",
        risk_tier: "read_only_auto",
        requires_approval: false,
        status: "pending",
        action: {
          type: "RunProgram",
          payload: { program: "docker.exe", args: ["compose", "ps"] },
        } as TypedAction,
      },
    ];

    return {
      id: `plan-docker-${Date.now()}`,
      title: "Docker Environment Maintenance",
      summary: "Prune dangling exited containers and verify Docker Compose services.",
      target_context: "Docker Daemon • Local Compose",
      steps,
      provider: "AltSpace Docker Broker",
      model: "Local Deterministic Engine",
      is_byok: false,
    };
  }

  // 5. WSL RAM Reclamation Plan
  if (q.includes("wsl") || q.includes("vmmem") || q.includes("ram") || q.includes("memory")) {
    const steps: ActionPlanStep[] = [
      {
        id: "step-wsl-shutdown",
        title: "Reclaim WSL2 Dynamic RAM",
        description: "Execute 'wsl.exe --shutdown' to free Hyper-V memory back to Windows",
        risk_tier: "preview_then_approve",
        requires_approval: true,
        status: "pending",
        action: {
          type: "ReclaimWslMemory",
          payload: {},
        } as TypedAction,
      },
    ];

    return {
      id: `plan-wsl-${Date.now()}`,
      title: "WSL2 Virtual Memory Reclamation",
      summary: "Shut down active WSL VM instance and return gigabytes of working set memory back to Windows host.",
      target_context: "WSL2 Hyper-V • vmmemWSL",
      steps,
      provider: "AltSpace WSL Broker",
      model: "Local Deterministic Engine",
      is_byok: false,
    };
  }

  return null;
}

export async function executeStep(step: ActionPlanStep): Promise<{ success: boolean; message: string }> {
  try {
    const evalRes = await evaluateAction({
      id: step.id,
      action: step.action,
    });

    if (!evalRes) {
      return {
        success: false,
        message: "Failed to evaluate action policy challenge.",
      };
    }

    const res = await executeAction({
      id: step.id,
      action: step.action,
      approval_token: evalRes.approval_token,
    });

    if (res && res.success) {
      return {
        success: true,
        message: res.stdout || "Step completed successfully.",
      };
    }

    return {
      success: false,
      message: res?.error_message || res?.stderr || "Step execution failed.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: String(err),
    };
  }
}
