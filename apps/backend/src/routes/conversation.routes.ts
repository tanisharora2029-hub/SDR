import { Router } from "express";
import { ConversationService } from "../services/conversationService.js";
import { authMiddleware } from "../middleware/auth.js";

export const conversationRouter = Router();
conversationRouter.use(authMiddleware);

conversationRouter.get("/", async (req, res, next) => {
  try {
    const conversations = await ConversationService.getConversations(req.organizationId!);
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

conversationRouter.get("/:id", async (req, res, next) => {
  try {
    const conversation = await ConversationService.getConversationWithMessages(
      req.organizationId!,
      req.params.id
    );
    if (!conversation) return res.status(404).json({ success: false, error: "Conversation not found" });
    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
});

// Simulate lead inbound reply
conversationRouter.post("/simulate-reply", async (req, res, next) => {
  try {
    const { leadId, channel, content } = req.body;
    if (!leadId || !content) {
      return res.status(400).json({ success: false, error: "leadId and content are required" });
    }
    const result = await ConversationService.ingestLeadReply(
      req.organizationId!,
      leadId,
      channel || "EMAIL",
      content
    );
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

// Human rep override message
conversationRouter.post("/:id/human-message", async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: "content is required" });
    const message = await ConversationService.sendHumanMessage(
      req.organizationId!,
      req.params.id,
      content
    );
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
});