import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  deactivateLicense,
  getLicenseStatus,
  refreshEntitlement,
  activateManualLease,
  type LicenseStatus,
} from "../lib/license";
import {
  detectUserCurrency,
  getRegionalPricing,
  GITHUB_SPONSORS_URL,
  openCheckout,
  type CurrencyCode,
} from "../lib/checkout";
import {
  connectWithGitHubToken,
  connectWithGitHubUsername,
  getCurrentSession,
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
type AuthMethod = "token" | "username";

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
  const [selectedCurrency] = useState<CurrencyCode>(() => detectUserCurrency());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Authentication inputs
  const [authMethod, setAuthMethod] = useState<AuthMethod>("token");
  const [tokenInput, setTokenInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Manual key input
  const [manualKeyOpen, setManualKeyOpen] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState("");

  const [copiedMachineId, setCopiedMachineId] = useState(false);

  const pricing = getRegionalPricing(selectedCurrency);

  // Load hardware Machine ID and latest status
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

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

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

  const handleCheckout = () => {
    if (pricing.checkoutUrl.includes("REPLACE_WITH_VARIANT_ID")) {
      notify("Opening GitHub Sponsors...");
      handleOpenUrl(GITHUB_SPONSORS_URL);
      return;
    }
    openCheckout(selectedCurrency);
  };

  const handleConnectToken = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await connectWithGitHubToken(tokenInput.trim());
      setSession(user);
      setTokenInput("");
      notify(`Connected GitHub account @${user.login}!`);
      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } catch (err: any) {
      setAuthError(err?.message || "Failed to verify token.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnectUsername = async () => {
    if (!usernameInput.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await connectWithGitHubUsername(usernameInput.trim());
      setSession(user);
      setUsernameInput("");
      notify(`Linked GitHub profile @${user.login}!`);
      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } catch (err: any) {
      setAuthError(err?.message || "Failed to fetch profile.");
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
    notify("Disconnected GitHub account.");
  };

  const handleActivateManualKey = async () => {
    if (!manualKeyInput.trim()) return;
    setIsRefreshing(true);
    try {
      const updated = await activateManualLease(manualKeyInput);
      setLicenseStatus(updated);
      setManualKeyInput("");
      setManualKeyOpen(false);
      notify("License lease activated!");
    } catch (err: any) {
      notify(`Activation error: ${err?.message || err}`);
    } finally {
      setIsRefreshing(false);
    }
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
        className="w-full max-w-[500px] border border-white/[0.08] bg-[#0c0c0e] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
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
                    ? "All offline tools and hosted cloud features are unmetered."
                    : "Local searches and tools are unlimited forever. Resets monthly on " + quotaResetDate + "."}
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

              {/* GitHub Connection */}
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2.5">
                <div className="text-[10.5px] font-medium text-zinc-400 uppercase tracking-wider">
                  GitHub Profile
                </div>

                {session ? (
                  <div className="flex items-center justify-between">
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
                        Refresh
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition border border-rose-500/20 cursor-pointer flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[11px]">
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
                      <span className="text-zinc-600">•</span>
                      <button
                        onClick={() => setAuthMethod("username")}
                        className={cn(
                          "pb-0.5 border-b transition cursor-pointer",
                          authMethod === "username"
                            ? "text-white border-white font-medium"
                            : "text-zinc-500 border-transparent hover:text-zinc-300"
                        )}
                      >
                        Username Only
                      </button>
                    </div>

                    {authMethod === "token" ? (
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
                            {authLoading ? "Connecting..." : "Connect"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500">Requires 'read:user' scope</span>
                          <button
                            onClick={() =>
                              handleOpenUrl(
                                "https://github.com/settings/tokens/new?scopes=read:user&description=AltSpace"
                              )
                            }
                            className="text-zinc-400 hover:text-white flex items-center gap-1 underline cursor-pointer"
                          >
                            Generate token on GitHub
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="e.g. shilpi"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleConnectUsername()}
                          className="flex-1 py-1.5 px-2.5 bg-black/60 rounded-md border border-white/10 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-white/30"
                        />
                        <button
                          onClick={handleConnectUsername}
                          disabled={authLoading || !usernameInput.trim()}
                          className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-40"
                        >
                          {authLoading ? "Linking..." : "Link Profile"}
                        </button>
                      </div>
                    )}

                    {authError && (
                      <div className="text-[10.5px] text-rose-400 mt-1">{authError}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Device Identifier */}
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-1.5">
                <div className="text-[10.5px] font-medium text-zinc-400 uppercase tracking-wider">
                  Device Identifier
                </div>
                <div className="flex items-center justify-between bg-black/50 py-1.5 px-2.5 rounded-md border border-white/[0.06]">
                  <span className="font-mono text-xs text-zinc-300 select-all">{machineId}</span>
                  <button
                    onClick={handleCopyMachineId}
                    className="p-1 hover:bg-white/10 rounded transition text-zinc-400 hover:text-white cursor-pointer"
                    title="Copy Machine ID"
                  >
                    {copiedMachineId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Upgrade or Manage Subscription */}
              {!isProOrSupporter ? (
                <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Upgrade to Pro</div>
                      <div className="text-[10.5px] text-zinc-400">
                        {pricing.formattedPrice} one-time • Unmetered access
                      </div>
                    </div>
                    <button
                      onClick={handleCheckout}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-md transition cursor-pointer"
                    >
                      Upgrade
                    </button>
                  </div>

                  <div className="pt-1.5 border-t border-white/[0.05]">
                    {!manualKeyOpen ? (
                      <button
                        onClick={() => setManualKeyOpen(true)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                      >
                        Have an offline license key?
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="ALTS-PRO-..."
                          value={manualKeyInput}
                          onChange={(e) => setManualKeyInput(e.target.value)}
                          className="flex-1 py-1 px-2 bg-black/60 rounded border border-white/10 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none"
                        />
                        <button
                          onClick={handleActivateManualKey}
                          className="px-2.5 py-1 bg-white/[0.1] hover:bg-white/[0.2] text-white text-xs rounded cursor-pointer"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setManualKeyOpen(false)}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-white/[0.08] bg-zinc-900/50 flex items-center justify-between">
                  <div className="text-xs text-zinc-300">Subscription is active</div>
                  <button
                    onClick={() => handleOpenUrl(GITHUB_SPONSORS_URL)}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    Manage
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === "features" && (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="text-[10.5px] font-medium text-emerald-400 uppercase tracking-wider">
                  Always Free & Unlimited
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  {[
                    "Search all drives (C:, D:, External)",
                    "App launcher & window snap controls",
                    "Clipboard history with token redaction",
                    "Developer port killer (:3000, :5173, etc.)",
                    "Local Ollama AI (localhost:11434, offline)",
                    "Calculator, unit converter, system shortcuts",
                    "12 themes & custom accent glows",
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <div className="text-[10.5px] font-medium text-purple-400 uppercase tracking-wider">
                  Cloud & Pro Services
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    {
                      name: "Hosted Cloud AI (Claude 3.5, GPT-4o)",
                      plan: isProOrSupporter ? "Unlimited" : "100 / month trial",
                    },
                    {
                      name: "Shell Runner (> or cmd:)",
                      plan: isProOrSupporter ? "Unlimited" : "100 / month trial",
                    },
                    {
                      name: "Encrypted Cloud Snippet Sync",
                      plan: isProOrSupporter ? "Enabled" : "Local only",
                    },
                    {
                      name: "Community Extension Store",
                      plan: isProOrSupporter ? "Full store access" : "Verified plugins",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-zinc-300 py-0.5">
                      <span>{item.name}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{item.plan}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT */}
          {activeTab === "about" && (
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-3.5 rounded-lg border border-white/[0.08] bg-zinc-900/50 space-y-1">
                <div className="font-semibold text-white">AltSpace Windows Palette</div>
                <div className="text-[10px] text-zinc-500 font-mono">v2.0.0-preview (x64)</div>
                <div className="text-[11px] text-zinc-400 pt-1 leading-normal">
                  High-performance native command palette for Windows. Licensed under Apache 2.0.
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <button
                  onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace")}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/[0.06] flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <GithubIcon className="w-3.5 h-3.5 text-zinc-400" />
                    GitHub Repository
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                  onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/releases")}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/[0.06] flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <span>Release Notes & Downloads</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                  onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/blob/main/LICENSE")}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/[0.06] flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <span>Apache 2.0 License</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
