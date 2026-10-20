/* eslint-disable perfectionist/sort-objects */
import { RouteNames } from './routeNames';

const WEB_ROUTE_PATTERNS = {
  [RouteNames.Login]: '/login',
  [RouteNames.Register]: '/register',
  [RouteNames.HomeTab]: '/',
  [RouteNames.LeagueHome]: '/league/home',
  [RouteNames.LeagueHomeTab]: '/league',
  [RouteNames.Profile]: '/profile',
  [RouteNames.ProfileEdit]: '/profile/edit',
  // PARENT P2 — « Mes enfants ». Ecrans PRIVES : les quatre routes du tiroir
  // exigent toutes un compte, et une fiche enfant n a AUCUNE page publique
  // (D15 du plan). L URL n expose donc rien par elle-meme.
  [RouteNames.MyChildren]: '/profile/children',
  [RouteNames.ChildEdit]: '/profile/children/edit',
  [RouteNames.PlayerCard]: '/profile/player-card',
  [RouteNames.SubscriptionOverview]: '/profile/subscription',
  [RouteNames.SubscriptionOffers]: '/profile/subscription/offers',
  [RouteNames.SubscriptionCompare]: '/profile/subscription/compare',
  [RouteNames.Welcome]: '/onboarding/welcome',
  [RouteNames.UserRole]: '/onboarding/role',
  [RouteNames.UserName]: '/onboarding/name',
  [RouteNames.UserSport]: '/onboarding/sport',
  [RouteNames.UserSection]: '/onboarding/section',
  [RouteNames.UserLevel]: '/onboarding/level',
  [RouteNames.UserCategory]: '/onboarding/category',
  [RouteNames.UserParentalDeclaration]: '/onboarding/parental-declaration',
  [RouteNames.UserParentAccountRequired]: '/onboarding/parent-account-required',
  [RouteNames.UserAvatar]: '/onboarding/avatar',
  // PARENT P2 — la derniere etape du tunnel parent.
  [RouteNames.UserChild]: '/onboarding/child',
  [RouteNames.UserAddress]: '/onboarding/address',
  [RouteNames.UserClubSearch]: '/onboarding/club-search',
  [RouteNames.UserAffiliationGuide]: '/onboarding/affiliation-guide',
  // D16 - les deux etapes d'affiliation a une equipe.
  [RouteNames.UserTeamAffiliation]: '/onboarding/team-affiliation',
  [RouteNames.UserTrainedTeams]: '/onboarding/trained-teams',
  [RouteNames.UserPosition]: '/onboarding/position',
  [RouteNames.UserPhysique]: '/onboarding/physique',
  [RouteNames.UserSportHistory]: '/onboarding/sport-history',
  [RouteNames.SearchHub]: '/search/hub',
  [RouteNames.UserDetails]: '/users/:userId',
  [RouteNames.Club]: '/clubs/:clubId',
  [RouteNames.ClubEdit]: '/clubs/:clubId/edit',
  [RouteNames.ClubList]: '/clubs',
  [RouteNames.ClubFilters]: '/clubs/filters',
  [RouteNames.ClubMembershipRequests]: '/clubs/:clubId/requests',
  [RouteNames.ClubMemberRoles]: '/clubs/:clubId/members/roles',
  [RouteNames.RequestsDashboard]: '/clubs/:clubId/requests-dashboard',
  [RouteNames.AddCoach]: '/clubs/:clubId/coaches/add',
  [RouteNames.AddClubManager]: '/clubs/:clubId/managers/add',
  [RouteNames.AddSponsor]: '/clubs/:clubId?/sponsors/add',
  [RouteNames.AssignCoachTeams]: '/clubs/:clubId/coaches/:trainerId/assign',
  [RouteNames.ClubLicenses]: '/licenses/clubs/:clubId',
  [RouteNames.ClubLicenseCampaignDetail]: '/licenses/clubs/:clubId/campaigns/:campaignId',
  [RouteNames.ClubLicenseCampaignSettings]: '/licenses/clubs/:clubId/settings/:campaignId?',
  [RouteNames.ClubLicenseMemberDetail]: '/licenses/members/:assignmentId',
  [RouteNames.ClubLicensePayments]: '/licenses/clubs/:clubId/payments/:campaignId?',
  [RouteNames.ClubWizardName]: '/clubs/onboarding/name',
  [RouteNames.ClubWizardAddress]: '/clubs/onboarding/address',
  [RouteNames.ClubWizardActivities]: '/clubs/onboarding/activities',
  [RouteNames.ClubWizardContact]: '/clubs/onboarding/contact',
  [RouteNames.ClubWizardRecap]: '/clubs/onboarding/recap',
  [RouteNames.MultisportClubDetails]: '/multisport/:cmId',
  [RouteNames.MultisportClubEdit]: '/multisport/:cmId/edit',
  [RouteNames.CMDashboard]: '/multisport/:cmId/dashboard',
  [RouteNames.CMLicensesDashboard]: '/multisport/:cmId/licenses',
  [RouteNames.CMMembers]: '/multisport/:cmId/members',
  [RouteNames.CMPlanning]: '/multisport/:cmId/planning',
  [RouteNames.CMTeams]: '/multisport/:cmId/teams',
  [RouteNames.CreateSection]: '/multisport/:cmId/sections/create',
  [RouteNames.FeaturedRequests]: '/multisport/:cmId/featured-requests',
  // MyClubsScreen (views/multisportClub/MyClubsScreen.js) est desormais enregistre dans
  // PrivateNavigator : la navigation "Retour aux clubs" de CMDashboard aboutit, et cette
  // URL monte bien un ecran cote web.
  [RouteNames.MyClubs]: '/multisport',
  [RouteNames.RequestsHub]: '/requests',
  // COLLECTIVITES 1c (2026-09-29) — « Ma collectivite » : une mairie travaille surtout sur
  // ordinateur. Chaque ecran porte la collectivite dans son adresse (le site ne transmet
  // que l adresse et ses parametres texte).
  [RouteNames.CollectiviteHome]: '/collectivite/:collectiviteId',
  [RouteNames.CollectiviteRequests]: '/collectivite/:collectiviteId/requests',
  [RouteNames.CollectiviteClubs]: '/collectivite/:collectiviteId/clubs',
  [RouteNames.CollectiviteInstallations]: '/collectivite/:collectiviteId/installations',
  [RouteNames.CollectiviteInstallationForm]:
    '/collectivite/:collectiviteId/installation/:facilityId?',
  // COLL-ACCUEIL (01/10) — « Je represente une collectivite » : l inscription, puis ou en est
  // la demande. Hors de /collectivite/:collectiviteId : « demande » y serait lu comme un id.
  [RouteNames.CollectiviteSignup]: '/onboarding/collectivite',
  [RouteNames.CollectiviteSignupStatus]: '/collectivite-demande',
  // RESA-INSCRIPTION (19/10/2026) — « Je gère un complexe » au choix du statut : le tunnel du
  // gérant (E-G01), à côté de l'inscription de la mairie. Le site ne le déclare qu'interrupteur
  // COMPLEXES_GERANT allumé (screenRegistry.tsx) ; les autres écrans du gérant : lot RESA-L7-1.
  [RouteNames.ComplexeDevenirGerant]: '/onboarding/complexe',
  [RouteNames.TeamList]: '/teams',
  [RouteNames.MyTeamList]: '/teams/mine',
  [RouteNames.TeamDetails]: '/teams/:teamId',
  [RouteNames.TeamEdit]: '/teams/:teamId/edit',
  [RouteNames.TeamStats]: '/teams/:teamId/stats',
  [RouteNames.TeamFilters]: '/teams/filters',
  [RouteNames.TeamMembershipRequests]: '/teams/:teamId/requests',
  [RouteNames.TeamWizardName]: '/teams/wizard/name',
  [RouteNames.TeamWizardDescription]: '/teams/wizard/description',
  [RouteNames.TeamWizardSection]: '/teams/wizard/section',
  [RouteNames.TeamWizardActivity]: '/teams/wizard/activity',
  [RouteNames.TeamWizardCategory]: '/teams/wizard/category',
  [RouteNames.TeamWizardLevel]: '/teams/wizard/level',
  [RouteNames.TeamWizardTrainers]: '/teams/wizard/trainers',
  [RouteNames.TeamWizardRecap]: '/teams/wizard/recap',
  [RouteNames.CreateSquad]: '/league/squads/create',
  [RouteNames.EventAttendanceCall]: '/event/attendance-call',
  [RouteNames.EventDetails]: '/events/:eventId',
  [RouteNames.EventEdit]: '/events/:eventId/edit',
  [RouteNames.EventPublishedShowcase]: '/events/:eventId/published',
  [RouteNames.VisualShowcase]: '/visuals/showcase',
  [RouteNames.MyEventList]: '/events/mine',
  [RouteNames.EventFilters]: '/events/filters',
  [RouteNames.EventWizardType]: '/events/wizard/type',
  [RouteNames.EventWizardTeam]: '/events/wizard/team',
  [RouteNames.EventWizardLogistics]: '/events/wizard/logistics',
  [RouteNames.EventWizardStageProgram]: '/events/wizard/stage-program',
  [RouteNames.EventWizardTournamentSettings]: '/events/wizard/tournament/settings',
  [RouteNames.EventWizardTournamentStructure]: '/events/wizard/tournament/structure',
  [RouteNames.EventWizardOpponent]: '/events/wizard/opponent',
  [RouteNames.EventWizardLocation]: '/events/wizard/location',
  [RouteNames.EventWizardAccess]: '/events/wizard/access',
  [RouteNames.EventWizardParticipants]: '/events/wizard/participants',
  [RouteNames.EventWizardDescription]: '/events/wizard/description',
  [RouteNames.EventWizardRecap]: '/events/wizard/recap',
  [RouteNames.TournamentManagement]: '/events/:eventId/tournament',
  [RouteNames.TournamentMatchDetails]: '/events/:eventId/tournament/matches/:matchId',
  [RouteNames.TournamentSettingsEdit]: '/events/:eventId/tournament/settings',
  [RouteNames.TournamentTeamDetails]: '/events/:eventId/tournament/teams/:teamId',
  [RouteNames.Search]: '/search',
  [RouteNames.SearchEvents]: '/search/events',
  [RouteNames.SearchClubs]: '/search/clubs',
  [RouteNames.SearchMapScreen]: '/search/map/:scope',
  [RouteNames.SearchReservations]: '/search/reservations',
  [RouteNames.SearchRecruitment]: '/search/recruitment',
  [RouteNames.SearchAlerts]: '/search/alerts',
  [RouteNames.MercatoFilters]: '/search/recruitment/filters',
  [RouteNames.ReservationFilters]: '/search/reservations/filters',
  [RouteNames.NotificationList]: '/notifications',
  [RouteNames.NotificationDetails]: '/notifications/:notificationId',
  [RouteNames.GuideOffersRecap]: '/missions/offers',
  [RouteNames.SubscriptionSuccess]: '/subscription/success',
  [RouteNames.SubscriptionWebSuccess]: '/subscription/web-success',
  [RouteNames.Conversation]: '/messages/:chatId',
  [RouteNames.Chat]: '/messages',
  [RouteNames.NewConversation]: '/messages/new',
  [RouteNames.ConversationPublicEventPicker]: '/messages/:chatId/public-events',
  [RouteNames.BookingCalendar]: '/booking',
  [RouteNames.MissingPlayersView]: '/booking/missing-players',
  [RouteNames.ReservationDetails]: '/reservations/:reservationId',
  // TODO(parite-web) : ReservationEdit.web.js existe (adaptateur web vers EventEdit) mais
  // n'est enregistre dans aucun navigateur et n'est cible par aucun navigate().
  // Motif conserve : l'ecran est explicitement prevu pour le web, il reste a le cabler.
  [RouteNames.ReservationEdit]: '/reservations/:reservationId/edit',
  [RouteNames.RecruitmentAdDetails]: '/recruitment/:adId',
  [RouteNames.RecruitmentAdEdit]: '/recruitment/:adId/edit',
  [RouteNames.RecruitmentAdFilters]: '/recruitment/filters',
  [RouteNames.AdWizardTeam]: '/recruitment/wizard/team',
  [RouteNames.AdWizardAudienceType]: '/recruitment/wizard/audience',
  [RouteNames.AdWizardCoachProfile]: '/recruitment/wizard/coach-profile',
  [RouteNames.AdWizardInfo]: '/recruitment/wizard/info',
  [RouteNames.AdWizardLocation]: '/recruitment/wizard/location',
  [RouteNames.AdWizardPositions]: '/recruitment/wizard/positions',
  [RouteNames.AdWizardValidation]: '/recruitment/wizard/validation',
  [RouteNames.AdWizardDescription]: '/recruitment/wizard/description',
  [RouteNames.AdWizardRecap]: '/recruitment/wizard/recap',
  // Matchs amicaux — lot L7. Meme decoupage que /recruitment : une URL par
  // etape, parce que sur le web chaque etape est montee independamment (il n y
  // a pas de pile de navigation). Le brouillon voyage par sessionStorage,
  // pose par FriendlyMatchWizardContext.
  [RouteNames.FriendlyMatchAdDetails]: '/friendly-matches/:adId',
  [RouteNames.FriendlyMatchWizardTeam]: '/friendly-matches/wizard/team',
  [RouteNames.FriendlyMatchWizardHosting]: '/friendly-matches/wizard/hosting',
  [RouteNames.FriendlyMatchWizardDates]: '/friendly-matches/wizard/dates',
  [RouteNames.FriendlyMatchWizardLocation]: '/friendly-matches/wizard/location',
  [RouteNames.FriendlyMatchWizardOpponent]: '/friendly-matches/wizard/opponent',
  [RouteNames.FriendlyMatchWizardDescription]: '/friendly-matches/wizard/description',
  [RouteNames.FriendlyMatchWizardRecap]: '/friendly-matches/wizard/recap',
  [RouteNames.PollDetails]: '/polls/:pollId',
  [RouteNames.FacilityList]: '/facilities',
  [RouteNames.FacilityForm]: '/facilities/:facilityId?',
  [RouteNames.AdminDashboard]: '/admin',
  [RouteNames.AdminRevenue]: '/admin/revenue',
  [RouteNames.AdminEvents]: '/admin/events',
  [RouteNames.AdminReports]: '/admin/reports',
  [RouteNames.AdminPopupCampaignList]: '/admin/popup-campaigns',
  [RouteNames.AdminPopupCampaignDetail]: '/admin/popup-campaigns/:campaignId',
  [RouteNames.AdminPopupCampaignForm]: '/admin/popup-campaigns/:campaignId?/edit',
  [RouteNames.AdminClaimList]: '/admin/claims',
  [RouteNames.AdminClaimDetail]: '/admin/claims/:requestId',
  [RouteNames.AdminClubOnboardingList]: '/admin/clubs/onboarding',
  [RouteNames.AdminUserList]: '/admin/users',
  [RouteNames.AdminUserDetail]: '/admin/users/:userId',
  [RouteNames.AdminClubList]: '/admin/clubs',
  [RouteNames.AdminClubDetail]: '/admin/clubs/:clubId',
  [RouteNames.AdminClubForm]: '/admin/clubs/:clubId?/edit',
  [RouteNames.AdminClubWizardIdentity]: '/admin/clubs/create/identity',
  [RouteNames.AdminClubWizardContact]: '/admin/clubs/create/contact',
  [RouteNames.AdminClubWizardAddress]: '/admin/clubs/create/address',
  [RouteNames.AdminClubWizardActivities]: '/admin/clubs/create/activities',
  [RouteNames.AdminClubWizardBusiness]: '/admin/clubs/create/business',
  [RouteNames.AdminClubWizardMultisport]: '/admin/clubs/create/multisport',
  [RouteNames.AdminClubWizardSponsors]: '/admin/clubs/create/sponsors',
  [RouteNames.AdminClubWizardRecap]: '/admin/clubs/create/recap',
  // D61 (29/09) — la console des collectivites (super-admin seulement, AdminStack).
  [RouteNames.AdminCollectiviteList]: '/admin/collectivites',
  [RouteNames.AdminCollectiviteForm]: '/admin/collectivites/new',
  [RouteNames.AdminCollectiviteDetail]: '/admin/collectivites/:collectiviteId',
  // COLL-ACCUEIL (01/10) — la file « Demandes de gestionnaire » (hors de /admin/collectivites/:id :
  // « demandes » y serait lu comme une collectivite).
  [RouteNames.AdminManagerRequests]: '/admin/demandes-gestionnaire',
  // COLL-CONSOLE (02/10) — les demandes de rattachement et « Par FoundClub » (hors de
  // /admin/collectivites/:id, pour la meme raison que la file des gestionnaires).
  [RouteNames.AdminCollectiviteInvitations]: '/admin/rattachements-collectivites',
  [RouteNames.AdminLeagueDisputes]: '/admin/league/disputes',
  [RouteNames.AdminNotificationsHealth]: '/admin/notifications-health',
  [RouteNames.FeaturedRequestsList]: '/admin/featured-requests',
  [RouteNames.SuperAdminContentExplorer]: '/admin/content',
  [RouteNames.SuperAdminDashboard]: '/superadmin/dashboard',
  [RouteNames.SuperAdminEntryList]: '/admin/content/:uid',
  [RouteNames.SuperAdminEntryDetail]: '/admin/content/:uid/:documentId',
  [RouteNames.SuperAdminEntryForm]: '/admin/content/:uid/:documentId/edit',
  [RouteNames.SuperAdminHome]: '/superadmin',
  [RouteNames.SuperAdminLicenses]: '/superadmin/licenses',
  [RouteNames.SuperAdminLeagueMatches]: '/superadmin/matches',
  [RouteNames.SuperAdminLeagueSquads]: '/superadmin/squads',
  [RouteNames.SuperAdminLeagueDisputes]: '/superadmin/disputes',
  [RouteNames.SuperAdminLeagueDivisions]: '/superadmin/divisions',
  [RouteNames.SuperAdminSettings]: '/superadmin/settings',
  [RouteNames.MyLicenses]: '/licenses/me',
  [RouteNames.MyLicensesArchive]: '/licenses/me/archive',
  [RouteNames.MyLicense]: '/licenses/me/:assignmentId',
  [RouteNames.LicenseCheckoutStatus]: '/licenses/checkout/:assignmentId?',
  [RouteNames.PublicLicensePayment]: '/licenses/pay/:token',
  [RouteNames.MatchCallUpSelection]: '/match/call-up/select',
  [RouteNames.MatchCallUpManualPlayer]: '/match/call-up/manual-player',
  [RouteNames.MatchCompositionStart]: '/match/composition/start',
  [RouteNames.MatchCompositionBoard]: '/match/composition/board',
  [RouteNames.MatchConvocationPublished]: '/match/convocation/published',
  [RouteNames.MatchCompositionAmend]: '/match/composition/amend',
  // C-C — ecrans 10 a 12 du pack composition.
  [RouteNames.PlayerConvocation]: '/match/convocation/me',
  [RouteNames.TeamCompoTemplate]: '/team/composition/template',
  [RouteNames.CompositionPaywall]: '/match/composition/offer',
  [RouteNames.DetectionSquadSetup]: '/detection/squad',
  [RouteNames.DetectionTeamsManual]: '/detection/teams/manual',
  [RouteNames.DetectionTeamsAuto]: '/detection/teams/auto',
  [RouteNames.DetectionTeamsBoard]: '/detection/teams/board',
  [RouteNames.DetectionRotation]: '/detection/teams/rotation',
  [RouteNames.TacticalBoardV2]: '/tactical/:teamId?',
  [RouteNames.TacticalSelectionV2]: '/tactical/select',
  [RouteNames.HistoryWizardCategory]: '/profile/history/category',
  [RouteNames.LeagueDashboard]: '/league/dashboard',
  [RouteNames.MatchCenter]: '/league/match-center',
  [RouteNames.LeagueMatchTab]: '/league/matches',
  [RouteNames.LeagueSquadTab]: '/league/squad',
  [RouteNames.LeagueRanking]: '/league/ranking',
  [RouteNames.SquadSearch]: '/league/search',
  [RouteNames.SquadDetails]: '/league/squads/:teamId',
  [RouteNames.SquadEdit]: '/league/squads/:teamId/edit',
  [RouteNames.SquadFilters]: '/league/search/filters',
  [RouteNames.SquadRequests]: '/league/squads/:teamId/requests',
  [RouteNames.MatchDetails]: '/league/matches/:matchId/live',
  [RouteNames.LeagueMatchDetails]: '/league/matches/:matchId',
  [RouteNames.MatchHistoryScreen]: '/league/matches/history',
  [RouteNames.EndMatchScreen]: '/league/matches/:matchId/end',
  [RouteNames.PastMatchDetails]: '/league/matches/:matchId/past',
  // FINITIONS16 · POINT 15 (T15) — hors de « /league » et SANS parametre de chemin : le site
  // choisit sa barre a l'adresse, et un match de club passe un `eventId` (le `:matchId` restait
  // en clair). L'evenement ou le match de League voyagent en parametres.
  [RouteNames.MatchStatsEditor]: '/match-stats/sheet',
  [RouteNames.PendingMatchStats]: '/match-stats/pending',
  [RouteNames.PlayerMatchResponse]: '/match-stats/response',
  [RouteNames.PlanningWeekFullscreen]: '/planning/week',
  [RouteNames.PersonalPlanningWeekFullscreen]: '/planning/personal/week',
  // COLL-CLUBS (01/10/2026) — la fiche d un club rattache, cote mairie (la collectivite et le
  // club dans l adresse, comme les autres ecrans de « Ma collectivite »).
  [RouteNames.CollectiviteClubDetails]: '/collectivite/:collectiviteId/clubs/:clubId',
  // COLL-CLUBS (01/10/2026) — inviter un club absent (hors de « /clubs/:clubId » : « inviter »
  // y serait lu comme un club) ; la page PUBLIQUE du lien de la Ville (le code du lien, aucune
  // donnee personnelle) ; la demande de rattachement, qui exige un compte.
  [RouteNames.CollectiviteInviteClub]: '/collectivite/:collectiviteId/inviter-un-club',
  [RouteNames.CollectiviteJoin]: '/invitation-ville/:token',
  [RouteNames.CollectiviteJoinRequest]: '/invitation-ville/:token/rattacher',
  // COLL-C4A (02/10/2026) — les actualites de la Ville, cote mairie : la liste, et le formulaire
  // (sans identifiant : publier ; avec : modifier).
  [RouteNames.CollectiviteActualites]: '/collectivite/:collectiviteId/actualites',
  [RouteNames.CollectiviteActualiteForm]: '/collectivite/:collectiviteId/actualite/:actualiteId?',
  // COLL-C4A planche 2 — le canal de la Ville d un membre (une Ville, ou toutes les siennes).
  [RouteNames.CollectiviteActualitesCanal]: '/actualites-ville/:collectiviteId?',
  // COLL-C2B (02/10/2026) — une installation de la Ville, ses creneaux (la collectivite et
  // l installation dans l adresse ; « /installation/:facilityId? » reste le formulaire).
  [RouteNames.CollectiviteInstallation]: '/collectivite/:collectiviteId/installations/:facilityId',
  // COLL-C4A2 (02/10/2026) — « Dans ce canal » (sur ordinateur, la colonne de droite de la
  // conversation le montre deja ; l adresse sert le telephone et un lien direct).
  [RouteNames.CollectiviteCanalMembres]: '/messages/:chatId/membres-de-la-ville',
  // COLL-C3B (02/10/2026) — le club demande un creneau a la Ville, puis suit ses demandes.
  [RouteNames.ClubSlotRequest]: '/demander-un-creneau',
  [RouteNames.ClubSlotRequests]: '/mes-demandes-a-la-ville',
  // COLL-C4B (02/10/2026) — fermer, bloquer, modifier (l installation, le mode, la fermeture et le
  // jour d un blocage voyagent en parametres).
  [RouteNames.CollectiviteFermeture]: '/collectivite/:collectiviteId/fermeture',
  // R17-SIGNALER-1 (19/10/2026) — signaler (l installation et la seance voyagent en parametres), un
  // signalement, et les miens.
  [RouteNames.FacilityReportNew]: '/signaler-un-probleme',
  [RouteNames.FacilityReportDetails]: '/signalements/:reportId',
  [RouteNames.MyFacilityReports]: '/mes-signalements',
  // COLL-C5 (03/10/2026) — les chiffres de la Ville et leur export.
  [RouteNames.CollectiviteChiffres]: '/collectivite/:collectiviteId/chiffres',
  // R17-EVT-1 (20/10/2026) — ajouter ou modifier un événement de la Ville ; sa fiche.
  [RouteNames.CollectiviteEvenement]: '/collectivite/:collectiviteId/evenement/:evenementId?',
  [RouteNames.EvenementDeLaVille]: '/evenements-de-la-ville/:evenementId',
  // RESA-L7-1 (20/10/2026) — LE GÉRANT DE COMPLEXE (RESA-L5A1 / L5A2). Son complexe voyage en
  // paramètre d adresse (?complexeId=) : les écrans le lisent comme un paramètre facultatif
  // (« mon » complexe par défaut), et l accueil, premier onglet de l espace, s ouvre sans rien à
  // remplir (WEB_STACK_INITIAL_ROUTES). Le site ne déclare ces écrans qu interrupteur
  // COMPLEXES_GERANT allumé (web/src/routes/screenRegistry.tsx). Le tunnel « Devenir gérant » :
  // lot RESA-INSCRIPTION.
  [RouteNames.ComplexeAccueil]: '/mon-complexe',
  [RouteNames.ComplexeDemandes]: '/mon-complexe/demandes',
  [RouteNames.ComplexePlanning]: '/mon-complexe/planning',
  [RouteNames.ComplexeReservations]: '/mon-complexe/reservations',
  [RouteNames.ComplexeReservation]: '/mon-complexe/reservations/:reservationId',
  [RouteNames.ComplexeFermetures]: '/mon-complexe/fermetures',
  [RouteNames.ComplexeInstallations]: '/mon-complexe/installations',
  [RouteNames.ComplexeCreneaux]: '/mon-complexe/installations/:terrainId/creneaux',
  // Le formulaire d un terrain (sans identifiant : l ajouter ; avec : le modifier).
  [RouteNames.ComplexeTerrain]: '/mon-complexe/terrain/:terrainId?',
  [RouteNames.ComplexeReglages]: '/mon-complexe/reglages',
  // RESA-L7-1 — LE JOUEUR (RESA-L6A). La page du complexe EST sa page publique dans l annuaire,
  // par son slug (planche OR2 : « d abord une page du site » ; le cadre change selon qu on a un
  // compte, web/src/pages/seo/CadreAnnuaire.tsx). Les écrans qui demandent un compte sous
  // /reserver-un-terrain ; « Ma réservation » hors de /reservations/:id (l ancienne réservation-
  // événement). Déclarés interrupteur COMPLEXES_JOUEUR allumé seulement.
  [RouteNames.ReserverComplexe]: '/annuaire/complexes/:slug',
  [RouteNames.ReserverCreneau]: '/reserver-un-terrain/:slug/:terrainId',
  [RouteNames.ReserverRecapitulatif]: '/reserver-un-terrain/:slug/:terrainId/recapitulatif',
  [RouteNames.ReserverResultat]: '/reserver-un-terrain/resultat',
  [RouteNames.ReserverEchec]: '/reserver-un-terrain/echec',
  [RouteNames.ReserverMaReservation]: '/reservation-terrain/:reservationId',
};

