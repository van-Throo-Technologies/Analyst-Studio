# Business Requirements: Regional Health Network Platform
## Customer Scenario & Use Case Document

**Prepared by:** Clinical Solutions Team
**Client:** Meridian Regional Health (MRH)
**Scenario Type:** Implementation case study
**Date:** September 2024

---

## Executive Summary

Meridian Regional Health operates 4 hospitals and 31 outpatient clinics across three states, serving roughly 480,000 patients a year. It is replacing a records platform that cannot answer an auditor's questions without a manual reconstruction taking days.

The current privacy team spends most of its week reading access logs line by line. The target is that they read only what is anomalous, and that a right-of-access request is fulfilled in days rather than the current average of 26.

---

## Organisation Context

**MRH Profile:**
- Covered entity under HIPAA; also a business associate for two payer partners
- 4 hospitals, 31 clinics, 3 states (each with its own retention statute)
- 11,000 staff, of whom roughly 6,200 touch PHI
- Behavioural health service line, bringing 42 CFR Part 2 obligations
- EU patients treated at one facility near an international airport, bringing GDPR into scope for a small population
- Privacy team: 4 analysts and 1 privacy officer

**Regulatory Environment:**
- HIPAA Privacy and Security Rules, HITECH breach notification
- 42 CFR Part 2 for the behavioural health service line
- Three state retention statutes: 7 years, 10 years, and 10 years past the age of majority for minors
- Joint Commission accreditation survey scheduled for 2026
- Two payer contracts requiring annual security attestation

---

## Personas and Access Complexity

### Persona 1: Attending Clinician (48% of PHI-touching staff)
**Profile:**
- Physicians and advanced practice providers
- Access pattern: 20-60 records per shift, mostly their own panel
- Devices: shared clinical workstations and personal mobile
- Decision maker: chief medical officer

**Access Complexity:** Moderate
- Full clinical record for patients in their care
- Break-glass needed a few times a month, typically in the emergency department
- Risk factors: shared workstations, mobile access, high volume
- Expected provisioning time: same day on hire
- Compliance story: routine, with break-glass as the exception path

**Business Process:**
1. Credentialing completes and the identity team provisions the clinical role
2. Clinician logs in with multi-factor authentication
3. Records for their panel are available without further approval
4. A record outside the panel requires break-glass with a stated reason
5. Privacy officer reviews the break-glass event within 5 business days

---

### Persona 2: Behavioural Health Clinician (6% of staff)
**Profile:**
- Psychiatrists, psychologists, licensed counsellors
- Access pattern: fewer records, far more sensitive
- Records include psychotherapy notes and substance use disorder treatment

**Access Complexity:** High
- 42 CFR Part 2 applies: consent required for disclosures a general HIPAA consent would permit
- Psychotherapy notes require separate authorisation and are excluded from the right of access
- Substance use records must be segregable so they can be withheld from a general disclosure
- Expected provisioning time: same day, but with a second approval
- Monitoring: every access to a Part 2 record is reviewed, not sampled

**Business Process:**
1. Role provisioned with behavioural health scope, requiring two approvers
2. Part 2 records visible only where a Part 2 consent exists for that patient
3. Any disclosure request checked against consent before release
4. Redisclosure prohibition attached to every Part 2 record leaving the system
5. Access reviewed individually, not by sampling

---

### Persona 3: Revenue Cycle Analyst (21% of staff)
**Profile:**
- Billing, coding and claims staff
- Access pattern: high volume, narrow scope
- Needs diagnosis and procedure codes, not clinical narrative

**Access Complexity:** Low but high volume
- Minimum necessary is the governing principle: codes and demographics, no notes
- Risk factors: volume makes anomaly detection harder; a curious analyst is hidden in the noise
- Expected provisioning time: 2 business days
- Monitoring: baseline volume per analyst, flag on deviation

**Business Process:**
1. Role provisioned with billing scope
2. Analyst works a claims queue; records open from the queue, not by search
3. Free-text search of patient names is disabled for this role
4. Volume outside the baseline is flagged for review

