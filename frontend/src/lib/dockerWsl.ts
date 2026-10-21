import { tauriInvoke } from "./appStorage";

export interface WslDistro {
  name: string;
  state: string;
  version: number;
  is_default: boolean;
}

export interface WslOverview {
  installed: boolean;
  distros: WslDistro[];
  running_distros_count: number;
  vmmem_detected: boolean;
  vmmem_ram_mb?: number | null;
  default_distro?: string | null;
}

export interface DockerContainer {
  id: string;
  names: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  compose_project?: string | null;
}

export interface DockerOverview {
  installed: boolean;
  daemon_running: boolean;
  error_message?: string | null;
  containers: DockerContainer[];
  running_count: number;
  stopped_count: number;
}

export interface EnvironmentCockpitData {
  wsl: WslOverview;
  docker: DockerOverview;
}

export interface CockpitActionResult {
  success: boolean;
  message: string;
  stdout?: string | null;
}

// In-memory mock for web preview/tests
let mockCockpitData: EnvironmentCockpitData = {
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
};

export async function getEnvironmentCockpit(): Promise<EnvironmentCockpitData> {
  try {
    const res = await tauriInvoke<EnvironmentCockpitData>("get_environment_cockpit");
    if (res) return res;
  } catch {
    // Fallback in web / test mode
  }
  return mockCockpitData;
}

export async function dockerContainerAction(
  id: string,
  action: "start" | "stop" | "restart"
): Promise<CockpitActionResult> {
  try {
    const res = await tauriInvoke<CockpitActionResult>("docker_container_action", { id, action });
    if (res) return res;
  } catch {
    // Mock mutation
    const target = mockCockpitData.docker.containers.find((c) => c.id === id);
    if (target) {
      if (action === "stop") {
        target.state = "exited";
        target.status = "Exited (0) Just now";
      } else {
        target.state = "running";
        target.status = "Up 1 second";
      }
    }
  }
  return {
    success: true,
    message: `Container ${id} action '${action}' completed.`,
  };
}

export async function dockerContainerLogs(id: string, tail: number = 50): Promise<string> {
  try {
    const res = await tauriInvoke<string>("docker_container_logs", { id, tail });
    if (typeof res === "string") return res;
  } catch {
    // Mock
  }
  return `[${new Date().toISOString()}] Server initialized on port 5432\n[${new Date().toISOString()}] Ready to accept connections\n[${new Date().toISOString()}] autovacuum launcher started`;
}

export async function dockerOpenShell(id: string): Promise<string> {
  try {
    const res = await tauriInvoke<string>("docker_open_shell", { id });
    if (typeof res === "string") return res;
  } catch {
    // Mock
  }
  return `Opened shell for ${id}`;
}

export async function dockerStartDaemon(): Promise<string> {
  try {
    const res = await tauriInvoke<string>("docker_start_daemon");
    if (typeof res === "string") return res;
  } catch {
    // Mock
  }
  return "Launched Docker Desktop";
}

export async function wslShutdown(): Promise<CockpitActionResult> {
  try {
    const res = await tauriInvoke<CockpitActionResult>("wsl_shutdown");
    if (res) return res;
  } catch {
    // Mock
    mockCockpitData.wsl.distros.forEach((d) => (d.state = "Stopped"));
    mockCockpitData.wsl.running_distros_count = 0;
    mockCockpitData.wsl.vmmem_ram_mb = 0;
    mockCockpitData.wsl.vmmem_detected = false;
  }
  return {
    success: true,
    message: "WSL virtual machine shut down successfully. VMMem RAM reclaimed.",
  };
}

export async function wslTerminateDistro(distro: string): Promise<CockpitActionResult> {
  try {
    const res = await tauriInvoke<CockpitActionResult>("wsl_terminate_distro", { distro });
    if (res) return res;
  } catch {
    // Mock
    const target = mockCockpitData.wsl.distros.find((d) => d.name === distro);
    if (target) {
      target.state = "Stopped";
      mockCockpitData.wsl.running_distros_count = Math.max(0, mockCockpitData.wsl.running_distros_count - 1);
    }
  }
  return {
    success: true,
    message: `WSL distribution '${distro}' terminated successfully.`,
  };
}

export async function wslLaunchShell(distro: string): Promise<string> {
  try {
    const res = await tauriInvoke<string>("wsl_launch_shell", { distro });
    if (typeof res === "string") return res;
  } catch {
    // Mock
  }
  return `Launched shell for ${distro}`;
}
