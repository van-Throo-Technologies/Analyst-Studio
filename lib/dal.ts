import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";

// The authorisation boundary for the app.
//
// Next's own guidance is to check as close to the data as possible rather than
// in a layout: layouts do not re-render on navigation under partial rendering,
// and a layout cannot stop the segments below it from rendering anyway. So every
// protected page calls verifySession() itself.
//
// React's cache() memoises this for the duration of a single render pass, so a
// page and the components beneath it can each call it without repeating the
// session lookup — which is a database read under the database session strategy.
//
// The "server-only" import above makes importing this file from a Client
// Component a build error rather than a leak.
export const verifySession = cache(async () => {
  const session = await auth();

  // Redirect rather than return null: callers then cannot accidentally proceed
  // by ignoring a falsy result, and TypeScript narrows the return to a real user.
  if (!session?.user?.id) redirect("/signin");

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
});
