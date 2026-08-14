# Lot C-D — Detection : constituer les equipes (ecrans 13, 14, 15)

> **Code E4** : ce lot touchait a priori 2 depots et un domaine absent de l'app.
> Les 5 decisions ci-dessous sont rendues AVANT la premiere ligne de code, chacune
> avec sa mesure. Releve du 2026-08-14, `app` `32f9fe5` / `admin` `47794e4`.

---

## 0. LA MESURE QUI OUVRE LE LOT — et ce qu'elle contredit

```
grep -rE "checkInFirst|memberMode|detectionSplit|splitBy|requested_position|chasuble|bibColor|playtime" app/src
=> 0 occurrence, 0 fichier
```

✅ **Confirme cote `app`.** Le vocabulaire entier de la detection est absent de l'application.

🧨 **Mais la meme commande sur `admin/src` rend 29 lignes.** Le prompt de ce lot annonce
« la chasuble n'existe nulle part » : c'est vrai **de l'app**, et faux du serveur.
`bibColor` y est deja, avec sa liste blanche de 4 valeurs.

---

## 1. Le serveur sait-il DEJA tout faire ?

### Ce que j'ai mesure

| Ce que le serveur porte | Ou | Etat |
|---|---|---|
| `DetectionSplit` : `checkInFirst`, `memberMode`, `splitBy`, `teamCount`, `teams[]`, `rounds[]` | `event-composition.ts:455-468` | ✅ ecrit |
| `memberMode` ∈ `mix` \| `grouped` \| `excluded`, defaut `grouped` | `:479` | ✅ = les 3 rangees radio de l'ecran 13 |
| `splitBy` ∈ `requested_position` \| `none`, defaut `none` | `:487` | ✅ = l'interrupteur de l'ecran 15 |
| `BIB_COLORS = ['jaune','rouge','bleu','vert']` | `:470` | ✅ = les 4 pastilles de l'ecran 14 |
| Aller-retour complet : lecture `:695`, ecriture `:1840-1846`, renvoi `:1859`, `:1948`, `:2025`, `:2073`, `:2115` | | ✅ prouve par lecture |
| Garde « absent ≠ vide » : un enregistrement muet **n'efface pas** la repartition | `:1840-1842` | ✅ |
| `appliedPosition` — le poste demande en candidatant | `:249-280`, expose `:186` | ✅ = `POSTES RECHERCHES` de l'ecran 15 |
| `participantSource` ∈ `team_player` \| `external_participant` \| `manual` | `:196`, `:228`, `:258` | ✅ = « 34 inscrits · 12 de Senior 1 » de l'ecran 13 |

🔑 **Et le commentaire du serveur tranche la question de la migration** (`:452-454`) :
> « JSON libre range dans event.composition, a cote de byTeam : **aucune migration**. »

⚠️ **La seule ombre, et elle est mesuree** : `grep "\.checkInFirst|\.memberMode|\.splitBy"`
hors du normalisateur ⇒ **0 lecteur**. Le serveur **range et rend** ces champs ; il **n'agit
jamais** dessus. C'est exactement le motif `requireResponse` du lot D79.

### Les options

- **A.** Etendre le serveur pour qu'il agisse sur les 3 champs ⇒ lot 2 depots + **un deploiement staging**.
- **B.** L'app calcule la repartition et **range son RESULTAT** dans `detectionSplit` ⇒ lot `app` seul, **0 deploiement**.

### 🎯 Reco : **B**

Le serveur suffit. Ce que l'ecran 15 produit, c'est **qui est dans quelle equipe** — une
decision du coach, pas un calcul serveur. La ranger est exactement ce que le serveur sait
deja faire. Lui faire recalculer la meme arithmetique serait un **doublon** d'implementation
(§1 bis, barreau 2 : ca existe deja dans ce depot).

⇒ **Ce lot devient un lot `app`, avec UNE exception de 4 lignes cote `admin` (decision 3).**

