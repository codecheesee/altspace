import test from "node:test";
import assert from "node:assert/strict";

// Pure module contract & state machine test for Docker & WSL Cockpit
const createMockCockpit = () => ({
  wsl: {
    installed: true,
    distros: [
      { name: "Ubuntu", state: "Running", version: 2, is_default: true },
      { name: "Debian", state: "Stopped", version: 2, is_default: false },
    ],
    running_distros_count: 1,
    vmmem_detected: true,
    vmmem_ram_mb: 840,
    default_distro: "Ubuntu",
  },
  docker: {
    installed: true,
    daemon_running: true,
    error_message: null,
    containers: [
      {
        id: "7b3f91a2c4e5",
        names: "altspace-postgres",
        image: "postgres:16-alpine",
        status: "Up 4 hours",
        state: "running",
        ports: "0.0.0.0:5432->5432/tcp",
        compose_project: "altspace",
      },
      {
        id: "e1a9c3d4f5b6",
        names: "altspace-redis",
        image: "redis:7-alpine",
        status: "Up 4 hours",
        state: "running",
        ports: "0.0.0.0:6379->6379/tcp",
        compose_project: "altspace",
      },
      {
        id: "9c8b7a6d5e4f",
        names: "web-client",
        image: "node:20-alpine",
        status: "Exited (1) 20 minutes ago",
        state: "exited",
        ports: "0.0.0.0:3000->3000/tcp",
        compose_project: "frontend",
      },
    ],
    running_count: 2,
    stopped_count: 1,
  },
});

function applyDockerAction(cockpit, id, action) {
  const target = cockpit.docker.containers.find((c) => c.id === id);
  if (!target) return { success: false, message: "Container not found" };

  if (action === "stop") {
    target.state = "exited";
    target.status = "Exited (0) Just now";
    cockpit.docker.running_count = Math.max(0, cockpit.docker.running_count - 1);
    cockpit.docker.stopped_count += 1;
  } else if (action === "start") {
    target.state = "running";
    target.status = "Up 1 second";
    cockpit.docker.running_count += 1;
    cockpit.docker.stopped_count = Math.max(0, cockpit.docker.stopped_count - 1);
  } else if (action === "restart") {
    target.state = "running";
    target.status = "Up 1 second (restarted)";
  }

  return { success: true, message: `Container ${id} action '${action}' completed.` };
}

function applyWslShutdown(cockpit) {
  cockpit.wsl.distros.forEach((d) => (d.state = "Stopped"));
  cockpit.wsl.running_distros_count = 0;
  cockpit.wsl.vmmem_ram_mb = 0;
  cockpit.wsl.vmmem_detected = false;
  return {
    success: true,
    message: "WSL virtual machine shut down successfully. VMMem RAM reclaimed.",
  };
}

function applyWslTerminate(cockpit, name) {
  const target = cockpit.wsl.distros.find((d) => d.name === name);
  if (!target) return { success: false, message: "Distro not found" };

  target.state = "Stopped";
  cockpit.wsl.running_distros_count = Math.max(0, cockpit.wsl.running_distros_count - 1);
  return { success: true, message: `WSL distribution '${name}' terminated.` };
}

test("Docker + WSL Cockpit - Snapshot Retrieval", () => {
  const snap = createMockCockpit();
  assert.equal(snap.wsl.installed, true);
  assert.equal(snap.docker.installed, true);
  assert.equal(snap.wsl.distros.length, 2);
  assert.equal(snap.docker.containers.length, 3);
  assert.equal(snap.wsl.default_distro, "Ubuntu");
});

test("Docker + WSL Cockpit - Container State Transitions", () => {
  const cockpit = createMockCockpit();
  assert.equal(cockpit.docker.running_count, 2);

  const resStop = applyDockerAction(cockpit, "7b3f91a2c4e5", "stop");
  assert.equal(resStop.success, true);
  assert.equal(cockpit.docker.running_count, 1);
  assert.equal(cockpit.docker.stopped_count, 2);

  const target = cockpit.docker.containers.find((c) => c.id === "7b3f91a2c4e5");
  assert.equal(target.state, "exited");

  const resStart = applyDockerAction(cockpit, "7b3f91a2c4e5", "start");
  assert.equal(resStart.success, true);
  assert.equal(cockpit.docker.running_count, 2);
  assert.equal(target.state, "running");
});

test("Docker + WSL Cockpit - WSL Memory Reclaim & Distro Termination", () => {
  const cockpit = createMockCockpit();
  assert.equal(cockpit.wsl.vmmem_detected, true);
  assert.equal(cockpit.wsl.vmmem_ram_mb, 840);

  const resShutdown = applyWslShutdown(cockpit);
  assert.equal(resShutdown.success, true);
  assert.equal(cockpit.wsl.vmmem_ram_mb, 0);
  assert.equal(cockpit.wsl.vmmem_detected, false);
  assert.equal(cockpit.wsl.running_distros_count, 0);

  const ubuntu = cockpit.wsl.distros.find((d) => d.name === "Ubuntu");
  assert.equal(ubuntu.state, "Stopped");
});

test("Docker + WSL Cockpit - Terminate Individual Distro", () => {
  const cockpit = createMockCockpit();
  const resTerm = applyWslTerminate(cockpit, "Ubuntu");
  assert.equal(resTerm.success, true);

  const ubuntu = cockpit.wsl.distros.find((d) => d.name === "Ubuntu");
  assert.equal(ubuntu.state, "Stopped");
  assert.equal(cockpit.wsl.running_distros_count, 0);
});
