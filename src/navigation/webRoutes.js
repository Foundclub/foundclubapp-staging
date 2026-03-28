import { RouteNames } from './routeNames';

const WEB_ROUTE_PATTERNS = {
  [RouteNames.Login]: '/login',
  [RouteNames.Register]: '/register',
  [RouteNames.HomeTab]: '/',
  [RouteNames.LeagueHomeTab]: '/league',
  [RouteNames.Profile]: '/profile',
  [RouteNames.ProfileEdit]: '/profile/edit',
  [RouteNames.Welcome]: '/onboarding/welcome',
  [RouteNames.UserRole]: '/onboarding/role',
  [RouteNames.UserName]: '/onboarding/name',
  [RouteNames.UserSport]: '/onboarding/sport',
  [RouteNames.UserSection]: '/onboarding/section',
  [RouteNames.UserLevel]: '/onboarding/level',
  [RouteNames.UserCategory]: '/onboarding/category',
  [RouteNames.UserBirthdate]: '/onboarding/birthdate',
  [RouteNames.UserAvatar]: '/onboarding/avatar',
  [RouteNames.UserAddress]: '/onboarding/address',
  [RouteNames.UserClubSearch]: '/onboarding/club-search',
  [RouteNames.UserAffiliationGuide]: '/onboarding/affiliation-guide',
  [RouteNames.UserPosition]: '/onboarding/position',
  [RouteNames.UserPhysique]: '/onboarding/physique',
  [RouteNames.UserSportHistory]: '/onboarding/sport-history',
  [RouteNames.UserDetails]: '/users/:userId',
  [RouteNames.Club]: '/clubs/:clubId',
  [RouteNames.ClubEdit]: '/clubs/:clubId/edit',
  [RouteNames.ClubList]: '/clubs',
  [RouteNames.MultisportClubDetails]: '/multisport/:cmId',
  [RouteNames.MultisportClubEdit]: '/multisport/:cmId/edit',
  [RouteNames.CMDashboard]: '/multisport/:cmId/dashboard',
  [RouteNames.CMMembers]: '/multisport/:cmId/members',
  [RouteNames.CMPlanning]: '/multisport/:cmId/planning',
  [RouteNames.CMTeams]: '/multisport/:cmId/teams',
  [RouteNames.CreateSection]: '/multisport/:cmId/sections/create',
  [RouteNames.RequestsHub]: '/requests',
  [RouteNames.TeamList]: '/teams',
  [RouteNames.MyTeamList]: '/teams/mine',
  [RouteNames.TeamDetails]: '/teams/:teamId',
  [RouteNames.TeamEdit]: '/teams/:teamId/edit',
  [RouteNames.TeamStats]: '/teams/:teamId/stats',
  [RouteNames.EventDetails]: '/events/:eventId',
  [RouteNames.EventEdit]: '/events/:eventId/edit',
  [RouteNames.MyEventList]: '/events/mine',
  [RouteNames.Search]: '/search',
  [RouteNames.SearchEvents]: '/search/events',
  [RouteNames.SearchClubs]: '/search/clubs',
  [RouteNames.SearchReservations]: '/search/reservations',
  [RouteNames.SearchRecruitment]: '/search/recruitment',
  [RouteNames.SearchAlerts]: '/search/alerts',
  [RouteNames.NotificationList]: '/notifications',
  [RouteNames.NotificationDetails]: '/notifications/:notificationId',
  [RouteNames.Conversation]: '/messages/:chatId',
  [RouteNames.Chat]: '/messages',
  [RouteNames.BookingCalendar]: '/booking',
  [RouteNames.RecruitmentAdDetails]: '/recruitment/:adId',
  [RouteNames.RecruitmentAdEdit]: '/recruitment/:adId/edit',
  [RouteNames.AdminDashboard]: '/admin',
  [RouteNames.SuperAdminContentExplorer]: '/admin/content',
  [RouteNames.SuperAdminEntryList]: '/admin/content/:kind',
  [RouteNames.SuperAdminEntryDetail]: '/admin/content/:kind/:entryId',
  [RouteNames.SuperAdminEntryForm]: '/admin/content/:kind/:entryId/edit',
  [RouteNames.TacticalBoardV2]: '/tactical/:teamId?',
  [RouteNames.LeagueDashboard]: '/league/dashboard',
  [RouteNames.SquadSearch]: '/league/search',
  [RouteNames.SquadDetails]: '/league/squads/:teamId',
  [RouteNames.SquadRequests]: '/league/squads/:teamId/requests',
  [RouteNames.LeagueMatchDetails]: '/league/matches/:matchId',
  [RouteNames.PastMatchDetails]: '/league/matches/:matchId/past',
};

const normalizePathValue = (value) => String(value || '').trim();

const replacePathParams = (pattern, params = {}) => pattern.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
  const rawValue = params[key];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return `:${key}`;
  }

  return encodeURIComponent(String(rawValue));
});

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