---

## 2. La chasuble : ou vit-elle ?

### Ce que j'ai mesure

- **Le rangement est deja fait** : `teams[].bibColor`, liste blanche de 4 valeurs, dans le
  JSON libre (`:490-492`). ⇒ **0 schema modifie, 0 migration, 0 deploiement.**
- **La question qui reste n'est pas le rangement, c'est la COULEUR.** Le pack demande
  jaune `#F5C518` · rouge `#E5484D` · bleu `#01b3f4` · vert `#30A46C`.

| Chasuble | Pack | Jeton existant | Ecart |
|---|---|---|---|
| Bleu | `#01b3f4` | `Colors.primary500` = **`#01b3f4`** | ✅ **exact** |
| Jaune | `#F5C518` | `Colors.gold500` = `#FFD700` | leger |
| Rouge | `#E5484D` | `Colors.error500` = `#ff284f` | leger |
| Vert | `#30A46C` | `Colors.success500` = `#27d6a3` | leger |

⛔ **Un hex neuf obligerait a inscrire le fichier dans `scripts/theme-hex-allowlist.json`** —
c'est une **allowlist**, donc la liste noire R4 (point 4), donc **GO Adel date**.

### Les options

- **A.** Poser les 4 hex du pack + inscrire les fichiers a l'allowlist ⇒ **GO Adel requis**, lot bloque.
- **B.** Mapper sur les 4 jetons existants ⇒ 1 exact, 3 voisins, **0 hex, 0 allowlist**.

### 🎯 Reco : **B**

Le pack autorise les chasubles comme « seule entorse a la palette », mais la methode place
l'allowlist derriere un GO. **B avance sans rien demander** et l'ecart est declare ici.

---

## 3. Le pointage (`checkInFirst`) : un ecran de plus ou un etat de l'ecran 13 ?

### Ce que j'ai mesure

