import { tauriInvoke } from "./appStorage";

export type RiskTier = "read_only_auto" | "preview_then_approve" | "always_approve";
export type ActionStatus =
  | "requested"
  | "approved"
  | "started"
  | "completed"
  | "failed"
  | "cancelled"
  | "undone";

export type TypedAction =
  | { type: "ReadFile"; payload: { path: string; max_bytes?: number } }
  | { type: "WriteFile"; payload: { path: string; content: string; overwrite: boolean } }
  | { type: "DeleteFile"; payload: { path: string } }
  | { type: "RunProgram"; payload: { program: string; args: string[]; cwd?: string } }
  | { type: "RunPowerShell"; payload: { script: string; timeout_secs?: number } }
  | { type: "CallHttpEndpoint"; payload: { url: string; method: string; body?: string } }
  | {
      type: "InstallPlugin";
      payload: {
        plugin_id: string;
        manifest_json: string;
        script_filename: string;
        script_content: string;
      };
    }
  | { type: "InstallUpdate"; payload: { release_url: string } };

export interface ActionRequest {
  id: string;
  action: TypedAction;
  session_token?: string;
  bypass_approval: boolean;
}

export interface ActionEvaluation {
  id: string;
  risk_tier: RiskTier;
  requires_approval: boolean;
  target_summary: string;
  diff_preview?: string;
  reversibility: boolean;
  requires_entitlement: boolean;
}

export interface ActionResult {
  id: string;
  status: ActionStatus;
  success: boolean;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
  undo_available: boolean;
  error_message?: string;
}

export interface LedgerEntry {
  id: string;
  action_name: string;
  risk_tier: RiskTier;
  status: ActionStatus;
  target: string;
  timestamp: number;
  undo_available: boolean;
}

export async function evaluateAction(request: ActionRequest): Promise<ActionEvaluation | null> {
  return await tauriInvoke<ActionEvaluation>("broker_evaluate_action", { request });
}

export async function executeAction(request: ActionRequest): Promise<ActionResult | null> {
  return await tauriInvoke<ActionResult>("broker_execute_action", { request });
}

export async function rememberSessionApproval(actionType: string, target: string): Promise<void> {
  await tauriInvoke("broker_remember_session_approval", { actionType, target });
}

export async function undoAction(actionId: string): Promise<string | null> {
  return await tauriInvoke<string>("broker_undo_action", { actionId });
}

export async function getActionLedger(): Promise<LedgerEntry[]> {
  const entries = await tauriInvoke<LedgerEntry[]>("broker_get_ledger");
  return entries || [];
}
