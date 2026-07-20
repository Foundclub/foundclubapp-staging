# Application Theme

This folder is the single source of truth for mobile UI tokens and primitives.

## Core Modules
1. `themeContext.js`: provides `useTheme()` and runtime theme switching.
2. `colors.js`: semantic color tokens.
3. `fonts.js`: typography tokens.
4. `spaces.js`: spacing scale and utilities.
5. `alignements.js`: layout helpers.
6. `applicationStyle.js`: shared style primitives (`button*`, `card`, `input`, etc.).
7. `images.js`: static image registry.

## Official Token Contract
Use only tokens exposed by `useTheme()`.

### Colors
Primary semantic tokens include:
- `primary100`, `primary200`, `primary300`, `primary400`, `primary500`, `primary600`,
  `primary700`, `primary800`, `primary900`
- `neutral00` ... `neutral900` (including `neutral600`)
- `success*`, `warning*` (including `warning900`), `error*`, `gold*`

#### `withAlpha(color, alpha)` — la seule façon légitime de teinter
Exporté par `colors.js`. Une couleur de thème avec opacité s'écrit :

```js
import { withAlpha } from '@/theme/colors';
backgroundColor: withAlpha(Colors.primary500, 0.14)   // et NON 'rgba(1, 179, 244, 0.14)'
```

