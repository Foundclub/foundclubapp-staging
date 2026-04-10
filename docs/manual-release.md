# Release solo mobile

## Cible opératoire
- `staging/test` : GitHub Actions + Firebase App Distribution
- `production` : builds locaux signés + publication manuelle sur les stores

## Fichiers à fournir hors repo
- Android prod : `android/app/src/production/google-services.json`
- iOS prod : `ios/GoogleService-Info.production.plist` puis copie/renommage vers `ios/GoogleService-Info.plist` pour l’archive locale
- Keystore Android prod : `android/app/keystore`
- Certificat / provisioning profile iOS prod

## Secrets GitHub Actions pour le staging
- `ANDROID_STAGING_GOOGLE_SERVICES_JSON_BASE64`
- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`
- `FIREBASE_APP_ID_ANDROID`
- `FIREBASE_APP_ID_IOS`
- `FIREBASE_GROUPS`
- secrets iOS déjà utilisés par `ios-build-artifact.yml`

## Android staging
1. Créer ou vérifier `.env.staging` à partir de `.env.staging.example`
2. Déclencher `Android Staging Distribution`
3. Récupérer l’APK artifact si besoin
4. Vérifier la distribution Firebase App Distribution

## Android production manuelle
1. Créer `.env.production` depuis `.env.production.example`
2. Copier le vrai `google-services.json` prod dans `android/app/src/production/google-services.json`
3. Placer le keystore prod dans `android/app/keystore`
4. Construire le bundle :
   - `cd android`
   - `./gradlew bundleProductionRelease -PRELEASE_STORE_PASSWORD=... -PRELEASE_KEY_PASSWORD=... -PversionCode=... -PversionName=...`
5. Uploader l’AAB manuellement dans Google Play Console
6. Si vous buildiez sur Windows avec la New Architecture activée et que CMake échoue sur une longueur de chemin, activez les chemins longs Windows ou lancez le build depuis un environnement Linux/macOS.

## iOS production manuelle
1. Préparer `.env.production`
2. Copier le vrai `GoogleService-Info.production.plist` vers `ios/GoogleService-Info.plist`
3. Ouvrir `ios/foundclub.xcworkspace`
4. Configurer la signature Apple sur `com.foundclub`
5. Faire une archive `Release`
6. Envoyer vers TestFlight / App Store Connect

## Vérifications avant store release
- `APP_ENV=production`
- `API_URL=https://api.foundclubpro.com/api`
- `SOCKET_URL=https://api.foundclubpro.com`
- Auth Firebase OK
- Chat/socket OK
- Upload média OK
- Push notifications OK
- Liens `install.html` / `suppression.html` OK
