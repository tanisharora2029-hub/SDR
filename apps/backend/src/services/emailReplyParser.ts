import { logger } from "../lib/logger.js";

/**
 * EmailReplyParser
 * Isolates the newly authored reply from inbound emails by stripping:
 * 1. Historical quote headers (e.g., "On <date/author> wrote:", "-----Original Message-----")
 * 2. RFC 3676 / Markdown quote lines prefixed with ">"
 * 3. HTML quote containers (e.g., <div class="gmail_quote">, <blockquote...>)
 * 4. Automated compliance and unsubscribe footers (e.g., "reply STOP to unsubscribe")
 */
export class EmailReplyParser {
  /**
   * Legitimate opt-out keywords evaluated ONLY against newly authored prospect text
   */
  private static readonly OPT_OUT_REGEX =
    /\b(stop|unsubscribe|remove me|opt out|cancel|do not contact|don't contact)\b/i;

  /**
   * Quote header delimiters indicating the start of an older message block
   */
  private static readonly QUOTE_HEADER_PATTERNS: RegExp[] = [
    // Gmail / Apple Mail / Standard: "On <date/time/author> wrote:" (supports multi-line within 250 chars)
    /(?:^|\r?\n)[ \t]*On\s+(?:(?!\r?\n\r?\n)[\s\S]){1,250}?(?:wrote|written):[ \t]*(?:\r?\n|$)/i,
    // Outlook: "-----Original Message-----"
    /(?:^|\r?\n)[ \t]*-{3,}[ \t]*Original Message[ \t]*-{3,}[ \t]*(?:\r?\n|$)/i,
    // Outlook / MIME headers block: "From: ... \n Sent: ... \n To: ..."
    /(?:^|\r?\n)[ \t]*From:[ \t]+[^\r\n]+\r?\n[ \t]*Sent:[ \t]+[^\r\n]+\r?\n[ \t]*To:[ \t]+/i,
    // Horizontal rule divider (5+ underscores or dashes alone on a line)
    /(?:^|\r?\n)[ \t]*_{5,}[ \t]*(?:\r?\n|$)/,
    // Apple Mail / Thunderbird: "Begin forwarded message:"
    /(?:^|\r?\n)[ \t]*Begin forwarded message:[ \t]*(?:\r?\n|$)/i,
    // Multilingual headers: "Le ... a écrit :" or "Am ... schrieb :" or "El ... escribió:" or "Op ... schreef:"
    /(?:^|\r?\n)[ \t]*(?:Le|Am|El|Op)\s+(?:(?!\r?\n\r?\n)[\s\S]){1,200}?(?:a écrit|schrieb|escribió|schreef):[ \t]*(?:\r?\n|$)/i
  ];

  /**
   * Compliance footers appended to outbound emails
   */
  private static readonly COMPLIANCE_FOOTER_PATTERNS: RegExp[] = [
    // Multi-line footer block preceded by dashes or underscores
    /(?:^|\r?\n)[ \t]*(?:---+|___+|\*\*\*+)\s*\r?\n[\s\S]*?(?:unsubscribe|opt[ -]?out|reply STOP)[\s\S]*$/i,
    // Single-line compliance notices
    /(?:^|\r?\n)[ \t]*(?:To unsubscribe from these communications[^\r\n]*|If you prefer not to receive future emails[^\r\n]*|Reply\s+['"]?STOP['"]?\s+to\s+(?:unsubscribe|opt[ -]?out)[^\r\n]*)/gi
  ];

  /**
   * HTML elements that mark quoted historical email bodies
   */
  private static readonly HTML_QUOTE_DELIMITERS: RegExp[] = [
    /<div[^>]*class=["'][^"']*(?:gmail_quote|gmail_extra|yahoo_quoted)[^"']*["']/i,
    /<blockquote[^>]*class=["'][^"']*gmail_quote[^"']*["']/i,
    /<blockquote/i,
    /<div[^>]*id=["'](?:appendonsend|mail-editor-reference-message-container)["']/i,
    /<div[^>]*class=["']WordSection1["']/i,
    /<hr style=["'][^"']*border-top:[^"']*#e5e7eb[^"']*["']/i
  ];

  /**
   * Extract only the newly authored text written by the prospect
   */
  static extractNewlyAuthoredReply(rawText: string, rawHtml?: string): string {
    if (!rawText && !rawHtml) return "";

    // 1. If HTML is available, attempt to isolate the newly authored section from HTML
    if (rawHtml) {
      let htmlToProcess = rawHtml;
      for (const delimiter of this.HTML_QUOTE_DELIMITERS) {
        const match = htmlToProcess.match(delimiter);
        if (match && match.index !== undefined && match.index > 0) {
          htmlToProcess = htmlToProcess.substring(0, match.index);
        }
      }

      // Convert HTML fragment to clean text
      const htmlText = htmlToProcess
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]*>?/gm, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"')
        .trim();

      if (htmlText.length > 0) {
        const cleaned = this.cleanPlainText(htmlText);
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }

    // 2. Clean plain text email body
    return this.cleanPlainText(rawText || "");
  }

  /**
   * Clean plain text by removing quote headers, quoted lines (>), and footers
   */
  static cleanPlainText(text: string): string {
    if (!text || typeof text !== "string") return "";

    let content = text.trim();

    // A. Check for quote header delimiters (e.g., "On ... wrote:")
    for (const pattern of this.QUOTE_HEADER_PATTERNS) {
      const match = content.match(pattern);
      if (match && match.index !== undefined) {
        if (match.index > 0) {
          // Top-posting (standard): prospect text is above the quote header
          content = content.substring(0, match.index).trim();
        } else {
          // Bottom-posting: email starts with quote header, prospect text is below
          content = content.substring(match[0].length).trim();
        }
      }
    }

    // B. Strip compliance footer patterns
    for (const footerPattern of this.COMPLIANCE_FOOTER_PATTERNS) {
      content = content.replace(footerPattern, "").trim();
    }

    // C. Remove lines starting with '>' (standard quote lines)
    const lines = content.split(/\r?\n/);
    const nonQuotedLines = lines.filter(line => !/^\s*>/.test(line));
    content = nonQuotedLines.join("\n").trim();

    return content;
  }

  /**
   * Determine if the prospect's newly authored message expresses an opt-out intent
   */
  static isOptOutIntent(rawText: string, rawHtml?: string): boolean {
    const newlyAuthored = this.extractNewlyAuthoredReply(rawText, rawHtml);
    if (!newlyAuthored || newlyAuthored.trim().length === 0) {
      return false;
    }

    const matched = this.OPT_OUT_REGEX.test(newlyAuthored);
    if (matched) {
      logger.info(`[EmailReplyParser] Legitimate opt-out detected in newly authored text: "${newlyAuthored.substring(0, 60)}"`);
    }
    return matched;
  }
}
