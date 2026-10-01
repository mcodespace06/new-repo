# CampusVoice — Workflows (v1.0)

> Companion to `PRD.md` and `ARCHITECTURE.md`. Section 9 describes the **build workflow** for Antigravity.

---

## 1. Registration & Verification

```mermaid
flowchart TD
  A[Visit /register] --> B[Enter username, password, college ID no., college email]
  B --> C{Roster match?<br/>ID + email + not claimed}
  C -- Yes --> D[Send 6-digit OTP to college email]
  D --> E{OTP correct within 10 min?}
  E -- Yes --> F[Account ACTIVE, role = roster role]
  E -- No x5 --> G[Lock OTP, retry after 30 min]
  C -- No --> H[Offer ID-card upload fallback]
  H --> I[Admin verification queue]
  I -- Approved --> F
  I -- Rejected --> J[User notified with reason]
```

Rules: one roster identity ↔ one account; role comes from the **roster**, never from user input; unverified users can only read rules.

## 2. Complaint Submission

```mermaid
flowchart TD
  A[User opens New Complaint] --> B[Fill category, title, description, location, time, optional target + evidence]
  B --> C{Choose mode}
  C -- Confidential --> D[Create complaint, link reporter in Vault]
  C -- Ultra-Anonymous --> E[Create complaint, NO vault link]
  D --> F[Generate tracking key]
  E --> F
  F --> G[Show key ONCE with copy/download + warning]
  G --> H[Enqueue analyze-complaint job]
  H --> I[Status = SUBMITTED, event logged]
```

Optional before submit: AI "help me phrase this" and "check for identifying details" suggestions.

## 3. AI Screening & Triage (async)

```mermaid
flowchart TD
  A[Job starts] --> B[Deterministic pre-checks]
  B --> C[Embed text + similarity search]
  C --> D[LLM structured analysis]
  D --> E[Compute priority score]
  E --> F{spam_prob >= 0.8 or >=2 anomaly flags?}
  F -- Yes --> G[Status FLAGGED_REVIEW -> Review queue]
  F -- No --> H[Status TRIAGED -> Case queue by priority]
  H --> I{Critical / pattern / recurrence?}
  G --> I
  I -- Yes --> J[Create risk alert + notify admins + recommended actions]
  I -- No --> K[Done]
  J --> K
```

## 4. Case Handling (Admin)

```mermaid
stateDiagram-v2
  [*] --> SUBMITTED
  SUBMITTED --> FLAGGED_REVIEW: AI suspects spam
  SUBMITTED --> TRIAGED: AI screening done
  FLAGGED_REVIEW --> TRIAGED: Admin marks valid
  FLAGGED_REVIEW --> REJECTED: Admin confirms spam (reason required)
  TRIAGED --> ASSIGNED: Admin assigns
  ASSIGNED --> IN_PROGRESS: Handler starts
  IN_PROGRESS --> NEEDS_INFO: Handler asks complainant
  NEEDS_INFO --> IN_PROGRESS: Complainant replies
  IN_PROGRESS --> ESCALATED: SLA breach or manual
  ESCALATED --> IN_PROGRESS: Senior takes over
  IN_PROGRESS --> RESOLVED: Action taken + note
  RESOLVED --> CLOSED: 14 days, no reopen
  RESOLVED --> REOPENED: Complainant reopens / recurrence detected
  REOPENED --> IN_PROGRESS
  REJECTED --> [*]
  CLOSED --> [*]
```

Required on each transition: actor role, timestamp, reason (for REJECTED / ESCALATED / RESOLVED), event written to timeline.

On RESOLVED/REJECTED the admin records an **Outcome**: `VALID`, `PARTIAL`, `DUPLICATE`, `UNVERIFIABLE`, `SPAM`, `MALICIOUS` (the last requires Super Admin). This outcome triggers the trust score update (§6).

## 5. Admin ↔ Complainant Chat

1. Admin opens case → writes message (shown as "Admin Office", not personal name, unless admin chooses to show name).
2. Complainant is notified (in-app; email if Confidential + opted in).
3. Complainant opens chat via **My Complaints** (Confidential) or **Track by key** (Ultra-Anonymous).
4. Status auto-toggles `NEEDS_INFO ↔ IN_PROGRESS` based on who replied last when the admin used "Request info".
5. Internal notes are separate and **never** visible to the complainant.
6. Warning banner in chat: "Avoid sharing details that could identify you if you want to remain anonymous."

## 6. Trust Score Update

```mermaid
flowchart LR
  A[Admin sets outcome] --> B{Outcome}
  B -- VALID --> C[+4]
  B -- PARTIAL --> D[+2]
  B -- DUPLICATE of valid --> E[+1]
  B -- UNVERIFIABLE --> F[0]
  B -- SPAM --> G[-10]
  B -- MALICIOUS --> H{Super Admin confirms?}
  H -- Yes --> I[-20]
  H -- No --> G
  C & D & E & F & G & I --> J[Vault: resolve reporter internally, update score + tier]
  J --> K[Admin UI shows only new tier, not identity]
```

Skipped entirely if: Ultra-Anonymous mode, or complaint category is a safety category (harassment, ragging, threats, discrimination).

## 7. SLA & Escalation

