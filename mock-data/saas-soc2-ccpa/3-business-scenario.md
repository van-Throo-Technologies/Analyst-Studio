# Business Requirements: Enterprise Readiness Programme
## Customer Scenario & Use Case Document

**Prepared by:** Go-to-Market and Trust
**Client:** Northwind Collaboration (internal programme)
**Scenario Type:** Implementation case study
**Date:** October 2024

---

## Executive Summary

Northwind sells a collaboration platform to mid-market and enterprise customers. It is losing deals at the security review stage: three of the last eight enterprise opportunities stalled because there was no SOC 2 Type II report, and two required a CCPA data processing addendum the team could not sign as written.

The programme exists to make the platform sellable to enterprise buyers. The measure is not the certificate; it is the time it takes to clear a customer security review, currently 6 to 11 weeks.

---

## Company Context

**Northwind Profile:**
- 140 employees, 38 in engineering
- 2,400 customer organisations, from 5 seats to 4,000
- Revenue mix shifting: enterprise was 12% of new business two years ago, 41% now
- Data residency: single US region today; EU customers asking for an EU region
- No formal security function until nine months ago; now two security engineers and a compliance manager

**Compliance Environment:**
- SOC 2 Type II required by most enterprise buyers, with a 12-month observation period expected
- CCPA applies: California residents in customer end-user populations, and Northwind meets the revenue threshold
- GDPR applies to EU customers, currently handled through standard contractual clauses
- Two customers have asked about ISO 27001; not yet committed
- Annual penetration test required by four enterprise contracts

---

## Personas and Compliance Complexity

### Persona 1: Self-Serve Small Team (61% of customers, 8% of revenue)
**Profile:**
- 5-50 seats, credit card purchase, no procurement
- No security review; they click through the terms
- Support contact: whoever set up the account
- Data: business contact information and content they upload

**Compliance Complexity:** Low
- Standard terms accepted at signup
- No data processing addendum negotiated
- Risk factors: none unusual, but they are the majority of the support impersonation volume
- Expected onboarding: minutes
- Compliance story: none, until one of them becomes a CCPA requester

**Business Process:**
1. Sign up with email, verify, pay by card
2. Accept standard terms including the privacy notice
3. Begin using the product immediately
4. Support impersonation used freely for troubleshooting, currently without a ticket requirement

---

### Persona 2: Mid-Market Buyer (28% of customers, 34% of revenue)
**Profile:**
- 50-500 seats, procurement involved, a security questionnaire
- Questionnaire typically 80-150 questions, sent as a spreadsheet
- Decision makers: IT director and a procurement analyst
- Data: employee personal information, uploaded documents, sometimes customer data of their own

**Compliance Complexity:** Moderate
- Security questionnaire answered manually, taking 8-15 hours per deal
- Data processing addendum usually the buyer's paper, requiring legal review
- Risk factors: inconsistent answers across questionnaires, because they are answered from memory
- Expected timeline: 2-4 weeks from questionnaire to signature
- Monitoring: none specific after signature

**Business Process:**
1. Sales sends the questionnaire to the compliance manager
2. Compliance manager assembles answers, chasing engineers for specifics
3. Legal reviews the buyer's data processing addendum
4. Redlines exchanged, typically two rounds
5. Contract signed, account provisioned
6. No further compliance interaction until renewal

---

### Persona 3: Enterprise Buyer (11% of customers, 58% of revenue)
**Profile:**
- 500-4,000 seats, formal vendor risk management
- Requires SOC 2 Type II report before signature, no exceptions
- Decision makers: CISO, procurement, legal, and a business sponsor
- Data: employee personal information at scale, and content subject to their own regulatory obligations

**Compliance Complexity:** High
- SOC 2 Type II report requested before technical evaluation begins
- Subprocessor list reviewed, with a right to object to additions
- Annual penetration test summary required
- Right to audit clause negotiated in most contracts
- Incident notification window commonly 24 to 72 hours, shorter than the regulatory minimum
- Expected timeline: 6-11 weeks, and this is where deals stall
- Monitoring: annual reassessment, plus notification obligations throughout

**Business Process:**
1. Business sponsor identifies the need; procurement opens a vendor risk assessment
2. Security review requests SOC 2 Type II, penetration test summary, subprocessor list
3. Absence of a Type II report halts the process; a Type I is accepted only rarely and with conditions
4. Architecture review with the customer's security team
5. Data processing addendum and security exhibit negotiated
6. Contract signed with notification and audit obligations
7. Annual reassessment, and notification of any subprocessor change 30 days ahead