const normalizePathValue = (value) => String(value || '').trim();

const replacePathParams = (pattern, params = {}) => {
  const withOptionalParamsResolved = pattern.replace(/\/:([A-Za-z0-9_]+)\?/g, (_, key) => {
    const rawValue = params[key];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return '';
    }

    return `/${encodeURIComponent(String(rawValue))}`;
  });

  return withOptionalParamsResolved.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const rawValue = params[key];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return `:${key}`;
    }

    return encodeURIComponent(String(rawValue));
  });
};

const buildQueryString = (params = {}, reservedKeys = []) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (reservedKeys.includes(key)) return;
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'object') return;
    searchParams.set(key, String(value));
  });

  const result = searchParams.toString();
  return result ? `?${result}` : '';
};

/**
 * Une valeur d'adresse : « true » et « false » redeviennent des booleens.
 * @param {string} value
 * @returns {string | boolean}
 */
const readQueryValue = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/**
 * URL-BOOLEENS (29/09) — L'INVERSE DE `buildQueryString`, lu par le site
 * (`useSharedScreenProps`). Une adresse ne porte que des chaines : `?canEdit=false`
 * rendait « false », NON VIDE donc VRAIE, et `preview === true` ne reconnaissait
 * plus « true ». Les deux booleens reprennent donc leur type ICI, une fois pour
 * tous les ecrans. `false` n'est PAS saute a l'ecriture : un parametre « vrai par
 * defaut » (`enableMapMode !== false`) y perdrait son `false` explicite, et
 * `navigation.setParams` ecrit l'adresse sans passer par `buildQueryString`.
 * ponytail: un TEXTE valant exactement « true » ou « false » revient booleen.
 * Aucun parametre texte ne le vaut au 29/09 ; si un jour il le faut, marquer le
 * type a l'ecriture au lieu de le deviner ici.
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string | boolean>}
 */
