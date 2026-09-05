# 🔗 PLAN — comment doit se comporter une invitation, et son lien vers l'extérieur

> Écrit le **2026-09-05**, pendant le lot **INVIT**, à la demande d'Adel :
> « établis comment doit se comporter une invitation pour rejoindre depuis l'appli avec un lien vers
> l'extérieur, et fais un plan de tous les comportements qu'on souhaite ».
>
> **Tout ce qui est marqué ✅ MESURÉ a été constaté par commande le 2026-09-05.** Les commandes sont
> collées. Ce qui n'a pas pu être mesuré est marqué `NON VÉRIFIÉ`.

---

## 1. 🧭 D'ABORD : il y a DEUX invitations, pas une

C'est la confusion qui a produit le défaut. Le bouton disait « Inviter » et faisait « partager un
lien ». Ce ne sont pas deux façons de faire la même chose : **ce sont deux mondes différents.**

| | 🎫 **L'invitation** | 🔗 **Le lien** |
|---|---|---|
| À qui elle s'adresse | quelqu'un qui **a déjà FoundClub** | quelqu'un qui **n'a pas l'app** |
| Ce que ça fait | une ligne en base + une notification sur son téléphone | un SMS avec une adresse web |
| Qui décide | **la personne invitée** : elle voit « Accepter / Refuser » | elle, mais **après** avoir installé l'app et créé son compte |
| Qui envoie la demande | le staff **invite** | la personne **demande à rejoindre**, le staff accepte |
| Coût | gratuit (`team.members.manage` est dans les actions gratuites) | gratuit |

> 🧠 **La phrase à retenir** : le lien ne fait entrer personne. Il fait **installer**. C'est ensuite
> la personne qui frappe à la porte, et le staff qui ouvre.

**⇒ On garde les deux.** Supprimer le lien casserait l'acquisition ; ne pas avoir l'invitation, c'est
le bug qu'Adel a mesuré le 05/09 (équipe créée, personne invitée, `team_membership_requests` vide).

---

## 2. 📋 LES 8 COMPORTEMENTS QU'ON VEUT — et où on en est vraiment

Chaque ligne : ce qu'on veut · ce qui se passe **aujourd'hui, mesuré** · le verdict.

### ✅ C1 — « Je clique le lien, j'ai l'app, je suis connecté » → l'app s'ouvre sur l'équipe

**Voulu** : l'app s'ouvre directement, montre l'équipe, et me propose de la rejoindre.
**Aujourd'hui** : ✅ **ça marche**, par deux chemins.
- Le lien envoyé par SMS pointe sur `https://api.foundclubpro.com/install.html?...&type=team&id=…&invite=true`.
  Cette page essaie d'ouvrir `foundclub://team/<id>?invite=true` (le raccourci maison de l'app).
- L'app écoute ce raccourci en **un seul endroit** — `InvitationLinkHost` (`app/src/domains/invitations/InvitationLinkHost.js`,
  monté dans `App.js:305`). Il pose une question, puis emmène sur la fiche d'équipe.

### ✅ C2 — « Lire un lien ne doit RIEN déclencher tout seul »

**Voulu** : cliquer par erreur n'inscrit personne nulle part.
**Aujourd'hui** : ✅ **garanti par construction.** `inviteLink.js` est un module **pur** : il lit une
adresse et rend un sujet + un identifiant, rien d'autre. L'hôte pose la question, l'écran de
destination **redemande confirmation** avant d'envoyer.

### ✅ C3 — « Le lien ne doit transporter aucune donnée personnelle »

**Voulu** : jamais un nom, jamais un numéro de téléphone dans l'adresse.
**Aujourd'hui** : ✅ **garanti.** L'adresse ne porte que le **sujet** (`team`, `club`, `event`,
`squad`) et l'**identifiant**. Le magasin d'attente (`pendingInvite.js`) ne range que ces deux-là.

### ✅ C4 — « Un lien d'un autre site ne doit pas être pris pour une invitation »

