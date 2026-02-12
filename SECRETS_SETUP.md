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
