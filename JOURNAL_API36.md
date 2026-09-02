# 🧗 JOURNAL DU CHANTIER API 36 — React Native 0.78 → 0.81, `targetSdk` 36

> **À quoi sert ce fichier.** Google refuse tout envoi Android depuis le 31/08/2026 tant que
> l'app ne vise pas Android 16 (API 36). Viser 36 impose React Native ≥ 0.81. On y va
> **une marche à la fois**, et **chaque marche laisse sa trace ici** : ce qui a cassé, ce que
> le guide officiel a changé, ce qu'il a fallu faire à la main.
>
> **C'est le livrable pour le prochain qui montera.** Si ce chantier s'arrête en cours de
> route, ce fichier dit exactement où il en est et ce qui l'attend.

**Copie de travail** : `D:/App/fc/.worktrees/API36-app` · branche `chantier/API36-android-16`
· base **app `0f6afbe8`**.

---

## 0. LE POINT DE DÉPART — mesuré, pas cité

| Quoi | Valeur constatée | Comment |
|---|---|---|
| React Native | **0.78.0** | `package.json` |
| React | 19.0.0 | `package.json` |
| `targetSdkVersion` / `compileSdkVersion` | **35 / 35** | `android/build.gradle:5-6` |
| `buildToolsVersion` | 35.0.0 | `android/build.gradle:3` |
| `minSdkVersion` | 24 | `android/build.gradle:4` |
| `kotlinVersion` | 2.0.21 | `android/build.gradle:8` |
| Gradle wrapper | 8.12-all | `android/gradle/wrapper/gradle-wrapper.properties` |
| `@react-native-community/cli` | 15.0.1 | `package.json` |
| Node de la machine | v24.16.0 | `node -v` |
| npm | 11.13.0 | `npm -v` |

### Les 4 portes, à la base — TOUTES VERTES

| Porte | Mesure | Code de sortie |
|---|---|---|
| `jest --ci --runInBand --silent --forceExit` | **468 suites / 5 516 tests**, 14 instantanés | **0** |
| `lint:no-regression` | erreurs 1 288 / 1 290 (**−2**) · alertes 7 786 / 7 809 (**−23**) | **0** |
| `type-check:no-regression` | 5 336 / 5 424 (**−88**) | **0** |
| `verify:theme-contract` | OK | **0** |

> ✅ La copie **reproduit exactement** la base annoncée (468 / 5 516). Le terrain est sain avant
> qu'on y touche : tout ce qui rougira ensuite viendra bien de la montée, et de rien d'autre.

### Le `node_modules` de cette copie a été DÉSOLIDARISÉ du partage

| Étape | Mesure |
|---|---|
| Avant — jonction | `LinkType = Junction` vers `D:\App\fc\app\node_modules`, **755 entrées** |
| `cmd /c rmdir` (le lien seul, jamais `Remove-Item -Recurse`) | exit 0 |
| **Contrôle de sûreté : le partage juste après** | **755 entrées — INTACT** |
| `npm ci` dans la copie | exit 0, 1 351 paquets, 39 s, patch `react-native-gifted-chat@2.8.1` réappliqué |
| Après — vrai dossier | `LinkType` vide, **755 entrées**, `react-native` 0.78.0 |

> ⚠️ Le partage `D:/App/fc/app/node_modules` n'a **jamais** été touché : 755 avant, 755 après.
> C'est ce partage qui était tombé de 753 à 182 entrées le 20/08 et avait fait perdre leurs
> portes à deux lots au même instant.

---

## 1. CE QUE LE GUIDE OFFICIEL DEMANDE — les 3 marches, lues avant d'agir

Diffs récupérés depuis l'Upgrade Helper (`rn-diff-purge`, branche `diffs`), pas devinés.

### Marche 1 — 0.78.0 → 0.79.7

| Fichier | Ce qui change |
|---|---|
| `package.json` | `react-native` 0.79.7 · `@react-native-community/cli*` 15.0.1 → **18.0.0** · `@react-native/*` 0.79.7 |
| `android/gradle/wrapper/gradle-wrapper.properties` | gradle **8.12-all → 8.13-bin** |
| `android/gradlew`, `gradle-wrapper.jar` | scripts du wrapper |
| `Gemfile` | 🔶 **non appliqué** — voir §M1 |
| `ios/AppDelegate.swift` | 🔶 **non appliqué** — voir §3 D1 |

### Marche 2 — 0.79.7 → 0.80.3

| Fichier | Ce qui change |
|---|---|
| `package.json` | `react` 19.0.0 → **19.1.0** · `react-native` 0.80.3 · cli **19.1.2** · `@types/react` ^19.1.0 · `react-test-renderer` 19.1.0 |
| `android/build.gradle` | `kotlinVersion` **2.0.21 → 2.1.20** |
| wrapper | gradle 8.13 → 8.14.1 |
| `tsconfig.json`, `.prettierrc.js`, `MainApplication.kt` | retouches du gabarit |

### Marche 3 — 0.80.3 → 0.81.6 — **c'est celle qui porte l'API 36**

| Fichier | Ce que le guide demande | Ce que j'ai fait |
|---|---|---|
| `android/build.gradle` | `buildToolsVersion` **36.0.0** · `compileSdkVersion` **36** · `targetSdkVersion` **36** | ✅ les deux premiers · 🔶 **`targetSdk` reporté au lot A3** — voir §M3 |
| `android/gradle.properties` | ajout de `edgeToEdgeEnabled=false` | ✅ appliqué, avec un commentaire qui dit ce qu'il fait **vraiment** — ⚠️ **ce n'est PAS un opt-out**, voir §E2E |
| `android/app/src/main/AndroidManifest.xml` | `usesCleartextTraffic` devient un **placeholder** | 🔶 **reporté au lot A4** — ce dépôt a déjà un manifeste de debug, la solution y est plus simple (voir §4) |
| `android/app/src/debug/AndroidManifest.xml` | **supprimé** | 🔶 **conservé** — c'est justement lui qui rend le placeholder inutile ici |
| `package.json` | `react` **19.1.4** · `react-native` 0.81.6 · cli **20.0.0** · `typescript` ^5.8.3 · `node >= 20` | ✅ tout, **sauf `typescript`** : laissé en 5.0.4 et **la mesure a prouvé que c'était le bon choix** (voir §M3) |
| wrapper | gradle 8.14.1 → 8.14.3 | ✅ (`gradlew`, `gradlew.bat` et le `.jar` sont **identiques** entre 0.80.3 et 0.81.6) |