export const readWebQueryParams = (searchParams) => Object.fromEntries(
  Array.from(searchParams.entries(), ([key, value]) => [key, readQueryValue(value)]),
);

export const getWebRoutePattern = (routeName) => WEB_ROUTE_PATTERNS[routeName] || '/';

/**
 * FINITIONS16 · POINT 13 (T15) — UNE PILE APPELEE SANS ECRAN. Sur le telephone,
 * `navigate(AdWizardStack)` ouvre la pile sur son premier ecran (`initialRouteName`) ;
 * sur le site, la pile n'a pas d'adresse (un conteneur, webRouteExemptions.js) et
 * `buildWebPath` rendait « / » : « Recruter » ramenait a l'accueil, ou l'on etait deja,
 * et les 5 `navigate(ProfileStack)` aussi. Le premier ecran de chaque pile, LE MEME que
 * celui du telephone (un temoin relit les piles) ; seulement ceux dont l'adresse n'a pas
 * de parametre a remplir (EventStack, qui demande un match, n'y est pas).
 * RESA-L7-1 (20/10/2026) — l'espace du complexe (navigateur a onglets) ouvre son accueil, comme
 * le telephone (`ComplexeTabNavigator.js`, initialRouteName).
 */
/** @type {Readonly<Record<string, string>>} */
const WEB_STACK_INITIAL_ROUTES = Object.freeze({
  [RouteNames.AdWizardStack]: RouteNames.AdWizardAudienceType,
  [RouteNames.AdminStack]: RouteNames.SuperAdminHome,
  [RouteNames.ClubStack]: RouteNames.ClubList,
  [RouteNames.ComplexeEspace]: RouteNames.ComplexeAccueil,
  [RouteNames.FriendlyMatchWizardStack]: RouteNames.FriendlyMatchWizardTeam,
  [RouteNames.ProfileStack]: RouteNames.Profile,
  [RouteNames.TeamStack]: RouteNames.TeamList,
});

