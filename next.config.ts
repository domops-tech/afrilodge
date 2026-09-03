import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Formats modernes pour les photographies de vérification (CDC §7.1) :
    // le pipeline d'upload sert déjà du WebP, on laisse next/image négocier
    // AVIF quand le navigateur le supporte.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // MinIO local (docker-compose) — à remplacer par le domaine du CDN
      // réel en production, via NEXT_PUBLIC_IMAGES_CDN_URL.
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/sejours-photos/**" },
    ],
  },
};

export default withNextIntl(nextConfig);