> 🎁 **Un point de la liste stores devient plus simple en 0.81** : le `usesCleartextTraffic="true"`
> écrit en dur (R12) devient un placeholder faux en release.
> ⛔ **Mais PAS l'edge-to-edge.** J'avais écrit le contraire en lisant le gabarit ; c'est faux, et
> la mesure est en §E2E ci-dessous.

---

## E2E. `edgeToEdgeEnabled=false` N'EST PAS UN OPT-OUT — la mesure qui corrige une lecture trop rapide

En lisant le diff du gabarit 0.81, j'ai d'abord cru que la ligne `edgeToEdgeEnabled=false` était
l'échappatoire à l'edge-to-edge forcé d'Android 16. **C'est faux.** Voici ce que le drapeau fait
réellement, lu dans le code installé :

| Étape | Fichier | Ce qui se passe |
|---|---|---|
| 1 | `@react-native/gradle-plugin/.../utils/PropertyUtils.kt:22` | `edgeToEdgeEnabled` est une propriété publique du plugin |
| 2 | `.../utils/AgpConfiguratorUtils.kt:74-75` | elle devient le champ `BuildConfig.IS_EDGE_TO_EDGE_ENABLED` |
| 3 | `react-native/ReactAndroid/.../ReactActivityDelegate.java:140-142` | `if (isEdgeToEdgeFeatureFlagOn()) { enableEdgeToEdge(window); }` |

⇒ Le drapeau sert à **ALLUMER** l'edge-to-edge depuis React Native. Mis à `false`, React Native
**s'abstient simplement de l'allumer lui-même**. Il ne dit rien à Android.

**Or c'est Android qui l'impose**, et le seul moyen d'y échapper est l'attribut de thème
`android:windowOptOutEdgeToEdgeEnforcement`. Recherché partout :

| Où | Occurrences de `windowOptOutEdgeToEdgeEnforcement` |
|---|---|
| `node_modules/react-native/` (tout React Native) | **0** |
| `android/` (tout notre projet, thèmes compris) | **0** |

### 🧨 Ce que ça veut dire, en clair

**L'app dessine DÉJÀ sous les barres système sur Android 15**, aujourd'hui, en `targetSdk 35` —
parce qu'Android 15 impose l'edge-to-edge à toute app qui vise 35, que personne n'a posé l'opt-out,
et qu'**aucune build Android n'a jamais été ouverte sur un Android 15**. R17 décrit donc un défaut
**présent**, pas un risque futur.

Passer à `targetSdk 36` **ne change rien à ce point précis** : c'est la même contrainte, sur une
version où l'échappatoire n'existe plus de toute façon.

⇒ **Il n'y a pas de raccourci.** Le seul vrai travail est celui d'A3 : que chaque écran respecte
les encoches. La bonne nouvelle, mesurée, c'est que **185 fichiers le font déjà** et que **2**
seulement sont en retard.

⚠️ **Et il faudra le voir de ses yeux** : l'émulateur de cette machine est un **Android 15
(API 35)**, pas un Android 16. Il suffit pour constater l'edge-to-edge (Android 15 l'impose déjà),
mais **pas** pour vérifier les nouveautés propres à Android 16 (restrictions d'orientation sur
grand écran, opt-out ignoré). Cela demanderait une image système API 36.

---

## 2. LES MARCHES — état

| # | Marche | État | Suites / tests | Ce qui a cassé |
|---|---|---|---|---|
| 0 | Base 0.78.0 (copie désolidarisée) | ✅ **VERTE** | **468 / 5 516** | rien — la copie reproduit la référence |
| 1 | 0.78.0 → 0.79.7 | ✅ **VERTE** | **468 / 5 516** | 13 suites rouges, **2 causes** — voir §M1 |
| 2 | 0.79.7 → 0.80.3 | ✅ **VERTE** | **468 / 5 516** | **rien du tout** — voir §M2 |
| 3 | 0.80.3 → 0.81.6 *(+ `compileSdk` 36)* | ✅ **VERTE** | **468 / 5 516** | 3 suites, **1 cause** (`Pressable`) — voir §M3 |
| 4 | `targetSdk 36` (A3) | ✅ **FAIT — prouvé dans le binaire** | — | rien · edge-to-edge ⛔ voir §A3bis |
| 5 | Permissions `notifee` + cleartext (A4) | ✅ **FAIT — prouvé dans le binaire** | — | rien |
| 6 | APK (A5) | ✅ **CONSTRUIT** — 1 280 tâches, `BUILD SUCCESSFUL` | — | 3 murs tiers + 1 dans notre Kotlin — voir §APK |
| 7 | APK **installé** sur l'émulateur + captures | ⛔ **bloqué** | — | le banc d'essai d'une autre session occupe le même nom de paquet — arbitrage d'Adel |

---

## M1. MARCHE 1 — 0.78.0 → 0.79.7 : ce qui a cassé, et pourquoi

**13 suites rouges / 31 tests rouges au premier passage. Deux causes, toutes deux dans les
TESTS : aucune ligne de code de production n'a bougé.**

### 🧨 Cause 1 — RN 0.79 renvoie `.default` là où 0.78 renvoyait le module entier

**12 suites d'un coup.** Symptôme : `TypeError: Cannot read properties of undefined (reading 'alert')`.

La preuve, côte à côte, dans les deux `index.js` de React Native :

| Version | Ce que fait `index.js` |
|---|---|
| **0.78.0** *(lu dans le partage, en lecture seule)* | `get Alert() { return require('./Libraries/Alert/Alert'); }` |
| **0.79.7** *(lu dans ma copie)* | `get Alert() { return require('./Libraries/Alert/Alert').default; }` |

**Trois modules changent exactement de la même façon** : `Alert`, `FlatList` et `Platform`.
Les tests simulaient ces modules internes en rendant un objet `{ alert: … }` — **sans `default`**.
En 0.79, `Alert` vaut donc `undefined`, et l'écran meurt sur son `Alert.alert(...)`.

**Ce n'est pas un défaut de l'app** : c'est le contrat d'export de React Native qui a changé.

⇒ **13 fichiers corrigés** (les 12 rouges, plus 1 qui portait le même mock sans le déclencher),
tous de la même façon, en servant **les deux formes** :

```js
jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = { alert: (...args) => mockAlert(...args) };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return { ...mockModule, default: mockModule };
});
```

> 🎯 **Pourquoi les deux formes, et pas seulement `default`.** Le mock reste juste si l'on
> redescend d'une marche. Un correctif qui ne vaut que dans un sens est un cliquet — et un
> cliquet au milieu d'un chantier de trois marches, c'est un piège pour celui qui doit reculer.