---

### Persona 4: External Research Partner (under 1% of access, highest scrutiny)
**Profile:**
- Academic researchers under a data use agreement
- Access pattern: bulk extract, not interactive
- Requires a limited data set, or fully de-identified data

**Access Complexity:** Extreme
- No direct system access; extracts only
- Limited data set requires a data use agreement before release
- De-identification by Safe Harbor: 18 identifier types removed
- IRB approval required and recorded before any extract
- Expected turnaround: 2-4 weeks
- Monitoring: every extract logged with the requesting institution and the approving IRB

**Business Process:**
1. Research request received with IRB approval documentation
2. Privacy officer determines whether a limited data set or de-identified extract is appropriate
3. Data use agreement executed if a limited data set
4. Extract generated, reviewed and released through secure transfer
5. Extract recorded in the accounting of disclosures
6. Annual attestation from the institution that data has been handled per agreement

---

## Requirements Specific to MRH's Situation

### Multi-State Retention
**Challenge:** Three states, three retention rules, one platform.

**Business impact:**
- A patient treated in two states inherits the longer period
- Minors in one state must be retained until 10 years past the age of majority, which can be 28 years
- Deleting too early is a statutory violation; keeping everything forever raises breach exposure

**Implementation requirement:**
- Retention determined per record by the strictest applicable rule
- Retention clock visible on the record
- No bulk deletion path that can bypass the per-record rule
- Disposal certificates retained after destruction

### Break-Glass at Scale
**Challenge:** 6,200 staff generate more break-glass events than one privacy officer can read.

**Business impact:**
- A single missed inappropriate access can become a reportable breach
- Reviewing everything is not achievable with the current team
- Reviewing nothing is not defensible in a survey

**Implementation requirement:**
- Break-glass events triaged by risk, not presented as a flat list
- Same-surname, VIP and employee-record access always reviewed individually
- Emergency department break-glass during a documented trauma activation may be reviewed in batch
- Every event has a decision recorded, whatever the review path

### Payer Business Associate Obligations
**Challenge:** MRH is a business associate for two payers, not only a covered entity.

**Implementation requirement:**
- Incident reporting to the payer within their contractual window, which is shorter than HIPAA's 60 days
- Annual security attestation produced from system evidence, not assembled by hand
- Subcontractor flow-down documented for every vendor touching payer data

---

## Operational Volumes

- Patient records: 4.2 million
- PHI access events: 180,000-240,000 per day
- Break-glass events: 300-500 per month
- Right-of-access requests: 220-400 per month
- Amendment requests: 15-30 per month
- Accounting of disclosures requests: 5-15 per month
- Research extracts: 8-12 per quarter

**Operational constraint:** privacy team of 5. Automation is the only path to reviewing what matters.

---

## Success Criteria

**Business metrics:**
1. Right-of-access fulfilment under 10 days average, from 26
2. Privacy analyst time on log review reduced by 70%
3. Break-glass review completed within 5 business days for 100% of events
4. Zero access to Part 2 records without a recorded consent

**Regulatory metrics:**
1. 100% of PHI access captured in the audit log
2. Breach risk assessments documented against all four factors, without exception
3. Retention applied per record by the strictest applicable state rule
4. Audit evidence producible for a survey within 2 business days

**Operational metrics:**
1. Uptime 99.9%
2. Record retrieval under 2 seconds at the 95th percentile
3. 200 concurrent clinical users supported

---

## Open Business Questions

1. Should break-glass notify the patient automatically, or only after the privacy officer confirms the access was inappropriate?
2. Who owns the retention decision when a patient is treated across state lines — the treating facility or a central function?
3. Do we accept batch review for emergency department break-glass during documented trauma activations, and what evidence supports that?
4. What is the verification standard for a right-of-access request arriving by telephone rather than through the portal?
5. Should EU patient erasure requests be handled by the same workflow as amendment requests, or separately?
