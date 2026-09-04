# 0005 — Périmètre du hors connexion (Sprint 1)

**Statut** : décision technique prise en construisant l'épic 1, à valider avec
vous si le besoin ci-dessous se confirme sur le terrain.

## Contexte

Le CDC §6.4.4 demande un « fonctionnement hors connexion, avec
synchronisation différée » pour l'application terrain de l'agent. Deux
besoins distincts se cachent derrière cette phrase :

1. **Les données** capturées pendant la visite (photos, formulaire) doivent
   survivre à une perte de réseau, y compris un rechargement de page.
2. **L'application elle-même** doit pouvoir se charger sans réseau du tout
   (ouverture à froid, zéro barre de signal dès le lancement).

## Décision

Le Sprint 1 livre entièrement le point 1 (IndexedDB via Dexie —
`src/lib/field/db.ts` — et un moteur de synchronisation applicatif —
`src/lib/field/sync.ts`), et **assume explicitement de ne pas livrer le
point 2** : pas de service worker, pas de précache de l'app shell, pas de
PWA installable en Sprint 1.

Le scénario couvert : l'agent ouvre la page de la visite **une première
fois avec du réseau** (par exemple avant d'entrer dans le logement, ou
depuis le véhicule), puis peut perdre le réseau sans qu'aucun appel serveur
supplémentaire ne soit nécessaire jusqu'à la synchronisation finale — toute
la navigation à l'intérieur du parcours de visite est pilotée côté client,
sans nouvelle requête au serveur Next.js.

## Pourquoi

- C'est le scénario réel le plus probable : un agent planifie ses visites,
  ne découvre pas une adresse au hasard sans avoir eu de réseau au
  préalable dans la journée.
- Une PWA installable avec service worker de précache est un chantier à
  part entière (stratégies de cache par route, invalidation, mise à jour de
  l'app) qui aurait doublé la taille de ce sprint pour un gain incertain
  tant que le besoin réel n'est pas confirmé par les agents de terrain.
- Rien n'est perdu si le besoin se confirme : Next.js sépare déjà proprement
  le rendu serveur (page de visite) de la logique cliente (IndexedDB,
  synchronisation), un service worker s'ajouterait sans réécrire cette
  logique.

## Autre choix assumé : pas d'API Background Sync du navigateur

La synchronisation différée est déclenchée par l'application elle-même
(bouton explicite, ou écouteur de l'événement `online` — voir
`VisitWorkflow.tsx`), pas par l'API Background Sync du navigateur.

Raisons : support inégal (absente de Safari/iOS, bien que hors périmètre
Android ici — CDC §2 — la portabilité reste une qualité générale à
préserver), déclenchement à la discrétion du navigateur donc impossible à
garantir dans une fenêtre de temps, et impossible à tester de façon fiable
en intégration continue. Le déclenchement applicatif est vérifié par
`e2e/field-visit.spec.ts` (bascule hors connexion → en ligne → synchronisation
automatique).

## À réévaluer si

Un agent rapporte concrètement avoir ouvert l'application sans réseau du
tout (pas seulement perdu le réseau après ouverture). Dans ce cas, ajouter
un service worker de précache devient une story à part entière du backlog,
pas un correctif.
