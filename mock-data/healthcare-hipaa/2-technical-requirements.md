# Patient Data Platform: Technical Requirements
## Product Requirements Document (PRD)

**Product Owner:** Clinical Product & Privacy
**Engineering Lead:** Platform Architecture
**Release Target:** Q3 2025
**Scope:** MVP — patient record access, consent management, audit and disclosure handling

---

## Product Vision

Give clinicians fast access to the records they need while making every access accountable. The platform must reduce the time to locate a patient record from minutes to seconds, and reduce privacy-officer review effort by surfacing only the access events that warrant attention.

---

## Core Features (MVP)

### Feature 1: Identity and Access

**1.1 Role-Based Access Control**

*User Story:* As a privacy officer, I want access to be governed by clinical role so that staff see only what their job requires.

**Technical Requirements:**
- Roles: attending clinician, nurse, scheduling clerk, billing analyst, privacy officer, system administrator
- Each role maps to a permitted set of record sections: demographics, encounters, medications, clinical notes, psychotherapy notes, substance use records, billing
- Psychotherapy notes and substance use records are excluded from every role by default and require explicit per-patient grant
- Role assignment requires approval by a second person; self-approval is rejected by the system
- Access reviews generated every 90 days, listing every user and their effective permissions

**Acceptance Criteria:**
- A scheduling clerk retrieving a clinical note receives a permission error, and the attempt is logged
- No role grants access to psychotherapy notes without an explicit per-patient authorisation record
- Role changes take effect within 60 seconds and are recorded with approver identity
- Access review export includes user, role, last login and records accessed in the period

**1.2 Break-Glass Access**

*User Story:* As an emergency clinician, I want to reach a record outside my normal scope when a patient's life is at risk, so that care is not delayed by a permission boundary.

**Technical Requirements:**
- Break-glass requires a stated reason from a fixed list plus free text
- Access granted immediately; no approval in the path
- Session limited to 4 hours, then re-authorisation required
- Every break-glass event queued for privacy officer review
- Patient notified of break-glass access to their record within 30 days

**Acceptance Criteria:**
- Break-glass grants access in under 5 seconds — a delay here is a clinical risk
- Every event appears in the privacy officer queue within 60 seconds
- Review queue cannot be dismissed in bulk; each event requires an individual decision
- Audit trail: user, patient, reason, records viewed, duration, reviewer, outcome

---

### Feature 2: Consent and Authorisation Management

**2.1 Consent Capture**

*User Story:* As a health information manager, I want consents and authorisations recorded against the patient so that disclosures can be checked against them automatically.

**Technical Requirements:**
- Consent types: general treatment consent, research participation, marketing, substance use disorder disclosure (42 CFR Part 2), psychotherapy notes authorisation
- Each consent records: scope, recipient class, purpose, effective date, expiry date, and method of capture
- Consents are revocable; revocation is effective immediately for future disclosures and recorded with a timestamp
- Expired consents must not block treatment access, but must block the disclosure they governed

**Acceptance Criteria:**
- A disclosure attempt without a matching active consent is refused and logged
- Revocation propagates to disclosure checks within 60 seconds
- Substance use disorder records cannot be disclosed without a Part 2 consent, regardless of any general consent
- Consent history is retained in full; a revoked consent is never deleted

---

### Feature 3: Audit and Monitoring

**3.1 Immutable Audit Log**

*User Story:* As a compliance officer, I want a complete and tamper-evident record of PHI access so that I can answer an auditor without reconstructing anything.

**Technical Requirements:**
- Every read, write, export and print of PHI generates an audit entry
- Entry contains: user identity, role at time of access, patient identifier, record section, action, timestamp, source IP, and outcome
- Audit storage is append-only; no application path permits update or delete
- Retention 6 years minimum, configurable higher for states requiring longer
- Audit records queryable by patient, by user and by date range

**Acceptance Criteria:**
- Audit write is synchronous with the access it records — an access that cannot be logged must fail rather than proceed unlogged
- Query for one patient's full access history returns in under 3 seconds
- No API, admin console or database role permits modification of an existing audit row
- Export produces a signed file suitable for submission to an auditor

**3.2 Anomaly Detection**

*User Story:* As a privacy officer, I want unusual access surfaced so that I review what matters instead of reading every log line.