| Priority | First response | Resolution target | On breach |
|---|---|---|---|
| CRITICAL | 2 h | 24 h | Alert all admins + Super Admin, SMS/email |
| HIGH | 24 h | 3 days | Alert assigned admin + Super Admin |
| MEDIUM | 72 h | 10 days | Mark ESCALATED, notify admin |
| LOW | 7 days | 30 days | Show overdue badge |

`sla-escalation` job runs every 10 minutes, writes `SLA_BREACH` risk alerts and timeline events.

## 8. Repeat Detection & Timeline

1. New complaint embedded → compared with last 90 days.
2. Similarity ≥ threshold **and** same category/location → join or create `cluster`.
3. If the cluster has a RESOLVED case older than the new complaint → `RECURRENCE` alert ("Issue reappeared after being marked resolved").
4. Nightly `recurrence-scan`: any target entity with ≥ 3 complaints in 30 days → `PATTERN` alert.
5. **Cluster timeline** (admin view) shows a single chronological list: each complaint date, actions taken (status changes, notes), and a highlighted "No action taken in X days" gap.
6. Complainant timeline shows only their own complaint's events (never other people's).

## 9. SOS Flow

```mermaid
sequenceDiagram
  participant U as User
  participant App as App (PWA)
  participant API as Server
  participant Sec as Security/Admin Console
  participant Job as sos-dispatch
  participant PS as Police station (email/SMS)

  U->>App: Hold 3s / shake x3 / triple-tap
  App->>U: 10s countdown + Cancel
  alt Cancelled
    App->>U: "Alert cancelled"
  else Not cancelled
    App->>API: POST /api/sos {lat,lng}
    API->>Sec: SSE instant alert (sound + banner)
    API->>Job: enqueue dispatch
    Job->>PS: Email + SMS to nearest station(s) + security contacts
    Job->>API: mark DISPATCHED
    loop every 15s up to 15 min
      App->>API: POST /api/sos/:id/ping (location)
      API->>Sec: update live location
    end
    Sec->>API: ACK / RESPONDING / RESOLVED
    API->>App: status shown to user
  end
```

Failure path: delivery fails → retry with backoff → if still failing, show red banner to admins and tell the user to call 112.

## 10. Rules Assistant Flow

1. Super Admin publishes/edits a rule → `embed-rules` job re-chunks and embeds.
2. User asks: "Can a professor take my phone during class?"
3. System retrieves top-5 rule chunks → LLM answers **only** from them with citations.
4. If no relevant chunks: "I couldn't find a rule on this" + button **File a complaint** (pre-fills category/description).
5. If crisis language detected: show support message + SOS shortcut at top.

## 11. Break-Glass Identity Reveal

1. Super Admin A requests reveal for Complaint X with written reason (threat / legal order / proven malicious).
2. Super Admin B (different person) reviews the reason and approves or denies.
3. On approval: identity shown once, audit log entry created, both admins recorded; reporter is **not** notified (to avoid retaliation risk) but a quarterly anonymized count is published in the transparency report.
4. Not available for Ultra-Anonymous complaints.

---

## 12. BUILD WORKFLOW (for Antigravity)

**How to run it:** put all four docs in the repo root, open the folder in Antigravity, use **Planning mode**, paste the master prompt from `ANTIGRAVITY_PROMPT.md`, review the plan artifact, then run one phase at a time.

| Phase | Deliverables | Definition of Done |
|---|---|---|
| **0 Scaffold** | Next.js + TS + Tailwind + shadcn, Prisma, docker-compose (pgvector, mailpit), lint/test setup, `.env.example`, seed script | `docker compose up` + `npm run dev` shows home page; `npm test` passes |
| **1 Auth & RBAC** | Roster import (CSV), register, OTP verify, login, sessions, role middleware, ID-card queue | e2e: register→OTP→login; RBAC matrix unit tests green |
| **2 Complaints core** | Form, categories, locations, tracking key, vault link/ultra-anon, timeline, My Complaints, Track page | e2e: submit→key→track; DB test proves `complaints` has no user link; vault isolation test |
| **3 Admin console + chat** | Dashboard, case list/detail, statuses, notes, outcomes, chat (SSE), internal notes | Admin can run case end-to-end; complainant sees replies |
| **4 Rules + AI assistant** | Rules CRUD + versioning, chunk/embed job, RAG chat with citations, guardrails | Eval: answers cite rules; unknown question returns "not found" |
| **5 AI analysis** | Pipeline job, spam/anomaly, priority, clusters, recurrence/pattern, risk alerts, trust engine | Fixture evals pass; no auto-penalty; alerts visible |
| **6 SOS** | Triggers, countdown, API, dispatch job (email+SMS mocks), security console, pings | e2e with mocked providers; dispatch < 15 s in test |
| **7 Analytics & notifications** | Charts, heatmap by location, notification center, SLA job, transparency stats | Dashboards render with seeded data |
| **8 Hardening & deploy** | Security checklist, rate limits, headers, audit logs, backups doc, deploy guide | Checklist in ARCHITECTURE §11 fully ticked; e2e suite green |

**Rules for every phase:** (1) write/update tests first or alongside, (2) run lint + typecheck + tests, (3) verify UI in the browser and capture screenshots as artifacts, (4) summarize what changed and any deviations from the docs, (5) stop and wait for approval before the next phase.
