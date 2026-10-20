import { useState, useEffect } from "react";
import {
  Sparkles,
  Award,
  Heart,
  TrendingUp,
  X,
  Key,
  ShieldCheck,
  ExternalLink,
  Gift,
  RefreshCw,
} from "lucide-react";
import {
  SUPPORTER_PRICE_INR,
  TREASURY_PER_SALE_INR,
  ACTIVE_BOUNTIES,
  getLicenseStatus,
  activateLicenseKey,
  deactivateLicense,
  type LicenseStatus,
  type FeatureBounty,
} from "../lib/license";
import {
  fetchLiveBounties,
  calculateTreasuryStats,
  type TreasuryStats,
} from "../lib/bountySync";
import { tauriInvoke } from "../lib/appStorage";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: {
    accentHex: string;
    bg: string;
    borderColor: string;
  };
  notify: (msg: string) => void;
}

export function LicenseModal({
  isOpen,
  onClose,
  activeTheme,
  notify,
}: LicenseModalProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(getLicenseStatus());
  const [inputKey, setInputKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // Live Bounties & Treasury State
  const [bounties, setBounties] = useState<FeatureBounty[]>(ACTIVE_BOUNTIES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats>(() =>
    calculateTreasuryStats(ACTIVE_BOUNTIES)
  );

  const loadBounties = async () => {
    setIsRefreshing(true);
    try {
      const list = await fetchLiveBounties();
      if (list && list.length > 0) {
        setBounties(list);
        setTreasuryStats(calculateTreasuryStats(list));
      }
    } catch (_) {
      // fallback preserved
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLicenseStatus(getLicenseStatus());
      setErrorMsg(null);
      loadBounties();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleActivate = async (keyToUse?: string) => {
    const key = keyToUse || inputKey;
    setIsActivating(true);
    setErrorMsg(null);
    try {
      const res = await activateLicenseKey(key);
      if (res.success) {
        setLicenseStatus(getLicenseStatus());
        setInputKey("");
        notify("🌟 Supporter License Activated! Thank you for backing open source!");
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Activation error");
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = () => {
    deactivateLicense();
    setLicenseStatus(getLicenseStatus());
    notify("License removed. Reverted to Community Free Edition.");
  };

  const handleOpenBounty = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url });
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-neutral-200"
        style={{
          backgroundColor: activeTheme.bg || "#0f0f13",
          borderColor: activeTheme.borderColor || "#2a2b36",
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-amber-500/[0.12] via-purple-500/[0.08] to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base tracking-tight">
                  AltSpace Supporter & Community Treasury
                </h3>
                {licenseStatus.isSupporter && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black shadow-sm">
                    ★ ACTIVE SUPPORTER
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Core app is 100% Free Apache-2.0. Supporter licenses fund the Open Source Contributor Bounty Treasury.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Pricing & Treasury Breakdown Card */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                1-Year Supporter Tier
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-white tracking-tight">
                  ₹{SUPPORTER_PRICE_INR}
                </span>
                <span className="text-neutral-400">/ year (~$1.19 USD)</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                <Gift className="w-3.5 h-3.5" />
                <span>₹{TREASURY_PER_SALE_INR} (20%) directly funds Community Feature Bounties</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Treasury Active</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                ₹{treasuryStats.totalFundedINR.toLocaleString()} Allocated
              </div>
            </div>
          </div>

          {/* Active Status or License Activation Box */}
          {licenseStatus.isSupporter ? (
            <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Supporter License Active</span>
                </div>
                <div className="text-neutral-300 text-xs font-mono">
                  Key: {licenseStatus.licenseKey?.slice(0, 10)}••••••••••••
                </div>
                {licenseStatus.expiresAt && (
                  <div className="text-[11px] text-neutral-400">
                    Expires on: {new Date(licenseStatus.expiresAt).toLocaleDateString()}
                    {licenseStatus.daysRemaining !== undefined && (
                      <span className="ml-1 text-emerald-400">
                        ({licenseStatus.daysRemaining} days remaining)
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleDeactivate}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition cursor-pointer"
              >
                Deactivate
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-300">
                Activate Supporter Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="ALTSP-SUPPORTER-YYYYMMDD-HASH"
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-neutral-500 outline-none focus:border-amber-400/50"
                  />
                </div>
                <button
                  onClick={() => handleActivate()}
                  disabled={isActivating}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs transition cursor-pointer shrink-0 shadow-md disabled:opacity-50"
                >
                  {isActivating ? "Verifying..." : "Activate"}
                </button>
              </div>

              {errorMsg && (
                <p className="text-rose-400 text-xs">{errorMsg}</p>
              )}

              {/* Dev Test Quick Activation */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleActivate("ALTSP-SUPPORTER-2026")}
                  className="text-[11px] text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Test Supporter License Free (Dev Key)</span>
                </button>

                <a
                  href="https://github.com/codecheesee/altspace#supporter-license"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  <span>Get Official Key (₹99)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Active Community Feature Bounties */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-xs uppercase tracking-wide">
                  Live GitHub Feature Bounties
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">
                  {treasuryStats.openBountiesCount} Open
                </span>
              </div>
              <button
                onClick={loadBounties}
                title="Sync latest bounties from GitHub"
                className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px] transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </button>
            </div>

            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden bg-white/[0.01]">
              {bounties.map((bounty) => (
                <div
                  key={bounty.id}
                  onClick={() => handleOpenBounty(bounty.githubIssueUrl)}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white group-hover:text-purple-300 transition">
                        {bounty.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          bounty.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : bounty.status === "Claimed"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        }`}
                      >
                        {bounty.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {bounty.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500">
                      {bounty.assignee ? (
                        <span>Claimed by @{bounty.assignee}</span>
                      ) : (
                        <span className="text-sky-400">Click to view & claim on GitHub →</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/25 text-purple-300 font-mono text-xs font-semibold">
                      ₹{bounty.bountyAmountINR.toLocaleString()} Bounty
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs text-neutral-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/40" />
            <span>Apache 2.0 Open Source Core • 100% Free Forever</span>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
