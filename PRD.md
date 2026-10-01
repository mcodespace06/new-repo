# CampusVoice — Product Requirements Document (v1.0)

> Working name: **CampusVoice**. A secure, anonymous-by-design complaint and safety platform for a college campus.

---

## 1. Overview

CampusVoice lets verified students and teachers raise complaints **without revealing their identity to the admin or to the people they report**, while still letting the system prevent spam, detect repeat problems, and escalate dangerous situations quickly. An AI layer helps users (rules chatbot, complaint drafting) and helps admins (triage, spam/anomaly detection, risk alerts). An in-app **Emergency (SOS) mode** alerts campus security and nearby police stations.

## 2. Problem Statement

- Students and staff hesitate to complain because they fear retaliation.
- Complaints get lost, repeat without anyone noticing, and there is no visible follow-up.
- Admins cannot tell which cases are urgent, which are spam, and which are part of a repeating pattern.
- Students often don't know the college rules, so they can't tell whether something is a violation.
- In emergencies there is no fast in-app way to raise an alarm.

## 3. Goals and Non-Goals

**Goals**
1. Safe anonymous reporting for verified campus members only.
2. Transparent complaint lifecycle (tracking key, timeline, two-way chat).
3. AI-assisted triage: category, severity, duplicate/pattern detection, spam/anomaly detection.
4. Central admin control: rules library, case handling, analytics, audit.
5. One-gesture emergency alert with location.

**Non-Goals (v1)**
- Replacing the official Internal Complaints Committee (ICC) / Anti-Ragging Committee. The tool routes to them; it does not replace them.
- A native mobile app (we ship a responsive PWA).
- Fully automated punishment. **AI only recommends; humans decide.**

## 4. Roles and Personas

| Role | Who | Core abilities |
|---|---|---|
| **Student** | Verified enrolled student | File complaint, track, chat, rules library, AI assistant, SOS |
| **Teacher** | Verified faculty/staff | Same as student (teacher-specific categories, e.g. workplace issues) |
| **Admin (Case Handler)** | Designated staff | Review/triage cases, chat with complainants, update status |
| **Super Admin** | Central admin | Everything above + manage users/roster, rules, SLA policy, audit logs, approve identity-reveal (break-glass) |
| **Security Officer** *(optional)* | Campus security | Receives and acknowledges SOS alerts only |

## 5. Key Design Decisions (read these first)

### 5.1 Anonymity model — "Confidential by default, Ultra-anonymous by choice"
The original idea combines *anonymous complaints* with *a per-person rating*. These conflict unless designed carefully. Solution:

- Admins and case handlers **never see who filed a complaint**. They see a pseudonym like `Complainant #A7F3` and a **Trust Tier** (Trusted / Normal / Watch), never the exact score or identity.
- The reporter-to-complaint link lives in an **Identity Vault** (separate schema, encrypted, never exposed through admin APIs).
- Two submission modes:
  - **Confidential (default):** linked in the vault → appears in "My Complaints", affects/uses Trust Score.
  - **Ultra-Anonymous:** *no vault link at all* → tracked only by the Unique Tracking Key; no score impact; cannot be traced even by the system.
- **Break-glass reveal:** Only in cases of credible threats, legal orders, or proven malicious false accusation. Requires Super Admin request + second approver + written reason; every reveal is permanently audit-logged.

### 5.2 Trust Score must never silence real victims
- The score only adjusts **triage weight and spam-check strictness**. It **never blocks** a user from filing.
- Safety categories (harassment, ragging, threats, SOS) **bypass score entirely**.
- Penalties apply only **after an admin confirms** a complaint was spam/malicious — never from AI alone.

### 5.3 Emergency mode honesty
There is no public API to "push" alerts into police systems. v1 delivers: in-app alert to security dashboard + email + SMS to **pre-registered contacts of campus security and the nearest police station(s)**, plus a one-tap **Call 112** button. Real police integration is a Phase 3 item that needs the college to arrange it officially.

## 6. Feature List

Priority: **P0** = MVP, **P1** = next, **P2** = later.

