# KYC Platform: Technical Requirements & Implementation Scope
## Product Requirements Document (PRD)

**Product Owner:** Compliance & Product  
**Engineering Lead:** Platform Architecture  
**Release Target:** Q2 2025  
**Scope:** MVP - Customer onboarding workflow with verification and monitoring  

---

## Product Vision

Enable rapid customer onboarding while maintaining regulatory compliance across EU/UK jurisdictions. The KYC platform must automate identity verification, risk assessment, and ongoing monitoring to reduce manual review time from 48 hours to <2 hours for standard customers.

---

## Core Features (MVP)

### Feature 1: Customer Identity Verification (CIV) Module

**1.1 Document Upload & OCR**

*User Story:* As a customer service representative, I want to collect government ID and proof of address documents electronically so that I don't have to request physical copies.

**Technical Requirements:**
- Supported formats: PDF, JPG, PNG, TIFF (max 20MB per document)
- Automated document type detection (ID type: passport, national ID, driver's license)
- OCR extraction of key fields: Name, DOB, Expiry date, ID number, Issue country
- Document quality checks: Resolution minimum 300 DPI, all text readable, four corners visible
- Tamper detection: Basic (pixel-level consistency check) - no cryptographic verification in MVP
- Storage: Encrypted S3 bucket, separate from customer profile data, 5-year retention policy

**Acceptance Criteria:**
- Document upload completes in <10 seconds for standard 5MB file
- OCR accuracy >95% for Western European ID formats
- Rejected documents display clear error message (e.g., "Blurry document - retake required")
- Audit trail captures: upload time, document type, OCR confidence score, analyst review timestamp
- Failed OCR triggers manual review workflow (compliance analyst review queue)

**Out of Scope for MVP:**
- Advanced tamper detection (machine learning-based)
- Biometric face matching
- Video identity verification

---

**1.2 Automated Verification Engine**

*User Story:* As a compliance officer, I want automated checks to flag inconsistencies between customer input and document information so that I only manually review high-risk cases.

**Technical Requirements:**
- Match customer-supplied data against OCR extraction:
  - Name (exact + phonetic match, allow 1 character variance)
  - Date of birth (exact match only)
  - Address (street number + postal code match)
- Compare ID expiry against current date (reject if expired >6 months)
- Cross-reference ID number against national ID registry (where API available: Estonia, Lithuania, Latvia)
- Document recency check: Proof of address <3 months old
- Flag for manual review if: Name mismatch, expired ID, inconsistent information

**Acceptance Criteria:**
- Verification completes in <30 seconds per customer
- False positive rate <5% (i.e., valid customers incorrectly flagged)
- Audit log captures each verification check: timestamp, check type, result, confidence score
- Unverified customers cannot proceed to next step (account remains "pending verification")

**Technical Implementation Notes:**
- Use external API: IdentityMind (Europe-focused) or similar for document validation
- Fallback: Manual verification if API unavailable (retry every 5 minutes, max 3 retries)
- Performance: Cache verification results for 24 hours (customer data doesn't change frequently)

---

### Feature 2: Sanctions & PEP Screening

**2.1 Real-Time Screening**

*User Story:* As a compliance manager, I want to automatically screen customers against international sanctions lists and PEP databases before account activation so that we don't onboard restricted individuals.

**Technical Requirements:**
- Screening data sources:
  - OFAC SDN List (US Office of Foreign Assets Control)
  - EU Consolidated Sanctions List
  - UN Security Council Consolidated List
  - World-Check PEP database (third-party subscription)
- Screening occurs: At account creation + Weekly re-screening for active accounts
- Match logic: Full name + DOB + Nationality
  - Exact match: Immediate rejection
  - High-confidence fuzzy match (>85% similarity): Escalate to compliance review
  - Low confidence match (<85%): Log and monitor, no escalation
- Screening timeout: If external API unresponsive >30 seconds, allow account creation but flag for manual review within 2 hours

**Acceptance Criteria:**
- Screening latency <5 seconds per customer (includes network round-trip)
- Zero false negatives (all actual sanctions matches detected)
- False positive rate <2% (i.e., legitimate customers incorrectly flagged)
- Audit trail: Screening timestamp, data source version date, match confidence score, analyst action
- Rejected customers: Automated email with generic "Account application not approved" (do not disclose sanctions reason)

**Third-Party Integration:**
- World-Check API: Realtime screening + bulk re-screening nightly
- License cost: ~$50K/year + per-screening API fees
- Fallback list: Static OFAC/EU lists updated monthly if API unavailable

---

**2.2 PEP Identification & Escalation**

*User Story:* As a senior compliance officer, I want enhanced due diligence triggered automatically when a PEP is identified so that we apply appropriate controls without manual oversight.

**Technical Requirements:**
- PEP definition: Government officials in top 5 ranks + immediate family + known close associates
- Screening includes: Customer name + family member screening (surname matches from application)
- PEP match triggers:
  - Automatic account status: "Pending PEP Review"
  - Escalation: Create task in compliance queue (assigned to senior analyst)
  - Requires: Documented business rationale before account activation
  - Enhanced monitoring: Flag for monthly review instead of quarterly
- PEP re-screening: Quarterly check against updated PEP databases

**Acceptance Criteria:**
- PEP identification at account creation
- Escalation task created within 60 seconds of detection
- Account cannot activate until compliance approval (system enforces)
- Audit trail: PEP match details, source database, approval decision, approver name

---

### Feature 3: Risk Assessment & CDD Level Assignment

**3.1 Automated Risk Scoring**

*User Story:* As a risk analyst, I want a system-generated risk score that recommends CDD level (Standard/Enhanced/Simplified) so that we apply appropriate due diligence proportionate to customer risk.

**Technical Requirements:**
- Risk scoring algorithm: Weighted decision tree (explainable)
  - Customer profile factors (40% weight):
    - Age: <18 (+5 pts), 70+ (+3 pts), 18-70 (+0 pts)
    - Nationality/Residency: High-risk jurisdiction (+8 pts), FATF grey-list (+5 pts), EU/UK (+0 pts)
    - PEP Status: PEP (+15 pts), Family/Associate of PEP (+8 pts), None (+0 pts)
    - Beneficial Ownership: Complex structure >5 layers (+6 pts), Clear ownership (+0 pts)
  - Business profile factors (30% weight):
    - Declared business: Trade finance (+6 pts), Real estate/casinos (+5 pts), Standard (+0 pts)
    - Transaction volume: >$5M/year (+8 pts), $500K-$5M (+4 pts), <$500K (+0 pts)
    - Geographic exposure: High-risk countries (+5-8 pts), EU only (+0 pts)
  - Behavioral factors (30% weight):
    - Documentation completeness: Missing/incomplete (+4 pts), Complete (+0 pts)
    - Sanctions/PEP matches: Any match history (+10 pts), Clean (+0 pts)
    - Previous AML flags: Yes (+8 pts), No (+0 pts)

- Score range: 0-100
  - 0-25: Standard CDD
  - 26-60: Medium CDD (enhanced quarterly monitoring)
  - 61-100: Enhanced CDD (monthly monitoring + senior review)

- Risk score is recommendation only; compliance officer can override

**Acceptance Criteria:**
- Score calculated within 5 seconds of customer profile completion
- All scoring factors displayed to compliance team with rationale
- Risk score adjustable by compliance officer (override logged with reason)
- Score recalculated quarterly (or on customer profile change)
- Audit trail: Risk score version, calculation timestamp, factors used, any manual overrides

**Technical Implementation:**
- Store scoring logic in rules engine (configurable, not hard-coded)
- Score versioning: When business rules change, maintain history (regulators may audit)
- AI considerations: Model must be fully explainable; compliance team must understand every point

---

**3.2 CDD Level Assignment Workflow**

*User Story:* As a compliance officer, I want the CDD level automatically assigned based on risk score so that I can focus manual review only on high-risk cases.

**Technical Requirements:**
- System automatically assigns CDD level based on risk score
- Assignment is recommendation; officer can change with documented reason
- CDD level determines:
  - Required documentation checklist
  - Monitoring frequency (quarterly/monthly)
  - Escalation authority (standard review vs. senior review)
  - Approval timeline (standard review: 24 hours; enhanced: 48-72 hours)
- Customer profile displays current CDD level and reason

**Acceptance Criteria:**
- CDD level assigned before customer can proceed to next step
- Compliance officer can change assignment (change logged)
- All customers assigned a level (no "unknown" status)
- Audit trail: Initial assignment, any changes, timestamp, reason for change

---

### Feature 4: Document Collection & Compliance Checklist

**4.1 Dynamic Document Checklist**

*User Story:* As a customer onboarding agent, I want the system to tell me which documents the customer must provide based on their CDD level so that customers aren't asked for unnecessary documents.

**Technical Requirements:**
- Checklist generated based on CDD level:
  - **Standard CDD:** Government ID + Proof of address
  - **Medium CDD:** Gov ID + Proof of address + Source of funds declaration
  - **Enhanced CDD:** Gov ID + Proof of address + Source of funds + Beneficial ownership documentation + Business rationale
  - **Simplified CDD (where applicable):** ID only (no proof of address required)
  
- Checklist displays to customer in onboarding portal
- Document status tracking: Pending, Received, Verified, Rejected, Re-submission Required
- Auto-progress: Once all checklist items marked "Verified", customer advances to next step
- Re-submission workflow: Rejected documents trigger customer notification with specific reasons (e.g., "Proof of address too old - must be dated within 3 months")

**Acceptance Criteria:**
- Correct checklist generated for customer's CDD level
- No documents marked verified until compliance analyst confirms
- Customer receives email notification for each status change (document rejected, re-submission received, all docs verified)
- Compliance analyst can add manual document requests ("Please provide bank statements for last 3 months")
- Audit trail: Document status changes, analyst notes, upload/verification timestamps

---

### Feature 5: Account Status Workflow & SLAs

**5.1 Account Lifecycle Management**

*User Story:* As a compliance manager, I want visibility into where each customer is in the onboarding process and whether we're meeting regulatory approval timelines so that I can manage workload and ensure compliance.

**Technical Requirements:**
- Account statuses:
  1. "Pending CIV" - Awaiting ID/address verification
  2. "Pending Screening" - Documents received, running sanctions check
  3. "Pending CDD Review" - Screening complete, awaiting risk assessment
  4. "Pending Document Collection" - CDD assigned, awaiting additional documents
  5. "Pending Compliance Approval" - All documents received, awaiting officer sign-off
  6. "Active" - Account approved, can transact
  7. "Rejected" - Application declined, customer notified
  8. "On Hold" - Account suspended pending investigation

- Status transitions:
  - Automated: Pending CIV → Pending Screening (when ID verified) → Pending CDD Review (when screening complete)
  - Manual: Pending Compliance Approval → Active/Rejected (compliance officer decision)

- SLA enforcement:
  - Standard CDD: Approval decision within 24 hours of document receipt
  - Enhanced CDD: Approval decision within 72 hours of document receipt
  - Regulatory requirement: No account activation without verification (no time limit, but compliance best practice is 3-5 days)
  - Escalation: If SLA approaching, task is flagged in compliance queue

**Acceptance Criteria:**
- Account status visible in dashboard for compliance team
- SLA countdown timer displayed for open applications
- SLA violations trigger escalation alert (red flag if deadline within 2 hours)
- Status change audit trail: Timestamp, status, previous status, changed by, reason (if applicable)
- Customer can view application status in self-service portal (generic status, not compliance details)

---

### Feature 6: Ongoing Customer Monitoring

**6.1 Transaction Screening & Monitoring Dashboard**

*User Story:* As a compliance analyst, I want to see all customer transactions screened automatically and flagged for review if they exceed risk thresholds so that I can detect suspicious activity.

**Technical Requirements:**
- Transaction monitoring rules (MVP baseline):
  - Single transaction >€10,000: Log + flag for review if customer is high-risk
  - Cumulative monthly >€50,000: Flag for review
  - Rapid in/out flows (>€5K in, <€100 out within 24 hours): Potential structuring, flag
  - Geographic anomaly: Transaction to high-risk country not in customer's profile: Flag
  - High transaction frequency: >100 transactions/day (threshold configurable): Flag

- Monitoring dashboard displays:
  - Flagged transactions (auto-sorted by risk score)
  - Customer transaction history (last 30/90/365 days)
  - Transaction pattern comparison (baseline vs. current)
  - Analyst action tracking (reviewed, approved, escalated to SAR)

- Escalation to SAR (Suspicious Activity Report):
  - Officer marks transaction as "Suspicious" → Creates SAR
  - SAR template auto-populated with transaction details
  - SAR submitted to Financial Intelligence Unit (FIU) within required timeframe
  - SAR filing confirmation logged

**Acceptance Criteria:**
- Transaction flagged within 30 seconds of posting
- Dashboard shows all flagged transactions with risk reason
- Analyst can add manual notes ("Customer confirmed legitimate business travel")
- False positive rate <10% (i.e., legitimate transactions reviewed)
- SAR filing auditable (timestamp, FIU reference number, contents)

---

**6.2 Periodic Risk Review**

*User Story:* As a compliance officer, I want the system to schedule periodic customer reviews so that we maintain ongoing monitoring and re-assess risk as customers age in portfolio.

**Technical Requirements:**
- Review frequency based on risk level:
  - Standard CDD: Quarterly review
  - Medium CDD: Bi-weekly reviews
  - Enhanced CDD: Monthly reviews
  
- Scheduled review triggers:
  - Automated email to assigned analyst: "Customer review due: [Customer Name]"
  - Review checklist: Transaction activity summary, any flags, risk profile changes, continued relationship justification
  - Review action: Accept (no changes), Update risk score, Escalate to senior review, Close account

- Profile change triggers:
  - If customer changes business type, occupation, beneficial ownership → Immediate risk re-assessment
  - If customer sanctioned during monitoring → Immediate account freeze + SAR filing

**Acceptance Criteria:**
- Review notifications sent 5 days before due date
- Compliance analyst cannot dismiss review (must complete or escalate)
- All reviews documented with analyst comments and approval
- Profile changes trigger automated re-assessment within 24 hours
- Audit trail: Review completed date, findings, action taken, approver

---

## Non-Functional Requirements

### Performance
- Page load time: <3 seconds (dashboard, customer search)
- Transaction flagging: <30 seconds from transaction posting
- Screening response: <5 seconds per customer
- Concurrent users: Support 50 concurrent compliance analysts minimum

### Security & Privacy
- Data encryption: At-rest (AES-256), in-transit (TLS 1.2+)
- Access control: Role-based (analyst, compliance officer, admin)
- Audit logging: All user actions logged (view, update, export) with timestamp + user ID
- Data retention: 5 years post-account closure (regulatory requirement)
- PII handling: Sensitive fields (ID number, DOB) masked in UI unless analyst has explicit permission
- GDPR compliance: Customer data deletion available upon account closure (except audit trail)

### Compliance & Audit
- Regulatory reporting: Built-in SAR/CTR templates + FIU submission tracking
- Audit trail: All decisions logged with timestamp, user, and rationale
- Document retention: Digital storage with 10-day retrieval SLA for regulator requests
- Explainability: All automated decisions (risk scoring, screening) must be explainable to compliance team
- EU AI Act: If ML/AI used for decisions, model must meet transparency requirements

### Scalability
- Database: PostgreSQL, optimized for compliance queries (indexed on customer ID, transaction date, risk score)
- Caching: Redis for screening data (OFAC lists cached, refreshed hourly)
- Archival: Historical data (>2 years old) archived to cold storage (cost optimization)

---

## Success Metrics (MVP)

| Metric | Target | Measurement |
|---|---|---|
| Onboarding completion time | <2 hours for standard customers | Timestamp from application start to account active |
| Manual review reduction | 80% of standard cases auto-approved | Cases marked "Approved" without manual escalation |
| Verification accuracy | >95% OCR accuracy, <5% false rejections | Audit sample: 100 random documents per month |
| Compliance SLA | 100% of applications reviewed within SLA | Cases within/outside SLA tracked daily |
| False positive rate (screening) | <2% | Cases flagged but later cleared / total screening matches |
| Audit trail completeness | 100% of decisions logged | Random audits of 20 cases per month |

---

## Phased Rollout

**Phase 1 (MVP):** Core onboarding + screening + risk assessment  
**Phase 2:** Advanced monitoring + behavioral analytics  
**Phase 3:** Biometric verification + video identity + advanced fraud detection  
**Phase 4:** Predictive risk modeling + integrated third-party data services  

---

## Regulatory References

- **FATF Recommendation 10:** Customer Due Diligence
- **AML5 Directive (EU):** Article 13 (CDD), Article 15 (Enhanced CDD)
- **PSD2 (EU):** Strong Customer Authentication + Fraud Prevention
- **MiFID II:** Customer knowledge requirements
- **Wolfsberg:** Customer Risk Rating & Due Diligence Standards
- **EU AI Act:** Transparency, explainability for high-risk AI decisions

---

## Open Questions & Assumptions

**Assumptions:**
- Regulatory approval timeline: Authorities will accept this approach as compliant (assume yes pending legal review)
- Third-party API availability: Assume sanctions screening APIs available in all target jurisdictions
- Customer data quality: Assume 70% of customers provide correct information initially (30% require re-submission)

**Open Questions:**
- Should we support video identity verification in MVP or Phase 2? (Business/Product decision)
- What's the approved process for SAR filing? (Confirm with compliance legal team)
- Do we need to support multiple languages for documents? (Assume English/German initially for MVP)
- Will regulators pre-approve our risk scoring algorithm or do we need to submit it? (Pending legal review)
