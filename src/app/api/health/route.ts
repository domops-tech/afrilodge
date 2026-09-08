import { NextResponse } from "next/server";

/**
 * Sonde de disponibilité du conteneur (voir Dockerfile, HEALTHCHECK, et
 * vd-platform/caddy — le service compose "app" est déclaré `healthy` sur
 * cette route). Volontairement sans dépendance à la base de données : une
 * panne Postgres ne doit pas faire échouer le healthcheck du processus
 * Next.js, qui reste par ailleurs capable de servir des pages statiques.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
