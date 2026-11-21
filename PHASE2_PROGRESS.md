# NexSDR Phase 2 progress

- November 21 release follow-up: published the contact import and territory release to main (57dee78). Refined LandingPage, AuthPage, OnboardingModal, Sidebar, SettingsPage, PhoneStudioPage, OpportunityEnginePage and shared plan copy. App now loads map and 3D voice dependencies on their routes. OpportunityService skips prospects without a contact email during bulk CRM creation and blocks guessed historical addresses in opportunity outreach. Updated opportunity regression coverage and applied compatible dependency patches. Full build and all 139 tests passed. Dependency audit still reports 10 advisories, including Vite/Vitest and runtime packages. Live microphone and actual delivery remain unverified.

- Local changes, November 21: ContactImport and LeadsPage read XLSX/CSV, map fields and preview rows. Lead routes and LeadService validate imports and skip duplicate workspace emails. TerritorySearch, the opportunity route and territory provider add pin/radius business lookup. OnboardingModal no longer fills missing business facts with sample claims. ConversationsPage shows WhatsApp coming soon. Updated PhoneService and Gemini STT language instructions.
- Verification: 139 existing tests passed and the production build passed. The production Opportunity Atlas was observed in Chrome. Interactive navigation failed with unavailable window geometry. New local features have not been deployed or accepted in-browser. Outstanding work includes import history and campaigns, nationwide and customer-intent discovery, WhatsApp integration plumbing, voice coaching and real microphone acceptance.

- Atlas UI release: updated the shared layout and stylesheet, public pages, dashboard, Opportunity Engine, and Phone Studio. Added three optimized artwork assets. The final release build and all 139 tests passed. Local Chrome smoke checks covered all 19 routes, a mobile layout, and the Add Lead dialog. Live calls and inbox delivery were not exercised in this UI release.

- Opportunity Engine follow-up: reproduced unrelated Bing results, switched public search to relevance-filtered DuckDuckGo with Bing fallback, and excluded additional job boards. Targeted research now includes the submitted page. The frontend build emits an Opportunity Engine entry page and gives research requests a longer deadline. Live read-only Autopilot discovery returned six candidates and read 3,506 characters from corvel.com. Qualification and production CRM writes were not exercised. Changed the public discovery provider, opportunity service, frontend API client and Vite config. All 139 tests passed.

## Autopilot discovery — 18 November 2026

- Updated researchProvider to crawl the discovered source page and follow up to three validated redirects on the same site. Updated opportunityService to persist specific rejection reasons and count unread sites as zero pages and zero AI analyses. OpportunityEnginePage displays completed searches with zero matches as an informational result.
- Updated real_opportunity_discovery.test.ts to check the actual outcome for a blocked loopback candidate. All 139 tests and the full build passed. A live fetch using the crawler read 171 characters from example.com. The original workspace search was not replayed because qualification can create production records. Deployment verification pending.

## Email and SDR reliability fix — 18 November 2026

- Diagnosed the reported raw JSON email: malformed/truncated AI action envelopes fell through parsing and were sent as customer text. Groq outreach now requests structured output and rejects token-limit truncation. A shared reply parser protects Groq, Gemini and Ollama; EmailService and direct Resend delivery reject internal action metadata and unfinished signature placeholders.
- Strengthened prompts to use the configured sender and avoid unsupported metrics, testimonials and invented results. This is a generation instruction, not a complete factual verification system.
- Fixed delivery accounting in LeadService, ToolExecutor, conversation replies, human messages and FollowUpEngine. Failed transport results no longer count as sent or advance follow-up cadence. Conversation delivery persists provider IDs for threading. Outreach respects paused SDRs and human takeover.
- Changed files: services/ai/{customerMessage,groqProvider,onlineGeminiProvider,ollamaProvider,promptBuilder}, emailService, resendService, channels/emailProvider, messageDeliveryService, conversationService, leadService, toolExecutor, followUpEngine and their regression tests.
- Validation: final 139 tests across 21 files passed, full frontend/backend/shared build and Prisma validation passed. The existing Three.js bundle-size warning remains. Render deployment confirmation pending; the inspected Chrome window closed during verification.
- No production records or database migrations changed. No live email was sent during verification. Full product transformation and live end-to-end acceptance remain pending; automated tests do not prove inbox delivery or every provider's live behavior.
- Commits 85999ac and e14ac2a pushed to origin/main. Production `/api/health` returned HTTP 200 after push; this endpoint does not expose the deployed commit. Groq structured output budget increased to 2048 tokens and outreach requested under 140 words to reduce truncation. Render commit and live inbox verification remain pending.

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

## Phone Studio reply investigation

- Render runtime logs confirmed Groq HTTP 404 model_not_found for both Llama 3.3 70B and Llama 3.1 8B. The code incorrectly classified supported GPT-OSS models as retired and forced requests to these Llama models. Updated provider and CostRouter to preserve GPT-OSS configurations and migrate retired Llama configurations. Groq's deprecation documentation confirms the replacement models.

- Recognized speech can appear in the transcript before the backend turn succeeds. The old UI logged turn failures only to the browser console. It also waited for neural audio before rendering the reply and skipped audio entirely if the neural TTS request failed.
- Phone Studio now shows turn errors beside the transcript, bounds neural audio requests, and speaks generated text through browser TTS when neural audio is unavailable. The processing state stays active until the turn request settles.
- Supported workspaces now pass their industry, qualification questions and saved profile context to the voice prompt. Phone Studio and Settings link directly to the business profile.
- A live call with the user's microphone and deployed AI credentials remains to be verified.
