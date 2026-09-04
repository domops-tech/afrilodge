"use server";

import { destroySession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/** Déconnexion générique, partagée par les quatre surfaces (CDC §3). */
export async function logoutAction(formData: FormData) {
  await destroySession();
  return redirect({ href: "/", locale: (formData.get("locale") as string) || "fr" });
}
