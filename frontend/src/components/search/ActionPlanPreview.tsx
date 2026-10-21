import { useState } from "react";
import {
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Undo2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { executeStep } from "../../lib/actionPlanner";
import { undoAction } from "../../lib/actionBroker";
import type { ActionPlan } from "../../types";

interface ActionPlanPreviewProps {
  plan: ActionPlan;
  onCopiedNotification: (msg: string) => void;
}

export function ActionPlanPreview({ plan: initialPlan, onCopiedNotification }: ActionPlanPreviewProps) {
  const [plan, setPlan] = useState<ActionPlan>(initialPlan);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const handleApproveAndExecute = async () => {
    setIsRunning(true);
    const updatedSteps = [...plan.steps];

    for (let i = 0; i < updatedSteps.length; i++) {
      setActiveStepIndex(i);
      updatedSteps[i].status = "running";
      setPlan({ ...plan, steps: [...updatedSteps] });

      const res = await executeStep(updatedSteps[i]);
      if (res.success) {
        updatedSteps[i].status = "completed";
        updatedSteps[i].result_message = res.message;
      } else {
        updatedSteps[i].status = "failed";
        updatedSteps[i].result_message = res.message;
        setPlan({ ...plan, steps: [...updatedSteps] });
        setIsRunning(false);
        onCopiedNotification(`Plan halted at step ${i + 1}: ${res.message}`);
        return;
      }

      setPlan({ ...plan, steps: [...updatedSteps] });
    }

    setIsRunning(false);
    setIsCompleted(true);
    setActiveStepIndex(null);
    onCopiedNotification("Action plan executed and verified successfully!");
  };

  const handleUndo = async (stepId: string) => {
    try {
      const msg = await undoAction(stepId);
      onCopiedNotification(msg || "Action reverted.");
    } catch (err: unknown) {
      onCopiedNotification(`Undo failed: ${String(err)}`);
    }
  };

  return (
    <div className="w-[300px] border-l border-white/[0.08] bg-[#141418] p-4 flex flex-col justify-between overflow-hidden select-none">
      <div className="space-y-3.5 overflow-y-auto pr-0.5">
        {/* Header Card */}
        <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-gradient-to-b from-sky-500/[0.08] to-purple-500/[0.02] border border-sky-500/20 shadow-sm relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm border bg-sky-500/15 text-sky-400 border-sky-500/30">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="text-sm font-bold font-mono text-white tracking-tight break-all">
            {plan.title}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
            <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-sky-300 border border-white/[0.08]">
              {plan.target_context}
            </span>
            {plan.is_byok && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                BYOK Cloud
              </span>
            )}
          </div>

          <p className="text-[10.5px] text-zinc-400 mt-2 leading-relaxed">
            {plan.summary}
          </p>
        </div>

        {/* Steps Stepper */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold px-0.5">
            Planned Actions ({plan.steps.length} Steps)
          </div>

          {plan.steps.map((step, idx) => {
            const isStepActive = activeStepIndex === idx;
            return (
              <div
                key={step.id}
                className={cn(
                  "p-2.5 rounded-lg border transition-all text-[11px] space-y-1 relative",
                  step.status === "completed" && "bg-emerald-500/[0.04] border-emerald-500/20 text-emerald-200",
                  step.status === "failed" && "bg-rose-500/[0.06] border-rose-500/30 text-rose-200",
                  step.status === "running" && "bg-sky-500/[0.06] border-sky-500/30 text-sky-200 animate-pulse ring-1 ring-sky-500/50",
                  step.status === "pending" && "bg-black/40 border-white/[0.06] text-zinc-300",
                  isStepActive && "ring-1 ring-sky-400/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <span className="text-[10px] font-mono text-zinc-500">#{idx + 1}</span>
                    <span>{step.title}</span>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {step.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {step.status === "failed" && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    {step.status === "running" && <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
                    {step.status === "pending" && (
                      <span
                        className={cn(
                          "text-[8.5px] font-mono uppercase px-1.5 py-0.2 rounded border",
                          step.risk_tier === "read_only_auto" && "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
                          step.risk_tier === "preview_then_approve" && "text-amber-300 border-amber-500/30 bg-amber-500/10",
                          step.risk_tier === "always_approve" && "text-rose-300 border-rose-500/30 bg-rose-500/10"
                        )}
                      >
                        {step.risk_tier === "read_only_auto" ? "Auto" : "Review"}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 leading-normal">
                  {step.description}
                </p>

                {step.result_message && (
                  <div className="text-[9.5px] font-mono pt-1 text-zinc-300 break-all border-t border-white/[0.06] mt-1">
                    {step.result_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Security & Data Boundary Card */}
        <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06] flex items-start gap-2 text-[10px] text-zinc-400 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <span>
            {plan.is_byok
              ? `Direct API request to ${plan.provider} • Zero intermediate cloud telemetry.`
              : "100% Offline execution via Win32 Capability Broker • Zero telemetry."}
          </span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="space-y-2 pt-3 border-t border-white/[0.08] shrink-0">
        {!isCompleted ? (
          <button
            onClick={handleApproveAndExecute}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-sky-500/20 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing Plan...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Approve & Execute Plan (↵)</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Environment Recovered</span>
            </div>
            <button
              onClick={() => handleUndo(plan.steps[0].id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-zinc-300 border border-white/[0.08] transition cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              <span>Rollback / Undo (Ctrl+Z)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
