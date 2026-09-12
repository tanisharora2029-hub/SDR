import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { CreditCard, CheckCircle2, Sparkles, Zap, ShieldCheck } from "lucide-react";

export const BillingPage: React.FC = () => {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const loadBilling = async () => {
    try {
      const res = await api.getBilling();
      setBilling(res);
    } catch (err) {
      console.error("Failed to load billing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleUpgrade = async (tier: string) => {
    setUpgrading(true);
    try {
      const checkout = await api.createCheckout(tier);
      await api.verifyPayment(tier, checkout.session.orderId);
      alert(`[TEST MODE] Subscription tier upgraded to ${tier} (Sandbox verification). No live card was billed.`);
      setCheckoutTier(null);
      await loadBilling();
    } catch (err: any) {
      alert(err.message || "Checkout failed");
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading subscription details...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-violet-400 shrink-0" />
            <span>Billing & Subscription Plans</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your SaaS subscription, monitor monthly AI credit limits, and scale your sales team.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {billing?.gatewayStatus?.label || "TEST_MODE (Sandbox)"}
          </span>
        </div>
      </div>

      {/* Current Usage Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-400 font-medium">Current Active Tier:</span>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{billing?.currentPlan?.name} Plan</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                Active
              </span>
            </h2>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Monthly AI Credits Used:</span>
            <p className="text-lg font-bold text-violet-300">
              {billing?.creditsUsed} / {billing?.creditLimit} credits
            </p>
          </div>
        </div>

        {/* Usage progress bar */}
        <div>
          <div className="w-full bg-[#090914] rounded-full h-2.5 border border-white/[0.06] overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2.5 rounded-full transition-all shadow-[0_0_10px_rgba(124,58,237,0.5)]"
              style={{ width: `${billing?.percentUsed || 5}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
            <span>{billing?.percentUsed || 0}% consumed this period</span>
            <span>Resets next billing cycle</span>
          </div>
        </div>
      </div>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {billing?.availablePlans?.map((plan: any) => {
          const isCurrent = plan.tier === billing?.subscription?.tier;
          return (
            <div
              key={plan.tier}
              className={`p-6 rounded-2xl backdrop-blur-xl border flex flex-col justify-between ${
                isCurrent
                  ? "bg-[#121228]/90 border-violet-500/50 shadow-2xl shadow-violet-950/40"
                  : "bg-[#0e0e1a]/60 border-white/[0.08]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-extrabold text-white">${plan.priceMonthlyUsd}</span>
                  <span className="text-xs text-slate-400">/ mo</span>
                </div>
                <p className="text-[11px] text-slate-500">₹{plan.priceMonthlyInr} / mo (India gateway)</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl bg-white/[0.05] text-slate-400 text-xs font-semibold cursor-default border border-white/[0.06]"
                  >
                    Current Active Tier
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-violet-600/30 border border-violet-400/30"
                  >
                    {upgrading ? "Processing..." : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};