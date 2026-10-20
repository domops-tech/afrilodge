# Séjours — contrôle visuel du 18 octobre 2026

Fichier : https://www.figma.com/design/D1yQiR8DLj4ykZGPzIMqUP

## Résultat et limite actuelle

Les **55 écrans initialement présents ont été examinés visuellement**, sur bureau et mobile. Les pages principales ont été confrontées à **52 captures du navigateur local**. Les variantes de recherche, d'identification et de refus administratif ont également été examinées ; les captures de travail et les composants sources ont servi à identifier leurs états.

**Examiné ne signifie pas validé sans réserve.** Des corrections ont été effectuées, mais le contrôle final après ces corrections et celui de tous les nouveaux états n'ont pas pu être terminés : le connecteur Figma refuse désormais `get_screenshot` et `use_figma`, avec le message « You've reached the Figma MCP tool call limit on the Starter plan ». Les aperçus intégrés à `use_figma` ont permis de poursuivre un temps après le premier refus, puis cette voie a été bloquée aussi. Aucun contrôle visuel n'est demandé à l'utilisateur en substitution.

Le fichier contient **72 écrans : 55 initiaux et 17 états ajoutés**. Les 17 ajouts restent marqués **à contrôler**, sans déclaration de fidélité finale. Les identifiants et les statuts sont dans [controle-2026-10-18.json](controle-2026-10-18.json).

## Corrections effectivement appliquées dans Figma

- Cadres des 55 écrans délimités pour empêcher l'export de contenu extérieur au cadre.
- Rétablissement du contraste des quatre badges « En retard (> 24h) » : le fond rouge utilise désormais une opacité de 10 %, distincte du texte rouge.
- Placeholders des champs de connexion et de recherche ramenés à une ligne avec troncature, et couleur de placeholder distinguée de celle d'une valeur saisie.
- Ajout de texte dans 12 champs de date que l'import avait laissés vides. Le format affiché suit le navigateur utilisé pour les références (`mm/dd/yyyy`) ; les décorations natives du navigateur, dont l'icône de calendrier, ne sont pas entièrement reproduites.
- Centrage bureau des pages de reprise et de liste des réservations ; largeur de reprise limitée à 384 px.
- Bouton « Créer le bien » bureau ramené à la largeur de 512 px du formulaire, au lieu de la largeur de l'écran.

Le contrôle après correction est incomplet à cause du quota. Le script de corrections préparé ne doit pas être confondu avec ces modifications déjà appliquées.

## États ajoutés dans Figma

Les ajouts utilisent des textes et cadres natifs, les instances des composants Button/Input existants et les variables de couleur disponibles. Aucune capture de l'interface complète n'a été importée comme image de maquette.

| Parcours | États ajoutés |
|---|---|
| Connexion propriétaire | Code bureau, code invalide bureau, code mobile |
| Connexion terrain | Code bureau, code invalide bureau |
| Connexion administration | Code bureau, code invalide bureau |
| Reprise voyageur | Code bureau, code invalide bureau |
| Visite terrain | Photographies bureau, photographies hors connexion bureau, équipements bureau, repères bureau, justificatifs bureau, récapitulatif bureau, synchronisation en attente bureau, synchronisation échouée bureau |

Ces 17 états sont des ajouts de travail. Certains aperçus ont révélé des détails à reprendre : le titre court « Application terrain » peut se replier, et la dernière paire bureau/mobile doit être déplacée pour éviter un chevauchement sur le canevas. Le script [corrections-a-reprendre-2026-10-18.js](corrections-a-reprendre-2026-10-18.js) prépare précisément ces corrections ; **il n'a pas pu être exécuté**.

Une ébauche supplémentaire d'identification bureau a été retirée après détection d'écarts de composition ; elle n'est pas comptée dans les 72 écrans.

## Références et états préparés pour la suite

La [galerie locale](controle-2026-10-18/index.html) contient **52 références principales et 44 captures d'états**, avec filtre par nom ou largeur. Ce sont des références du navigateur, pas des captures Figma.

Les 44 références couvrent, à 1440 et 390 px :

- code et code invalide des trois connexions et de la reprise voyageur ;
- identification, code, code invalide et dates indisponibles de réservation ;
- recherche sans résultat et recherche avec paramètres de contrôle ;
- photographies, mode hors connexion, équipements, repères, justificatifs, récapitulatif, synchronisation en attente et synchronisation en erreur de la visite.

Attention : la capture nommée `recherche-invalide` dans cette série utilise un paramètre `guests=-1` que l'application ignore. Elle **ne prouve pas l'état d'erreur**. La variante mobile existante dans Figma utilise bien un budget négatif et affiche le message d'erreur ; utiliser `budget=-1` lors de la prochaine capture bureau. Cette série est conservée avec cette réserve explicite, plutôt que présentée comme une validation réussie.

Les snapshots DOM et les lots de construction sont conservés dans `controle-2026-10-18/etats/` et `controle-2026-10-18/reprise/`. Ils constituent une préparation de reprise, **pas une preuve d'intégration ou de validation**. Les lots doivent être dimensionnés pour respecter la limite de 50 000 caractères par appel et contrôlés visuellement après application. La construction des états de réservation doit notamment conserver la position du récapitulatif et l'ordre montant/devise.

## Réserves globales et différences de données

- **Police :** Figma utilise Tinos pour les titres, car Georgia et Times New Roman ne sont pas chargeables dans le moteur connecté. Des différences de césure et de hauteur subsistent. La fidélité typographique exacte n'est pas validée ; le texte courant utilise Geist.
- **Données :** les captures bureau de la liste terrain et de la gestion du bien ont été prises avant l'ajout des visites et réservations de démonstration. Leurs variantes mobiles présentent ensuite ces données. Ce sont des différences d'état, à nommer ou compléter, plutôt que des blocs disparus au rendu.
- **Photos :** les images multicolores des fiches administratives sont les fichiers de démonstration présents dans l'application. Elles ne représentent pas des photos réelles de logement.
- **Géolocalisation refusée :** la lecture du composant `VisitWorkflow` montre que l'erreur est définie, puis l'étape passe aux photos alors que le message n'est rendu que dans l'introduction. Une maquette de cette erreur visible ne doit pas être inventée et présentée comme un état réel de l'application. Ce comportement nécessite une correction applicative distincte si cet état doit être exposé.

## Vérifications et reprise

Les 52 pages principales ont répondu dans le navigateur ; aucune capture de cette série n'a présenté de débordement horizontal à 1440 ou 390 px. Ce constat concerne l'application et ne constitue pas un résultat de comparaison automatique pixel par pixel avec Figma.

La simulation terrain est restée dans le navigateur : les photos de démonstration ont été stockées dans IndexedDB et la requête de signature d'upload a été interceptée avec une réponse 503 pour produire l'erreur. Aucune visite n'a été synchronisée et aucun paiement n'a été déclenché. Les OTP proviennent du fournisseur local de développement ; aucune confirmation de réservation n'a été effectuée.

Prochaine action après rétablissement de l'accès Figma : exécuter la correction ciblée, vérifier les 17 ajouts et les corrections récentes, intégrer les états mobiles préparés, puis contrôler chaque nouvel écran. Tant que ces opérations ne sont pas faites, le travail global reste **partiellement terminé**.
