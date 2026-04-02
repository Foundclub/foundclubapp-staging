# Mobile Secrets Setup

This repository does not store mobile secret files in git.

## 1) Secure local storage

Store secrets outside the workspace in:

- Default: `%USERPROFILE%\.foundclub-secrets\mobile`
- Or custom path via env var: `FOUNDCLUB_SECRETS_DIR`

Expected files:

- `android\google-services.json`
- `android\google-services.staging.json` (optional)
- `ios\GoogleService-Info.plist`
- `android\keystore` (optional, release signing)

## 2) Sync into app workspace

From `app/`:

```powershell
npm run secrets:sync
```

This copies local secret files to:

- `android/app/google-services.json`
- `android/app/src/staging/google-services.json` (if provided)
- `ios/GoogleService-Info.plist`
- `android/app/keystore` (if provided)

## 3) TomTom map key

Le mode carte recherche utilise désormais TomTom côté app.

Required variables:

- `FC_SEARCH_MAP_PROVIDER=tomtom`
- `TOMTOM_API_KEY`

Supported sources:

- shell environment variables
- CI / EAS environment variables
- `.env.local`, `.env.staging`, `.env.production`

Recommended local setup:

```dotenv
FC_SEARCH_MAP_PROVIDER=tomtom
TOMTOM_API_KEY=votre-cle-tomtom
```

Le fallback `legacy` existe encore pour rollback, mais il n’est plus le chemin recommandé.

## 4) Important

1. Never commit secret files or keys.
2. Keep `app/.gitignore` rules unchanged.
3. Use CI / EAS secret variables for pipelines.

## 5) EAS Build (remote iOS/Android)

Le build EAS ne voit pas vos fichiers locaux `%USERPROFILE%\.foundclub-secrets\mobile`.
Le projet exécute automatiquement ce hook avant installation :

- `npm run eas-build-pre-install`
- script: `scripts/secrets/prepare-eas-secrets.js`

Ce script crée les fichiers Firebase manquants depuis les variables d'environnement EAS.

### Variables supportées pour Firebase

- iOS plist (au moins une) :
  - `IOS_GOOGLE_SERVICE_INFO_PLIST`
  - `IOS_GOOGLE_SERVICE_INFO_PLIST_BASE64`
  - `GOOGLE_SERVICE_INFO_PLIST`
  - `GOOGLE_SERVICE_INFO_PLIST_BASE64`

- Android prod JSON (au moins une pour build Android) :
  - `ANDROID_GOOGLE_SERVICES_JSON`
  - `ANDROID_GOOGLE_SERVICES_JSON_BASE64`
  - `GOOGLE_SERVICES_JSON`
  - `GOOGLE_SERVICES_JSON_BASE64`

- Android staging JSON (optionnel) :
  - `ANDROID_GOOGLE_SERVICES_STAGING_JSON`
  - `ANDROID_GOOGLE_SERVICES_STAGING_JSON_BASE64`
  - `GOOGLE_SERVICES_STAGING_JSON`
  - `GOOGLE_SERVICES_STAGING_JSON_BASE64`

### Variables supportées pour TomTom

- `FC_SEARCH_MAP_PROVIDER`
- `TOMTOM_API_KEY`

### Exemple EAS

Firebase files:

```bash
eas secret:create --scope project --type file --name IOS_GOOGLE_SERVICE_INFO_PLIST --value ./ios/GoogleService-Info.plist
eas secret:create --scope project --type file --name ANDROID_GOOGLE_SERVICES_JSON --value ./android/app/google-services.json
```

TomTom:

```bash
eas secret:create --scope project --type string --name FC_SEARCH_MAP_PROVIDER --value "tomtom"
eas secret:create --scope project --type string --name TOMTOM_API_KEY --value "votre-cle-tomtom"
```
