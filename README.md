# Analyst Studio

Turn raw discovery material into a BA pack or FA pack in minutes, with traceability and quality checks.

Analyst Studio is a structured analysis workspace, not a document generator. You paste in workshop
notes, transcripts, emails and briefs; AI extracts structured insights; you review and edit them
into a canonical requirement model; and both pack types are generated from that model.

The core design commitment: **packs are assembled from entities, not written by a prompt.** Every
requirement, business rule, use case and acceptance criterion in an exported pack is copied verbatim
from what you reviewed, with its reference code intact. AI writes only the connective prose. A pack
cannot contain a requirement that is not in the model.

---

## Getting started

```bash
npm install
cp .env.example .env          # then add your ANTHROPIC_API_KEY
npm run db:migrate            # creates prisma/dev.db
npm run db:seed:users         # seven development users, one per role
npm run db:seed               # a worked example project with four messy sources
npm run db:seed:model         # optional: a hand-written requirement model for that project
npm run dev
```

Open <http://localhost:3000>.

**Without an API key** everything except the AI jobs works: you can add sources, build the
requirement model by hand, run quality checks, generate packs (the lists are complete; the narrative
sections say plainly that they were not written) and export. `npm run db:seed:model` populates a
full model so you can exercise the whole pipeline offline.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply a migration |
| `npm run db:seed:users` | Seed development users and grant access on existing projects |
| `npm run db:seed` | Seed the example project and its source documents |
| `npm run db:seed:model` | Seed a hand-written requirement model for that project |
| `npm run db:backfill` | Create domain profiles and seed audit trails for pre-retrofit projects |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop and recreate the database |

---

## The flow

1. **Create a project** — name, analysis goal, structured industry context, default mode. This
   framing is sent with every AI job; it is the cheapest way to improve output quality.
2. **Add sources** — paste raw text, or load a file. Text formats are read in the browser; PDF and
   DOCX are converted server-side. Label each by type. Stored verbatim.
3. **Run extraction** — AI reads each source separately (so every insight has an unambiguous parent)
   and proposes stakeholders, actors, goals, business rules, assumptions, constraints, risks and
   candidate requirements.
4. **Review** — accept, edit, dismiss or promote. Nothing enters the model until you say so.
   Re-running extraction never touches items you have already reviewed.
5. **Build the model** — requirements, use cases, acceptance criteria, dependencies. AI can draft
   each of these; you edit them in place.
6. **Toggle BA or FA and generate** — both packs come from the same model but emphasise different
   parts of it.
7. **Check quality and traceability** — deterministic checks run on every page load; the AI review
   is a separate pass over what a checklist cannot see.
8. **Export** — Markdown, print-friendly HTML, or the pack JSON.

---

## Architecture

```
/app
  /projects                    project list, create, and per-project screens
    /[id]
      /sources                 intake and source detail
      /extraction              extraction runner and insight review
      /requirements            the requirement model (tabbed) + requirement detail
      /packs                   BA/FA toggle, generation, preview
      /quality                 deterministic checks, AI review, traceability, generation log
      /export                  Markdown / HTML / JSON download
/lib
  /audit                       project audit log and change diffing
  /auth                        current user (mocked) and per-project access control
  /db                          Prisma client, mappers, queries, ref allocation
  /domain                      domain profile generation
  /intake                      server-side PDF and DOCX text extraction
  /schemas                     canonical domain types and Zod input schemas
  /ai                          client, runner (audit trail), and the six jobs
  /prompts                     versioned prompts, one module per job
  /quality                     deterministic engine and testability scoring
  /pack-builders               pack JSON types, entity assembly, Markdown and HTML renderers
  /trace                       trace link writing and graph derivation
/components                    layout, ui primitives, and one folder per screen family
/prisma                        schema, migrations, seeds
```

### Key decisions

**SQLite storage compromises are confined to one file.** SQLite has no enums and no arrays, so
enum-like columns are `String` and list columns are JSON-encoded `String`s suffixed `Json`. Only
`lib/db/mappers.ts` knows this; everything else works with real unions and arrays. Decoding is
forgiving (a bad row degrades to a default rather than crashing a render); writing always goes
through a Zod schema.

