# Collaboration Platform: Technical Requirements
## Product Requirements Document (PRD)

**Product Owner:** Platform & Trust
**Engineering Lead:** Infrastructure
**Release Target:** Q1 2026
**Scope:** MVP — trust controls needed for a SOC 2 Type II report and CCPA compliance

---

## Product Vision

Make the platform auditable by construction. Evidence for a Type II report should be a query, not a project. Today the team spends six weeks each year assembling screenshots; the target is producing the same evidence in an afternoon.

---

## Core Features (MVP)

### Feature 1: Access Governance

**1.1 Provisioning and Approval**

*User Story:* As a system owner, I want every production access grant to carry an approval so that the audit sample never turns up a grant nobody authorised.

**Technical Requirements:**
- Access requests raised in the ticketing system, never granted directly in a console
- Approver must be the system owner and must differ from the requester; self-approval rejected
- Grants carry an expiry: 90 days default, 7 days for elevated production roles
- Expiry triggers automatic revocation, with a renewal path requiring fresh approval
- Break-glass account exists for outage recovery, sealed and alarmed on use

**Acceptance Criteria:**
- No path exists to grant production access without a linked approval record
- An expired grant revokes within 1 hour of expiry
- Break-glass use raises a page to the security on-call within 60 seconds
- Export of all grants for a date range produces requester, approver, justification and expiry

**1.2 Quarterly Access Review**

*User Story:* As a compliance manager, I want reviews to produce evidence in the format the auditor wants, so that we are not reformatting spreadsheets in the audit window.

**Technical Requirements:**
- Review generated per system, listing every account with role and last login
- Reviewer must action every line: keep, reduce or revoke; bulk-approve is not offered
- Revocations execute from the review itself, not through a separate ticket
- Accounts with no login in 90 days flagged in the review
- Review closed only when every line has a decision

**Acceptance Criteria:**
- Review cannot be closed with undecided lines
- Revocation from a review takes effect within 1 hour
- Export includes reviewer identity, decision per line, and closure date
- Evidence retained for the full audit period, not overwritten by the next quarter

---

### Feature 2: Tenant Isolation

**2.1 Data Access Layer Enforcement**

*User Story:* As a security engineer, I want tenant scoping enforced below the application so that a missing filter in a query cannot leak another customer's data.

**Technical Requirements:**
- Every query carries a tenant context; queries without one are rejected at the data layer
- Row-level security enforced in the database, not only in application code
- Cross-tenant queries permitted only for named internal reporting roles, and always logged
- Automated test asserting that a request authenticated as tenant A cannot read tenant B, run on every deployment

**Acceptance Criteria:**
- A query without tenant context fails closed, and the failure is logged
- The cross-tenant test runs on every deployment and blocks release on failure
- Annual penetration test covers tenant isolation explicitly
- No support tool can read customer content without an audited impersonation session

**2.2 Support Impersonation**

*User Story:* As a support engineer, I want to see what the customer sees when they report a bug, without that becoming an unmonitored door into their data.

**Technical Requirements:**
- Impersonation requires a customer-linked support ticket
- Session limited to 2 hours and read-only by default
- Write access during impersonation requires a second approver
- Customer administrators can see a log of impersonation sessions on their account
- Every action during impersonation attributed to the engineer, not the customer

**Acceptance Criteria:**
- Impersonation without a ticket reference is refused
- Customer-visible log shows engineer, start and end time, and reason
- Actions taken are distinguishable from the customer's own in the audit trail

---

### Feature 3: Privacy Request Handling

**3.1 CCPA Request Intake and Fulfilment**

*User Story:* As a privacy analyst, I want consumer requests tracked against statutory clocks so that we never miss the 45-day deadline.

**Technical Requirements:**
- Intake channels: web form, toll-free number, and email to a published address
- Acknowledgement issued within 10 business days, automatically
- Request types: know categories, know specific pieces, delete, correct, opt out of sale or sharing, limit sensitive use
- Verification tiered by request type: lower for categories, higher for deletion and specific pieces
- Deletion cascades to backups on a documented schedule rather than immediately, with the schedule disclosed
- Two free requests per consumer per 12 months tracked, with subsequent requests flagged

