# 0019 — SMS et paiement pour le Bénin : comparatif (à trancher)

Statut : **proposition, rien n'est décidé.** Établi le 30 octobre 2026 à partir des pages publiques des fournisseurs. Complète la note 0013, qui comparait des opérateurs ivoiriens : le marché de lancement est le Bénin.

## Contexte

- `SMS_PROVIDER` n'accepte que `console` : aucun code de connexion n'est réellement envoyé. Propriétaires, agents et voyageurs ne peuvent pas se connecter en production sans accès aux journaux du serveur.
- Le paiement passe par le port `PaymentProvider` (simulateur). Le CDC §12, qui fixe l'établissement de paiement agréé, n'est pas tranché.
- Opérateurs mobiles au Bénin : MTN, Moov Africa, Celtiis. Mobile Money : MTN MoMo, Moov Money, Celtiis Cash.

## 1. Envoi de SMS (codes de connexion)

| Fournisseur | Prix par SMS vers le Bénin | Opérateurs annoncés | Remarques | Fiabilité du chiffre |
|---|---|---|---|---|
| **eSMS Africa** | 25,12 FCFA | MTN, Moov, Celtiis (routes directes) | Identifiant d'expéditeur : 100 USD, une fois. API OTP dédiée (eSMS Verify). | Page officielle |
| **SMSPro Africa** | dès 13 FCFA, dégressif | MTN, Moov Africa (Celtiis non cité) | Villes citées : Cotonou, Porto-Novo, Parakou. Tarif réel selon volume. | Page officielle, tarif « à partir de » |
| **Twilio** | 0,2985 USD, soit environ 170 à 180 FCFA | Tous, via Twilio | 7 à 14 fois plus cher. Identifiant alphanumérique gratuit. Protection anti-fraude SMS payante (0,025 USD). | Page officielle (octobre 2026) ; conversion en FCFA approximative |
| Unimatrix | 0,1498 USD annoncés pour MTN et Moov | MTN, Moov | Non vérifié sur la page elle-même (extrait de recherche). | À confirmer |

**Lecture.** Le prix compte peu : un parcours de réservation envoie 2 à 3 codes, soit 50 à 75 FCFA chez eSMS Africa, face à des frais de paiement de plusieurs milliers de FCFA. Les critères décisifs sont la **couverture de Celtiis** (un abonné Celtiis sans code ne peut pas réserver), la **délivrabilité** et le support. Je recommande de tester eSMS Africa et SMSPro Africa avec de vrais numéros MTN, Moov et Celtiis avant de choisir. Twilio est le plan de secours fiable, pas le plan économique.

**Intégration.** Ajouter un `case` dans `src/lib/sms/provider.ts` et un adaptateur, sans toucher aux appelants (règle de `CLAUDE.md`). Prévoir la limitation de débit déjà en place sur les codes.

## 2. Paiement Mobile Money

| | **KKiaPay** | **FedaPay** |
|---|---|---|
| Réseaux Bénin | MTN, Moov, carte, Wave annoncé | MTN MoMo, Moov Money, Celtiis Cash, Coris Money, BMO |
| Frais Mobile Money | Formule « Intégration » (API) : 1,5 % supportés par le client, 9 900 FCFA HT par mois (premier mois gratuit). Formule « Appli mobile » : 1,5 % marchand, 1 000 FCFA par mois, plafond 2 000 000 FCFA par mois, donc inadaptée. | **Non trouvé sur une page officielle.** Un blog tiers estime 1,8 à 2,5 % ; à confirmer par contrat. |
| Frais carte | 2,1 % (cartes UEMOA) ou 3 % (hors UEMOA), à la charge du client | Estimé à environ 3 % + frais fixes (blog tiers) |
| Reversement vers Mobile Money ou banque | Oui, listé dans toutes les formules | Oui : API de décaissements (`POST /v1/payouts`, puis `PUT /v1/payouts/start`) ; MTN Bénin et Moov Bénin cités, Celtiis non cité |
| Frais de reversement | Non précisés | Non précisés |
| Fiabilité | Tarifs officiels (tableau Bénin, premier de la page, qui liste aussi d'autres pays) | Fonctionnalités officielles ; tarifs non vérifiés |

Non évalués faute de temps : CinetPay, PayDunya, Hub2 et les autres agrégateurs actifs au Bénin.

**Exemple de coût.** Séjour de 2 nuits à 20 000 FCFA, soit 40 000 FCFA : 1,5 % représente 600 FCFA, ici à la charge du voyageur chez KKiaPay.

## 3. Le point juridique à trancher avant de choisir

Le fonctionnement actuel (et la promesse affichée sur l'accueil : « le propriétaire n'est payé qu'une fois votre arrivée confirmée ») suppose que l'argent est **retenu** entre le paiement et l'arrivée.

- **Option A : collecter, retenir, reverser.** Le voyageur paie, les fonds restent sur le compte AyoStay chez l'agrégateur, puis un décaissement vers le propriétaire part à l'arrivée, déduction faite de la commission. Techniquement possible avec les deux agrégateurs (reversements). Mais AyoStay détient alors des fonds de tiers, même brièvement : **à faire valider par un juriste** (agrément, ou cadre proposé par l'agrégateur). Le code actuel écrit « aucun fonds ne transite par VD Technologies » : ce principe serait à réviser.
- **Option B : paiement direct au propriétaire.** Aucun fonds retenu, pas de risque réglementaire de ce côté, mais la garantie de paiement à l'arrivée disparaît et la commission est plus difficile à prélever. Il faudrait alors **modifier le texte de l'accueil**.

Aucun agrégateur n'a été interrogé sur une offre de séquestre ou de paiement partagé (« split payment ») : c'est la première question à leur poser.

## Prochaines étapes proposées

1. Tester l'envoi de codes sur de vrais numéros MTN, Moov et Celtiis avec eSMS Africa et SMSPro Africa (comptes d'essai).
2. Demander à KKiaPay et FedaPay : séquestre ou split, tarif réel et frais de reversement, délais, plafonds, statut réglementaire.
3. Faire trancher l'option A ou B par un conseil juridique.
4. Seulement ensuite : écrire l'adaptateur SMS et l'adaptateur de paiement derrière les ports existants.

## Sources

- KKiaPay, tarifs : <https://kkiapay.me/tarifs/>
- FedaPay, décaissements : <https://docs.fedapay.com/en/integration-api/payouts-management>
- FedaPay, méthodes de paiement : <https://docs-v1.fedapay.com/paiements/methodes-de-paiement>
- FedaPay, frais (page d'aide générique) : <https://support.fedapay.com/portal/en/kb/articles/tarification-et-frais-sur-fedapay>
- Estimation tierce des frais (non officielle) : <https://kolonell.com/fr/blog/kkiapay-fedapay-benin-integration-marchand-cotonou-2026>
- eSMS Africa : <https://esmsafrica.io/fr/sms/benin>
- SMSPro Africa : <https://smspro.africa/benin>
- Twilio : <https://www.twilio.com/en-us/sms/pricing/bj>
- Unimatrix (extrait de recherche) : <https://www.unimtx.com/fr/sms/bj>
