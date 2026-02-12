# Mobile Secrets Setup (Local Only)

This repository does not store mobile secret files in git.

## 1) Secure local storage

Store secrets outside the workspace in:

- Default: `%USERPROFILE%\\.foundclub-secrets\\mobile`
- Or custom path via env var: `FOUNDCLUB_SECRETS_DIR`

Expected files:

- `android\\google-services.json`
- `android\\google-services.staging.json` (optional)
- `ios\\GoogleService-Info.plist`
- `android\\keystore` (optional, release signing)

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

## 3) Important

1. Never commit secret files.
2. Keep `app/.gitignore` rules unchanged.
3. Use CI secret variables for pipelines.

## 4) EAS Build (remote iOS/Android)

Le build EAS ne voit pas vos fichiers locaux `%USERPROFILE%\\.foundclub-secrets\\mobile`.
Le projet execute automatiquement ce hook avant installation:

- `npm run eas-build-pre-install`
- script: `scripts/secrets/prepare-eas-secrets.js`

Ce script cree les fichiers manquants depuis les variables d'environnement EAS.

### Variables supportees

- iOS plist (au moins une):
  - `IOS_GOOGLE_SERVICE_INFO_PLIST` (contenu XML direct ou chemin fichier secret EAS)
  - `IOS_GOOGLE_SERVICE_INFO_PLIST_BASE64`
  - `GOOGLE_SERVICE_INFO_PLIST`
  - `GOOGLE_SERVICE_INFO_PLIST_BASE64`

- Android prod JSON (au moins une pour build Android):
  - `ANDROID_GOOGLE_SERVICES_JSON`
  - `ANDROID_GOOGLE_SERVICES_JSON_BASE64`
  - `GOOGLE_SERVICES_JSON`
  - `GOOGLE_SERVICES_JSON_BASE64`

- Android staging JSON (optionnel):
  - `ANDROID_GOOGLE_SERVICES_STAGING_JSON`
  - `ANDROID_GOOGLE_SERVICES_STAGING_JSON_BASE64`
  - `GOOGLE_SERVICES_STAGING_JSON`
  - `GOOGLE_SERVICES_STAGING_JSON_BASE64`

### Exemple (secrets type file, recommande)

```bash
eas secret:create --scope project --type file --name IOS_GOOGLE_SERVICE_INFO_PLIST --value ./ios/GoogleService-Info.plist
eas secret:create --scope project --type file --name ANDROID_GOOGLE_SERVICES_JSON --value ./android/app/google-services.json
```