### 🧨 Cause 2 — `KeyboardAvoidingView` n'écoute plus le même événement sur iOS

**1 suite** : `ScreenContainer.keyboard.test.js`, marge basse attendue 266, reçue **0**.
Le test **Android passait**, lui — c'est ce qui a mis sur la piste.

Diff des deux implémentations de RN (`Libraries/Components/Keyboard/KeyboardAvoidingView.js`) :

| Version | Ce que le composant écoute sur **iOS** |
|---|---|
| **0.78.0** | `keyboardWillChangeFrame`, plus un garde-fou « clavier flottant » comparant les largeurs |
| **0.79.7** | `keyboardWillShow` et `keyboardWillHide` — **`keyboardWillChangeFrame` n'est plus écouté du tout**, et le garde-fou flottant a disparu |

Android n'a pas bougé (`keyboardDidShow` / `keyboardDidHide`) — d'où le test Android vert.

Le test envoyait `keyboardWillChangeFrame` : en 0.79, plus personne ne l'écoute, donc rien ne bouge.
⇒ **une ligne** : le test envoie l'événement que RN 0.79 écoute vraiment. **Ce qu'il vérifie n'a
pas changé** — c'est toujours « la marge basse vaut exactement le recouvrement, pas davantage ».

### 🔶 Ce que le guide demandait et que je n'ai PAS fait — chaque fois avec la mesure

| Ce que le helper propose | Décision | La mesure qui la justifie |
|---|---|---|
| `Gemfile` : ajouter `bigdecimal`, `logger`, `benchmark`, `mutex_m` | **non appliqué** | Les 4 gems sont **déjà résolus** dans `ios/Gemfile.lock` (`bigdecimal 3.1.9`, `logger 1.6.6`, `benchmark 0.4.0`, `mutex_m 0.3.0`), et **aucun workflow n'utilise bundler** (recherche de `bundle install` dans `.github/workflows/*.yml` → 0 ligne). Les déclarer désynchroniserait un `Gemfile.lock` que Windows ne sait pas régénérer, pour résoudre un problème qui n'existe pas. |
| `ios/AppDelegate.swift` : migration vers `RCTReactNativeFactory` | **non appliqué** | Voir §3 D1 — `RCTAppDelegate` existe encore en 0.81.6. |
| `android/gradlew.bat` | **non touché** | Contenu **identique** entre les gabarits 0.78 et 0.79 (`diff` → vide), et ce fichier n'appartient même pas au diff de cette marche. Ce dépôt le stocke **en CRLF** : l'écrire en LF aurait produit un faux diff de 188 lignes. |

### ✅ Contrôles propres à la marche

| Contrôle | Résultat |
|---|---|
| Autolinking (`node node_modules/react-native/cli.js config`) | **32 dépendances · android non-null 31 · android null 1** — le seul `null` est `react-native-keyboard-controller`, forcé volontairement dans `react-native.config.js` (0 import dans `src/`). **Identique à la référence : aucune régression.** |
| `npm install` | exit 0, **0 conflit de pair** (`ERESOLVE` → 0), patch `react-native-gifted-chat@2.8.1` réappliqué |
| Partage `app/node_modules` | **755 entrées, intact** |

---

## M2. MARCHE 2 — 0.79.7 → 0.80.3 : **rien n'a cassé**

**Zéro suite rouge, zéro fichier de test à corriger.** Les quatre portes rendent des chiffres
**strictement identiques** à ceux de la base 0.78 :

| Porte | Marche 2 | Base 0.78 | Écart |
|---|---|---|---|
| jest | 468 / 5 516, exit 0 | 468 / 5 516 | **aucun** |
| lint | 1 288 / 1 290 · 7 786 / 7 809 | idem | **aucun** |
| types | 5 336 / 5 424 | idem | **aucun** |
| thème | OK | OK | **aucun** |
| autolinking | 32 deps · 31 non-null · 1 null (voulu) | idem | **aucun** |

Ce qui a été appliqué : `react` 19.0.0 → **19.1.0**, `react-native` 0.80.3, CLI 18.0.0 → **19.1.2**,
`@react-native/*` 0.80.3, `@types/react` ^19.1.0, `react-test-renderer` 19.1.0,
`kotlinVersion` **2.0.21 → 2.1.20**, wrapper Gradle **8.13 → 8.14.1** (et cette fois `gradlew` et
`gradlew.bat` changent pour de vrai : Gradle 8.14 lance le wrapper par `-jar` au lieu du
`CLASSPATH`). `gradlew.bat` a été réécrit **en CRLF**, comme le dépôt le stocke.

### 🔶 Deux hunks du guide volontairement non appliqués

| Ce que le helper propose | Décision | La mesure qui la justifie |
|---|---|---|
| `MainApplication.kt` : remplacer `SoLoader.init(...)` + `load(bridgelessEnabled = false)` par `loadReactNative(this)` | ⛔ **non appliqué — c'est la décision la plus importante de ce chantier** | Voir §3 D2 ci-dessous. |
| `.prettierrc.js` : retirer `bracketSameLine` et `bracketSpacing` | **non appliqué** | Prettier est **dormant** ici : aucun script `format`, absent d'ESLint, absent des workflows — il n'est qu'une dépendance de développement. Changer sa configuration ne ferait rien aujourd'hui, et surprendrait le jour où quelqu'un le lancerait. C'est un choix de style du gabarit, pas une exigence de la montée. |
| `tsconfig.json` | **sans objet** | Ce projet n'a pas de `tsconfig.json` : il vérifie ses types avec **`jsconfig.json`** (`tsc --allowJs --noEmit -p jsconfig.json`). |

---

## M3. MARCHE 3 — 0.80.3 → 0.81.6 : la version qui **rend l'API 36 possible**

Appliqué : `react` 19.1.0 → **19.1.4**, `react-native` **0.81.6**, CLI 19.1.2 → **20.0.0**,
`@react-native/*` 0.81.6, `@types/react` ^19.1.4, `engines.node` `>=18` → **`>=20`**,
wrapper Gradle **8.14.1 → 8.14.3** (`gradlew`, `gradlew.bat` et le `.jar` sont **identiques** entre
0.80.3 et 0.81.6 : rien à toucher), et côté Android :

```
buildToolsVersion = "36.0.0"   (etait 35.0.0)
compileSdkVersion = 36         (etait 35)
targetSdkVersion  = 35         <-- VOLONTAIREMENT INCHANGE
```

