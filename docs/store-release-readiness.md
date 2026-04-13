# Store release readiness

## Etat au 10 avril 2026

### Production backend
- `OK`
- `https://api.foundclubpro.com/api/healthz` retourne `200`
- `https://api.foundclubpro.com/api/readyz` retourne `200`
- `https://api.foundclubpro.com/install.html` retourne `200`
- `https://api.foundclubpro.com/suppression.html` retourne `200`

### Android production
- `Partiel`
- pret localement :
  - Firebase prod
  - nouvelle upload key
  - package `com.foundclub`
- reste bloquant :
  - `RELEASE_STORE_PASSWORD`
  - `RELEASE_KEY_PASSWORD`
  - activation Google Play de la nouvelle upload key le `11 avril 2026 a 17:11` heure de Paris

### iOS production
- `Partiel`
- pret localement :
  - bundle id `com.foundclub`
  - Team ID `RBJCH8458B`
  - plist Firebase prod
- chemin sans Mac local maintenant prepare :
  - workflow GitHub Actions `iOS TestFlight Release`
- contrainte App Store Connect a partir du 28 avril 2026 :
  - workflow iOS avec Xcode 26+ et SDK `iphoneos` 26+
- reste bloquant :
  - fournir les secrets GitHub Actions iOS release
  - verifier si le provisioning profile fourni est bien celui a utiliser pour TestFlight/App Store

### Runtime prod
- `Partiel`
- pret :
  - `API_URL=https://api.foundclubpro.com/api`
  - `SOCKET_URL=https://api.foundclubpro.com`
  - `DELETE_ACCOUNT_URL=https://api.foundclubpro.com/suppression.html`
  - `CONTACT_URL=https://foundclubpro.com`
- reste a fournir :
  - `TOMTOM_API_KEY` si la carte de recherche doit etre operationnelle en prod

### Securite
- `Partiel`
- backend solo et separation prod/staging en place
- reste a faire :
  - decision explicite sur la rotation / revocation des anciens secrets exposes

## Ordre recommande jusqu'aux stores
1. Recuperer `RELEASE_STORE_PASSWORD`
2. Recuperer `RELEASE_KEY_PASSWORD`
3. Fournir les secrets GitHub Actions iOS release
4. Fournir `TOMTOM_API_KEY` si vous gardez la carte TomTom en prod
5. A partir du `11 avril 2026 a 17:11` heure de Paris, generer l'AAB Android prod
6. Uploader Android en test interne Play Console
7. Declencher le workflow iOS TestFlight Release
8. Faire un smoke test complet sur builds stores
9. Publier progressivement

## Smoke test minimum sur builds stores
- connexion Firebase
- creation de compte / recuperation de session
- chat et websocket
- upload media
- notifications push
- ouverture de `install.html`
- ouverture de `suppression.html`
- carte de recherche
