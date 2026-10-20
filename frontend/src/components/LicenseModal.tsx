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
  CreditCard,
} from "lucide-react";
import {
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
import {
  getRegionalPricing,
  detectUserCurrency,
  GITHUB_SPONSORS_URL,
  POLAR_PROFILE_URL,
  EVALUATION_LICENSE_KEY,
  type CurrencyCode,
} from "../lib/checkout";
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
  notify,
}: LicenseModalProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(getLicenseStatus());
  const [inputKey, setInputKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // Currency & Purchasing Power Parity State
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() =>
    detectUserCurrency()
  );
  const pricing = getRegionalPricing(selectedCurrency);

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

  const handleOpenUrl = (url: string) => {
    if (tauriInvoke) {
      tauriInvoke("open_url", { url });
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-[0_24px_50px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col max-h-[85vh] text-zinc-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-black/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-amber-400 shadow-sm">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base tracking-tight">
                  Supporter Edition & Community Treasury
                </h3>
                {licenseStatus.isSupporter && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-400 text-black shadow-sm">
                    ★ ACTIVE SUPPORTER
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Core app is 100% Free Apache-2.0. Supporter licenses fund open source contributor bounties.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Pricing & Regional PPP Breakdown Card */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 shadow-sm flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Supporter Tier
                </span>
                {/* Currency Selector Pill */}
                <div className="flex items-center bg-black/40 p-0.5 rounded-md border border-white/[0.08]">
                  <button
                    onClick={() => setSelectedCurrency("INR")}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      selectedCurrency === "INR"
                        ? "bg-zinc-700 text-white font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    ₹ INR
                  </button>
                  <button
                    onClick={() => setSelectedCurrency("USD")}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      selectedCurrency === "USD"
                        ? "bg-zinc-700 text-white font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              </div>

              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {pricing.formattedPrice}
                </span>
                <span className="text-zinc-400">/ year ({pricing.monthlyEquivalent})</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                <Gift className="w-3.5 h-3.5" />
                <span>20% ({pricing.formattedTreasury}) directly funds Community Bounties</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Treasury Active</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                ₹{treasuryStats.totalFundedINR.toLocaleString()} Allocated
              </div>
            </div>
          </div>

          {/* Quick Actions & Checkout */}
          {!licenseStatus.isSupporter && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleActivate(EVALUATION_LICENSE_KEY)}
                className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-white font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Activate Free Evaluation</span>
              </button>

              <button
                onClick={() => handleOpenUrl(GITHUB_SPONSORS_URL)}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Sponsor on GitHub</span>
                <ExternalLink className="w-3 h-3 text-zinc-600 ml-0.5" />
              </button>
            </div>
          )}

          {/* Active Status or License Activation Box */}
          {licenseStatus.isSupporter ? (
            <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Supporter License Active</span>
                </div>
                <div className="text-zinc-300 text-xs font-mono">
                  Key: {licenseStatus.licenseKey?.slice(0, 10)}••••••••••••
                </div>
                {licenseStatus.expiresAt && (
                  <div className="text-[11px] text-zinc-400">
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
              <label className="block text-xs font-medium text-zinc-300">
                Have a license key? Enter it below:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="ALTSP-SUPPORTER-YYYYMMDD-HASH"
                    className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-zinc-400"
                  />
                </div>
                <button
                  onClick={() => handleActivate()}
                  disabled={isActivating}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium text-xs transition cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
                >
                  {isActivating ? "Verifying..." : "Activate"}
                </button>
              </div>

              {errorMsg && (
                <p className="text-rose-400 text-xs">{errorMsg}</p>
              )}

              <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
                <button
                  onClick={() => handleOpenUrl(POLAR_PROFILE_URL)}
                  className="hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard className="w-3 h-3 text-zinc-400" />
                  <span>Polar.sh Profile</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>

                <button
                  onClick={() => handleOpenUrl(pricing.checkoutUrl)}
                  className="hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Sponsorship Guide</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
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
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {treasuryStats.openBountiesCount} Open
                </span>
              </div>
              <button
                onClick={loadBounties}
                title="Sync latest bounties from GitHub"
                className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </button>
            </div>

            <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden bg-black/20">
              {bounties.length > 0 ? (
                bounties.map((bounty) => (
                  <div
                    key={bounty.id}
                    onClick={() => handleOpenUrl(bounty.githubIssueUrl)}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white group-hover:text-sky-300 transition">
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
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {bounty.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        {bounty.assignee ? (
                          <span>Claimed by @{bounty.assignee}</span>
                        ) : (
                          <span className="text-sky-400">View issue and claim on GitHub →</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-xs font-semibold">
                        ₹{bounty.bountyAmountINR.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400 space-y-1">
                  <p className="text-zinc-300 font-medium">No open bounties currently funded.</p>
                  <p className="text-[11px] text-zinc-500">
                    Maintainers allocate 20% of Supporter revenue to public GitHub issues labeled <span className="font-mono text-zinc-300">bounty</span>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-black/30 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/40" />
            <span>Apache 2.0 Open Source Core • 100% Free Forever</span>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition cursor-pointer border border-zinc-700/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
