# 0010 — La vraie cause de l'avertissement de ratio d'image (rectifie 0007/0008)

**Statut** : correctif appliqué lors d'une revue manuelle au navigateur
(Playwright, hors suite automatisée) avant le Sprint 5. Les décisions 0007
et 0008 attribuaient l'avertissement Next « has either width or height
modified, but not the other » à un étirement par le conteneur flex/grid
parent — plausible, mais faux. Cette fiche corrige l'explication avec la
cause vérifiée dans le code source de `next/image`.

## Ce que dit vraiment le code de Next

`node_modules/next/dist/esm/client/image-component.js` compare, une fois
l'image chargée, sa hauteur et largeur **réellement rendues**
(`img.height`/`img.width`) aux **attributs HTML** `height`/`width` (ceux
calculés depuis les props `width`/`height` passées à `<Image>`) :

```js
const heightModified = img.height.toString() !== img.getAttribute('height');
const widthModified = img.width.toString() !== img.getAttribute('width');
if (heightModified && !widthModified || !heightModified && widthModified) {
  warnOnce(`... has either width or height modified, but not the other ...`);
}
```

L'avertissement se déclenche quand **une seule** des deux dimensions
diffère de l'attribut déclaré, l'autre restant identique.

## Pourquoi nos vignettes le déclenchaient

Nos photos de démonstration (`e2e/fixtures/sample.jpg`) font 1600×1067,
un ratio ≈ 1,499. Les props `width`/`height` passées à `PropertyImage`
pour les vignettes admin étaient 160×120 — un ratio de 1,333 (4:3),
qui ne correspond pas au ratio réel du fichier.

Avec `className="h-auto w-40 ..."` (largeur figée à 160px via `w-40`,
hauteur laissée `auto`) : la largeur rendue reste 160 (= attribut, non
modifiée) ; la hauteur, elle, se calcule à partir du **ratio réel** de
l'image (1,499), donnant ≈ 107px — différente de l'attribut 120.
Une seule dimension a changé : avertissement.

## Le correctif correct

Deux façons de satisfaire ce contrôle, selon l'intention :

- **Cadrage rogné** (le cas des vignettes admin, `object-cover`) : figer
  **les deux** dimensions à des valeurs qui ne bougent jamais, ex.
  `className="h-[120px] w-40 object-cover"`. Aucune des deux dimensions
  rendues ne s'écarte de son attribut — pas d'avertissement, et l'image
  est bien rognée dans une boîte 160×120 fixe.
- **Ratio préservé** (le cas de la galerie de la fiche détaillée) : laisser
  flotter **les deux** dimensions ensemble, ex. `className="w-full
  h-auto"`. Les deux s'écartent de leurs attributs simultanément → la
  condition `xor` ne se déclenche jamais, et le rendu final respecte le
  vrai ratio du fichier.

Ce que `h-auto` seul (ou `w-full` seul) **ne règle jamais** : laisser
flotter une seule dimension pendant que l'autre reste figée à une valeur
qui ne correspond pas au ratio réel du fichier redéclenche
systématiquement l'avertissement — c'est exactement l'erreur commise deux
fois avant cette fiche. Le commentaire de
`src/components/PropertyImage.tsx` documente désormais cette règle.

## Où c'est appliqué

- `src/app/[locale]/(admin)/admin/fiches/[requestId]/page.tsx` — galerie
  admin, cadrage rogné (`h-[120px] w-40`).
- `src/app/[locale]/(public)/logements/[propertyId]/page.tsx` — galerie
  publique, ratio préservé (`w-full h-auto`), déjà correcte.
- `src/app/[locale]/(public)/recherche/page.tsx` — vignette de liste,
  cadrage rogné avec dimensions déjà figées des deux côtés (`h-24 w-24`),
  jamais fautive.

Aussi corrigé au passage : deux avertissements « Largest Contentful
Paint » (photo de couverture de la première fiche de la file admin,
première vignette de la liste de recherche) — `priority` ajouté sur la
première image de chaque liste, comme déjà fait pour la fiche détaillée.
