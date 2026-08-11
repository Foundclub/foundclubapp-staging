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
  [RouteNames.UserAvatar]: '/onboarding/avatar',
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
  [RouteNames.EventDetails]: '/events/:eventId',
  [RouteNames.EventEdit]: '/events/:eventId/edit',
  [RouteNames.EventPublishedShowcase]: '/events/:eventId/published',
  [RouteNames.VisualShowcase]: '/visuals/showcase',
  [RouteNames.MyEventList]: '/events/mine',
  [RouteNames.EventFilters]: '/events/filters',
  [RouteNames.EventWizardType]: '/events/wizard/type',
  [RouteNames.EventWizardTeam]: '/events/wizard/team',
  [RouteNames.EventWizardInvites]: '/events/wizard/invites',
  [RouteNames.EventWizardLogistics]: '/events/wizard/logistics',
  [RouteNames.EventWizardStageProgram]: '/events/wizard/stage-program',
  [RouteNames.EventWizardTournamentSettings]: '/events/wizard/tournament/settings',
  [RouteNames.EventWizardTournamentStructure]: '/events/wizard/tournament/structure',
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
  [RouteNames.MyLicense]: '/licenses/me/:assignmentId?',
  [RouteNames.LicenseCheckoutStatus]: '/licenses/checkout/:assignmentId?',
  [RouteNames.PublicLicensePayment]: '/licenses/pay/:token',
  [RouteNames.MatchCallUpSelection]: '/match/call-up/select',
  [RouteNames.MatchCallUpManualPlayer]: '/match/call-up/manual-player',
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
  [RouteNames.MatchStatsEditor]: '/league/matches/:matchId/stats',
  [RouteNames.PendingMatchStats]: '/league/matches/:matchId/pending-stats',
  [RouteNames.PlayerMatchResponse]: '/league/matches/:matchId/response',
  [RouteNames.PlanningWeekFullscreen]: '/planning/week',
  [RouteNames.PersonalPlanningWeekFullscreen]: '/planning/personal/week',
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

export const getWebRoutePattern = (routeName) => WEB_ROUTE_PATTERNS[routeName] || '/';

export const buildWebPath = (routeName, params = {}, options = {}) => {
  const nestedScreen = params?.screen;
  const nestedParams = params?.params;

  if (typeof nestedScreen === 'string') {
    return buildWebPath(nestedScreen, nestedParams || {}, options);
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
};

export default WEB_ROUTE_PATTERNS;
