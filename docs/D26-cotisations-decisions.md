# D26 — Refonte des Cotisations : les 5 décisions posées AVANT de coder

> Exigence E4 de [CLAUDE.md](../../CLAUDE.md) : ce lot touche un tunnel de 22 écrans.
> Écrit le 2026-08-07, depuis `.worktrees/D26-cotisations` sur `origin/staging` = `c8f41b8`.
> **Chaque affirmation d'état ci-dessous a été mesurée par commande, jamais déduite d'un document.**

---

## 🎯 CE QUE LA MESURE A CONTREDIT DANS LE BRIEF — à lire en premier

Le brief annonce « **hub refait + tunnel 17-22 → 6 étapes** ». **La moitié hub est DÉJÀ FAITE.**

```
git log --oneline -8 -- src/views/license/ClubLicenses.js
b8624e5 design(D18): le hub des cotisations repond en un bloc, et le titre ne s affiche plus deux fois
```

`ClubLicenses.test.js` (15 tests) **décrit l'état d'ARRIVÉE**, pas l'état de départ : « ne rend plus
son propre titre », « annonce en une phrase ce qui est encaissé sur ce qui est attendu », « Réessayer »
accentué, plus de carte « Vue d'ensemble », plus de nom tronqué. **Les 41 tests du domaine passent.**

`ClubLicenseCampaignSettings.js`, lui, **n'a pas bougé depuis `1a76c60`** (un correctif d'accents).
⇒ **Le défaut ⑧ d'Adel — « le hub cotisation n'a pas bien changé tous les écrans » — décrit exactement
ça : le hub a changé, les écrans DERRIÈRE lui non.** Le périmètre réel de D26 est **le tunnel seul**.

Deuxième contradiction, mineure : le brief annonce `ClubLicenses.js` à ~5 000 lignes.
**Mesuré : 2 389.** Les ~5 000 lignes du commit D18 sont la SOMME des deux écrans (2 138 + 2 845).

---

## 1️⃣ Quelles routes disparaissent, et qui les appelle encore ?

### 🟢 RÉPONSE : **AUCUNE. Ni retirée, ni créée.**

**Les 22 « écrans » du tunnel ne sont pas 22 routes : ce sont 22 entrées d'un tableau JavaScript
à l'intérieur d'UNE SEULE route.** Preuve par le code, `ClubLicenseCampaignSettings.js:1522-1580` :
`licenseCampaignWizardSteps` est un `useMemo` qui empile des objets `{key, title, subtitle}`, et
`wizardStepCount = licenseCampaignWizardSteps.length` (l. 1588). Il n'y a qu'un `<Stack.Screen>` :

```
grep -rn "ClubLicenseCampaignSettings" src/navigation/
src/navigation/private/stacks/ClubStack.js:192-193   (l'unique declaration)
src/navigation/routeNames.js:75
src/navigation/webRoutes.js:48  ->  /licenses/clubs/:clubId/settings/:campaignId?
```

**Contre-épreuve sur les 10 routes du domaine** — nombre d'appelants de `RouteNames.<X>` dans `src/` :

| Route | Appelants | Verdict |
|---|---|---|
| ClubLicenseCampaignDetail | 9 | vivante |
| ClubLicenseCampaignSettings | 13 | vivante |
| ClubLicenseMemberDetail | 6 | vivante |
| ClubLicensePayments | 5 | vivante |
| ClubLicenses | 7 | vivante |
| CMLicensesDashboard | 3 | vivante |
| LicenseCheckoutStatus | 4 | vivante |
| MyLicense | 6 | vivante |
| PublicLicensePayment | 3 | vivante |
| SuperAdminLicenses | 4 | vivante |

**Aucune n'est orpheline ⇒ aucune ne peut être retirée**, et le passage à 6 étapes n'en demande aucune.

### 📐 CHIFFRE `check:routes` ATTENDU : **225 / 213 / 211 — INCHANGÉ**

