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
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-400 shrink-0" />
            <span>Billing & Subscription Plans</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your SaaS subscription, monitor monthly AI credit limits, and scale your sales team.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {billing?.gatewayStatus?.label || "TEST_MODE (Sandbox)"}
          </span>
        </div>
      </div>

      {/* Current Usage Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-400 font-medium">Current Active Tier:</span>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <span>{billing?.currentPlan?.name} Plan</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Active
              </span>
            </h2>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Monthly AI Credits Used:</span>
            <p className="text-lg font-bold text-indigo-400">
              {billing?.creditsUsed} / {billing?.creditLimit} credits
            </p>
          </div>
        </div>

        {/* Usage progress bar */}
        <div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all"
              style={{ width: `${billing?.percentUsed || 5}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
            <span>{billing?.percentUsed || 0}% consumed this period</span>
            <span>Resets next month</span>
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
              className={`p-6 rounded-2xl border flex flex-col justify-between ${
                isCurrent
                  ? "bg-slate-900 border-emerald-500/50 shadow-xl shadow-emerald-500/5"
                  : "bg-slate-900/40 border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-100">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-extrabold text-slate-100">${plan.priceMonthlyUsd}</span>
                  <span className="text-xs text-slate-400">/ mo</span>
                </div>
                <p className="text-[11px] text-slate-500">₹{plan.priceMonthlyInr} / mo (India gateway)</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold cursor-default"
                  >
                    Current Active Tier
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier)}
                    disabled={upgrading}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
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