**Technical Requirements:**
- Baseline per user: records per day, departments touched, hours of activity
- Flag: access to a record for a patient with the same surname as the user
- Flag: access to a VIP or employee record
- Flag: volume more than three standard deviations above the user's baseline
- Flag: access outside the user's normal hours, where the user has an established pattern
- Flag: a record accessed by a user with no care relationship recorded

**Acceptance Criteria:**
- Flags raised within 30 minutes of the access
- False positive rate below 20%, measured monthly against reviewer outcomes
- Each flag carries the reason and the evidence that triggered it
- Reviewer decisions feed back into the baseline

---

### Feature 4: Patient Rights Fulfilment

**4.1 Right of Access Requests**

*User Story:* As a health information manager, I want to track access requests against the statutory clock so that we do not miss the 30-day deadline.

**Technical Requirements:**
- Request intake records: patient identity and verification method, scope requested, format requested, date received
- Clock starts on receipt, not on verification
- One 30-day extension permitted, requiring written notice to the patient before day 30
- Fulfilment assembles the designated record set, excluding psychotherapy notes
- Delivery methods: secure portal download, encrypted email, physical media

**Acceptance Criteria:**
- Days remaining displayed on every open request
- Extension cannot be recorded without evidence the patient was notified
- Requests approaching day 25 escalate to the health information manager
- Audit trail: request, verification, assembly, delivery, and the identity of every actor

**4.2 Accounting of Disclosures**

*User Story:* As a patient, I want a list of who my information was disclosed to, so that I can see where it has gone.

**Technical Requirements:**
- Accounting covers six years prior to the request
- Excludes treatment, payment and healthcare operations disclosures
- Includes: date, recipient name and address, description of PHI, and purpose
- First accounting in any 12-month period is free; subsequent requests may carry a cost-based fee after notice

**Acceptance Criteria:**
- Accounting generated within 60 days of request
- Excluded categories are genuinely excluded, verified by sampling
- Output is readable by a patient, not a system log

---

### Feature 5: Breach Management

**5.1 Incident to Breach Workflow**

*User Story:* As a privacy officer, I want a structured path from a suspected incident to a notification decision, so that the four-factor assessment is never skipped.

**Technical Requirements:**
- Incident intake from: anomaly flags, staff report, patient complaint, vendor notification
- Four-factor risk assessment recorded explicitly: nature and extent of PHI, who received it, whether it was acquired or viewed, and mitigation
- Presumption of breach unless the assessment concludes low probability of compromise, with reasoning recorded
- Affected individual list assembled from audit records
- Notification templates for individual, HHS and media

**Acceptance Criteria:**
- A breach cannot be closed as non-reportable without all four factors recorded
- Countdown from discovery date displayed, 60-day deadline
- Breaches of 500 or more individuals flagged for the separate HHS timeline and media notice
- Business associate notifications recorded with the date the associate discovered the incident, not the date they told us

---

## Non-Functional Requirements

### Performance
- Record retrieval under 2 seconds at the 95th percentile
- Break-glass grant under 5 seconds
- Audit query for one patient under 3 seconds
- 200 concurrent clinical users minimum

### Security
- Encryption at rest AES-256, in transit TLS 1.2 or higher
- Unique user identification; no shared accounts, enforced by the system
- Automatic logoff after 15 minutes of inactivity on clinical workstations
- Key management separated from data storage with documented rotation
- Multi-factor authentication for remote access

### Availability
- 99.9% uptime; clinical systems cannot be unavailable during care
- Recovery time objective 4 hours, recovery point objective 15 minutes
- Documented emergency mode operation when the platform is unavailable

### Privacy
- Minimum necessary enforced at record-section level
- De-identification available for research extracts, using the Safe Harbor method
- GDPR: erasure requests honoured for EU patients where no legal retention obligation applies

---

## Out of Scope for MVP

- Direct patient-to-patient messaging
- Genomic data storage
- Clinical decision support
- Automated de-identification using expert determination

---

## Open Questions

- Which state retention period governs when a patient has been treated in more than one state?
- Should break-glass notify the patient automatically, or on privacy officer confirmation?
- Do we support the expert determination method for de-identification, or Safe Harbor only?
- What is the approved verification method for a right-of-access request received by telephone?
