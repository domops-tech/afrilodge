import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Renommé `middleware` → `proxy` en Next 16 (voir
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * Ce fichier ne fait que la résolution de langue (FR/EN — CDC §2). Il ne
 * porte pas l'autorisation par rôle : Next.js recommande explicitement de ne
 * pas s'appuyer sur le proxy seul pour ça, une Server Function pouvant être
 * appelée sans repasser par lui. L'autorisation vit dans
 * src/lib/auth/guard.ts, appelée par chaque page et action protégées.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
