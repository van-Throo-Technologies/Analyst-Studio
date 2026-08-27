# Financial Services KYC Process - Mock Case Study

## Overview

This mock case represents a realistic Know Your Customer (KYC) platform implementation scenario for a European Trade Finance Bank (ETFB). The case includes three source documents that simulate real-world requirements gathering from a financial services organization implementing a digital KYC/AML compliance solution.

**Case Complexity Level:** Medium-High (3+ document types, regulatory + technical + business perspectives)

---

## Documents Included

### 1. Regulatory Requirements (`1-regulatory-requirements.md`)
**Type:** Compliance framework / regulatory brief  
**Source Type:** Regulatory interpretation document  
**Length:** ~2,500 words  

**Content:**
- Regulatory frameworks: FATF 40 Recommendations, AML5 Directive, PSD2, Wolfsberg Standards
- Core KYC requirements: Customer identification (CIV), customer due diligence (CDD), beneficial ownership
- Screening requirements: Sanctions lists, PEP management, high-risk jurisdictions
- Ongoing monitoring: Transaction monitoring, periodic reviews, suspicious activity reporting
- Compliance obligations table with timing and responsibility
- Risk assessment scoring methodology
- EU AI Act considerations
- Success criteria for compliance

**Testing Purpose:**
- Extract non-functional requirements (compliance obligations, regulatory constraints)
- Identify quality gates and acceptance criteria
- Recognize regulatory risk factors and business rules
- Test ability to categorize regulatory vs. technical requirements

---

### 2. Technical Requirements (`2-technical-requirements.md`)
**Type:** Product Requirements Document (PRD)  
**Source Type:** Technical specification  
**Length:** ~4,000 words  

**Content:**
- Product vision and core features (6 major features):
  1. Customer Identity Verification (CIV) module
  2. Sanctions & PEP Screening
  3. Risk Assessment & CDD Level Assignment
  4. Document Collection & Compliance Checklist
  5. Account Status Workflow & SLAs
  6. Ongoing Customer Monitoring
- Detailed user stories with acceptance criteria
- Non-functional requirements: Performance, security, compliance, scalability
- Success metrics and KPIs
- Phased rollout plan
- Regulatory references
- Open questions and assumptions

**Testing Purpose:**
- Extract functional requirements from user stories
- Identify acceptance criteria and success metrics
- Recognize performance and security requirements
- Test ability to distinguish MVP features from future phases
- Extract technical constraints and dependencies

---

### 3. Business Scenario (`3-business-scenario.md`)
**Type:** Business requirements / implementation case study  
**Source Type:** Business context and customer personas  
**Length:** ~3,500 words  

**Content:**
- Company context (European Trade Finance Bank profile)
- Customer personas (4 types with varying KYC complexity)
- Regulatory requirements specific to business model:
  - Sanctions screening intensity
  - High-risk jurisdiction controls
  - PEP management in trade finance context
  - Correspondent banking AML/CFT standards
- Operational requirements: Processing volumes, staffing, integration points
- Compliance & risk considerations
- Success criteria (business, regulatory, operational)
- Implementation timeline
- Open business questions

**Testing Purpose:**
- Extract business rules and process flows from customer scenarios
- Identify stakeholders and decision makers
- Recognize operational constraints and volume considerations
- Test ability to extract use cases from personas
- Extract regulatory context specific to business domain

---

## Key Characteristics for Testing

### Regulatory Complexity
- Multiple regulatory frameworks referenced (FATF, AML5, PSD2, Wolfsberg, MiFID II, EU AI Act)
- Complex requirements (e.g., "Must screen customers AND suppliers AND transaction counterparties")
- Conflicting priorities (speed vs. thoroughness)
- Changing regulations (FATF evaluations, list updates)

### Technical Depth
- Specific technology mentions (PostgreSQL, OCR, API integrations)
- Performance requirements with quantified targets
- Security constraints (encryption, access control, audit logging)
- Scalability considerations (concurrent users, transaction volume)

### Business Context
- Multiple customer personas with different risk profiles
- Domain-specific language (trade finance, correspondent banking, structuring)
- Operational constraints (team size, volume)
- Regulatory audit considerations

### Compliance Requirement Extraction
Documents include:
- **7 major functional features** to extract from PRD
- **3+ non-functional requirement categories** (performance, security, compliance)
- **15+ acceptance criteria** to identify
- **5+ business rules** embedded in scenarios
- **4+ integration points** to map
- **8+ regulatory constraints** to recognize
- **3+ open questions** to surface (gaps/assumptions)

---

## How to Use This Mock Case

### Step 1: Upload to Analyst Studio
1. Navigate to your project in Analyst Studio
2. Click "Upload Documents"
3. Upload all 3 markdown files:
   - `1-regulatory-requirements.md`
   - `2-technical-requirements.md`
   - `3-business-scenario.md`
4. Wait for upload confirmation

### Step 2: Run Extraction
1. Click "Extract Requirements" button
2. Observe extraction progress
3. Review extracted requirements

### Step 3: Validate Extraction Quality
Look for:

**Expected Functional Requirements:**
- ✅ Customer Identity Verification (CIV) module
- ✅ Automated verification engine
- ✅ Sanctions & PEP screening
- ✅ Real-time screening
- ✅ Risk Assessment & CDD Level Assignment
- ✅ Dynamic document checklist
- ✅ Account status workflow & SLAs
- ✅ Transaction monitoring & screening
- ✅ Periodic risk review

**Expected Non-Functional Requirements:**
- ✅ Performance: Page load <3s, screening <5s, flagging <30s
- ✅ Security: AES-256 encryption, RBAC, audit logging
- ✅ Compliance: GDPR, EU AI Act, regulatory audit trails
- ✅ Scalability: 50 concurrent analysts, support 500+ new customers/month

