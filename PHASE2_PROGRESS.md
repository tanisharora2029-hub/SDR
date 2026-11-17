# NexSDR Phase 2 progress

Updated 17 November 2026. The audit, initial fixes and workspace configuration are in the working tree. The full product transformation remains in progress.

## Current architecture and audit findings

| Area | Observed implementation and gaps |
| --- | --- |
| Frontend | React and Vite with React Router, Tailwind, a shared request client and a JWT-backed auth context. Existing routes cover registration, Settings, Lead Finder, CRM, Conversations, Phone Studio, follow-ups, handoff, dashboard and analytics. |
| Backend | Express, Prisma 5, Zod, API rate limits and WebSocket broadcasts. `GET /api/health` reports process status without checking the database or providers. |
| Database | Existing models cover Organization, User, SdrProfile, Lead, Conversation, Message, CallSession, FollowUpRule, FollowUpTask, Appointment, ActivityLog, Subscription, UsageRecord, Opportunity, OpportunityEvidence and ResearchRun. Local Prisma uses SQLite. Build-time Prisma preparation selects PostgreSQL for a PostgreSQL `DATABASE_URL`. The deployed connection and provider remain unverified. No schema change or production data operation was performed. |
| Authentication and tenancy | Passwords are hashed with bcrypt. HTTP middleware verifies JWTs and reads the tenant from the signed claim. WebSocket subscriptions check tenant identity. Most CRM queries explicitly scope reads and writes to the workspace. Existing automated isolation tests pass. |
| Lead Finder | Existing public search and web research identify company opportunities and generate evidence and drafts. A pre-existing working-tree change added multipass analysis. Model-generated facts could pass with absent or unverified evidence. Existing search and scoring are oriented toward B2B operations and MachineMind, with fixture paths for testing. Customer-intent discovery and geographic radius filtering remain open. |
| Phone Studio | The browser obtains microphone access and uses the Web Speech API for normal recognition, a voice-session controller for VAD and interruption, and TTS audio with browser speech synthesis fallback. Express also exposes Gemini audio transcription and a Deepgram-preferred path, but the normal controller sends text to the turn endpoint. STT defaults to an English transcription prompt. Browser recognition has limited locale handling. Device, connection, multilingual accuracy and audio recovery require live testing. |
| AI routing | Provider interfaces support Gemini, Groq, Ollama and a mock provider. CostRouter is used for several async tasks. Voice uses its own provider choice with Groq and nonproduction mock fallback in some configurations. Local Ollama was reachable and listed zero models. |
| CRM | Tenant-scoped leads, imports, conversations, call sessions, follow-ups and appointments are persisted. The existing Lead requires an email unique within each organization, which needs a deliberate design for discoveries without a public email. Phone Studio has session transcripts and summaries but lacks structured industry extraction and review-to-CRM. |
| Email | SMTP/Ethereal development path and live Resend adapter, signed inbound webhook, threading, lead matching, STOP/DNC and takeover logic. Unthreaded inbound routing can select the first matching email across workspaces. Unmatched messages can be logged under the oldest workspace. Tenant-aware inbound routing and live Resend verification remain release blockers. |
| Deployment | Frontend static build with SPA redirects and Express backend start scripts. Render environment and dashboard configuration are not in the checked-out repository. Both production endpoints were unreachable from this environment. This does not establish an outage. |
| Demos | Phone Studio carries browser simulation labeling. Billing and channel simulators include sandbox or placeholder behavior. Existing tests use fixtures and mocks where appropriate and do not establish live provider operation. |

## API inventory

All paths in the table are relative to the indicated `/api` prefix. The WebSocket endpoint is `/ws`.

| Prefix | Methods and subpaths |
| --- | --- |
| `/api/health` | GET root |
| `/api/auth` | POST `/register`, `/login`; GET `/me` |
| `/api/organization` | GET and PUT root; GET `/email-settings`, `/domain-dns`; POST `/select-email-provider`, `/test-email-connection`, `/send-test-email` |
| `/api/sdr` | GET and PUT root |
| `/api/leads` | GET and POST root; GET, PUT and DELETE `/:id`; POST `/import-csv`, `/:id/outreach` |
| `/api/conversations` | GET root, `/:id`, `/channels/status`, `/simulator/leads`; POST `/simulate-reply`, `/:id/human-message`, `/:id/resume-ai` |
| `/api/calls` | GET `/voices`, `/whisper/:callSid`; POST `/transcribe`, `/tts`, `/initiate`, `/turn`, `/complete`, `/takeover` |
| `/api/follow-ups` | GET and POST `/rules`; GET `/pending`; POST `/run-now` |
| `/api/handoff` | GET root, `/:leadId/dossier`; POST `/:leadId/resolve` |
| `/api/appointments` | GET and POST root |
| `/api/analytics` | GET `/overview` |
| `/api/billing` | GET root; POST `/checkout`, `/verify-payment` |
| `/api/webhooks` | POST `/resend/inbound`, `/resend/inbound/test`; GET `/resend/inbound/status` |
| `/api/opportunities` | GET root, `/:id`, `/research-runs/latest`; POST `/autopilot`, `/analyze-url`, `/generate-top-10`, `/:id/approve`, `/:id/reject`, `/:id/send` |

