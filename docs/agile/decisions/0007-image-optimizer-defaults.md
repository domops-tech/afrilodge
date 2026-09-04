# 0007 — Deux défauts Next.js qui cassaient les photos en silence

**Statut** : correctifs appliqués dans `next.config.ts` en construisant
l'écran de validation admin (épic 2). Concerne toute photo servie via
`PropertyImage`/`next/image` depuis notre stockage objet — reviendra au
Sprint 3 (fiches publiques).

## Ce qui s'est passé

Les photographies téléversées par l'agent ne s'affichaient pas dans l'écran
de revue admin, sans erreur visible dans le HTML : l'élément `<img>` était
présent, `complete` valait `true`, mais `naturalWidth` valait `0`. Deux
causes distinctes, empilées :

1. **`dangerouslyAllowLocalIP`** — Next 16 bloque par défaut l'optimisation
   d'images dont l'URL résout vers une IP privée (protection anti-SSRF).
   MinIO en développement tourne sur `localhost:9000`, donc bloqué par
   défaut.
2. **`contentDispositionType`** — depuis Next 15, l'optimiseur d'image sert
   par défaut avec `Content-Disposition: attachment` (pensé pour empêcher
   l'exécution de SVG malveillants servis inline). Un navigateur ne décode
   pas une réponse `attachment` comme une image inline : le fetch réussit
   (200), mais l'`<img>` reste vide.

## Décision

Dans `next.config.ts`, sous `images` :

```ts
dangerouslyAllowLocalIP: true,   // notre seul remotePattern est notre propre bucket
contentDispositionType: "inline", // on ne sert jamais de SVG (dangerouslyAllowSVG absent)
```

## Pourquoi c'est sans danger ici

- `dangerouslyAllowLocalIP` n'ouvre rien de plus que ce que
  `remotePatterns` autorise déjà explicitement (`localhost:9000/sejours-photos/**`,
  voir 0006) — jamais une URL arbitraire fournie par un utilisateur. En
  production, `NEXT_PUBLIC_IMAGES_CDN_URL` pointera vers un vrai domaine de
  CDN, pas une IP privée : ce réglage ne change rien à la surface
  d'attaque réelle.
- `contentDispositionType: "inline"` n'est risqué que combiné à
  `dangerouslyAllowSVG` (SVG pouvant embarquer du script) — que nous
  n'activons pas. Notre pipeline ne produit jamais de SVG :
  `compressImageFile` (Sprint 0) ne sort que du WebP, l'optimiseur négocie
  ensuite AVIF/WebP.

## Comment ce bug a été détecté, et pourquoi la prévention compte

Le test e2e de revue admin (`e2e/admin-review.spec.ts`) vérifiait au
départ juste que `<img>` était visible dans le DOM — ce qui passait même
avec des images cassées. Renforcé pour attendre `naturalWidth > 0`, ce qui
a immédiatement révélé le problème. **Ne pas revenir à une assertion de
simple présence pour du contenu qui doit réellement charger** (photos,
pièces d'identité) : elle masque exactement ce genre de régression.

Un second piège, plus anecdotique, a été croisé pendant le diagnostic : la
photo de test utilisée par les fixtures e2e (`e2e/fixtures/sample.jpg`)
était un JPEG 1×1 pixel. Une fois réencodée en AVIF par l'optimiseur, ce
fichier dégénéré ne se décode pas dans Chromium (`naturalWidth: 0` malgré
un fichier AVIF structurellement valide, confirmé décodable côté serveur
par `sharp`). La fixture a été régénérée en 64×64 — une taille réaliste
évite la classe de bug, sans qu'il y ait de correctif applicatif à faire.
