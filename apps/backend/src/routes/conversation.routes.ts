import { Router } from "express";
import { ConversationService } from "../services/conversationService.js";
import { ChannelManager } from "../services/channels/channelManager.js";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

export const conversationRouter = Router();
conversationRouter.use(authMiddleware);

// Channel readiness & provider statuses
conversationRouter.get("/channels/status", async (req, res, next) => {
  try {
    const channels = ChannelManager.getChannelStatuses();
    res.json({ success: true, channels });
  } catch (err) {
    next(err);
  }
});

// Simulator leads and threads view
conversationRouter.get("/simulator/leads", async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { updatedAt: "desc" },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });
    res.json({ success: true, leads });
  } catch (err) {
    next(err);
  }
});

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

// Simulate external lead inbound reply
conversationRouter.post("/simulate-reply", async (req, res, next) => {
  try {
    const { leadId, channel, content, forceLiveEmail } = req.body;
    if (!leadId || !content) {
      return res.status(400).json({ success: false, error: "leadId and content are required" });
    }
    const result = await ConversationService.ingestLeadReply(
      req.organizationId!,
      leadId,
      channel || "EMAIL",
      content,
      {
        isSimulator: true,
        forceLiveEmail: Boolean(forceLiveEmail)
      }
    );
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

// Human rep takeover message
conversationRouter.post("/:id/human-message", async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: "content is required" });

    let userName = "Human Sales Rep";
    if (req.user?.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (user?.name) userName = user.name;
    }

    const message = await ConversationService.sendHumanMessage(
      req.organizationId!,
      req.params.id,
      content,
      {
        userId: req.user?.userId,
        name: userName
      }
    );
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

// Resume autonomous AI SDR handling
conversationRouter.post("/:id/resume-ai", async (req, res, next) => {
  try {
    const conversation = await ConversationService.resumeAiHandling(
      req.organizationId!,
      req.params.id
    );
    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
});