**Acceptance Criteria:**
- Countdown visible on every open request; escalation at day 35
- Extension requires evidence the consumer was notified before day 45
- Deletion produces a manifest of what was deleted and what was retained under an exception, with the exception named
- Requests arriving as a service provider are routed to the customer, not answered directly

**3.2 Opt-Out and Sensitive Use Limits**

*User Story:* As a consumer, I want my opt-out honoured everywhere, not just where I set it.

**Technical Requirements:**
- Opt-out state stored against the consumer identity, not the session
- Global Privacy Control signal honoured as a valid opt-out
- Opt-out propagates to advertising and analytics integrations within 24 hours
- Sensitive personal information use limited on request, with a defined list of what remains permitted

**Acceptance Criteria:**
- Opt-out survives logout, device change and re-registration with the same identifier
- GPC signal recorded as the source when it is what triggered the opt-out
- Downstream propagation evidenced by an acknowledgement from each integration

---

### Feature 4: Evidence and Audit

**4.1 Continuous Evidence Collection**

*User Story:* As a compliance manager, I want control evidence collected continuously so that a Type II period is covered without a scramble at the end.

**Technical Requirements:**
- Evidence collectors for: access grants, access reviews, deprovisioning timing, change approvals, restore tests, vendor reviews, incident records
- Each collector runs on a schedule and stores a timestamped artefact
- Gaps are surfaced as they occur, not discovered at audit — a quarter with no access review is flagged in that quarter
- Evidence retained for the full audit period plus one year

**Acceptance Criteria:**
- Dashboard shows, per control, whether evidence exists for every period in the audit window
- A missing period is visible within 7 days of the period closing
- Evidence export produces a structured archive with an index
- No evidence artefact can be edited after collection

**4.2 Audit Logging**

*User Story:* As a security engineer, I want security-relevant events logged in one place with a retention I can defend.

**Technical Requirements:**
- Logged: authentication, authorisation failure, privilege change, data export, impersonation, configuration change
- Retention 12 months; recent 90 days searchable in under 5 seconds
- Log integrity: append-only, with no application role able to modify history
- Alerting on privileged access outside a change window

**Acceptance Criteria:**
- Search across 90 days returns in under 5 seconds
- No API or console path modifies an existing log entry
- Alert fires within 5 minutes of privileged access outside a window

---

### Feature 5: Availability

**5.1 Backup and Restore**

*User Story:* As a platform engineer, I want restores tested for real, because a backup that has never been restored is a hypothesis.

**Technical Requirements:**
- Daily automated backup, 35-day retention
- Quarterly restore into an isolated environment, with data integrity verified against known records
- Restore time measured and compared against the 4-hour recovery time objective
- Backup encryption with keys separate from the production key hierarchy

**Acceptance Criteria:**
- Restore test recorded with date, duration, and verification outcome
- A failed restore test raises an incident rather than being retried silently
- Recovery point verified within the 1-hour objective

---

## Non-Functional Requirements

### Performance
- API response under 300ms at the 95th percentile
- Log search over 90 days under 5 seconds
- Evidence export for a 12-month period under 10 minutes

### Security
- SSO with multi-factor authentication for all internal access
- Encryption at rest AES-256, in transit TLS 1.2 minimum
- Secrets in a managed store, never in source or environment files committed to version control
- Dependency scanning on every build, with critical findings blocking release

### Availability
- 99.9% monthly uptime excluding announced maintenance
- Recovery time objective 4 hours, recovery point objective 1 hour
- On-call rota 24/7 with a documented escalation path

### Privacy
- Data residency selectable per customer between US and EU
- Production data never copied to non-production without anonymisation
- Retention configurable per customer within regulatory limits

---

## Out of Scope for MVP

- FedRAMP authorisation
- HITRUST certification
- Customer-managed encryption keys
- Automated data subject request fulfilment for GDPR beyond the CCPA workflow

---

## Open Questions

- Does the Type II period start when the last control is implemented, or when evidence collection begins?
- What is the deletion schedule for backups, and is disclosing it sufficient under CCPA?
- Do we honour Global Privacy Control for all users, or only for California residents?
- Should customer administrators be able to see impersonation logs in real time, or on a delay?
