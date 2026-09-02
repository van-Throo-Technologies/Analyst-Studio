# Healthcare (HIPAA) — Source Documents

## Provenance

Mixed, deliberately. A real engagement looks like this: a regulation nobody
controls, plus the organisation's own documents.

| Document | Source | Status |
|---|---|---|
| `1-hipaa-privacy-rule-summary.md` | HHS Office for Civil Rights, "Summary of the HIPAA Privacy Rule" (OCR Privacy Brief, last revised 05/03) | **Real.** Work of the US Government, public domain |
| `2-technical-requirements.md` | Written for this repository | Synthetic |
| `3-business-scenario.md` | Written for this repository | Synthetic |

The HIPAA summary is transcribed from the OCR PDF. Its narrative body is
reproduced in full; the endnotes, which are almost entirely CFR citations, are
omitted except for three that carry substantive definitions — the Safe Harbor
identifier list, the limited data set exclusions, and the definition of
psychotherapy notes — which are kept as appendices.

Meridian Regional Health, its four hospitals and its 31 clinics do not exist.
The volumes, personas and open questions in documents 2 and 3 were written to
exercise extraction, not to describe a real organisation.

## What is not here, and why

**HIPAA Security Rule Summary** — also public domain, also worth having. Not
included because it has not been supplied. Adding it would strengthen the
Encryption, AccessControl and Audit tags, which currently lean on the
synthetic documents.

**SOC 2 Trust Services Criteria** — AICPA copyright. Cannot be redistributed
in this repository. The SaaS case paraphrases control objectives in its own
words rather than reproducing the criteria.

**ISO 27001** — a paid ISO standard. Same reason.

## Usage

    npx tsx scripts/extract-documents.ts --dir mock-data/healthcare-hipaa \
      --industry healthcare --out extracted-healthcare.json --dry-run

Drop `--dry-run` to extract for real. Then:

    npx tsx scripts/import-extraction.ts --write --input extracted-healthcare.json \
      --name "Healthcare (HIPAA)" --industry healthcare
    npx tsx scripts/seed-rulebase.ts --project "Healthcare (HIPAA)"
