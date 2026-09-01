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
