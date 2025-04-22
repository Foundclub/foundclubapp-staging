# Found Club - application mobile

Ce projet contient le code source de l'application mobile Found Club. L'application permet aux clubs de sport de gérer leurs équipes, joueurs et évènements publics ou non.
Les sportifs peuvent rechercher et participer a des évènements publics (détections, entrainements ouverts) ou rejoindre leur club et leur équipe et participer aux évènements privés.

## Liens pratiques
[Spécifications](https://copilot.zol.fr/projects/found-club-application-mobile-production/issues?utf8=%E2%9C%93&set_filter=1&sort=id:desc&f%5B%5D=status_id&op%5Bstatus_id%5D=o&f%5B%5D=category_id&op%5Bcategory_id%5D=%3D&v%5Bcategory_id%5D%5B%5D=2374&f%5B%5D=&c%5B%5D=tracker&c%5B%5D=subject&c%5B%5D=total_estimated_hours&c%5B%5D=total_spent_hours&c%5B%5D=parent&c%5B%5D=parent.subject&group_by=project&t%5B%5D=estimated_hours&t%5B%5D=spent_hours&t%5B%5D=)  
[Documentation API]()    
[Maquettes](https://www.figma.com/design/4jcfUhOp1pr2RipSCof1Fk/Found-Club---officiel?node-id=10001-2&p=f&t=y2hC3DyzzfOqMTMG-0)  
[Documentation fonctionnelle](lien vers la documentation fonctionnelle) 

## Summary

1. [Dependencies](#dependencies)  
2. [Installation](#installation)  
2.1. [Requirements](#requirements)  
2.2. [Installations Steps](#installations-steps)  
3. [How to dev](#how-to-dev)  
4. [Git Rules](#git-rules)  
4.1 [Commit Prefixes](#commit-prefixes)  
4.2 [Branches Prefixes](#branches-prefixes)  
5. [Project Environment](#project-environment)  
6. [Third Party Services](#third-party-services)  
7. [Tech history](#tech-history)

## Dependencies 
- React navigation : handle navigation between screens
- Firebase messaging : handle push notifications
- Firebase auth : handle authentication
- Axios : handle API calls
- TanStack query : dataflow management
- Mmkv : handle local storage
- Sentry : errors monitoring

## Installation

### Requirements

Follow the React-Native documentation to set up your environment [here](https://reactnative.dev/docs/set-up-your-environment)  
> **Warning**  
> Follow the guidelines without using a framework (no need of expo here).  
> Ensure that your ruby version is the same as the one used in the CircleCI server.

### Installations steps

#### Copy environment file
```
cp .env.dist .env 
```
#### Install project js dependencies
```
npm install
```
#### Install ruby dependencies
```
cd android && bundle install && cd ../ios && bundle install
```
#### Install IOS pod dependencies
```
cd ios && pod install
```

## How to dev

- In one command window run: `npm run start` to open metro bundler (some logs will appear here)

- In another command window run:

    - android: `npm run android`

    - ios: `npm run ios`

## Git Rules

### Commit Prefixes
Commit should look like this : ``` "[type] description message" ```

Type must be one of the following :
- **New feature :** [+]
- **Bug fix :** [#]
- **Iteration :** [*]

### Branches Prefixes

**feature :** `/feature/[ticketNumber-]{0,1}[feature-name]`
**hotfix :** `/hotfix/[ticketNumber-description]`

### Workflow git
This projet must follow the git workflow describe [here](https://documentation.zol.fr/zol-internal-docs/latest/Projets-Workflows-et-repo/workflow-git).

#### Mobile specificities
To handle mobile app specificities, we can't use the same tag to handle prod and preprod deployment. A tag suffixed by `-rc` will trigger the preprod deployment and a tag without suffix will trigger the prod deployment.

#### CI/CD and test environment
This project use CircleCI to handle all CI/CD build process (the quality jobs are still playing on gitlabCI).  
Staging and preproduction app versions are available on firebase App Distribution to simplify users crossplatform testing.  
You can find all configurations steps [here](https://documentation.zol.fr/zol-internal-docs/latest/category/cicd-react-native).


## Project Environment
You're environment variables need to be set directly (and one by one) in CircleCI. They will be taken into account only if their names are prsent in the .env.dist file.

### Staging

**Git Branch Name:** `develop`  
**API URL:**  
**Back-office URL:**  
**How to deploy :** Push/merge on develop branch   

### Pre-production

**Git Branch Name:** `develop`  
**API URL:**  
**Back-office URL:**  
**How to deploy :** Tag on develop branch with his format `xx.xx.xx-rc`

### Production

**Git Branch Name:** `main`  
**API URL:**  
**Back-office URL:**  
**How to deploy :** Tag on main branch with this format `xx.xx.xx`

## Third party services

### Service name

[Firebase console](https://console.firebase.google.com/u/0/project/found-club/overview)
Gestion de l'authentification (Authentication - phone OTP) et la distribution des appplications de test (App Distribution)

## Tech history

L'historique technique est mutualisé entre cette application et l'application back-end afin de simplifier la rédaction. Les détails sont décrits dans le channel slack spécifique au projet : [#team_found_club](https://zolteam.slack.com/docs/T0D0FB5HN/F08H8NBNNAG)

