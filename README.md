# NexSDR — Autonomous AI Sales Development Representative Platform

NexSDR (Official Domain: [https://nexsdr.in](https://nexsdr.in)) is a production-grade, multi-tenant AI SDR platform built from scratch. It allows businesses to onboard, train an autonomous AI SDR (Alex Rivers, `alex@nexsdr.in`) on their verified product knowledge and ICP, manage leads, automate multi-channel outreach (Email, Phone Voice Studio, WhatsApp), execute BANT qualification conversations, run follow-up cadences, and escalate high-value enterprise accounts to human sales representatives with full 360-degree dossiers.

---

## ⚡ Key Highlights & Architecture

- **Low-Cost Production Inference**: Benchmarked and locked on **Qwen 2.5 3B** (~50 tok/s, sub-2s latency, 100% GPU VRAM fit on 4GB NVIDIA RTX 5050 GPU with zero paging, 8x-10x cheaper cloud inference cost).
- **Strict Tool-Calling Architecture**: The LLM *never* directly executes actions.
  $$\text{LLM} \longrightarrow \text{Structured Tool Decision} \longrightarrow \text{Backend Validation (Auth, Opt-out, Rate Limits)} \longrightarrow \text{Service Execution} \longrightarrow \text{Result to LLM}$$
- **10 Core SDR Tools**:
  1. `send_email`
  2. `read_email`
  3. `check_calendar_availability`
  4. `create_calendar_event`
  5. `create_followup`
  6. `update_lead`
  7. `qualify_lead`
  8. `schedule_call`
  9. `log_call`
  10. `human_handoff`
- **Zero-Cost Local First Stack**:
  - **Database**: Prisma ORM with SQLite for instant local zero-friction execution, pre-configured with a 1-line switch to PostgreSQL (`provider = "postgresql"`).
  - **AI Provider**: Seamless switching between local Ollama (`qwen2.5:3b`), Cloud LLM (OpenAI/Gemini), and deterministic offline Mock Provider.
  - **Telephony**: Interactive in-browser **Phone Voice Studio** using Web Audio and Speech Synthesis for real-time calls without carrier fees.
  - **Payments**: SaaS subscription billing with an India-compatible Razorpay / Stripe sandbox checkout.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js v18+ (tested on Node v24.18)
- Ollama with `qwen2.5:3b` (`ollama pull qwen2.5:3b`)

### 2. Installation & Setup
```bash
# Clone or navigate to the repository on D: drive
cd D:\ai-sdr-platform

# Install dependencies across all workspaces
npm install

# Build shared package
npm run build -w packages/shared

# Push Prisma schema to local database
npm run prisma:push -w apps/backend

# Seed rich enterprise demo data (CRM company, Alex Rivers SDR, 5 test leads)
npm run seed
```

### 3. Run Backend & Frontend
```bash
# Start backend API (Port 5000)
npm run dev -w apps/backend

# Start frontend SaaS dashboard (Port 3000)
npm run dev -w apps/frontend
```
Open **`http://localhost:3000`** in your browser.

- **Demo Credentials**:
  - Email: `demo@cloudflow.ai`
  - Password: `password123`
  - Or click **"1-Click Sign In with Demo Account"** on the login page.

---

## 🧪 Running Automated Tests

Run the comprehensive end-to-end verification suite:
```bash
npx tsx apps/backend/src/tests/run_tests.ts
```
The test suite validates all 7 core workflows:
1. Cold outreach email generation & tool call.
2. Inbound lead reply & objection handling.
3. Calendar intent detection & meeting booking.
4. Enterprise escalation & human handoff inbox.
5. Opt-out (STOP / Unsubscribe) safety enforcement.
6. Interactive voice phone call lifecycle (connect, speech turn, completion, summary).
7. SaaS analytics metric aggregation.

---

## 📁 Monorepo Structure

```
D:\ai-sdr-platform
├── packages
│   └── shared               # Shared types, Zod schemas, constants, tool definitions
├── apps
│   ├── backend              # Express, Prisma ORM, AI Brain, Services, Telephony WebSockets
│   │   ├── prisma           # schema.prisma, seed.ts, SQLite dev database
│   │   ├── src
│   │   │   ├── lib          # prisma, jwt, logger
│   │   │   ├── middleware   # auth, validator, errorHandler
│   │   │   ├── routes       # 11 REST API route modules
│   │   │   ├── services     # lead, conversation, phone, followUp, handoff, analytics, billing
│   │   │   │   └── ai       # ollamaProvider, mockProvider, promptBuilder, toolRegistry
│   │   │   └── tests        # run_tests.ts (end-to-end test suite)
│   │   └── server.ts        # Express + WebSocket server
│   └── frontend             # Vite + React 18 + Tailwind CSS Dashboard
│       └── src
│           ├── api          # client.ts API integration
│           ├── context      # AuthContext.tsx
│           ├── components   # Layout, Sidebar, Navbar
│           └── pages        # 14 responsive SaaS dashboard pages
```