**Voulu** : `https://foundclub.app.attaquant.example/i/team/1` doit être refusé.
**Aujourd'hui** : ✅ **refusé.** `isOwnHost` compare le **suffixe** du domaine, jamais une simple
inclusion (`inviteLink.js`).

### ✅ C5 — « Le lien officiel doit ouvrir l'app SANS passer par le navigateur »

C'est ce qu'on appelle un *lien universel* (iOS) / *lien d'application* (Android). Pour qu'il marche,
le site doit servir deux petits fichiers de preuve, et les téléphones les vérifient tout seuls.

**Aujourd'hui** : ✅ **MESURÉ, et c'est une bonne surprise : c'est EN PLACE sur `foundclub.app`.**

```bash
curl -s https://foundclub.app/.well-known/apple-app-site-association
```
```json
{ "applinks": { "apps": [], "details": [ {
  "appID": "RBJCH8458B.com.foundclub",
  "paths": [ "/i/*", "/install.html", "/suppression.html" ] } ] } }
```
```bash
curl -s https://foundclub.app/.well-known/assetlinks.json
# → 200, application/json, package_name "com.foundclub", DEUX empreintes
#   (celle de signature Play + celle de dépôt) → la vérification Android peut aboutir
```

Et côté app, tout est déclaré :
- iOS `ios/foundclub/foundclub.entitlements` → `applinks:foundclub.app` (+ 4 autres hôtes)
- Android `AndroidManifest.xml` → `intent-filter android:autoVerify="true"`, `pathPrefix` `/i/` et `/install.html`

> 🧨 **Le piège que cette mesure a levé** : les fichiers présents **dans le dépôt** sont ceux de
> `admin/public/.well-known/`, et ils ne couvrent **pas** `/i/*`. On aurait conclu « le rail est mort ».
> **Faux** : ce n'est pas eux qui servent. Mesuré :
> `https://api.foundclubpro.com/.well-known/apple-app-site-association` → **HTTP 404**.
> ⇒ **Le seul hôte qui prouve l'app, c'est `foundclub.app`.** L'API n'en sert aucun.

### ⛔ C6 — « Si je n'ai pas l'app, le lien doit me proposer de l'installer » → **LE TROU**

**Voulu** : quelqu'un sans l'app clique, tombe sur une page qui dit « Untel t'invite dans l'équipe X »
et lui propose le bon magasin.

**Aujourd'hui** : ⛔ **ça dépend du lien, et le meilleur des deux n'est pas celui qu'on envoie.**

| Adresse | Sans l'app | Avec l'app |
|---|---|---|
| `api.foundclubpro.com/install.html?...` ← **celle qu'on envoie** | ✅ page d'installation qui renvoie vers l'App Store / Play (mesuré : **HTTP 200, 9 496 octets**) | ⚠️ passe par le navigateur, puis bascule sur `foundclub://` |
| `foundclub.app/i/team/<id>` ← l'adresse **canonique**, prévue, vérifiée | ⛔ **cul-de-sac** : mesuré **HTTP 200 mais 22 733 octets de la page vitrine générale** (`<title>FoundClub \| Trouver un club de sport…`). Aucune mention de l'invitation, aucun bouton magasin | ✅ ouvre l'app **directement**, sans navigateur |

> ⚖️ **La conclusion pratique, et c'est la décision du lot** : **on continue d'envoyer
> `/install.html`.** C'est le seul des deux qui ne laisse personne dans le vide. L'app sait déjà
> lire les deux formes — il n'y a rien à changer côté app.

### ⛔ C7 — « Si j'installe l'app APRÈS avoir cliqué, elle doit se souvenir de l'invitation »

