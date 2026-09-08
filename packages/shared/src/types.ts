export type UserRole = "OWNER" | "ADMIN" | "SDR_MANAGER" | "SALES_REP";

export type LeadStatus = 
  | "NEW"
  | "CONTACTED"
  | "IN_CONVERSATION"
  | "QUALIFIED"
  | "HANDOFF_REQUIRED"
  | "CONVERTED"
  | "UNQUALIFIED"
  | "OPTED_OUT";

export type Channel = "EMAIL" | "PHONE" | "WHATSAPP" | "SMS";
export type Direction = "INBOUND" | "OUTBOUND";
export type SenderRole = "HUMAN" | "AI" | "LEAD" | "SYSTEM";
export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type CallStatus = "INITIATED" | "RINGING" | "IN_PROGRESS" | "COMPLETED" | "BUSY" | "NO_ANSWER" | "FAILED";
export type FollowUpStatus = "SCHEDULED" | "EXECUTED" | "CANCELLED" | "SKIPPED";
export type PriorityLevel = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type QualificationFramework = "BANT" | "MEDDPICC" | "CUSTOM";

export type SubscriptionTier = "FREE" | "GROWTH" | "SCALE" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";

export interface OrganizationDto {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  valueProposition?: string | null;
  targetCustomerIcp?: string | null;
  knowledgeBase?: string | null;
  objectionRules?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  createdAt: Date;
}

export interface SdrProfileDto {
  id: string;
  organizationId: string;
  personaName: string;
  avatarUrl?: string | null;
  title: string;
  tone: string;
  qualificationFramework: QualificationFramework;
  customInstructions?: string | null;
  maxFollowUps: number;
  autoHandoffBudget: boolean;
  autoHandoffMeeting: boolean;
  isActive: boolean;
  email?: string | null;
  replyTo?: string | null;
  signature?: string | null;
}

export interface LeadDto {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  companyName: string;
  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;
  status: LeadStatus;
  source?: string | null;
  notes?: string | null;
  tags?: string | null;
  intentScore: number;
  isOptedOut: boolean;
  bantScorecard?: {
    budget?: string | boolean;
    authority?: string | boolean;
    need?: string | boolean;
    timeline?: string | boolean;
    notes?: string;
  } | null;
  customData?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDto {
  id: string;
  organizationId: string;
  leadId: string;
  channel: Channel;
  subject?: string | null;
  isAiActive: boolean;
  isEscalated: boolean;
  escalationReason?: string | null;
  escalatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lead?: LeadDto;
  messages?: MessageDto[];
}

export interface MessageDto {
  id: string;
  conversationId: string;
  organizationId: string;
  channel: Channel;
  direction: Direction;
  senderRole?: SenderRole;
  senderId?: string | null;
  recipientId?: string | null;
  content: string;
  senderName: string;
  status: MessageStatus;
  aiReasoning?: string | null;
  toolCallName?: string | null;
  toolCallArgs?: string | null;
  createdAt: Date;
}

export interface CallSessionDto {
  id: string;
  organizationId: string;
  leadId: string;
  callSid: string;
  direction: Direction;
  status: CallStatus;
  durationSeconds: number;
  recordingUrl?: string | null;
  transcript: Array<{
    speaker: "lead" | "sdr" | "system";
    text: string;
    timestamp: number;
  }>;
  aiSummary?: string | null;
  qualificationScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
  lead?: LeadDto;
}

export interface FollowUpRuleDto {
  id: string;
  organizationId: string;
  stepNumber: number;
  channel: Channel;
  delayDays: number;
  condition?: string | null;
  templatePrompt?: string | null;
  isActive: boolean;
}

export interface FollowUpTaskDto {
  id: string;
  organizationId: string;
  leadId: string;
  stepNumber: number;
  channel: Channel;
  scheduledFor: Date;
  status: FollowUpStatus;
  executedAt?: Date | null;
  lead?: LeadDto;
}

export interface AppointmentDto {
  id: string;
  organizationId: string;
  leadId: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  attendeeEmail: string;
  notes?: string | null;
  status: "CONFIRMED" | "RESCHEDULED" | "CANCELLED";
  lead?: LeadDto;
}

export interface AnalyticsSummaryDto {
  totalLeads: number;
  contactedCount: number;
  inConversationCount: number;
  qualifiedCount: number;
  appointmentsBooked: number;
  humanHandoffsCount: number;
  responseRatePct: number;
  qualificationRatePct: number;
  emailsSent: number;
  callsPlaced: number;
  activeFollowups: number;
  channelBreakdown: {
    email: number;
    phone: number;
    whatsapp: number;
  };
}

export type SdrToolName = 
  | "send_email"
  | "read_email"
  | "check_calendar_availability"
  | "create_calendar_event"
  | "create_followup"
  | "update_lead"
  | "qualify_lead"
  | "schedule_call"
  | "log_call"
  | "human_handoff";

export interface SdrToolDecision {
  tool: SdrToolName;
  arguments: Record<string, any>;
  thought?: string;
}

export interface ToolExecutionResult {
  tool: SdrToolName;
  success: boolean;
  data?: any;
  error?: string;
}

export type { AiAction } from "./schemas.js";

