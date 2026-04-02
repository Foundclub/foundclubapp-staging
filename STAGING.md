# STAGING (App React Native)

## Repo
- **Repo privé** : `foundclubapp-staging` (GitHub)
- **Branches** : `main` + `staging`

## Fichiers d'environnement

- `.env.staging` requis (local uniquement, ne pas commit)
- `.env.example` : modèle public pouvant être commité

## Firebase

- **Projet Firebase staging** : `foundclub-staging`
- **Apps** : Android + iOS avec identifiants distincts
- **Distribution** : Firebase App Distribution ou EAS/Internal distribution

## Configuration Android

### Product flavors

L'app utilise des product flavors pour séparer production et staging :

- **Production** : `applicationId "com.foundclub"`
- **Staging** : `applicationIdSuffix ".staging"` soit `com.foundclub.staging`

### Fichiers Firebase Android

- **Production** : `android/app/src/production/google-services.json`
- **Staging** : `android/app/src/staging/google-services.json`

### Clés Google Maps Android

Les builds Android exigent maintenant une vraie clé Google Maps par environnement :

- `GOOGLE_MAPS_ANDROID_API_KEY_STAGING`
- `GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION`

Sources supportées par Gradle :

- variables d'environnement shell / CI / EAS
- `gradle.properties` avec les mêmes noms
- fallback accepté :
  - `googleMapsApiKeyStaging`
  - `googleMapsApiKeyProduction`

Un build `staging` ou `production` échoue explicitement si la clé est absente ou reste au placeholder.

### Configuration Google Cloud Console

Pour **staging** :

- activer `Maps SDK for Android`
- activer la facturation
- restreindre la clé au package `com.foundclub.staging`
- ajouter le SHA du debug keystore local
- ajouter le SHA réellement utilisé pour les builds internes/staging

Pour **production** :

- activer `Maps SDK for Android`
- activer la facturation
- restreindre la clé au package `com.foundclub`
- ajouter le SHA release/prod correspondant

### Build staging

```powershell
# Redémarrer Metro si nécessaire
taskkill /F /IM node.exe
$env:APP_ENV="staging"
$env:GOOGLE_MAPS_ANDROID_API_KEY_STAGING="votre-cle-staging"
npm run start:staging

# Build Android staging
npm run android:staging
# ou
$env:APP_ENV="staging"
$env:GOOGLE_MAPS_ANDROID_API_KEY_STAGING="votre-cle-staging"
cd android
./gradlew assembleStagingDebug
```

### Exemple gradle.properties local

Fichier : `%USERPROFILE%\.gradle\gradle.properties`

```properties
GOOGLE_MAPS_ANDROID_API_KEY_STAGING=votre-cle-staging
GOOGLE_MAPS_ANDROID_API_KEY_PRODUCTION=votre-cle-production
```

## Configuration iOS

### Actions manuelles dans Xcode

1. **Apple Developer Portal**
   - Créer un App ID distinct : `com.foundclub.staging`
   - Générer un profil de provisioning pour ce bundle staging
   - Télécharger et installer le profil dans Xcode

2. **Xcode**
   - Dupliquer le target `foundclub` vers `FoundClub Staging`
   - Dupliquer le scheme `foundclub` vers `FoundClub Staging`
   - Bundle Identifier staging : `com.foundclub.staging`
   - Sélectionner le provisioning profile staging dans `Signing & Capabilities`
   - Ajouter `GoogleService-Info-Staging.plist` au target staging uniquement
   - Ajouter `APP_ENV=staging` dans le scheme staging

3. **Certificats iOS**
   - Prévoir des certificats/profiles distincts pour éviter les conflits avec la prod

4. **Associated Domains**
   - Configurer des domaines séparés si les liens profonds diffèrent entre staging et prod

### Build iOS staging

```bash
npm run ios:staging
# ou
APP_ENV=staging react-native run-ios --scheme "FoundClub Staging"
```

## Scripts disponibles

- `npm run start:staging`
- `npm run android:staging`
- `npm run ios:staging`
- `npm run secrets:sync`

## Firebase Auth / OAuth / Push

### Actions manuelles dans Firebase Console

1. **Firebase Auth**
   - reconfigurer les providers Google/Apple/etc. dans le projet staging
   - configurer les redirections OAuth staging

2. **SHA-1 Android**
   - récupérer le SHA debug local :
     `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey`
   - l'ajouter dans Firebase si nécessaire

3. **APNs iOS**
   - rattacher la clé APNs au Firebase staging
   - configurer les certificats APNs pour `com.foundclub.staging`

## Liens profonds / universels

### Android
- configurer des intent filters spécifiques staging si le host diffère

### iOS
- configurer des Associated Domains séparés si nécessaire

## Nom + icône

- **Nom staging** : `FoundClub Staging`
- **Icône** : prévoir un badge `STG` pour éviter les confusions

## Important

Redémarrer Metro après changement d'environnement :

```powershell
taskkill /F /IM node.exe
$env:APP_ENV="staging"
npm run start:staging
```
