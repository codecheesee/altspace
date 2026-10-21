import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Heart,
  Info,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
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
  activateSovereignMaintainer,
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

type TabType = "account" | "permissions" | "about";

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
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => detectUserCurrency());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual key input
  const [manualKeyOpen, setManualKeyOpen] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState("");

  // Device Flow state (RFC 8628)
  const [deviceFlow, setDeviceFlow] = useState<DeviceCodeResponse | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Keyboard shortcut: Escape dismisses the modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (deviceFlow) {
          handleCancelAuth();
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

  const handleCheckout = () => {
    if (pricing.checkoutUrl.includes("REPLACE_WITH_VARIANT_ID")) {
      notify("Opening GitHub Sponsors (direct card & UPI checkout)...");
      handleOpenUrl(GITHUB_SPONSORS_URL);
      return;
    }
    openCheckout(selectedCurrency);
  };

  // Start GitHub Device Flow (RFC 8628)
  const handleStartDeviceAuth = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    abortControllerRef.current = new AbortController();

    try {
      const flow = await startGitHubDeviceFlow();
      setDeviceFlow(flow);

      // Automatically open verification URI in browser
      handleOpenUrl(flow.verification_uri || "https://github.com/login/device");

      // Begin polling for token
      const token = await pollGitHubDeviceToken(
        GITHUB_CLIENT_ID,
        flow.device_code,
        flow.interval,
        abortControllerRef.current.signal
      );

      const userProfile = await fetchGitHubUserProfile(token);
      setSession(userProfile);
      setDeviceFlow(null);
      setIsAuthenticating(false);

      notify(`Connected GitHub account @${userProfile.login}! Checking entitlements...`);
      const updated = await refreshEntitlement();
      setLicenseStatus(updated);
    } catch (err: any) {
      if (abortControllerRef.current?.signal.aborted) {
        setIsAuthenticating(false);
        setDeviceFlow(null);
        return;
      }
      setAuthError(err?.message || "Authentication failed. Please try again.");
      setIsAuthenticating(false);
    }
  };

  const handleCancelAuth = () => {
    abortControllerRef.current?.abort();
    setDeviceFlow(null);
    setIsAuthenticating(false);
    setAuthError(null);
  };

  const handleCopyCode = async () => {
    if (!deviceFlow?.user_code) return;
    try {
      await navigator.clipboard.writeText(deviceFlow.user_code);
      setCopiedCode(true);
      notify("Device code copied to clipboard!");
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (_) {}
  };

  const handleCopyMachineId = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      notify("Machine ID copied to clipboard!");
      setTimeout(() => setCopiedMachineId(false), 2500);
    } catch (_) {}
  };

  const handleSignOut = () => {
    deactivateLicense();
    setSession(null);
    const updated = getLicenseStatus();
    setLicenseStatus(updated);
    notify("Signed out. Switched to Community Edition.");
  };

  const handleActivateManualKey = async () => {
    if (!manualKeyInput.trim()) return;
    setIsRefreshing(true);
    try {
      const updated = await activateManualLease(manualKeyInput);
      setLicenseStatus(updated);
      setManualKeyInput("");
      setManualKeyOpen(false);
      notify("License lease activated successfully!");
    } catch (err: any) {
      notify(`Activation error: ${err?.message || err}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickMaintainerUnlock = async () => {
    activateSovereignMaintainer();
    setSession(getCurrentSession());
    const updated = await refreshEntitlement();
    setLicenseStatus(updated);
    notify("Maintainer Sovereign Access Activated for @codecheesee!");
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
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[580px] max-h-[88vh] border border-white/[0.08] bg-[#0c0c0e] rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.01]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold text-white tracking-tight">About & Account</h2>
                <span
                  className={cn(
                    "text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                    licenseStatus.tier === "Maintainer"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : licenseStatus.tier === "Pro"
                      ? "text-purple-400 bg-purple-500/10 border-purple-500/30"
                      : licenseStatus.tier === "Supporter"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : licenseStatus.tier === "Contributor"
                      ? "text-sky-400 bg-sky-500/10 border-sky-500/30"
                      : "text-zinc-400 bg-zinc-800/80 border-zinc-700/60"
                  )}
                >
                  {licenseStatus.tier} Tier
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[340px]">
                {session ? `@${session.login}` : "Not signed in"} • Windows Desktop
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshStatus()}
              disabled={isRefreshing}
              className="p-1.5 rounded-md hover:bg-white/[0.05] text-zinc-400 hover:text-white transition disabled:opacity-50"
              title="Refresh Subscription Status"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-indigo-400")} />
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-zinc-400 hover:text-white transition p-1 hover:bg-white/[0.05] rounded-md cursor-pointer"
              title="Close (Esc)"
            >
              <kbd className="kbd-cap hover:border-zinc-500">Esc</kbd>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-2 border-b border-white/[0.06] bg-[#0c0c0e]">
          <button
            onClick={() => setActiveTab("account")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-[1px] flex items-center gap-1.5 cursor-pointer",
              activeTab === "account"
                ? "text-white border-indigo-500 font-semibold"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            )}
          >
            <User className="w-3.5 h-3.5" />
            Account & Identity
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-[1px] flex items-center gap-1.5 cursor-pointer",
              activeTab === "permissions"
                ? "text-white border-indigo-500 font-semibold"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Plan Permissions
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-[1px] flex items-center gap-1.5 cursor-pointer",
              activeTab === "about"
                ? "text-white border-indigo-500 font-semibold"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            )}
          >
            <Info className="w-3.5 h-3.5" />
            About AltSpace
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[64vh]">
          {/* TAB 1: ACCOUNT & IDENTITY */}
          {activeTab === "account" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Plan Status Banner */}
              <div
                className={cn(
                  "p-3.5 rounded-xl border relative overflow-hidden",
                  isProOrSupporter
                    ? "bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-black/60 border-purple-500/30"
                    : "bg-white/[0.02] border-white/[0.07]"
                )}
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {isProOrSupporter ? (
                        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <Zap className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-white tracking-wide">
                        {isProOrSupporter ? `${licenseStatus.tier} Subscription Active` : "Free Community Edition"}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed max-w-[420px]">
                      {isProOrSupporter
                        ? licenseStatus.reason || "Full unmetered access to hosted AI models, cloud sync, and priority workflows."
                        : "Normal local searches, app launches, ports, and calculator are 100% free and unlimited forever."}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                      isProOrSupporter
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    )}
                  >
                    {isProOrSupporter ? "UNMETERED" : "FREE CORE"}
                  </span>
                </div>

                {/* Free Tier Trial Quota Usage Bar */}
                {!isProOrSupporter && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-zinc-400">Monthly Hosted AI & Shell Quota</span>
                      <span className="text-zinc-200 font-mono font-medium">
                        {quota.used} / {ADVANCED_SEARCH_LIMIT} actions
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          quotaUsedPct >= 80 ? "bg-amber-400" : "bg-emerald-400"
                        )}
                        style={{ width: `${quotaUsedPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-zinc-400">
                      <span>Resets on {quotaResetDate}</span>
                      <span>Local searches consume 0 quota</span>
                    </div>
                  </div>
                )}
              </div>

              {/* User Identity & GitHub Auth */}
              <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.01] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    GitHub Identity & Cloud Account
                  </span>
                  {session && (
                    <span className="text-[9.5px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      OAuth Connected
                    </span>
                  )}
                </div>

                {session ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {session.avatarUrl ? (
                        <img
                          src={session.avatarUrl}
                          alt={session.login}
                          className="w-10 h-10 rounded-full border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 font-bold">
                          {session.login.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>{session.name || session.login}</span>
                          <span className="text-[10.5px] text-zinc-400 font-mono">(@{session.login})</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>Auth: {session.provider}</span>
                          {session.email && <span>• {session.email}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void refreshStatus()}
                        className="px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition border border-white/[0.06] cursor-pointer"
                        title="Re-verify Sponsor / Pro role from GitHub"
                      >
                        Refresh Role
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition border border-rose-500/20 cursor-pointer flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Sign in with GitHub to link your subscription, claim your backer tier, and sync custom workflows.
                    </p>

                    {deviceFlow ? (
                      <div className="p-3 rounded-lg bg-zinc-900 border border-indigo-500/30 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-300 font-medium">1. Copy your verification code:</span>
                          <button
                            onClick={handleCancelAuth}
                            className="text-[10px] text-zinc-400 hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-1.5 px-3 bg-black/60 rounded-md border border-white/10 font-mono text-base font-bold text-center tracking-widest text-indigo-400 select-all">
                            {deviceFlow.user_code}
                          </div>
                          <button
                            onClick={handleCopyCode}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedCode ? "Copied!" : "Copy"}
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                            Waiting for approval in browser...
                          </span>
                          <button
                            onClick={() => handleOpenUrl(deviceFlow.verification_uri || "https://github.com/login/device")}
                            className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          >
                            Open github.com/login/device
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {authError && <p className="text-[10.5px] text-rose-400 mt-1">{authError}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleStartDeviceAuth}
                          disabled={isAuthenticating}
                          className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                          <GithubIcon className="w-3.5 h-3.5" />
                          {isAuthenticating ? "Connecting..." : "Sign In with GitHub (RFC 8628)"}
                        </button>

                        <button
                          onClick={handleQuickMaintainerUnlock}
                          className="px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition border border-white/[0.05] cursor-pointer"
                          title="Instant sovereign maintainer activation for @codecheesee"
                        >
                          👑 Maintainer Unlock
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hardware Device Identity */}
              <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.01] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Laptop className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Hardware Machine Identifier</span>
                  </div>
                  <span className="text-[9.5px] font-mono text-zinc-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
                    Windows DPAPI Protected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 py-1.5 px-2.5 bg-black/40 rounded-lg border border-white/[0.08] font-mono text-xs text-zinc-300 truncate select-all">
                    {machineId}
                  </div>
                  <button
                    onClick={handleCopyMachineId}
                    className="px-2.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] text-zinc-300 hover:text-white text-xs rounded-lg border border-white/[0.07] flex items-center gap-1 transition cursor-pointer"
                    title="Copy Machine ID"
                  >
                    {copiedMachineId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMachineId ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Every user machine is accurately identified by a hardware-bound cryptographic GUID. Tokens and secrets never leave your local PC unencrypted.
                </p>
              </div>

              {/* Upgrade or Manage Subscription */}
              {!isProOrSupporter ? (
                <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Upgrade to Pro / Supporter</div>
                      <div className="text-[10.5px] text-zinc-300">
                        Unlock unmetered cloud AI, cloud sync, and support open-source development.
                      </div>
                    </div>

                    {/* Regional Currency Toggle */}
                    <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-0.5">
                      <button
                        onClick={() => setSelectedCurrency("INR")}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded font-medium transition cursor-pointer",
                          selectedCurrency === "INR" ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        ₹ INR
                      </button>
                      <button
                        onClick={() => setSelectedCurrency("USD")}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded font-medium transition cursor-pointer",
                          selectedCurrency === "USD" ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:text-zinc-200"
                        )}
                      >
                        $ USD
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="space-y-0.5">
                      <div className="text-base font-bold text-white font-mono">
                        {pricing.formattedPrice}{" "}
                        <span className="text-[10px] text-zinc-400 font-normal">one-time / lifetime backer</span>
                      </div>
                      <div className="text-[9.5px] text-indigo-300 font-mono">
                        20% ({pricing.formattedTreasury}) auto-allocated to community bounties
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCheckout}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
                        Upgrade Now
                      </button>
                    </div>
                  </div>

                  {/* Manual Lease / Key Accordion */}
                  <div className="pt-2 border-t border-white/[0.05]">
                    {!manualKeyOpen ? (
                      <button
                        onClick={() => setManualKeyOpen(true)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                      >
                        Have an offline license key or enterprise lease? Click here
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                        <input
                          type="text"
                          placeholder="e.g. ALTS-PRO-SHILPI-2026"
                          value={manualKeyInput}
                          onChange={(e) => setManualKeyInput(e.target.value)}
                          className="flex-1 py-1 px-2.5 bg-black/60 rounded-md border border-white/10 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleActivateManualKey}
                          className="px-2.5 py-1 bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs rounded-md border border-white/10 cursor-pointer"
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => setManualKeyOpen(false)}
                          className="text-[10px] text-zinc-400 hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-950/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Active Subscriber Entitlements</div>
                    <div className="text-[10.5px] text-zinc-300">
                      Managed via {licenseStatus.provider || "GitHub Sponsors / Store"}. Thank you for supporting AltSpace!
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenUrl(GITHUB_SPONSORS_URL)}
                    className="px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-medium rounded-lg border border-white/10 flex items-center gap-1 transition cursor-pointer"
                  >
                    Manage Billing
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLAN PERMISSIONS ("WHAT CAN I DO?") */}
          {activeTab === "permissions" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-xs font-semibold text-white">Permission & Feature Matrix</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  AltSpace strictly separates offline local capabilities from hosted cloud services. Review what is permitted under your plan.
                </p>
              </div>

              {/* Section 1: Offline Core (Always Free & Unlimited) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Always Free & Unlimited (Offline Open Core)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {[
                    {
                      title: "Filesystem Search (C:, D:, External)",
                      desc: "Instant search and directory exploration across all mounted drives",
                    },
                    {
                      title: "App Launcher & Windows Management",
                      desc: "Instant app execution, window tiling, snap splitting, and system commands",
                    },
                    {
                      title: "Clipboard History & Secret Redaction",
                      desc: "Full local clipboard history with DPAPI token & password redaction",
                    },
                    {
                      title: "Developer Port Killer & Inspector",
                      desc: "Inspect localhost dev processes (:3000, :5173, :8080) and terminate orphans",
                    },
                    {
                      title: "Local Ollama AI (localhost:11434)",
                      desc: "100% private offline LLM queries with zero internet requirement",
                    },
                    {
                      title: "Calculator & Quick Jump",
                      desc: "Math evaluation, unit converter, and Windows settings shortcuts",
                    },
                    {
                      title: "Custom Themes & Hex Accent Glows",
                      desc: "12 preset themes, custom glow styling, and UI layout personalization",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between"
                    >
                      <div className="pr-3">
                        <div className="text-white font-medium text-[11.5px]">{item.title}</div>
                        <div className="text-zinc-400 text-[10px]">{item.desc}</div>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
                        FREE UNLIMITED
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Cloud & Advanced Entitlements */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Cloud & Advanced Capabilities (Role Governed)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {[
                    {
                      title: "Hosted Cloud AI (Claude 3.5, GPT-4o, DeepSeek)",
                      freePolicy: "100 actions / month trial",
                      proPolicy: "Unmetered unlimited queries",
                    },
                    {
                      title: "Shell Command Runner (> or cmd:)",
                      freePolicy: "100 actions / month trial",
                      proPolicy: "Unmetered execution",
                    },
                    {
                      title: "Encrypted Cloud Snippet Sync",
                      freePolicy: "Local machine only",
                      proPolicy: "Private GitHub Gist Sync",
                    },
                    {
                      title: "Community Extension Store",
                      freePolicy: "Built-in & verified plugins",
                      proPolicy: "Full store + private plugins",
                    },
                    {
                      title: "Hardware-Bound Signed Leases",
                      freePolicy: "Standard community",
                      proPolicy: "Signed lease with offline grace period",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between"
                    >
                      <div className="pr-3">
                        <div className="text-white font-medium text-[11.5px]">{item.title}</div>
                        <div className="text-zinc-400 text-[10px]">
                          Free: {item.freePolicy} • Pro: {item.proPolicy}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-mono px-2 py-0.5 rounded border font-bold shrink-0",
                          isProOrSupporter
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        )}
                      >
                        {isProOrSupporter ? "UNLOCKED" : "TRIAL / PRO"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT ALTSPACE */}
          {activeTab === "about" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.02] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs">
                    AS
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">AltSpace Windows Command Palette</h3>
                    <p className="text-[10px] text-zinc-400 font-mono">v2.0.0-preview (x64 Release)</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  A high-performance, native Windows command palette, application launcher, and developer toolkit engineered in Rust and TypeScript.
                </p>
              </div>

              {/* Architectural Highlights */}
              <div className="p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.01] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  System Architecture & Security
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded bg-black/40 border border-white/[0.05]">
                    <div className="text-zinc-400 text-[10px]">Search Engine</div>
                    <div className="text-white font-medium">Hybrid NTFS MFT & In-Memory</div>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.05]">
                    <div className="text-zinc-400 text-[10px]">Secret Vault</div>
                    <div className="text-white font-medium">Windows DPAPI Protected</div>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.05]">
                    <div className="text-zinc-400 text-[10px]">Execution Broker</div>
                    <div className="text-white font-medium">3-Level Policy Hardened</div>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/[0.05]">
                    <div className="text-zinc-400 text-[10px]">License</div>
                    <div className="text-white font-medium">Apache License 2.0</div>
                  </div>
                </div>
              </div>

              {/* Open-Source Links */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Official Links</span>
                <div className="grid grid-cols-1 gap-1 text-xs pt-1">
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace")}
                    className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-left flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <GithubIcon className="w-3.5 h-3.5 text-zinc-400" />
                      GitHub Repository (codecheesee/altspace)
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/releases")}
                    className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-left flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    <span>Release Notes & Changelog</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                  <button
                    onClick={() => handleOpenUrl("https://github.com/codecheesee/altspace/blob/main/LICENSE")}
                    className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-left flex items-center justify-between text-zinc-300 hover:text-white transition cursor-pointer"
                  >
                    <span>Apache License 2.0 Full Legal Notice</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10.5px] text-zinc-400">
            <span>Machine ID:</span>
            <span className="font-mono text-zinc-300 truncate max-w-[180px]">{machineId}</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium rounded-lg transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