- Le pack decrit `checkInFirst` **sous le titre `ENSUITE` de l'ecran 13**, comme un
  interrupteur (« Pointer les presents d'abord »), active par defaut. **Il ne dessine aucun
  ecran de pointage** : la numerotation va de 13 a 17 sans trou, et l'ecran 13 porte
  `Etape 1/3`.
- Un vrai pointage existe **cote serveur** : `event-attendance` avec `arrivedAt`
  (`event-governance.ts:362-395`). Il sert le suivi de presence d'un **match**.
- 🧨 **Trouvaille** : `normalizeDetectionSplit` reconstruit un objet **a clefs fixes**
  (`:477-499`). Un champ `presentIds` envoye par l'app serait **silencieusement jete**.

### Les options

- **A.** Brancher le pointage sur `event-attendance` ⇒ un aller-retour de plus, un modele
  concu pour le match, et une detection n'a pas d'« equipe » a pointer.
- **B.** Pointage **local a la repartition**, range dans `detectionSplit.presentIds`
  ⇒ **4 lignes cote `admin`** (type + normalisateur), **aucune migration** (c'est du JSON),
  mais **un deploiement staging pour prendre effet**.
- **C.** Pointage purement transitoire, jamais range ⇒ 0 ligne serveur, mais le coach qui
  quitte l'ecran **perd son pointage**.

### 🎯 Reco : **B, avec repli automatique sur C**

L'app **envoie** `presentIds` et **tolere son absence au retour**. Tant que le serveur n'est
pas deploye, le pointage se comporte comme **C** (transitoire) : rien ne casse, rien ne ment.
Une fois deploye, il devient durable **sans retoucher l'app**.

⇒ **C'est la seule ligne `admin` de ce lot.** Elle est nommee, chiffree, et **non deployee**.

---

## 4. La repartition automatique : on la deplace ou on la reecrit ?

### Ce que j'ai mesure

L'existant est bien reel : `MultiTeamCompositionBoard.js:990-1026` (`handleGenerateAuto`)
+ `:1417-1488` (le compteur `− / N equipes / +`). Il appelle
`generateEventCompositionDraft` → serveur `generateDraft` → `buildAutoGeneratedPack`
(`event-composition.ts:894-958`).

**Ce que fait vraiment `buildAutoGeneratedPack`** :

1. trie les joueurs **par ordre alphabetique** (`:918`) ;
2. remplit **l'equipe 1 jusqu'a saturation**, puis l'equipe 2, etc. (`:921-941`) — glouton,
   pas equilibre ;
3. le reste devient `reservePlayerIds` (`:943`) ;
4. ✅ **ne perd ni ne duplique personne** (`placedPlayerIds`, un `Set`).

🧨 **Deux constats qui changent la reponse :**

- Il **ne lit ni `splitBy`, ni `memberMode`, ni `checkInFirst`** (0 occurrence). Les trois
  reglages des ecrans 13 et 15 ne l'atteignent pas.
- **Il ne produit pas la meme chose que l'ecran 15.** Il rend un **placement sur le terrain**
  (`byTeam`, des slots) — c'est l'ecran **16**. L'ecran 15 rend une **constitution d'equipes**
  (`detectionSplit.teams[].players`).

⛔ Et `tactical_v2` est une **zone interdite** de ce lot, sans suppression autorisee :
**un deplacement au sens propre (couper/coller) est impossible ici.**

### Les options

- **A.** Appeler `generateDraft` depuis le nouvel ecran 15 ⇒ reutilise le serveur, mais
  **remplace tout le pack**, ignore les 3 reglages, et repond a la mauvaise question.
- **B.** Calculer la constitution dans l'app, la ranger via `saveEventCompositionDraft`.

### 🎯 Reco : **B — et je corrige le prompt sur ce point**

« On la deplace » etait la bonne intention (⛔ ne pas reecrire ce qui marche), mais la mesure
montre que **ce qui marche ne calcule pas ce dont l'ecran 15 a besoin**. Ce qui est reutilise,
et c'est l'essentiel : **le meme aller-retour serveur** (`saveEventCompositionDraft`), **le
meme contrat**, **le meme JSON**. L'ancien hub **n'est pas touche** — preuve : `git diff`
rend **0 fichier** sous `src/views/tactical_v2/`.

---

## 5. Le mot qui remplace « banc » en detection

### Ce que j'ai mesure

- **Le pack donne lui-meme le mot** : le bandeau du bas de l'ecran 16 s'appelle
  **`NON AFFECTES · N`** (§2, rangee 6). Celui de l'ecran 17 s'appelle `ROTATION · N`.
- La regle du pack (§6) : « Le mot **banc** n'apparait jamais en detection, le mot **rotation**
  jamais en match, le mot **convocation** jamais en detection. »
- L'ancien hub le viole **deux fois** : `MultiTeamCompositionBoard.js:1256` et `:1570`
  affichent **« Remplacants / en attente »**.

### 🎯 Reponse : **« NON AFFECTES »**

| Ou | Etat |
|---|---|
| Mes 3 ecrans neufs | ✅ nes avec le bon mot — un joueur sans chasuble est **non affecte** |
| `MultiTeamCompositionBoard.js:1256` et `:1570` | ⛔ **zone interdite** de ce lot ⇒ **lot C-F** |

⚠️ Et le mot **convocation** est banni aussi : aucune de mes clefs de traduction ne reutilise
le bloc `matchCallUp`. La detection a son propre bloc, `detection`.

---

## 6. Ce que ces 5 decisions changent pour le lot

| | Avant les mesures | Apres |
|---|---|---|
| Depots touches | `app` + `admin` | **`app`** + **4 lignes** dans `admin` |
| Migration | redoutee | **aucune** — le JSON existe deja |
| Deploiement | suppose necessaire | **non bloquant** — l'app tolere le serveur actuel |
| Ancien hub | « a deplacer » | **pas touche du tout** |