export const buildWebPath = (routeName, params = {}, options = {}) => {
  const nestedScreen = params?.screen;
  const nestedParams = params?.params;

  if (typeof nestedScreen === 'string') {
    return buildWebPath(nestedScreen, nestedParams || {}, options);
  }

  const premierEcranDeLaPile = WEB_STACK_INITIAL_ROUTES[String(routeName)];
  const adresses = /** @type {Record<string, string>} */ (WEB_ROUTE_PATTERNS);
  if (premierEcranDeLaPile && !adresses[String(routeName)]) {
    return buildWebPath(premierEcranDeLaPile, params, options);
  }

  const pattern = getWebRoutePattern(routeName);
  const resolvedPath = replacePathParams(pattern, params);
  const reservedKeys = Array.from(resolvedPath.matchAll(/:([A-Za-z0-9_]+)/g)).map((match) => match[1]);
  const queryString = buildQueryString(params, reservedKeys.concat(['screen', 'params']));
  const relativePath = `${resolvedPath}${queryString}`;

  if (!options.absolute || typeof window === 'undefined') {
    return relativePath;
  }

  return new URL(relativePath, window.location.origin).toString();
};

export const isWebRouteSupported = (routeName) => Boolean(WEB_ROUTE_PATTERNS[routeName]);

export const getInitialWebPath = () => normalizePathValue(WEB_ROUTE_PATTERNS[RouteNames.HomeTab]);

export {
  WEB_ROUTE_PATTERNS,
  WEB_STACK_INITIAL_ROUTES,
};

export default WEB_ROUTE_PATTERNS;
