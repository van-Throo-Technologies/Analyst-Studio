# B2B SaaS Platform — Compliance Requirements Brief
## SOC 2 Trust Services Criteria and CCPA/CPRA Obligations

**Document Type:** Compliance Requirements Summary
**Audience:** Engineering & Product Teams
**Effective Date:** 2024
**Frameworks:** SOC 2 Type II (Security, Availability, Confidentiality), CCPA as amended by CPRA, GDPR, ISO 27001

> Note: this brief paraphrases control objectives in the organisation's own words. The AICPA Trust Services Criteria themselves are copyrighted and are not reproduced here.

---

## Executive Summary

This document sets out the compliance requirements for a multi-tenant B2B SaaS platform pursuing a SOC 2 Type II report and subject to California privacy law. Requirements derive from:

- SOC 2 Trust Services Criteria: Security (required), Availability, Confidentiality
- California Consumer Privacy Act as amended by the California Privacy Rights Act
- GDPR, where the platform processes personal data of EU data subjects
- ISO 27001 Annex A, where enterprise customers require it contractually

A Type II report covers a period, typically 6 or 12 months. Controls must not only exist but be shown to have operated consistently throughout. Evidence gathered after the fact is not evidence.

---

## Core Requirements

### 1. Access Control and Provisioning

**1.1 Principle**
Access to production systems and customer data is granted on least privilege and removed promptly when no longer required.

**1.2 Implementation**
- Single sign-on for all internal access; local accounts prohibited except for documented break-glass
- Multi-factor authentication required for production access without exception
- Access requests approved by the system owner, never self-approved
- Quarterly access reviews covering every production system
- Deprovisioning within 24 hours of termination; immediate for involuntary termination

**1.3 Evidence Required for Type II**
- Ticket for every access grant, showing requester, approver and business justification
- Quarterly review artefacts with reviewer identity and date, for every quarter in the period
- Termination records matched against deprovisioning timestamps, showing the gap for each

### 2. Change Management

**2.1 Requirement**
Changes to production are authorised, tested and traceable.

**2.2 Implementation**
- All production changes originate from version control; no direct edits
- Peer review required before merge; the author may not approve their own change
- Automated tests must pass before deployment
- Emergency changes permitted, with retrospective review within 3 business days
- Rollback plan documented for changes affecting data structure

**2.3 Evidence Required**
- Pull request history showing reviewer identity, for a sample across the period
- Deployment log tied to the change that produced it
- Emergency change register with retrospective approvals

### 3. Availability and Resilience

**3.1 Commitments**
- Uptime commitment 99.9% monthly, measured excluding scheduled maintenance
- Scheduled maintenance announced at least 5 business days in advance
- Recovery time objective 4 hours; recovery point objective 1 hour

**3.2 Implementation**
- Automated backups daily, retained 35 days
- Restore tested quarterly against a real restore, not a checksum
- Monitoring with alerting to an on-call rota, 24/7
- Incident severity levels defined, with response time targets per level

**3.3 Evidence Required**
- Uptime reports for every month in the period
- Restore test records, quarterly, with the date and outcome
- Incident records showing detection time, response time and resolution

### 4. Confidentiality and Tenant Isolation

**4.1 Requirement**
One customer's data must be inaccessible to another, and to staff without a business need.

**4.2 Implementation**
- Tenant identifier enforced at the data access layer, not in application code paths alone
- Encryption at rest AES-256; in transit TLS 1.2 minimum
- Production data must not be copied into non-production environments
- Where production-like data is required for testing, it must be anonymised before it leaves production

**4.3 Evidence Required**
- Penetration test report covering tenant isolation, at least annually
- Evidence that non-production environments contain no production data
- Encryption configuration evidence at a point in time within the period

### 5. Vendor and Subprocessor Management

**5.1 Requirement**
Vendors handling customer data are assessed before use and reviewed annually.

