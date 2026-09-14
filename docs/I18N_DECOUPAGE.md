# I18N — le découpage de l'anglais en 4 lots parallèles (I18N-1 à I18N-4)

> Écrit le **2026-09-14** par le lot **I18N-0** (branche `feat/I18N0-socle-anglais`).
> ⚠️ **Tous les chiffres ci-dessous sont des mesures du 14/09.** Chaque lot les **re-mesure** avant
> son premier geste : un inventaire de plus de 7 jours est un souvenir, pas un état.

---

## 1. Ce que le socle I18N-0 a posé — à connaître avant d'ouvrir un écran

| Pièce | Où | Ce qu'elle fait |
|---|---|---|
| Langue de l'app | `src/theme/strings/langue.js` | Choix du profil **ou** langue du téléphone (`fr…` → français, autre → anglais, inconnue → français) |
| Réglage « Langue » | Profil › Mon compte | Déplie *Langue du téléphone / Français / English*, applique tout de suite, retient le choix |
| Dictionnaire anglais | `src/theme/strings/translations/en.js` | **Les mêmes clefs que `fr.js`** (4 237 au 14/09) — témoin `src/theme/strings/__tests__/enClefsIdentiques.test.js` |
| Formats de date | `src/theme/strings/localeDesFormats.js` | `localeDesFormats()` → `'fr-FR'` ou `'en-GB'`. **Remplace chaque `'fr-FR'` écrit en dur.** date-fns suit déjà la langue tout seul. |
| Témoins en français | `jest.setup.js` | Double de `langue.js` : **tous les témoins tournent en français**, quelle que soit la machine |
| Relevé des replis | `node scripts/i18n/clefs.js replis` | `ajoutables`, `minees`, `illisibles`, `nues`, **`replisIgnores`** |
| Porte d'un lot | `node scripts/i18n/clefs.js replis --controle --traductions <json>` | Code 1 si une clef nouvelle n'a pas sa traduction, ou pas les mêmes `{{jetons}}` |
| Cliquet | `npm run i18n:no-regression` | Refuse un fichier qui **ajoute** du français en dur hors `t()` (baseline `.ci/i18n-francais-en-dur-baseline.json`) |
| Détail par fichier | `node scripts/i18n/francais-en-dur.js --rapport x.json` | Les numéros de ligne de français en dur, fichier par fichier |
| Extraction fidèle | `node scripts/i18n/extraction-fidele.js` | Chaque texte français d'avant existe encore après, **tel quel ou en repli** — sinon code 1 et la liste |
| Pliage | `node scripts/i18n/clefs.js replis --ecrire` puis `en --traductions <json>` | Pose les clefs dans `fr.js` puis `en.js`, **à leur place triée, sans déplacer une ligne** |

---

## 2. Les chiffres (mesurés le 14/09 sur `feat/I18N0-socle-anglais`)

| Mesure | Valeur | Commande |
|---|---:|---|
| Lignes de français en dur hors `t()` | **6 040** | `npm run i18n:no-regression` |
| Fichiers qui en portent | **403** | idem |
| `'fr-FR'` écrits en dur (hors `localeDesFormats.js`) | **83** dans 49 fichiers | recherche `'fr-FR'` |
| Fichiers à traiter (français **ou** `'fr-FR'`) | **414** | union des deux |
| Replis ignorés (clef déjà dans `fr.js`, autre texte) | **157** | `node scripts/i18n/clefs.js replis` |
| Clefs `fr.js` = clefs `en.js` | **4 237** | `enClefsIdentiques.test.js` |

> 🧮 Le plan du 14/09 citait « ~3 750 lignes dans 492 fichiers » : c'était une recherche textuelle.
> Le chiffre ci-dessus lit le code avec Babel (littéraux, gabarits entiers, texte JSX, hors `t()` et
> `console`) — il est plus haut parce qu'il voit les mots isolés accentués (« Réessayer ») et les
> gabarits. Heuristique et limites : en tête de `scripts/i18n/francais-en-dur.js`.

---

## 3. La règle qui rend les 4 lots indépendants : AUCUN fichier partagé

**Le piège** : `fr.js` et `en.js` sont les deux seuls fichiers que les 4 lots toucheraient tous. Quatre
branches qui insèrent chacune 500 clefs dans le même fichier = quatre récoltes en conflit.

**La règle** : ⛔ **un lot n'écrit JAMAIS dans `fr.js` ni dans `en.js`.**

1. Dans **ses** fichiers, chaque texte affiché devient un appel avec **repli** :
   ```js
   // avant
   <Text>Temps de jeu</Text>
   // après
   <Text>{t('playerMatchResponse.playingTime', 'Temps de jeu')}</Text>
   ```
   Le repli est le **texte français d'avant, au caractère près** : l'écran français ne change pas, les
   témoins restent verts, et `extraction-fidele.js` le prouve.
2. Sa traduction va dans **son** fichier : `docs/i18n/I18N-<n>.en.json`
   ```json
   { "playerMatchResponse.playingTime": "Playing time" }
   ```
3. **Le pliage** dans `fr.js` / `en.js` se fait **une seule fois**, à la récolte (§4).

### Les formes à employer

| Cas | Écrire |
|---|---|
| Texte simple | `t('ecran.clef', 'Texte')` |
| Interpolation | `t('ecran.clef', 'Bonjour {{prenom}}', { prenom })` — **jamais** de concaténation |
| Pluriel | `t('ecran.clef', { count, defaultValue_one: '{{count}} séance', defaultValue_other: '{{count}} séances' })` → JSON : `ecran.clef_one`, `ecran.clef_other` |
| Hors composant (utils, domains, services) | `import i18next from 'i18next';` puis `i18next.t('ecran.clef', 'Texte')` |
| Date / nombre | `import localeDesFormats from '@/theme/strings/localeDesFormats';` puis `toLocaleDateString(localeDesFormats(), …)` |

### Les cinq pièges, tous mesurés

1. 🪤 **Importer `@/theme/strings` depuis un écran fait tomber ses témoins** : ceux qui doublent
   `react-i18next` n'ont pas `initReactI18next`. Toujours `i18next` ou `localeDesFormats` directement.
2. 🪤 **Une clef déjà prise remplace ton texte sans bruit** : si `ecran.clef` existe dans `fr.js` avec un
   autre texte, i18next affiche celui de `fr.js`. Contrôle : `replisIgnores` **doit rester à 157**.
3. 🪤 **Deux replis différents pour la même clef = une mine** (voir `MINES_CONNUES` dans
   `frClefsAtteignables.test.js`) : jamais pliée, et le témoin rougit. **Une clef = un texte.**
   Espace de noms : celui de l'écran (camelCase du nom du fichier), **jamais `common.*`**.
4. 🪤 **Un pluriel fabriqué à la main peut changer le français** : i18next applique la vraie règle (0 et 1
   prennent le singulier). `` `${n} action${n > 1 ? 's' : ''}` `` rendait déjà « 0 action » → rien ne
   change ; `` `${n} action${n === 1 ? '' : 's'}` `` rendait « 0 actions » → devient « 0 action ».
   `extraction-fidele.js` signale **tout** gabarit réécrit en pluriel : chaque ligne se justifie dans le
   compte rendu, et un témoin qui lisait « 0 actions » est un changement à nommer, jamais à taire.
5. 🪤 **Un témoin qui double `t` en rendant la CLEF** (`t: (k) => k`) rougit dès qu'un texte en dur passe
   par `t()`. Le faire lire le vrai `fr.js` puis le repli (motif de `Profile.menuProfil.test.js`), **sans
   changer ce qu'il affirme**.

### Pourquoi pas un témoin de caractérisation par fichier (E6)