**Human-facing refs are separate from ids.** Requirements, use cases and criteria carry `REQ-001`,
`UC-004`, `AC-012` alongside opaque cuids. Refs are never reused, so an exported pack always points
at the same item it did on the day it was generated.

**Assumptions, constraints and risks have no entity of their own.** An accepted extracted insight of
those types *is* the project register, and the pack builders read it directly. That keeps each one
traceable to a source document without a table whose only content would be one string.

**Every AI call is logged.** `lib/ai/runner.ts` writes an `AiGeneration` row for every run —
success, refusal or parse failure — holding the model, prompt id and version, the input entity ids,
the verbatim raw output and the normalized output. Raw output is never overwritten or deleted.

**Quality has two layers that stay complementary.** The deterministic engine runs on every request
(never stale, always reliable, fully explainable). The AI reviewer runs on demand and is given the
deterministic findings, so it works on ambiguity and inconsistency rather than restating a checklist.

**Access is per project, and modelled as capabilities.** A `ProjectAccess` row grants one user one
role (`OWNER`, `PM`, `BA`, `FA`, `ARCHITECT`, `REVIEWER`) on one project. Authorisation asks whether
a role *can do a thing*, not whether it outranks another — a hierarchy would force a false ordering
(an architect is not "more" than a BA) and could not express REVIEWER, which is read-only regardless
of seniority. Absence of a row means no access; there is no implicit read.

**There is no authentication yet, and exactly one place to add it.** `lib/auth/current-user.ts`
resolves the acting user from a dev-only cookie. Everything downstream — access checks, audit
attribution, source uploader tracking — goes through it and needs no change when it is replaced.
The user picker in the header exists so the access model can actually be exercised; without it
"non-members cannot edit" is a claim nobody can check.

**Uploader role is denormalised on purpose.** A source records the role its uploader held *at upload
time*. People move between roles, and "who was the BA when this landed" must not change when they do.

**Domain context is structured, not prose.** Industry, subdomain, jurisdiction, regulatory
sensitivity and solution domain are first-class columns, and a `DomainProfile` is derived from them
on every change. The profile is a projection — if it ever disagrees with the project, the project
wins and regenerating fixes it. Its four list fields are the seam Phase 3 fills with domain
knowledge; they stay empty in the MVP and survive settings changes once populated.

**Files are parsed, never stored.** PDF and DOCX go to a server action that returns plain text into
the composer for review. There is no upload endpoint and no blob storage: a source is text, always.
Scanned PDFs with no text layer are rejected with a message saying so rather than saved empty.

**The audit log is append-only.** Nothing updates or deletes an entry, which is why the module
exposes no update helper. Enum changes are logged with their labels ("Industry: Other → Insurance")
because that is what is useful a year later.

**Prompts are versioned in code.** `lib/prompts/*` — bump the version whenever wording changes in a
way that could change output. The version is written to every generation record.

---

## Data model

`Project` → `SourceDocument` → `ExtractedInsight` → structured entities (`Stakeholder`, `Actor`,
`BusinessGoal`, `BusinessRule`, `Requirement`, `UseCase`, `AcceptanceCriterion`) → `PackOutput`,
with `Dependency` and `TraceLink` connecting them and `AiGeneration` / `AiFinding` recording what
the model did.

See `prisma/schema.prisma` — every enum-like column documents its allowed values inline.

---

## Deliberately out of scope for the MVP

Authentication, comments, approvals, real-time collaboration, notifications, billing, a diagram
editor, integrations, and vector search. Multi-user *access* exists (roles, membership, audit); what
is missing is authentication to prove identity and a UI to grant access. The architecture leaves room for them (multi-tenant columns are
noted in the schema, entity access already goes through a query layer) but none are built.

`TODO(roadmap)` markers in the code flag the places where a deferred feature would land.

---

## Notes

- Local database is SQLite via Prisma with the `better-sqlite3` driver adapter. Swapping to Postgres
  is a datasource change plus an adapter swap in `lib/db/client.ts`.
- `npm audit` reports three high-severity advisories in `deepmerge-ts`, reached only through the
  Prisma CLI's config loader (`prisma` → `@prisma/config`). It is a dev-time dependency and not in
  any runtime path; the only current fix is downgrading to Prisma 6.
