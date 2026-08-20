"use server";

import { revalidatePath } from "next/cache";
import { setDevUser } from "@/lib/auth/current-user";

/**
 * DEVELOPMENT ONLY — delete alongside components/layout/dev-user-switcher.tsx
 * and the dev helpers in lib/auth/current-user.ts when real auth lands.
 */
export async function switchDevUserAction(formData: FormData): Promise<void> {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length === 0) return;

  await setDevUser(userId);
  // Everything is access-filtered, so switching user changes what every page
  // shows — revalidate the whole tree rather than guessing which parts.
  revalidatePath("/", "layout");
}
