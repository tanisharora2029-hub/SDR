/**
 * NexusSDR Zero-Shot Tone Mirroring Service
 * Dynamically analyzes prospect communication style and generates adaptive
 * style mirroring instructions for the SDR conversational engine.
 */

export interface ToneProfile {
  formality: "casual" | "neutral" | "formal";
  lengthPreference: "terse" | "moderate" | "detailed";
  directness: "direct" | "exploratory";
  complexity: "simple" | "standard" | "technical";
  urgencyOrSentiment: "urgent" | "skeptical" | "positive" | "neutral";
  channel: "email" | "voice";
}

export interface ToneGuideline {
  profile: ToneProfile;
  promptDirective: string;
  voicePacingSuggestion: "fast_crisp" | "measured_consultative" | "standard";
}

export class ToneMirroringService {
  /**
   * Analyzes an inbound prospect utterance or email body and returns actionable style directives
   */
  static analyzeTone(utterance: string, channel: "email" | "voice" = "voice"): ToneGuideline {
    const text = utterance.trim();
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lower = text.toLowerCase();

    // 1. Formality Detection
    const casualTriggers = ["hey", "yeah", "yep", "sure", "cool", "nope", "gonna", "wanna", "dunno", "thx", "thanks!"];
    const formalTriggers = ["dear", "sincerely", "regarding", "furthermore", "pursuant", "compliance", "procurement", "kindly", "requesting"];
    
    let formality: "casual" | "neutral" | "formal" = "neutral";
    if (casualTriggers.some(t => lower.includes(t)) || /^(hey|hi|yo)\b/i.test(text)) {
      formality = "casual";
    } else if (formalTriggers.some(t => lower.includes(t)) || /^(to whom|dear sir|kind regards)/i.test(lower)) {
      formality = "formal";
    }

    // 2. Length & Directness Preference
    let lengthPreference: "terse" | "moderate" | "detailed" = "moderate";
    if (wordCount <= 7) {
      lengthPreference = "terse";
    } else if (wordCount > 35) {
      lengthPreference = "detailed";
    }

    const isDirect = /\b(just send|how much|price|pricing|cost|when can|send info|send me|send over|stop|yes|no)\b/i.test(text) || text.endsWith("?");
    const directness: "direct" | "exploratory" = isDirect ? "direct" : "exploratory";

    // 3. Technical vs Business Complexity
    const techTriggers = ["api", "webhook", "sso", "saml", "soc2", "sdk", "integration", "crm sync", "database", "latency", "rest"];
    const isTechnical = techTriggers.some(t => lower.includes(t));
    const complexity: "simple" | "standard" | "technical" = isTechnical ? "technical" : (formality === "casual" ? "simple" : "standard");

    // 4. Sentiment & Urgency
    let sentiment: "urgent" | "skeptical" | "positive" | "neutral" = "neutral";
    if (/(urgent|asap|today|immediately|critical)/i.test(lower)) {
      sentiment = "urgent";
    } else if (/(why would|doubt|competitor|already have|unhappy|pushy|spam)/i.test(lower)) {
      sentiment = "skeptical";
    } else if (/(great|awesome|love|sounds good|excited|interested)/i.test(lower)) {
      sentiment = "positive";
    }

    const profile: ToneProfile = {
      formality,
      lengthPreference,
      directness,
      complexity,
      urgencyOrSentiment: sentiment,
      channel
    };

    // 5. Synthesize Prompt Directives with Safety Guardrails
    const directives: string[] = [];

    if (formality === "casual") {
      directives.push(
        "TONE MIRRORING (CASUAL): The prospect communicates casually and informally. Respond naturally and collegially without stiff corporate pleasantries like 'Certainly, I would be delighted' or 'Greetings'. Use natural spoken phrasing like 'Sure, I will send that over' or 'Got it'. Strictly maintain professionalism; do not use slang, sarcasm, or emojis."
      );
    } else if (formality === "formal") {
      directives.push(
        "TONE MIRRORING (FORMAL): The prospect communicates formally. Maintain a polished, courteous, and structured professional tone."
      );
    }

    if (lengthPreference === "terse") {
      directives.push(
        "BREVITY MIRRORING: The prospect is brief and to the point. Keep your reply strictly under 15 words. Deliver the direct answer immediately without preamble."
      );
    } else if (lengthPreference === "detailed") {
      directives.push(
        "DEPTH MIRRORING: The prospect provided detailed context. Acknowledge their specific points before posing your single consultative follow-up."
      );
    }

    if (complexity === "technical") {
      directives.push(
        "TECHNICAL PRECISION: The prospect mentioned technical architecture. Ground your answer in exact, verified capabilities (e.g. native CRM APIs, SOC2 Type II) without marketing buzzwords."
      );
    }

    if (sentiment === "skeptical") {
      directives.push(
        "OBJECTION EMPATHY: The prospect expresses skepticism or mentions an existing provider. Validate their experience with zero defensiveness; ask a gentle exploratory question."
      );
    }

    // Safety Directive
    directives.push(
      "SAFETY RULE: Mirror communication style only. NEVER imitate accents, demographic traits, or personal identity. Never be sarcastic, dismissive, rude, or manipulative."
    );

    let pacing: "fast_crisp" | "measured_consultative" | "standard" = "standard";
    if (lengthPreference === "terse" || directness === "direct") {
      pacing = "fast_crisp";
    } else if (complexity === "technical" || sentiment === "skeptical") {
      pacing = "measured_consultative";
    }

    return {
      profile,
      promptDirective: directives.join("\n"),
      voicePacingSuggestion: pacing
    };
  }
}
