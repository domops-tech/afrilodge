import { NextResponse } from "next/server";
import { getSession, type UserRole } from "@/lib/auth/session";

/**
 * Équivalent de src/lib/auth/guard.ts pour les Route Handlers : une réponse
 * JSON 401, pas une redirection (qui n'a pas de sens pour un appel fetch()
 * émis par le client de synchronisation de l'app terrain).
 */
export async function requireApiRole(...roles: UserRole[]) {
  const session = await getSession();
  if (!session || session.kind !== "user" || !roles.includes(session.role)) {
    return { session: null, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}