Les 414 fichiers n'ont pas tous un témoin. Un lot d'extraction ne change **qu'une chose** : d'où vient le
texte. Sa seule promesse — *le français affiché ne change pas* — est vérifiée **mécaniquement** par
`extraction-fidele.js` sur chaque fichier touché. ⚠️ **Ce n'est une exemption d'E6 que pour ce geste-là** :
un lot qui en profite pour réorganiser un écran, supprimer une branche ou « simplifier » retombe sous E6.
*(Décision à confirmer par le chef d'orchestre — voir le bloc « à trancher » du compte rendu I18N-0.)*

---

## 4. La récolte — le pliage, une seule session, après les 4 lots

Dans une copie de travail sur `staging` **après fusion des 4 branches** :

```bash
# 1. fusionner les 4 traductions en un seul fichier
node -e "const f=require('fs');const o={};['1','2','3','4'].forEach(n=>Object.assign(o,JSON.parse(f.readFileSync('docs/i18n/I18N-'+n+'.en.json','utf8'))));f.mkdirSync('.tmp',{recursive:true});f.writeFileSync('.tmp/i18n-en.json',JSON.stringify(o,null,1))"
# 2. la porte, sur l'ensemble
node scripts/i18n/clefs.js replis --controle --traductions .tmp/i18n-en.json
# 3. le pliage
node scripts/i18n/clefs.js replis --ecrire
node scripts/i18n/clefs.js en --traductions .tmp/i18n-en.json
# 4. les preuves
#    - clefs de fr.js AVANT/APRÈS : comm -23 doit être VIDE
#    - jest src/theme/strings (enClefsIdentiques, frClefsAtteignables, frAccents)
#    - npm run i18n:no-regression, puis --baseline (RESSERRAGE : le cliquet descend, pas de GO requis)
# 5. supprimer docs/i18n/I18N-*.en.json (le texte vit désormais dans en.js)
# 6. recette : téléphone (ou émulateur) en anglais → les écrans des 4 lots
```

⚠️ **Les clefs ajoutées à `fr.js` par une autre session entre-temps** (VA1, correctifs…) rendent
`enClefsIdentiques` rouge : leur traduction manque dans `en.js`. C'est voulu — le témoin nomme les clefs.

---

## 5. Les 4 lots

| Lot | Périmètre | Lignes FR en dur | `'fr-FR'` | Fichiers |
|---|---|---:|---:|---:|
| **I18N-1** | Licences, abonnements, profil, inscription, clubs | 1 520 | 5 | 84 |
| **I18N-2** | Événements, matchs, compositions, entraînements, planning | 1 492 | 31 | 89 |
| **I18N-3** | LEAGUE et administration (SuperAdmin) | 1 483 | 19 | 83 |
| **I18N-4** | Équipes, recrutement, recherche, messagerie, accueil, notifications, socle transverse | 1 545 | 28 | 158 |
| **Total** | | **6 040** | **83** | **414** |

**Contrôlé** : aucun fichier dans deux lots (script de découpage : `fichier partagé` → erreur), aucun
fichier perdu, aucun jumeau `X.js` / `X.web.js` séparé.

**À savoir par lot** :
- **I18N-2** porte `src/views/event/EventDetails.js` (192 lignes de français en dur, 9 765 lignes de code) : le traiter en
  **plusieurs commits par bloc d'écran**, et le déclarer PARTIEL plutôt que bâclé.
- **I18N-3** porte `src/services/admin/adminService.js` : **fichier-carrefour (E4)**.
- **I18N-4** porte `src/navigation/private/PrivateNavigator.js` : **fichier-carrefour (E4)** ;
  `src/navigation/webRouteExemptions.js` (38 lignes) est une liste de **raisons techniques jamais
  affichées** → à **laisser**, et à dire ; `src/utils/dial_codes.js` = noms de pays → à traiter (le
  sélecteur d'indicatif est visible).

### I18N-1 — Licences, abonnements, profil, inscription, clubs : 1520 lignes, 5 `'fr-FR'`, 84 fichiers

<details><summary>La liste des fichiers</summary>

| Fichier | Lignes FR en dur | `'fr-FR'` |
|---|---:|---:|
| `src/components/molecules/clubCard/ClubCard.js` | 1 | 0 |
| `src/components/molecules/clubSelector/ClubSelector.js` | 1 | 0 |
| `src/components/molecules/legalFooter/LegalFooter.js` | 9 | 0 |
| `src/components/molecules/licenseeCountField/LicenseeCountField.js` | 4 | 0 |
| `src/components/molecules/parentalDeclarationCard/ParentalDeclarationCard.js` | 3 | 0 |
| `src/components/molecules/premiumBadge/PremiumBadge.js` | 1 | 0 |
| `src/components/molecules/selectAvatar/SelectAvatar.js` | 2 | 0 |
| `src/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet.js` | 23 | 0 |
| `src/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner.js` | 13 | 0 |
| `src/constants/parentalDeclaration.js` | 1 | 1 |
| `src/context/ClubScopeContext.js` | 1 | 0 |
| `src/domains/subscription/subscriptionBilling.js` | 34 | 1 |
| `src/domains/subscription/subscriptionDecision.js` | 116 | 0 |
| `src/domains/subscription/subscriptionPurchaseRail.js` | 7 | 0 |
| `src/domains/subscription/subscriptionRefresh.js` | 1 | 0 |
| `src/domains/subscription/subscriptionRevenueCat.js` | 6 | 0 |
| `src/domains/subscription/useSubscriptionCatalog.js` | 2 | 0 |
| `src/platform/auth/auth.web.js` | 2 | 0 |
| `src/services/auth/otpSendThrottle.js` | 1 | 0 |
| `src/services/club/clubService.js` | 2 | 0 |
| `src/services/clubInterestRequest/clubInterestRequestService.js` | 7 | 0 |
| `src/services/license/licenseService.js` | 3 | 0 |
| `src/services/profile/profileSaveConfirmation.js` | 8 | 0 |
| `src/utils/clubCertification.js` | 1 | 0 |
| `src/views/club/AddCoach.js` | 9 | 0 |
| `src/views/club/AddSponsor.js` | 10 | 0 |
| `src/views/club/AssignCoachTeams.js` | 19 | 0 |
| `src/views/club/ClubDetails.js` | 14 | 0 |
| `src/views/club/ClubEdit.js` | 16 | 0 |
| `src/views/club/ClubMembershipRequestList.js` | 3 | 0 |
| `src/views/club/RequestsDashboard.js` | 10 | 0 |
| `src/views/club/wizard/ClubWizardContext.js` | 1 | 0 |
| `src/views/guidance/GuideOffersRecap.js` | 35 | 0 |
| `src/views/historyWizard/HistoryWizardSingle.js` | 31 | 0 |
| `src/views/license/CMLicensesDashboard.js` | 27 | 1 |
| `src/views/license/ClubLicenseCampaignSettings.js` | 220 | 0 |
| `src/views/license/ClubLicenseMemberDetail.js` | 80 | 0 |
| `src/views/license/ClubLicensePayments.js` | 13 | 0 |
| `src/views/license/ClubLicenses.js` | 230 | 1 |
| `src/views/license/LicenseCheckoutStatus.js` | 13 | 0 |
| `src/views/license/MyLicenseDetail.js` | 87 | 0 |
| `src/views/license/MyLicenses.js` | 14 | 0 |
| `src/views/license/MyLicensesArchive.js` | 12 | 0 |
| `src/views/license/PublicLicensePayment.js` | 22 | 0 |
| `src/views/license/eventCampaignDefaults.js` | 4 | 0 |
| `src/views/license/licenseDesignSystem.js` | 20 | 1 |
| `src/views/license/memberLicenseModel.js` | 23 | 0 |
| `src/views/license/memberLicenseSheets.js` | 16 | 0 |
| `src/views/license/memberLicenseUi.js` | 1 | 0 |
| `src/views/multisportClub/CMDashboard.js` | 7 | 0 |
| `src/views/multisportClub/CMMembersScreen.js` | 2 | 0 |
| `src/views/multisportClub/CMTeamsScreen.js` | 2 | 0 |
| `src/views/multisportClub/FeaturedRequestsScreen.js` | 2 | 0 |
| `src/views/multisportClub/MultisportClubDetails.js` | 2 | 0 |
| `src/views/multisportClub/MultisportClubEditDetails.js` | 3 | 0 |
| `src/views/onboarding/UserAddress.js` | 5 | 0 |
| `src/views/onboarding/UserAffiliationGuide.js` | 4 | 0 |
| `src/views/onboarding/UserAvatar.js` | 6 | 0 |
| `src/views/onboarding/UserCategory.js` | 6 | 0 |
| `src/views/onboarding/UserClubSearch.js` | 8 | 0 |
| `src/views/onboarding/UserLevel.js` | 9 | 0 |
| `src/views/onboarding/UserName.js` | 5 | 0 |
| `src/views/onboarding/UserParentAccountRequired.js` | 5 | 0 |
| `src/views/onboarding/UserParentalDeclaration.js` | 6 | 0 |
| `src/views/onboarding/UserPhysique.js` | 5 | 0 |
| `src/views/onboarding/UserPosition.js` | 5 | 0 |
| `src/views/onboarding/UserRole.js` | 9 | 0 |
| `src/views/onboarding/UserSection.js` | 9 | 0 |
| `src/views/onboarding/UserSport.js` | 9 | 0 |
| `src/views/onboarding/UserSportHistory.js` | 4 | 0 |
| `src/views/onboarding/UserTrainedTeams.js` | 8 | 0 |
| `src/views/onboarding/Welcome.js` | 18 | 0 |
| `src/views/onboarding/components/OnboardingClubCard.js` | 1 | 0 |
| `src/views/profile/PlayerCardGallery.js` | 3 | 0 |
| `src/views/profile/Profile.js` | 7 | 0 |
| `src/views/profile/ProfileEdit.js` | 4 | 0 |
| `src/views/profile/ProfileEdit.web.js` | 5 | 0 |
| `src/views/profile/SubscriptionCompare.js` | 11 | 0 |
| `src/views/profile/SubscriptionCoveredHero.js` | 14 | 0 |
| `src/views/profile/SubscriptionOffers.js` | 76 | 0 |
| `src/views/profile/SubscriptionOverview.js` | 33 | 0 |
| `src/views/profile/UserDetails.js` | 14 | 0 |
| `src/views/subscription/SubscriptionSuccess.js` | 28 | 0 |
| `src/views/subscription/SubscriptionWebSuccess.js` | 6 | 0 |

</details>

### I18N-2 — Événements, matchs, compositions, entraînements, planning : 1492 lignes, 31 `'fr-FR'`, 89 fichiers

<details><summary>La liste des fichiers</summary>

| Fichier | Lignes FR en dur | `'fr-FR'` |
|---|---:|---:|
| `src/components/molecules/compositionMessageBubble/CompositionMessageBubble.js` | 7 | 0 |
| `src/components/molecules/dateTimeSelector/DateTimeSelector.js` | 1 | 2 |
| `src/components/molecules/eventCard/EventCardNew.js` | 13 | 0 |
| `src/components/molecules/eventShareBubble/EventShareBubble.js` | 4 | 0 |
| `src/components/molecules/friendlyMatchSlotEditor/FriendlyMatchSlotEditor.js` | 8 | 0 |
| `src/components/organisms/eventListContent/EventListContent.js` | 6 | 0 |
| `src/components/organisms/friendlyMatchListContent/FriendlyMatchFiltersSheet.js` | 4 | 0 |
| `src/components/organisms/friendlyMatchListContent/FriendlyMatchListContent.js` | 18 | 0 |
| `src/components/organisms/matchStats/MatchStatsPromptHost.js` | 23 | 1 |
| `src/components/organisms/planning/ClubFacilityPlanningContainer.js` | 1 | 0 |
| `src/components/organisms/planning/PlanningFullscreenButton.js` | 1 | 0 |
| `src/components/organisms/planningCalendarView/PlanningCalendarView.js` | 6 | 0 |
| `src/components/organisms/planningWeekTimelineView/PlanningWeekTimelineViewV2.js` | 6 | 0 |
| `src/components/organisms/pollCreationModal/PollCreationModal.js` | 1 | 0 |
| `src/components/organisms/positionSelectionList/PositionSelectionList.js` | 1 | 0 |
| `src/components/organisms/shareCompositionModal/ShareCompositionModal.js` | 1 | 0 |
| `src/components/organisms/teamSlotCreationForm/TeamSlotCreationForm.js` | 6 | 1 |
| `src/components/organisms/training/TrainingBlocks.js` | 1 | 0 |
| `src/components/organisms/training/TrainingSessionRow.js` | 0 | 1 |
| `src/components/organisms/trainingReview/TrainingReviewPromptHost.js` | 0 | 1 |
| `src/components/organisms/venueProposalModal/VenueProposalModal.js` | 40 | 4 |
| `src/constants/positions.js` | 25 | 0 |
| `src/domains/event/eventUseCases.js` | 3 | 0 |
| `src/domains/event/remindReport.js` | 9 | 0 |
| `src/domains/participation/participationFlow.js` | 27 | 0 |
| `src/domains/tactical/simulationRosters.js` | 4 | 0 |
| `src/services/friendlyMatch/friendlyMatchService.js` | 7 | 0 |
| `src/services/training/trainingLocalStore.js` | 1 | 0 |
| `src/utils/matchStatsEmptyReason.js` | 16 | 0 |
| `src/utils/planning/planningSlots.js` | 1 | 0 |
| `src/views/PollDetails.js` | 0 | 1 |
| `src/views/PollDetails.web.js` | 10 | 1 |
| `src/views/event/EventDetails.js` | 192 | 7 |
| `src/views/event/EventDetails.web.js` | 77 | 2 |
| `src/views/event/EventEdit.js` | 20 | 0 |
| `src/views/event/EventEdit.web.js` | 44 | 0 |
| `src/views/event/EventFilters.js` | 12 | 0 |
| `src/views/event/ParticipantEventList.js` | 18 | 0 |
| `src/views/event/TournamentManagement.js` | 37 | 0 |
| `src/views/event/TournamentMatchDetails.js` | 27 | 0 |
| `src/views/event/TournamentSettingsEdit.js` | 36 | 0 |
| `src/views/event/TournamentTeamDetails.js` | 65 | 0 |
| `src/views/event/attendance/attendanceCallModel.js` | 0 | 2 |
| `src/views/event/components/EventDetectionSlots.js` | 4 | 0 |
| `src/views/event/components/EventParticipants.js` | 8 | 0 |
| `src/views/event/components/EventReservationActions.js` | 1 | 0 |
| `src/views/event/components/EventTasksEditor.js` | 8 | 0 |
| `src/views/event/components/EventTasksSection.js` | 24 | 0 |
| `src/views/event/components/EventTeamAudiencesEditor.js` | 15 | 0 |
| `src/views/event/components/EventTeamAudiencesSection.js` | 6 | 0 |
| `src/views/event/hooks/useEventMutations.js` | 13 | 0 |
| `src/views/event/tournamentCompetitionComponents.js` | 10 | 0 |
| `src/views/event/tournamentUtils.js` | 7 | 0 |
| `src/views/event/wizard/EventWizardParticipants.js` | 5 | 0 |
| `src/views/event/wizard/EventWizardRecap.js` | 15 | 0 |
| `src/views/event/wizard/EventWizardStageProgram.js` | 23 | 0 |
| `src/views/event/wizard/EventWizardTeam.js` | 25 | 0 |
| `src/views/event/wizard/EventWizardTournamentSettings.js` | 17 | 0 |
| `src/views/event/wizard/EventWizardTournamentStructure.js` | 26 | 0 |
| `src/views/event/wizard/EventWizardType.js` | 9 | 0 |
| `src/views/friendlyMatch/FriendlyMatchAdDetails.js` | 41 | 0 |
| `src/views/friendlyMatch/components/FriendlyMatchApplicationCard.js` | 20 | 0 |
| `src/views/friendlyMatch/components/FriendlyMatchApplySheet.js` | 17 | 0 |
| `src/views/friendlyMatch/components/FriendlyMatchRepostSheet.js` | 4 | 0 |
| `src/views/friendlyMatch/components/FriendlyMatchTermsSheet.js` | 10 | 0 |
| `src/views/friendlyMatch/friendlyMatchDateLabels.js` | 3 | 0 |
| `src/views/friendlyMatch/friendlyProposalInChat.js` | 3 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardDates.js` | 2 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardDescription.js` | 6 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardHosting.js` | 6 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardLocation.js` | 9 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardOpponent.js` | 9 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardRecap.js` | 15 | 0 |
| `src/views/friendlyMatch/wizard/FriendlyMatchWizardTeam.js` | 5 | 0 |
| `src/views/friendlyMatch/wizard/friendlyMatchWizardSteps.js` | 7 | 0 |
| `src/views/matchCallUp/MatchConvocationPublished.js` | 0 | 1 |
| `src/views/matchCallUp/matchCompositionUtils.js` | 1 | 0 |
| `src/views/matchCallUp/matchFormationCatalog.js` | 11 | 0 |
| `src/views/matchStats/MatchStatsEditor.js` | 66 | 0 |
| `src/views/matchStats/PendingMatchStatsScreen.js` | 23 | 1 |
| `src/views/matchStats/PlayerMatchResponseScreen.js` | 69 | 0 |
| `src/views/planning/PersonalPlanningWeekFullscreen.js` | 8 | 0 |
| `src/views/tactical_v2/MultiTeamCompositionBoard.js` | 54 | 1 |
| `src/views/tactical_v2/TacticalBoard.js` | 72 | 1 |
| `src/views/tactical_v2/TacticalSelection.js` | 30 | 2 |
| `src/views/tactical_v2/multiTeamCompositionUtils.js` | 4 | 0 |
| `src/views/training/TrainingDay.js` | 0 | 1 |
| `src/views/training/TrainingProgramDetail.js` | 0 | 1 |
| `src/views/training/trainingParcours.js` | 2 | 0 |

</details>

### I18N-3 — LEAGUE et administration (SuperAdmin) : 1483 lignes, 19 `'fr-FR'`, 83 fichiers

<details><summary>La liste des fichiers</summary>

| Fichier | Lignes FR en dur | `'fr-FR'` |
|---|---:|---:|
| `src/app/LeaguePlatformGate.js` | 6 | 0 |
| `src/components/molecules/mercatoCard/MercatoCard.js` | 2 | 0 |
| `src/components/organisms/league/CompetitiveHero.js` | 2 | 0 |
| `src/components/organisms/league/LeagueActionPromptHost.js` | 54 | 1 |
| `src/components/organisms/league/LeagueLegalAcceptanceModal.js` | 22 | 0 |
| `src/components/organisms/league/MatchFinalPosterModal.js` | 17 | 0 |
| `src/components/organisms/league/MatchHistory.js` | 3 | 1 |
| `src/components/organisms/league/MatchRecapBanner.js` | 2 | 0 |
| `src/components/organisms/league/MatchRecapSheet.js` | 6 | 0 |
| `src/components/organisms/league/PlayerGoalsModal.js` | 5 | 0 |
| `src/components/organisms/league/SearchCountdown.js` | 1 | 0 |
| `src/constants/leagueLegalAcceptance.js` | 0 | 1 |
| `src/navigation/private/stacks/AdminStack.js` | 11 | 0 |
| `src/services/admin/adminClubContentModel.js` | 3 | 0 |
| `src/services/admin/adminClubContentService.js` | 1 | 0 |
| `src/services/admin/adminService.js` | 9 | 0 |
| `src/services/admin/adminWaitingPlayers.js` | 1 | 0 |
| `src/services/admin/superadminDisplaySchema.js` | 4 | 1 |
| `src/services/league/leagueMatchService.js` | 3 | 0 |
| `src/services/league/leaguePlatformService.js` | 9 | 0 |
| `src/services/leagueTeam/leagueTeamService.js` | 2 | 0 |
| `src/utils/leagueScoreDetails.js` | 4 | 0 |
| `src/utils/leagueSportConfig.js` | 1 | 0 |
| `src/views/admin/AdminClaimDetail.js` | 19 | 0 |
| `src/views/admin/AdminClaimList.js` | 14 | 0 |
| `src/views/admin/AdminClubDetail.js` | 31 | 1 |
| `src/views/admin/AdminClubForm.js` | 31 | 0 |
| `src/views/admin/AdminClubList.js` | 21 | 0 |
| `src/views/admin/AdminClubOnboardingList.js` | 9 | 0 |
| `src/views/admin/AdminDashboard.js` | 89 | 1 |
| `src/views/admin/AdminEvents.js` | 1 | 0 |
| `src/views/admin/AdminLeagueDisputes.js` | 13 | 0 |
| `src/views/admin/AdminNotificationsHealth.js` | 13 | 1 |
| `src/views/admin/AdminPopupCampaignDetail.js` | 12 | 0 |
| `src/views/admin/AdminPopupCampaignForm.js` | 28 | 0 |
| `src/views/admin/AdminPopupCampaignList.js` | 11 | 0 |
| `src/views/admin/AdminReports.js` | 7 | 1 |
| `src/views/admin/AdminRevenue.js` | 38 | 1 |
| `src/views/admin/AdminUserDetail.js` | 22 | 0 |
| `src/views/admin/AdminUserList.js` | 12 | 0 |
| `src/views/admin/FeaturedRequestsList.js` | 3 | 0 |
| `src/views/admin/SuperAdminContentExplorer.js` | 4 | 0 |
| `src/views/admin/SuperAdminEntryDetail.js` | 8 | 0 |
| `src/views/admin/SuperAdminEntryForm.js` | 9 | 0 |
| `src/views/admin/SuperAdminEntryList.js` | 5 | 0 |
| `src/views/admin/SuperAdminLeagueDashboard.js` | 18 | 0 |
| `src/views/admin/SuperAdminLeagueDisputes.js` | 18 | 0 |
| `src/views/admin/SuperAdminLeagueDivisions.js` | 7 | 0 |
| `src/views/admin/SuperAdminLeagueMatches.js` | 11 | 0 |
| `src/views/admin/SuperAdminLeagueSettings.js` | 23 | 0 |
| `src/views/admin/SuperAdminLeagueSquads.js` | 15 | 0 |
| `src/views/admin/SuperAdminLicensesDashboard.js` | 35 | 1 |
| `src/views/admin/clubWizard/AdminClubWizardActivities.js` | 7 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardAddress.js` | 7 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardBusiness.js` | 7 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardContact.js` | 3 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardIdentity.js` | 6 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardMultisport.js` | 6 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardRecap.js` | 17 | 0 |
| `src/views/admin/clubWizard/AdminClubWizardSponsors.js` | 6 | 0 |
| `src/views/admin/clubWizard/useAdminClubWizardExit.js` | 2 | 0 |
| `src/views/admin/components/SuperAdminLeagueLayout.js` | 1 | 0 |
| `src/views/league/ComingSoonLeagueScreen.js` | 5 | 0 |
| `src/views/league/dashboard/LeagueDashboard.js` | 75 | 1 |
| `src/views/league/details/SquadDetailsScreen.js` | 93 | 3 |
| `src/views/league/details/SquadRequestsScreen.js` | 10 | 0 |
| `src/views/league/edit/SquadEditScreen.js` | 22 | 0 |
| `src/views/league/match/EndMatchScreen.js` | 68 | 0 |
| `src/views/league/match/LeagueMatchDetails.js` | 193 | 3 |
| `src/views/league/match/MatchCenterScreen.js` | 123 | 1 |
| `src/views/league/match/MatchHistoryScreen.js` | 6 | 1 |
| `src/views/league/match/PastMatchDetails.js` | 20 | 0 |
| `src/views/league/match/components/NextMatchCard.js` | 25 | 0 |
| `src/views/league/match/hooks/useMatchmakingStateMachine.js` | 7 | 0 |
| `src/views/league/match/utils/leagueWorkflowPresenter.js` | 22 | 0 |
| `src/views/league/match/utils/matchStatus.js` | 4 | 0 |
| `src/views/league/match/utils/proposalPayload.js` | 1 | 0 |
| `src/views/league/match/utils/scoreFlow.js` | 7 | 0 |
| `src/views/league/ranking/RankingScreen.js` | 7 | 0 |
| `src/views/league/search/SquadFiltersScreen.js` | 5 | 0 |
| `src/views/league/search/SquadSearchScreen.js` | 22 | 0 |
| `src/views/league/standings/LeagueStandings.js` | 1 | 0 |
| `src/views/mercato/MercatoFilters.js` | 10 | 0 |

</details>

### I18N-4 — Équipes, recrutement, recherche, messagerie, accueil, notifications, socle transverse : 1545 lignes, 28 `'fr-FR'`, 158 fichiers

<details><summary>La liste des fichiers</summary>

| Fichier | Lignes FR en dur | `'fr-FR'` |
|---|---:|---:|
| `src/App.js` | 2 | 0 |
| `src/app/BootGate.js` | 1 | 0 |
| `src/app/queryRefreshOnReturn.js` | 1 | 0 |
| `src/components/atoms/errorWrapper/ErrorWrapper.js` | 1 | 0 |
| `src/components/atoms/searchMapFab/SearchMapFab.js` | 2 | 0 |
| `src/components/atoms/selectPicker/SelectPicker.js` | 1 | 0 |
| `src/components/atoms/stepper/Stepper.js` | 1 | 0 |
| `src/components/molecules/contactShareBubble/ContactShareBubble.js` | 2 | 0 |
| `src/components/molecules/datePickerInput/DatePickerInput.js` | 0 | 1 |
| `src/components/molecules/documentMessageBubble/DocumentMessageBubble.js` | 2 | 0 |
| `src/components/molecules/featuredReservationCard/FeaturedReservationCard.js` | 2 | 0 |
| `src/components/molecules/locationShareBubble/LocationShareBubble.js` | 2 | 0 |
| `src/components/molecules/proposalMessageBubble/ProposalMessageBubble.js` | 13 | 0 |
| `src/components/molecules/recruitmentAdCard/RecruitmentAdCard.js` | 8 | 0 |
| `src/components/molecules/requestFeedItem/RequestFeedItem.js` | 0 | 3 |
| `src/components/molecules/searchMapPreviewCard/SearchMapPreviewCard.js` | 2 | 0 |
| `src/components/molecules/searchTypeSwitcher/SearchTypeSwitcher.js` | 2 | 0 |
| `src/components/molecules/select/Select.js` | 1 | 0 |
| `src/components/molecules/timePickerInput/TimePickerInput.js` | 0 | 1 |
| `src/components/molecules/tour/TourBanner.js` | 10 | 0 |
| `src/components/molecules/voiceNoteBubble/VoiceNoteBubble.js` | 1 | 0 |
| `src/components/molecules/withDataWrapper/WithDataWrapper.js` | 1 | 0 |
| `src/components/organisms/bookingConfigModal/BookingConfigModal.js` | 8 | 0 |
| `src/components/organisms/clubListContent/ClubListContent.js` | 10 | 0 |
| `src/components/organisms/createAdModal/CreateAdModal.js` | 12 | 0 |
| `src/components/organisms/filtersSheet/ClubFiltersSheet.js` | 2 | 0 |
| `src/components/organisms/filtersSheet/EventFiltersSheet.js` | 2 | 0 |
| `src/components/organisms/filtersSheet/FiltersSheet.js` | 2 | 0 |
| `src/components/organisms/filtersSheet/ProfileFiltersSheet.js` | 6 | 0 |
| `src/components/organisms/filtersSheet/ReservationFiltersSheet.js` | 2 | 0 |
| `src/components/organisms/notificationPopup/NotificationPopup.js` | 8 | 0 |
| `src/components/organisms/notifications/NotificationBootstrap.js` | 4 | 0 |
| `src/components/organisms/notifications/SmartNotificationHost.js` | 9 | 0 |
| `src/components/organisms/playerCard/PlayerCard.js` | 8 | 0 |
| `src/components/organisms/playerCard/TeamCard.js` | 3 | 0 |
| `src/components/organisms/recruitmentFiltersSheet/RecruitmentFiltersSheet.js` | 6 | 0 |
| `src/components/organisms/recruitmentProfilesList/RecruitmentProfilesList.js` | 12 | 0 |
| `src/components/organisms/recrutementListContent/RecrutementListContent.js` | 34 | 0 |
| `src/components/organisms/reservationListContent/ReservationListContent.js` | 5 | 0 |
| `src/components/organisms/reservationModeModal/ReservationModeModal.js` | 6 | 0 |
| `src/components/organisms/searchMap/LegacySearchMapNative.js` | 8 | 0 |
| `src/components/organisms/searchMap/SearchMap.web.js` | 1 | 0 |
| `src/components/organisms/searchMap/SearchMapHud.js` | 6 | 0 |
| `src/components/organisms/searchMap/TomTomSearchMapNative.js` | 4 | 0 |
| `src/components/organisms/teamListContent/TeamListContent.js` | 11 | 0 |
| `src/domains/messaging/messagingUseCases.js` | 5 | 5 |
| `src/domains/playerCard/teamCardModel.js` | 5 | 0 |
| `src/domains/refresh/afterAction.js` | 1 | 0 |
| `src/domains/requests/requestMappers.js` | 29 | 0 |
| `src/domains/search/friendlyMatchFlow.js` | 8 | 0 |
| `src/domains/search/myActivitiesFeed.js` | 16 | 0 |
| `src/domains/team/teamCreationGate.js` | 9 | 0 |
| `src/domains/team/teamInvitation.js` | 9 | 0 |
| `src/domains/tour/tourCatalog.js` | 70 | 0 |
| `src/domains/visuals/eventShowcaseTemplate.js` | 6 | 0 |
| `src/domains/visuals/useEventShowcase.js` | 46 | 0 |
| `src/hooks/useAudioPlayback.js` | 1 | 0 |
| `src/hooks/useNotifications.js` | 4 | 0 |
| `src/navigation/private/PrivateNavigator.js` | 12 | 0 |
| `src/navigation/private/stacks/ClubStack.js` | 4 | 0 |
| `src/navigation/private/stacks/ProfileStack.js` | 1 | 0 |
| `src/navigation/private/stacks/TeamStack.js` | 1 | 0 |
| `src/navigation/webNavigationGuard.js` | 3 | 0 |
| `src/navigation/webRouteExemptions.js` | 38 | 0 |
| `src/platform/maps/maps.web.js` | 3 | 0 |
| `src/platform/maps/searchMapCopy.js` | 24 | 0 |
| `src/platform/maps/searchMapGeolocationSource.native.js` | 3 | 0 |
| `src/platform/maps/searchMapRuntime.js` | 1 | 0 |
| `src/platform/maps/vendor/leafletCssSource.js` | 1 | 0 |
| `src/platform/maps/vendor/leafletJsSource.js` | 1 | 0 |
| `src/platform/media/downloadRemoteFile.native.js` | 3 | 0 |
| `src/platform/media/downloadRemoteFile.web.js` | 1 | 0 |
| `src/platform/media/media.native.js` | 1 | 0 |
| `src/platform/media/media.web.js` | 4 | 0 |
| `src/platform/notifications/notifications.web.js` | 15 | 0 |
| `src/platform/share/share.web.js` | 1 | 0 |
| `src/platform/visualRender/visualRender.web.js` | 1 | 0 |
| `src/services/bootRequestGuard.js` | 4 | 0 |
| `src/services/category/categoryService.js` | 1 | 0 |
| `src/services/celebrations/celebrationCatalog.js` | 60 | 0 |
| `src/services/chat/voiceNoteService.js` | 2 | 0 |
| `src/services/facility/facilityService.js` | 2 | 0 |
| `src/services/notificationActions/rsvpActions.js` | 12 | 0 |
| `src/services/notificationBackgroundHandler.js` | 3 | 0 |
| `src/services/recruitment/recruitmentService.js` | 1 | 0 |
| `src/services/requests/clubAffiliationOutcome.js` | 10 | 0 |
| `src/services/requests/clubAffiliationRefusal.js` | 5 | 0 |
| `src/services/requests/requestAcceptanceCelebration.js` | 8 | 0 |
| `src/services/reservation/reservationService.js` | 1 | 0 |
| `src/services/search/searchService.js` | 10 | 0 |
| `src/services/teamMembershipRequest/teamMembershipRequestService.js` | 3 | 0 |
| `src/utils/dial_codes.js` | 4 | 0 |
| `src/utils/documentAttachment.js` | 1 | 0 |
| `src/utils/facilityAddressLabel.js` | 1 | 0 |
| `src/utils/location.js` | 1 | 0 |
| `src/utils/notifications/notificationPresentation.js` | 6 | 1 |
| `src/utils/searchMap.js` | 15 | 0 |
| `src/views/Conversation.js` | 115 | 5 |
| `src/views/Conversation.web.js` | 63 | 1 |
| `src/views/Home.js` | 4 | 0 |
| `src/views/Messaging.js` | 3 | 0 |
| `src/views/NewConversation.js` | 2 | 0 |
| `src/views/booking/BookingCalendar.js` | 6 | 0 |
| `src/views/booking/BookingCalendar.web.js` | 29 | 0 |
| `src/views/chat/ConversationPublicEventPicker.js` | 3 | 0 |
| `src/views/chat/ConversationPublicEventPicker.web.js` | 11 | 1 |
| `src/views/facility/FacilityForm.js` | 20 | 0 |
| `src/views/facility/FacilityList.js` | 5 | 0 |
| `src/views/home/HomeHub.js` | 42 | 0 |
| `src/views/home/useHomeEventAnswer.js` | 1 | 0 |
| `src/views/notification/NotificationList.js` | 12 | 0 |
| `src/views/recruitment/RecruitmentAdDetails.js` | 54 | 1 |
| `src/views/recruitment/RecruitmentAdEdit.js` | 40 | 0 |
| `src/views/recruitment/wizard/AdWizardAudienceType.js` | 7 | 0 |
| `src/views/recruitment/wizard/AdWizardCoachProfile.js` | 22 | 0 |
| `src/views/recruitment/wizard/AdWizardDescription.js` | 25 | 0 |
| `src/views/recruitment/wizard/AdWizardInfo.js` | 21 | 0 |
| `src/views/recruitment/wizard/AdWizardLocation.js` | 4 | 0 |
| `src/views/recruitment/wizard/AdWizardPositions.js` | 15 | 0 |
| `src/views/recruitment/wizard/AdWizardRecap.js` | 53 | 0 |
| `src/views/recruitment/wizard/AdWizardTeam.js` | 6 | 0 |
| `src/views/recruitment/wizard/AdWizardValidation.js` | 13 | 0 |
| `src/views/reservation/MissingPlayersView.js` | 1 | 0 |
| `src/views/reservation/MissingPlayersView.web.js` | 13 | 1 |
| `src/views/search/MyActivitiesScreen.js` | 9 | 0 |
| `src/views/search/SearchAlerts.js` | 10 | 0 |
| `src/views/search/SearchClubsScreen.js` | 5 | 0 |
| `src/views/search/SearchEventsScreen.js` | 13 | 0 |
| `src/views/search/SearchHubScreen.js` | 3 | 0 |
| `src/views/search/SearchMapScreen.js` | 10 | 0 |
| `src/views/search/SearchRecruitmentScreen.js` | 6 | 0 |
| `src/views/search/SearchReservationsScreen.js` | 6 | 0 |
| `src/views/team/MyTeamList.js` | 2 | 0 |
| `src/views/team/TeamDetails.js` | 65 | 8 |
| `src/views/team/TeamEdit.js` | 9 | 0 |
| `src/views/team/TeamList.js` | 4 | 0 |
| `src/views/team/TeamMembershipRequestList.js` | 2 | 0 |
| `src/views/team/TeamStatsScreen.js` | 8 | 0 |
| `src/views/team/createSquad/CreateSquadWizard.js` | 14 | 0 |
| `src/views/team/createSquad/steps/SquadAvailabilitiesStep.js` | 4 | 0 |
| `src/views/team/createSquad/steps/SquadCategoryStep.js` | 2 | 0 |
| `src/views/team/createSquad/steps/SquadImageStep.js` | 4 | 0 |
| `src/views/team/createSquad/steps/SquadLevelStep.js` | 6 | 0 |
| `src/views/team/createSquad/steps/SquadLocationStep.js` | 4 | 0 |
| `src/views/team/createSquad/steps/SquadNameStep.js` | 5 | 0 |
| `src/views/team/createSquad/steps/SquadSectionStep.js` | 3 | 0 |
| `src/views/team/createSquad/steps/SquadSourceTeamStep.js` | 4 | 0 |
| `src/views/team/createSquad/steps/SquadSportStep.js` | 3 | 0 |
| `src/views/team/createSquad/steps/SquadSummaryStep.js` | 9 | 0 |
| `src/views/team/wizard/TeamWizardActivity.js` | 6 | 0 |
| `src/views/team/wizard/TeamWizardCategory.js` | 4 | 0 |
| `src/views/team/wizard/TeamWizardContext.js` | 1 | 0 |
| `src/views/team/wizard/TeamWizardEmptyReferential.js` | 3 | 0 |
| `src/views/team/wizard/TeamWizardLevel.js` | 4 | 0 |
| `src/views/team/wizard/TeamWizardName.js` | 10 | 0 |
| `src/views/team/wizard/TeamWizardRecap.js` | 6 | 0 |
| `src/views/team/wizard/TeamWizardSection.js` | 5 | 0 |
| `src/views/team/wizard/TeamWizardTrainers.js` | 5 | 0 |

</details>

---

## 6. Les 4 prompts — à coller tels quels, une session chacun

> Réglage : `claude-opus-5` · effort `high` · sans ultracode — travail mécanique mais long, sur beaucoup de
> fichiers. Les 4 peuvent tourner **en même temps** : aucun fichier partagé, aucun geste à jeton unique.
> ⚠️ **Prérequis** : `feat/I18N0-socle-anglais` récoltée (sinon chaque lot part de cette branche, et la
> récolte des 4 en dépend).

### I18N-1 — licences, abonnements, profil, inscription, clubs

```
Lis D:/App/fc/CLAUDE.md et D:/App/fc/VERROU.md avant d'agir, puis docs/I18N_DECOUPAGE.md (dans ta copie).

TU ES PROPRIETAIRE DE : app — sujet I18N-1 : l'anglais des ecrans licences, abonnements, profil, inscription, clubs. Tu traites les fichiers de TA
liste (docs/I18N_DECOUPAGE.md, section 5, lot I18N-1) et AUCUN autre. Tu ne touches ni admin ni web.
TA COPIE DE TRAVAIL : D:/App/fc/.worktrees/I18N1-app (branche feat/I18N1-licences-abonnements), creee depuis origin/staging SI
feat/I18N0-socle-anglais y est fusionnee (git merge-base --is-ancestor origin/feat/I18N0-socle-anglais origin/staging),
sinon depuis origin/feat/I18N0-socle-anglais. Jonction node_modules, jamais npm install, jest via PowerShell
(.\node_modules\.bin\jest.cmd), jamais jest -u. Jamais D:/App/fc/app.
NE PAS ECRIRE dans RELAIS.md : c'est la session chef d'orchestre qui le tient.
fr.js ET en.js : TU N'Y ECRIS PAS. Trois autres lots I18N tournent en parallele et ce sont les seuls fichiers que vous
partageriez. Ton francais va en REPLI dans t(), ton anglais dans TON fichier docs/i18n/I18N-1.en.json.

LE FAIT (mesure le 14/09, a re-mesurer) : ta liste = 84 fichiers, 1 520 lignes de francais en dur hors t(),
5 'fr-FR' ecrits en dur. Sur tout l'app : replisIgnores=157, ajoutables=0 (node scripts/i18n/clefs.js replis).
Ta liste porte le plus gros fichier du projet en francais en dur : src/views/license/ClubLicenses.js
(230 lignes) et ClubLicenseCampaignSettings.js (220). Un commit par bloc d'ecran, PARTIEL assume.

CE QUE TU FAIS :
1. Re-mesure d'abord et colle les chiffres : node scripts/i18n/francais-en-dur.js --rapport .tmp/avant.json (filtre
   sur ta liste) ; node scripts/i18n/clefs.js replis. Si ta liste a bouge depuis le 14/09, tu re-mesures, tu ne
   changes pas de liste.
2. Fichier par fichier, DANS L'ORDRE de la liste, un commit par fichier (ou par dossier de petits fichiers) :
   - chaque texte AFFICHE devient t('<ecran>.<clef>', '<texte francais IDENTIQUE au caractere pres>') ; l'espace de
     noms est celui de l'ecran (camelCase du nom du fichier), jamais common.* ; une clef = un texte ;
   - interpolation t('x.y', 'Bonjour {{prenom}}', { prenom }) ; pluriel t('x.y', { count, defaultValue_one: '…',
     defaultValue_other: '…' }) ; jamais de concatenation ;
   - hors composant : import i18next from 'i18next' ; i18next.t(...). JAMAIS import de '@/theme/strings' ;
   - chaque 'fr-FR' -> localeDesFormats() (import localeDesFormats from '@/theme/strings/localeDesFormats') ;
   - un texte jamais affiche (journal, identifiant, raison technique) : tu le laisses et tu le listes ;
   - docs/i18n/I18N-1.en.json : { "clef": "English" } (pluriels : clef_one / clef_other), memes {{jetons}}, tu -> you,
     le lexique deja pose dans en.js (club manager, call-up, line-up, trial, squad, fee, pitch...).
   Tu ne reorganises rien, tu ne simplifies rien : le seul changement est d'ou vient le texte (docs §3, E6).
3. Portes a chaque commit, les trois a code 0 :
   node scripts/i18n/extraction-fidele.js --depuis <commit de depart du lot>   (tout texte « disparu » est corrige,
     ou justifie ligne a ligne ; jamais --depuis origin/staging si staging a avance : faux positifs)
   node scripts/i18n/clefs.js replis --controle --traductions docs/i18n/I18N-1.en.json   (ET replisIgnores reste 157)
   npm run i18n:no-regression               (tu ne peux que baisser ; tu ne relances JAMAIS --baseline)
   + jest des temoins de l'ecran touche. Un temoin qui double t en rendant la CLEF rougit : fais-le lire fr.js puis le
   repli (motif Profile.menuProfil.test.js), sans changer ce qu'il affirme.
4. Fin de lot : portes app completes — theme, type-check:no-regression, lint:no-regression (rm .eslintcache), jest
   complet, diff des TITRES en echec contre la base (les 13 snapshots TeamShield sont normaux en worktree) ; lint des
   lignes ajoutees = 0/0. Recette : aucune (le pliage se fait a la recolte, docs §4) — dis-le. Commits par chemins
   explicites, push avec upstream, pas de fusion.

EN FINISSANT, tu t'adresses au CHEF D'ORCHESTRE, pas a Adel. Ton compte rendu contient le tableau « une ligne par
fichier de ta liste : FAIT / PARTIEL / PAS FAIT — lignes avant -> apres — ce qui reste, nomme » (§2 quinquies, jamais
un verdict global) et TOUJOURS le bloc « CE QUE JE N'AI PAS PU TRANCHER » — meme vide. Tu ne t'ARRETES JAMAIS a
attendre une reponse. Mieux vaut 40 fichiers finis que 84 a moitie.
FINI QUAND : extraction-fidele, replis --controle et i18n:no-regression passent, et chaque ligne de francais en dur
restante de ta liste est nommee avec sa raison.
```

### I18N-2 — evenements, matchs, compositions, entrainements, planning

```
Lis D:/App/fc/CLAUDE.md et D:/App/fc/VERROU.md avant d'agir, puis docs/I18N_DECOUPAGE.md (dans ta copie).

TU ES PROPRIETAIRE DE : app — sujet I18N-2 : l'anglais des ecrans evenements, matchs, compositions, entrainements, planning. Tu traites les fichiers de TA
liste (docs/I18N_DECOUPAGE.md, section 5, lot I18N-2) et AUCUN autre. Tu ne touches ni admin ni web.
TA COPIE DE TRAVAIL : D:/App/fc/.worktrees/I18N2-app (branche feat/I18N2-evenements-matchs), creee depuis origin/staging SI
feat/I18N0-socle-anglais y est fusionnee (git merge-base --is-ancestor origin/feat/I18N0-socle-anglais origin/staging),
sinon depuis origin/feat/I18N0-socle-anglais. Jonction node_modules, jamais npm install, jest via PowerShell
(.\node_modules\.bin\jest.cmd), jamais jest -u. Jamais D:/App/fc/app.
NE PAS ECRIRE dans RELAIS.md : c'est la session chef d'orchestre qui le tient.
fr.js ET en.js : TU N'Y ECRIS PAS. Trois autres lots I18N tournent en parallele et ce sont les seuls fichiers que vous
partageriez. Ton francais va en REPLI dans t(), ton anglais dans TON fichier docs/i18n/I18N-2.en.json.

LE FAIT (mesure le 14/09, a re-mesurer) : ta liste = 89 fichiers, 1 492 lignes de francais en dur hors t(),
31 'fr-FR' ecrits en dur. Sur tout l'app : replisIgnores=157, ajoutables=0 (node scripts/i18n/clefs.js replis).
Ta liste porte src/views/event/EventDetails.js (192 lignes de francais, 9 765 lignes de code) : un commit par
bloc d'ecran, et PARTIEL dit franchement plutot que bacle. 31 'fr-FR' : c'est le lot qui en a le plus.

CE QUE TU FAIS :
1. Re-mesure d'abord et colle les chiffres : node scripts/i18n/francais-en-dur.js --rapport .tmp/avant.json (filtre
   sur ta liste) ; node scripts/i18n/clefs.js replis. Si ta liste a bouge depuis le 14/09, tu re-mesures, tu ne
   changes pas de liste.
2. Fichier par fichier, DANS L'ORDRE de la liste, un commit par fichier (ou par dossier de petits fichiers) :
   - chaque texte AFFICHE devient t('<ecran>.<clef>', '<texte francais IDENTIQUE au caractere pres>') ; l'espace de
     noms est celui de l'ecran (camelCase du nom du fichier), jamais common.* ; une clef = un texte ;
   - interpolation t('x.y', 'Bonjour {{prenom}}', { prenom }) ; pluriel t('x.y', { count, defaultValue_one: '…',
     defaultValue_other: '…' }) ; jamais de concatenation ;
   - hors composant : import i18next from 'i18next' ; i18next.t(...). JAMAIS import de '@/theme/strings' ;
   - chaque 'fr-FR' -> localeDesFormats() (import localeDesFormats from '@/theme/strings/localeDesFormats') ;
   - un texte jamais affiche (journal, identifiant, raison technique) : tu le laisses et tu le listes ;
   - docs/i18n/I18N-2.en.json : { "clef": "English" } (pluriels : clef_one / clef_other), memes {{jetons}}, tu -> you,
     le lexique deja pose dans en.js (club manager, call-up, line-up, trial, squad, fee, pitch...).
   Tu ne reorganises rien, tu ne simplifies rien : le seul changement est d'ou vient le texte (docs §3, E6).
3. Portes a chaque commit, les trois a code 0 :
   node scripts/i18n/extraction-fidele.js --depuis <commit de depart du lot>   (tout texte « disparu » est corrige,
     ou justifie ligne a ligne ; jamais --depuis origin/staging si staging a avance : faux positifs)
   node scripts/i18n/clefs.js replis --controle --traductions docs/i18n/I18N-2.en.json   (ET replisIgnores reste 157)
   npm run i18n:no-regression               (tu ne peux que baisser ; tu ne relances JAMAIS --baseline)
   + jest des temoins de l'ecran touche. Un temoin qui double t en rendant la CLEF rougit : fais-le lire fr.js puis le
   repli (motif Profile.menuProfil.test.js), sans changer ce qu'il affirme.
4. Fin de lot : portes app completes — theme, type-check:no-regression, lint:no-regression (rm .eslintcache), jest
   complet, diff des TITRES en echec contre la base (les 13 snapshots TeamShield sont normaux en worktree) ; lint des
   lignes ajoutees = 0/0. Recette : aucune (le pliage se fait a la recolte, docs §4) — dis-le. Commits par chemins
   explicites, push avec upstream, pas de fusion.

EN FINISSANT, tu t'adresses au CHEF D'ORCHESTRE, pas a Adel. Ton compte rendu contient le tableau « une ligne par
fichier de ta liste : FAIT / PARTIEL / PAS FAIT — lignes avant -> apres — ce qui reste, nomme » (§2 quinquies, jamais
un verdict global) et TOUJOURS le bloc « CE QUE JE N'AI PAS PU TRANCHER » — meme vide. Tu ne t'ARRETES JAMAIS a
attendre une reponse. Mieux vaut 40 fichiers finis que 89 a moitie.
FINI QUAND : extraction-fidele, replis --controle et i18n:no-regression passent, et chaque ligne de francais en dur
restante de ta liste est nommee avec sa raison.
```

### I18N-3 — LEAGUE et administration (SuperAdmin)

```
Lis D:/App/fc/CLAUDE.md et D:/App/fc/VERROU.md avant d'agir, puis docs/I18N_DECOUPAGE.md (dans ta copie).

TU ES PROPRIETAIRE DE : app — sujet I18N-3 : l'anglais des ecrans LEAGUE et administration (SuperAdmin). Tu traites les fichiers de TA
liste (docs/I18N_DECOUPAGE.md, section 5, lot I18N-3) et AUCUN autre. Tu ne touches ni admin ni web.
TA COPIE DE TRAVAIL : D:/App/fc/.worktrees/I18N3-app (branche feat/I18N3-league-admin), creee depuis origin/staging SI
feat/I18N0-socle-anglais y est fusionnee (git merge-base --is-ancestor origin/feat/I18N0-socle-anglais origin/staging),
sinon depuis origin/feat/I18N0-socle-anglais. Jonction node_modules, jamais npm install, jest via PowerShell
(.\node_modules\.bin\jest.cmd), jamais jest -u. Jamais D:/App/fc/app.
NE PAS ECRIRE dans RELAIS.md : c'est la session chef d'orchestre qui le tient.
fr.js ET en.js : TU N'Y ECRIS PAS. Trois autres lots I18N tournent en parallele et ce sont les seuls fichiers que vous
partageriez. Ton francais va en REPLI dans t(), ton anglais dans TON fichier docs/i18n/I18N-3.en.json.

LE FAIT (mesure le 14/09, a re-mesurer) : ta liste = 83 fichiers, 1 483 lignes de francais en dur hors t(),
19 'fr-FR' ecrits en dur. Sur tout l'app : replisIgnores=157, ajoutables=0 (node scripts/i18n/clefs.js replis).
src/services/admin/adminService.js est un FICHIER-CARREFOUR (E4) : 5 decisions numerotees avant d'y toucher.
Les ecrans SuperAdmin ne sont vus que par l'equipe : traite-les APRES les ecrans LEAGUE, qui sont publics.

CE QUE TU FAIS :
1. Re-mesure d'abord et colle les chiffres : node scripts/i18n/francais-en-dur.js --rapport .tmp/avant.json (filtre
   sur ta liste) ; node scripts/i18n/clefs.js replis. Si ta liste a bouge depuis le 14/09, tu re-mesures, tu ne
   changes pas de liste.
2. Fichier par fichier, DANS L'ORDRE de la liste, un commit par fichier (ou par dossier de petits fichiers) :
   - chaque texte AFFICHE devient t('<ecran>.<clef>', '<texte francais IDENTIQUE au caractere pres>') ; l'espace de
     noms est celui de l'ecran (camelCase du nom du fichier), jamais common.* ; une clef = un texte ;
   - interpolation t('x.y', 'Bonjour {{prenom}}', { prenom }) ; pluriel t('x.y', { count, defaultValue_one: '…',
     defaultValue_other: '…' }) ; jamais de concatenation ;
   - hors composant : import i18next from 'i18next' ; i18next.t(...). JAMAIS import de '@/theme/strings' ;
   - chaque 'fr-FR' -> localeDesFormats() (import localeDesFormats from '@/theme/strings/localeDesFormats') ;
   - un texte jamais affiche (journal, identifiant, raison technique) : tu le laisses et tu le listes ;
   - docs/i18n/I18N-3.en.json : { "clef": "English" } (pluriels : clef_one / clef_other), memes {{jetons}}, tu -> you,
     le lexique deja pose dans en.js (club manager, call-up, line-up, trial, squad, fee, pitch...).
   Tu ne reorganises rien, tu ne simplifies rien : le seul changement est d'ou vient le texte (docs §3, E6).
3. Portes a chaque commit, les trois a code 0 :
   node scripts/i18n/extraction-fidele.js --depuis <commit de depart du lot>   (tout texte « disparu » est corrige,
     ou justifie ligne a ligne ; jamais --depuis origin/staging si staging a avance : faux positifs)
   node scripts/i18n/clefs.js replis --controle --traductions docs/i18n/I18N-3.en.json   (ET replisIgnores reste 157)
   npm run i18n:no-regression               (tu ne peux que baisser ; tu ne relances JAMAIS --baseline)
   + jest des temoins de l'ecran touche. Un temoin qui double t en rendant la CLEF rougit : fais-le lire fr.js puis le
   repli (motif Profile.menuProfil.test.js), sans changer ce qu'il affirme.
4. Fin de lot : portes app completes — theme, type-check:no-regression, lint:no-regression (rm .eslintcache), jest
   complet, diff des TITRES en echec contre la base (les 13 snapshots TeamShield sont normaux en worktree) ; lint des
   lignes ajoutees = 0/0. Recette : aucune (le pliage se fait a la recolte, docs §4) — dis-le. Commits par chemins
   explicites, push avec upstream, pas de fusion.

EN FINISSANT, tu t'adresses au CHEF D'ORCHESTRE, pas a Adel. Ton compte rendu contient le tableau « une ligne par
fichier de ta liste : FAIT / PARTIEL / PAS FAIT — lignes avant -> apres — ce qui reste, nomme » (§2 quinquies, jamais
un verdict global) et TOUJOURS le bloc « CE QUE JE N'AI PAS PU TRANCHER » — meme vide. Tu ne t'ARRETES JAMAIS a
attendre une reponse. Mieux vaut 40 fichiers finis que 83 a moitie.
FINI QUAND : extraction-fidele, replis --controle et i18n:no-regression passent, et chaque ligne de francais en dur
restante de ta liste est nommee avec sa raison.
```

### I18N-4 — equipes, recrutement, recherche, messagerie, accueil, notifications, socle transverse

```
Lis D:/App/fc/CLAUDE.md et D:/App/fc/VERROU.md avant d'agir, puis docs/I18N_DECOUPAGE.md (dans ta copie).

TU ES PROPRIETAIRE DE : app — sujet I18N-4 : l'anglais des ecrans equipes, recrutement, recherche, messagerie, accueil, notifications, socle transverse. Tu traites les fichiers de TA
liste (docs/I18N_DECOUPAGE.md, section 5, lot I18N-4) et AUCUN autre. Tu ne touches ni admin ni web.
TA COPIE DE TRAVAIL : D:/App/fc/.worktrees/I18N4-app (branche feat/I18N4-equipes-messagerie), creee depuis origin/staging SI
feat/I18N0-socle-anglais y est fusionnee (git merge-base --is-ancestor origin/feat/I18N0-socle-anglais origin/staging),
sinon depuis origin/feat/I18N0-socle-anglais. Jonction node_modules, jamais npm install, jest via PowerShell
(.\node_modules\.bin\jest.cmd), jamais jest -u. Jamais D:/App/fc/app.
NE PAS ECRIRE dans RELAIS.md : c'est la session chef d'orchestre qui le tient.
fr.js ET en.js : TU N'Y ECRIS PAS. Trois autres lots I18N tournent en parallele et ce sont les seuls fichiers que vous
partageriez. Ton francais va en REPLI dans t(), ton anglais dans TON fichier docs/i18n/I18N-4.en.json.

LE FAIT (mesure le 14/09, a re-mesurer) : ta liste = 158 fichiers, 1 545 lignes de francais en dur hors t(),
28 'fr-FR' ecrits en dur. Sur tout l'app : replisIgnores=157, ajoutables=0 (node scripts/i18n/clefs.js replis).
src/navigation/private/PrivateNavigator.js est un FICHIER-CARREFOUR (E4) : 5 decisions numerotees avant.
src/navigation/webRouteExemptions.js (38 lignes) = raisons techniques jamais affichees : tu le LAISSES et tu le dis.
Ta liste est la plus longue en fichiers (158, beaucoup a 1-5 lignes) : commits groupes par dossier.

CE QUE TU FAIS :
1. Re-mesure d'abord et colle les chiffres : node scripts/i18n/francais-en-dur.js --rapport .tmp/avant.json (filtre
   sur ta liste) ; node scripts/i18n/clefs.js replis. Si ta liste a bouge depuis le 14/09, tu re-mesures, tu ne
   changes pas de liste.
2. Fichier par fichier, DANS L'ORDRE de la liste, un commit par fichier (ou par dossier de petits fichiers) :
   - chaque texte AFFICHE devient t('<ecran>.<clef>', '<texte francais IDENTIQUE au caractere pres>') ; l'espace de
     noms est celui de l'ecran (camelCase du nom du fichier), jamais common.* ; une clef = un texte ;
   - interpolation t('x.y', 'Bonjour {{prenom}}', { prenom }) ; pluriel t('x.y', { count, defaultValue_one: '…',
     defaultValue_other: '…' }) ; jamais de concatenation ;
   - hors composant : import i18next from 'i18next' ; i18next.t(...). JAMAIS import de '@/theme/strings' ;
   - chaque 'fr-FR' -> localeDesFormats() (import localeDesFormats from '@/theme/strings/localeDesFormats') ;
   - un texte jamais affiche (journal, identifiant, raison technique) : tu le laisses et tu le listes ;
   - docs/i18n/I18N-4.en.json : { "clef": "English" } (pluriels : clef_one / clef_other), memes {{jetons}}, tu -> you,
     le lexique deja pose dans en.js (club manager, call-up, line-up, trial, squad, fee, pitch...).
   Tu ne reorganises rien, tu ne simplifies rien : le seul changement est d'ou vient le texte (docs §3, E6).
3. Portes a chaque commit, les trois a code 0 :
   node scripts/i18n/extraction-fidele.js --depuis <commit de depart du lot>   (tout texte « disparu » est corrige,
     ou justifie ligne a ligne ; jamais --depuis origin/staging si staging a avance : faux positifs)
   node scripts/i18n/clefs.js replis --controle --traductions docs/i18n/I18N-4.en.json   (ET replisIgnores reste 157)
   npm run i18n:no-regression               (tu ne peux que baisser ; tu ne relances JAMAIS --baseline)
   + jest des temoins de l'ecran touche. Un temoin qui double t en rendant la CLEF rougit : fais-le lire fr.js puis le
   repli (motif Profile.menuProfil.test.js), sans changer ce qu'il affirme.
4. Fin de lot : portes app completes — theme, type-check:no-regression, lint:no-regression (rm .eslintcache), jest
   complet, diff des TITRES en echec contre la base (les 13 snapshots TeamShield sont normaux en worktree) ; lint des
   lignes ajoutees = 0/0. Recette : aucune (le pliage se fait a la recolte, docs §4) — dis-le. Commits par chemins
   explicites, push avec upstream, pas de fusion.

EN FINISSANT, tu t'adresses au CHEF D'ORCHESTRE, pas a Adel. Ton compte rendu contient le tableau « une ligne par
fichier de ta liste : FAIT / PARTIEL / PAS FAIT — lignes avant -> apres — ce qui reste, nomme » (§2 quinquies, jamais
un verdict global) et TOUJOURS le bloc « CE QUE JE N'AI PAS PU TRANCHER » — meme vide. Tu ne t'ARRETES JAMAIS a
attendre une reponse. Mieux vaut 40 fichiers finis que 158 a moitie.
FINI QUAND : extraction-fidele, replis --controle et i18n:no-regression passent, et chaque ligne de francais en dur
restante de ta liste est nommee avec sa raison.
```