> 🎯 **Pourquoi séparer `compileSdk` et `targetSdk`, alors que le gabarit les monte ensemble.**
> Ce ne sont pas la même chose : `compileSdk` dit *contre quelle version d'Android on compile*
> (React Native 0.81 l'exige en 36), `targetSdk` dit *quel comportement système on accepte* — et
> c'est **lui seul** qui change ce que voit l'utilisateur. Les monter ensemble, ce serait mêler
> « ça compile » et « ça se comporte autrement » dans un seul commit. La consigne du chef est
> d'ailleurs explicite : `targetSdk 36` **en dernier**, quand tout le reste est vert. Il monte
> donc au lot **A3**, seul, avec l'edge-to-edge.

### 🧨 Ce qui a cassé — 3 suites, une seule cause

`EventCardNew.test.js`, `HomeActionCard.test.js`, `HomeHeadBanner.test.js` — 5 tests, tous sur
`TypeError: Cannot read properties of undefined (reading 'props')` : la recherche du bouton dans
l'arbre rendait **une liste vide**.

**La cause, lue dans les deux versions de `Pressable.js` :**

| Version | Comment `Pressable` est exporté |
|---|---|
| **0.78.0** | `React.memo(React.forwardRef(Pressable))` |
| **0.81.6** | `memo(Pressable)` — le `forwardRef` a disparu (React 19 permet de recevoir `ref` comme une simple propriété) |

Cette couche en moins change ce que React expose dans l'arbre de test : avec `memo(forwardRef(f))`
React exposait **l'objet memo** ; avec `memo(f)` il optimise et expose **la fonction interne**.

**Mesuré par une sonde jetable** (un test de 15 lignes, écrit, exécuté, puis supprimé) :

```
findAllByType(Pressable)      -> 0
findAllByType(Pressable.type) -> 1
types réellement dans l'arbre : Pressable, View, View, Text, Text, PressabilityDebugView
```

⇒ **6 recherches corrigées dans 3 fichiers**, avec un prédicat qui accepte **les deux formes** :

```js
const estPressable = (noeud) => noeud.type === Pressable
  || noeud.type === /** @type {any} */ (Pressable).type;
```

> 🔍 **Comment les 3 fichiers ont été trouvés AVANT de lancer la suite complète.** Une recherche de
> `findAllByType(Pressable)` / `findByType(Pressable)` dans tout `src/` a rendu exactement ces 3
> fichiers. La suite complète a ensuite confirmé : **3 rouges, ni plus ni moins**. C'est la
> différence entre corriger la cause et courir après les symptômes un par un.

⚠️ **Pas de fichier d'aide partagé** : ce dépôt écrit ses tests **autonomes** (chacun porte ses
propres simulations, aucun `import` d'utilitaire de test nulle part). Le prédicat est donc posé
**dans chaque fichier**, à l'idiome de la maison, plutôt qu'en module commun.

### 🔶 Le `typescript` du gabarit N'A PAS été monté — et c'est un choix mesuré

Le gabarit 0.81 demande `typescript` `^5.8.3` ; ce dépôt est en **5.0.4**. **Volontairement laissé
tel quel, pour l'instant** : la porte des types compare à un **plafond figé** (`maxErrors: 5424`,
`.ci/typecheck-baseline.json`) et **changer de version de TypeScript, c'est changer d'instrument de
mesure**. Si 5.8 comptait plus de 5 424 erreurs, la porte deviendrait rouge sans qu'une seule ligne
de code ait empiré — et **remonter ce plafond exige un GO daté d'Adel** (R6 / D4), pas une décision
d'agent.

⇒ **On essaie d'abord le minimum** : garder 5.0.4 et regarder si la porte tient. Si elle tient, il
n'y a rien à faire (le gabarit propose, il n'impose pas). Si elle casse, c'est une question pour
Adel, pas un plafond qu'on relève en passant.

✅ **RÉPONDU PAR LA MESURE : elle tient.** `typecheck-no-regression: baseline=5424 current=5336
delta=-88` en RN 0.81.6 — **exactement le même chiffre qu'en 0.78**. TypeScript 5.0.4 compile
l'app contre les types de React Native 0.81 sans une erreur de plus.
⇒ **Rien à monter, aucun plafond à toucher, aucune question à poser à Adel.** Le pari « essayer le
minimum d'abord » a économisé un arbitrage inutile.

### 🧮 Le détail de la porte lint — pourquoi il a fallu y revenir

Au premier passage, la porte était **verte** (7 791 alertes contre un plafond de 7 809) mais elle
était passée de 7 786 à **7 791** : **+5 alertes**, toutes dans mes 3 fichiers. Un cliquet **total**
peut cacher une dérive **par fichier** — il restait de la marge, donc rien n'aurait protesté.

Contrôle ciblé sur les 3 seuls fichiers touchés (`eslint -f json`), puis correction :

| Étape | Alertes sur les 3 fichiers |
|---|---|
| Avant ma correction | 3 *(préexistantes : 2 `max-len`, 1 `require-description`)* |
| Après le prédicat, sans JSDoc | **9** *(+6 : `require-param` et `require-returns`)* |
| Après avoir écrit le JSDoc | **6** *(+3 : `tag-lines`, une ligne vide de trop avant `@param`)* |
| Après avoir retiré la ligne vide | **3** — ✅ **exactement les préexistantes, zéro ajoutée** |

> 🎯 On ne consomme pas la marge d'un cliquet parce qu'elle est là. Le plafond mesure une dette
> qu'on a promis de ne pas creuser, pas un budget d'alertes à dépenser.

---

## APK. LA CONSTRUCTION DE L'APK — ce que les 4 portes vertes ne pouvaient PAS dire

> 🧨 **Le fait le plus important de tout ce chantier.** Les quatre portes étaient vertes
> **trois marches de suite** — 468 suites, 5 516 tests, à chaque fois. Et pourtant **l'app ne
> compilait pas**. Les tests vérifient le JavaScript ; ils ne touchent **jamais** le C++.
> Sans l'étape A5, on aurait poussé une branche « verte » qui ne produit aucun binaire.

Commande : `./gradlew.bat assembleStagingRelease --no-daemon` dans `D:/App/fc/.worktrees/API36-app/android`.

