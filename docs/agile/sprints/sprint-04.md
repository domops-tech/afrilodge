# Sprint 4 — Espace propriétaire

**Objectif** : un propriétaire demande une vérification et tient son
calendrier.

## Livré

Toutes les stories de l'épic 4, plus une story rattrapée de l'épic 2
(voir plus bas) :

- **Création de bien** (`/proprietaire/nouveau`) : titre, description,
  quartier, ville, prix, capacité, équipements annoncés. Préalable
  implicite à toute demande de vérification (CDC §5.2.16), absent du
  backlog original — construit ici puisque story 4.1 en dépend.
- **Fiche de gestion d'un bien** (`/proprietaire/biens/[id]`) : titre,
  description, prix, capacité toujours modifiables (CDC §6.3.2) ;
  équipements modifiables tant qu'aucune visite n'a eu lieu, verrouillés
  ensuite (constat de l'agent, pas déclaration du propriétaire).
- **Demande de vérification et suivi de traitement** (CDC §6.3.1) :
  statut affiché à chaque étape (demandée, planifiée avec date, visitée,
  approuvée, refusée avec motif) — le motif de refus est maintenant
  persisté sur `VerificationRequest.rejectionReason`, pas seulement dans
  le journal d'audit.
- **Calendrier de disponibilité** (CDC §6.3.3) : fenêtre de 60 jours,
  bascule OPEN/BLOCKED, ne touche jamais un jour piloté par une
  réservation (HELD/BOOKED — épic 5).
- **Réservations et règlements** (CDC §6.3.4, §6.3.5) : requêtes réelles
  contre `Booking`/`Payment`/`CommissionEntry`, correctement vides tant que
  les épics 5 et 6 ne sont pas construits — la plomberie est prête, aucune
  de ces deux épics n'aura à revenir sur cet écran.

## Un vrai trou de backlog comblé : la planification de visite

Le backlog original ne prévoyait, côté back-office, que la validation des
fiches déjà visitées (épic 2, Sprint 2) — rien ne couvrait l'étape
antérieure du CDC §4.1.2 : « un rendez-vous est planifié et affecté à un
agent ». Sans elle, une demande de vérification nouvellement créée
(épic 4) n'aurait jamais eu de suite : c'est en construisant le parcours
complet du propriétaire que le trou est devenu visible. Ajouté comme story
2.7, rétroactivement à l'épic qu'elle complète, avec sa propre section
dans `/admin` et son action (`scheduleVisitAction`).

## Une découverte méthodologique qui dépasse ce sprint

Les tests e2e des deux nouvelles actions qui redirigent vers leur propre
page (calendrier, planification) échouaient de façon irrégulière : la
donnée était correcte en base (confirmé côté serveur), mais le test la
vérifiait parfois trop tôt. Ni `toHaveURL` ni `waitForLoadState` ne sont
des signaux fiables quand une Server Action redirige vers l'URL déjà
affichée — Next.js traite ça comme une navigation gérée par React, pas un
rechargement classique. Corrigé en interrogeant la base avec
re-tentative plutôt qu'en devinant le bon événement navigateur. Détaillé
en décision 0009 : concerne toute action de ce type, reviendra
certainement au Sprint 5 (réservation).

## Comment démontrer

```bash
docker compose up -d
npm run db:seed
npm run dev
```

Propriétaire (`/connexion`, tout numéro) : créer un bien, demander sa
vérification. Admin (`/admin/connexion`, `+2250700000001`) : le voir dans
« Demandes à planifier », l'affecter à un agent. Retour côté propriétaire :
le statut affiche la date planifiée. Le calendrier se manipule sur
n'importe quel bien déjà publié.

`npm run test:e2e` — 16 tests au total, dont 3 nouveaux pour l'espace
propriétaire (création + planification, calendrier, refus affiché).

## Rétrospective

- **Bien** : ne pas avoir laissé passer le trou de planification sous
  prétexte qu'il appartenait « à un sprint déjà terminé » — le backlog
  documente maintenant explicitement pourquoi la story existe et où elle
  aurait dû être plutôt que de la glisser sans trace.
- **À ajuster** : le diagnostic du bug de synchronisation e2e a pris du
  temps parce que les premières hypothèses (fuseau horaire, clé de
  jointure Prisma) étaient plausibles mais fausses. Réflexe pour la
  suite : dès qu'un test échoue de façon irrégulière sur une vérification
  post-soumission, comparer immédiatement l'état vu par le serveur
  (journalisation temporaire) à celui vu par le test, avant d'explorer des
  pistes plus complexes.
