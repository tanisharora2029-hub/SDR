import { Router } from "express";
import { BillingService } from "../services/billingService.js";
import { authMiddleware } from "../middleware/auth.js";

export const billingRouter = Router();
billingRouter.use(authMiddleware);

billingRouter.get("/", async (req, res, next) => {
  try {
    const billing = await BillingService.getSubscription(req.organizationId!);
    res.json({ success: true, ...billing });
  } catch (err) {
    next(err);
  }
});

billingRouter.post("/checkout", async (req, res, next) => {
  try {
    const { targetTier } = req.body;
    const session = await BillingService.createCheckoutSession(req.organizationId!, targetTier);
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

billingRouter.post("/verify-payment", async (req, res, next) => {
  try {
    const { tier, paymentId } = req.body;
    const updated = await BillingService.handlePaymentSuccess(
      req.organizationId!,
      tier,
      paymentId || `pay_mock_${Date.now()}`
    );
    res.json({ success: true, subscription: updated });
  } catch (err) {
    next(err);
  }
});