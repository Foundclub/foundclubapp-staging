/**
 * Registre des noms de routes de l'application.
 *
 * NETTOYAGE DU 2026-07-19 — 7 noms morts supprimes (aucun ecran enregistre derriere,
 * aucun navigate(), aucun motif web) : `HighlightRequestsInbox`, `RequestsTab`, `Team`,
 * `TeamCard`, `HistoryWizardStack`, `LeagueStack`, `LeagueStandingsTab`.
 *
 * TODO(nav-orphelins) ECRANS ORPHELINS — composants d'ecran ecrits mais qu'AUCUNE route
 * n'expose. Les cabler ou les jeter est un arbitrage produit, pas une correction technique :
 * ils sont conserves tels quels et listes ici pour ne plus etre invisibles.
 *   (D40, 2026-08-08 : `HistoryWizardClubScreen.js` a quitte cette liste — supprime
 *   avec le tunnel en 5 pages, `grep` a 0 appelant dans `app` comme dans `web`.)
 *   - views/league/standings/LeagueStandings.js       (orphelin depuis la suppression de
 *     l'onglet classement — cf. `LeagueStandingsTab` retire ci-dessus)
 *   - views/profile/PlayerCardGallery.js
 *   - views/search/SearchClubsScreen.js               (les routes SearchClubs/SearchEvents/
 *   - views/search/SearchEventsScreen.js               SearchReservations/SearchRecruitment
 *   - views/search/SearchRecruitmentScreen.js          montent toutes SearchHubRouteAlias,
 *   - views/search/SearchReservationsScreen.js         jamais ces 4 ecrans dedies)
 *   - views/TestScreen.js                             (ecran de test, a supprimer ?)
 *
 * TODO(nav-sans-porte) ECRANS SANS PORTE D'ENTREE — enregistres dans un navigateur, donc
 * atteignables par URL/lien profond, mais aucun bouton de l'app n'y mene (aucun navigate()
 * ne les vise). A confirmer produit avant de cabler ou de retirer :
 *   `CMPlanning`, `FeaturedRequests`, `LeagueHome`, `MatchCenter`, `MatchDetails`,
 *   `MissingPlayersView`, `PersonalPlanningWeekFullscreen`, `PublicLicensePayment`,
 *   `RequestsDashboard`, `SubscriptionWebSuccess`, `TeamMembershipRequests`, `TeamStats`.
 * Les onglets-leurres `AuthStackAccount` / `AuthStackMessaging` / `AuthStackPlanning` sont
 * dans le meme cas mais c'est VOULU (cf. MOBILE_ONLY_SCREENS dans webRoutes.parity.test.js).
 *
 * TODO(nav-search-ambigu) `Search` designe DEUX ecrans selon l'etat de connexion :
 * PublicTabNavigator monte la vue visiteur, PrivateTabNavigator monte SearchStack. L'URL
 * /search est donc ambigue. Renommer touche aux liens profonds : arbitrage produit.
 */
