import { useEffect, useState } from "react";
import { Award, ExternalLink, Gift, Heart, RefreshCw, ShieldCheck, TrendingUp, X } from "lucide-react";
import {
  ACTIVE_BOUNTIES,
  getLicenseStatus,
  refreshEntitlement,
  type FeatureBounty,
  type LicenseStatus,
} from "../lib/license";
import { fetchLiveBounties, calculateTreasuryStats, type TreasuryStats } from "../lib/bountySync";
import { detectUserCurrency, getRegionalPricing, GITHUB_SPONSORS_URL, openCheckout, type CurrencyCode } from "../lib/checkout";
import { tauriInvoke } from "../lib/appStorage";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme?: { accentHex: string; bg: string; borderColor: string };
  notify: (msg: string) => void;
}

export function LicenseModal({ isOpen, onClose, notify }: LicenseModalProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(getLicenseStatus());
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => detectUserCurrency());
  const [bounties, setBounties] = useState<FeatureBounty[]>(ACTIVE_BOUNTIES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats>(() => calculateTreasuryStats(ACTIVE_BOUNTIES));
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
      notify("Opening GitHub Sponsors (direct card & UPI checkout)...");
      handleOpenUrl(GITHUB_SPONSORS_URL);
      return;
    }
    openCheckout(selectedCurrency);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-[0_24px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh] text-zinc-200">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-black/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base tracking-tight">Supporter Edition & Community Treasury</h3>
              <p className="text-xs text-zinc-400 mt-0.5">The core app remains free. Purchases use a hosted Merchant of Record checkout.</p>
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

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
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

          {licenseStatus.isSupporter ? (
            <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06]">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" />Provider-verified Supporter entitlement active
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                Provider: {licenseStatus.provider || "configured entitlement service"}
                {licenseStatus.expiresAt ? ` • Expires ${new Date(licenseStatus.expiresAt).toLocaleDateString()}` : ""}
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
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />Sponsor on GitHub<ExternalLink className="w-3 h-3 text-zinc-600" />
              </button>
              <p className="text-[11px] text-zinc-500">
                {licenseStatus.reason} No license keys or development bypasses are accepted by the client.
              </p>
            </div>
          )}

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
