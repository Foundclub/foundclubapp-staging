---
description: Switch between Strapi Cloud and Local Strapi for mobile app development
---

# Basculer entre Strapi Cloud et Local

## Vue d'ensemble

Tu as 2 environnements Strapi possibles pour ton app mobile :

- **Strapi Cloud** : Production/Staging en ligne
- **Strapi Local** : Pour tester les nouvelles features avant déploiement

## Fichiers d'environnement

```
d:\App\fc\app\
├── .env           # Environnement actif (défaut: prod)
├── .env.staging   # Staging cloud
├── .env.local     # Local (à créer)
```

## 1. Créer `.env.local` pour Strapi Local

```env
# d:\App\fc\app\.env.local
APP_NAME=FoundClub Local
ENV=local

# API pointe vers Strapi local
# Pour émulateur Android: 10.0.2.2:1337
# Pour iOS simulator: localhost:1337
API_URL=http://10.0.2.2:1337/api
STRAPI_URL=http://10.0.2.2:1337
SOCKET_URL=http://10.0.2.2:1337

# Firebase (même config staging)
FIREBASE_PROJECT_ID=foundclub-staging
FIREBASE_WEB_API_KEY=...
# ... copie les autres valeurs de .env.staging
```

## 2. Scripts npm à ajouter dans package.json

```json
{
  "scripts": {
    "start:local": "cross-env APP_ENV=local react-native start",
    "android:local": "cross-env APP_ENV=local react-native run-android",
    "ios:local": "cross-env APP_ENV=local react-native run-ios"
  }
}
```

## 3. Mettre à jour babel.config.js

Le fichier doit charger le bon fichier `.env` selon `APP_ENV` :

```javascript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'inline-dotenv',
      {
        path: `.env.${process.env.APP_ENV || 'production'}`,
      },
    ],
    // ... autres plugins
  ],
};
```

## 4. Lancer Strapi Local

```bash
# Terminal 1 - Strapi
cd d:\App\fc\admin
npm run develop

# Strapi écoute sur http://localhost:1337
```

## 5. Lancer l'App avec Strapi Local

```bash
# Terminal 2 - Metro + App
cd d:\App\fc\app

# Vider le cache Metro (important après changement d'env !)
npx react-native start --reset-cache

# Puis dans un autre terminal
npm run android:local
# OU
npm run ios:local
```

## Commandes rapides

| Environnement     | Commandes                                   |
| ----------------- | ------------------------------------------- |
| **Cloud Staging** | `npm start stagging` + `npm run android`    |
| **Local**         | `npm start:local` + `npm run android:local` |
| **Reset cache**   | `npx react-native start --reset-cache`      |

## Checklist de bascule

- [ ] Stopper Metro (`Ctrl+C`)
- [ ] Lancer Strapi local si besoin (`cd admin && npm run develop`)
- [ ] Relancer Metro avec le bon env (`npm start:local` ou `npm start stagging`)
- [ ] Rebuild l'app si changement de .env (`npm run android:local`)

## Dépannage

### L'app ne voit pas Strapi local ?

1. Vérifier que Strapi tourne (`http://localhost:1337/admin`)
2. Pour Android émulateur : utiliser `10.0.2.2` pas `localhost`
3. Vider le cache Metro : `npx react-native start --reset-cache`

### Les données sont différentes ?

Normal ! Strapi local a sa propre base de données.
Tu peux la synchro avec un script de seed si besoin.