**Expected Use Cases:**
- ✅ Standard SME customer onboarding (low complexity, 4-hour approval)
- ✅ International trader onboarding (medium complexity, 8-12 hour approval)
- ✅ Multinational corporation onboarding (high complexity, 12-24 hour approval)
- ✅ Correspondent banking relationship setup (extreme complexity, 2-7 day approval)
- ✅ Suspicious transaction detection & SAR filing

**Expected Acceptance Criteria Examples:**
- ✅ "Document upload completes in <10 seconds"
- ✅ "False positive rate <5%"
- ✅ "SLA violations trigger escalation alert"
- ✅ "Zero accounts opened without complete verification"
- ✅ "All scoring factors displayed with rationale"

**Expected Business Rules:**
- ✅ Risk score 0-25 = Standard CDD, 26-60 = Medium CDD, 61-100 = Enhanced CDD
- ✅ Single transaction >€10K = flag for review
- ✅ PEP match = mandatory escalation to senior officer
- ✅ Sanctions match = automatic account freeze + SAR filing
- ✅ CDD level determines documentation checklist

**Expected Regulatory Constraints:**
- ✅ Verification must complete BEFORE account activation
- ✅ Documents retained minimum 5 years post-account closure
- ✅ SAR filing within regulatory timeline (5 working days in EU)
- ✅ Remote onboarding requires liveness check
- ✅ AI decisions must be explainable and subject to human review

---

## Validation Questions (For Testing Extraction Accuracy)

After extraction, check:

1. **Completeness:** Did the extraction capture all 6+ major features from the PRD?
2. **Prioritization:** Were must-have requirements (verification, screening) marked higher priority than nice-to-have (advanced ML features)?
3. **Regulatory sensitivity:** Did the extraction flag the EU AI Act requirements as non-functional constraints?
4. **Acceptance criteria mapping:** Are acceptance criteria correctly linked to their parent requirements?
5. **Use case extraction:** Did personas in the business scenario become use cases/scenarios?
6. **Business rule extraction:** Were business rules from the scenario explicitly identified (not just buried in description)?
7. **Risk flag accuracy:** Did the extraction identify high-risk items (PEP, sanctions, correspondent banking as complexity drivers)?
8. **Gap identification:** Did the extraction surface the open questions listed in each document?

---

## Expected Extraction Results Summary

| Category | Count | Examples |
|---|---|---|
| Functional Requirements | 9+ | CIV module, Screening, Risk assessment, Monitoring |
| Non-Functional Requirements | 4+ | Performance, Security, Compliance, Scalability |
| Use Cases | 5+ | SME onboarding, Trader onboarding, SAR filing, Risk review |
| Acceptance Criteria | 15+ | Latency targets, false positive rates, SLA compliance |
| Business Rules | 8+ | Risk scoring thresholds, monitoring frequencies, escalation rules |
| Regulatory Constraints | 10+ | FATF, AML5, PSD2, Wolfsberg, EU AI Act requirements |
| Integrations/Dependencies | 4+ | Core banking, Payment system, Sanctions APIs, Reporting system |
| Open Questions/Gaps | 8+ | Video ID support, Auto-approval rules, Geographic expansion |

---

## Notes on Realism

This mock case is intentionally realistic to test extraction accuracy:

- **Document length & complexity:** Real financial services requirements are typically spread across multiple documents with redundancy and cross-references
- **Regulatory language:** Uses actual regulation names and framework references (FATF, AML5, PSD2) that appear in real requirements
- **Technical depth:** Includes specific performance targets, API references, and architectural constraints found in real PRDs
- **Business context:** Includes real customer personas and operational constraints (staffing sizes, transaction volumes, timeline pressures)
- **Ambiguity:** Some requirements are intentionally ambiguous ("robust AML procedures") requiring inference
- **Gaps:** Intentional open questions representing decisions not yet made in real organizations

This reflects the messy nature of actual discovery documents that Analyst Studio is designed to parse.

---

## Industry Rules Engine Validation

This mock case should be used to validate Financial Services industry-specific rules:

**Rules to test:**
1. PEP detection triggers mandatory escalation (rule enforcement)
2. Sanctions match triggers automatic account freeze (rule enforcement)
3. Risk score calculation (8 factors, specific weights) (rule engine logic)
4. CDD level assignment based on score (decision tree) (rule logic)
5. Transaction monitoring thresholds (€10K single, €50K monthly) (rule logic)
6. Correspondent banking requires 2-person approval (access control rule)
7. Re-screening frequency varies by risk level (rule schedule)

---

## Next Steps After Validation

Once extraction from this KYC case is validated as accurate:

1. **Create additional financial services mock cases:**
   - Loan origination platform
   - Payment fraud detection system
   - Insurance underwriting platform

2. **Create mock cases for other industries:**
   - Healthcare: Clinical trial management (regulatory + clinical complexity)
   - Software/SaaS: Collaborative AI platform (feature + integration complexity)
   - E-Commerce: Multi-channel marketplace (operational + integration complexity)
   - Manufacturing: Supply chain visibility (operational + regulatory complexity)

3. **Validate industry rules engines** against each case

4. **Test extraction pipeline accuracy** across all cases before proceeding with Feature 1 implementation

---

## Technical Details

**File format:** Markdown (.md)  
**Total content:** ~10,000 words across 3 files  
**Intended upload sequence:** All three files uploaded together to extraction pipeline  
**Processing time:** Estimate 2-3 minutes for Claude Opus to extract from all three documents  
**Expected extraction confidence:** High (regulatory language is explicit; user stories have clear acceptance criteria)  
