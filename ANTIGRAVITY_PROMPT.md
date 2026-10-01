# CampusVoice — Antigravity Prompts

**Setup:** Put `PRD.md`, `ARCHITECTURE.md`, `WORKFLOW.md` and this file in the repo root. Open the folder in Antigravity, use **Planning mode**, and paste the **Master Prompt** below. Review the plan it produces, approve, then paste one **Phase Prompt** at a time.

---

## 1. Master Prompt (paste first)

```
You are a senior full-stack engineer and security-minded architect building "CampusVoice", an anonymous complaint and safety platform for a college campus.

SOURCE OF TRUTH
Read these files fully before doing anything:
- PRD.md           (what to build, requirement IDs, priorities)
- ARCHITECTURE.md  (stack, schema, vault design, APIs, AI pipeline, SOS, security)
- WORKFLOW.md      (user flows, state machines, SLA, build phases)
If anything conflicts, ARCHITECTURE.md wins for technical decisions and PRD.md wins for product behavior. If something is ambiguous or missing, list your assumptions in the plan instead of guessing silently.

STACK (do not substitute without asking)
Next.js App Router + TypeScript, Tailwind + shadcn/ui, PostgreSQL + pgvector, Prisma, Auth.js credentials with argon2id, zod validation, pg-boss for jobs, SSE for realtime, Gemini API behind an AIProvider interface, Vitest + Playwright, Docker Compose for local dev.

NON-NEGOTIABLE RULES
1. ANONYMITY: The `complaints` table must have NO user_id or any column linking to a user. Reporter links exist only in the `vault` schema, accessed only through src/server/vault. Admin code paths must use a DB role/connection that cannot read the vault. Ultra-Anonymous complaints create NO vault row. Never log complaint bodies or IPs.
2. NO AUTO-PUNISHMENT: AI only recommends. Trust score changes only after an admin-confirmed outcome (MALICIOUS requires Super Admin). The score never blocks filing and is ignored for safety categories and SOS.
3. RBAC: deny by default. Every route handler calls requireRole/requirePermission. Roles come from the college roster, never from user input. Add tests for the full matrix in ARCHITECTURE.md section 6.
4. AI SAFETY: treat complaint text and chat text as untrusted data. Use delimited blocks + structured JSON output (zod). The analysis pipeline has no tool access. The rules assistant answers only from retrieved rule chunks with citations, and refuses to reveal any complaint data.
5. SOS must work even if the AI service is down. Dispatch uses email + SMS (use mock providers in dev/test). Never claim direct police-system integration in UI copy; say "alert sent to registered police/security contacts" and always show a Call 112 button.
6. SECURITY: secrets only via env (.env.example with placeholders), CSRF protection, secure cookies, rate limits on auth/OTP/complaint/AI routes, upload allow-list + EXIF stripping, security headers, audit log for sensitive actions.
7. Keep code typed, small, and tested. No dead code, no TODO placeholders presented as done.

HOW TO WORK
- Start in PLANNING mode. Produce an Implementation Plan artifact covering: phases 0-8 from WORKFLOW.md section 12, file/folder layout, Prisma schema outline, risks, assumptions, and open questions from PRD section 12.
- WAIT for my approval of the plan.
- Then build ONE PHASE AT A TIME. For each phase: implement -> write/update tests -> run lint, typecheck, unit and e2e tests -> verify UI in the browser and attach screenshots/recordings as artifacts -> give a short summary including deviations from the docs -> STOP and wait for my "next phase".
- Commit after each phase with a clear message.
- Seed data: demo roster (students, teachers), 1 super admin, 2 admins, 1 security officer, categories, locations, sample rules, 3 police stations. Never seed real personal data.

UI/UX DIRECTION
Calm, trustworthy, mobile-first, high-contrast, WCAG 2.1 AA. Plain language. The tracking-key screen must be unmissable (copy + download + "shown only once" warning). The SOS button is always reachable but guarded against accidental taps (hold + countdown). Admin console is dense and efficient: priority badges, SLA timers, alert panel.

Confirm you have read all three docs by replying with a 10-line summary of the system and your top 5 risks, then produce the Implementation Plan.
```

---

## 2. Phase Prompts (paste one at a time, after approval)

### Phase 0 — Scaffold
```
Execute Phase 0 from WORKFLOW.md section 12. Scaffold Next.js + TS + Tailwind + shadcn/ui, Prisma, docker-compose (postgres with pgvector, mailpit), ESLint/Prettier, Vitest, Playwright, .env.example, folder structure from ARCHITECTURE.md section 3, a worker.ts entry for pg-boss, a /api/health route, and a seed script skeleton. Verify docker compose up + npm run dev + npm test work. Stop after summary.
```

### Phase 1 — Auth, Roster, RBAC
```
Execute Phase 1. Implement: Prisma models for users, college_roster, verification_requests; CSV roster import (Super Admin); register (username+password, college ID no., college email); roster match + 6-digit OTP via email (hashed OTP, 10 min expiry, attempt limit); ID-card upload fallback + admin approval queue; login/logout/reset; rate limiting; role middleware + requirePermission helpers; route groups (public/user/admin/security) with guards. Add unit tests for the entire RBAC matrix and e2e for register->OTP->login. Stop after summary.
```