**Pourquoi la variante `stagingRelease` et pas `stagingDebug`**, alors que la consigne dit « APK de
debug » : une build *debug* charge son JavaScript depuis Metro — **et le Metro qui tourne sur cette
machine sert `D:/App/fc/app`, c'est-à-dire du JavaScript compilé pour RN 0.78**. Un binaire 0.81
qui charge un bundle 0.78 ne prouve rien. La variante `stagingRelease` **embarque son propre
bundle**, ne dépend d'aucun Metro, ne dérange pas le banc d'essai du voisin — et c'est **exactement
ce que construit la CI** (`android-staging-distribution.yml`). Elle est signée avec
`debug.keystore` (`signingConfigs.staging`), donc elle s'installe sans rien demander.

### Les 4 tentatives, et ce que chacune a appris

| # | Résultat | Cause | Ce qu'on en retient |
|---|---|---|---|
| 1 | ⛔ échec en **13 s** | Cache Gradle partagé corrompu : `metadata.bin` manquant dans `caches/8.14.3/transforms/c82eb49d…` | **Rien à voir avec le code.** Voir le paragraphe « cache partagé » ci-dessous. |
| 2 | ⛔ échec en **10 min** | **`react-native-reanimated` 3.17.1 ne compile pas contre RN 0.81** | La vraie découverte. Voir ci-dessous. |
| 3 | ⛔ échec en **16 min** | **Le jeton Sentry du tiers** (R1) fait échouer la tâche d'envoi, et rien n'ignore cet échec | Confirme R1 **de première main**. Voir ci-dessous. |
| 4 | *(en cours)* | avec `SENTRY_DISABLE_AUTO_UPLOAD=true` | — |

### 🧨 La vraie découverte — `react-native-reanimated` 3.17.1 est incompatible avec RN 0.81

Épinglée **à l'exact** dans `package.json` (`"3.17.1"`, sans accent circonflexe), donc jamais montée
toute seule. Son C++ échoue sur `:react-native-reanimated:buildCMakeRelWithDebInfo[arm64-v8a]`.

**Et ce ne sont pas de simples avertissements de dépréciation** — il y a de vrais trous :

| Ce que reanimated appelle | Ce que dit le compilateur |
|---|---|
| `rawProps` | `no member named 'rawProps' in 'facebook::react::Props'` |
| `shadowNodeFromValue` | `use of undeclared identifier` — *did you mean `shadowNodeListFromValue`?* |
| `ReanimatedMountHook` | `field type … is an abstract class` |
| `ShadowNode::Shared` / `Unshared` / `ListOfShared` | dépréciés, et comme la compilation est en `-Werror`, une dépréciation **est** une erreur |

⇒ Monté à **3.19.5**, la **dernière de la même génération**. ⛔ Pas la 4.x : elle change le greffon
Babel (`react-native-worklets/plugin`) et la configuration de compilation. Le plus petit pas qui
répare, pas le plus grand pas possible. Vérifié après installation : `react-native-reanimated/plugin`
existe toujours (`babel.config.js` n'a pas à bouger) et 3.19.5 n'exige **aucun** paquet
`react-native-worklets` séparé.

> 📌 **Note pour Adel** : la consigne du lot dit « ⛔ ne pas monter une dépendance non liée à RN tant
> qu'on y est ». Celle-ci **est** liée à RN — c'est RN 0.81 qui la casse — donc elle est dans le
> périmètre. Mais c'est la bibliothèque qui anime **tous** les mouvements de l'app : deux versions
> mineures d'écart, **ça se voit à l'œil**. À regarder en recette.

✅ **Tout le reste de la chaîne native compile en RN 0.81** : à la tentative 2, **125 tâches**
étaient passées avant de buter, et à la tentative 3, **512 tâches** (462 exécutées) — Firebase,
les cartes, Nitro, le son, la messagerie. Il n'y avait **qu'un seul mur**.

### 🔴 Le jeton Sentry du tiers (R1) — confirmé de première main, et sa mise en garde aussi

La tâche `…_SentryUpload_com.foundclub.staging@1.0.0-staging+1_1` **fait échouer le build**.
Ce que le journal montre :

```
Loaded file referenced by SENTRY_PROPERTIES (…/android/sentry.properties)
  defaults.org     = zolteam
  defaults.project = faciliciti-app
  auth.token       = sntrys_eyJpY…  (145 caracteres)
```

| Constat | Détail |
|---|---|
| 🟢 **Rien n'est parti** | La tâche a échoué **avant tout envoi**, sur `error: Le fichier spécifié est introuvable. (os error 2)`. Recherche de `Uploaded files to Sentry` dans le journal → **0**. Aucune source map de FoundClub n'a quitté cette machine. |
| 🔴 **Mais le mécanisme est armé** | Le jeton a bien été chargé et `sentry-cli` lancé. Sur un runner CI, où le fichier attendu existe, l'envoi part — c'est le « jusqu'à 147 envois » de R1. |
| ⚠️ **La mise en garde de R1 est VRAIE, vérifiée ici** | `sentry.gradle:11` lit `SENTRY_DISABLE_AUTO_UPLOAD`, et **rien n'ignore l'échec de la tâche**. Révoquer le jeton **sans avoir posé ce garde-fou d'abord tuerait le prochain build Android.** Ce build vient d'en faire la démonstration : l'ordre imposé par R1 (garde-fou d'abord, révocation ensuite) n'est pas une précaution de style. |

⇒ Build relancé avec `SENTRY_DISABLE_AUTO_UPLOAD=true` — ce qui répare **et** garantit que rien ne
part chez le tiers.

### 🧹 Le cache Gradle partagé — ce qui a été touché, et pourquoi c'était sûr

Première tentative morte en 13 s sur `Could not read workspace metadata from
C:\Users\adelf\.gradle\caches\8.14.3\transforms\c82eb49d…\metadata.bin` — une entrée **à moitié
écrite** (le dossier existait, son index manquait). `C:\Users\adelf\.gradle` est un cache **commun à
toute la machine** : on n'y touche pas sans contrôle.

| Contrôle avant de supprimer | Résultat |
|---|---|
| L'échec est-il reproductible ? | **Oui**, deux fois à l'identique |
| Gradle lui-même est-il cassé ? | Non — `gradlew --version` → exit 0 |
| Un autre build utilise-t-il cette entrée ? | Un seul processus Java tourne : un service **Gradle 8.13**, qui travaille dans `caches/8.13/`. **Aucun contact** avec `caches/8.14.3/` |
| Est-ce un lien déguisé ? | **Non** — `LinkType` vide, vrai dossier de 84 Ko *(le contrôle qui avait manqué le 20/08 sur le `node_modules` partagé)* |