export const RouteNames = /** @type {const} */ ({
  AddClubManager: 'AddClubManager',
  AddCoach: 'AddCoach',
  AddSponsor: 'AddSponsor',
  AdminClaimDetail: 'AdminClaimDetail',
  AdminClaimList: 'AdminClaimList',
  AdminClubDetail: 'AdminClubDetail',
  AdminClubForm: 'AdminClubForm',
  AdminClubList: 'AdminClubList',
  AdminClubOnboardingList: 'AdminClubOnboardingList',
  AdminClubWizardActivities: 'AdminClubWizardActivities',
  AdminClubWizardAddress: 'AdminClubWizardAddress',
  AdminClubWizardBusiness: 'AdminClubWizardBusiness',
  AdminClubWizardContact: 'AdminClubWizardContact',
  AdminClubWizardIdentity: 'AdminClubWizardIdentity',
  AdminClubWizardMultisport: 'AdminClubWizardMultisport',
  AdminClubWizardRecap: 'AdminClubWizardRecap',
  AdminClubWizardSponsors: 'AdminClubWizardSponsors',
  AdminDashboard: 'AdminDashboard',
  AdminEvents: 'AdminEvents',
  AdminLeagueDisputes: 'AdminLeagueDisputes',
  AdminNotificationsHealth: 'AdminNotificationsHealth',
  AdminPopupCampaignDetail: 'AdminPopupCampaignDetail',
  AdminPopupCampaignForm: 'AdminPopupCampaignForm',
  AdminPopupCampaignList: 'AdminPopupCampaignList',
  AdminReports: 'AdminReports',
  AdminRevenue: 'AdminRevenue',
  AdminUserDetail: 'AdminUserDetail',
  AdminUserList: 'AdminUserList',
  AssignCoachTeams: 'AssignCoachTeams',
  AuthStackAccount: 'AuthStackAccount',
  AuthStackMessaging: 'AuthStackMessaging',
  AuthStackPlanning: 'AuthStackPlanning',
  BookingCalendar: 'BookingCalendar',
  Chat: 'Chat',
  Club: 'Club',
  ClubEdit: 'ClubEditPage',
  ClubFilters: 'ClubFilters',
  ClubLicenseCampaignDetail: 'ClubLicenseCampaignDetail',
  ClubLicenseCampaignSettings: 'ClubLicenseCampaignSettings',
  ClubLicenseMemberDetail: 'ClubLicenseMemberDetail',
  ClubLicensePayments: 'ClubLicensePayments',
  ClubLicenses: 'ClubLicenses',
  ClubList: 'ClubList',
  ClubMembershipRequests: 'ClubMembershipRequests',
  ClubWizardActivities: 'ClubWizardActivities',
  ClubWizardAddress: 'ClubWizardAddress',
  ClubWizardContact: 'ClubWizardContact',
  ClubWizardName: 'ClubWizardName',
  ClubWizardRecap: 'ClubWizardRecap',
  CMDashboard: 'CMDashboard',
  CMLicensesDashboard: 'CMLicensesDashboard',
  CMMembers: 'CMMembers',
  CMPlanning: 'CMPlanning',
  CMTeams: 'CMTeams',
  Conversation: 'Conversation',
  ConversationPublicEventPicker: 'ConversationPublicEventPicker',
  CreateSection: 'CreateSection',
  CreateSquad: 'CreateSquad',
  EndMatchScreen: 'EndMatchScreen',
  // L5-A — « Faire l appel » (planche 02) : un ECRAN PLEIN, pas une feuille.
  // C est un MODE — deux cibles de 44 par ligne, la ligne elle-meme n est pas
  // cliquable — et un mode ne se pose pas par-dessus l ecran de detail.
  EventAttendanceCall: 'EventAttendanceCall',
  EventDetails: 'EventDetails',
  EventEdit: 'EventEdit',
  EventFilters: 'EventFilters',
  EventPublishedShowcase: 'EventPublishedShowcase',
  FacilityForm: 'FacilityForm',
  FacilityList: 'FacilityList',
  FeaturedRequests: 'FeaturedRequests',
  FeaturedRequestsList: 'FeaturedRequestsList',
  GuideOffersRecap: 'GuideOffersRecap',
  HomeTab: 'HomeTab',
  LicenseCheckoutStatus: 'LicenseCheckoutStatus',
  Login: 'Login',
  MatchCenter: 'MatchCenter',
  MatchHistoryScreen: 'MatchHistoryScreen',
  MatchStatsEditor: 'MatchStatsEditor',
  MercatoFilters: 'MercatoFilters',
  MissingPlayersView: 'MissingPlayersView',
  MultisportClubDetails: 'MultisportClubDetails',
  MultisportClubEdit: 'MultisportClubEdit',
  MyClubs: 'MyClubs',
  MyEventList: 'MyEventList',
  MyLicense: 'MyLicense',
  MyLicenses: 'MyLicenses',
  MyLicensesArchive: 'MyLicensesArchive',
  MyTeamList: 'MyTeamList',
  NewConversation: 'NewConversation',
  NotificationDetails: 'NotificationDetails',
  NotificationList: 'NotificationList',
  PendingMatchStats: 'PendingMatchStats',
  PlayerCard: 'PlayerCard',
  PlayerMatchResponse: 'PlayerMatchResponse',
  PollDetails: 'PollDetails',
  Profile: 'Profile',
  ProfileEdit: 'ProfileEdit',
  PublicAuthStack: 'PublicAuthStack',
  PublicLicensePayment: 'PublicLicensePayment',
  Register: 'Register',
  RequestsDashboard: 'RequestsDashboard',
  RequestsHub: 'RequestsHub',
  ReservationDetails: 'ReservationDetails',
  ReservationEdit: 'ReservationEdit',
  ReservationFilters: 'ReservationFilters',
  // « Mes activites » (lot D35) : on publie depuis Rechercher, on gere ici.
  // Vit dans SearchStack, a cote de l accueil du membre connecte.
  MyActivities: 'MyActivities',
  Search: 'Search',
  SearchAlerts: 'SearchAlerts',
  SearchClubs: 'SearchClubs',
  SearchEvents: 'SearchEvents',
  // Accueil du membre connecte (HomeHub), initialRouteName de SearchStack. Le nom etait une
  // chaine en dur hors de ce registre : la valeur est INCHANGEE ('SearchHome'), seul le
  // point de declaration bouge. Pas d'URL web propre : l'accueil est expose par HomeTab (/).
  SearchHome: 'SearchHome',
  SearchHub: 'SearchHub',
  SearchMapScreen: 'SearchMapScreen',
  SearchRecruitment: 'SearchRecruitment',
  SearchReservations: 'SearchReservations',
  SquadDetails: 'SquadDetails', // New route for League Squad Details
  SquadEdit: 'SquadEdit',
  // L33 — le parcours Abonnement est en TROIS ecrans : le hub garde le nom
  // historique `SubscriptionOverview` et son URL `/profile/subscription`
  // (trois fichiers de test et la table des routes du site en dependent) ;
  // `SubscriptionCompare` (matrice) et `SubscriptionOffers` (carrousel de
  // vente) sont neufs. Toute surface qui vient d'un mur payant ou d'un
  // compteur doit viser SubscriptionOffers, jamais le hub : le hub ne vend rien.
  SubscriptionCompare: 'SubscriptionCompare',
  SubscriptionOffers: 'SubscriptionOffers',
  SubscriptionOverview: 'SubscriptionOverview',
  SubscriptionSuccess: 'SubscriptionSuccess',
  SubscriptionWebSuccess: 'SubscriptionWebSuccess',
  SuperAdminContentExplorer: 'SuperAdminContentExplorer',
  SuperAdminDashboard: 'SuperAdminDashboard',
  SuperAdminEntryDetail: 'SuperAdminEntryDetail',
  SuperAdminEntryForm: 'SuperAdminEntryForm',
  SuperAdminEntryList: 'SuperAdminEntryList',
  SuperAdminHome: 'SuperAdminHome',
  SuperAdminLeagueDisputes: 'SuperAdminLeagueDisputes',
  SuperAdminLeagueDivisions: 'SuperAdminLeagueDivisions',
  SuperAdminLeagueMatches: 'SuperAdminLeagueMatches',
  SuperAdminLeagueSquads: 'SuperAdminLeagueSquads',
  SuperAdminLicenses: 'SuperAdminLicenses',
  SuperAdminSettings: 'SuperAdminSettings',
  TeamDetails: 'TeamDetails',
  TeamEdit: 'TeamEdit',
  TeamFilters: 'TeamFilters',
  TeamList: 'TeamList',
  TeamMembershipRequests: 'TeamMembershipRequests',
  TeamStats: 'TeamStats',
  TeamWizardActivity: 'TeamWizardActivity',
  TeamWizardCategory: 'TeamWizardCategory',
  TeamWizardDescription: 'TeamWizardDescription',
  TeamWizardLevel: 'TeamWizardLevel',
  TeamWizardName: 'TeamWizardName',
  TeamWizardRecap: 'TeamWizardRecap',
  TeamWizardSection: 'TeamWizardSection',
  TeamWizardTrainers: 'TeamWizardTrainers',
  UserAddress: 'UserAddress',
  UserAffiliationGuide: 'UserAffiliationGuide',
  UserAvatar: 'UserAvatar',
  UserCategory: 'UserCategory',
  UserClubSearch: 'UserClubSearch',
  UserDetails: 'UserDetails',
  UserLevel: 'UserLevel',
  UserName: 'UserName',
  UserParentalDeclaration: 'UserParentalDeclaration',
  UserPhysique: 'UserPhysique',
  UserPosition: 'UserPosition',
  UserRole: 'UserRole',
  UserSection: 'UserSection',
  UserSport: 'UserSport',
  UserSportHistory: 'UserSportHistory',
  // D16 - les deux etapes d'affiliation a une EQUIPE. Elles suivent l'etape
  // club et reutilisent la plomberie `team-membership-request` existante.
  UserTeamAffiliation: 'UserTeamAffiliation',
  UserTrainedTeams: 'UserTrainedTeams',
  VisualShowcase: 'VisualShowcase',
  Welcome: 'Welcome',
  // Stacks
  AdminStack: 'AdminStack',
  ClubStack: 'ClubStack',
  EventStack: 'EventStack',
  ProfileStack: 'ProfileStack',
  TeamStack: 'TeamStack',

  // Event Wizard
  // D08 : `EventWizardAccess` porte l'acces de l'evenement — la visibilite
  // (public/prive, identites) ET le mode de validation. Il remplace les deux
  // routes `EventWizardVisibility` et `EventWizardValidationMode`, retirees
  // apres avoir prouve par grep qu'aucun appelant ne subsistait.
  EventWizardAccess: 'EventWizardAccess',
  EventWizardDescription: 'EventWizardDescription',
  EventWizardLocation: 'EventWizardLocation',
  EventWizardLogistics: 'EventWizardLogistics',
  // Y02 : l'etape « Contre qui ? », posee UNIQUEMENT sur le parcours d'un match.
  EventWizardOpponent: 'EventWizardOpponent',
  EventWizardParticipants: 'EventWizardParticipants',
  EventWizardRecap: 'EventWizardRecap',
  EventWizardStageProgram: 'EventWizardStageProgram',
  EventWizardTeam: 'EventWizardTeam',
  EventWizardTournamentSettings: 'EventWizardTournamentSettings',
  EventWizardTournamentStructure: 'EventWizardTournamentStructure',
  EventWizardType: 'EventWizardType',
  TournamentManagement: 'TournamentManagement',
  TournamentMatchDetails: 'TournamentMatchDetails',
  TournamentSettingsEdit: 'TournamentSettingsEdit',
  TournamentTeamDetails: 'TournamentTeamDetails',

  // History Wizard — D40 : UNE seule feuille, sur le telephone comme sur le site.
  // Les 4 noms du tunnel web en 5 pages (`HistoryWizardClub`, `…Level`, `…Period`,
  // `…Recap`) ont ete retires : leurs seuls appelants etaient les ecrans du tunnel
  // eux-memes, supprimes avec eux. Ce nom-ci est conserve tel quel — il porte
  // l'URL `/profile/history/category` et les 8 `navigate()` de l'app.
  HistoryWizardCategory: 'HistoryWizardCategory',

  // Match — convocation (D77, pack composition ecrans 1 a 3).
  // Coexiste avec `TacticalSelectionV2` : l'ancien parcours reste en place tant
  // que les 17 ecrans du pack ne sont pas livres.
  MatchCallUpManualPlayer: 'MatchCallUpManualPlayer',
  MatchCallUpSelection: 'MatchCallUpSelection',

  // Match — placer puis publier (D79, pack composition ecrans 4 a 6). L'ecran 6
  // (la feuille) n'a PAS de route : le pack le dessine par-dessus le terrain.
  MatchCompositionBoard: 'MatchCompositionBoard',
  MatchCompositionStart: 'MatchCompositionStart',

  // Match — apres la publication (C-B, pack composition ecrans 7 et 8).
  MatchCompositionAmend: 'MatchCompositionAmend',
  MatchConvocationPublished: 'MatchConvocationPublished',
  // Match — cote joueur et modeles (C-C, pack composition ecrans 10 a 12).
  CompositionPaywall: 'CompositionPaywall',
  PlayerConvocation: 'PlayerConvocation',
  TeamCompoTemplate: 'TeamCompoTemplate',
  // Detection — constituer les equipes (C-D, ecrans 13 a 15) puis les faire
  // TOURNER (C-E, ecrans 16 et 17).
  // ⚠️ Match et detection ne partagent AUCUN ecran (regle du pack §6) : ces
  // routes ne reutilisent donc rien de `MatchCallUp*`, c'est voulu.
  DetectionRotation: 'DetectionRotation',
  DetectionSquadSetup: 'DetectionSquadSetup',
  DetectionTeamsAuto: 'DetectionTeamsAuto',
  DetectionTeamsBoard: 'DetectionTeamsBoard',
  DetectionTeamsManual: 'DetectionTeamsManual',

  // Tactical
  TacticalBoardV2: 'TacticalBoardV2',
  TacticalSelectionV2: 'TacticalSelectionV2',

  // Recruitment Wizard
  AdWizardAudienceType: 'AdWizardAudienceType',
  AdWizardCoachProfile: 'AdWizardCoachProfile',
  AdWizardDescription: 'AdWizardDescription',
  AdWizardInfo: 'AdWizardInfo',
  AdWizardLocation: 'AdWizardLocation',
  AdWizardPositions: 'AdWizardPositions',
  AdWizardRecap: 'AdWizardRecap',
  AdWizardStack: 'AdWizardStack',
  AdWizardTeam: 'AdWizardTeam',
  AdWizardValidation: 'AdWizardValidation',
  RecruitmentAdDetails: 'RecruitmentAdDetails',
  RecruitmentAdEdit: 'RecruitmentAdEdit',
  RecruitmentAdFilters: 'RecruitmentAdFilters',

  // Matchs amicaux — lot L5 (docs/SPEC_ONGLET_MATCHS_AMICAUX_2026_07_31.md §4.1, §4.3)
  FriendlyMatchAdDetails: 'FriendlyMatchAdDetails',
  FriendlyMatchWizardDates: 'FriendlyMatchWizardDates',
  FriendlyMatchWizardDescription: 'FriendlyMatchWizardDescription',
  FriendlyMatchWizardHosting: 'FriendlyMatchWizardHosting',
  FriendlyMatchWizardLocation: 'FriendlyMatchWizardLocation',
  FriendlyMatchWizardOpponent: 'FriendlyMatchWizardOpponent',
  FriendlyMatchWizardRecap: 'FriendlyMatchWizardRecap',
  FriendlyMatchWizardStack: 'FriendlyMatchWizardStack',
  FriendlyMatchWizardTeam: 'FriendlyMatchWizardTeam',

  // League Tabs (Gold Mode)
  LeagueDashboard: 'LeagueDashboard', // Dedicated screen name
  LeagueHome: 'LeagueHome',
  LeagueHomeTab: 'LeagueHomeTab',
  LeagueMatchDetails: 'LeagueMatchDetails', // Standalone match details
  LeagueMatchTab: 'LeagueMatchTab',
  LeagueRanking: 'LeagueRanking', // Ranking Screen
  LeagueSquadTab: 'LeagueSquadTab',
  MatchDetails: 'MatchDetails',
  PastMatchDetails: 'PastMatchDetails', // Completed match details with ELO delta
  PersonalPlanningWeekFullscreen: 'PersonalPlanningWeekFullscreen',
  PlanningWeekFullscreen: 'PlanningWeekFullscreen',
  SquadFilters: 'SquadFilters',
  SquadRequests: 'SquadRequests',
  SquadSearch: 'SquadSearch',
});
