# Fiche — preuve du clavier sur un simulateur d'iPhone (CLAVIER-FOND, 28/10/2026)

## Pourquoi
Six lots clavier (ANDROIDBAR-6, CLAVADV, CLAVREGLE, CLAVPOP, CLAVPOP-ANDROID, CLAVSCROLL) avaient des
tests jest verts, et Adel a vu sur iPhone que la feuille « Nommer l'adversaire » ne bougeait pas.
Un test jest prouve un calcul ; il ne voit pas l'écran. Ce passage-ci photographie l'écran
clavier ouvert, sur un vrai simulateur iOS.

## Ce qui tourne (workflow `ios-simulateur-clavier` de `codemagic.yaml`, lancement MANUEL)
1. Configuration de l'app vers la RECETTE (`api-staging`), plist Firebase apparié.
2. `npm ci`, `pod install`, construction Release pour le simulateur, SANS signature ni envoi.
3. Premier iPhone disponible du Xcode 26.0, app installée, Maestro installé.
4. `nommer-adversaire.yaml` : connexion, `foundclub://event/<match>`, « Nommer l'adversaire »,
   captures 01-03.
5. `nom-equipe.yaml` : connexion, Équipes → Nouvelle équipe → étape 1/8, captures 11-12.
6. Captures rendues en artefacts, même si une étape a échoué.

## Ce qu'Adel prépare (une fois)
- Dans Codemagic, groupe de variables `foundclub_recette` : `FC_RECETTE_TEL` (numéro de TEST
  Firebase d'un compte de recette entraîneur·e de club) et `FC_RECETTE_CODE` (son code de test).
  Jamais un vrai numéro.
- Un match de recette SANS adversaire, du club de ce compte : son `documentId` va dans l'entrée
  `match_id` au lancement.

## Coût estimé
| Étape | Minutes de Mac M2 |
|---|---|
| npm ci + pod install | 6 à 9 |
| Construction simulateur (Release) | 8 à 14 |
| Simulateur, Maestro, 2 scénarios | 4 à 6 |
| **Total** | **≈ 20 à 30** (plafond posé : 45) |

Relevé du 28/10 (`codemagic.py dernieres`) : ~248 minutes sur 500 utilisées en octobre ; une TestFlight
prend 10 à 22 min. Un passage tient dans le reste du mois ; facturation éteinte = Codemagic bloque
au lieu de facturer (0,095 $/min sinon, soit ~2 à 3 $ le passage).

## Lancer (décision d'Adel, rien n'a été lancé)
Codemagic → application FoundClub → « Start new build » → workflow « iOS simulateur — clavier »
→ branche (ex. `fix/CLAVIERFOND-app` pour voir la correction, `staging` pour voir la 2.6.84)
→ `match_id`. `scripts/ci/ios/codemagic.py lancer` ne sait lancer que la TestFlight.

## Ce qui reste NON VÉRIFIÉ avant le premier passage
- **Connexion** : les sélecteurs de `_connexion.yaml` viennent des textes de `fr.js`, jamais rejoués.
  La recette vérifie les jetons du projet Firebase `found-club` (preparer_build.py) : le numéro de
  test doit y être déclaré. Sur simulateur, Firebase peut demander un reCAPTCHA (pas de push
  silencieux) : si la capture montre une page web, la connexion est le point à reprendre.
- **Lecture des captures** : `assertVisible` de Maestro ne sait pas qu'un élément est SOUS le
  clavier. La preuve est la capture 02 / 11, regardée par Adel ou par une session.
