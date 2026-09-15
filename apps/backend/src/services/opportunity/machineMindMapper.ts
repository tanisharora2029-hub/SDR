import { MachineMindSolutionMapping } from "./types.js";

export interface ProblemSignalMatch {
  keywords: string[];
  problem: string;
  primaryProduct: string;
  supportingProducts?: string[];
  whyItFits: string;
  workflowSteps: string[];
  potentialBusinessImpact: string;
}

export class MachineMindMapper {
  private static readonly SOLUTION_CATALOG: ProblemSignalMatch[] = [
    {
      keywords: ["invoice", "invoices", "payable", "billing", "settlement"],
      problem: "Manual invoice ingestion and accounts payable reconciliation create operational backlogs.",
      primaryProduct: "M-EXTRACT",
      supportingProducts: ["M-FLOW"],
      whyItFits: "M-EXTRACT autonomously extracts line items, tax IDs, and totals from unstructured PDF invoices, while M-FLOW posts entries directly into accounting software without manual data entry.",
      workflowSteps: [
        "Inbound invoice received via email or vendor portal",
        "M-EXTRACT parses document, extracts vendor, PO number, and line-item details with confidence scores",
        "Performs 3-way match against purchase order and receiving slips in ERP",
        "M-FLOW enters validated transaction into accounting system",
        "Flags discrepancies or unverified charges to human accounts payable team for one-click approval"
      ],
      potentialBusinessImpact: "Eliminates up to 85% of manual invoice entry time, speeds up payment cycles, and reduces duplicate invoice risk."
    },
    {
      keywords: ["document", "documents", "intake", "pdf", "claims", "forms", "kyc"],
      problem: "Heavy manual document classification, verification, and data extraction slow down core business operations.",
      primaryProduct: "M-EXTRACT",
      supportingProducts: ["M-AGENTS"],
      whyItFits: "M-EXTRACT processes high volumes of complex forms, KYC documents, contracts, and claims with enterprise-grade extraction accuracy.",
      workflowSteps: [
        "Customer or partner uploads document bundle",
        "M-EXTRACT identifies document types, checks completeness, and extracts required field entities",
        "Validates extracted data against organizational compliance rules",
        "Exports structured JSON payload directly to core CRM or operational database",
        "Routes incomplete or illegible documents to human reviewer with highlighted missing fields"
      ],
      potentialBusinessImpact: "Reduces document turnaround time from days to minutes while preventing clerical processing errors."
    },
    {
      keywords: ["support", "ticket", "tickets", "inquiry", "inquiries", "customer", "copilot"],
      problem: "High volume of customer inquiries and support tickets leads to delayed response times and agent burnout.",
      primaryProduct: "M-COPILOT",
      supportingProducts: ["M-FLOW"],
      whyItFits: "M-COPILOT provides intelligent inquiry triaging, context retrieval from company knowledge bases, and draft responses for immediate human review.",
      workflowSteps: [
        "Customer submits inquiry or support ticket across email or web portal",
        "M-COPILOT analyzes intent, sentiment, and urgency level",
        "Retrieves verified answers from company SOPs and technical documentation",
        "Drafts customized, empathetic response ready for 1-click agent dispatch",
        "Escalates complex, high-stakes, or negative-sentiment tickets immediately to senior human specialists"
      ],
      potentialBusinessImpact: "Cuts initial response times by up to 70% and enables support teams to handle growing customer scale without linear hiring."
    },
    {
      keywords: ["back-office", "data entry", "browser", "rpa", "reconciliation", "clerical"],
      problem: "Repetitive back-office data entry across disparate web portals and legacy applications creates operational bottlenecks.",
      primaryProduct: "M-FLOW",
      supportingProducts: ["M-AGENTS"],
      whyItFits: "M-FLOW automates routine browser workflows, data transfers between unconnected systems, and repetitive status verification.",
      workflowSteps: [
        "Operational task triggered from CRM or spreadsheet status update",
        "M-FLOW navigates target third-party portal or legacy system securely",
        "Fills required fields, uploads attachments, and executes form submission",
        "Captures confirmation reference code and logs completion timestamp",
        "Alerts operations supervisor if external portal UI changes or session exceptions arise"
      ],
      potentialBusinessImpact: "Reclaims hundreds of operational hours per month and prevents copy-paste errors across disconnected tools."
    },
    {
      keywords: ["disconnected", "siloed", "silo", "spreadsheet", "spreadsheets", "integration", "legacy software"],
      problem: "Siloed software platforms require manual CSV exports and spreadsheet consolidation to maintain reporting.",
      primaryProduct: "System Integration",
      supportingProducts: ["M-FLOW"],
      whyItFits: "Provides automated data synchronization between disparate enterprise applications, eliminating manual spreadsheet glue.",
      workflowSteps: [
        "New transaction or record modified in upstream source tool",
        "Integration engine transforms and normalizes payload to match downstream schema",
        "Syncs updated data across target systems in near real-time",
        "Maintains audit log of every synced transaction",
        "Flags schema mismatches to technical administrator"
      ],
      potentialBusinessImpact: "Eliminates fragmented records, ensures unified reporting, and removes manual data reconciliation overhead."
    },
    {
      keywords: ["compliance", "regulatory", "audit", "sop", "checklist"],
      problem: "Stringent regulatory and SOP checklists require repetitive manual verification and audit tracking.",
      primaryProduct: "Compliance",
      supportingProducts: ["M-AGENTS"],
      whyItFits: "Enforces continuous automated compliance checking across workflows with immutable audit logging.",
      workflowSteps: [
        "Operational process initiated by staff or customer",
        "Automated compliance monitor evaluates prerequisite checklist items and policy rules",
        "Attaches cryptographic verification stamp to compliant records",
        "Blocks non-compliant actions and prompts required remediation steps",
        "Generates periodic compliance audit reports automatically"
      ],
      potentialBusinessImpact: "Drastically reduces compliance audit preparation overhead and mitigates regulatory risk."
    },
    {
      keywords: ["multi-step", "multi-stage", "autonomous", "agents", "procurement"],
      problem: "Complex multi-stage workflows involving multiple departments suffer from communication lags and dropped tasks.",
      primaryProduct: "M-AGENTS",
      supportingProducts: ["M-FLOW", "M-EXTRACT"],
      whyItFits: "M-AGENTS orchestrates autonomous multi-step operations, coordinating tasks between departments with strict human escalation safeguards.",
      workflowSteps: [
        "Multi-stage project or order initialized",
        "M-AGENTS coordinates task progression, tracking completion across departments",
        "Triggers automated reminders and verification milestones",
        "Aggregates deliverables into central case file",
        "Requests explicit human sign-off before milestone closure"
      ],
      potentialBusinessImpact: "Accelerates project cycle times, increases visibility across operational silos, and ensures zero dropped handoffs."
    }
  ];