⇒ **Cette seule entrée** supprimée. Le cache (5,6 Go, 13 autres entrées) est intact, et Gradle
reconstruit ce qu'il a perdu.

### ✅ LES DEUX AUTRES MURS, ET LE BUILD QUI PASSE

**Mur 3 — `countLines is not a function` (le MÊME piège que la marche 1).**
`metro.config.js` enveloppe la configuration avec `withSentryConfig`. Le sérialiseur de
`@sentry/react-native` 6.21.0 fait :

```js
countLines = require('metro/src/lib/countLines');
```

Or le Metro livré avec RN 0.81 (**0.83.8**) exporte cette fonction en `.default`
(`exports.default = countLines`, `__esModule: true`). Sentry reçoit donc **un objet là où il attend
une fonction** — exactement le changement qui avait cassé `Alert` en marche 1 et `Pressable` en
marche 3. **Trois fois le même mécanisme.**

⚠️ **Et j'avais mal lu le journal du build 3** : j'avais annoncé que le bundle JavaScript s'était
fabriqué et que seul l'envoi Sentry échouait. **Faux.** La tâche de bundle avait échoué *elle aussi*,
et l'envoi ne plantait qu'ensuite faute de fichier. Je m'étais arrêté au **dernier** échec affiché
au lieu de remonter au **premier**.

⇒ `@sentry/react-native` monté de **^6.9.1 (6.21.0) à ^7.13.0**. Le correctif est arrivé en
**7.2.0** — leur note de version dit mot pour mot : *« Vendor `metro/countLines` function to avoid
issues with the private import »*. ⚠️ 6.20.0 annonçait pourtant « Support Metro 0.83 » : **l'annonce
était en avance sur le correctif**.

**Le risque de cette montée majeure, mesuré avant de la faire** :

| Question | Réponse |
|---|---|
| Combien de fichiers de l'app importent Sentry ? | **1** — `src/App.js` |
| Combien d'appels ? | **5** : `init`, `wrap`, `reactNavigationIntegration`, `captureException` ×2 — tous stables en 7.x |
| Sentry est-il seulement actif dans les builds ? | **Non** : `SENTRY_DSN=` est **vide** dans les deux workflows (`android-staging-distribution.yml:60`, `android-play-release.yml:121`) |

**Mur 4 — notre PROPRE code Kotlin.** `PlanningOrientationModule.kt` (le module qui bascule le
planning en paysage) : `Unresolved reference 'currentActivity'`, deux fois.

RN 0.81 a réécrit `ReactContextBaseJavaModule` **en Kotlin**. Or Kotlin ne fabrique de propriété
synthétique **que pour les getters Java** : `getCurrentActivity()` étant devenu une *fonction
Kotlin*, le raccourci `currentActivity` a disparu.

**Le remplacement n'a pas été deviné — React Native l'écrit lui-même** :

```kotlin
@Deprecated(
    "Deprecated in 0.80.0. Use getReactApplicationContext.getCurrentActivity() instead.",
    ReplaceWith("reactApplicationContext.currentActivity"))
```

⇒ appliqué tel quel aux 2 sites. Vérifié pourquoi ça marche : `ReactContext.getCurrentActivity()`
et `BaseJavaModule.getReactApplicationContext()` sont **restés en Java**, donc leurs propriétés
synthétiques existent toujours.

⚠️ **NON VÉRIFIÉ, et ça ne peut pas l'être ici** : c'est du code Android natif. **Aucun des 5 516
tests ne le couvre**, et aucune porte ne le mesure. Le compilateur dit qu'il est *correct* ; il ne
dit pas que **l'écran tourne encore en paysage**. ⇒ **à vérifier à la main en recette** : ouvrir le
planning, basculer en paysage.

### 🏁 LE RÉSULTAT — `BUILD SUCCESSFUL`, et ce que le binaire prouve

`BUILD SUCCESSFUL in 2m 1s` · **1 280 tâches** — *exactement le compte du run CI n°251*.
APK : `android/app/build/outputs/apk/staging/release/app-staging-release.apk`.

**Lu dans le binaire lui-même** (`aapt2 dump badging`), avant/après le lot A4 :

| Ce qu'on vérifie | APK d'avant A4 | APK final | |
|---|---|---|---|
| `compileSdkVersion` | 36 | **36** | ✅ compilé contre Android 16 |
| **`targetSdkVersion`** | 35 | **36** | 🎯 **LE BUT DU CHANTIER, dans le binaire** |
| `SCHEDULE_EXACT_ALARM` | **présente** | **absente** | ✅ R12 |
| `FOREGROUND_SERVICE` | **présente** | **absente** | ✅ R12 |
| `RECEIVE_BOOT_COMPLETED` | **présente** | **absente** | ✅ R12 |
| `usesCleartextTraffic` | présent | **absent du manifeste de release** | ✅ R12 |

> 🎯 Ce n'est pas « le fichier dit 36 » : c'est **le binaire fabriqué** qui le dit, et les
> permissions étaient **mesurées présentes dans l'APK précédent**. Un avant/après, pas une
> affirmation.

⚠️ **Taille : 120 Mo**, alors que l'APK du run CI n°251 faisait **65,6 Mo**. Écart **non
expliqué** — probablement les symboles de débogage natifs non retirés en local. À regarder avant
tout envoi réel ; sans effet sur la validité de la compilation.

### 📋 Fichiers ajoutés à la copie pour pouvoir construire — tous ignorés par git

`.env.staging`, `android/app/src/staging/google-services.json` (copiés depuis `D:/App/fc/app`, en
lecture) et `android/local.properties` (chemin du SDK). ✅ `git status` reste propre : ils sont dans
le `.gitignore`.
🔒 `android/app/src/production/google-services.json` est **absent** de cette copie — le `variantFilter`
(`android/app/build.gradle:170-174`) écarte donc entièrement la saveur production. **Aucun risque
de fabriquer quoi que ce soit qui vise la production.**

---

## 3. LES DÉCISIONS PRISES EN COURS DE ROUTE

### 🔶 D1 — L'`AppDelegate.swift` n'est PAS migré, et c'est délibéré

Le gabarit 0.79 remplace l'héritage `RCTAppDelegate` par `UIResponder` + `RCTReactNativeFactory`.
**Notre `AppDelegate.swift` porte 5 personnalisations** : l'initialisation Firebase, le
`moduleName`, deux renvois vers `RCTLinkingManager` (liens profonds et `NSUserActivity`), et
l'orientation via `Orientation.getOrientation()`.

