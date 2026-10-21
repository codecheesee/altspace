import { useState, useCallback, useMemo } from "react";
import { tauriInvoke } from "../lib/appStorage";
import type { PortItem, PortProcessForensics, KillVerifyResult } from "../types";

export function usePortInspector(query: string) {
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [portStatusMsg, setPortStatusMsg] = useState<string | null>(null);

  const fetchPorts = useCallback(async () => {
    try {
      const res = await tauriInvoke<PortItem[]>("get_listening_ports");
      if (res && Array.isArray(res)) setPorts(res);
    } catch (_) {}
  }, []);

  const fetchForensics = useCallback(async (port: number, pid: number): Promise<PortProcessForensics | null> => {
    if (!tauriInvoke) return null;
    try {
      const res = await tauriInvoke<PortProcessForensics>("get_port_process_forensics", { port, pid });
      return res || null;
    } catch (_) {
      return null;
    }
  }, []);

  const filteredPorts = useMemo(() => {
    let rawFilter = query.trim().toLowerCase();
    if (rawFilter.startsWith(":")) rawFilter = rawFilter.slice(1).trim();
    rawFilter = rawFilter.replace(/^(free|kill\s*port|ports?)\s*/i, "").trim();
    if (!rawFilter) return ports;
    return ports.filter(
      (p) =>
        p.port.toString().includes(rawFilter) ||
        p.process_name.toLowerCase().includes(rawFilter) ||
        p.pid.toString().includes(rawFilter)
    );
  }, [ports, query]);

  const handleKillPort = useCallback(async (pid: number, port: number) => {
    if (tauriInvoke) {
      try {
        const verifyRes = await tauriInvoke<KillVerifyResult>("kill_and_verify_port", { port, pid });
        if (verifyRes?.verified_free) {
          setPortStatusMsg(`✓ Port :${port} Freed & Verified (${verifyRes.elapsed_ms}ms)`);
        } else {
          setPortStatusMsg(verifyRes?.message || `PID ${pid} terminated`);
        }
        setTimeout(() => setPortStatusMsg(null), 3000);
        fetchPorts();
        return;
      } catch (err: any) {
        // Safe auto-healing fallback to basic kill
        try {
          await tauriInvoke("kill_port_process", { pid });
          setPortStatusMsg(`Port :${port} freed (fallback kill)`);
          fetchPorts();
        } catch (fallbackErr: any) {
          setPortStatusMsg(`Kill error: ${fallbackErr || err}`);
        }
        setTimeout(() => setPortStatusMsg(null), 3000);
      }
    } else {
      setPorts((prev) => prev.filter((p) => p.pid !== pid));
      setPortStatusMsg(`✓ Port :${port} Freed (Mock)`);
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
    fetchForensics,
    handleKillPort,
    handlePurgeAllDevServers,
  };
}
