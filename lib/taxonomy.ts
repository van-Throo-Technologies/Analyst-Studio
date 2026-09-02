/**
 * The tag and framework vocabulary, per industry.
 *
 * Split into shared and industry-specific deliberately. A rule about retention
 * or access control is the same kind of concern whether it comes from HIPAA,
 * AML5 or SOC 2, and someone auditing "how do we handle retention across the
 * business" needs one query that spans all three. A rule about break-glass
 * access to a patient record is not that; it belongs to healthcare and nowhere
 * else.
 *
 * Shared tags are the cross-industry query surface. Keeping them identical
 * across industries is what makes ?tag=Privacy meaningful — if healthcare said
 * "Privacy" and SaaS said "DataProtection" the query would silently miss half
 * the corpus.
 *
 * No "server-only": the extraction scripts, the seed and the UI all read this.
 */

/** Concerns every industry has. The cross-industry query surface. */
export const SHARED_TAGS = [
  "Privacy",
  "Retention",
  "Monitoring",
  "Escalation",
  "Risk",
  "Reporting",
  "Performance",
  "Documents",
  "Audit",
  "Encryption",
  "AccessControl",
  "Consent",
  "IncidentResponse",
  "VendorManagement",
] as const;

/** Concerns that belong to one industry and would be noise in the others. */
export const INDUSTRY_TAGS: Record<string, readonly string[]> = {
  "financial-services": [
    "CDD",
    "Sanctions",
    "PEP",
    "KYC",
    "AML",
    "Beneficial",
    "Enhanced",
    "Screening",
    "Transactions",
  ],
  healthcare: [
    "PHI",
    "MinimumNecessary",
    "PatientRights",
    "BreakGlass",
    "Disclosure",
    "Deidentification",
    "SubstanceUse",
    "Psychotherapy",
  ],
  "software-saas": [
    "TenantIsolation",
    "ChangeManagement",
    "Availability",
    "ConsumerRights",
    "OptOut",
    "Evidence",
    "Impersonation",
    "Subprocessor",
  ],
  ecommerce: ["Payments", "Fulfilment", "Returns", "Marketplace", "Fraud"],
  manufacturing: ["Supply", "Quality", "Safety", "Traceability", "Environmental"],
};

/** The regulations each industry answers to. */
export const INDUSTRY_FRAMEWORKS: Record<string, readonly string[]> = {
  "financial-services": ["FATF", "AML5", "PSD2", "MiFID", "Wolfsberg", "EU-AI-Act", "GDPR", "OFAC"],
  healthcare: ["HIPAA-Privacy", "HIPAA-Security", "HITECH", "42-CFR-Part-2", "GDPR"],
  "software-saas": ["SOC2", "CCPA", "CPRA", "GDPR", "ISO27001"],
  ecommerce: ["PCI-DSS", "CCPA", "GDPR", "Consumer-Rights-Directive"],
  manufacturing: ["ISO9001", "ISO14001", "REACH", "RoHS", "OSHA"],
};

export function tagsFor(industry: string): string[] {
  return [...SHARED_TAGS, ...(INDUSTRY_TAGS[industry] ?? [])];
}

export function frameworksFor(industry: string): string[] {
  return [...(INDUSTRY_FRAMEWORKS[industry] ?? [])];
}

export function isSharedTag(tag: string): boolean {
  return (SHARED_TAGS as readonly string[]).includes(tag);
}