Pourquoi c'est obligatoire : un littéral `rgba(1, 179, 244, 0.14)` **est** `primary500`,
mais il ne ressemble pas à un jeton — il échappait donc totalement au contrôle, qui ne
cherchait que l'hexadécimal. Le script détecte désormais `rgb()`/`rgba()` et nomme le jeton
correspondant quand il le reconnaît. `withAlpha` accepte `#rgb`, `#rrggbb`, `#rrggbbaa`,
`rgb()`/`rgba()`, laisse `transparent` intact, compose l'opacité demandée avec celle déjà
portée par la couleur, et renvoie la valeur d'origine si elle n'est pas parsable (jamais
d'exception en rendu). Plusieurs composants avaient déjà recopié ce helper en local
(`FloatingAnimatedTabBar`, `NotificationPopup`, `PlanningCalendarView`, ...) : ces copies
sont à remplacer par l'import officiel.

Compatibility aliases (temporary, deprecated):
- `primary -> primary500`
- `secondary -> warning500`
- `error -> error500`
- `danger500 -> error500`
- `textSecondary -> neutral300`

### Fonts
Core tokens:
- headers: `h1`..`h5` (+ bold/black variants where defined)
- body: `p1`..`p4` (+ bold/black variants where defined)
- extras: `caption`, `captionBold`, `label`, `small`, `button`

### ApplicationStyle
Core primitives:
- button styles: `buttonPrimary`, `buttonSecondary`, `buttonPrimaryOption`, etc.
- surfaces: `card`, `input`
- utilities: `backgroundColor.*`, `borderColor.*`, `tintColor.*`, radius/border/shadow helpers

Do not use nested access like `ApplicationStyle.button.primary`.
(`backgroundColor.*`, `borderColor.*`, `tintColor.*` et `hitSlop.*` sont des cartes de jetons
volontaires, pas des exceptions à cette règle.)

#### Zones tactiles — `ApplicationStyle.hitSlop` (décisions Adel 2026-07-17, révisée 2026-07-20)
**Depuis le 2026-07-20 (arbitrage n°2, option A) : `buttonOptionStyle` et `buttonIconOption`
sont rendus à 44 px** — la cible tactile minimale (Apple HIG) est atteinte par le rendu
lui-même. Le `hitSlop` ne sert plus qu'aux petites cibles qui doivent rester petites
visuellement (icônes nues, puces) :

```js
<TouchableOpacity hitSlop={ApplicationStyle.hitSlop.min44From32} ... />
```

Constantes exposées, une par taille rendue :

| Jeton | Taille rendue | Marge ajoutée |
| --- | --- | --- |
| `hitSlop.min44` | 44 px (boutons option) | +0 px — conservé pour compatibilité |
| `hitSlop.min44From40` | 40 px (`roundIcon40`) | +2 px |
| `hitSlop.min44From32` | 32 px (puces, chips compactes) | +6 px |
| `hitSlop.min44From28` | 28 px (`icon28`) | +8 px |
| `hitSlop.min44From24` | 24 px (`icon24`) | +10 px |

Pour toute autre taille : `hitSlopToMinTarget(taille)` (exporté par `applicationStyle.js`),
qui renvoie `{ top, bottom, left, right }`. `MIN_TOUCH_TARGET` vaut 44.
Le balayage des appelants est un lot mécanique séparé — la constante existe d'abord.

### Contrast rule — filled primary surfaces (decision Adel, 2026-07-14)
Text and icons on a `primary500` (#01b3f4) background use dark ink `primary900` (#001218),
never `neutral00`: white on primary500 is ~2.4:1 and fails WCAG AA (4.5:1); primary900 is ~8:1
(AA and AAA). `buttonTextPrimary` and `buttonTextPrimaryLight` both map to `primary900`.
Do not override the text color of `Primary`/`PrimaryLight` buttons back to white.
Web mirrors of this rule consume `var(--fc-color-primary-900, #001218)`:
`.seo-button-primary`, `.seo-facility-chip-all` (public-seo.css), `.primary-button` (index.css).
Context: docs/ANALYSE_COHERENCE_DS_QUIZ_2026_07_14.md, constat C6 (option b).

**Encre unique, confirmée par Adel le 2026-07-17.** À la question « `primary900` est-il la
SEULE encre autorisée sur `primary500` ? », la réponse est **oui**. Il n'y a donc plus de cas
particulier à discuter : sur un fond `primary500`, toute autre encre est une dérive. C'est ce
qui rend la règle vérifiable par la machine — `verify-theme-contract` signale désormais
`neutral00`, `primary100`, `'white'` et `#fff` en position `color:`/`tintColor:` à proximité
d'un fond `primary500` (règle `inkOnPrimary500`).

Portée de la détection : `backgroundColor`/`borderColor` sont volontairement exclus (un liseré
blanc sur primary500 ne pose pas de problème de lisibilité), et la fenêtre d'analyse est de
±4 lignes. C'est une heuristique textuelle : elle peut manquer un fond calculé à distance, et
peut signaler une branche de ternaire dont le fond n'est pas primary500. Chaque constat se
relit, il ne s'applique pas les yeux fermés.

### Alignments
Primary helpers:
- `row`, `column`, `alignCenter`, `justifySpaceBetween`, `fill`, etc.
- compatibility aliases: `center`, `spaceBetween`, `mainCenter`, `selfStart`

## Governance Rules
1. Do not add new hardcoded hex colors outside `src/theme/*`.
2. Idem pour `rgb()`/`rgba()` : utiliser un jeton + `withAlpha()`.
3. If a temporary exception is required, add the file to `scripts/theme-hex-allowlist.json` and document the reason in the merge request.
4. Add or change tokens in theme files before using them in components.
5. Run `npm run verify:theme-contract` before pushing.
6. When introducing compatibility aliases, mark them deprecated and map them to semantic tokens.

### Politique d'allowlist : chaque lot sort ses fichiers
`scripts/theme-hex-allowlist.json` est une **liste de dette**, pas un permis permanent.
La règle : **tout lot qui touche un fichier de l'allowlist en sort ce fichier.** L'allowlist
ne doit que rétrécir. On n'y ajoute une entrée que pour une exception réellement temporaire,
justifiée dans la merge request.

Le script signale tout seul les entrées périmées (fichier disparu, ou fichier qui n'a plus
aucun hex) sous la règle `staleAllowlist`. Cette règle est **volontairement non bloquante** :
une entrée devient périmée quand quelqu'un *nettoie* un fichier, et faire échouer la porte
là-dessus punirait exactement le comportement qu'on veut encourager. C'est un rappel
d'hygiène, à traiter au passage. Nettoyage du 2026-07-19 : 11 entrées retirées.

## Validation
- Contract check script: `scripts/verify-theme-contract.js`
- Hex exception allowlist: `scripts/theme-hex-allowlist.json`
- Baseline (plafonds par règle) : `.ci/theme-contract-baseline.json`
- Command: `npm run verify:theme-contract`
- CI job: `theme-contract`

### Ce que le script vérifie
| Règle | Constat | Bloquante |
| --- | --- | --- |
| `unknownTokens` | `Colors.*` / `Fonts.*` / `ApplicationStyle.*` / `Alignments.*` inexistant | oui |
| `hexOutsideAllowlist` | hex codé en dur hors allowlist | oui |
| `hexInProtectedFiles` | hex dans un fichier sous protection stricte | oui |
| `rgbLiterals` | couleur en `rgb()`/`rgba()` → utiliser `withAlpha()` | oui |
| `spacesOutOfRamp` | index hors rampe `Spaces` → `undefined`, style perdu en silence | oui |
| `inkOnPrimary500` | encre claire sur fond `primary500` → `primary900` attendu | oui |
| `staleAllowlist` | entrée d'allowlist périmée | non (hygiène) |

`spacesOutOfRamp` mérite une note : la rampe n'expose que `0/4/8/12/16/24/32/40/64/80/128/160`.
`Spaces.paddingVertical[10]` rend donc `undefined`, et React Native **ignore le style sans
lever la moindre erreur** — le padding disparaît silencieusement. Ce n'est pas une question
de style, c'est un bug de rendu invisible.

### Baseline : pourquoi des plafonds plutôt que zéro
Le script portait ~20 constats en permanence : rouge tout le temps, donc plus personne ne le
regardait, donc les dérives passaient. **Une porte rouge en permanence ne protège rien.**

`.ci/theme-contract-baseline.json` fixe donc un plafond par règle, sur le modèle de
`.ci/lint-baseline.json`. La porte est verte tant qu'aucun compteur ne monte, et rouge dès
qu'un seul dépasse — c'est un cliquet : les compteurs ne peuvent que descendre.

- `npm run verify:theme-contract` — la porte (code de sortie 0/1)
- `npm run verify:theme-contract -- --verbose` — tous les constats, même sous plafond
- `npm run verify:theme-contract -- --update-baseline` — resserrer après avoir résorbé
- `npm run verify:theme-contract -- --strict` — tolérance zéro, cible de sortie

Quand un lot fait baisser un compteur, le script le dit et propose le resserrage. Le réflexe
attendu : **resserrer dans le même commit**, sinon le terrain regagné se reperd.

### Jetons inconnus restants : ce sont les appelants qui se trompent
Les 5 constats `unknownTokens` sous plafond ne sont **pas** des oublis dans le thème. Le jeton
ne doit pas être créé ; c'est l'appel qui est faux. À corriger dans le lot qui possède ces
fichiers (ne pas ajouter les jetons pour faire taire le script) :

| Appel fautif | Fichier | Correction attendue |
| --- | --- | --- |
| `ApplicationStyle.borderRadius1` | `src/components/organisms/eventListContent/EventListContent.js:1252` | La rampe va de `borderRadius2` à `borderRadius100` ; un rayon de 1 px n'existe pas. La pastille visée est un *loading hint* arrondi → `borderRadius12` (ou `borderRadius100` pour une pilule). |
| `Fonts.body4` (×2) | `src/views/event/ParticipantEventList.js:569` et `:581` | Aucune famille `body` n'existe : l'échelle est `p1`..`p4`. → `Fonts.p4`. |
| `Fonts.p5` (×2) | `src/views/tactical_v2/MultiTeamCompositionBoard.js:159` et `:1034` | Écrit `Fonts.p5 \|\| Fonts.p4` : `p5` n'existe pas, l'expression vaut **toujours** `p4`. L'échelle s'arrête volontairement à `p4` (10 px) — descendre en dessous nuit à la lisibilité. → supprimer le repli et écrire `Fonts.p4`. |

`Colors.primary400`, lui, était un vrai trou de rampe (elle sautait de 300 à 500) : le jeton a
été ajouté (`#33c3f7`, interpolé entre `primary300` et `primary500`).

## Notes
- Current visual baseline remains dark-first.
- Compatibility aliases remain during the stabilization phase; removal is deferred to a dedicated migration.
