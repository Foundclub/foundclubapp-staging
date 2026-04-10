# Release solo mobile

## Cible operatoire
- `staging/test` : GitHub Actions + Firebase App Distribution
- `production` : builds locaux signes + publication manuelle sur les stores

## Etat actuel deja valide
- backend production operationnel sur `https://api.foundclubpro.com`
- `healthz` et `readyz` en `200`
- `install.html` et `suppression.html` en `200`
- Firebase Android production en place localement
- Firebase iOS production en place localement
- keystore Android local remplace par la nouvelle upload key
- Team ID Apple injecte dans le projet Xcode

## Fichiers a fournir hors repo
- Android prod : `android/app/src/production/google-services.json`
- iOS prod : `ios/GoogleService-Info.production.plist`
- keystore Android prod : `android/app/keystore`
- certificat / provisioning profile iOS prod

## Secrets GitHub Actions utiles pour le staging
- `ANDROID_STAGING_GOOGLE_SERVICES_JSON_BASE64`
- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`
- `FIREBASE_APP_ID_ANDROID`
- `FIREBASE_APP_ID_IOS`
- `FIREBASE_GROUPS`
- secrets iOS utilises par `ios-build-artifact.yml`

## Android staging
1. Creer ou verifier `.env.staging` a partir de `.env.staging.example`
2. Declencher `Android Staging Distribution`
3. Recuperer l'APK artifact si besoin
4. Verifier la distribution Firebase App Distribution

## Android production manuelle
1. Creer `.env.production` depuis `.env.production.example`
2. Copier le vrai `google-services.json` prod dans `android/app/src/production/google-services.json`
3. Placer le keystore prod dans `android/app/keystore`
4. Construire le bundle :
   - `cd android`
   - `./gradlew bundleProductionRelease -PRELEASE_STORE_PASSWORD=... -PRELEASE_KEY_PASSWORD=... -PversionCode=... -PversionName=...`
5. Uploader l'AAB manuellement dans Google Play Console
6. Si vous buildiez sur Windows avec la New Architecture active et que CMake echoue sur une longueur de chemin, activez les chemins longs Windows ou lancez le build depuis Linux/macOS/WSL

Important :
- Google Play a confirme que la nouvelle upload key devient active le `11 avril 2026 a 15:11 UTC`
- pour Paris, cela correspond au `11 avril 2026 a 17:11`
- avant cette heure, l'upload de nouvel AAB restera bloque cote Play Console

## iOS production manuelle
1. Preparer `.env.production`
2. Copier `GoogleService-Info.production.plist` vers `ios/GoogleService-Info.plist`
3. Ouvrir `ios/foundclub.xcworkspace`
4. Configurer la signature Apple sur `com.foundclub`
5. Faire une archive `Release`
6. Envoyer vers TestFlight / App Store Connect

## iOS sans Mac local
Si vous n'avez pas de Mac, utilisez le workflow GitHub Actions :
- [ios-testflight-release.yml](/d:/App/fc/app/.github/workflows/ios-testflight-release.yml)

Secrets GitHub requis :
- `GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64`
- `BUILD_CERTIFICATE_BASE64`
- `P12_PASSWORD`
- `BUILD_PROVISION_PROFILE_APPSTORE_BASE64`
- `KEYCHAIN_PASSWORD`
- `APPLE_TEAM_ID`
- `APPSTORE_KEY_ID`
- `APPSTORE_ISSUER_ID`
- `APPSTORE_PRIVATE_KEY_BASE64`

Note importante :
- le provisioning profile doit etre un profil compatible `App Store` / `TestFlight`
- si le profil fourni aujourd'hui est seulement `ad hoc`, le workflow ira jusqu'au build mais echouera au moment de l'export ou de l'upload

## Verifications avant store release
- `APP_ENV=production`
- `API_URL=https://api.foundclubpro.com/api`
- `SOCKET_URL=https://api.foundclubpro.com`
- auth Firebase OK
- chat/socket OK
- upload media OK
- push notifications OK
- liens `install.html` / `suppression.html` OK
- `TOMTOM_API_KEY` renseignee si vous voulez que la carte de recherche soit pleinement operationnelle en prod

## Commande Android recommandee
Depuis `app/` :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release\build-production-android.ps1 `
  -ReleaseStorePassword "<mot-de-passe-keystore>" `
  -ReleaseKeyPassword "<mot-de-passe-cle>" `
  -VersionCode 2 `
  -VersionName "1.0.1"
```

## Resultat attendu
- AAB genere sous `android/app/build/outputs/bundle/productionRelease/`
- upload manuel en test interne Play Console
- archive iOS envoyee d'abord sur TestFlight
