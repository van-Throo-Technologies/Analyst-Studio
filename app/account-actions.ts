"use server";

import { signOut } from "@/auth";

/**
 * Ends the session. With the database strategy this deletes the Session row,
 * so the session is genuinely gone rather than merely forgotten by the browser.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
