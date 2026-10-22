import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Shield,
  Loader2,
  Sparkles,
  RotateCcw,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  KeyRound,
} from "lucide-react";
import {
  listEnvProfiles,
  saveEnvProfile,
  deleteEnvProfile,
  type EnvProfileSummary,
} from "../lib/secureVault";
import {
  storeByokKey,
  listByokProviders,
  deleteByokKey,
} from "../lib/actionBroker";
import {
  getFeatureMatrix,
  toggleFeature,
  resetFeatureHealth,
  subscribeFeatureMatrix,
  FEATURE_REGISTRY,
  type FeatureId,
  type FeatureMatrixMap,
} from "../lib/featureMatrix";
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

type TabType = "account" | "features" | "about";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme?: { accentHex: string; bg?: string; borderColor?: string; cardBg?: string };
  notify: (msg: string) => void;
  initialTab?: TabType;
  onOpenUpdateModal?: () => void;
}

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

export function LicenseModal({
  isOpen,
  onClose,
  notify,
  initialTab,
  onOpenUpdateModal,
}: LicenseModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || "account");
  const [featureMatrix, setFeatureMatrix] = useState<FeatureMatrixMap>(getFeatureMatrix());

  // DPAPI Secret Vault State
  const [profiles, setProfiles] = useState<EnvProfileSummary[]>([]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newEntries, setNewEntries] = useState<{ key: string; value: string }[]>([]);
  const [showSecretText, setShowSecretText] = useState(false);

  // BYOK State
  const [byokProviders, setByokProviders] = useState<string[]>([]);
  const [selectedByokProvider, setSelectedByokProvider] = useState<string>("anthropic");
  const [byokApiKeyInput, setByokApiKeyInput] = useState<string>("");
  const [showByokKey, setShowByokKey] = useState<boolean>(false);

  const reloadByok = () => {
    listByokProviders().then((res) => setByokProviders(res)).catch(() => {});
  };

  const reloadProfiles = () => {
    listEnvProfiles().then((res) => setProfiles(res)).catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      reloadProfiles();
      reloadByok();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    return subscribeFeatureMatrix((updated) => {
      setFeatureMatrix(updated);
    });
  }, []);
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
                  <>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden mt-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          quotaUsedPct >= 80 ? "bg-amber-400" : "bg-emerald-400"
                        )}
                        style={{ width: `${quotaUsedPct}%` }}
                      />
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-white/[0.06] mt-2">
                      <span className="text-[10.5px] text-zinc-400">Want hosted AI & unlimited sync?</span>
                      <button
                        type="button"
                        onClick={() => handleOpenUrl("https://codecheesee.github.io/altspace/#pricing")}
                        className="px-2.5 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>Upgrade to Pro</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </button>
                    </div>
                  </>
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

          {/* TAB 2: FEATURES & MODULES */}
          {activeTab === "features" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-0.5">
                <span>Intelligent Feature Control & Modular Capabilities</span>
                <span className="text-[10px] font-mono text-emerald-400/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  IPC Guard Synchronized
                </span>
              </div>

              {/* Modular Features List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                {(Object.keys(FEATURE_REGISTRY) as FeatureId[]).map((fid) => {
                  const meta = FEATURE_REGISTRY[fid];
                  const state = featureMatrix[fid] || { enabled: true, health: { status: "healthy", errorCount: 0 } };
                  const isEnabled = state.enabled;
                  const isHealed = state.health.status === "healed";

                  return (
                    <React.Fragment key={fid}>
                      <div
                        className={cn(
                          "p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3",
                          isEnabled
                            ? "bg-zinc-900/60 border-white/[0.08]"
                            : "bg-black/30 border-white/[0.03] opacity-60"
                        )}
                      >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-white truncate">{meta.name}</span>
                          {meta.isPro && (
                            <span className="px-1.5 py-0.2 bg-purple-500/20 border border-purple-500/30 text-[9.5px] font-semibold text-purple-300 rounded">
                              PRO
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[10px]">
                            {isHealed ? (
                              <span className="text-amber-400 font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Auto-Repaired
                              </span>
                            ) : isEnabled ? (
                              <span className="text-emerald-400 font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-tight">
                          {meta.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isHealed && (
                          <button
                            type="button"
                            onClick={() => {
                              resetFeatureHealth(fid);
                              notify(`${meta.name} circuit breaker reset to healthy`);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.08] transition text-[10px] flex items-center gap-1 cursor-pointer"
                            title="Reset Health Status"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] text-amber-300">Reset</span>
                          </button>
                        )}

                        {fid === "secret_vault" && isEnabled && (
                          <button
                            type="button"
                            onClick={() => setShowProfileEditor((prev) => !prev)}
                            className="px-2 py-0.5 rounded text-[10.5px] font-mono text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 transition cursor-pointer"
                          >
                            Profiles ({profiles.length})
                          </button>
                        )}

                        {/* Minimalist iOS/Win11 Style Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={`Toggle ${meta.name}`}
                          onClick={() => {
                            const next = toggleFeature(fid);
                            notify(`${meta.name}: ${next ? "Enabled" : "Disabled"}`);
                          }}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            isEnabled ? "bg-emerald-500" : "bg-zinc-700"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                              isEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {fid === "secret_vault" && isEnabled && showProfileEditor && (
                      <div className="p-3 rounded-xl border border-purple-500/25 bg-black/40 space-y-3 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-purple-400" />
                            <span>DPAPI Encrypted Profiles</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">Bound to Windows User SID</span>
                        </div>

                        {profiles.length > 0 && (
                          <div className="space-y-1.5">
                            {profiles.map((prof) => (
                              <div
                                key={prof.name}
                                className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-white/[0.05] text-xs font-mono"
                              >
                                <div>
                                  <span className="text-white font-semibold">{prof.name}</span>
                                  <span className="text-zinc-500 ml-2">({prof.var_count} secrets)</span>
                                  <div className="text-[10px] text-zinc-400 truncate max-w-[280px]">
                                    {prof.redacted_keys.join(", ")}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteEnvProfile(prof.name);
                                    reloadProfiles();
                                    notify(`Deleted profile '${prof.name}'`);
                                  }}
                                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="Delete profile"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-white/[0.06] space-y-2">
                          <div className="text-[11px] font-semibold text-zinc-300">Add New Profile</div>
                          <input
                            type="text"
                            placeholder="Profile Name (e.g. staging, local-docker)"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs rounded-md bg-zinc-900 border border-white/[0.1] text-white focus:outline-none focus:border-purple-400 font-mono"
                          />

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="KEY (e.g. STRIPE_KEY)"
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                              className="w-1/2 px-2 py-1 text-xs rounded-md bg-zinc-900 border border-white/[0.1] text-white focus:outline-none focus:border-purple-400 font-mono uppercase"
                            />
                            <div className="w-1/2 relative flex items-center">
                              <input
                                type={showSecretText ? "text" : "password"}
                                placeholder="VALUE"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full px-2 py-1 pr-6 text-xs rounded-md bg-zinc-900 border border-white/[0.1] text-white focus:outline-none focus:border-purple-400 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecretText(!showSecretText)}
                                className="absolute right-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                              >
                                {showSecretText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (newKey.trim() && newValue) {
                                  setNewEntries([...newEntries, { key: newKey.trim().toUpperCase(), value: newValue }]);
                                  setNewKey("");
                                  setNewValue("");
                                }
                              }}
                              className="px-2 py-1 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {newEntries.length > 0 && (
                            <div className="text-[10.5px] font-mono text-zinc-400 space-y-0.5 max-h-16 overflow-y-auto">
                              {newEntries.map((e, idx) => (
                                <div key={idx} className="flex justify-between items-center text-purple-300">
                                  <span>{e.key} = ****</span>
                                  <button
                                    type="button"
                                    onClick={() => setNewEntries(newEntries.filter((_, i) => i !== idx))}
                                    className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={!newProfileName.trim() || newEntries.length === 0}
                            onClick={async () => {
                              try {
                                await saveEnvProfile({
                                  name: newProfileName.trim(),
                                  variables: newEntries,
                                });
                                notify(`✓ Encrypted and saved profile '${newProfileName}'`);
                                setNewProfileName("");
                                setNewEntries([]);
                                reloadProfiles();
                              } catch (err: any) {
                                notify(`Error: ${err.message || err}`);
                              }
                            }}
                            className="w-full py-1.5 px-3 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Save to Windows DPAPI Vault</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {fid === "local_copilot" && isEnabled && (
                      <div className="p-3 rounded-xl border border-sky-500/25 bg-black/40 space-y-3 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                            <span>AI & Copilot Configuration</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">100% Local or BYOK</span>
                        </div>

                        {/* Model Lane Info */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.05] space-y-1 flex flex-col justify-between">
                            <div>
                              <div className="text-white font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Lane A: Local Ollama</span>
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-normal mt-0.5">100% Free & Private • Zero token fees • Runs on device</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                tauriInvoke("open_url", { url: "https://github.com/codecheesee/altspace/blob/main/docs/OLLAMA_SETUP_GUIDE.md" });
                                notify("Opening Ollama Setup Guide in browser...");
                              }}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-mono pt-1 cursor-pointer w-fit"
                            >
                              <span>Setup & model guide</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.05] space-y-1">
                            <div className="text-white font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                              <span>Lane B: BYOK Cloud</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-normal">Anthropic / OpenAI / DeepSeek • Keys stored in DPAPI</p>
                          </div>
                        </div>

                        {/* BYOK Providers */}
                        {byokProviders.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-mono text-zinc-400">Configured BYOK Providers</div>
                            <div className="flex gap-1.5 flex-wrap">
                              {byokProviders.map((p) => (
                                <span
                                  key={p}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1"
                                >
                                  <span>{p}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteByokKey(p);
                                      reloadByok();
                                      notify(`Removed BYOK key for '${p}'`);
                                    }}
                                    className="text-zinc-500 hover:text-rose-400 ml-1 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add / Update BYOK Key */}
                        <div className="pt-2 border-t border-white/[0.06] space-y-2">
                          <div className="text-[11px] font-semibold text-zinc-300">Set Hardware-Bound API Key</div>
                          <div className="flex gap-2">
                            <select
                              value={selectedByokProvider}
                              onChange={(e) => setSelectedByokProvider(e.target.value)}
                              className="px-2 py-1 rounded bg-black/60 border border-white/[0.1] text-xs text-white font-mono focus:outline-none"
                            >
                              <option value="anthropic">Anthropic (Claude 3.7)</option>
                              <option value="openai">OpenAI (GPT-4o)</option>
                              <option value="deepseek">DeepSeek</option>
                              <option value="groq">Groq</option>
                            </select>

                            <div className="flex-1 relative">
                              <input
                                type={showByokKey ? "text" : "password"}
                                placeholder="Paste API Key (sk-...)"
                                value={byokApiKeyInput}
                                onChange={(e) => setByokApiKeyInput(e.target.value)}
                                className="w-full px-2 py-1 pr-6 rounded bg-black/60 border border-white/[0.1] text-xs font-mono text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowByokKey(!showByokKey)}
                                className="absolute right-1.5 top-1.5 text-zinc-500 hover:text-white"
                              >
                                {showByokKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={!byokApiKeyInput.trim()}
                              onClick={async () => {
                                try {
                                  await storeByokKey(selectedByokProvider, byokApiKeyInput.trim());
                                  reloadByok();
                                  setByokApiKeyInput("");
                                  notify(`✓ Encrypted ${selectedByokProvider} key in Windows DPAPI`);
                                } catch (err: any) {
                                  notify(`Error: ${err.message || err}`);
                                }
                              }}
                              className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              </div>

              {/* Free Primitives Guarantee Box */}
              <div className="p-2.5 rounded-xl border border-white/[0.05] bg-zinc-950/40 text-[11px] text-zinc-400 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Always Free: Search, app launcher, clipboard history, and single port killing remain 100% free under Apache 2.0.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT */}
          {activeTab === "about" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2.5">
                <div className="flex items-center gap-3">
                  <img src="/app-icon.png" alt="AltSpace Logo" className="w-9 h-9 rounded-lg shadow-sm shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/favicon.svg"; }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">AltSpace for Windows</span>
                      <span className="text-[10px] font-mono text-zinc-400">v2.2.0</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal truncate">
                      Sub-5ms native command palette & file indexer.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenUrl("https://codecheesee.github.io/altspace/")}
                  className="w-full py-1.5 px-3 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Visit AltSpace Official Website & Plans</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Software Updates Section */}
              <div className="p-3 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-semibold text-white">System Updates</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Channel: Stable
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Check for verified signed releases, view feature changelogs, and install updates.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenUpdateModal) {
                      onClose();
                      onOpenUpdateModal();
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.1] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-sky-400" />
                  <span>Check for Updates</span>
                </button>
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
                <div className="flex items-center justify-between py-1 border-b border-white/[0.05]">
                  <span className="text-zinc-400">Releases & Notes</span>
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/releases")}
                    className="text-zinc-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    GitHub Releases
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400">Community</span>
                  <button
                    onClick={() => handleOpenUrl("https://discord.gg/EtVCN9m7JV")}
                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    Discord Server
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* Developer Community Card */}
              <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Developer Community</span>
                  <span className="text-[10px] font-mono text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
                    Discord
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-normal">
                  Join the Codecheesee Builds Discord for systems engineering discussion, release alerts, and technical support.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenUrl("https://discord.gg/EtVCN9m7JV")}
                  className="w-full py-1.5 px-3 rounded-md bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Join Discord Community</span>
                  <ExternalLink className="w-3 h-3 text-indigo-300" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
