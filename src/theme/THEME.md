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
- `primary100`, `primary200`, `primary500`, `primary700`, `primary900`
- `neutral00` ... `neutral900` (including `neutral600`)
- `success*`, `warning*` (including `warning900`), `error*`, `gold*`

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

### Alignments
Primary helpers:
- `row`, `column`, `alignCenter`, `justifySpaceBetween`, `fill`, etc.
- compatibility aliases: `center`, `spaceBetween`, `mainCenter`, `selfStart`

## Governance Rules
1. Do not add new hardcoded hex colors outside `src/theme/*`.
2. If a temporary exception is required, add the file to `scripts/theme-hex-allowlist.json` and document the reason in the merge request.
3. Add or change tokens in theme files before using them in components.
4. Run `npm run verify:theme-contract` before pushing.
5. When introducing compatibility aliases, mark them deprecated and map them to semantic tokens.

## Validation
- Contract check script: `scripts/verify-theme-contract.js`
- Hex exception allowlist: `scripts/theme-hex-allowlist.json`
- Command: `npm run verify:theme-contract`
- CI job: `theme-contract`

## Notes
- Current visual baseline remains dark-first.
- Compatibility aliases remain during the stabilization phase; removal is deferred to a dedicated migration.
