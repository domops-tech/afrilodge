"use server";

import { destroySession, getSession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";
import { LOGIN_PATH_BY_ROLE } from "@/lib/auth/guard";

/**
 * Déconnexion générique, partagée par les quatre surfaces (CDC §3).
 * Redirige vers la page de connexion du rôle qui vient de se déconnecter
 * (propriétaire/agent/admin), pas systématiquement l'accueil public :
 * revenir sur `/` après la déconnexion d'un agent, par exemple, atterrit
 * sur une page identique à celle d'un simple visiteur, sans aucun moyen
 * visible de se reconnecter à son espace — constaté en usage réel. Le
 * voyageur (session `guest`, pas de page de connexion dédiée) garde `/`.
 */
export async function logoutAction(formData: FormData) {
  const session = await getSession();
  const href = session?.kind === "user" ? LOGIN_PATH_BY_ROLE[session.role] : "/";
  await destroySession();
  return redirect({ href, locale: (formData.get("locale") as string) || "fr" });
}
