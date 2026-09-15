# 0015 — Récupération des réservations et intégrité des écritures

Corrections de l’audit qualité du 14 septembre 2026.

La route `/reserver` permet de retrouver ses réservations après expiration du cookie de six heures. Un nouveau code SMS, d’usage `GUEST_ACCESS`, renouvelle la session ; un lien de confirmation initialement demandé est conservé. L’accès est ensuite contrôlé sur le téléphone prouvé par SMS à chaque page et action, ce qui permet de consulter plusieurs réservations du même voyageur sans les déplacer entre sessions en base.

Cette possibilité nécessite de distinguer la preuve du téléphone d’un email librement saisi. Pour le voyageur, les OTP de réservation et de récupération sont donc envoyés uniquement par SMS ; l’email facultatif reste une adresse de contact. Cette règle remplace pour ce parcours l’envoi du même code à une adresse arbitraire prévu par la décision 0014 : sinon, saisir le téléphone d’un tiers et sa propre adresse permettrait d’accéder aux anciennes réservations de ce tiers. Les sessions voyageur antérieures au correctif repassent par la récupération SMS avant de bénéficier de cet accès. Le cookie signé reste la source de vérité de l’expiration de l’autorisation ; la ligne GuestSession conserve les coordonnées liées à la demande.

La confirmation d’arrivée n’est autorisée qu’à partir de la date d’arrivée, à minuit UTC, conformément aux autres calculs de dates du projet. La libération automatique à 24 heures conserve son fonctionnement. Le simulateur accepte le rejeu d’un ordre de libération déjà exécuté, pour permettre de reprendre un webhook interrompu.

L’événement de paiement, les transitions de réservation, les jours du calendrier, l’audit et la commission sont écrits dans une seule transaction. Une erreur annule l’ensemble ; le même événement peut être rejoué. Un verrou de ligne sérialise les événements distincts d’un paiement. Les opérations réseau du PSP restent hors des transactions SQL.

La réservation revalide dates, capacité, publication et vérification active dans sa transaction finale, au niveau Serializable. Les transactions annulées par PostgreSQL pour concurrence sont reprises au maximum trois fois, sans répéter l’OTP ou un appel externe. Une indisponibilité réelle reste signalée au voyageur. Le calendrier propriétaire n’écrit que sur les jours OPEN/BLOCKED, avec vérification du statut au moment de l’écriture, dernier jour inclus.

Déploiement : appliquer `npx prisma migrate deploy` et régénérer le client Prisma avant de démarrer cette version. La migration ajoute seulement la valeur `GUEST_ACCESS` à l’énumération OTP ; elle n’efface aucune donnée. Le build Docker réalise déjà la génération du client. En développement local, `npm run start` prépare les fichiers statiques puis démarre le serveur standalone ; `PORT` et `APP_HOSTNAME` permettent de choisir l’écoute.
