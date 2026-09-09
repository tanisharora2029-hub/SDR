import { logger } from "../../lib/logger.js";

export type TaskPriority = "ASYNC_CHEAP" | "LIVE_HIGH_PRIORITY_VOICE";

export type TaskType =
  | "LEAD_SCORING"
  | "EMAIL_DRAFTING"
  | "SUMMARIZATION"
  | "CRM_CLASSIFICATION"
  | "SENTIMENT_CLASSIFICATION"
  | "LEAD_ENRICHMENT"
  | "FOLLOWUP_SUGGESTION"
  | "STRUCTURED_EXTRACTION"
  | "INTERNAL_ANALYSIS"
  | "LIVE_VOICE_TURN"
  | "LIVE_OBJECTION_HANDLING";

export interface RoutingDecision {
  taskType: TaskType;
  priority: TaskPriority;
  selectedProvider: "ollama-local" | "gemini-online" | "groq-online";
  modelName: string;
  reason: string;
}

export class CostRouter {
  /**
   * Evaluates task priority and routes execution to minimize operational expense
   * while guaranteeing sub-second latency for live voice calls.
   */
  static routeTask(taskType: TaskType): RoutingDecision {
    const isVoiceTask = taskType === "LIVE_VOICE_TURN" || taskType === "LIVE_OBJECTION_HANDLING";

    // Mode can be overridden via environment variable
    const routingMode = process.env.AI_COST_ROUTING_MODE || "intelligent"; // "intelligent" | "always-local" | "always-online"

    // Production cloud deployment prioritizes Groq online when configured
    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const isProduction = process.env.NODE_ENV === "production";
    const explicitProvider = process.env.AI_PROVIDER;

    if (explicitProvider === "mock") {
      return {
        taskType,
        priority: "ASYNC_CHEAP",
        selectedProvider: "ollama-local",
        modelName: "mock",
        reason: "Explicit mock provider for sandbox/testing."
      };
    }

    if (hasGroq && explicitProvider !== "mock") {
      return {
        taskType,
        priority: isVoiceTask ? "LIVE_HIGH_PRIORITY_VOICE" : "ASYNC_CHEAP",
        selectedProvider: "groq-online",
        modelName: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        reason: "Routed via Groq online provider for production cloud reliability."
      };
    }

    if (routingMode === "always-local" && !isVoiceTask) {
      return {
        taskType,
        priority: "ASYNC_CHEAP",
        selectedProvider: "ollama-local",
        modelName: process.env.OLLAMA_MODEL || "qwen2.5:3b",
        reason: "Forced local mode for offline cost minimization."
      };
    }

    if (routingMode === "always-online" || isVoiceTask) {
      return {
        taskType,
        priority: "LIVE_HIGH_PRIORITY_VOICE",
        selectedProvider: "gemini-online",
        modelName: "gemini-3.1-flash-lite",
        reason: isVoiceTask
          ? "Live telephony requires sub-second online streaming (zero local GPU overhead)."
          : "Explicit online override."
      };
    }

    // Default intelligent tiering:
    // Async, background, and offline batch operations route to zero-cost local Ollama
    const asyncTasks: TaskType[] = [
      "LEAD_SCORING",
      "EMAIL_DRAFTING",
      "SUMMARIZATION",
      "CRM_CLASSIFICATION",
      "SENTIMENT_CLASSIFICATION",
      "LEAD_ENRICHMENT",
      "FOLLOWUP_SUGGESTION",
      "STRUCTURED_EXTRACTION",
      "INTERNAL_ANALYSIS"
    ];

    if (asyncTasks.includes(taskType)) {
      // If local Ollama is available, use it for zero-cost execution
      return {
        taskType,
        priority: "ASYNC_CHEAP",
        selectedProvider: "ollama-local",
        modelName: process.env.OLLAMA_MODEL || "qwen2.5:3b",
        reason: "Async task routed to local Qwen 2.5 3B for zero-cost offline processing."
      };
    }

    // Default fallback
    return {
      taskType,
      priority: "LIVE_HIGH_PRIORITY_VOICE",
      selectedProvider: "gemini-online",
      modelName: "gemini-3.1-flash-lite",
      reason: "Live conversational dialogue routed to high-performance online engine."
    };
  }
}