`+0 route, −0 route`. **Le dépôt `web` n'a RIEN à suivre pour ce lot.**
⚠️ Non mesuré par moi, et volontairement : le script lit `D:/App/fc/app` **en dur** et rendrait un
vert faux depuis un worktree. **À mesurer depuis `D:/App/fc/web` par le chef d'orchestre.**

---

## 2️⃣ Le nom des 6 routes conservées ou créées

**Sans objet : il n'y a pas 6 routes, il y a 6 CLÉS D'ÉTAPE dans une seule route.**
La route reste `ClubLicenseCampaignSettings` → `/licenses/clubs/:clubId/settings/:campaignId?`.

Les 6 clés internes (elles ne sortent jamais du fichier, aucune ne va en base) :

| n | clé | Titre affiché | Ce qu'elle absorbe des 22 anciennes |
|---|---|---|---|
| 1 | `identity` | Nouvelle campagne / Identité | `type` · `name` · `period` · `season` · `description` |
| 2 | `audience` | Public & tarif | `amount` · `targetMode` (+ rôles/équipes/catégories/sections/niveaux) · `pricingRules` |
| 3 | `payment` | Paiement | `paymentMethods` · `paymentInstructions` · `paymentOnline` · `installmentsToggle/Setup/Options/Schedule` |
| 4 | `documents` | Documents | `documents` |
| 5 | `reminders` | Relances | `reminderToggle` · `reminderStatuses` · `reminderTiming` · `reminderMessage` |
| 6 | `review` | Récapitulatif | `review` · `internalNote` · `paymentOwner` · `overdueDate` |

**22 anciennes clés → 6. Aucune n'est perdue : les 16 qui disparaissent de la barre de progression
deviennent une feuille (sheet) ou une ligne d'« Options avancées ».** C'est le point dur du lot :
une étape supprimée sans destination, c'est le motif exact de la régression la plus chère du projet
(du code devenu inatteignable).

---

## 3️⃣ Que deviennent les campagnes DÉJÀ CRÉÉES ?

### 🟢 RÉPONSE : **elles s'ouvrent et se rééditent sans perte. Aucune migration.**

**Raison mécanique** : le tunnel ne stocke rien qui lui soit propre. Il hydrate son état depuis
`campaign` (l. 1249-1296) et réémet **le même objet `payload`** (l. 1625-1688) vers
`updateLicenseCampaign`. Je ne touche **ni le payload, ni un nom de champ, ni une valeur de donnée**.

⚠️ **Le vrai risque n'est pas la perte de données, c'est la perte d'ACCÈS.** Trois familles de
réglages existent en base et ne figurent PAS dans les 16 captures du pack :

| Réglage en base | Sort de la maquette | Ce que je fais |
|---|---|---|
| `targetConfig.categoryIds` / `sectionIds` / `levelIds` | la maquette ne cible que rôles + équipes | **conservés, repliés sous « Filtres avancés », affichés seulement si la campagne en utilise déjà un** |
| `paymentModes.external_link` + `externalPaymentUrl` | la maquette liste 5 moyens, pas 6 | **conservé en 6ᵉ interrupteur** — un club qui l'utilise doit pouvoir le couper |
| `memberInstallmentChoiceAllowed`, `onlineInstallmentsEnabled`, `onlinePaymentRequired`, `dueDate` (retard), `paymentOwner`, `internalNote` | repliés | **déplacés en feuille « Ajuster l'échéancier » et en « Options avancées » du récap** |

> Sans ce garde-fou, une campagne filtrée par catégorie garderait son filtre dans le payload
> **sans que personne puisse plus le modifier** : la donnée survit, l'écran ment.

---

## 4️⃣ HelloAsso au niveau CLUB : où vit ce réglage aujourd'hui, et qui le lit ?

### 🟢 IL EST **DÉJÀ** AU NIVEAU CLUB CÔTÉ SERVEUR. Seule l'INTERFACE est au mauvais endroit.

