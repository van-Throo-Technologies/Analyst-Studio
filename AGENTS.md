<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Analyst Studio — working notes

Read `README.md` first; it covers the flow, the architecture and the key design decisions. This file
records the conventions that are easy to break by accident.

## Non-negotiables

- **Packs are assembled from entities, never written by a prompt.** `lib/pack-builders/assemble.ts`
  copies every list item verbatim from the model. AI narrative is limited to the fields in
  `baNarrativeSchema` / `faNarrativeSchema`. If you find yourself asking a model to output a list of
  requirements for a pack, stop — that breaks traceability and creates a second, divergent copy.
- **Markdown and HTML both render from pack JSON.** Never write one independently of the other.
- **Every AI call goes through `runStructuredJob`.** It writes the audit record. Do not call the SDK
  from anywhere else.
- **Bump the prompt `version` whenever wording changes in a way that could change output.** The
  version is stored on every generation and is how a result is explained six months later.
- **Only `lib/db/mappers.ts` touches `*Json` columns.** Everywhere else uses the domain types from
  `lib/schemas/entities.ts`.
- **Never delete or overwrite `AiGeneration.rawOutput`.**
- **`ProjectAuditLog` is append-only.** No update, no delete. Add entries, never revise them.
- **`DomainProfile` is derived, never authored.** Regenerate it from the Project row; do not let the
  two drift. Its list fields are Phase 3+ territory and must survive a settings change.
- **Parsed files are never stored as files.** `parseFileAction` returns text and nothing else.
- **Every project write goes through `requireCapability`.** Never query `prisma.project` or
  `prisma.sourceDocument` in a mutation without one. Reads under `/projects/[id]` inherit the gate
  in that layout.
- **`lib/auth/current-user.ts` is the only place that resolves identity.** Do not read the dev
  cookie anywhere else; it is the single seam for real auth.
- **A source's `uploaderRole` is never rewritten on edit.** It records who brought the material in,
  not who last touched it.
- **A validation never survives a content change.** Editing a source's text clears
  `validationStatus` back to `pending` — a validation vouches for particular words, so it cannot
  stand over words nobody checked. The comparison is `checksumHash`, not string equality, so
  whitespace-only edits do not trip it.
- **Validation is about the material, not the analysis.** It records "this is a faithful record of
  what the origin said", never "this is correct". Rejected sources are kept, not deleted.
- **Only OWNER, PM and ARCHITECT can validate a source** (`validate_sources`). BA and FA bring
  material in and extract from it but do not vouch for it — validation is an authority check, per
  the Phase 2 spec. One line in `CAPABILITIES` if that changes.
- **Extraction never reads an unvalidated source.** Enforced in three places: the runner UI will
  not let one be selected, the server actions check `canExtractProject`, and `extractSources`
  throws `UnvalidatedSourceError` at the last point before the model sees the text. The UI check
  is a courtesy; the job's check is the guarantee. A *rejected* source blocks exactly as a pending
  one does.
- **Extraction findings and quality-review findings share `AiFinding` and must not delete each
  other.** Both scope their refresh by the `job` column. A re-run of one job never touches the
  other's rows.
- **`CONFIDENCE_FLOORS` in `lib/prompts/extraction.ts` is the single source for both the prompt
  and the gates.** The prompt asks the model to respect the floor and `runExtractionGates` checks
  that it did; if the two drift, every insight gets flagged or none does.

## Conventions

- Enum-like values live in `lib/schemas/enums.ts` with a matching `*_LABELS` map. The UI never
  hand-writes a display string.
- Badge colours live only in `components/ui/badges.tsx`, so a colour never means two things.
- Server actions return `FormState` for user error and throw only for genuine faults.
- Server actions bound with `projectId` are passed to client components as action references; the
  remaining id is bound on the client (see `simple-entity-panel.tsx`).
- `server-only` guards anything that touches the database or the AI client. A client component
  importing such a module breaks the build — put shared constants in a neutral module instead (see
  `NARRATIVE_SECTIONS` in `lib/pack-builders/types.ts`).
- Deletes that would cascade across analysis work say what they will destroy, with counts, before
  doing it.

## Working without auth

Seven users exist (`npm run db:seed:users`); switch between them with the picker in the header.
Rachel Osei is a REVIEWER (read-only) and Nadia Haddad has no access to anything — use those two to
check that a change actually enforces access rather than merely hiding a button.

## Review scoping

`lib/phase-scope.ts` exports `SHOW_PHASE_3_PLUS_NAV`, currently `false`. It hides Phase 3+ from the
sidebar and the overview progress list during a Phase 1-2 review. The routes still work and the code
is untouched — flip it to `true` after Phase 3 review.

## Testing without an API key

`npm run db:seed && npm run db:seed:model` populates a full project. The demo model contains three
deliberate defects (an unsourced and vaguely worded requirement, an untestable criterion, a detailed
use case with no exception flow) so the quality screen has something true to say. Do not "fix" them.

## Model

`claude-opus-5` via `lib/ai/client.ts`. Structured outputs through `zodOutputFormat`; adaptive
thinking; effort tuned per job in `AI_EFFORT`.
