---
description: Design system rules for the FC mobile app
---

# FC App Design Rules

## Couleurs principales

| Usage                | Couleur                                    | Description                         |
| -------------------- | ------------------------------------------ | ----------------------------------- |
| **Texte principal**  | `Colors.neutral00`                         | Texte blanc/clair sur fond sombre   |
| **Texte secondaire** | `Colors.neutral200` ou `Colors.neutral300` | Texte gris clair                    |
| **Texte désactivé**  | `Colors.neutral400` ou `Colors.neutral500` | Texte gris plus foncé               |
| **Accent/CTA**       | `Colors.primary500`                        | Couleur principale (cyan/turquoise) |
| **Fond de carte**    | `Colors.neutral800`                        | Gris très foncé                     |
| **Bordures**         | `Colors.neutral700`                        | Gris foncé pour les bordures        |

## ⚠️ Règles strictes

1. **JAMAIS de texte noir** (`neutral900`) - L'app est en dark mode
2. **Texte toujours en `neutral00`** pour le contenu principal
3. **`primary500`** pour les accents, boutons, et éléments interactifs
4. **Fond des boutons primaires** = `Colors.primary500`, texte = `Colors.neutral900` (exception car c'est le fond qui est clair)

## Hiérarchie typographique

- **h1, h2, h3, h4** → `Colors.neutral00`
- **p1, p1Bold** → `Colors.neutral00` ou `Colors.neutral200`
- **p2, p3** → `Colors.neutral300` ou `Colors.neutral400` (labels)
- **Liens/Actions** → `Colors.primary500`
