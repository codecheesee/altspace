import { useState, useCallback, useMemo } from "react";
import { tauriInvoke, DEMO_PORTS } from "../lib/appStorage";
import type { PortItem } from "../types";

export function usePortInspector(query: string, isSmartPortPrefix: boolean) {
  const [ports, setPorts] = useState<PortItem[]>(DEMO_PORTS);
  const [portStatusMsg, setPortStatusMsg] = useState<string | null>(null);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await tauriInvoke<PortItem[]>("get_listening_ports");
      if (res && Array.isArray(res) && res.length > 0) {
        setPorts(res);
      }
    } catch (_) {}
  }, []);

  const filteredPorts = useMemo(() => {
    const rawFilter = isSmartPortPrefix ? query.slice(1).trim().toLowerCase() : query.trim().toLowerCase();
    if (!rawFilter) return ports;
    return ports.filter(
      (p) =>
        p.port.toString().includes(rawFilter) ||
        p.process_name.toLowerCase().includes(rawFilter) ||
        p.pid.toString().includes(rawFilter)
    );
  }, [ports, query, isSmartPortPrefix]);

  const handleKillPort = useCallback(async (pid: number, port: number) => {
    if (tauriInvoke) {
      try {
        await tauriInvoke("kill_port_process", { pid });
        setPortStatusMsg(`Terminated PID ${pid} (Port :${port} Freed)`);
        setTimeout(() => setPortStatusMsg(null), 3000);
        fetchPorts();
        return;
      } catch (err: any) {
        setPortStatusMsg(`Kill error: ${err}`);
        setTimeout(() => setPortStatusMsg(null), 3000);
      }
    } else {
      setPorts((prev) => prev.filter((p) => p.pid !== pid));
      setPortStatusMsg(`Terminated PID ${pid} (Port :${port} Freed)`);
      setTimeout(() => setPortStatusMsg(null), 3000);
    }
  }, [fetchPorts]);

  const handlePurgeAllDevServers = useCallback(async () => {
    try {
      const count = await tauriInvoke<number>("kill_all_dev_servers");
      setPortStatusMsg(`⚡ Successfully purged ${count || 0} orphaned dev servers!`);
      setTimeout(() => setPortStatusMsg(null), 3500);
      fetchPorts();
    } catch (err: any) {
      setPortStatusMsg(`Purge error: ${err}`);
      setTimeout(() => setPortStatusMsg(null), 3000);
    }
  }, [fetchPorts]);

  return {
    ports,
    filteredPorts,
    portStatusMsg,
    setPortStatusMsg,
    fetchPorts,
    handleKillPort,
    handlePurgeAllDevServers,
  };
}
