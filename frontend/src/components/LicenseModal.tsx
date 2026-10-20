import { useEffect, useRef, useState } from "react";
import {
  Award,
  Check,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import {
  ACTIVE_BOUNTIES,
  deactivateLicense,
  getLicenseStatus,
  refreshEntitlement,
  type FeatureBounty,
  type LicenseStatus,
} from "../lib/license";
import { fetchLiveBounties, calculateTreasuryStats, type TreasuryStats } from "../lib/bountySync";
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
  GITHUB_MAINTAINER_LOGIN,
  pollGitHubDeviceToken,
  startGitHubDeviceFlow,
  type DeviceCodeResponse,
  type UserSession,
} from "../lib/authProvider";
import { tauriInvoke } from "../lib/appStorage";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme?: { accentHex: string; bg: string; borderColor: string };
  notify: (msg: string) => void;
}

export function LicenseModal({ isOpen, onClose, notify }: LicenseModalProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(getLicenseStatus());
  const [session, setSession] = useState<UserSession | null>(getCurrentSession());
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => detectUserCurrency());
  const [bounties, setBounties] = useState<FeatureBounty[]>(ACTIVE_BOUNTIES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats>(() => calculateTreasuryStats(ACTIVE_BOUNTIES));

  // Device Flow state
  const [deviceFlow, setDeviceFlow] = useState<DeviceCodeResponse | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pricing = getRegionalPricing(selectedCurrency);

  const loadBounties = async () => {
    setIsRefreshing(true);
    try {
      const list = await fetchLiveBounties();
      if (list.length > 0) {
        setBounties(list);
        setTreasuryStats(calculateTreasuryStats(list));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSession(getCurrentSession());
    setLicenseStatus(getLicenseStatus());
    void refreshEntitlement().then(setLicenseStatus);
    void loadBounties();
  }, [isOpen]);

  // Keyboard shortcut: Escape instantly dismisses the modal
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

  const handleSignOut = () => {
    deactivateLicense();
    setSession(null);
    const updated = getLicenseStatus();
    setLicenseStatus(updated);
    notify("Signed out. Switched to Community Edition.");
  };

  const handleQuickMaintainerUnlock = async () => {
    activateSovereignMaintainer();
    setSession(getCurrentSession());
    const updated = await refreshEntitlement();
    setLicenseStatus(updated);
    notify("Maintainer Sovereign Access Activated for @codecheesee!");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (deviceFlow) handleCancelAuth();
          else onClose();
        }
      }}
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-[0_24px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[88vh] text-zinc-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-black/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base tracking-tight">Supporter Edition & Identity</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Core app is free forever. Connect GitHub to sync your license.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
            title="Close dialog (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* GitHub Identity Card */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {session?.avatarUrl ? (
                <img
                  src={session.avatarUrl}
                  alt={session.login}
                  className="w-10 h-10 rounded-full border border-white/20 shrink-0 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm truncate">
                    {session?.login ? `@${session.login}` : "Not Connected"}
                  </span>
                  {licenseStatus.isMaintainer ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Maintainer
                    </span>
                  ) : licenseStatus.tier === "Pro" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Pro
                    </span>
                  ) : licenseStatus.tier === "Contributor" || licenseStatus.role === "contributor" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Contributor
                    </span>
                  ) : licenseStatus.isSupporter || licenseStatus.tier === "Supporter" ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Supporter
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Community Edition
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {session?.login
                    ? "GitHub profile linked. Licenses & bounties sync automatically."
                    : "Sign in with GitHub to verify contributor or sponsor license."}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {session?.login ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartDeviceAuth}
                  disabled={isAuthenticating}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />Sign in with GitHub
                </button>
              )}
            </div>
          </div>

          {/* Device Flow Prompt Modal / Card */}
          {deviceFlow && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.08] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
                  GitHub Device Authentication (RFC 8628)
                </span>
                <button
                  type="button"
                  onClick={handleCancelAuth}
                  className="text-zinc-400 hover:text-white text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-zinc-300 text-xs">
                Enter this 8-character code in your browser at{" "}
                <span className="font-mono text-indigo-400 font-semibold">{deviceFlow.verification_uri}</span>:
              </p>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 rounded-xl bg-black/60 border border-indigo-500/40 text-2xl font-mono font-bold tracking-widest text-indigo-200 select-all">
                  {deviceFlow.user_code}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenUrl(deviceFlow.verification_uri)}
                  className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />Open GitHub
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                Waiting for approval in browser... (Expires in {Math.round(deviceFlow.expires_in / 60)}m)
              </div>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] text-rose-300 text-xs">
              {authError}
            </div>
          )}

          {/* Pricing & Treasury Tier Card */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Supporter Tier</span>
                <div className="flex items-center bg-black/40 p-0.5 rounded-md border border-white/[0.08]">
                  {(["INR", "USD"] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setSelectedCurrency(currency)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                        selectedCurrency === currency ? "bg-zinc-700 text-white font-semibold" : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {currency === "INR" ? "₹ INR" : "$ USD"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold text-white">{pricing.formattedPrice}</span>
                <span className="text-zinc-400">/ year ({pricing.monthlyEquivalent})</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                <Gift className="w-3.5 h-3.5" />20% ({pricing.formattedTreasury}) funds Community Bounties
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />Treasury Active
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 font-mono">₹{treasuryStats.totalFundedINR.toLocaleString()} Allocated</div>
            </div>
          </div>

          {/* Entitlement Status Banner */}
          {licenseStatus.isMaintainer || licenseStatus.tier === "Maintainer" ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08]">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Maintainer Sovereign Access Active
              </div>
              <p className="text-[11px] text-zinc-300 mt-2">
                Logged in as @{licenseStatus.login || GITHUB_MAINTAINER_LOGIN} • Permanent Lifetime Sovereign Access (Unlimited Multi-Drive, AI Prompts & Shell Runner).
              </p>
            </div>
          ) : licenseStatus.tier === "Pro" ? (
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/[0.08]">
              <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Pro Edition Entitlement Active
              </div>
              <p className="text-[11px] text-zinc-300 mt-2">
                Provider: {licenseStatus.provider || "lemonsqueezy"} • Unmetered Advanced Actions (Multi-drive, AI Prompts & Shell Runner).
                {licenseStatus.expiresAt ? ` • Valid until ${new Date(licenseStatus.expiresAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          ) : licenseStatus.tier === "Contributor" || licenseStatus.role === "contributor" ? (
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.08]">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Verified Code Contributor Entitlement (2+ Merged PRs)
              </div>
              <p className="text-[11px] text-zinc-300 mt-2">
                Thank you for contributing to AltSpace! 1-year unmetered advanced actions unlocked.
                {licenseStatus.expiresAt ? ` • Valid until ${new Date(licenseStatus.expiresAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          ) : licenseStatus.isSupporter || licenseStatus.tier === "Supporter" ? (
            <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06]">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" />
                Provider-verified Supporter Entitlement Active
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Provider: {licenseStatus.provider || "configured entitlement service"}
                {licenseStatus.expiresAt ? ` • Valid until ${new Date(licenseStatus.expiresAt).toLocaleDateString()}` : ""}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCheckout}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />Open hosted checkout<ExternalLink className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenUrl(GITHUB_SPONSORS_URL)}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />Sponsor on GitHub (≥$2/mo or ≥$15)<ExternalLink className="w-3 h-3 text-zinc-600" />
              </button>
              <p className="text-[11px] text-zinc-500">
                {licenseStatus.reason} Normal searches are free forever. Contributors with 2+ merged PRs receive 1 year free.
              </p>
            </div>
          )}

          {/* Quick Maintainer Option for Narayan */}
          {!licenseStatus.isMaintainer && (
            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Are you the repository maintainer?</span>
              <button
                type="button"
                onClick={handleQuickMaintainerUnlock}
                className="text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
              >
                Unlock @codecheesee Sovereign Access
              </button>
            </div>
          )}

          {/* Live Feature Bounties */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-xs uppercase tracking-wide">Live GitHub Feature Bounties</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {treasuryStats.openBountiesCount} Open
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadBounties()}
                title="Sync latest bounties from GitHub"
                className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />Sync
              </button>
            </div>
            <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden bg-black/20">
              {bounties.length > 0 ? (
                bounties.map((bounty) => (
                  <button
                    key={bounty.id}
                    type="button"
                    onClick={() => handleOpenUrl(bounty.githubIssueUrl)}
                    className="w-full text-left p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{bounty.title}</div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{bounty.description}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-xs font-semibold shrink-0">
                      ₹{bounty.bountyAmountINR.toLocaleString()}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400">No open bounties currently funded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-black/30 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/40" />Apache 2.0 Open Source Core • 100% Free Forever
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
}