  /**
   * Maps an operational problem or observed signals to a verified MachineMind solution.
   */
  public static mapSignalsToSolution(
    potentialProblem: string,
    observedSignals: string[] = []
  ): MachineMindSolutionMapping {
    const combinedText = `${potentialProblem} ${observedSignals.join(" ")}`.toLowerCase();

    // Find best match in catalog with exact word boundary matching
    let bestMatch: ProblemSignalMatch | null = null;
    for (const item of this.SOLUTION_CATALOG) {
      if (item.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(combinedText))) {
        bestMatch = item;
        break;
      }
    }

    // Default fallback to M-FLOW + M-COPILOT if generic operational workload
    if (!bestMatch) {
      bestMatch = {
        keywords: ["general"],
        problem: "Repetitive operational tasks and manual information routing create workflow bottlenecks.",
        primaryProduct: "M-FLOW",
        supportingProducts: ["M-COPILOT"],
        whyItFits: "MachineMind M-FLOW and M-COPILOT automate repetitive digital workflows and inquiry handling while maintaining human oversight.",
        workflowSteps: [
          "Operational request or task ingested",
          "Automated classifier extracts key parameters and evaluates routing rules",
          "M-FLOW executes standardized workflow steps across target systems",
          "Prepares exception summary for human approval when non-standard criteria arise",
          "Logs completion details in central audit trail"
        ],
        potentialBusinessImpact: "Reduces repetitive manual operational overhead and accelerates turnaround speed."
      };
    }

    const allProducts = [bestMatch.primaryProduct, ...(bestMatch.supportingProducts || [])];
    const displayTitle = allProducts.join(" + ");

    return {
      productCodes: allProducts,
      displayTitle,
      whyItFits: bestMatch.whyItFits,
      workflowSteps: bestMatch.workflowSteps,
      potentialBusinessImpact: bestMatch.potentialBusinessImpact
    };
  }
}