**Mesuré** : `RCTAppDelegate` **existe encore en 0.81.6**. Il est marqué *deprecated*, pas retiré —
le fichier `RCTAppDelegate.h` de la balise `v0.81.6` dit : « *deprecated … will be removed in a
future version of React Native* ».

**Donc on n'y touche pas.** La raison est concrète : ce chantier tourne sur **Windows**, où l'on
ne peut ni lancer `pod install` ni compiler iOS. Réécrire à l'aveugle le point d'entrée de l'app
iOS — celui qui démarre Firebase et fixe l'orientation — sans jamais pouvoir le compiler, c'est
exactement le pari que la méthode interdit. La migration reste à faire **le jour où RN retire
`RCTAppDelegate`** (0.82 ou au-delà), sur une machine qui compile iOS.

### 🚨 D2 — Le mode « bridgeless » reste COUPÉ, et le gabarit voulait le rallumer en silence

C'est la décision la plus lourde de conséquence de tout le chantier.

**Ce que dit notre code** (`android/app/src/main/java/com/foundclub/MainApplication.kt:40-43`) :

```kotlin
if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
  // Keep the New Architecture enabled but opt out of bridgeless until Nitro is stable there.
  load(bridgelessEnabled = false)
}
```

L'app tourne donc en **nouvelle architecture MAIS avec l'ancien pont**, volontairement, à cause de
`react-native-nitro-modules` (dont dépendent `react-native-nitro-sound` et `react-native-mmkv`).

**Ce que le gabarit 0.80 propose** : remplacer tout ce bloc par `loadReactNative(this)` — une
fonction qui **n'a pas de paramètre `bridgelessEnabled`** et qui rallume donc le mode bridgeless.

⛔ **Refusé.** Appliquer ce hunk changerait **le moteur d'exécution de l'app** au milieu d'un
chantier qui parle d'autre chose. C'est exactement le genre de modification qui voyage en
passager clandestin et qu'on ne retrouve plus quand quelque chose casse trois semaines plus tard.

**Mesuré, pour savoir combien de temps ce refus tient** — lecture de
`DefaultNewArchitectureEntryPoint.kt` aux trois balises :

| Version | État de `load(… bridgelessEnabled = false)` |
|---|---|
| **0.79.7** | présent, **non déprécié** |
| **0.80.3** | présent, **non déprécié** |
| **0.81.6** | présent et **toujours honoré**, mais **`@Deprecated`** : « *Loading the entry point with different flags for Fabric, TurboModule and Bridgeless is deprecated. Please use load() instead.* » |

⇒ **Le réglage survit jusqu'au bout de ce chantier** (une alerte de compilation Kotlin, pas une
erreur). Mais il est **condamné** : à la version suivante, il faudra soit que Nitro soit stable en
bridgeless, soit renoncer à Nitro. **C'est un sujet à part entière, à ouvrir avant 0.82.**

Vérifié aussi que les deux symboles que notre fichier importe existent encore en 0.81.6 :
`OpenSourceMergedSoMapping` (HTTP 200 sur la balise `v0.81.6`) et `SoLoader`.

---

## 4. LE TERRAIN DE A3 (edge-to-edge) ET A4 (permissions) — reconnu d'avance

Ces deux lots viennent **après** la marche 3. Le terrain est déjà mesuré, pour que celui qui les
fait n'ait pas à recommencer la reconnaissance.

### 🎨 A3 — edge-to-edge : l'app est déjà presque prête, et la dette tient en 2 fichiers

| Mesure | Nombre |
|---|---|
| Fichiers qui utilisent `useSafeAreaInsets` *(la bonne façon)* | **185** |
| Fichiers qui utilisent encore le `SafeAreaView` de `react-native` *(le legacy)* | **2** |
| Fichiers qui touchent à `StatusBar` | 3 |

Les 2 fichiers legacy sont **`src/views/league/match/LeagueMatchDetails.js`** et
**`src/views/league/match/PastMatchDetails.js`** — les deux écrans de match du mode LEAGUE, tous
deux **atteignables** (`LeagueNavigator.js:61`, `PrivateNavigator.js:662`, et 6 appels à
`navigate(RouteNames.LeagueMatchDetails, …)` depuis `LeagueActionPromptHost.js`).

> 🧨 **Le fait qui change la nature du problème.** Le `SafeAreaView` de React Native est
> `Platform.select({ ios: <composant natif>, default: View })` — autrement dit, **sur Android il
> ne fait rien du tout**. Ces deux écrans dessinent donc **déjà** sous les barres système sur
> Android, aujourd'hui, en `targetSdk 35`. R17 n'est pas un risque à venir : c'est un défaut
> présent que personne n'a vu parce qu'aucune build Android n'a été ouverte sur Android 15.

⚠️ **`PrivateNavigator.js` est un fichier-carrefour (E4) : ne pas y toucher pour ça.** Les deux
écrans se corrigent chez eux.

### 🔕 A4 — les 3 permissions et le trafic en clair : d'où ça vient, exactement

**Les 3 permissions ne sont écrites nulle part dans le dépôt.** Elles arrivent par fusion de
manifeste depuis le fichier binaire de `notifee` :
`node_modules/@notifee/react-native/android/libs/app/notifee/core/202108261754/core-202108261754.aar`,
dont le manifeste déclare `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE` et `SCHEDULE_EXACT_ALARM`.
⇒ `tools:node="remove"` dans notre manifeste est bien le seul moyen de les retirer.

**Elles ne servent à rien, mesuré** :

| Ce qu'on a cherché dans `src/` | Occurrences |
|---|---|
| `createTriggerNotification`, `TriggerType`, `TimestampTrigger`, `AlarmType` | **0** |
| `registerForegroundService`, `asForegroundService` | **0** |

**Le trafic en clair : la moitié du travail est déjà faite, et personne ne l'a vue.**
Le dépôt a **déjà** un `android/app/src/debug/AndroidManifest.xml` qui pose
`usesCleartextTraffic="true"` **pour le debug seulement**. Mais le manifeste **principal** le pose
aussi, en dur (ligne 32) — et c'est *celui-là* qui l'emporte jusque dans la build de production.

⇒ **Il suffit de retirer cette ligne du manifeste principal.** Le debug garde le clair par son
propre manifeste ; la production le perd. Vérifié qu'aucune build signée n'en a besoin :

| Variante | URL de l'API |
|---|---|
| staging release | `https://api-staging.foundclubpro.com/api` |
| production | `https://…` (secret `API_URL`) |