### 6.1 Authentication & Verification
| ID | Requirement | Pri |
|---|---|---|
| AUTH-1 | Register with username + password (min 10 chars, argon2id hashing). | P0 |
| AUTH-2 | Verify identity via **College Roster match**: user enters College ID/enrollment number + college email; system matches against the roster imported by Super Admin and sends a 6-digit OTP to the college email. | P0 |
| AUTH-3 | Fallback: upload College ID card photo → goes to admin verification queue (manual approve/reject). Optional AI OCR assist. | P1 |
| AUTH-4 | Account states: `PENDING_VERIFY → ACTIVE → SUSPENDED`. Unverified users can read rules only. | P0 |
| AUTH-5 | Login rate-limiting, lockout after repeated failures, session expiry, password reset by college email. | P0 |
| AUTH-6 | One roster identity can link to one account only. | P0 |
| AUTH-7 | Optional 2FA (TOTP) for admins. | P1 |

### 6.2 Role-Based Access Control
| ID | Requirement | Pri |
|---|---|---|
| RBAC-1 | Roles: STUDENT, TEACHER, ADMIN, SUPER_ADMIN, SECURITY. | P0 |
| RBAC-2 | Enforcement at API layer (middleware) **and** UI route level; deny by default. | P0 |
| RBAC-3 | Permission matrix defined in ARCHITECTURE.md §6 and covered by tests. | P0 |

### 6.3 Complaints
| ID | Requirement | Pri |
|---|---|---|
| CMP-1 | Complaint form: category, title, description, location (campus place picker), date/time of incident, optional target tag (department / place / role label), optional evidence upload. | P0 |
| CMP-2 | Anonymous modes (Confidential / Ultra-Anonymous) selectable at submission. | P0 |
| CMP-3 | **Unique Tracking Key** generated per complaint, shown once, format `CV-YYMM-XXXX-XXXX`. Only a hash is stored. | P0 |
| CMP-4 | Complaint categories (configurable): Academic, Infrastructure, Hostel, Canteen, Transport, Harassment, Ragging, Discrimination, Cyber-bullying, Corruption/Misconduct, Safety/Security, Mental-wellbeing, Other. | P0 |
| CMP-5 | Evidence uploads (images, PDF, short audio) with size/type limits, malware-safe handling, **EXIF/metadata stripped**. | P1 |
| CMP-6 | Draft saving and AI-assisted drafting ("help me write this clearly"). | P1 |
| CMP-7 | Reopen a resolved complaint within 14 days; satisfaction rating (1–5) on resolution. | P1 |
| CMP-8 | Special routing: Sexual harassment → ICC queue; Ragging → Anti-Ragging Committee queue. Restricted visibility to committee members. | P1 |

### 6.4 Tracking, Timeline & Repeat Detection
| ID | Requirement | Pri |
|---|---|---|
| TRK-1 | Public "Track Complaint" page: enter tracking key → see status + timeline + chat. | P0 |
| TRK-2 | **Complaint Timeline**: every event (submitted, AI-screened, assigned, status change, message, escalation, resolution) timestamped. | P0 |
| TRK-3 | **Repeat Timeline (Cluster view)**: similar complaints are grouped (embedding similarity + category + location). Admin sees "this issue was reported N times over X weeks; actions taken: …; actions NOT taken: …". | P1 |
| TRK-4 | **Recurrence alert**: if a similar complaint appears after a case was marked Resolved → auto-flag "Possible unresolved recurrence". | P1 |
| TRK-5 | **Pattern alert on target entity** (department/place/role label): ≥3 complaints in 30 days → admin alert. Visible to admins only; no automatic penalty. | P1 |
| TRK-6 | SLA timers with auto-escalation (see WORKFLOW.md §7). | P1 |

### 6.5 Chat (Admin ↔ Complainant)
| ID | Requirement | Pri |
|---|---|---|
| CHAT-1 | Per-complaint thread. Admin sees pseudonym only. Complainant accesses via login (Confidential) or tracking key (Ultra-Anonymous). | P0 |
| CHAT-2 | Admin can request more info → status becomes `NEEDS_INFO`. | P0 |
| CHAT-3 | Attachments in chat (same sanitization rules). | P1 |
| CHAT-4 | Notification on new message (in-app; email only if Confidential mode and user opted in). | P1 |
| CHAT-5 | Real-time delivery (SSE first, WebSocket later). | P1 |

