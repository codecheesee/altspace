import { invokeStrict, tauriInvoke } from "./appStorage";

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
  | { type: "InstallUpdate"; payload: { release_url: string } }
  | { type: "FreePortAndVerify"; payload: { port: number; pid: number } }
  | { type: "RestartDockerContainer"; payload: { id: string } }
  | { type: "ReclaimWslMemory"; payload: Record<string, never> };

export interface ActionRequest {
  id: string;
  action: TypedAction;
  session_token?: string;
  approval_token?: string;
}

export interface ActionEvaluation {
  id: string;
  risk_tier: RiskTier;
  requires_approval: boolean;
  target_summary: string;
  diff_preview?: string;
  reversibility: boolean;
  requires_entitlement: boolean;
  approval_token?: string;
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

export interface FailureEvent {
  id: string;
  source: string;
  command_or_target: string;
  exit_code?: number | null;
  error_message: string;
  stdout_excerpt?: string | null;
  timestamp: number;
}

export async function getRecentFailureContext(): Promise<FailureEvent[]> {
  return (await tauriInvoke<FailureEvent[]>("get_recent_failure_context")) || [];
}

export async function clearFailureContext(): Promise<void> {
  await tauriInvoke("clear_failure_context");
}

export async function storeByokKey(provider: string, apiKey: string): Promise<void> {
  await tauriInvoke("vault_store_byok_key", { provider, apiKey });
}

export async function retrieveByokKey(_provider: string): Promise<string | null> {
  // Prohibited by security policy: BYOK API keys remain in DPAPI and never cross IPC
  return null;
}

export interface ByokProviderStatus {
  provider: string;
  is_configured: boolean;
  fingerprint: string;
}

export async function getByokStatus(provider: string): Promise<ByokProviderStatus | null> {
  return (await tauriInvoke<ByokProviderStatus | null>("vault_get_byok_status", { provider })) || null;
}

export interface ByokChatRequest {
  provider: string;
  model?: string;
  prompt: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface ByokChatResponse {
  provider: string;
  model: string;
  content: string;
  finish_reason?: string;
}

export async function byokChatCompletion(request: ByokChatRequest): Promise<ByokChatResponse> {
  return await invokeStrict<ByokChatResponse>("byok_chat_completion", { request });
}

export async function listByokProviders(): Promise<string[]> {
  return (await tauriInvoke<string[]>("vault_list_byok_providers")) || [];
}

export async function deleteByokKey(provider: string): Promise<boolean> {
  return (await tauriInvoke<boolean>("vault_delete_byok_key", { provider })) || false;
}