Les seuls `http://` du code sont des **replis de développement** (`localhost:1337`, l'hôte de
l'émulateur) et un lien `maps.apple.com` ouvert par le système, pas par l'app.

> 🎁 C'est plus simple que ce que propose le gabarit 0.81 (qui supprime le manifeste de debug et
> passe par un placeholder) : le mécanisme équivalent existe déjà ici, il est juste court-circuité
> par une ligne en trop.

---

## A3bis. ⛔ LE REMPLACEMENT DES 2 `SafeAreaView` N'A PAS ÉTÉ FAIT — et le refuser est le bon geste

La consigne A3 dit : « remplace les 2 `SafeAreaView` legacy par `react-native-safe-area-context` ».
**Appliquée telle quelle, elle introduirait sur Android le défaut qu'elle prétend corriger.**

**Ce que j'ai mesuré dans `ScreenContainer.js`** (le conteneur qui enveloppe ces 2 écrans) :

| Ligne | Ce qu'il fait |
|---|---|
| `:90` | `const insets = useSafeAreaInsets()` |
| `:106` | `if (withHeaderPadding) nextSpaces.paddingTop = headerHeightNative \|\| insets.top` |
| `:112` | `let paddingBottom = insets.bottom` — **un plancher, appliqué TOUJOURS** |

Et dans les 2 écrans, le `SafeAreaView` est **à l'intérieur** de ce `ScreenContainer`
(`LeagueMatchDetails.js:1866-1867`, `PastMatchDetails.js:300-301`).

| Plateforme | Aujourd'hui | Après le remplacement demandé |
|---|---|---|
| **Android** | Le `SafeAreaView` de RN est `Platform.select({ ios: natif, default: View })` ⇒ **il ne fait rien**. Le conteneur fournit les marges. **C'est juste.** | Le composant de `safe-area-context` **ajoute** sa propre marge par-dessus celle du conteneur ⇒ **marge basse DOUBLÉE. Une régression visible, causée par le correctif.** |
| **iOS** | Marge native + marge du conteneur ⇒ **peut-être déjà doublée** | Inchangé (toujours doublé) |

**L'idiome de la maison tranche dans le même sens** : les 3 écrans voisins du même dossier —
`MatchCenterScreen.js`, `MatchHistoryScreen.js`, `ComingSoonLeagueScreen.js` — utilisent
`ScreenContainer` **sans aucun `SafeAreaView`**. Ce sont eux qui ont raison.
⚠️ `EndMatchScreen.js`, que j'avais d'abord cité comme modèle à copier, importe bien
`SafeAreaView` depuis `react-native-safe-area-context` — **mais il est lui aussi dans un
`ScreenContainer`**, donc il porte probablement déjà la marge doublée. **Mauvais modèle.**

### Pourquoi je n'ai rien touché

1. 🔴 Le geste demandé **ajouterait un défaut** sur Android (mesuré ci-dessus).
2. 🔴 **Ces 2 fichiers n'ont aucun test** — `find` → 0 fichier de test les concernant. La règle E6
   et le garde-fou §1 bis imposent un **test caractérisant d'abord**.
3. 🔴 Ce sont des écrans **visuels**, sur un mode (LEAGUE) que je ne peux pas ouvrir d'ici.

⇒ **Question remontée à Adel, chemin le plus sûr pris : ne rien casser.** Les 3 options, avec la
recommandation, sont dans le compte rendu. **La branche reste verte.**

---

## 5. CE QUI RESTE, POUR CELUI QUI REPREND

| # | Ce qui reste | Pourquoi ça n'a pas été fait | Taille |
|---|---|---|---|
| 1 | 🎨 **Les 2 `SafeAreaView` des écrans LEAGUE** | Voir §A3bis — le geste demandé serait une régression ; **arbitrage d'Adel demandé** | 1 test de caractérisation par écran, puis 1 ligne |
| 2 | 📱 **Installer l'APK sur l'émulateur + captures** | L'émulateur héberge le **banc d'essai d'une autre fenêtre** (`com.foundclub.staging`, Metro allumé). Mon APK porte **le même nom de paquet** : l'installer écraserait leur banc. **Arbitrage d'Adel demandé** (emprunter/rendre · attendre · 2e émulateur) | 10 min une fois tranché |
| 3 | 🤖 **Les comportements propres à Android 16** | L'émulateur de la machine est un **Android 15 (API 35)**. Il suffit pour voir l'edge-to-edge (Android 15 l'impose déjà) mais **pas** pour les restrictions d'orientation sur grand écran | 1 image système API 36 (~1,5 Go) |
| 4 | 🍎 **Vérifier qu'iOS compile encore** | **Impossible sous Windows** : ni `pod install`, ni Xcode. Aucun fichier iOS n'a été modifié par ce chantier | 1 build sur macOS |
| 5 | 🔄 **`Podfile.lock` ne connaît pas `react-native-geolocation`** (R18) | Même raison qu'au-dessus | idem |
| 6 | 📦 **L'APK fait 120 Mo contre 65,6 Mo en CI** | Écart non expliqué ; probablement les symboles natifs non retirés en local | à regarder avant tout envoi |
| 7 | 🧭 **Le mode « bridgeless » condamné** | Voir §3 D2 — le réglage survit à 0.81 mais pas au-delà. **Sujet à ouvrir avant RN 0.82** | un chantier à part |
| 8 | 🧪 **301 fichiers de test sur `react-test-renderer`** | React l'a déprécié ; **0 fichier** utilise `@testing-library`. Autre falaise de 0.82 | un chantier à part |
| 9 | 🔴 **Le jeton Sentry du tiers** (R1) | C'est le lot **HYGIÈNE** d'une autre session. Ce chantier a **confirmé son ordre d'opérations** : garde-fou d'abord, révocation ensuite — sinon le build Android meurt (démontré ici) | son lot |

### 🔑 Ce qu'il faut savoir pour reconstruire l'APK

```
cd D:/App/fc/.worktrees/API36-app/android
$env:ANDROID_HOME = "C:\Users\adelf\AppData\Local\Android\Sdk"
$env:APP_ENV = "staging"
$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"     # <-- SANS LUI, LE BUILD MEURT (R1)
.\gradlew.bat assembleStagingRelease --no-daemon --console=plain
```

Et les 3 fichiers non versionnés qu'il faut avoir copiés dans la copie de travail :
`.env.staging`, `android/app/src/staging/google-services.json` (depuis `D:/App/fc/app`) et
`android/local.properties` (`sdk.dir=C:/Users/adelf/AppData/Local/Android/Sdk`).