### Phase 2 — Complaints Core, Vault, Tracking
```
Execute Phase 2. Implement: categories, locations, complaints, complaint_events, attachments (sanitized uploads), the vault schema + restricted DB role + src/server/vault module (AES-256-GCM, linkReporter, listComplaintsForUser), tracking key generator (CV-YYMM-XXXX-XXXX, Crockford base32 + checksum, stored as SHA-256+pepper), Confidential vs Ultra-Anonymous modes, complaint form (zod), My Complaints, public Track page with timeline. Required tests: complaints table has no user link; admin DB role cannot read vault.*; tracking key checksum/hash; Ultra-Anonymous creates no vault row; e2e submit->key->track. Stop after summary.
```

### Phase 3 — Admin Console and Chat
```
Execute Phase 3. Implement: admin dashboard, case list with filters, case detail, state machine from WORKFLOW.md section 4 with required reasons, assignment, internal notes, outcome recording (VALID/PARTIAL/DUPLICATE/UNVERIFIABLE/SPAM/MALICIOUS with Super Admin gate), per-complaint chat over SSE (admin sees pseudonym only; complainant via login or tracking key), NEEDS_INFO toggling, notification center, audit log writes. Restricted queues (ICC / Anti-Ragging) visible only to members. Tests for state transitions and permission gates; e2e for admin replying and complainant seeing it. Stop after summary.
```

### Phase 4 — Rules Library and AI Assistant
```
Execute Phase 4. Implement: rule_documents + versioning, admin CRUD UI (markdown + PDF upload), public search/filter, the AIProvider interface with Gemini implementation (generateJSON, chatStream, embed) and a mock provider for tests, chunking + embedding job, RAG chat with citations "[Rule Title > Section]", "not found -> offer to file complaint" behavior, crisis-language detector that shows support info + SOS shortcut, prompt-injection and data-leak guardrails, per-user chat history with delete. Add eval fixtures (in-scope, out-of-scope, injection attempts). Stop after summary.
```

### Phase 5 — AI Analysis, Trust, Risk Alerts
```
Execute Phase 5. Implement the analyze-complaint pipeline exactly as in ARCHITECTURE.md section 8.2: deterministic pre-checks, embeddings + pgvector similarity, LLM structured analysis (summary, category, severity, urgency signals, spam_probability, anomaly_flags, reasoning), deterministic priority scoring with hard rules, FLAGGED_REVIEW queue (never auto-reject), clusters, recurrence and pattern alerts, risk_alerts with recommended actions, ai_analyses audit storage with model + prompt version, admin override. Implement the trust engine as pure tested functions in src/server/ai/trust.ts and wire it ONLY to admin-confirmed outcomes via the vault; admins see tier only. Add ~30 fixture complaints for evals. Stop after summary.
```

### Phase 6 — SOS
```
Execute Phase 6. Implement: SOS button with three triggers (press-and-hold 3 s, shake x3 with iOS permission flow, triple-tap), 10 s cancel countdown, POST /api/sos, immediate SSE alert to security/admin consoles, sos-dispatch job (nearest 1-2 police stations by Haversine + security contacts, email + SMS via provider interface, mock in dev), location pings every 15 s up to 15 min, security console with Acknowledge/Responding/Resolved/False alarm, user-visible status, failure banner + retry/backoff, Call 112 button, police station management for Super Admin. Tests: Haversine, dispatch with mocks, cancel path, failure path. Stop after summary.
```

### Phase 7 — Analytics, Notifications, SLA
```
Execute Phase 7. Implement: SLA policies + sla-escalation cron job + SLA_BREACH alerts, nightly recurrence-scan, monthly trust-recovery, analytics (by category/location/time, resolution time, satisfaction, hotspot heatmap by campus location, repeat issues), satisfaction rating + reopen within 14 days, email notifications for opted-in Confidential users, transparency report page (anonymized monthly stats). Stop after summary.
```

### Phase 8 — Hardening and Deployment
```
Execute Phase 8. Walk through ARCHITECTURE.md section 11 item by item and implement/verify each; add security tests (IDOR on tracking routes, admin routes as student, injection payloads); implement break-glass reveal with two-person approval and audit logging; retention-cleanup job; write README with setup, env vars, deployment guide (Docker + Vercel/Neon option), backup and vault-key-rotation notes, and a short privacy notice page. Run the full test suite and give a final report: what is done, known limitations, and recommended next steps. Stop after summary.
```

---

## 3. Optional: Workspace Rules File

If your Antigravity version supports workspace rules (for example a rules file inside the project), save this so every agent session follows it:

```
- Read PRD.md, ARCHITECTURE.md, WORKFLOW.md before changing code.
- Never add user identifiers to the complaints table or any admin-readable path.
- Never apply penalties or trust-score changes from AI output alone.
- Every new API route needs zod validation, RBAC check, and a test.
- Never commit secrets; update .env.example when adding env vars.
- Run lint, typecheck, and tests before declaring a task done.
- Work one phase at a time and stop for approval.
```

---

## 4. Handy Follow-Up Prompts

- **Debug:** `The e2e test <name> fails. Reproduce it, find the root cause, fix it without weakening the test, and explain what was wrong.`
- **Security review:** `Act as an attacker. Review the current code against ARCHITECTURE.md section 11 and the anonymity rules. List concrete vulnerabilities with file/line references, then fix the top ones.`
- **UI polish:** `Review the screens you built in the browser on a 375px viewport. Fix spacing, contrast, focus states and empty/error/loading states. Attach before/after screenshots.`
- **Demo mode:** `Create a demo seed with 60 realistic fictional complaints (mix of spam, urgent, duplicates, recurring issues) so the admin dashboard and analytics look alive for a presentation.`
