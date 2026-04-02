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

## 3) Google Maps Android keys

Google Maps Android uses build-time secrets, not tracked files.

Required variables:

- `GOOGLE_MAPS_ANDROID_API_KEY_STAGING`
- `GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION`

Supported sources:

- shell environment variables
- CI / EAS environment variables
- `gradle.properties` with the same names
- fallback property names:
  - `googleMapsApiKeyStaging`
  - `googleMapsApiKeyProduction`

Recommended local setup:

File: `%USERPROFILE%\.gradle\gradle.properties`

```properties
GOOGLE_MAPS_ANDROID_API_KEY_STAGING=votre-cle-staging
GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION=votre-cle-production
```

Android builds fail explicitly if the matching Maps key is missing or still equals the placeholder.

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

### Variables supportées pour Google Maps Android

- `GOOGLE_MAPS_ANDROID_API_KEY_STAGING`
- `GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION`

### Exemple EAS

Firebase files:

```bash
eas secret:create --scope project --type file --name IOS_GOOGLE_SERVICE_INFO_PLIST --value ./ios/GoogleService-Info.plist
eas secret:create --scope project --type file --name ANDROID_GOOGLE_SERVICES_JSON --value ./android/app/google-services.json
```

Google Maps keys:

```bash
eas secret:create --scope project --type string --name GOOGLE_MAPS_ANDROID_API_KEY_STAGING --value "votre-cle-staging"
eas secret:create --scope project --type string --name GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION --value "votre-cle-production"
```
