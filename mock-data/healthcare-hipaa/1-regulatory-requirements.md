# Patient Data Platform — Regulatory Compliance Brief
## HIPAA Privacy Rule and Security Rule Requirements

**Document Type:** Regulatory Requirements Summary
**Audience:** Technical & Product Teams
**Effective Date:** 2024
**Compliance Frameworks:** HIPAA Privacy Rule, HIPAA Security Rule, HITECH Act, 42 CFR Part 2, GDPR (EU patients)

---

## Executive Summary

This document sets out the regulatory requirements for a platform handling Protected Health Information (PHI) on behalf of covered entities and their business associates. Requirements derive from:

- HIPAA Privacy Rule (45 CFR Part 160 and Part 164, Subparts A and E)
- HIPAA Security Rule (45 CFR Part 164, Subpart C)
- HITECH Act breach notification provisions
- 42 CFR Part 2 (substance use disorder records)
- GDPR, where the platform processes data for patients in the EU

Any system that creates, receives, maintains or transmits PHI must satisfy the administrative, physical and technical safeguards below.

---

## Core Requirements

### 1. Minimum Necessary Access

**1.1 Principle**
Access to PHI must be limited to the minimum necessary to accomplish the intended purpose. This applies to uses, disclosures and requests.

**1.2 Implementation**
- Role-based access control, with roles mapped to job function
- Record-level access decisions, not system-level: a scheduling clerk may see appointment times without seeing clinical notes
- Break-glass access for emergency treatment, permitted but always logged and reviewed
- Access reviews at least every 90 days, with results retained

**1.3 Acceptance Criteria**
- No user may retrieve a record outside their assigned role without a break-glass event being written
- Break-glass events must be reviewed by a privacy officer within 5 business days
- Access review completion is evidenced with reviewer identity and date

### 2. Patient Rights

**2.1 Right of Access**
- Patients may request a copy of their designated record set
- Response required within 30 calendar days, with one 30-day extension permitted if the patient is notified in writing
- Electronic copies must be provided in the form and format requested where readily producible
- Fees limited to reasonable, cost-based charges for labour and media

**2.2 Right to Amend**
- Patients may request amendment of records they believe inaccurate
- The covered entity must act within 60 days, with one 30-day extension
- Denials must state the basis and the patient's right to submit a statement of disagreement
- Amendments and disagreements must travel with the record wherever it is disclosed

**2.3 Accounting of Disclosures**
- Patients may request an accounting of disclosures for the six years prior to the request
- The accounting must include date, recipient, description of PHI disclosed, and purpose
- Disclosures for treatment, payment and operations are excluded from the accounting
- One accounting per 12 months must be provided free of charge

### 3. Technical Safeguards (Security Rule)

**3.1 Access Control**
- Unique user identification for every individual with access
- Automatic logoff after a period of inactivity
- Encryption and decryption of PHI (addressable, but the absence of encryption must be documented and justified)

**3.2 Audit Controls**
- Hardware, software or procedural mechanisms recording activity in systems containing PHI
- Audit records must capture: user identity, timestamp, record accessed, action taken, and outcome
- Audit logs must be retained for six years and protected from alteration

**3.3 Integrity**
- Mechanisms to authenticate that PHI has not been improperly altered or destroyed
- Version history for clinical records, with prior values retrievable

**3.4 Transmission Security**
- Encryption in transit for all PHI leaving the organisation's network (TLS 1.2 minimum)
- Integrity controls to detect modification in transit

**3.5 Encryption Standard**
- At rest: AES-256
- In transit: TLS 1.2 or higher
- Key management separated from data storage, with documented rotation

### 4. Breach Notification (HITECH)

**4.1 Definition**
An impermissible use or disclosure of PHI is presumed a breach unless a risk assessment demonstrates a low probability that the PHI has been compromised.

**4.2 Risk Assessment Factors**
- Nature and extent of the PHI involved, including identifiers and likelihood of re-identification
- The unauthorised person who used or received the PHI
- Whether the PHI was actually acquired or viewed
- The extent to which the risk has been mitigated

**4.3 Notification Timelines**
- Affected individuals: without unreasonable delay, and no later than 60 calendar days from discovery
- Department of Health and Human Services: within 60 days for breaches affecting 500 or more individuals; annually for smaller breaches
- Media notice: required for breaches affecting more than 500 residents of a state or jurisdiction
- Business associates must notify the covered entity within 60 days of discovery

**4.4 Notification Content**
- Description of what happened and the date of the breach and its discovery
- Types of information involved
- Steps individuals should take to protect themselves
- What the entity is doing to investigate and mitigate
- Contact procedures

### 5. Business Associate Agreements

**5.1 Requirement**
A written agreement is required before a business associate may create, receive, maintain or transmit PHI on the covered entity's behalf.

**5.2 Required Terms**
- Permitted uses and disclosures, no broader than the covered entity's own
- Obligation to implement Security Rule safeguards
- Obligation to report security incidents and breaches
- Subcontractor flow-down: the same terms must bind any subcontractor
- Return or destruction of PHI at termination where feasible

### 6. Retention and Disposal

**6.1 Retention**
- HIPAA documentation (policies, authorisations, agreements) retained six years from creation or last effective date
- State medical record retention periods vary and may exceed six years; the longer period governs
- Audit logs retained six years

**6.2 Disposal**
- Media sanitisation before disposal or reuse
- Certificates of destruction retained for third-party disposal

### 7. Special Categories

**7.1 Substance Use Disorder Records (42 CFR Part 2)**
- Stricter than HIPAA: consent required for most disclosures, including for treatment
- Redisclosure prohibited without further consent
- Records must be segregable from the general medical record

**7.2 Psychotherapy Notes**
- Excluded from the right of access
- Require specific authorisation for most disclosures, separate from a general consent

---

## Compliance Obligations Summary

| Requirement | Timing | Responsibility | Audit Trail Required |
|---|---|---|---|
| Access provisioning | Before first login | Identity administration | Yes — role and approver |
| Break-glass review | Within 5 business days | Privacy officer | Yes — reviewer and outcome |
| Right of access response | 30 days, one extension | Health information management | Yes — request and fulfilment |
| Amendment decision | 60 days, one extension | Health information management | Yes — decision and basis |
| Breach risk assessment | On discovery | Privacy officer | Yes — four factors documented |
| Individual notification | 60 days from discovery | Privacy officer | Yes — date and method |
| HHS notification | 60 days (500+) or annual | Compliance | Yes — submission receipt |
| Access review | Every 90 days | System owner | Yes — reviewer and date |
| Audit log retention | 6 years | Platform operations | Yes — retention policy |

---

## Risk Tiers

**Low:** De-identified data, aggregate reporting, no re-identification key held
**Moderate:** Limited data set under a data use agreement; direct identifiers removed
**High:** Full PHI including identifiers, accessed by clinical staff
**Critical:** Substance use disorder records, psychotherapy notes, HIV and genetic information

Risk tier determines access controls, monitoring frequency and consent requirements.

---

## Success Criteria for Implementation

1. No access to PHI without a provisioned role or a logged break-glass event
2. 100% of PHI access events captured with user, timestamp and record
3. Right-of-access requests fulfilled within 30 days, measured
4. Breach risk assessments documented against all four factors
5. Audit logs immutable and retained six years, demonstrable to an auditor
6. Encryption at rest and in transit verified by configuration audit
7. Business associate agreements in place before any PHI is shared