---

### Persona 4: Regulated Enterprise Buyer (under 1% of customers, highest requirements)
**Profile:**
- Financial services or healthcare organisations using the platform internally
- Their own regulator's expectations flow down into Northwind's contract
- Decision makers: CISO, compliance, and often an external auditor

**Compliance Complexity:** Extreme
- SOC 2 Type II plus evidence of specific controls beyond the report
- Data residency commitments, with EU or in-country requirements
- Customer-managed encryption keys requested; not currently supported
- Incident notification as short as 24 hours
- Right to audit exercised in practice, not just contractually
- Expected timeline: 3-6 months
- Monitoring: continuous, with quarterly reviews and annual on-site or remote audit

**Business Process:**
1. Referral or outbound; relationship-led rather than self-serve
2. Preliminary compliance conversation before any technical work
3. Gap assessment against the customer's control expectations
4. Remediation commitments, sometimes with contractual deadlines
5. Executive sponsorship on both sides
6. Contract with audit rights, notification windows and residency commitments
7. Ongoing: quarterly review, annual audit, immediate notification of material change

---

## Requirements Specific to Northwind's Situation

### The Evidence Problem
**Challenge:** A Type II report covers a period. Controls must be shown to have operated throughout it, and Northwind has been collecting evidence at the end.

**Business impact:**
- Six weeks of engineering and compliance time consumed at audit
- A quarter with a missed access review cannot be fixed retrospectively; it becomes an exception in the report
- An exception in the report is a question in every subsequent customer security review

**Implementation requirement:**
- Evidence collected continuously and automatically, tied to the control it evidences
- Missing periods surfaced within days of the period closing, not at audit
- Evidence immutable once collected

### Support Impersonation Without a Ticket
**Challenge:** Support engineers can currently enter any account. It is efficient, and it is the single control most likely to fail an enterprise review.

**Business impact:**
- Cannot answer "who can see our data and under what circumstances" honestly today
- One enterprise deal specifically asked for customer-visible impersonation logs
- Self-serve customers generate most impersonation volume, so a blanket restriction would hurt support

**Implementation requirement:**
- Impersonation tied to a customer-linked ticket
- Read-only by default; write requires a second approver
- Customer-visible log for every session
- Actions attributed to the engineer, not the customer

### Questionnaire Fatigue
**Challenge:** The same 100 questions arrive in a different spreadsheet each time, answered from memory by whoever is free.

**Business impact:**
- 8-15 hours per mid-market deal
- Inconsistent answers between deals, which is itself a finding when a customer notices
- Answers drift from reality as the platform changes

**Implementation requirement:**
- Answers maintained centrally against the control they describe
- Answer updated when the control changes, not when a questionnaire arrives
- Evidence linked to each answer so a claim can be substantiated

---

## Operational Volumes

- Customer organisations: 2,400
- Internal users with production access: 31
- Access grants per month: 40-70
- Support impersonation sessions per month: 900-1,400
- CCPA requests per month: 3-12, rising
- Security questionnaires per month: 6-14
- Deployments per week: 30-60
- Incidents per month: 2-6, of which 0-1 are customer-affecting

**Operational constraint:** two security engineers and one compliance manager. Anything requiring sustained manual effort will lapse, and a lapsed control is worse than an absent one because it appears in the report as an exception.

---

## Success Criteria

**Business metrics:**
1. Enterprise security review cleared in under 3 weeks, from 6-11
2. Questionnaire response time under 2 hours per deal, from 8-15
3. Zero deals lost for absence of a Type II report
4. Subprocessor notifications issued 30 days ahead, every time

**Compliance metrics:**
1. Evidence present for every control for every period in the audit window
2. Zero exceptions in the first Type II report
3. Deprovisioning within 24 hours, measured with no unexplained gaps
4. CCPA requests acknowledged within 10 business days and answered within 45

**Operational metrics:**
1. Uptime 99.9% monthly
2. Restore tested quarterly with a verified real restore
3. Impersonation sessions 100% ticket-linked

---

## Open Business Questions

1. When does the Type II observation period start — at implementation, or when evidence collection is demonstrably continuous?
2. Do we honour Global Privacy Control for every user, or only where CCPA applies?
3. Is a customer-visible impersonation log real time, or delayed to avoid revealing an active investigation?
4. Do we commit to customer-managed encryption keys for regulated buyers, and if so on what timeline?
5. Which subprocessor changes require the 30-day notice, and which are routine enough to notify after the fact?
