import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sessions signées, sans dépendance externe. Un seul mécanisme pour les
 * quatre surfaces (CDC §3) :
 *  - propriétaire, agent, admin → { kind: "user", userId, role }
 *  - voyageur → { kind: "guest", guestSessionId }, jamais un compte (§6.2).
 */

export type UserRole = "OWNER" | "AGENT" | "ADMIN";

export type SessionPayload =
  | { kind: "user"; userId: string; role: UserRole; exp: number }
  | { kind: "guest"; guestSessionId: string; phoneVerified?: true; exp: number };

const COOKIE_NAME = "sejours_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours pour propriétaire/agent/admin
const GUEST_TTL_SECONDS = 60 * 60 * 6; // 6 heures, renouvelables par OTP depuis /reserver

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET manquant — voir .env.example");
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

function decode(token: string): SessionPayload | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createUserSession(userId: string, role: UserRole) {
  const exp = Date.now() + DEFAULT_TTL_SECONDS * 1000;
  const token = encode({ kind: "user", userId, role, exp });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_TTL_SECONDS,
  });
}

export async function createGuestSession(guestSessionId: string) {
  const exp = Date.now() + GUEST_TTL_SECONDS * 1000;
  const token = encode({ kind: "guest", guestSessionId, phoneVerified: true, exp });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Utilitaire de test : encode/décode sans dépendre du contexte requête Next. */
export const __testing = { encode, decode };
