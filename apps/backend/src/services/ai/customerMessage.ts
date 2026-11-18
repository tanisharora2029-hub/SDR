// Reject damaged action envelopes instead of delivering internal model output.
export function assertCustomerMessage(text: string): void {
  if (!text.trim() ||
      /"(?:intent|action|reply|reason|tool_arguments|lead_id)"\s*:/.test(text) ||
      /\[(?:your name|phone|email|company name|insert[^\]]*)\]/i.test(text)) {
    throw new Error("Generated message requires review before sending. Please regenerate the draft.");
  }
}

export function readCustomerReply(raw: string): string {
  const text = raw.trim().replace(/^\`\`\`[a-z]*\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
  if (text.startsWith("{")) {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI returned an incomplete message. Please regenerate the draft.");
    }
    const reply = parsed.reply ?? parsed.tool_arguments?.body ?? parsed.arguments?.body ?? parsed.body;
    if (typeof reply !== "string") throw new Error("AI returned no customer message.");
    return readCustomerReply(reply);
  }
  assertCustomerMessage(text);
  return text;
}