**5.2 Implementation**
- Security review before contract signature for any vendor processing customer data
- SOC 2 report or equivalent collected and reviewed annually
- Subprocessor list published and maintained; customers notified 30 days before a new subprocessor is engaged
- Data processing agreement in place before any personal data is shared

### 6. CCPA and CPRA Obligations

**6.1 Scope**
Applies where the business meets the revenue or data volume thresholds and handles personal information of California residents. As a service provider, contractual restrictions apply in addition.

**6.2 Consumer Rights**
- Right to know: categories and specific pieces of personal information collected, in the 12 months preceding the request
- Right to delete: subject to exceptions including legal obligation and security
- Right to correct inaccurate personal information
- Right to opt out of sale or sharing for cross-context behavioural advertising
- Right to limit use of sensitive personal information
- Right to non-discrimination for exercising any of these

**6.3 Response Timelines**
- Confirm receipt within 10 business days
- Substantive response within 45 calendar days, extendable once by a further 45 days with notice
- Two free requests per consumer per 12-month period

**6.4 Verification**
- Identity verified to a reasonable degree of certainty; higher certainty for deletion than for a request to know categories
- A password-protected account may be used for verification where the request comes through it

**6.5 Service Provider Restrictions**
- Personal information may be used only to perform the services in the contract
- No sale of personal information
- No combining with information from other sources except as permitted
- Obligation to assist the customer in responding to consumer requests

### 7. Incident Response and Breach Notification

**7.1 Incident Handling**
- Severity classification within 1 hour of detection
- Customer notification for incidents affecting their data, per contractual timelines, commonly 72 hours or less
- Post-incident review within 10 business days, with actions tracked to closure

**7.2 CCPA Breach Exposure**
- Statutory damages available for unauthorised access to unencrypted, unredacted personal information where reasonable security was not maintained
- Encryption is therefore both a control and a liability limit

**7.3 GDPR Notification**
- Supervisory authority within 72 hours where a risk to rights and freedoms exists
- Data subjects without undue delay where the risk is high

### 8. Logging and Monitoring

**8.1 Requirement**
Security-relevant events are logged, retained and reviewed.

**8.2 Implementation**
- Authentication events, authorisation failures, privilege changes and data exports logged
- Logs retained 12 months minimum, with 90 days immediately searchable
- Alerting on privileged access outside change windows
- Log integrity protected; application roles cannot alter historical entries

---

## Compliance Obligations Summary

| Requirement | Timing | Responsibility | Evidence Required |
|---|---|---|---|
| Access provisioning | Before first login | System owner | Yes — ticket and approver |
| Access review | Quarterly | System owner | Yes — reviewer and date |
| Deprovisioning | 24 hours | People operations | Yes — termination to revocation gap |
| Change review | Before merge | Engineering | Yes — reviewer identity |
| Restore test | Quarterly | Platform operations | Yes — date and outcome |
| Vendor review | Annually | Security | Yes — report and reviewer |
| CCPA request receipt | 10 business days | Privacy | Yes — acknowledgement |
| CCPA substantive response | 45 days, one extension | Privacy | Yes — response and date |
| Incident classification | 1 hour | On-call | Yes — severity and time |
| Customer notification | Per contract, often 72 hours | Security | Yes — notice and recipients |

---

## Risk Tiers

**Low:** Aggregate product telemetry with no identifiers
**Moderate:** Customer account and usage data, business contact information
**High:** Customer end-user personal information processed on the customer's behalf
**Critical:** Sensitive personal information under CPRA — precise geolocation, government identifiers, account credentials

Risk tier determines encryption, access approval depth and retention.

---

## Success Criteria for Implementation

1. No production access without SSO and multi-factor authentication
2. Quarterly access reviews evidenced for every quarter in the audit period
3. Deprovisioning within 24 hours, measured with no unexplained gaps
4. Restore tested quarterly with a real restore
5. CCPA requests acknowledged within 10 business days, answered within 45
6. Subprocessor list current, with 30 days' notice before any addition
7. Logs retained 12 months, tamper-evident, and searchable for the recent 90 days