```
src/services/license/licenseService.js:156
  POST /licenses/providers/helloasso/connect
```
Sa charge utile (`ClubLicenseCampaignSettings.js:1701-1712`) est
`{ clubId | multisportClubId, clientId, clientSecret, environment, organizationSlug }` :
**elle porte un identifiant de CLUB, jamais un identifiant de campagne.** La campagne ne fait que
**lire** un cliché en lecture seule, `campaign.paymentProviderSnapshot.helloasso` (l. 286).

Qui l'appelle : `ClubLicenseCampaignSettings.js` (le tunnel) et `views/admin/SuperAdminLicensesDashboard.js`.

**Décision, et pourquoi ce chemin est le plus sûr** : le formulaire (slug / client id / client secret /
environnement) **sort du tunnel** et devient une **feuille « Réglages HelloAsso du club » ouverte
depuis le hub des Cotisations** — qui est le foyer du club pour ce sujet, qui est dans mon périmètre,
et qui **n'ajoute AUCUNE route** (donc rien à poser côté `web`, `check:routes` ne bouge pas).
Dans le tunnel, l'étape 3 ne garde qu'**un interrupteur** + « Compte du club connecté ✓ — géré dans
Réglages du club », exactement la capture `03-paiement.png`.

⚠️ **Écart assumé avec le brief** : il dit « → Réglages du club ». `ClubEdit` est hors périmètre
(`src/views/club/`) et y aller créerait une route. **Je le signale, je ne le fais pas.**

---

## 5️⃣ L'échéancier généré : calcul d'app ou donnée serveur ?

### 🟢 **CALCUL D'APP. Aucun lot `admin` nécessaire pour l'échéancier.**

`installmentSchedule` est **construit dans l'écran** (l. 1449-1458) et **envoyé** dans le payload
(l. 1659). Le serveur le reçoit, il ne le fabrique pas. Générer `montant ÷ N` avec arrondi au centime
est donc un pur changement d'app.

**Règle d'arrondi retenue** (la somme doit faire exactement le montant) : `base = floor(total/N)`,
puis les `total − base×N` premiers centimes sont ajoutés à la **première** échéance.
Exemple du brief : 100 € en 3 fois → **33,34 + 33,33 + 33,33 = 100,00**. ✔️

### 🔴 EN REVANCHE — DEUX POINTS DU BRIEF EXIGENT LE SERVEUR. Je ne les fais pas, je rends le chemin.

1. **« Dirigeants / Entraîneurs → cocher les PERSONNES »** — `targetConfig` n'a pas de liste de
   personnes. `normalizeTargetConfigPayload` (l. 654-676) n'émet que
   `{ roles, teamIds, categoryIds, sectionIds, levelIds, includeAllMembers }`.
   **Il manque `memberIds`.** ⇒ lot `admin` : ajouter `memberIds` au `targetConfig` et à la
   résolution des affectations.
   **Ce que je livre à la place** : les pilules de rôle ciblent le rôle ENTIER, avec le **compte réel
   des personnes concernées** calculé depuis `clubMembers`, et une phrase qui dit que la sélection
   personne par personne arrive.
2. **« Tarif spécial : équipes dépliables pour cocher les joueurs »** — `ruleType` n'accepte que
   `['category', 'level', 'role', 'section', 'team']` (l. 1831). **Il n'existe pas de règle au joueur.**
   ⇒ lot `admin` : ajouter un `ruleType: 'member'` porteur d'une liste de personnes.
   **Ce que je livre à la place** : la feuille « Ajouter une règle » avec libellé → cible (équipe par
   défaut, les autres types restant accessibles) → montant, **et plusieurs règles possibles**, ce qui
   est la partie réellement demandée et réellement supportée.

---

## ⚖️ CE QUI RESTE OUVERT POUR ADEL — je n'attends pas la réponse, j'avance

1. **La sélection personne par personne** (Dirigeants/Entraîneurs) et **le tarif spécial au joueur**
   demandent un lot `admin`. Sans lui, le ciblage reste au rôle et à l'équipe.
2. **Le lien de paiement externe** est gardé en 6ᵉ interrupteur alors que la maquette n'en montre
   que 5 : le retirer rendrait ce mode inéditable pour les clubs qui l'utilisent.