## Completed work and files changed

| Milestone | Changes | Files |
| --- | --- | --- |
| Initial fixes | Removed implicit database push from backend startup. Model evidence must include a quote from the cited page and pass the multipass critic when applicable. Public research fetches no longer follow unchecked redirects, and body size and request time are bounded. Fixed the pricing-objection regression in the mock and recognized Indian rupee pricing. DNS validation and the HTTP connection still resolve separately. | `package.json`, `apps/backend/src/services/opportunity/researchProvider.ts`, `apps/backend/src/services/ai/mockProvider.ts` |
| Workspace configuration | Added shared Real Estate and Salon catalogs and optional industry compatibility on the registration API. Registration sends new customers directly to their business profile and starts with empty business knowledge. Settings collect business facts and guidance. The API stores additional fields in one tenant-scoped ActivityLog row per workspace and saves them in the same transaction as the organization fields. Analytics activity responses omit payload details. | `packages/shared/src/{industries,index,schemas}.ts`, `apps/backend/src/routes/{auth,organization}.routes.ts`, `apps/backend/src/services/{analyticsService,workspaceConfigurationService}.ts`, `apps/frontend/src/context/AuthContext.tsx`, `apps/frontend/src/pages/{AuthPage,SettingsPage}.tsx` |
| Simulation safeguards | The browser call endpoint assigns new sessions demo IDs. Those sessions record transcripts and completion without executing tools or applying simulated opt-outs or qualification scores to the associated lead. The existing service behavior for legacy sessions is covered by the existing tests. | `apps/backend/src/routes/call.routes.ts`, `apps/backend/src/services/phoneService.ts` |
| Regression coverage | Added workspace settings validation and tenant isolation coverage plus a database-backed simulation side-effect test with mocked AI. | `apps/backend/src/tests/{workspace_configuration,phone_simulation_isolation}.test.ts` |

Eight files had uncommitted AI and discovery edits at the start. Their changes are still present, including in the two files also changed for the evidence and pricing regressions.

## Pending in implementation order

1. Deliver separate customer-intent and business-prospect providers, rank by India locality and radius, and preserve verifiable provenance through CRM intake.
2. Add industry qualification, review, scoring, lead identity and deduplication for discoveries with and without contact details.
3. Upgrade and validate the full voice loop, including live Hindi, English and Hinglish, interruption, context and recovery.
4. Connect Real Estate and Salon agent configurations to business facts, structured extraction, and demo conversation history in CRM.
5. Add industry email and follow-up templates with workspace authorization, preserving Resend, threading, handoff and DNC.
6. Finish guided onboarding beyond signup and Settings. Add database-backed conversion, sources, tasks and industry dashboard metrics.
7. Complete SSRF, authorization, logging and performance review, run live provider and browser checks, and verify the deployed environment before release.

## Checks and deployment

- Initial `npm test` baseline was 125 passing and 3 failing. The two evidence rejection tests and one price objection failed.
- Final `npm test` run passed all 132 tests across 19 files, including workspace configuration and demo side-effect isolation.
- Full `npm run build`, SQLite Prisma validation and `git diff --check` passed. Prisma generation succeeded after pointing the command's temporary directory into the workspace and retrying after the Windows engine file lock cleared. Vite reported a bundle-size warning for the Three.js chunk.
- No microphone test or live AI provider test was completed. No database migration or production data change was made.

## Sign-in investigation

- Before pushing, production health returned HTTP 200. A deliberately invalid login returned the expected HTTP 401 with the production frontend origin allowed by CORS. This exercises an authentication database read. The deployed frontend was configured to use the Render backend URL.
- The UI message was triggered by the frontend's original 25-second deadline. Production responded during the investigation, so the original delay could not be reproduced. Sign-in now waits up to 65 seconds to accommodate a slow response.
- Render serves the public home page but returns HTTP 404 for a direct request to `/login`. The Render static site's SPA rewrite needs verification in its service configuration.