### 6.6 Rules & Regulations Library
| ID | Requirement | Pri |
|---|---|---|
| RUL-1 | Admin creates/edits rule documents (title, category, rich text/markdown, PDF upload). | P0 |
| RUL-2 | Versioning with "last updated" and change log. | P1 |
| RUL-3 | Search + category filter for all users. | P0 |
| RUL-4 | Rules are chunked and embedded for the AI assistant (RAG). | P0 |

### 6.7 AI Assistant (User-facing chatbot)
| ID | Requirement | Pri |
|---|---|---|
| AI-1 | Chat that answers questions **only from the rules library** with citations (rule title + section). If not found, says so and offers to file a complaint. | P0 |
| AI-2 | "Is this a violation?" guidance — explains relevant rules, never gives legal verdicts. | P0 |
| AI-3 | Guides user to the right category and can pre-fill the complaint form. | P1 |
| AI-4 | Detects distress/crisis language → shows helpline/counselling info and a SOS shortcut. | P1 |
| AI-5 | Multi-language: English, Hindi, Marathi. | P2 |
| AI-6 | Prompt-injection safeguards; chatbot never reveals other users' data or complaint contents. | P0 |

### 6.8 AI Analysis Pipeline (Admin-facing)
Runs asynchronously on every new complaint.

| ID | Requirement | Pri |
|---|---|---|
| ANA-1 | **Auto-classification**: category suggestion + summary (2 lines) + key entities. | P0 |
| ANA-2 | **Severity & priority score** (Low / Medium / High / Critical) with an explanation ("why"). | P0 |
| ANA-3 | **Spam / anomaly detection**: output `spam_probability` and `anomaly_flags` (burst filing, copy-paste text, abusive-only content, vague with no specifics, category mismatch, new-account burst). Flagged items go to **human review before any penalty**. | P0 |
| ANA-4 | **Reporter Trust Score** (0–100, start 60) updated only on admin-confirmed outcomes (see §7). | P1 |
| ANA-5 | **Risk Alerts** to admin: Critical-level complaints, pattern alerts, recurrence alerts, SLA breach. Includes "Recommended urgent actions" list. | P0 (critical alert) / P1 (rest) |
| ANA-6 | Duplicate detection (embedding similarity) with link to related cases. | P1 |
| ANA-7 | Every AI output stored with model name, prompt version, and confidence for audit; admin can override. | P0 |

### 6.9 Emergency (SOS) Mode
| ID | Requirement | Pri |
|---|---|---|
| SOS-1 | Persistent SOS button in the app. Triggers: **press-and-hold 3 sec**, **shake phone 3×** (opt-in; requires motion permission on iOS), or **triple-tap** on the SOS icon. | P0 |
| SOS-2 | 10-second cancel countdown with loud on-screen confirmation to prevent accidents. | P0 |
| SOS-3 | On send: capture GPS location (with consent) and user's name/ID/phone — **SOS is not anonymous**, to protect the user. | P0 |
| SOS-4 | Dispatch: (a) live alert on Security/Admin dashboard (sound + banner), (b) email to security + nearest police station(s), (c) SMS to registered contacts. Nearest police chosen by distance from a Super-Admin-maintained list. | P0 |
| SOS-5 | Live location updates every 15 s for up to 15 min (user can stop). | P1 |
| SOS-6 | Security officer can Acknowledge / Responding / Resolved; sender sees status. | P1 |
| SOS-7 | Misuse handling: false alarms flagged by Super Admin; repeated misuse → review. | P1 |
| SOS-8 | One-tap "Call 112" and "Call campus security" buttons. | P0 |

### 6.10 Admin Console
| ID | Requirement | Pri |
|---|---|---|
| ADM-1 | Dashboard: open cases, by priority, SLA timers, new alerts. | P0 |
| ADM-2 | Case list with filters (status, category, priority, date, location, flagged-spam). | P0 |
| ADM-3 | Case detail: complaint, evidence, AI summary & reasoning, related cases, timeline, chat. | P0 |
| ADM-4 | Actions: assign, change status, add internal notes (not visible to complainant), mark spam/valid, merge duplicates, escalate. | P0 |
| ADM-5 | Analytics: complaints per category/location/time, resolution time, hotspot heatmap, repeat issues, satisfaction. | P1 |
| ADM-6 | User management: roster import (CSV), verify/approve ID queue, suspend accounts. | P0 |
| ADM-7 | Audit log viewer (who did what, when) — Super Admin only. | P1 |
| ADM-8 | Break-glass identity reveal workflow (dual approval). | P1 |
| ADM-9 | Public **Transparency report**: monthly anonymized stats (complaints received, resolved, avg time). | P2 |

