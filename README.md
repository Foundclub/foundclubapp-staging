# FoundClub mobile app

Ce repo est la source de vérité de l’application mobile FoundClub.

## Modèle d’exploitation
- `local` : développement manuel avec `.env.local`
- `staging/test` : backend sur Strapi Cloud + builds GitHub Actions + Firebase App Distribution
- `production` : backend autonome séparé + publication manuelle App Store / Play Store

## Démarrage local
1. Copier `.env.local.example` vers `.env.local` et compléter les valeurs locales.
2. Installer les dépendances JS : `npm ci`
3. Installer CocoaPods : `cd ios && pod install`
4. Lancer Metro : `npm run start:local`
5. Lancer l’app :
   - Android : `npm run android:local`
   - iOS : `npm run ios:local`

## Environnements
- `.env.staging.example` documente le contrat du staging/test. Copier vers `.env.staging` localement si vous voulez lancer ou builder cet environnement hors CI.
- `.env.production.example` décrit le contrat attendu pour la prod autonome.
- Les fichiers Firebase prod ne sont pas commités :
  - Android : `android/app/src/production/google-services.example.json`
  - iOS : `ios/GoogleService-Info.production.example.plist`

## CI / builds de test
- `.github/workflows/app-ci.yml` : qualité repo
- `.github/workflows/android-staging-distribution.yml` : build Android staging + App Distribution
- `.github/workflows/ios-build-artifact.yml` : build iOS staging + distribution Firebase

## Release manuelle
La procédure solo complète est documentée dans `docs/manual-release.md`.

## Legacy
Les fichiers Fastlane / CircleCI encore présents sont conservés comme archive technique, mais ne doivent plus être considérés comme le chemin officiel de publication.
