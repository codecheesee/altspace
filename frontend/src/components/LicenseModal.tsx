import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Loader2,
} from "lucide-react";
import {
  deactivateLicense,
  getLicenseStatus,
  refreshEntitlement,
  type LicenseStatus,
} from "../lib/license";
import {
  connectWithGitHubToken,
  fetchGitHubUserProfile,
  getCurrentSession,
  GITHUB_CLIENT_ID,
  pollGitHubDeviceToken,
  startGitHubDeviceFlow,
  type DeviceCodeResponse,
  type UserSession,
} from "../lib/authProvider";
import {
  tauriInvoke,
  getAdvancedSearchQuota,
  ADVANCED_SEARCH_LIMIT,
  ADVANCED_SEARCH_WINDOW_MS,
  type AdvancedSearchQuota,
} from "../lib/appStorage";
import { cn } from "../lib/utils";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme?: { accentHex: string; bg?: string; borderColor?: string; cardBg?: string };
  notify: (msg: string) => void;
}

type TabType = "account" | "features" | "about";
type AuthMethod = "device" | "token";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LicenseModal({ isOpen, onClose, notify }: LicenseModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("account");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(getLicenseStatus());
  const [session, setSession] = useState<UserSession | null>(getCurrentSession());
  const [machineId, setMachineId] = useState<string>("ALTS-INITIALIZING");
  const [quota, setQuota] = useState<AdvancedSearchQuota>(() => getAdvancedSearchQuota());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Authentication inputs
  const [authMethod, setAuthMethod] = useState<AuthMethod>("device");
  const [tokenInput, setTokenInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Device Flow State (RFC 8628)
  const [deviceFlow, setDeviceFlow] = useState<DeviceCodeResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [copiedMachineId, setCopiedMachineId] = useState(false);

  // Refresh user session and entitlements from GitHub
  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      setSession(getCurrentSession());
      setQuota(getAdvancedSearchQuota());

      if (tauriInvoke) {
        try {
          const mid = await tauriInvoke<string>("get_machine_id");
          if (mid) setMachineId(mid);
        } catch (_) {}
      }

      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshStatus();
  }, [isOpen]);

  // Clean up device flow on modal close or unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (deviceFlow) {
          handleCancelDeviceFlow();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, deviceFlow, onClose]);

  if (!isOpen) return null;

  const handleOpenUrl = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url }).catch(() => {
        if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      });
    } else if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Device Flow Authentication Handler
  const handleStartDeviceFlow = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setDeviceFlow(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await startGitHubDeviceFlow(GITHUB_CLIENT_ID);
      setDeviceFlow(response);

      // Auto-copy user code to clipboard
      try {
        await navigator.clipboard.writeText(response.user_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 3000);
      } catch (_) {}

      // Auto-open browser to GitHub device verification page
      handleOpenUrl(response.verification_uri);
      notify(`Code ${response.user_code} copied! Authorize in browser.`);

      // Poll until user authorizes
      const token = await pollGitHubDeviceToken(
        GITHUB_CLIENT_ID,
        response.device_code,
        response.interval || 5,
        controller.signal
      );

      const userSession = await fetchGitHubUserProfile(token);
      setSession(userSession);
      setDeviceFlow(null);
      notify(`Welcome @${userSession.login}! Authenticated successfully.`);
      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } catch (err: any) {
      if (controller.signal.aborted) {
        setAuthError("Sign-in cancelled.");
      } else {
        setAuthError(err?.message || "GitHub authentication failed.");
      }
      setDeviceFlow(null);
    } finally {
      setAuthLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDeviceFlow = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDeviceFlow(null);
    setAuthLoading(false);
    setAuthError(null);
  };

  const handleConnectToken = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await connectWithGitHubToken(tokenInput.trim());
      setSession(user);
      setTokenInput("");
      notify(`Connected @${user.login}! Authenticated successfully.`);
      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } catch (err: any) {
      setAuthError(err?.message || "Failed to verify token.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCopyMachineId = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      notify("Machine ID copied to clipboard!");
      setTimeout(() => setCopiedMachineId(false), 2000);
    } catch (_) {}
  };

  const handleSignOut = () => {
    deactivateLicense();
    setSession(null);
    const updated = getLicenseStatus();
    setLicenseStatus(updated);
    notify("Signed out of GitHub.");
  };

  const isProOrSupporter =
    licenseStatus.tier === "Pro" ||
    licenseStatus.tier === "Supporter" ||
    licenseStatus.tier === "Maintainer" ||
    licenseStatus.tier === "Contributor";

  const quotaResetDate = new Date(quota.windowStartedAt + ADVANCED_SEARCH_WINDOW_MS).toLocaleDateString();
  const quotaUsedPct = Math.min(100, Math.round((quota.used / ADVANCED_SEARCH_LIMIT) * 100));

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] border border-white/[0.08] bg-[#0c0c0e] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Segmented Pills */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.01]">
          <div className="flex items-center gap-1.5 p-0.5 bg-zinc-900/80 rounded-lg border border-white/[0.05]">
            <button
              onClick={() => setActiveTab("account")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer",
                activeTab === "account"
                  ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Account
            </button>
            <button
              onClick={() => setActiveTab("features")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer",
                activeTab === "features"
                  ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Features
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer",
                activeTab === "about"
                  ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              About
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshStatus()}
              disabled={isRefreshing}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-white")} />
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition cursor-pointer"
              title="Close (Esc)"
            >
              <kbd className="kbd-cap hover:border-zinc-500">Esc</kbd>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: ACCOUNT */}
          {activeTab === "account" && (
            <div className="space-y-3">
              {/* Plan Card */}
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isProOrSupporter ? "bg-purple-400" : "bg-emerald-400"
                      )}
                    />
                    <span className="text-xs font-semibold text-white">
                      {isProOrSupporter ? `${licenseStatus.tier} Plan` : "Free Community"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {isProOrSupporter ? "Unlimited" : `Trial: ${quota.used} / ${ADVANCED_SEARCH_LIMIT}`}
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-normal">
                  {isProOrSupporter
                    ? "All local desktop tools and cloud features are active and unmetered."
                    : "Local searches and utilities are unlimited forever. Resets monthly on " + quotaResetDate + "."}
                </p>

                {!isProOrSupporter && (
                  <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden mt-1">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        quotaUsedPct >= 80 ? "bg-amber-400" : "bg-emerald-400"
                      )}
                      style={{ width: `${quotaUsedPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* GitHub Identity & Entitlement Card */}
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GithubIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>GitHub Account & Entitlements</span>
                  </div>
                  {session && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  )}
                </div>

                {session ? (
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-2.5">
                      {session.avatarUrl ? (
                        <img
                          src={session.avatarUrl}
                          alt={session.login}
                          className="w-8 h-8 rounded-full border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white">
                          {session.login.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {session.name || session.login}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          @{session.login}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void refreshStatus()}
                        className="px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded-md transition border border-white/[0.06] cursor-pointer"
                      >
                        Sync
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition border border-rose-500/20 cursor-pointer flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Method Switcher */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        onClick={() => setAuthMethod("device")}
                        className={cn(
                          "pb-0.5 border-b transition cursor-pointer",
                          authMethod === "device"
                            ? "text-white border-white font-medium"
                            : "text-zinc-500 border-transparent hover:text-zinc-300"
                        )}
                      >
                        1-Click Browser Sign-in
                      </button>
                      <span className="text-zinc-600">•</span>
                      <button
                        onClick={() => setAuthMethod("token")}
                        className={cn(
                          "pb-0.5 border-b transition cursor-pointer",
                          authMethod === "token"
                            ? "text-white border-white font-medium"
                            : "text-zinc-500 border-transparent hover:text-zinc-300"
                        )}
                      >
                        Personal Access Token
                      </button>
                    </div>

                    {authMethod === "device" ? (
                      <div className="space-y-2">
                        {deviceFlow ? (
                          <div className="p-3 bg-black/60 rounded-md border border-white/10 space-y-2.5 text-center">
                            <div className="text-[11px] text-zinc-300">
                              Enter this code on GitHub to authorize AltSpace:
                            </div>
                            <div className="text-lg font-mono font-bold tracking-widest text-white bg-zinc-800/80 py-1.5 px-3 rounded border border-white/10 select-all">
                              {deviceFlow.user_code}
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(deviceFlow.user_code);
                                  setCopiedCode(true);
                                  handleOpenUrl(deviceFlow.verification_uri);
                                  setTimeout(() => setCopiedCode(false), 3000);
                                }}
                                className="px-3 py-1 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded transition cursor-pointer flex items-center gap-1.5"
                              >
                                {copiedCode ? <Check className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                                {copiedCode ? "Copied! Opening..." : "Open GitHub"}
                              </button>
                              <button
                                onClick={handleCancelDeviceFlow}
                                className="px-3 py-1 bg-white/[0.08] hover:bg-white/[0.12] text-zinc-300 text-xs rounded transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 pt-0.5">
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-400" />
                              <span>Waiting for authorization on GitHub...</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={handleStartDeviceFlow}
                              disabled={authLoading}
                              className="w-full py-2 px-3 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {authLoading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Connecting to GitHub...</span>
                                </>
                              ) : (
                                <>
                                  <GithubIcon className="w-4 h-4" />
                                  <span>Sign in with GitHub</span>
                                </>
                              )}
                            </button>

                            <p className="text-[10px] text-zinc-500 text-center">
                              Secure authorization via GitHub RFC 8628. No passwords entered in AltSpace.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxx"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleConnectToken()}
                            className="flex-1 py-1.5 px-2.5 bg-black/60 rounded-md border border-white/10 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-white/30"
                          />
                          <button
                            onClick={handleConnectToken}
                            disabled={authLoading || !tokenInput.trim()}
                            className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-40"
                          >
                            {authLoading ? "Verifying..." : "Verify & Save"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500">Requires 'read:user' permission</span>
                          <button
                            onClick={() =>
                              handleOpenUrl(
                                "https://github.com/settings/tokens/new?scopes=read:user&description=AltSpace%20Desktop"
                              )
                            }
                            className="text-zinc-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
                          >
                            Generate token on GitHub
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {authError && (
                      <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-md">
                        {authError}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hardware Device ID */}
              <div className="p-3 rounded-lg border border-white/[0.06] bg-zinc-900/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-medium text-zinc-400">Device Hardware ID</div>
                  <div className="font-mono text-xs text-zinc-200 mt-0.5">{machineId}</div>
                </div>
                <button
                  onClick={handleCopyMachineId}
                  className="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1"
                  title="Copy machine ID"
                >
                  {copiedMachineId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMachineId ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === "features" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Always Free & Unlimited</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Instant Multi-Drive File & Folder Search (C:, D:, External)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Installed App Launcher & Process Navigation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Persistent Clipboard History Manager</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Developer Port Inspector & Single-Click Killer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Local Ollama AI Integration (100% Offline & Private)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Pro Services</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span>Hosted AI Vector Embeddings for Semantic Code Search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span>Encrypted Multi-Device DPAPI Vault Synchronization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span>Priority Support & Early Feature Access</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT */}
          {activeTab === "about" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">AltSpace for Windows</span>
                  <span className="text-[10px] font-mono text-zinc-400">v2.0.0-preview</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  High-performance native command palette, file indexer, and developer workflow launcher for Windows.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.05]">
                  <span className="text-zinc-400">License</span>
                  <span className="text-zinc-200">Apache 2.0 (Open Source)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/[0.05]">
                  <span className="text-zinc-400">Repository</span>
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace")}
                    className="text-zinc-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    codecheesee/altspace
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400">Releases & Notes</span>
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/releases")}
                    className="text-zinc-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    GitHub Releases
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