### 6.11 Notifications
In-app notification center (P0), email (P1), browser push via PWA (P2).

## 7. Reporter Trust Score — Rules

- Range 0–100, starts at **60**. Stored only in the Identity Vault.
- Events (applied after admin decision):

| Outcome (admin-confirmed) | Change |
|---|---|
| Valid & resolved | +4 |
| Partially valid | +2 |
| Duplicate of a valid case | +1 |
| No action possible / unverifiable | 0 |
| Spam | −10 |
| Malicious / knowingly false | −20 (requires Super Admin confirmation) |

- Slow recovery: +1 per month toward 60 if below 60.
- Tiers shown to admin: **Trusted ≥ 75**, **Normal 40–74**, **Watch < 40**.
- Effects: Watch tier → stricter spam screening and slightly lower auto-priority; **never a block, never applied to safety categories or SOS**.
- User can see their own tier and a plain-language reason for each change.

> The original idea of a score "on reports against a person" is implemented as **Pattern Alerts on target entities (TRK-5)** instead of a score on people, to avoid unfair automated reputational damage. Admins investigate; AI does not judge.

## 8. Non-Functional Requirements

- **Security:** OWASP ASVS L2 baseline; argon2id; httpOnly secure cookies; CSRF protection; strict input validation (zod); rate limiting; secrets in env; encrypted vault; HTTPS only.
- **Privacy:** Data minimization; no IP/device logging on complaint submission (only coarse rate-limit counters, hashed and short-lived); data retention policy configurable; compliance posture aligned with India's DPDP Act 2023 (consent, purpose limitation, deletion on request where legally possible).
- **Performance:** Page load < 2.5 s on 4G; complaint submit < 1 s (AI runs async).
- **Availability:** Target 99% during academic hours; SOS path must work even if AI service is down.
- **Accessibility:** WCAG 2.1 AA; mobile-first responsive.
- **Observability:** Structured logs (no PII), error tracking, health endpoint.
- **AI safety:** Human-in-the-loop for all penalties; log prompts/outputs; cost caps per day.

## 9. Success Metrics

- ≥ 90% of complaints get a first admin response within SLA.
- Spam rate flagged correctly (admin-confirmed precision ≥ 85%).
- Median time to resolution trending down month over month.
- ≥ 70% user satisfaction rating on resolved cases.
- SOS dispatch (button → alert delivered) < 15 s median.

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Identity leak breaks trust | Vault isolation, encryption, no admin access path, audit log, break-glass dual approval |
| AI false positives on spam | Human review before penalty; explanations; override |
| Abuse of anonymity to defame | Trust score, spam review, break-glass for proven malicious cases |
| SOS false alarms | Cancel countdown, non-anonymous SOS, misuse review |
| Stylometric de-anonymization | Warn users to avoid unique identifiers; optional "rewrite neutrally" AI helper |
| LLM prompt injection via complaint text | Treat complaint text as untrusted data; structured outputs; no tool access in analysis pipeline |
| College never adopts | Start with pilot department; transparency report; ICC integration |

## 11. Milestones

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Scaffold, DB, CI | Running skeleton |
| 1 | Auth, roster, verification, RBAC | Verified users with roles |
| 2 | Complaints, tracking key, timeline | Core complaint loop |
| 3 | Admin console, chat | Admin can handle cases |
| 4 | Rules library, AI rules assistant | Self-help |
| 5 | AI analysis, spam/anomaly, trust score, risk alerts | Smart triage |
| 6 | SOS mode | Safety feature |
| 7 | Analytics, notifications, polish | Pilot-ready |
| 8 | Security hardening, tests, deployment | Launch |

## 12. Open Questions (decide before build)

1. Which roster source will the college provide (CSV of enrollment no., name, email, role, department)?
2. Who are the designated ICC and Anti-Ragging Committee members?
3. Which police station email/phone contacts are officially authorized to receive SOS mails?
4. Data retention period for closed complaints?
5. Hosting preference (college server vs cloud)?
