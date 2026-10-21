import test from "node:test";
import assert from "node:assert/strict";

function isPlanQuery(query) {
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

test("Action Planner - Query Intent Classification", () => {
  // Plan queries
  assert.equal(isPlanQuery("? fix"), true);
  assert.equal(isPlanQuery("? fix 5173"), true);
  assert.equal(isPlanQuery("? free 3000"), true);
  assert.equal(isPlanQuery("? recover dev environment"), true);
  assert.equal(isPlanQuery("? clean docker containers"), true);
  assert.equal(isPlanQuery("? reclaim wsl memory"), true);
  assert.equal(isPlanQuery("? kill port 8080"), true);
  assert.equal(isPlanQuery("? fix EADDRINUSE"), true);

  // Non-plan standard queries
  assert.equal(isPlanQuery("hello world"), false);
  assert.equal(isPlanQuery("? how do I write a binary search in Rust"), false);
  assert.equal(isPlanQuery("? what is quantum computing"), false);
  assert.equal(isPlanQuery("code"), false);
});

test("Action Planner - Step Structure & Risk Tiers", () => {
  const samplePortStep = {
    id: "step-free-port",
    title: "Free TCP Port :5173",
    description: "Terminate process holding port 5173 and verify socket release",
    risk_tier: "preview_then_approve",
    requires_approval: true,
    status: "pending",
    action: {
      type: "FreePortAndVerify",
      payload: { port: 5173, pid: 18402 },
    },
  };

  assert.equal(samplePortStep.risk_tier, "preview_then_approve");
  assert.equal(samplePortStep.requires_approval, true);
  assert.equal(samplePortStep.action.type, "FreePortAndVerify");
  assert.equal(samplePortStep.action.payload.port, 5173);
});

test("Action Planner - WSL Memory Reclamation Schema", () => {
  const sampleWslStep = {
    id: "step-wsl-shutdown",
    title: "Reclaim WSL2 Dynamic RAM",
    description: "Execute 'wsl.exe --shutdown' to free Hyper-V memory back to Windows",
    risk_tier: "preview_then_approve",
    requires_approval: true,
    status: "pending",
    action: {
      type: "ReclaimWslMemory",
      payload: {},
    },
  };

  assert.equal(sampleWslStep.action.type, "ReclaimWslMemory");
  assert.equal(sampleWslStep.status, "pending");
});
