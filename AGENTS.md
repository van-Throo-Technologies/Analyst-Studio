<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database safety

The `DATABASE_URL` in `.env` points at the live Supabase database. It holds the
only copy of everything: there is no point-in-time recovery on this plan and no
scheduled backups.

Never pass it to a command that resets a schema. Prisma *drops and recreates*
whatever it is given as a shadow database, so these destroy production:

    prisma migrate diff --shadow-database-url "$DATABASE_URL"
    prisma migrate reset
    prisma db push --force-reset

This has already happened once and cost every row in the database.

`prisma migrate dev` is safe for adding a migration. Repairing migration
history on the live database — `migrate resolve`, hand-written SQL, anything
touching `_prisma_migrations` — needs the user's approval first, because a
mistake there is unrecoverable rather than merely wrong.

Before any destructive database operation, say what will be lost and wait.

# Two extraction paths, on purpose

There are two pieces of code that call the model to turn documents into
requirements. They look like duplicates and are not. Deleting either one loses
something the other cannot do.

`lib/extract.ts` is the product. A signed-in user adds source material to a
project and presses Extract:

    app/(dashboard)/projects/[id]/page.tsx
      -> components/ExtractionButton.tsx
        -> app/api/projects/[id]/extract/route.ts   (SSE, maxDuration 300)
          -> runPipeline() in lib/extract.ts

It runs extract, subtypes, ground, repair, coverage, expectations, save, and
streams each stage back so a run that takes minutes is not a spinner. It writes
requirements to that user's project. This is the only way anyone who is not
sitting at this repo can extract anything.

`scripts/extract-documents.ts` is the corpus builder, run from a terminal:

    npx tsx scripts/extract-documents.ts --dir mock-data/healthcare-hipaa --industry healthcare

It reads a folder off local disk, splits each document on its own headings,
extracts per section, verifies quotes, and writes a JSON file. It never touches
the database — `scripts/import-extraction.ts` does that, as a separate opt-in
step. This is how the rule base was built, and how it would be rebuilt or
extended to a new industry.

So: no session, no project, no upload, and a `--dir` on someone's laptop. The
script cannot stand in for the pipeline. Removing `lib/extract.ts` would leave
the app a read-only browser over whatever was last imported, with the Extract
button wired to nothing.

What *is* worth fixing: the script carries its own `RequirementSchema` and
`buildSystem()` prompt rather than sharing `lib/extract-core.ts`, so the two can
drift. Consolidate the schema if you touch this — do not consolidate by
deletion.
