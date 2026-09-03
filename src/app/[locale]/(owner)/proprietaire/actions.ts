"use server";

import { destroySession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

export async function logoutAction(formData: FormData) {
  await destroySession();
  redirect({ href: "/", locale: (formData.get("locale") as string) || "fr" });
}
