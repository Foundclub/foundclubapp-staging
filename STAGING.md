# STAGING (App React Native)

## Repo
- **Repo privé** : `foundclubapp-staging` (GitHub)
- **Branches** : `main` + `staging`

## Fichiers d'environnement

- `.env.staging` requis (local uniquement, NE PAS COMMIT)
- `.env.example` : modèle public (peut être commité)

## Firebase

- **Projet Firebase staging** : `foundclub-staging` (à créer)
- **Apps** : Android + iOS avec identifiants distincts
- **Distribution** : Firebase App Distribution (groupes QA)

## Configuration Android

### Product Flavors

L'app utilise des product flavors pour séparer production et staging :

- **Production** : `applicationId "com.foundclub"`
- **Staging** : `applicationIdSuffix ".staging"` → `com.foundclub.staging`

### Fichiers Firebase Android

- **Production** : `android/app/src/production/google-services.json`
- **Staging** : `android/app/src/staging/google-services.json`

### Build staging

```powershell
# Redémarrer Metro si nécessaire
taskkill /F /IM node.exe
$env:APP_ENV="staging"
npm run start:staging

# Build Android staging
npm run android:staging
# ou
$env:APP_ENV="staging"; cd android; ./gradlew assembleStagingDebug
```

## Configuration iOS

### Actions manuelles dans Xcode

1. **Apple Developer Portal** :
   - Créer un App ID distinct : `com.foundclub.staging`
   - Générer un profil de provisioning pour ce bundle (staging)
   - Télécharger et installer le profil dans Xcode

2. **Xcode** :
   - Dupliquer le Target "foundclub" → "FoundClub Staging"
   - Dupliquer le Scheme "foundclub" → "FoundClub Staging"
   - Bundle Identifier du staging : `com.foundclub.staging`
   - Sélectionner le profil de provisioning staging dans Signing & Capabilities
   - Ajouter `GoogleService-Info-Staging.plist` au target staging uniquement (la prod garde son plist prod)
   - Dans le Scheme "FoundClub Staging" → Edit Scheme → Run → Arguments → Environment Variables → Ajouter `APP_ENV = staging`

3. **Certificats iOS** : Nouveaux certificats/profiles pour le bundle staging (évite les conflits avec prod)

4. **Associated Domains** (si liens profonds) : Configurer des domaines séparés pour le bundle staging dans les entitlements

### Build iOS staging

```bash
npm run ios:staging
# ou
APP_ENV=staging react-native run-ios --scheme 'FoundClub Staging'
```

## Scripts disponibles

- `npm run start:staging` : Démarrer Metro avec APP_ENV=staging
- `npm run android:staging` : Build Android staging
- `npm run ios:staging` : Build iOS staging

## Firebase Auth/OAuth & Push

### Actions manuelles dans Firebase Console

1. **Firebase Auth** :
   - Reconfigurer les providers (Google/Apple/etc.) dans le projet Firebase staging
   - Configurer les nouvelles redirections OAuth pour staging

2. **SHA-1 Android** :
   - Récupérer le SHA-1 du keystore staging : `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey`
   - Ajouter ce SHA-1 au projet Firebase staging (Settings → Your apps → Android app → SHA certificate fingerprints)

3. **APNs iOS** :
   - Rattacher la clé APNs au Firebase staging (Cloud Messaging iOS)
   - Configurer les certificats APNs pour le bundle `com.foundclub.staging`

## Liens profonds / universels

### Android
- Configurer des intent-filters spécifiques staging si host différent (ex. `staging.foundclubpro.com`)
- Dans `AndroidManifest.xml`, ajouter des intent-filters pour le flavor staging

### iOS
- Configurer Associated Domains séparés pour le bundle staging dans les entitlements
- Ajouter les domaines staging dans `foundclub.entitlements` pour le target staging

## Nom + icône de l'app

- **Nom staging** : "FoundClub Staging" (configuré via `resValue "string", "app_name"`)
- **Icône** : Ajouter un badge "STG" pour éviter les confusions avec la prod

## Important

⚠️ **Redémarrer Metro après changement d'env** : Metro ne recharge pas toujours les vars si on ne le redémarre pas.

```powershell
taskkill /F /IM node.exe
$env:APP_ENV="staging"
npm run start:staging
```

