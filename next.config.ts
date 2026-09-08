import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Déploiement en conteneur (voir vd-platform) : ne copie dans l'image que
  // les fichiers réellement nécessaires au serveur de production, tracés par
  // `next build`, plutôt qu'un node_modules complet (~700 Mo de plus rien
  // que pour npm ci — devDependencies incluses). Produit
  // `.next/standalone/server.js`.
  output: "standalone",
  images: {
    // Formats modernes pour les photographies de vérification (CDC §7.1) :
    // le pipeline d'upload sert déjà du WebP, on laisse next/image négocier
    // AVIF quand le navigateur le supporte.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // MinIO local (docker-compose) — remplacé en production par l'origine
      // publique ci-dessous, servie par Caddy (voir vd-platform,
      // sites.d/afrilodge.vd-technologies.com.caddy : /media/* → MinIO).
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/sejours-photos/**" },
      { protocol: "https", hostname: "afrilodge.vd-technologies.com", pathname: "/media/**" },
    ],
    // Nécessaire pour que next/image optimise les images servies par MinIO
    // en local (IP privée) : sans danger ici, le seul remotePattern
    // autorisé est notre propre bucket ci-dessus, jamais une URL arbitraire
    // fournie par un utilisateur. Un CDN réel en production n'est pas une
    // IP privée et ne déclenche pas ce garde-fou.
    dangerouslyAllowLocalIP: true,
    // Depuis Next 15, l'optimiseur d'image sert par défaut en
    // Content-Disposition: attachment (durcissement pensé pour les SVG
    // potentiellement exécutables), ce qui empêche un <img> classique de
    // décoder la réponse inline. Nos photos ne sont jamais des SVG
    // (compressImageFile ne produit que du WebP), donc "inline" est sans
    // risque ici et nécessaire pour que les photos s'affichent réellement.
    contentDispositionType: "inline",
  },
};

export default withNextIntl(nextConfig);