**Voulu** : je clique, j'installe, je crée mon compte, et l'app me propose l'équipe.
**Aujourd'hui** : ⛔ **le contexte est perdu.** Le lien a été cliqué **dans le navigateur** ; l'app,
qui vient d'être installée, n'en sait rien. Le magasin d'attente `pendingInvite` (7 jours) ne se
remplit que si le lien est lu **par l'app**.
**Ce que ça coûterait** : un service de « lien profond différé » (le lien pose un marqueur côté
serveur, l'app le relit au premier lancement). **Ce n'est pas un petit chantier.**

### 🟠 C8 — « Une invitation en attente doit se rappeler à moi après la connexion »

**Voulu** : j'avais rangé une invitation, je me connecte → on me la repropose.
**Aujourd'hui** : 🟠 **à moitié.** `pendingInvite` est rejoué **au démarrage suivant** de l'app, pas
juste après la connexion. Seul le chemin LEAGUE a une reprise après connexion
(`PrivateNavigator.js:105`). ⇒ La personne doit fermer et rouvrir l'app.
**Coût** : petit (rejouer la même lecture après connexion). **Hors périmètre de ce lot.**

---

## 3. 🎯 LE PLAN, EN 4 GESTES — du moins cher au plus cher

| # | Geste | Dépôt | Ce que ça règle | Taille |
|---|---|---|---|---|
| **G1** | ✅ **FAIT par ce lot** : la fiche d'équipe sait envoyer une VRAIE invitation | `app` | Le défaut mesuré du 05/09 | ce lot |
| **G2** | Une page web à l'adresse `/i/:sujet/:id` : « Untel t'invite → Ouvrir dans l'app / Installer » | `web` | ⛔ **C6** — le cul-de-sac. C'est **la** brique qui manque, et elle est petite : la preuve de domaine est déjà en place et couvre déjà `/i/*` | ~1 écran |
| **G3** | Faire émettre l'adresse canonique par l'app (`buildInviteWebUrl`, qui existe et n'a **aucun appelant**) | `app` | Le lien ouvre l'app **sans clignotement de navigateur** | 1 ligne + témoins |
| **G4** | Rejouer l'invitation en attente **après la connexion**, pas seulement au démarrage | `app` | 🟠 **C8** | petit |

> ⛔ **G3 ne doit PAS être fait avant G2.** Aujourd'hui `/i/team/<id>` mène à la page vitrine :
> basculer maintenant remplacerait un chemin qui marche par un cul-de-sac pour tous ceux qui n'ont
> pas l'app. **L'ordre compte.**
>
> 🕳️ **C7 (l'installation qui perd le contexte) n'est PAS dans ce plan** : c'est un chantier à part,
> et il faut décider s'il vaut son prix.

---

## 4. 🧾 CE QUI A ÉTÉ MESURÉ, ET COMMENT

```bash
# La preuve de domaine, côté SITE — elle existe et couvre /i/*
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  https://foundclub.app/.well-known/apple-app-site-association     # → 200  243
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  https://foundclub.app/.well-known/assetlinks.json                # → 200  440

# La preuve de domaine, côté API — elle N'EXISTE PAS en ligne
curl -s -o /dev/null -w "%{http_code}\n" \
  https://api.foundclubpro.com/.well-known/apple-app-site-association  # → 404
curl -s -o /dev/null -w "%{http_code}\n" \
  https://api.foundclubpro.com/.well-known/assetlinks.json             # → 404

# L'adresse canonique tombe sur la vitrine, pas sur une page d'invitation
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  https://foundclub.app/i/team/abc                                # → 200  22733  (index.html du site)

# La page d'installation, elle, répond vraiment
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" \
  "https://api.foundclubpro.com/install.html?type=team&id=abc&invite=true"  # → 200  9496
```

`NON VÉRIFIÉ : que les téléphones aient effectivement validé la preuve de domaine` — commande qui le
prouverait : ouvrir un lien `https://foundclub.app/i/team/<id>` sur un iPhone et un Android réels ;
pourquoi elle n'a pas tourné : cela demande un appareil, pas une commande. **La preuve serveur est
là, ce qui restait le seul point douteux.**
