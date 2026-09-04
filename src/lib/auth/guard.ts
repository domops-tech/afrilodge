import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession, type UserRole } from "@/lib/auth/session";

/**
 * Gardes d'autorisation à appeler dans chaque Server Component / Server
 * Function protégée. `src/proxy.ts` fait une première passe de redirection
 * pour l'expérience utilisateur, mais Next.js recommande explicitement de
 * ne pas s'y fier seul (voir
 * node_modules/next/dist/docs/.../file-conventions/proxy.md
 * §"Execution order") : une Server Function appelée directement doit se
 * protéger elle-même. C'est ce que ces fonctions font.
 */

const LOGIN_PATH_BY_ROLE: Record<UserRole, string> = {
  OWNER: "/connexion",
  AGENT: "/terrain/connexion",
  ADMIN: "/admin/connexion",
};

export async function requireRole(...roles: UserRole[]) {
  const session = await getSession();
  if (!session || session.kind !== "user" || !roles.includes(session.role)) {
    const loginPath = LOGIN_PATH_BY_ROLE[roles[0]] ?? "/connexion";
    return redirect({ href: loginPath, locale: await getLocale() });
  }
  return session;
}

export async function requireGuestSession() {
  const session = await getSession();
  if (!session || session.kind !== "guest") {
    return redirect({ href: "/reserver", locale: await getLocale() });
  }
  return session;
}

export async function getOptionalSession() {
  return getSession();
}
