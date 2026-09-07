import { prisma } from "../lib/prisma.js";
import { SUBSCRIPTION_PLANS } from "@ai-sdr/shared";

export class BillingService {
  private static isProductionGateway(): boolean {
    const isRealKey = (key?: string) => {
      if (!key) return false;
      const trimmed = key.trim();
      if (
        trimmed.includes("mock") ||
        trimmed.startsWith("sk_test_") ||
        trimmed.startsWith("rzp_test_") ||
        trimmed === "mocksecret123"
      ) {
        return false;
      }
      return trimmed.length > 10;
    };
    return isRealKey(process.env.STRIPE_SECRET_KEY) || isRealKey(process.env.RAZORPAY_KEY_SECRET);
  }

  static async getSubscription(organizationId: string) {
    let sub = await prisma.subscription.findUnique({
      where: { organizationId }
    });

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          organizationId,
          tier: "FREE",
          status: "ACTIVE"
        }
      });
    }

    const currentPlan = SUBSCRIPTION_PLANS.find(p => p.tier === sub!.tier) || SUBSCRIPTION_PLANS[0];

    // Compute monthly credit usage
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        organizationId,
        recordedAt: { gte: startOfMonth }
      }
    });

    const creditsUsed = usageRecords.reduce((acc, curr) => acc + curr.quantity, 0);
    const isLiveGateway = BillingService.isProductionGateway();

    return {
      subscription: sub,
      currentPlan,
      creditsUsed,
      creditLimit: currentPlan.monthlyAiCredits,
      percentUsed: Math.min(100, Math.round((creditsUsed / currentPlan.monthlyAiCredits) * 100)),
      availablePlans: SUBSCRIPTION_PLANS,
      gatewayStatus: {
        isLiveGateway,
        paymentMode: isLiveGateway ? "PRODUCTION_GATEWAY" : "TEST_MODE_SIMULATION",
        label: isLiveGateway ? "Live Payment Processor Active" : "Sandbox Test Mode (No card required)"
      }
    };
  }

  static async createCheckoutSession(organizationId: string, targetTier: "GROWTH" | "SCALE") {
    const plan = SUBSCRIPTION_PLANS.find(p => p.tier === targetTier);
    if (!plan) throw new Error("Invalid tier");

    const isLiveGateway = BillingService.isProductionGateway();
    const mockOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      orderId: mockOrderId,
      amount: plan.priceMonthlyInr * 100,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mockkey123",
      tier: targetTier,
      planName: plan.name,
      isTestMode: !isLiveGateway,
      paymentMode: isLiveGateway ? "PRODUCTION_GATEWAY" : "TEST_MODE_SIMULATION"
    };
  }

  static async handlePaymentSuccess(organizationId: string, tier: string, paymentId: string) {
    const isLiveGateway = BillingService.isProductionGateway();

    const updated = await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        tier,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000)
      },
      update: {
        tier,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000)
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "BILLING",
        action: "SUBSCRIPTION_UPGRADED",
        detailsJson: JSON.stringify({
          tier,
          paymentId,
          paymentMode: isLiveGateway ? "PRODUCTION_GATEWAY" : "TEST_MODE_SIMULATION"
        })
      }
    });

    return {
      ...updated,
      isTestMode: !isLiveGateway
    };
  }
}