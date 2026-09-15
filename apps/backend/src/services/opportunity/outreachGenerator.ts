import { OpportunityEvidenceItem, MachineMindSolutionMapping, DecisionMakerContact } from "./types.js";

export class OutreachGenerator {
  /**
   * Generates a personalized, problem-first outbound sales email adhering to:
   * OBSERVATION → POTENTIAL PROBLEM → EVIDENCE → SOLUTION → CTA
   */
  public static generateProblemFirstOutreach(params: {
    companyName: string;
    decisionMaker?: DecisionMakerContact;
    potentialProblem: string;
    evidenceList: OpportunityEvidenceItem[];
    solution: MachineMindSolutionMapping;
    senderName?: string;
    senderTitle?: string;
  }): { subject: string; body: string } {
    const {
      companyName,
      decisionMaker,
      potentialProblem,
      evidenceList,
      solution,
      senderName = "Alex Rivers",
      senderTitle = "AI Sales Development Representative | MachineMind"
    } = params;

    const recipientName = decisionMaker?.name ? decisionMaker.name.split(" ")[0] : "there";

    // Formulate problem-first subject line
    let subjectTopic = "operational workflow";
    const lowerProblem = potentialProblem.toLowerCase();
    if (lowerProblem.includes("invoice") || lowerProblem.includes("payable")) {
      subjectTopic = "invoice processing workflow";
    } else if (lowerProblem.includes("support") || lowerProblem.includes("inquiry")) {
      subjectTopic = "support handling workflow";
    } else if (lowerProblem.includes("document") || lowerProblem.includes("intake")) {
      subjectTopic = "document intake workflow";
    } else if (lowerProblem.includes("back-office") || lowerProblem.includes("data entry")) {
      subjectTopic = "back-office transaction workflow";
    }

    const subject = `Question about your ${subjectTopic} at ${companyName}`;

    // Extract primary observable signals
    const firstEvidence = evidenceList[0]?.observedFact || "your public workflow documentation";
    const secondEvidence = evidenceList[1]?.observedFact || "recent operational postings";

    // Construct step-by-step workflow preview string
    const workflowPreview = solution.workflowSteps
      .slice(0, 4)
      .map((step, idx) => `  ${idx + 1}. ${step}`)
      .join("\n");

    const body = `Hi ${recipientName},

I was researching ${companyName} and noticed that ${this.softenFact(firstEvidence)}.

I also came across ${this.softenFact(secondEvidence)}.

That made me wonder whether ${this.softenProblem(potentialProblem)} may be creating repetitive manual overhead for your operational team.

If that's something you are navigating, MachineMind provides ${solution.displayTitle} to automate this exact process while keeping your team in complete control.

A streamlined workflow for ${companyName} could look like:
${workflowPreview}
  5. Human escalation on any exception

Would it be useful if I shared a brief 5-minute walkthrough of what this automation could look like for ${companyName}?

Best regards,

${senderName}
${senderTitle}`;

    return { subject, body };
  }

  private static softenFact(fact: string): string {
    return fact.replace(/\.$/, "").replace(/^Official /i, "");
  }

  private static softenProblem(problem: string): string {
    let lower = problem.trim().toLowerCase().replace(/\.$/, "");
    lower = lower.replace(/^manual /i, "manual ");
    lower = lower.replace(/^repetitive /i, "repetitive ");
    return lower;
  }
}
