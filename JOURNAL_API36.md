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
| `android/gradle.properties` | **ajout de `edgeToEdgeEnabled=false`** — le gabarit 0.81 pose l'opt-out lui-même |
| `android/app/src/main/AndroidManifest.xml` | `usesCleartextTraffic` devient un **placeholder** |
| `android/app/src/debug/AndroidManifest.xml` | **supprimé** (le cleartext passe par le placeholder) |
| `package.json` | `react` **19.1.4** · `react-native` 0.81.6 · cli **20.0.0** · `typescript` ^5.8.3 · `node >= 20` |
| wrapper | gradle 8.14.1 → 8.14.3 |

> 🎁 **Deux points de la liste stores tombent tout seuls en 0.81** : le `usesCleartextTraffic="true"`
> écrit en dur (R12) devient un placeholder faux en release, et l'opt-out edge-to-edge (R17)
> devient un réglage officiel au lieu d'un bricolage de thème.

---

## 2. LES MARCHES — état

| # | Marche | État | Suites / tests | Ce qui a cassé |
|---|---|---|---|---|
| 0 | Base 0.78.0 (copie désolidarisée) | ✅ **VERTE** | **468 / 5 516** | rien — la copie reproduit la référence |
| 1 | 0.78.0 → 0.79.7 | ✅ **VERTE** | **468 / 5 516** | 13 suites rouges, **2 causes** — voir §M1 |
| 2 | 0.79.7 → 0.80.3 | ⬜ pas commencée | — | — |
| 3 | 0.80.3 → 0.81.6 | ⬜ pas commencée | — | — |
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

---

## 4. CE QUI RESTE, POUR CELUI QUI REPREND

*(rempli au fur et à mesure)*
