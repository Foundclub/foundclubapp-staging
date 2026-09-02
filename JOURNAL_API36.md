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

| Fichier | Ce qui change |
|---|---|
| `android/build.gradle` | `buildToolsVersion` **36.0.0** · `compileSdkVersion` **36** · `targetSdkVersion` **36** |
| `android/gradle.properties` | **ajout de `edgeToEdgeEnabled=false`** — ⚠️ **ce n'est PAS un opt-out**, voir §E2E |
| `android/app/src/main/AndroidManifest.xml` | `usesCleartextTraffic` devient un **placeholder** |
| `android/app/src/debug/AndroidManifest.xml` | **supprimé** (le cleartext passe par le placeholder) |
| `package.json` | `react` **19.1.4** · `react-native` 0.81.6 · cli **20.0.0** · `typescript` ^5.8.3 · `node >= 20` |
| wrapper | gradle 8.14.1 → 8.14.3 |

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
| 3 | 0.80.3 → 0.81.6 *(+  36)* | ✅ **VERTE** | **468 / 5 516** | 3 suites, **1 cause** () — voir §M3 |
| 4 | `targetSdk 36` + edge-to-edge (A3) | ⬜ pas commencée | — | — |
| 5 | Permissions `notifee` + cleartext (A4) | ⬜ pas commencée | — | — |
| 6 | APK de debug sur l'émulateur (A5) | ⬜ pas commencée | — | — |

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

## 5. CE QUI RESTE, POUR CELUI QUI REPREND

*(rempli au fur et à mesure)*
