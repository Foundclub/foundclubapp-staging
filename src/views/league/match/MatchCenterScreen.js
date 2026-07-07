/* eslint-disable import/order, perfectionist/sort-imports */
import Slider from '@react-native-community/slider';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SearchCountdown from '@/components/organisms/league/SearchCountdown';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import { useMatchmakingStateMachine } from '@/views/league/match/hooks/useMatchmakingStateMachine';
import { navigateToLeagueMatchDetails } from '@/views/league/match/utils/leagueNavigation';
import { canOpenProposalRouteForMatch } from '@/views/league/match/utils/proposalRouteIntent';
import {
  shouldMaskOpponentIdentity,
  shouldShowNextMatchCard,
} from '@/views/league/match/utils/matchStatus';
import { buildProposalDefaultsFromMatch, toHourMinute } from '@/views/league/match/utils/proposalDefaults';
import { buildCanonicalLeagueProposalPayload } from '@/views/league/match/utils/proposalPayload';

import { RouteNames } from '@/navigation/routeNames'; // Import RouteNames
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { createLeagueProposal, getMatchHistory } from '@/services/league/leagueMatchService';
import { useLeaguePlatformRuntime } from '@/services/league/leaguePlatformQueries';
import {
  getLeagueClosedMessage,
  getLeaguePlatformRestrictionCode,
  getLeagueRestrictionScope,
  getLeagueRuntimeFromError,
  isLeaguePlatformRestrictedError,
} from '@/services/league/leaguePlatformService';
import { createTeamSlot, getAvailableSlots } from '@/services/teamSlot/teamSlotService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';
import { isLeagueCaptain } from '@/utils/league/captains';
import { getDivisionProgressState, getNextStreakBonus } from '@/utils/league/division';
import {
  getLocationCoordinates,
  hasValidLocationCoordinates,
  normalizeLocationInput,
  normalizeRadius,
} from '@/utils/location';
import {
  doesMatchRequireVenue,
  getLocationModeLabel,
  getMatchDurationMinutes,
  getRequiredPlayersForSport,
} from '@/utils/leagueSportConfig';
import safeJsonParse from '@/utils/safeJsonParse';

import ClockIcon from '../../../assets/icons/clock.png';
import LocationIcon from '../../../assets/icons/location.png';
import Button from '../../../components/atoms/button/Button';
import LeagueCard from '../../../components/atoms/league/LeagueCard';
import SectionHeader from '../../../components/atoms/SectionHeader/SectionHeader';
import AutocompleteAddressInput from '../../../components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import useAuth from '../../../domains/auth/useAuth';
import MatchmakingService from '../../../services/league/MatchmakingService';
import { loadLeagueTeamContextWithCache } from '../../../services/leagueTeam/leagueTeamQueries';
import { formatDateWithDayPrefix as formatDate } from '../../../utils/date';
import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';
import NextMatchCard from './components/NextMatchCard';
/* eslint-enable import/order, perfectionist/sort-imports */

/**
 * @typedef {'loading' | 'initializing' | 'no_squad' | 'locker_room' | 'lobby' | 'radar' | 'match_found' | 'connection_error' | 'searching_start'} MatchCenterViewState
 */

/**
 * @typedef {{address: string | null, city: string | null, context?: string | null, country?: string, label: string | null, lat: number | null, lng: number | null, postcode: string | null, radius?: number, value: string}} SearchLocation
 */

/**
 * @typedef {{day: string, startTime: string, endTime: string, locationMode?: string | null}} AddSearchSlotPayload
 */

/**
 * @typedef {{address?: string, addressObject?: {label?: string, address?: string} | null, date?: string, endDate?: string, venue?: string}} VenueProposalPayload
 */

/**
 * @param {{
 *  Colors: Record<string, any>,
 *  Images: Record<string, any>,
 *  rsvpCount?: number,
 *  total?: number,
 * }} props
 * @returns {React.ReactElement}
 */
function VisualRoster({
  Colors,
  Images,
  rsvpCount = 0,
  total = 5,
}) {
  const slotKeys = Array.from(
    { length: total },
    (unused, slotIndex) => `roster-slot-${slotIndex + 1}`,
  );

  return (
    <View style={{
      alignItems: 'center', flexDirection: 'row', marginVertical: 12, paddingLeft: 8,
    }}
    >
      {slotKeys.map((slotKey, slotIndex) => {
        const isFilled = slotIndex < rsvpCount;
        return (
          <View
            key={slotKey}
            style={{
              alignItems: 'center',
              backgroundColor: Colors.neutral800,
              borderColor: 'rgba(255,255,255,0.14)',
              borderRadius: 18,
              borderWidth: 2,
              height: 36,
              justifyContent: 'center',
              marginRight: -8,
              overflow: 'hidden',
              width: 36,
            }}
          >
            {isFilled ? (
              <Image source={Images.roundAvatar} style={{ height: '100%', width: '100%' }} />
            ) : (
              <View style={{
                backgroundColor: Colors.neutral700, borderRadius: 4, height: 8, width: 8,
              }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Resolve Strapi media URL from multiple payload shapes.
 * @param {unknown} media
 * @returns {string | undefined}
 */
const resolveMediaUrl = (media) => {
  if (!media) return undefined;
  if (typeof media === 'string') return media;
  if (typeof media !== 'object') return undefined;

  const source = /** @type {Record<string, any>} */ (media);
  const direct = [source.url, source.uri, source.path].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (direct) return direct;

  const rootAttributes = source.attributes && typeof source.attributes === 'object'
    ? /** @type {Record<string, any>} */ (source.attributes)
    : null;
  const rootAttributeUrl = rootAttributes
    ? [rootAttributes.url, rootAttributes.uri, rootAttributes.path].find(
      (value) => typeof value === 'string' && value.length > 0,
    )
    : undefined;
  if (rootAttributeUrl) return rootAttributeUrl;

  const nestedData = source.data && typeof source.data === 'object'
    ? /** @type {Record<string, any>} */ (source.data)
    : null;
  if (!nestedData) return undefined;

  const nestedDirect = [nestedData.url, nestedData.uri, nestedData.path].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (nestedDirect) return nestedDirect;

  const nestedAttributes = nestedData.attributes && typeof nestedData.attributes === 'object'
    ? /** @type {Record<string, any>} */ (nestedData.attributes)
    : null;
  if (!nestedAttributes) return undefined;

  return [nestedAttributes.url, nestedAttributes.uri, nestedAttributes.path].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
};

/**
 * @param {LeagueMatch | null | undefined} match
 * @param {Team | null | undefined} team
 * @returns {'a' | 'b' | null}
 */
const getLeagueMatchTeamSide = (match, team) => {
  const teamId = getEntityDocumentId(team);
  if (!match || !teamId) return null;
  if (areSameEntityId(getEntityDocumentId(match.team_a), teamId)) return 'a';
  if (areSameEntityId(getEntityDocumentId(match.team_b), teamId)) return 'b';
  return null;
};

/**
 * @param {LeagueMatch | null | undefined} match
 * @returns {string}
 */
const getLatestLeagueProposalMessageId = (match) => String(
  match?.proposalMessageId
    || match?.latestProposalMessageId
    || match?.automation_meta?.latest_proposal_message_id
    || match?.currentProposal?.messageId
    || '',
).trim();

/**
 * @param {LeagueMatch | null | undefined} match
 * @returns {'a' | 'b' | ''}
 */
const getLastLeagueProposalSide = (match) => {
  const side = String(match?.automation_meta?.last_proposal_by_side || '').trim().toLowerCase();
  return side === 'a' || side === 'b' ? side : '';
};

/**
 * @param {LeagueMatch | null | undefined} match
 * @returns {boolean}
 */
const hasPendingLeagueProposal = (match) => Boolean(
  getLatestLeagueProposalMessageId(match)
    || match?.proposed_time
    || match?.proposed_venue
    || match?.automation_meta?.last_proposal_at,
);

/**
 * @param {LeagueMatch | null | undefined} match
 * @param {Record<string, any> | null | undefined} payload
 * @returns {LeagueMatch | null}
 */
const withLeagueMatchActionMetadata = (match, payload) => {
  if (!match) return null;
  return {
    ...match,
    actionState: payload?.actionType || payload?.state || match?.actionState || null,
    proposalMessageId: payload?.proposalMessageId || match?.proposalMessageId || null,
  };
};

/**
 *
 */
function MatchCenterScreen() {
  const MATCH_CENTER_FOCUS_REFRESH_MIN_INTERVAL_MS = 120000;
  const swordsIcon = '\u2694\uFE0F';
  const radarIcon = '\uD83D\uDCE1';
  const navigation = /** @type {any} */ (useNavigation());
  const queryClient = useQueryClient();
  const route = /** @type {any} */ (useRoute());
  const { sceneBottomInset } = useBottomDockLayout();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const leaguePlatformRuntimeQuery = useLeaguePlatformRuntime();
  const leaguePlatformRuntime = leaguePlatformRuntimeQuery.data || null;
  const scrollBottomPadding = Math.max(sceneBottomInset, 80);

  /**
   * Keep shield initials consistent with Squad cards (TeamListContent).
   * @param {string | undefined | null} squadName
   * @returns {string}
   */
  const getSquadShieldInitials = useCallback((/** @type {string | undefined | null} */ squadName) => {
    const normalizedName = typeof squadName === 'string' ? squadName : '';
    const fromClubRules = getClubInitials(normalizedName);
    return fromClubRules || String(normalizedName || '??').substring(0, 2).toUpperCase();
  }, [getClubInitials]);

  /**
   * Resolve squad crest URL with backward-compatible fallbacks.
   * @param {Team | null | undefined} squad
   * @returns {string | undefined}
   */
  const getSquadLogoUri = useCallback((/** @type {Team | null | undefined} */ squad) => {
    const media = squad?.crest || squad?.logo || squad?.club?.logo;
    return getImageUrl(resolveMediaUrl(media));
  }, []);

  // Data State
  const [mySquad, setMySquad] = useState(/** @type {Team | null} */ (null));
  const [allSquads, setAllSquads] = useState(/** @type {Team[]} */ ([])); // Store all user squads
  const [viewState, setViewState] = useState(/** @type {MatchCenterViewState} */ ('loading')); // loading, no_squad, locker_room, lobby, radar, match_found, connection_error
  const [activeSlot, setActiveSlot] = useState(/** @type {LeagueSlot | null} */ (null));
  const [squadSlots, setSquadSlots] = useState(/** @type {LeagueSlot[]} */ ([])); // Store all available slots for carousel
  const [matchRequest, setMatchRequest] = useState(/** @type {MatchRequest | null} */ (null));
  const [softSuggestion, setSoftSuggestion] = useState(/** @type {Record<string, any> | null} */ (null));
  const [currentMatch, setCurrentMatch] = useState(/** @type {LeagueMatch | null} */ (null));
  const [opponentDetails, setOpponentDetails] = useState(/** @type {OpponentDetails | null} */ (null)); // Add state
  const [recentMatches, setRecentMatches] = useState(/** @type {MatchHistoryEntry[]} */ ([]));

  const slotCardGap = 12;
  const screenWidth = React.useRef(Dimensions.get('window').width).current;
  const [slotCarouselWidth, setSlotCarouselWidth] = useState(0);
  const slotCardWidth = React.useMemo(() => {
    if (slotCarouselWidth > 0) {
      // Keep one full "page" = card width + gap to avoid clipped content while swiping.
      return Math.max(slotCarouselWidth - slotCardGap, 220);
    }
    return Math.max(screenWidth - 88 - slotCardGap, 220);
  }, [screenWidth, slotCarouselWidth, slotCardGap]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSquadSelectorVisible, setIsSquadSelectorVisible] = useState(false);
  const [isProposalModalVisible, setIsProposalModalVisible] = useState(false);
  const [suggestionActionLoading, setSuggestionActionLoading] = useState(false);
  const currentMatchLegalLabel = React.useMemo(() => {
    const left = currentMatch?.team_a?.name || mySquad?.name || 'Votre squad';
    const right = currentMatch?.team_b?.name || opponentDetails?.name || 'Adversaire';
    return `${left} VS ${right}`;
  }, [currentMatch?.team_a?.name, currentMatch?.team_b?.name, mySquad?.name, opponentDetails?.name]);
  const venueRequired = React.useMemo(() => doesMatchRequireVenue(currentMatch), [currentMatch]);
  const proposalDurationMinutes = React.useMemo(
    () => getMatchDurationMinutes(currentMatch?.team_a?.sport || currentMatch?.team_b?.sport || mySquad?.sport),
    [currentMatch?.team_a?.sport, currentMatch?.team_b?.sport, mySquad?.sport],
  );

  // Search Config State
  const [searchRadius, setSearchRadius] = useState(20);
  const [tempSearchLocation, setTempSearchLocation] = useState(/** @type {SearchLocation | null} */ (null));
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState(/** @type {string[]} */ ([])); // IDs of slots to include in search
  const [isAddingSearchSlot, setIsAddingSearchSlot] = useState(false);
  const [isSavingSearchSlot, setIsSavingSearchSlot] = useState(false);
  const [matchmakingServerNow, setMatchmakingServerNow] = useState(/** @type {string | null} */ (null));
  const mySquadLogoUri = React.useMemo(() => getSquadLogoUri(mySquad), [getSquadLogoUri, mySquad]);
  const userId = React.useMemo(() => getEntityDocumentId(userData), [userData]);
  const mySquadId = React.useMemo(() => getEntityDocumentId(mySquad), [mySquad]);
  const squadRequiredPlayers = React.useMemo(() => getRequiredPlayersForSport(mySquad?.sport), [mySquad?.sport]);
  const isOpponentAnonymous = React.useMemo(() => shouldMaskOpponentIdentity(currentMatch), [currentMatch]);
  const opponentChatTitle = isOpponentAnonymous ? 'Vs Adversaire' : `Vs ${opponentDetails?.name || 'Adversaire'}`;
  const routeOpenProposalRequested = Boolean(route?.params?.openLeagueProposal);
  const routeOpenProposalToken = String(
    route?.params?.openLeagueProposalToken
      || route?.params?.forceLeagueActionPromptToken
      || '',
  );
  const routeOpenProposalMatchId = String(route?.params?.matchId || '');
  const routeActiveSquadId = String(
    route?.params?.activeSquadId
      || route?.params?.teamId
      || route?.params?.squadId
      || '',
  );
  const showLeagueRestrictionAlert = useCallback((/** @type {any} */ errorLike = null) => {
    const restrictionCode = getLeaguePlatformRestrictionCode(errorLike);
    const runtime = getLeagueRuntimeFromError(errorLike) || leaguePlatformRuntime;
    const scope = restrictionCode ? getLeagueRestrictionScope(errorLike) : 'matchmaking';
    const title = scope === 'platform'
      ? 'Found Club League fermée'
      : 'Recherche de match fermée';

    Alert.alert(title, getLeagueClosedMessage(runtime, scope));
  }, [leaguePlatformRuntime]);
  const ensureMatchmakingIsOpen = useCallback(() => {
    if (leaguePlatformRuntime?.effectiveMatchmakingIsOpen === false) {
      showLeagueRestrictionAlert({
        code: 'LEAGUE_MATCHMAKING_CLOSED',
        details: { runtime: leaguePlatformRuntime },
      });
      return false;
    }

    return true;
  }, [leaguePlatformRuntime, showLeagueRestrictionAlert]);
  const matchTeamSide = React.useMemo(
    () => getLeagueMatchTeamSide(currentMatch, mySquad),
    [currentMatch, mySquad],
  );
  const matchLastProposalSide = React.useMemo(
    () => getLastLeagueProposalSide(currentMatch),
    [currentMatch],
  );
  const matchHasPendingProposal = React.useMemo(
    () => hasPendingLeagueProposal(currentMatch),
    [currentMatch],
  );
  const matchProposalAction = React.useMemo(() => {
    const actionState = String(currentMatch?.actionState || currentMatch?.actionType || '').trim();

    if (!currentMatch || !matchHasPendingProposal) {
      return {
        helper: venueRequired
          ? 'Le match correspond \u00E0 vos crit\u00E8res. Envoyez une proposition de terrain et d\u2019horaire pour lancer la n\u00E9gociation.'
          : 'Le match correspond \u00E0 vos crit\u00E8res. Envoyez une proposition d horaire, avec un lieu si vous voulez le fixer tout de suite.',
        kind: 'create',
        title: 'ENVOYER UNE PROPOSITION',
      };
    }

    if (actionState === 'proposal_received' || (matchLastProposalSide && matchTeamSide && matchLastProposalSide !== matchTeamSide)) {
      return {
        helper: 'Une proposition adverse attend votre r\u00E9ponse. Ouvrez le chat pour accepter, refuser ou contre-proposer.',
        kind: 'reply',
        title: 'R\u00C9PONDRE',
      };
    }

    if (actionState === 'proposal_sent_waiting' || (matchLastProposalSide && matchTeamSide && matchLastProposalSide === matchTeamSide)) {
      return {
        helper: 'Votre proposition a \u00E9t\u00E9 envoy\u00E9e. Ouvrez la discussion pour suivre la r\u00E9ponse adverse.',
        kind: 'sent',
        title: 'VOIR LA PROPOSITION',
      };
    }

    return {
      helper: 'Une proposition est d\u00E9j\u00E0 ouverte. Ouvrez la n\u00E9gociation pour continuer.',
      kind: 'open',
      title: 'OUVRIR LA N\u00C9GOCIATION',
    };
  }, [currentMatch, matchHasPendingProposal, matchLastProposalSide, matchTeamSide, venueRequired]);

  // DAY_MAP for display
  /** @type {Record<string, string>} */
  const DAY_MAP = {
    friday: 'Vendredi', monday: 'Lundi', saturday: 'Samedi', sunday: 'Dimanche', thursday: 'Jeudi', tuesday: 'Mardi', wednesday: 'Mercredi',
  };

  const isCurrentUserCaptain = React.useMemo(
    () => isLeagueCaptain(mySquad, userData),
    [mySquad, userData],
  );
  const squadDocumentId = getEntityDocumentId(mySquad);

  /**
   * @param {string} routeName
   * @returns {any}
   */
  const findNavigatorWithRoute = useCallback((/** @type {string} */ routeName) => {
    let cursor = navigation;
    while (cursor) {
      const routeNames = cursor?.getState?.()?.routeNames || [];
      if (routeNames.includes(routeName)) return cursor;
      cursor = cursor?.getParent?.();
    }
    return null;
  }, [navigation]);

  /**
   * @param {string} routeName
   * @param {Record<string, any>} [params]
   * @returns {boolean}
   */
  const safeNavigate = useCallback((/** @type {string} */ routeName, /** @type {Record<string, any> | undefined} */ params) => {
    const targetNavigator = findNavigatorWithRoute(routeName);
    if (!targetNavigator) return false;
    targetNavigator.navigate(routeName, params);
    return true;
  }, [findNavigatorWithRoute]);

  const promptSquadSearchRequirements = useCallback(() => {
    Alert.alert(
      'Recherche reservee a la squad',
      'Vous devez etre membre de cette squad pour lancer une recherche manuelle. La recherche demarre aussi automatiquement quand le quorum est pret sur un creneau.',
      [
        {
          style: 'cancel',
          text: 'Compris',
        },
        {
          onPress: () => {
            const squadId = getEntityDocumentId(mySquad);
            if (safeNavigate(RouteNames.LeagueSquadTab)) return;
            if (squadId && safeNavigate(RouteNames.SquadDetails, { teamId: squadId })) return;
            safeNavigate(RouteNames.LeagueHomeTab, { screen: RouteNames.LeagueSquadTab });
          },
          text: 'Inviter des joueurs',
        },
      ],
    );
  }, [mySquad, safeNavigate]);

  /**
   * @param {Array<any>} items
   * @returns {string[]}
   */
  const toDocumentIdList = (items) => (
    (items || [])
      .map((item) => getEntityDocumentId(item))
      .filter((id) => typeof id === 'string' && id.length > 0)
  );

  // Normalized home base shape shared across all league screens.
  const homeBase = React.useMemo(
    () => normalizeLocationInput(mySquad?.home_base),
    [mySquad?.home_base],
  );

  // Initialize temp location from homeBase or User Location
  useEffect(() => {
    // console.log('[DEBUG] MatchCenter - Init Location', { homeBase, userLoc: userData?.location });
    if (!tempSearchLocation) {
      const normalizedHomeBase = normalizeLocationInput(homeBase);
      if (normalizedHomeBase && hasValidLocationCoordinates(normalizedHomeBase)) {
        setTempSearchLocation(normalizedHomeBase);
        return;
      }

      const normalizedUserLocation = normalizeLocationInput(userData?.location);
      if (normalizedUserLocation && hasValidLocationCoordinates(normalizedUserLocation)) {
        setTempSearchLocation(normalizedUserLocation);
      }
    }
  }, [homeBase, tempSearchLocation, userData]);

  // Initialize searchRadius from homeBase
  useEffect(() => {
    if (homeBase?.radius) {
      setSearchRadius(normalizeRadius(homeBase.radius, 20));
    }
  }, [homeBase]);

  const lastMatchRef = useRef(/** @type {LeagueMatch | null} */ (null));
  const cancellationLikeStatuses = React.useMemo(
    () => new Set(['negotiating', 'provisionary', 'scheduled']),
    [],
  );
  const shownInitialProposalMatchIdRef = useRef('');
  const consumedRouteOpenProposalTokenRef = useRef('');
  const lastMatchCenterFocusLoadAtRef = useRef(0);

  const shouldOpenInitialProposalModal = useCallback((/** @type {LeagueMatch | null | undefined} */ match) => {
    const normalizedStatus = String(match?.status || '').trim().toLowerCase();
    if (!['negotiating', 'provisional', 'provisionary'].includes(normalizedStatus)) return false;
    return !getLatestLeagueProposalMessageId(match)
      && !match?.proposed_time
      && !match?.proposed_venue
      && !match?.automation_meta?.last_proposal_at
      && !match?.automation_meta?.latest_proposal_message_id;
  }, []);

  const openInitialProposalModal = useCallback((/** @type {LeagueMatch | null | undefined} */ match) => {
    if (!shouldOpenInitialProposalModal(match)) return;
    const matchId = getEntityDocumentId(match);
    if (!matchId || shownInitialProposalMatchIdRef.current === matchId) return;
    shownInitialProposalMatchIdRef.current = matchId;
    setIsProposalModalVisible(true);
  }, [shouldOpenInitialProposalModal]);

  const fetchMatchData = useCallback(async (
    /** @type {Team} */ squad,
  ) => {
    setMySquad(squad);
    setLoading(true);
    try {
      try {
        const history = await getMatchHistory(getEntityDocumentId(squad), 5);
        setRecentMatches(Array.isArray(history) ? history : []);
      } catch (historyError) {
        console.error('Fetch match history error:', historyError);
        setRecentMatches([]);
      }

      // B. Check Active Matchmaking Request for THIS squad
      const activeReq = await MatchmakingService.getActiveRequest(getEntityDocumentId(squad));
      setMatchmakingServerNow(activeReq?.serverNow || null);
      const effectiveLegacyState = activeReq?.legacyState || activeReq?.state;

      // activeReq is { state: 'idle' | 'searching' | 'matched', request?, match? }
      if (activeReq && (effectiveLegacyState === 'searching' || effectiveLegacyState === 'matched')) {
        setMatchRequest(activeReq.request || null);
        setSoftSuggestion(activeReq.softSuggestion || null);
        if (effectiveLegacyState === 'matched') {
          const activeMatch = withLeagueMatchActionMetadata(activeReq.match || null, activeReq);
          setViewState('match_found');
          setCurrentMatch(activeMatch);
          setSoftSuggestion(null);
          setOpponentDetails(activeReq.opponentDetails || activeReq.opponent || null);
          lastMatchRef.current = activeMatch; // Track match
          openInitialProposalModal(activeMatch);
        } else {
          setViewState('radar');
          setCurrentMatch(null);
          // Match disappeared or switched to searching?
          if (lastMatchRef.current) {
            const previousStatus = String(lastMatchRef.current.status || '').toLowerCase();
            if (cancellationLikeStatuses.has(previousStatus)) {
              Alert.alert('Match annulé', 'Le match précédent a été annulé.');
            }
            lastMatchRef.current = null;
          }
        }
      } else {
        // No active request/match
        setMatchmakingServerNow(null);
        setSoftSuggestion(null);
        if (lastMatchRef.current) {
          // Only show cancellation if previous status was in cancellable pre-result phases.
          const previousStatus = String(lastMatchRef.current.status || '').toLowerCase();
          if (cancellationLikeStatuses.has(previousStatus)) {
            Alert.alert('Match annulé', "Votre match a été annulé par l'adversaire ou le système.");
          }
          lastMatchRef.current = null;
          setCurrentMatch(null);
        }

        // C. Check Next Available Slot
        const slots = await getAvailableSlots(getEntityDocumentId(squad));
        // Sort by participant count descending so the most filled slot shows first
        const sortedSlots = Array.isArray(slots) && slots.length > 0
          ? [...slots].sort((a, b) => (b.rsvp_count || 0) - (a.rsvp_count || 0))
          : (slots || []);
        setSquadSlots(sortedSlots);

        if (sortedSlots.length > 0) {
          setActiveSlot(sortedSlots[0]);
          setViewState('locker_room');
        } else {
          // No slots available
          setViewState('locker_room');
          setActiveSlot(null);
        }
      }
    } catch (error) {
      console.error('Fetch Match Data Error:', error);
      setLoadError('Impossible de synchroniser le Match Center League.');
      setViewState('connection_error');
    } finally {
      setLoading(false);
    }
  }, [cancellationLikeStatuses, openInitialProposalModal]);

  const loadMatchCenter = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError('');
    try {
      // A. Fetch User's LEAGUE Squads
      const context = await loadLeagueTeamContextWithCache(queryClient, userId);
      const squads = Array.isArray(context?.squads) ? context.squads : [];
      setAllSquads(squads);

      if (squads.length === 0) {
        setViewState('no_squad');
        setRecentMatches([]);
        setLoading(false);
        return;
      }

      // Select initial squad
      const matchedRouteSquad = routeActiveSquadId
        ? squads.find((/** @type {Team} */ s) => areSameEntityId(getEntityDocumentId(s), routeActiveSquadId))
        : null;
      const matchedCurrentSquad = mySquadId
        ? squads.find((/** @type {Team} */ s) => areSameEntityId(getEntityDocumentId(s), mySquadId))
        : null;
      const defaultSquad = context?.defaultSquadId
        ? squads.find((/** @type {Team} */ s) => areSameEntityId(getEntityDocumentId(s), context.defaultSquadId))
        : null;
      const initialSquad = matchedRouteSquad || matchedCurrentSquad || defaultSquad || squads[0];

      // Allow fetchMatchData to set mySquad and viewState
      await fetchMatchData(initialSquad);
    } catch (error) {
      console.error('Load Match Center Error:', error);
      Alert.alert('Erreur', 'Impossible de charger le Match Center');
      setLoadError('Impossible de charger le Match Center League.');
      setLoading(false);
    }
  }, [fetchMatchData, mySquadId, queryClient, routeActiveSquadId, userId]);

  /*
  const refreshMatchmakingStatus = useCallback(async () => {
    if (!mySquad || viewState === 'no_squad' || viewState === 'connection_error') return;

    try {
      const squadId = getEntityDocumentId(mySquad);
      const status = await MatchmakingService.getActiveRequest(squadId);

      if (status && status.state === 'searching') {
        const wasSearching = viewState === 'radar' || viewState === 'searching_start';
        if (!wasSearching) {
          Alert.alert(
            'Matchmaking lancé !',
            'Votre squad est complète. La recherche de match a démarré automatiquement.',
            [{ text: 'OK', onPress: () => setViewState('radar') }]
          );
        }
        setMatchRequest(status.request);
        setViewState('radar');
      } else if (viewState === 'radar' && status && status.state === 'matched') {
        // Handle match found transition if needed
        await fetchMatchData(mySquad);
      } else if (viewState === 'radar' && (!status || status.state === 'idle')) {
        // Search was cancelled or expired
        setViewState('locker_room');
      }
    } catch (error) {
      console.warn('[MATCHMAKING] Polling failed:', error);
    }
  }, [mySquad, viewState, fetchMatchData]);

  // 1. Polling for status updates
  useEffect(() => {
    const interval = setInterval(refreshMatchmakingStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshMatchmakingStatus]);
  */

  // 2. Load Squads & State on Focus
  useFocusEffect(
    useCallback(() => {
      const hasWarmMatchCenterState = Boolean(
        allSquads.length > 0
        || mySquad
        || activeSlot
        || currentMatch
        || matchRequest
        || loadError
        || viewState !== 'loading',
      );
      const hasPendingRouteSquadSwitch = Boolean(
        routeActiveSquadId
        && (!mySquadId || !areSameEntityId(routeActiveSquadId, mySquadId)),
      );
      const now = Date.now();
      if (
        !hasPendingRouteSquadSwitch
        && hasWarmMatchCenterState
        && now - lastMatchCenterFocusLoadAtRef.current < MATCH_CENTER_FOCUS_REFRESH_MIN_INTERVAL_MS
      ) {
        return undefined;
      }
      lastMatchCenterFocusLoadAtRef.current = now;
      loadMatchCenter();
      return undefined;
    }, [
      activeSlot,
      allSquads.length,
      currentMatch,
      loadError,
      loadMatchCenter,
      matchRequest,
      mySquad,
      mySquadId,
      routeActiveSquadId,
      viewState,
    ]),
  );

  const handleSquadSwitch = async (/** @type {Team} */ squad) => {
    setIsSquadSelectorVisible(false);
    const squadId = getEntityDocumentId(squad);
    if (!areSameEntityId(squadId, getEntityDocumentId(mySquad))) {
      navigation.setParams?.({
        activeSquadId: squadId,
        squadSwitchToken: String(Date.now()),
      });
      await fetchMatchData(squad);
    }
  };

  const handleLaunchLobby = () => {
    setViewState('lobby');
  };

  const handleConfirmSearch = async () => {
    if (!mySquad) return;
    if (!Array.isArray(selectedSlotIds) || selectedSlotIds.length === 0) {
      Alert.alert(
        'Créneau requis',
        'Sélectionnez au moins un créneau avant de lancer la recherche.',
      );
      return;
    }
    if (!ensureMatchmakingIsOpen()) {
      return;
    }

    // 1. Show Loading Screen immediately (closes modal)
    setViewState('searching_start');

    // 2. Artificial Delay for UX (let user appreciate the transition)
    setTimeout(async () => {
      try {
        const locationCandidates = [
          tempSearchLocation,
          mySquad?.home_base,
          mySquad?.address,
          userData?.location,
        ];

        const normalizedLocation = locationCandidates
          .map((candidate) => normalizeLocationInput(candidate))
          .find((current) => current && hasValidLocationCoordinates(current)) || null;

        if (!normalizedLocation) {
          Alert.alert(
            'Localisation requise',
            'Ajoutez une adresse de squad validée (coordonnées GPS) avant de lancer la recherche.',
          );
          setViewState('lobby');
          return;
        }

        const coordinates = getLocationCoordinates(normalizedLocation);
        if (!coordinates) {
          Alert.alert(
            'Localisation invalide',
            'Impossible de lire les coordonnées de votre localisation.',
          );
          setViewState('lobby');
          return;
        }

        const searchLocation = {
          address: normalizedLocation.address || normalizedLocation.label || null,
          city: normalizedLocation.city || null,
          label: normalizedLocation.label || normalizedLocation.address || null,
          lat: coordinates.lat,
          lng: coordinates.lng,
          postcode: normalizedLocation.postcode || null,
          value: `${coordinates.lng}|${coordinates.lat}`,
        };

        const params = {
          location: searchLocation,
          radius: normalizeRadius(searchRadius, normalizedLocation.radius || 20),
          selectedSlotIds, // Array of selected recurring slot IDs
          teamId: getEntityDocumentId(mySquad),
        };

        const result = await MatchmakingService.triggerSearch(params.teamId, params.selectedSlotIds, params);

        if (result && 'status' in result && result.status === 'matched') {
          const matchedResult = /** @type {any} */ (result);
          const matchedMatch = withLeagueMatchActionMetadata(matchedResult.match || null, matchedResult);
          setCurrentMatch(matchedMatch);
          setOpponentDetails(matchedResult.opponentDetails || matchedResult.opponent || null);
          setSoftSuggestion(null);
          openInitialProposalModal(matchedMatch);
          setViewState('match_found');
        } else {
          setMatchRequest(result);
          setSoftSuggestion(result?.softSuggestion || null);
          setMatchmakingServerNow(result?.serverNow || null);
          setViewState('radar');
        }
      } catch (error) {
        console.error(error);
        const apiError = /** @type {any} */ (error);
        const backendCode = apiError?.code;
        const backendMessage = apiError?.message;
        if (backendCode === 'SEARCH_ALREADY_ACTIVE') {
          Alert.alert('Recherche déjà active', 'Une recherche est déjà en cours pour cette squad.');
        } else if (backendCode === 'UNAUTHORIZED_TEAM_ACTION') {
          promptSquadSearchRequirements();
        } else if (isLeaguePlatformRestrictedError(apiError)) {
          showLeagueRestrictionAlert(apiError);
        } else {
          Alert.alert('Erreur', backendMessage || 'Recherche echouee');
        }
        setViewState('lobby'); // Go back to config on error
      }
    }, 2000); // 2 seconds delay
  };
  const handleAutoSearchingDetected = useCallback((/** @type {MatchmakingStatus} */ statusData) => {
    setMatchRequest(statusData?.request || null);
    setSoftSuggestion(statusData?.softSuggestion || null);
    setMatchmakingServerNow(statusData?.serverNow || null);
    setViewState('radar');
  }, []);

  const handleSearchingStatusSync = useCallback((/** @type {MatchmakingStatus} */ statusData) => {
    if (statusData?.request) {
      setMatchRequest(statusData.request);
    }
    setSoftSuggestion(statusData?.softSuggestion || null);
    if (statusData?.serverNow) {
      setMatchmakingServerNow(statusData.serverNow);
    }
  }, []);

  const handleConnectionError = useCallback(() => {
    setViewState('connection_error');
  }, []);

  const handleMatched = useCallback((/** @type {MatchmakingStatus} */ statusData, /** @type {{silent?: boolean}} */ options = {}) => {
    const nextMatch = withLeagueMatchActionMetadata(statusData?.match || null, statusData);
    const nextMatchId = getEntityDocumentId(nextMatch);
    const currentMatchId = getEntityDocumentId(currentMatch);
    const sameMatch = Boolean(nextMatchId && currentMatchId && areSameEntityId(nextMatchId, currentMatchId));
    const shouldAlert = !options?.silent && (!sameMatch || viewState !== 'match_found');
    setMatchRequest(statusData?.request || null);
    setMatchmakingServerNow(statusData?.serverNow || null);
    setCurrentMatch(nextMatch);
    setSoftSuggestion(null);
    setOpponentDetails(statusData?.opponentDetails || null);
    setViewState('match_found');
    if (shouldAlert) {
      openInitialProposalModal(nextMatch);
    }
  }, [currentMatch, openInitialProposalModal, viewState]);

  const handleSuggestionResponse = useCallback(async (/** @type {'accept' | 'decline'} */ decision) => {
    const suggestionId = getEntityDocumentId(softSuggestion);
    if (!suggestionId || suggestionActionLoading) return;

    setSuggestionActionLoading(true);
    try {
      const result = await MatchmakingService.respondSuggestion(suggestionId, decision);
      if (result?.state === 'matched' && result?.match) {
        const matchedMatch = withLeagueMatchActionMetadata(result.match, result);
        setCurrentMatch(matchedMatch);
        setMatchRequest(null);
        setSoftSuggestion(null);
        setOpponentDetails(result?.opponentDetails || null);
        setViewState('match_found');
        openInitialProposalModal(matchedMatch);
        return;
      }

      if (decision === 'decline') {
        setSoftSuggestion(null);
        Alert.alert('Piste ignoree', 'La recherche continue dans votre rayon.');
        return;
      }

      setSoftSuggestion(result?.suggestion || softSuggestion);
      Alert.alert('Piste acceptee', 'On attend l accord de la squad adverse. La recherche continue en parallele.');
    } catch (error) {
      console.error('Suggestion response error:', error);
      const apiError = /** @type {any} */ (error);
      const message = apiError?.response?.data?.error?.message
        || apiError?.message
        || 'Impossible de traiter cette piste. La recherche continue.';
      Alert.alert('Piste indisponible', message);
      setSoftSuggestion(null);
    } finally {
      setSuggestionActionLoading(false);
    }
  }, [openInitialProposalModal, softSuggestion, suggestionActionLoading]);

  const handleRecoverFromBackground = useCallback(() => {
    setViewState('radar');
  }, []);
  const isScreenActive = useIsFocused();

  const { searchStatus, serverNow: pollingServerNow } = useMatchmakingStateMachine({
    isScreenActive,
    matchRequest,
    mySquad,
    onAutoSearchingDetected: handleAutoSearchingDetected,
    onConnectionError: handleConnectionError,
    onMatched: handleMatched,
    onRecoverFromBackground: handleRecoverFromBackground,
    onSearchingStatus: handleSearchingStatusSync,
    viewState,
  });

  // Ensure searchRadius is initialized from squad preferences
  useEffect(() => {
    const normalized = normalizeLocationInput(mySquad?.home_base);
    if (normalized?.radius) {
      setSearchRadius(normalizeRadius(normalized.radius, 20));
    }
  }, [mySquad]);

  // Search is manual: no silent preselection of all slots.
  useEffect(() => {
    setSelectedSlotIds([]);
  }, [squadDocumentId]);

  useEffect(() => {
    const allowedIds = new Set(
      (squadSlots || [])
        .map((slot) => getEntityDocumentId(slot))
        .filter((id) => typeof id === 'string' && id.length > 0),
    );
    setSelectedSlotIds((prev) => prev.filter((slotId) => allowedIds.has(slotId)));
  }, [squadSlots]);

  useEffect(() => {
    if (viewState === 'radar' && !matchRequest?.createdAt) {
      console.warn('[MatchCenter] Missing request.createdAt while searching. Countdown fallback active.');
    }
  }, [matchRequest?.createdAt, viewState]);

  // Toggle slot selection for matchmaking
  const toggleSlotSelection = (/** @type {string} */ slotId) => {
    setSelectedSlotIds((prev) => (prev.includes(slotId)
      ? prev.filter((id) => id !== slotId)
      : [...prev, slotId]));
  };

  const handleAddSearchSlot = async (
    /** @type {AddSearchSlotPayload | AddSearchSlotPayload[]} */ slotInput,
  ) => {
    if (!mySquad || isSavingSearchSlot) return;

    let slotsToCreate = /** @type {AddSearchSlotPayload[]} */ ([]);
    if (Array.isArray(slotInput)) {
      slotsToCreate = slotInput.filter(Boolean);
    } else if (slotInput) {
      slotsToCreate = [slotInput];
    }

    if (slotsToCreate.length === 0) return;

    try {
      setIsSavingSearchSlot(true);
      const teamId = getEntityDocumentId(mySquad);
      const previousSlotIds = new Set(toDocumentIdList(squadSlots));

      await Promise.all(
        slotsToCreate.map((slotData) => {
          const payload = {
            end_hour: `${slotData.endTime}:00`,
            league_team: teamId,
            ...(slotData?.locationMode ? { location_mode: slotData.locationMode } : {}),
            recurrence_day: slotData.day,
            start_hour: `${slotData.startTime}:00`,
            status: 'open',
          };
          return createTeamSlot(payload);
        }),
      );

      const refreshedSlots = await getAvailableSlots(teamId);
      setSquadSlots(refreshedSlots || []);

      const newSlotIds = (refreshedSlots || [])
        .map((slot) => getEntityDocumentId(slot))
        .filter((slotId) => typeof slotId === 'string' && slotId.length > 0 && !previousSlotIds.has(slotId));

      if (newSlotIds.length > 0) {
        setSelectedSlotIds((prev) => Array.from(new Set([...newSlotIds, ...prev])));
      }

      setIsAddingSearchSlot(false);
      Alert.alert(
        'Succès',
        slotsToCreate.length > 1 ? `${slotsToCreate.length} créneaux ajoutés à la recherche.` : 'Créneau ajouté à la recherche.',
      );
    } catch (error) {
      console.error('Add search slot error:', error);
      Alert.alert('Erreur', "Impossible d'ajouter le créneau.");
    } finally {
      setIsSavingSearchSlot(false);
    }
  };

  const handleCancelSearch = async () => {
    if (!matchRequest) return;
    if (!isCurrentUserCaptain) {
      Alert.alert(
        'Action reservee',
        'Seul un capitaine ou co-capitaine peut arreter la recherche League.',
      );
      return;
    }
    setLoading(true);
    try {
      const reqId = getEntityDocumentId(matchRequest);
      if (!reqId) {
        throw new Error('Missing matchmaking request id');
      }
      await MatchmakingService.cancelRequest(reqId);
      setMatchRequest(null);
      setSoftSuggestion(null);
      setMatchmakingServerNow(null);
      // Refresh data to ensure consistent state
      await loadMatchCenter();
      setViewState('locker_room');
    } catch (error) {
      console.error('Cancel Error:', error);
      const cancelError = /** @type {any} */ (error);
      const isUnauthorized = cancelError?.code === 'UNAUTHORIZED_TEAM_ACTION'
        || cancelError?.status === 403;
      Alert.alert(
        isUnauthorized ? 'Action reservee' : 'Erreur',
        isUnauthorized
          ? 'Seul un capitaine ou co-capitaine peut arreter la recherche League.'
          : "Impossible d'annuler la recherche pour le moment.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendProposal = async (
    /** @type {VenueProposalPayload} */ proposalData,
    /** @type {{ legalAcceptance?: Record<string, unknown> } | undefined} */ options = undefined,
  ) => {
    if (!currentMatch) return;
    try {
      const matchId = getEntityDocumentId(currentMatch);
      if (!proposalData?.date) {
        throw new Error('Missing proposal date');
      }
      const proposalPayload = buildCanonicalLeagueProposalPayload(proposalData);
      if (venueRequired && !proposalPayload.venueLabel) {
        throw new Error('Missing proposal venue');
      }

      const legalAcceptance = options?.legalAcceptance || await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: currentMatchLegalLabel,
          teamName: mySquad?.name || null,
          ...(proposalPayload.venueLabel ? { venueLabel: proposalPayload.venueLabel } : {}),
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
        sourceScreen: 'match_center_proposal',
        targetDocumentId: matchId,
        targetLabel: currentMatchLegalLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setLoading(true);
      const result = await createLeagueProposal(matchId, proposalPayload, { legalAcceptance });

      const rawUpdatedMatch = result?.match || {
        ...currentMatch,
        proposed_time: proposalPayload.startAt,
        proposed_venue: proposalPayload.venueLabel || null,
        ...(proposalPayload.addressObject
          ? { location: { ...(currentMatch?.location || {}), ...proposalPayload.addressObject } }
          : {}),
      };
      const updatedMatch = withLeagueMatchActionMetadata(rawUpdatedMatch, {
        actionType: 'proposal_sent_waiting',
        proposalMessageId: result?.proposalMessageId,
      });
      setCurrentMatch(updatedMatch);
      setIsProposalModalVisible(false);

      const chatId = getEntityDocumentId(updatedMatch?.chat || currentMatch.chat);
      if (chatId) {
        navigation.navigate(RouteNames.Conversation, {
          chatId,
          subTitle: 'Match de Ligue',
          title: opponentChatTitle,
        });
        return;
      }

      navigation.navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'negotiation',
        matchId,
      });
    } catch (error) {
      const apiMessage = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || "Impossible d'envoyer la proposition.";
      console.error('Proposal Error:', {
        message: apiMessage,
        status: error?.response?.status,
      });
      Alert.alert('Erreur', apiMessage);
    } finally {
      setLoading(false);
    }
  };

  const openLeagueNegotiation = useCallback((/** @type {LeagueMatch | null | undefined} */ match, options = {}) => {
    if (!match) {
      Alert.alert('Erreur', "Le match n'est pas encore pr\u00EAt. R\u00E9essayez dans quelques secondes.");
      return;
    }

    const matchId = getEntityDocumentId(match);
    const chatId = getEntityDocumentId(match?.chat);
    const proposalMessageId = String(options?.proposalMessageId || getLatestLeagueProposalMessageId(match) || '').trim();

    if (chatId) {
      navigation.navigate(RouteNames.Conversation, {
        chatId,
        focusLatestProposal: Boolean(proposalMessageId),
        focusProposalMessageId: proposalMessageId || undefined,
        leagueNegotiationFocusToken: String(Date.now()),
        subTitle: 'N\u00E9gociation du match en cours',
        title: opponentChatTitle,
      });
      return;
    }

    navigation.navigate(RouteNames.LeagueMatchDetails, {
      focusProposalMessageId: proposalMessageId || undefined,
      focusSection: 'negotiation',
      matchId,
    });
  }, [navigation, opponentChatTitle]);

  const handleMatchFoundPrimaryAction = useCallback((/** @type {LeagueMatch | null | undefined} */ targetMatch = currentMatch) => {
    const match = targetMatch || currentMatch;
    if (!match) {
      Alert.alert('Erreur', "Le match n'est pas encore pr\u00EAt. R\u00E9essayez dans quelques secondes.");
      return;
    }

    if (!hasPendingLeagueProposal(match)) {
      setCurrentMatch(match);
      setIsProposalModalVisible(true);
      return;
    }

    openLeagueNegotiation(match, {
      proposalMessageId: getLatestLeagueProposalMessageId(match),
    });
  }, [currentMatch, openLeagueNegotiation]);

  useEffect(() => {
    if (!routeOpenProposalRequested) return;

    const requestKey = routeOpenProposalToken || routeOpenProposalMatchId || 'route-open-proposal';
    if (consumedRouteOpenProposalTokenRef.current === requestKey) return;
    if (!currentMatch) return;

    const currentMatchId = getEntityDocumentId(currentMatch);
    if (
      routeOpenProposalMatchId
      && currentMatchId
      && !areSameEntityId(routeOpenProposalMatchId, currentMatchId)
    ) {
      return;
    }

    if (!canOpenProposalRouteForMatch(currentMatch)) {
      return;
    }

    consumedRouteOpenProposalTokenRef.current = requestKey;
    navigation.setParams?.({
      openLeagueProposal: undefined,
      openLeagueProposalToken: undefined,
    });
    handleMatchFoundPrimaryAction(currentMatch);
  }, [
    currentMatch,
    handleMatchFoundPrimaryAction,
    navigation,
    routeOpenProposalMatchId,
    routeOpenProposalRequested,
    routeOpenProposalToken,
  ]);

  // --- RENDERERS ---

  const renderNoSquad = () => (
    <View style={{
      alignItems: 'center', flex: 1, justifyContent: 'center', marginTop: 60,
    }}
    >
      <LeagueCard style={{ alignItems: 'center', paddingVertical: 40, width: '100%' }}>
        <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8 }]}>Prêt À l&apos;ACTION ?</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
          Crée ton équipe pour rejoindre la compétition officielle.
        </Text>
        <Button
          icon="plus"
          iconColor={Colors.primary500}
          onPress={() => navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
          style={{
            backgroundColor: Colors.gold500,
            borderRadius: 30,
            elevation: 5,
            shadowColor: Colors.gold500,
            shadowOffset: { height: 4, width: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            width: '100%',
          }}
          textStyle={{ color: Colors.neutral900 }}
          title="Créer UNE SQUAD"
          variant="Primary"
        />
      </LeagueCard>
    </View>
  );

  const renderMatchCardContent = () => {
    const leagueGold = Colors.gold500 || '#D4AF37';
    const missionPanelStyle = {
      backgroundColor: 'rgba(6, 16, 26, 0.94)',
      borderColor: 'rgba(1, 179, 244, 0.24)',
      borderRadius: 22,
      borderWidth: 1,
      paddingHorizontal: 20,
      paddingVertical: 22,
      width: '100%',
    };
    const supportCardStyle = {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      width: '100%',
    };

    const renderMissionState = ({
      accentColor,
      actions,
      children,
      eyebrow,
      helper,
      renderIcon,
      subtitle,
      title,
    }) => (
      <View style={{ alignItems: 'center', paddingVertical: 10, width: '100%' }}>
        <View style={{
          alignItems: 'center',
          backgroundColor: `${accentColor}1A`,
          borderColor: `${accentColor}66`,
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          marginBottom: 18,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
        >
          <View style={{
            backgroundColor: accentColor,
            borderRadius: 4,
            height: 8,
            marginRight: 8,
            width: 8,
          }}
          />
          <Text style={[Fonts.p3Bold, { color: accentColor, letterSpacing: 1.2 }]}>{eyebrow}</Text>
        </View>

        <View style={missionPanelStyle}>
          <View style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: `${accentColor}88`,
            borderRadius: 42,
            borderWidth: 2,
            height: 84,
            justifyContent: 'center',
            marginBottom: 18,
            shadowColor: accentColor,
            shadowOffset: { height: 6, width: 0 },
            shadowOpacity: 0.22,
            shadowRadius: 14,
            width: 84,
          }}
          >
            {renderIcon?.()}
          </View>

          <Text style={[Fonts.p3Bold, {
            color: accentColor,
            letterSpacing: 1.4,
            marginBottom: 8,
            textAlign: 'center',
            textTransform: 'uppercase',
          }]}
          >
            {subtitle}
          </Text>

          <Text style={[Fonts.h2, {
            color: Colors.neutral00,
            marginBottom: 10,
            textAlign: 'center',
            textTransform: 'uppercase',
          }]}
          >
            {title}
          </Text>

          <Text style={[Fonts.p2, {
            color: Colors.primary500,
            lineHeight: 22,
            textAlign: 'center',
          }]}
          >
            {helper}
          </Text>

          {(children || actions) && (
            <View style={supportCardStyle}>
              {children}
              {actions ? <View style={{ marginTop: children ? 14 : 0 }}>{actions}</View> : null}
            </View>
          )}
        </View>
      </View>
    );

    const renderSoftSuggestionCard = () => {
      if (!softSuggestion) return null;

      const opponent = softSuggestion.opponent || {};
      const distanceKm = Number(softSuggestion.distanceKm);
      const extraDistanceKm = Number(softSuggestion.extraDistanceKm || 0);
      const eloDiff = Number(softSuggestion.eloDiff);
      const division = opponent?.division != null ? `D${opponent.division}` : 'Division inconnue';
      const statusForTeam = String(softSuggestion.statusForTeam || softSuggestion.status || '').trim();
      const acceptedByMe = Boolean(softSuggestion.acceptedByMe);
      const acceptedByOpponent = Boolean(softSuggestion.acceptedByOpponent);
      let statusLabel = 'Piste optionnelle disponible.';
      if (acceptedByMe && !acceptedByOpponent) {
        statusLabel = 'Vous avez accepte. En attente de l autre squad.';
      } else if (!acceptedByMe && acceptedByOpponent) {
        statusLabel = 'La squad adverse est partante.';
      }

      return (
        <View style={{
          backgroundColor: 'rgba(212, 175, 55, 0.10)',
          borderColor: 'rgba(212, 175, 55, 0.45)',
          borderRadius: 12,
          borderWidth: 1,
          marginTop: 14,
          padding: 14,
        }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginBottom: 6 }]}>
            PISTE OPTIONNELLE
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
            {opponent?.name || 'Squad compatible'}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300, lineHeight: 20 }]}>
            {Number.isFinite(distanceKm) ? `A ${Math.round(distanceKm)} km de vous` : 'Distance en verification'}
            {extraDistanceKm > 0 ? `, +${Math.round(extraDistanceKm)} km hors rayon` : ', dans votre zone'}
            {Number.isFinite(eloDiff) ? ` - ${eloDiff} pts ELO matchmaking d'ecart` : ''}
            {` - ${division}`}
          </Text>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500, marginTop: 8 }]}>
            {statusLabel}
          </Text>

          <View style={{ gap: 10, marginTop: 12 }}>
            <Button
              disabled={suggestionActionLoading || acceptedByMe || statusForTeam === 'waiting_opponent'}
              onPress={() => handleSuggestionResponse('accept')}
              title={acceptedByMe ? 'ACCEPTE - EN ATTENTE' : 'ACCEPTER CETTE PISTE'}
              variant="Primary"
            />
            <Button
              disabled={suggestionActionLoading || acceptedByMe}
              onPress={() => handleSuggestionResponse('decline')}
              title="CONTINUER DANS MON RAYON"
              variant="Secondary"
            />
          </View>
        </View>
      );
    };

    if (viewState === 'initializing') {
      return renderMissionState({
        accentColor: leagueGold,
        eyebrow: 'PROTOCOLE LEAGUE',
        helper: 'Lancement du protocole de match et synchronisation des signaux de la rencontre.',
        renderIcon: () => <ActivityIndicator color={leagueGold} size="large" />,
        subtitle: 'Mise en place',
        title: 'Initialisation',
      });
    }

    if (viewState === 'searching_start') {
      return renderMissionState({
        accentColor: Colors.primary500,
        eyebrow: 'SCAN MATCHMAKING',
        helper: 'Nous analysons votre zone, vos cr\u00E9neaux et les disponibilit\u00E9s compatibles.',
        renderIcon: () => <ActivityIndicator color={Colors.primary500} size="large" />,
        subtitle: 'Analyse reseau',
        title: 'Lancement du scan',
      });
    }

    if (viewState === 'connection_error') {
      return renderMissionState({
        accentColor: Colors.error500,
        actions: (
          <View>
            <Button
              onPress={() => {
                setViewState('radar');
              }}
              title="REESSAYER"
              variant="Primary"
            />
            <Button
              onPress={() => {
                setViewState('locker_room');
                setMatchRequest(null);
              }}
              style={{ marginTop: 12 }}
              title="ANNULER"
              variant="Secondary"
            />
          </View>
        ),
        eyebrow: 'ALERTE RESEAU',
        helper: 'La connexion au serveur League a ete interrompue. Vous pouvez relancer le scan ou revenir au vestiaire.',
        renderIcon: () => <Text style={{ color: Colors.error500, fontSize: 34, fontWeight: '700' }}>!</Text>,
        subtitle: 'Signal interrompu',
        title: 'Connexion perdue',
      });
    }

    if (viewState === 'radar') {
      return renderMissionState({
        accentColor: leagueGold,
        actions: isCurrentUserCaptain ? (
          <Button
            disabled={loading}
            onPress={handleCancelSearch}
            title="ANNULER"
            variant="Secondary"
          />
        ) : null,
        children: (
          <>
            <Text style={[Fonts.p3Bold, {
              color: Colors.neutral200,
              letterSpacing: 1.2,
              marginBottom: 10,
              textAlign: 'center',
            }]}
            >
              {searchStatus}
            </Text>
            {!isCurrentUserCaptain ? (
              <Text style={[Fonts.p3, {
                color: Colors.neutral300,
                lineHeight: 20,
                marginBottom: 12,
                textAlign: 'center',
              }]}
              >
                La recherche est geree par le capitaine de votre squad. Seul lui
                ou un co-capitaine peut l annuler.
              </Text>
            ) : null}
            <SearchCountdown
              createdAt={matchRequest?.createdAt}
              onExpired={handleCancelSearch}
              serverNow={pollingServerNow || matchmakingServerNow}
            />
            {renderSoftSuggestionCard()}
          </>
        ),
        eyebrow: 'RADAR ACTIF',
        helper: 'Nous cherchons une \u00E9quipe compatible dans votre zone et sur vos plages partag\u00E9es.',
        renderIcon: () => <Text style={{ color: leagueGold, fontSize: 28 }}>{radarIcon}</Text>,
        subtitle: 'Balayage en cours',
        title: 'Recherche active',
      });
    }

    if (viewState === 'radar') {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={[styles.radarCircle, {
            borderColor: Colors.gold500, borderRadius: 40, height: 80, marginBottom: 16, width: 80,
          }]}
          >
            <Text style={{ color: Colors.gold500, fontSize: 24 }}>{radarIcon}</Text>
          </View>
          <Text style={[Fonts.h3, { color: Colors.neutral00, marginBottom: 4 }]}>RECHERCHE EN COURS</Text>
          <Text style={[Fonts.p2, {
            color: Colors.gold500, fontWeight: 'bold', marginBottom: 8, textAlign: 'center',
          }]}
          >
            {searchStatus}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 16, textAlign: 'center' }]}>
            Nous cherchons une équipe compatible dans votre zone.
          </Text>

          {/* Timer Countdown */}
          <SearchCountdown
            createdAt={matchRequest?.createdAt}
            onExpired={handleCancelSearch}
            serverNow={pollingServerNow || matchmakingServerNow}
          />

          <Button
            disabled={loading}
            onPress={handleCancelSearch}
            title="ANNULER"
            variant="Secondary"
          />
        </View>
      );
    }

    if (viewState === 'match_found') {
      if (currentMatch && shouldShowNextMatchCard(currentMatch, currentMatch?.event)) {
        return (
          <NextMatchCard
            event={currentMatch?.event}
            match={currentMatch}
            myTeamId={getEntityDocumentId(mySquad)}
            onPress={() => navigateToLeagueMatchDetails(navigation, currentMatch)}
            onRefresh={loadMatchCenter}
          />
        );
      }

      /** @type {Record<string, string>} */
      const anonymousDayMap = {
        friday: 'Vendredi', monday: 'Lundi', saturday: 'Samedi', sunday: 'Dimanche', thursday: 'Jeudi', tuesday: 'Mardi', wednesday: 'Mercredi',
      };
      const formatAnonymousHour = (/** @type {string | undefined | null} */ value) => (value ? value.substring(0, 5) : '?');
      const parseAnonymousValue = (/** @type {unknown} */ value) => {
        if (value && typeof value === 'object') return value;
        if (typeof value !== 'string') return value;
        return safeJsonParse(value, value);
      };
      const cleanAnonymousLabel = (/** @type {unknown} */ value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.split('(')[0].trim();
      };
      const opponentHomeBase = parseAnonymousValue(opponentDetails?.home_base);
      const opponentLocation = parseAnonymousValue(opponentDetails?.location);
      const opponentHomeAddress = parseAnonymousValue(opponentHomeBase?.address);
      const opponentCityCandidates = [
        opponentHomeBase?.city,
        opponentHomeAddress?.city,
        opponentHomeAddress?.properties?.city,
        opponentHomeAddress?.properties?.context,
        opponentHomeAddress?.label,
        opponentHomeAddress?.address,
        opponentHomeBase?.label,
        opponentLocation?.city,
        opponentLocation?.label,
        opponentDetails?.city,
      ];
      const opponentCity = opponentCityCandidates
        .map((candidate) => cleanAnonymousLabel(candidate))
        .find(Boolean)
        || ((opponentHomeBase?.lat || opponentHomeBase?.lng || opponentLocation?.lat || opponentLocation?.lng)
          ? 'Zone approximative'
          : 'Zone inconnue');
      const radiusDisplay = (opponentDetails?.radius && opponentDetails.radius > 0)
        ? `+/- ${opponentDetails.radius} km`
        : 'Rayon standard';
      const parsedDivision = Number.parseInt(String(opponentDetails?.division), 10);
      const anonymousDivision = Number.isFinite(parsedDivision)
        ? Math.max(1, Math.min(5, parsedDivision))
        : '?';
      const recurringDayKey = String(opponentDetails?.recurring_day || currentMatch?.recurring_day || '').toLowerCase();
      const recurringDayLabel = anonymousDayMap[recurringDayKey] || recurringDayKey || '?';
      const recurringStart = formatAnonymousHour(opponentDetails?.recurring_start_hour || currentMatch?.recurring_start_hour);
      const recurringEnd = formatAnonymousHour(opponentDetails?.recurring_end_hour || currentMatch?.recurring_end_hour);
      const sportData = opponentDetails?.sport;
      const sportLabel = typeof sportData === 'string'
        ? sportData
        : sportData?.label || sportData?.name || 'Sport';
      const categoryData = opponentDetails?.category;
      const categoryLabel = typeof categoryData === 'string'
        ? categoryData
        : categoryData?.label || categoryData?.name || 'Senior';
      const matchCommonSlots = Array.isArray(currentMatch?.common_slots) ? currentMatch.common_slots : [];
      const commonSlotsSummary = matchCommonSlots
        .map((slot) => {
          const dayLabel = anonymousDayMap[String(slot?.day || '').toLowerCase()] || slot?.day || '';
          const startLabel = toHourMinute(slot?.startHour || slot?.start_hour) || '?';
          const endLabel = toHourMinute(slot?.endHour || slot?.end_hour) || '?';
          const myLocationModeLabel = getLocationModeLabel(
            matchTeamSide === 'a' ? slot?.teamALocationMode : slot?.teamBLocationMode,
          );
          const opponentLocationModeLabel = getLocationModeLabel(
            matchTeamSide === 'a' ? slot?.teamBLocationMode : slot?.teamALocationMode,
          );
          const locationModeSummary = !isOpponentAnonymous && (myLocationModeLabel || opponentLocationModeLabel)
            ? ` • Nous: ${myLocationModeLabel || '-'} / Eux: ${opponentLocationModeLabel || '-'}`
            : '';
          return dayLabel ? `${dayLabel} ${startLabel}-${endLabel}${locationModeSummary}` : null;
        })
        .filter(Boolean);

      return (
        <View style={{ alignItems: 'center', paddingVertical: 10, width: '100%' }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 16 }}>
            <View style={{
              alignItems: 'center',
              backgroundColor: `${Colors.primary500}1A`,
              borderColor: `${Colors.primary500}55`,
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              marginRight: 10,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
            >
              <View style={{
                backgroundColor: Colors.primary500,
                borderRadius: 4,
                height: 8,
                marginRight: 8,
                width: 8,
              }}
              />
              <Text style={[Fonts.p3Bold, { color: Colors.primary500, letterSpacing: 1.1 }]}>MATCH TROUVE</Text>
            </View>
            <View style={{
              backgroundColor: `${leagueGold}1A`,
              borderColor: `${leagueGold}55`,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
            >
              <Text style={[Fonts.p3Bold, { color: leagueGold, letterSpacing: 1.1 }]}>
                DIV
                {' '}
                {anonymousDivision}
              </Text>
            </View>
          </View>

          <View style={missionPanelStyle}>
            <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 18 }}>
              <View style={{
                alignItems: 'center',
                backgroundColor: `${leagueGold}14`,
                borderColor: `${leagueGold}80`,
                borderRadius: 44,
                borderWidth: 2,
                height: 88,
                justifyContent: 'center',
                marginRight: 16,
                shadowColor: leagueGold,
                shadowOffset: { height: 6, width: 0 },
                shadowOpacity: 0.18,
                shadowRadius: 14,
                width: 88,
              }}
              >
                {isOpponentAnonymous ? (
                  <Text style={{
                    color: Colors.neutral00,
                    fontSize: 36,
                    fontWeight: '700',
                    lineHeight: 40,
                  }}
                  >
                    ?
                  </Text>
                ) : (
                  <TeamShield
                    initials={getSquadShieldInitials(opponentDetails?.name || currentMatch?.team_b?.name)}
                    isGold
                    size={56}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p3Bold, {
                  color: leagueGold,
                  letterSpacing: 1.4,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }]}
                >
                  {swordsIcon}
                  {' '}
                  Duel confirmé
                </Text>
                <Text style={[Fonts.h2, {
                  color: Colors.neutral00,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }]}
                >
                  {isOpponentAnonymous ? 'Equipe adverse' : (opponentDetails?.name || currentMatch?.team_b?.name || 'Equipe adverse')}
                </Text>
                <Text style={[Fonts.p2, { color: Colors.primary500, marginBottom: 8 }]}>
                  {sportLabel}
                  {' - '}
                  {categoryLabel}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20 }]}>
                  {isOpponentAnonymous
                    ? 'Le profil reste masque tant que le premier contact n est pas engage dans le chat.'
                    : 'Pour le Football a 11, l identite adverse et les creneaux communs sont visibles des le match trouve.'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                borderWidth: 1,
                flex: 1,
                marginRight: 10,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}
              >
                <Image
                  resizeMode="contain"
                  source={LocationIcon}
                  style={{
                    height: 18,
                    marginBottom: 8,
                    tintColor: leagueGold,
                    width: 18,
                  }}
                />
                <Text style={[Fonts.p3Bold, {
                  color: Colors.neutral300,
                  letterSpacing: 1.1,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }]}
                >
                  Zone
                </Text>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>{opponentCity}</Text>
                <Text style={[Fonts.p3, { color: Colors.gold500 }]}>{radiusDisplay}</Text>
              </View>

              <View style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                borderWidth: 1,
                flex: 1,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}
              >
                <Image
                  resizeMode="contain"
                  source={ClockIcon}
                  style={{
                    height: 18,
                    marginBottom: 8,
                    tintColor: Colors.primary500,
                    width: 18,
                  }}
                />
                <Text style={[Fonts.p3Bold, {
                  color: Colors.neutral300,
                  letterSpacing: 1.1,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }]}
                >
                  Créneau phare
                </Text>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>{recurringDayLabel}</Text>
                <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                  {recurringStart}
                  {' - '}
                  {recurringEnd}
                </Text>
              </View>
            </View>

            {commonSlotsSummary.length > 0 && (
              <View style={supportCardStyle}>
                <Text style={[Fonts.p3Bold, {
                  color: Colors.neutral200,
                  letterSpacing: 1.2,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }]}
                >
                  Créneaux en commun
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                  {commonSlotsSummary.slice(0, 6).map((slotLabel) => (
                    <View
                      key={slotLabel}
                      style={{
                        backgroundColor: `${Colors.primary500}12`,
                        borderColor: `${Colors.primary500}38`,
                        borderRadius: 999,
                        borderWidth: 1,
                        marginBottom: 8,
                        marginHorizontal: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={[Fonts.p3, { color: Colors.gold500 }]}>{slotLabel}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{
              backgroundColor: `${leagueGold}12`,
              borderColor: `${leagueGold}2A`,
              borderRadius: 16,
              borderWidth: 1,
              marginTop: 16,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
            >
              <Text style={[Fonts.p3Bold, {
                color: leagueGold,
                letterSpacing: 1.2,
                marginBottom: 8,
                textTransform: 'uppercase',
              }]}
              >
                Prochaine etape
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral00, lineHeight: 22 }]}>
                {matchProposalAction.helper}
              </Text>
            </View>
          </View>

          <Button
            onPress={() => handleMatchFoundPrimaryAction(currentMatch)}
            style={{
              backgroundColor: leagueGold,
              marginTop: 18,
              shadowColor: leagueGold,
              shadowOpacity: 0.24,
              shadowRadius: 12,
              width: '100%',
            }}
            textStyle={{ color: Colors.neutral900, fontSize: 16, fontWeight: 'bold' }}
            title={matchProposalAction.title}
            variant="Primary"
          />

          {isCurrentUserCaptain && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Annuler le match ?',
                  '\u00CAtes-vous s\u00FBr de vouloir annuler ce match ? Votre \u00E9quipe reviendra en mode recherche.',
                  [
                    { style: 'cancel', text: 'Non' },
                    {
                      onPress: async () => {
                        try {
                          const currentMatchId = getEntityDocumentId(currentMatch);
                          if (currentMatchId) {
                            const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                            await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');

                            setViewState('searching_start');
                            setTimeout(async () => {
                              try {
                                const userLoc = userData?.location ? safeJsonParse(userData.location, { lat: 48.8566, lng: 2.3522 }) : { lat: 48.8566, lng: 2.3522 };
                                const fallbackSlotIds = (selectedSlotIds && selectedSlotIds.length > 0)
                                  ? selectedSlotIds
                                  : toDocumentIdList(squadSlots);
                                if (fallbackSlotIds.length === 0) {
                                  throw new Error('Ajoutez puis s\u00E9lectionnez au moins un cr\u00E9neau pour relancer la recherche.');
                                }
                                if (!ensureMatchmakingIsOpen()) {
                                  loadMatchCenter();
                                  return;
                                }
                                await MatchmakingService.triggerSearch(
                                  getEntityDocumentId(mySquad),
                                  fallbackSlotIds,
                                  { location: userLoc, radius: searchRadius },
                                );
                                loadMatchCenter();
                              } catch (error) {
                                console.error('Restart search failed', error);
                                if (isLeaguePlatformRestrictedError(error)) {
                                  showLeagueRestrictionAlert(error);
                                } else {
                                  Alert.alert('Erreur', 'Match annule mais impossible de relancer la recherche.');
                                }
                                loadMatchCenter();
                              }
                            }, 500);
                          }
                        } catch (error) {
                          console.error('Cancel/Restart error:', error);
                          Alert.alert('Erreur', "Impossible d'annuler le match.");
                        }
                      },
                      text: 'Annuler et relancer',
                    },
                    {
                      onPress: async () => {
                        try {
                          const currentMatchId = getEntityDocumentId(currentMatch);
                          if (currentMatchId) {
                            const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                            await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');
                            Alert.alert('Match annule', 'Vous pouvez relancer une recherche.');
                            loadMatchCenter();
                          }
                        } catch (error) {
                          console.error('Cancel match error:', error);
                          Alert.alert('Erreur', "Impossible d'annuler le match.");
                        }
                      },
                      style: 'destructive',
                      text: 'Annuler seulement',
                    },
                  ],
                );
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: `${Colors.error500}2E`,
                borderRadius: 14,
                borderWidth: 1,
                marginTop: 16,
                paddingVertical: 14,
                width: '100%',
              }}
            >
              <Text style={[Fonts.p2, {
                color: Colors.error500,
                textAlign: 'center',
                textTransform: 'uppercase',
              }]}
              >
                Annuler le match
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (viewState === 'match_found') {
      // CRITICAL FIX: If match is already scheduled/pending, Show NextMatchCard instead of Mystery Card
      if (currentMatch && shouldShowNextMatchCard(currentMatch, currentMatch?.event)) {
        return (
          <NextMatchCard
            event={currentMatch?.event}
            match={currentMatch}
            myTeamId={getEntityDocumentId(mySquad)}
            onPress={() => navigateToLeagueMatchDetails(navigation, currentMatch)}
            onRefresh={loadMatchCenter}
          />
        );
      }
      // Helpers for display
      const formatHour = (/** @type {string | undefined | null} */ h) => (h ? h.substring(0, 5) : '?');
      const cleanLabel = (/** @type {unknown} */ value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.split('(')[0].trim();
      };

      const parseMaybeJson = (/** @type {unknown} */ value) => {
        if (value && typeof value === 'object') return value;
        if (typeof value !== 'string') return value;
        return safeJsonParse(value, value);
      };

      const getOpponentCity = (/** @type {OpponentDetails | null} */ details) => {
        if (!details) return 'Zone inconnue';

        const opponentHomeBase = parseMaybeJson(details.home_base);
        const location = parseMaybeJson(details.location);
        const opponentHomeBaseAddress = parseMaybeJson(opponentHomeBase?.address);

        const candidates = [
          opponentHomeBase?.city,
          opponentHomeBaseAddress?.city,
          opponentHomeBaseAddress?.properties?.city,
          opponentHomeBaseAddress?.properties?.context,
          opponentHomeBaseAddress?.label,
          opponentHomeBaseAddress?.address,
          opponentHomeBase?.label,
          location?.city,
          location?.label,
          details?.city,
        ];

        const cleanedCandidate = candidates.map(cleanLabel).find(Boolean);
        if (cleanedCandidate) return cleanedCandidate;

        if (opponentHomeBase?.lat || opponentHomeBase?.lng || location?.lat || location?.lng) {
          return 'Zone approximative';
        }

        return 'Zone inconnue';
      };

      const city = getOpponentCity(opponentDetails);
      const radiusDisplay = (opponentDetails?.radius && opponentDetails.radius > 0) ? `+/- ${opponentDetails.radius} km` : 'Rayon Standard';
      const parsedDivision = Number.parseInt(String(opponentDetails?.division), 10);
      const division = Number.isFinite(parsedDivision)
        ? Math.max(1, Math.min(5, parsedDivision))
        : '?';
      // Recurring slot display
      const recurringDayKey = String(opponentDetails?.recurring_day || currentMatch?.recurring_day || '').toLowerCase();
      const recurringDay = DAY_MAP[recurringDayKey] || recurringDayKey || '?';
      const recurringStart = formatHour(opponentDetails?.recurring_start_hour || currentMatch?.recurring_start_hour);
      const recurringEnd = formatHour(opponentDetails?.recurring_end_hour || currentMatch?.recurring_end_hour);
      // Sport/Category handling (Relation objects or strings)
      const sportData = opponentDetails?.sport;
      const sportLabel = typeof sportData === 'string'
        ? sportData
        : sportData?.label || sportData?.name || 'Sport';
      const categoryData = opponentDetails?.category;
      const catLabel = typeof categoryData === 'string'
        ? categoryData
        : categoryData?.label || categoryData?.name || 'Senior';
      const matchCommonSlots = currentMatch?.common_slots;
      const allCommonSlots = Array.isArray(matchCommonSlots) ? matchCommonSlots : [];
      /** @type {string[]} */
      const commonSlotsSummary = [];
      (allCommonSlots || []).forEach((/** @type {LeagueSlot} */ slot) => {
        const dayLabel = DAY_MAP[String(slot?.day || '').toLowerCase()] || slot?.day || '';
        const startLabel = toHourMinute(slot?.startHour || slot?.start_hour) || '?';
        const endLabel = toHourMinute(slot?.endHour || slot?.end_hour) || '?';
        if (!dayLabel) return;
        const myLocationModeLabel = getLocationModeLabel(
          matchTeamSide === 'a' ? slot?.teamALocationMode : slot?.teamBLocationMode,
        );
        const opponentLocationModeLabel = getLocationModeLabel(
          matchTeamSide === 'a' ? slot?.teamBLocationMode : slot?.teamALocationMode,
        );
        const locationModeSummary = !isOpponentAnonymous && (myLocationModeLabel || opponentLocationModeLabel)
          ? ` • Nous: ${myLocationModeLabel || '-'} / Eux: ${opponentLocationModeLabel || '-'}`
          : '';
        commonSlotsSummary.push(`${dayLabel} ${startLabel}-${endLabel}${locationModeSummary}`);
      });

      console.log('[DEBUG] MatchCenter Opponent Détails:', JSON.stringify(opponentDetails, null, 2));

      return (
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          {/* ANONYMOUS HEADER */}
          <Text style={[Fonts.h3, {
            color: Colors.neutral200, letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase',
          }]}
          >
            {isOpponentAnonymous ? 'ADVERSAIRE MYSTERE' : (opponentDetails?.name || 'ADVERSAIRE')}
          </Text>

          {/* MAIN CARD */}
          <View style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: Colors.gold500,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 24,
            padding: 24,
            shadowColor: Colors.gold500,
            shadowOffset: { height: 6, width: 0 },
            shadowOpacity: 0.12,
            shadowRadius: 14,
            width: '100%',
          }}
          >
            {/* Generic Identity */}
            <View style={{ marginBottom: 16 }}>
              <View style={{
                alignItems: 'center',
                backgroundColor: 'rgba(255, 215, 0, 0.10)',
                borderColor: Colors.gold500,
                borderRadius: 40,
                borderWidth: 2,
                height: 80,
                justifyContent: 'center',
                marginBottom: 12,
                shadowColor: Colors.gold500,
                shadowOffset: { height: 4, width: 0 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                width: 80,
              }}
              >
                {isOpponentAnonymous ? (
                  <Text style={{
                    color: Colors.neutral00, fontSize: 36, fontWeight: '700', lineHeight: 42,
                  }}
                  >
                    ?
                  </Text>
                ) : (
                  <TeamShield
                    initials={getSquadShieldInitials(opponentDetails?.name || currentMatch?.team_b?.name)}
                    isGold
                    size={52}
                  />
                )}
              </View>
              <View style={{
                backgroundColor: 'rgba(255, 209, 0, 0.10)',
                borderColor: Colors.gold500,
                borderRadius: 999,
                borderWidth: 1,
                bottom: 6,
                paddingHorizontal: 10,
                paddingVertical: 2,
                position: 'absolute',
                right: -8,
              }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                  DIV
                  {division}
                </Text>
              </View>
            </View>

            {/* Stats / Context */}
            <View style={{ alignItems: 'center', width: '100%' }}>
              <Text style={{ color: Colors.gold500, fontSize: 18, marginBottom: 2 }}>
                {swordsIcon}
              </Text>
              <Text style={[Fonts.h2, { color: 'white', marginBottom: 4 }]}>
                {isOpponentAnonymous ? 'Equipe adverse' : (opponentDetails?.name || currentMatch?.team_b?.name || 'Equipe adverse')}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 16 }]}>
                {sportLabel}
                {' '}
                -
                {' '}
                {catLabel}
              </Text>

              <View style={{
                backgroundColor: Colors.neutral700, height: 1, marginBottom: 16, width: '100%',
              }}
              />

              {/* Details Grid */}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, width: '100%',
              }}
              >
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Image
                    resizeMode="contain"
                    source={LocationIcon}
                    style={{
                      height: 24, marginBottom: 4, tintColor: Colors.gold500, width: 24,
                    }}
                  />
                  <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                    {city}
                  </Text>
                  <Text style={[Fonts.p3, { color: Colors.gold500 }]}>{radiusDisplay}</Text>
                </View>
                <View style={{ backgroundColor: Colors.neutral700, height: '100%', width: 1 }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Image
                    resizeMode="contain"
                    source={ClockIcon}
                    style={{
                      height: 20, marginBottom: 4, tintColor: Colors.primary500, width: 20,
                    }}
                  />
                  <Text style={[Fonts.p2Bold, { color: 'white' }]}>
                    {/* Translate Day */}
                    {(() => {
                      /** @type {Record<string, string>} */
                      const dayMap = {
                        friday: 'Vendredi', monday: 'Lundi', saturday: 'Samedi', sunday: 'Dimanche', thursday: 'Jeudi', tuesday: 'Mardi', wednesday: 'Mercredi',
                      };
                      const rDay = String(recurringDay || '').toLowerCase();
                      return dayMap[rDay] || rDay || 'Date Inconnue';
                    })()}
                  </Text>
                  <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                    {recurringStart}
                    {' '}
                    -
                    {' '}
                    {recurringEnd}
                  </Text>
                </View>
              </View>
            </View>

            {/* Common Slots Negotiation Text */}
            {commonSlotsSummary.length > 0 && (
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderColor: 'rgba(255,255,255,0.10)',
              borderRadius: 8,
              borderWidth: 1,
              marginTop: 12,
              padding: 10,
              width: '100%',
            }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginBottom: 8 }]}>
                Créneaux en commun
              </Text>
              {commonSlotsSummary.map((/** @type {string} */ slotLabel) => (
                <Text key={slotLabel} style={[Fonts.p3, { color: Colors.gold500, marginBottom: 4 }]}>
                  -
                  {' '}
                  {slotLabel}
                </Text>
              ))}
            </View>
            )}
          </View>

          <Text style={[Fonts.p2, {
            color: Colors.neutral300, marginBottom: 28, paddingHorizontal: 10, textAlign: 'center',
          }]}
          >
            {matchProposalAction.helper}
          </Text>

          <Button
            onPress={() => handleMatchFoundPrimaryAction(currentMatch)}
            style={{ backgroundColor: Colors.gold500, width: '100%' }}
            textStyle={{ color: Colors.neutral900, fontSize: 16, fontWeight: 'bold' }}
            title={matchProposalAction.title}
            variant="Primary"
          />

          {/* Cancel Button - Captain Only */}
          {isCurrentUserCaptain && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Annuler le match ?',
                'Êtes-vous sûr de vouloir annuler ce match ? Votre équipe reviendra en mode recherche.',
                [
                  { style: 'cancel', text: 'Non' },
                  {
                    onPress: async () => {
                      try {
                        const currentMatchId = getEntityDocumentId(currentMatch);
                        if (currentMatchId) {
                          const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                          await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');

                          // Trigger new search immediately
                          setViewState('searching_start');
                          setTimeout(async () => {
                            try {
                              // Re-use current params if available or re-trigger logic
                              // Ideally we call handleConfirmSearch logic but access is tricky.
                              // Simpler: Trigger search with current params from squad
                              const userLoc = userData?.location ? safeJsonParse(userData.location, { lat: 48.8566, lng: 2.3522 }) : { lat: 48.8566, lng: 2.3522 };
                              const fallbackSlotIds = (selectedSlotIds && selectedSlotIds.length > 0)
                                ? selectedSlotIds
                                : toDocumentIdList(squadSlots);
                              if (fallbackSlotIds.length === 0) {
                                throw new Error('Ajoutez puis sélectionnez au moins un créneau pour relancer la recherche.');
                              }
                              if (!ensureMatchmakingIsOpen()) {
                                loadMatchCenter();
                                return;
                              }
                              await MatchmakingService.triggerSearch(
                                getEntityDocumentId(mySquad),
                                fallbackSlotIds,
                                { location: userLoc, radius: searchRadius },
                              );
                              loadMatchCenter(); // Refresh state to show searching
                            } catch (e) {
                              console.error('Restart search failed', e);
                              if (isLeaguePlatformRestrictedError(e)) {
                                showLeagueRestrictionAlert(e);
                              } else {
                                Alert.alert('Erreur', 'Match annulé mais impossible de relancer la recherche.');
                              }
                              loadMatchCenter();
                            }
                          }, 500);
                        }
                      } catch (err) {
                        console.error('Cancel/Restart error:', err);
                        Alert.alert('Erreur', "Impossible d'annuler le match.");
                      }
                    },
                    text: 'Annuler et Relancer',
                  },
                  {
                    onPress: async () => {
                      try {
                        const currentMatchId = getEntityDocumentId(currentMatch);
                        if (currentMatchId) {
                          const { cancelMatch } = await import('../../../services/league/leagueMatchService');
                          await cancelMatch(currentMatchId, getEntityDocumentId(mySquad), 'captain_request');
                          Alert.alert('Match annulé', 'Vous pouvez relancer une recherche.');
                          loadMatchCenter();
                        }
                      } catch (err) {
                        console.error('Cancel match error:', err);
                        Alert.alert('Erreur', "Impossible d'annuler le match.");
                      }
                    },
                    style: 'destructive',
                    text: 'Annuler seulement',
                  },
                ],
              );
            }}
            style={{ marginTop: 16, paddingVertical: 12 }}
          >
            <Text style={[Fonts.p2, { color: Colors.error500, textAlign: 'center' }]}>
              Annuler le match
            </Text>
          </TouchableOpacity>
          )}
        </View>
      );
    }

    // If Match Scheduled / Validated
    if (currentMatch && shouldShowNextMatchCard(currentMatch, currentMatch?.event)) {
      // Navigate to standalone LeagueMatchDetails (no event dependency)
      return (
        <NextMatchCard
          event={currentMatch?.event}
          match={currentMatch}
          myTeamId={getEntityDocumentId(mySquad)}
          onPress={() => navigateToLeagueMatchDetails(navigation, currentMatch)}
          onRefresh={loadMatchCenter}
        />
      );
    }

    // DEFAULT: Locker Room / Ticket View
    /** @type {LeagueSlot[]} */
    let displayedSlots = squadSlots;
    if (displayedSlots.length === 0 && activeSlot) {
      displayedSlots = [activeSlot];
    }

    return (
      <View>
        {/* Carousel of Slots */}
        <View
          onLayout={(/** @type {import('react-native').LayoutChangeEvent} */ event) => {
            const nextWidth = event?.nativeEvent?.layout?.width || 0;
            if (nextWidth > 0 && Math.abs(nextWidth - slotCarouselWidth) > 1) {
              setSlotCarouselWidth(nextWidth);
            }
          }}
        >
          <FlatList
            bounces={false}
            contentContainerStyle={
                            !displayedSlots.length
                              ? {}
                              : { paddingLeft: 0, paddingRight: slotCardGap }
                        }
            data={displayedSlots}
            decelerationRate="fast"
            disableIntervalMomentum
            horizontal
            keyExtractor={(item) => getEntityDocumentId(item) || [
              item?.recurrence_day || item?.day || 'slot',
              item?.start_hour || item?.start_time || item?.date || 'start',
              item?.end_hour || item?.endHour || 'end',
            ].join('-')}
            ListEmptyComponent={(
              <View style={{ width: slotCardWidth }}>
                <View>
                  <Text style={[Fonts.h2, { color: Colors.neutral500 }]}>Pas de match</Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>Aucun créneau réservé</Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral500 }]}>
                    VIDE
                  </Text>
                </View>
              </View>
                          )}
            onMomentumScrollEnd={(/** @type {import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>} */ e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (slotCardWidth + slotCardGap));
              if (displayedSlots[index]) {
                setActiveSlot(displayedSlots[index]);
              }
            }}
            overScrollMode="never"
            pagingEnabled={false}
            renderItem={({ index, item }) => {
              if (!item) return null;
              const isLast = index === displayedSlots.length - 1;
              const isSlotFull = (item.rsvp_count || 0) >= squadRequiredPlayers;
              const baseDate = item.start_time || item.date || '';
              const recurringStart = item.start_hour ? item.start_hour.substring(0, 5) : null;
              const recurringEnd = item.end_hour ? item.end_hour.substring(0, 5) : null;
              const fallbackStart = baseDate
                ? new Date(baseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '?';
              const fallbackEnd = baseDate
                ? new Date(new Date(baseDate).getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '?';
              const rangeLabel = recurringStart && recurringEnd
                ? `${recurringStart} - ${recurringEnd}`
                : `${fallbackStart} - ${fallbackEnd}`;
              const recurrenceKey = String(item.recurrence_day || '').toLowerCase();
              let dayLabel = 'Date';
              if (recurrenceKey) {
                dayLabel = DAY_MAP[recurrenceKey] || recurrenceKey;
              } else if (baseDate) {
                [dayLabel] = formatDate(baseDate).split(' ');
              }

              return (
                <View style={{ marginRight: isLast ? 0 : slotCardGap, width: slotCardWidth }}>
                  <View style={{ marginBottom: 8 }}>
                    <View>
                      <Text style={[Fonts.h2, { color: Colors.neutral00, textTransform: 'uppercase' }]}>
                        {dayLabel}
                      </Text>
                      <Text style={[Fonts.p1, { color: Colors.gold500, marginTop: 2 }]}>
                        {rangeLabel}
                      </Text>
                    </View>
                  </View>
                  {/* Status Chip */}
                  <View
                    style={{
                      backgroundColor: isSlotFull ? 'rgba(76, 175, 80, 0.15)' : 'rgba(1, 179, 244, 0.1)',
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      position: 'absolute',
                      right: 10,
                      top: 0,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, { color: isSlotFull ? '#4CAF50' : Colors.primary500 }]}>
                      {isSlotFull ? 'COMPLET' : 'OUVERT'}
                    </Text>
                  </View>

                  {/* Visual Roster */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
                      EFFECTIF
                      {' '}
                      <Text style={{ color: Colors.gold500 }}>
                        {item.rsvp_count || 0}
                        /
                        {squadRequiredPlayers}
                      </Text>
                    </Text>
                    <VisualRoster
                      Colors={Colors}
                      Images={Images}
                      rsvpCount={item.rsvp_count || 0}
                      total={squadRequiredPlayers}
                    />
                  </View>

                  {/* Navigation Indicators (Dots) */}
                  {squadSlots.length > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
                    {squadSlots.map((slot, dotIndex) => {
                      const dotKey = getEntityDocumentId(slot) || [
                        slot?.recurrence_day || slot?.day || 'slot',
                        slot?.start_hour || slot?.start_time || slot?.date || 'start',
                        slot?.end_hour || slot?.endHour || 'end',
                      ].join('-');
                      return (
                        <View
                          key={`dot-${dotKey}`}
                          style={{
                            backgroundColor: dotIndex === index ? Colors.gold500 : Colors.neutral700,
                            borderRadius: 3,
                            height: 6,
                            marginHorizontal: 4,
                            width: 6,
                          }}
                        />
                      );
                    })}
                  </View>
                  )}
                </View>
              );
            }}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={slotCardWidth + slotCardGap}
          />
        </View>

        <View style={{ backgroundColor: Colors.neutral800, height: 1, marginVertical: 16 }} />

        {/* Actions */}
        {activeSlot ? (
          <View>
            {(activeSlot.rsvp_count || 0) >= squadRequiredPlayers ? (
              <View>
                <Text style={[Fonts.p2, { color: Colors.success500 || '#27d6a3', marginBottom: 12, textAlign: 'center' }]}>
                  Équipe complete
                </Text>
                <Button
                  onPress={handleLaunchLobby}
                  style={{
                    backgroundColor: Colors.gold500, elevation: 5, shadowColor: Colors.gold500, shadowOpacity: 0.4, shadowRadius: 10,
                  }}
                  textStyle={{ color: Colors.neutral900, fontSize: 13, fontWeight: 'bold' }}
                  title="RECHERCHER UN MATCH"
                />
              </View>
            ) : (
              <View>
                <Text style={[Fonts.p2, { color: Colors.neutral00, marginBottom: 12 }]}>
                  Il manque
                  {' '}
                  <Text style={{ color: Colors.gold500 }}>{5 - (activeSlot.rsvp_count || 0)}</Text>
                  {' '}
                  joueurs pour être au complet.
                </Text>
                <Button
                  onPress={() => navigation.navigate(RouteNames.LeagueSquadTab)}
                  style={{
                    backgroundColor: Colors.neutral800, borderColor: Colors.primary500, borderWidth: 1, marginBottom: 12,
                  }}
                  textStyle={{ color: Colors.primary500 }}
                  title="INVITER DES JOUEURS"
                  variant="Primary"
                />
                <Button
                  onPress={handleLaunchLobby}
                  style={{ backgroundColor: Colors.gold500, borderColor: Colors.gold500, marginTop: 8 }}
                  textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                  title="LANCER LA RECHERCHE"
                  variant="Primary"
                />
              </View>
            )}
          </View>
        ) : (
          <Button
            onPress={handleLaunchLobby}
            style={{ backgroundColor: Colors.gold500 }}
            textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
            title="RECHERCHER UN MATCH"
            variant="Primary"
          />
        )}
      </View>
    );
  };

  const renderLockerRoom = () => {
    const rawStreak = Number(mySquad?.streak || 0);
    let streakValue = '0';
    if (Number.isFinite(rawStreak) && rawStreak > 0) {
      streakValue = `x${rawStreak}`;
    } else if (Number.isFinite(rawStreak) && rawStreak < 0) {
      streakValue = 'DEFAITE';
    }
    const divisionPoints = Number(mySquad?.division_points ?? mySquad?.divisionPoints ?? 0);
    const highestStreak = Number(mySquad?.highest_streak ?? mySquad?.highestStreak ?? 0);
    const divisionProgress = getDivisionProgressState(divisionPoints, mySquad?.division);
    const nextStreakBonus = rawStreak > 0 ? getNextStreakBonus(rawStreak) : 0;
    let streakHelper = 'Prochaine victoire: +20 pts';
    if (rawStreak > 0) {
      streakHelper = `Prochain bonus: +${nextStreakBonus}`;
    } else if (rawStreak < 0) {
      streakHelper = 'Dernier resultat: defaite';
    }
    const promotionHelper = divisionProgress.maxDivisionReached
      ? 'Division 1 prestige'
      : `${Math.round(divisionProgress.pointsToPromotion)} pts avant promotion`;
    const showEmptyHistoryCta = !currentMatch && viewState !== 'radar' && viewState !== 'searching_start';
    const leagueSurface = {
      backgroundColor: 'rgba(10, 28, 43, 0.82)',
      borderColor: 'rgba(1, 179, 244, 0.22)',
    };
    let nextMatchSectionTitle = 'PROCHAIN MATCH';
    if (viewState === 'radar') {
      nextMatchSectionTitle = 'RECHERCHE...';
    } else if (viewState === 'match_found') {
      nextMatchSectionTitle = 'ACTION REQUISE';
    }

    return (
      <View style={styles.container}>

        {/* 1. IDENTITY HEADER - NOW WITH SWITCHER */}
        <View style={{
          alignItems: 'center', flexDirection: 'row', marginBottom: 32, marginTop: 16,
        }}
        >
          <View style={{
            alignItems: 'center',
            backgroundColor: Colors.neutral800,
            borderColor: Colors.gold500,
            borderRadius: 32,
            borderWidth: 2,
            height: 64,
            justifyContent: 'center',
            marginRight: 16,
            overflow: 'hidden',
            width: 64,
          }}
          >
            {mySquadLogoUri ? (
              <Image
                resizeMode="cover"
                source={{ uri: mySquadLogoUri }}
                style={{ borderRadius: 29, height: 58, width: 58 }}
              />
            ) : (
              <TeamShield
                initials={getSquadShieldInitials(mySquad?.name)}
                isGold
                size={54}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                numberOfLines={1}
                style={[Fonts.h1Bold, {
                  color: Colors.neutral00, flexShrink: 1, lineHeight: 32, marginRight: 12, textTransform: 'uppercase',
                }]}
              >
                {mySquad ? mySquad.name : 'Team Alpha'}
              </Text>
              <TouchableOpacity
                accessibilityHint="Ouvre la liste des squads"
                accessibilityLabel="Squad"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => setIsSquadSelectorVisible(true)}
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.58)',
                  borderRadius: 999,
                  borderWidth: 1,
                  flexDirection: 'row',
                  minHeight: 34,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.primary500, marginRight: 6 }]}>Squad</Text>
                <Image
                  source={Images.chevronDown}
                  style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
                />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', flexDirection: 'row', marginTop: 4 }}>
              <View style={{ marginRight: 8 }}>
                <DivisionBadge
                  division={mySquad?.division || 5}
                  showChrome={false}
                  showLabel={false}
                  size={34}
                />
              </View>
              <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[Fonts.p3Bold, { color: Colors.gold500, flexShrink: 1 }]}>
                {mySquad?.elo || 1200}
                {' '}
                ELO matchmaking
              </Text>
            </View>
          </View>
        </View>

        <SectionHeader title={nextMatchSectionTitle} />

        {shouldShowNextMatchCard(currentMatch, currentMatch?.event) ? (
          <View style={{ marginBottom: 26, marginTop: 8 }}>
            {renderMatchCardContent()}
          </View>
        ) : (
          <LeagueCard
            style={{
              marginBottom: 26,
              marginTop: 8,
              overflow: 'hidden',
              padding: 0,
              ...leagueSurface,
            }}
          >
            <View style={{ padding: 20 }}>
              {renderMatchCardContent()}
            </View>
          </LeagueCard>
        )}

        {/* 3. SEASON STATS */}
        <View style={{ marginTop: 4 }}>
          <SectionHeader title="SAISON EN COURS" />
        </View>
        <LeagueCard style={{ marginBottom: 6, marginTop: 8, ...leagueSurface }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[Fonts.h1Bold, { color: Colors.gold500 }]}>{mySquad?.wins || 0}</Text>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginTop: 4 }]}>VICTOIRES</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', height: 40, width: 1 }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                numberOfLines={1}
                style={[Fonts.h1Bold, { color: Colors.gold500 }]}
              >
                {streakValue}
              </Text>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginTop: 4 }]}>SERIE</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', height: 40, width: 1 }} />
            <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate(RouteNames.LeagueDashboard, {
                  params: { division: mySquad?.division },
                  screen: RouteNames.LeagueRanking,
                })}
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.48)',
                  borderRadius: 10,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 36,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  width: '100%',
                }}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={1}
                  style={[Fonts.p3Bold, {
                    color: Colors.primary500,
                    lineHeight: 16,
                    textAlign: 'center',
                    width: '100%',
                  }]}
                >
                  CLASSEMENT
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={{
              borderTopColor: 'rgba(255,255,255,0.08)',
              borderTopWidth: 1,
              marginTop: 16,
              paddingTop: 14,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, textAlign: 'center' }]}>
              {divisionPoints}
              /100 pts
              {' - '}
              {promotionHelper}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4, textAlign: 'center' }]}>
              {streakHelper}
              {' | Meilleure serie: x'}
              {highestStreak}
            </Text>
          </View>
        </LeagueCard>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title="DERNIERS MATCHS" />
        </View>
        <LeagueCard style={{ marginBottom: 8, marginTop: 8, ...leagueSurface }}>
          {recentMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 18 }}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 40,
                  justifyContent: 'center',
                  marginBottom: 10,
                  width: 40,
                }}
              >
                <Text style={{ fontSize: 16 }}>[]</Text>
              </View>
              <Text style={[Fonts.p2, { color: Colors.neutral100, textAlign: 'center' }]}>
                Aucun match termine pour le moment.
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
                Terminez un premier match pour alimenter votre historique.
              </Text>
              {showEmptyHistoryCta && (
              <TouchableOpacity
                onPress={() => setViewState('lobby')}
                style={{
                  backgroundColor: 'rgba(1, 179, 244, 0.15)',
                  borderColor: 'rgba(1, 179, 244, 0.42)',
                  borderRadius: 10,
                  borderWidth: 1,
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                  Lancer une recherche
                </Text>
              </TouchableOpacity>
              )}
            </View>
          ) : (
            recentMatches.map((/** @type {MatchHistoryEntry} */ item, /** @type {number} */ index) => {
              let resultColor = Colors.neutral300;
              if (item.result === 'win') {
                resultColor = Colors.success500;
              } else if (item.result === 'loss') {
                resultColor = Colors.error500;
              }
              let resultLabel = String(item.status || '');
              if (item.result === 'win') {
                resultLabel = 'Victoire';
              } else if (item.result === 'loss') {
                resultLabel = 'Defaite';
              } else if (item.result === 'draw') {
                resultLabel = 'Nul';
              }
              const matchDate = item.date ? new Date(item.date) : null;
              const dateLabel = matchDate && !Number.isNaN(matchDate.getTime())
                ? matchDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : 'Date inconnue';

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate(RouteNames.LeagueDashboard, {
                    params: {
                      matchId: item.id,
                      myTeamId: getEntityDocumentId(mySquad),
                    },
                    screen: RouteNames.PastMatchDetails,
                  })}
                  style={{
                    borderBottomColor: 'rgba(255,255,255,0.09)',
                    borderBottomWidth: index === recentMatches.length - 1 ? 0 : 1,
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                        vs
                        {' '}
                        {item.opponent?.name || 'Adversaire'}
                      </Text>
                      <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 2 }]}>
                        {dateLabel}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
                        {item.score_a ?? '-'}
                        {' '}
                        -
                        {item.score_b ?? '-'}
                      </Text>
                      <Text style={[Fonts.p3Bold, { color: resultColor, marginTop: 2 }]}>
                        {resultLabel}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </LeagueCard>
      </View>
    );
  };

  const renderLobbyModal = () => {
    // Helper to extract string from string or object
    const getSafeLabel = (/** @type {unknown} */ val) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        const obj = /** @type {{label?: string}} */ (val);
        if (obj.label) return obj.label;
      }
      return null;
    };

    // Display Label
    let displayLabel = 'Zone ind\u00E9finie';
    const tempAddr = getSafeLabel(tempSearchLocation?.address);
    const tempCity = getSafeLabel(tempSearchLocation?.city);
    const homeAddr = getSafeLabel(homeBase?.address);
    const homeCity = getSafeLabel(homeBase?.city);

    if (tempAddr) displayLabel = tempAddr;
    else if (tempCity) displayLabel = tempCity;
    else if (homeAddr) displayLabel = homeAddr;
    else if (homeCity) displayLabel = homeCity;

    return (
      <BottomModal
        close={() => setViewState('locker_room')}
        headerComponent={(
          <View>
            <Text style={[Fonts.h3, { color: Colors.gold500, letterSpacing: 1, textAlign: 'center' }]}>CONFIGURATION</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral300, marginBottom: 8, textAlign: 'center' }]}>
              Rechercher match
            </Text>
          </View>
              )}
        isVisible={viewState === 'lobby'}
        scrollable
        snapPoints={['90%']}
      >
        <View style={{ marginBottom: 24 }}>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 8 }]}>Zone de recherche</Text>

          {isEditingLocation ? (
            <View style={{ height: 200 }}>
              <AutocompleteAddressInput
                onSelect={(/** @type {unknown} */ data) => {
                  const normalized = normalizeLocationInput(data);
                  if (normalized && hasValidLocationCoordinates(normalized)) {
                    setTempSearchLocation(normalized);
                  }
                  setIsEditingLocation(false);
                }}
                placeholder="Entrez une nouvelle adresse..."
                styles={{
                  textInput: { backgroundColor: Colors.neutral800, color: Colors.neutral00 },
                }}
              />
              <Button onPress={() => setIsEditingLocation(false)} style={{ marginTop: 8 }} title="Annuler" variant="Secondary" />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setIsEditingLocation(true)}
              style={{
                alignItems: 'center',
                backgroundColor: Colors.neutral800,
                borderColor: Colors.neutral700,
                borderRadius: 8,
                borderWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: 12,
              }}
            >
              <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, marginRight: 8 }]}>
                Lieu:
                {' '}
                {displayLabel}
              </Text>
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>MODIFIER</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Rayon de recherche</Text>
            <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
              <Text style={{ color: Colors.gold500 }}>
                {searchRadius}
                {' '}
                km
              </Text>
            </Text>
          </View>
          <Slider
            maximumTrackTintColor={Colors.neutral600 || '#555'}
            maximumValue={100}
            minimumTrackTintColor={Colors.primary500 || '#01b3f4'}
            minimumValue={5}
            onValueChange={setSearchRadius}
            step={5}
            style={{ height: 40, width: '100%' }}
            thumbTintColor={Colors.primary500 || '#01b3f4'}
            value={searchRadius}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>5 km</Text>
            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>100 km</Text>
          </View>
        </View>

        {/* SECTION: Sélection des créneaux récurrents */}
        <View style={{ marginBottom: 24 }}>
          <View style={{
            alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 8,
          }}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral300, flex: 1 }]}>
              Vos disponibilités (
              <Text style={{ color: Colors.gold500 }}>{selectedSlotIds.length}</Text>
              /
              <Text style={{ color: Colors.gold500 }}>{squadSlots.length || 0}</Text>
              )
            </Text>
            <TouchableOpacity
              onPress={() => setIsAddingSearchSlot((prev) => !prev)}
              style={{
                backgroundColor: 'rgba(255, 209, 0, 0.08)',
                borderColor: Colors.gold500,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                {isAddingSearchSlot ? 'Fermer' : '+ Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>

          {isAddingSearchSlot && (
          <View style={{ marginBottom: 12 }}>
            {isSavingSearchSlot && (
            <ActivityIndicator color={Colors.primary500} size="small" style={{ marginBottom: 8 }} />
            )}
            <TeamSlotCreationForm
              onAdd={handleAddSearchSlot}
              onCancel={() => setIsAddingSearchSlot(false)}
              requireLocationMode={mySquad?.sport && getRequiredPlayersForSport(mySquad.sport) === 11}
            />
          </View>
          )}

          {!isAddingSearchSlot && (squadSlots || []).length > 0 && (
          <TouchableOpacity
            onPress={() => {
              const allSlotIds = toDocumentIdList(squadSlots);
              const hasAllSelected = allSlotIds.length > 0
                                && allSlotIds.every((slotId) => selectedSlotIds.includes(slotId));
              setSelectedSlotIds(hasAllSelected ? [] : allSlotIds);
            }}
            style={{
              alignSelf: 'flex-end',
              backgroundColor: 'rgba(1, 179, 244, 0.08)',
              borderColor: Colors.primary500,
              borderRadius: 999,
              borderWidth: 1,
              marginBottom: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              {selectedSlotIds.length === (squadSlots || []).length && selectedSlotIds.length > 0
                ? 'Tout désélectionner'
                : 'Tout sélectionner'}
            </Text>
          </TouchableOpacity>
          )}

          {/* SECTION: Autres créneaux communs (négociation) */}
          {currentMatch?.common_slots && currentMatch.common_slots.length > 1 && (
          <View style={{
            backgroundColor: Colors.neutral800, borderColor: Colors.neutral700, borderRadius: 8, borderWidth: 1, marginTop: 16, padding: 12,
          }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
              - Autres créneaux communs possibles :
            </Text>
            {currentMatch.common_slots.map((/** @type {LeagueSlot} */ slot) => {
              // Skip the currently selected slot
              if (slot.day === (currentMatch.recurring_day || opponentDetails?.recurring_day)) return null;

              const dayKey = String(slot.day || '').toLowerCase();
              const dayName = DAY_MAP[dayKey] || slot.day;
              const slotKey = getEntityDocumentId(slot) || [
                slot.day || 'slot',
                slot.startHour || slot.start_hour || 'start',
                slot.endHour || slot.end_hour || 'end',
              ].join('-');
              return (
                <View key={slotKey} style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14 }}>-</Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral100, marginLeft: 8 }]}>
                    {dayName}
                    {' '}
                    {slot.startHour}
                    -
                    {slot.endHour}
                  </Text>
                </View>
              );
            })}
          </View>
          )}

          {!isAddingSearchSlot && (squadSlots || []).map((/** @type {LeagueSlot} */ slot) => {
            const slotId = getEntityDocumentId(slot) || '';
            const isSelected = selectedSlotIds.includes(slotId);
            const formatHour = (/** @type {string | undefined | null} */ h) => (h ? h.substring(0, 5) : '?');
            return (
              <TouchableOpacity
                key={slotId}
                onPress={() => toggleSlotSelection(slotId)}
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.neutral800,
                  borderColor: Colors.primary500,
                  borderRadius: 8,
                  borderWidth: isSelected ? 1 : 0,
                  flexDirection: 'row',
                  marginBottom: 8,
                  padding: 12,
                }}
              >
                <View style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  borderRadius: 12,
                  height: 24,
                  justifyContent: 'center',
                  marginRight: 12,
                  width: 24,
                }}
                >
                  {isSelected && <Text style={{ color: 'white', fontWeight: 'bold' }}>OK</Text>}
                </View>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  {DAY_MAP[String(slot.recurrence_day || '').toLowerCase()] || slot.recurrence_day}
                  {' '}
                  {formatHour(slot.start_hour)}
                  {' '}
                  -
                  {' '}
                  {formatHour(slot.end_hour)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!isAddingSearchSlot && (!squadSlots || squadSlots.length === 0) && (
          <Text style={[Fonts.p2, { color: Colors.neutral500, padding: 16, textAlign: 'center' }]}>
            Aucun créneau défini. Ajoutez-en directement ici.
          </Text>
          )}
        </View>

        <View style={{
          alignItems: 'center', borderBottomColor: Colors.neutral800, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16,
        }}
        >
          <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Duree Match</Text>
          <View style={{
            backgroundColor: Colors.neutral800, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4,
          }}
          >
            <Text style={[Fonts.p1Bold, { color: Colors.gold500 }]}>{`${getMatchDurationMinutes(mySquad?.sport)} min`}</Text>
          </View>
        </View>

        <Button
          disabled={loading || selectedSlotIds.length === 0 || leaguePlatformRuntime?.effectiveMatchmakingIsOpen === false}
          onPress={handleConfirmSearch}
          style={{ marginBottom: 16 }}
          title={loading ? 'Lancement...' : 'CONFIRMER & SCANNER'}
          variant="Primary"
        />
        {leaguePlatformRuntime?.effectiveMatchmakingIsOpen === false ? (
          <Text style={[Fonts.p3, { color: Colors.warning500, marginBottom: 12, textAlign: 'center' }]}>
            {getLeagueClosedMessage(leaguePlatformRuntime, 'matchmaking')}
          </Text>
        ) : null}
        <Button
          onPress={() => setViewState('locker_room')}
          title="Annuler"
          variant="Secondary"
        />
      </BottomModal>
    );
  };

  const renderSquadSelectorModal = () => (
    <BottomModal
      close={() => setIsSquadSelectorVisible(false)}
      closeIconTintColor="primary200"
      contentContainerStyle={{ paddingBottom: 18 }}
      headerComponent={(
        <View style={{ alignItems: 'center' }}>
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            Changer de squad
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
            Sélectionné la squad active pour les matchs
          </Text>
        </View>
              )}
      isVisible={isSquadSelectorVisible}
      snapPoints={['48%', '76%']}
      style={[
        ApplicationStyle.backgroundColor.primary900,
        {
          borderColor: 'rgba(1, 179, 244, 0.30)',
          borderWidth: 1,
        },
      ]}
    >
      <View style={{ paddingBottom: 24 }}>
        {allSquads.length === 0 && (
        <View
          style={[
            ApplicationStyle.card,
            {
              alignItems: 'center',
              backgroundColor: 'rgba(10, 28, 43, 0.86)',
              borderColor: 'rgba(1, 179, 244, 0.30)',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 18,
            },
          ]}
        >
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            Aucune squad disponible.
          </Text>
        </View>
        )}
        {allSquads.map((/** @type {Team} */ squad) => {
          const squadId = getEntityDocumentId(squad);
          const isActiveSquad = areSameEntityId(squadId, getEntityDocumentId(mySquad));
          const squadLogoUri = getSquadLogoUri(squad);
          const hasSquadLogo = Boolean(squadLogoUri);
          return (
            <TouchableOpacity
              key={squadId}
              onPress={() => handleSquadSwitch(squad)}
              style={[
                ApplicationStyle.card,
                Alignments.row,
                Alignments.alignCenter,
                {
                  backgroundColor: isActiveSquad ? 'rgba(1, 179, 244, 0.18)' : 'rgba(23, 56, 68, 0.52)',
                  borderColor: isActiveSquad ? 'rgba(1, 179, 244, 0.78)' : 'rgba(1, 179, 244, 0.35)',
                  borderRadius: 14,
                  marginBottom: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                },
              ]}
            >
              <View style={{
                alignItems: 'center',
                backgroundColor: 'rgba(0, 18, 24, 0.72)',
                borderColor: hasSquadLogo ? 'rgba(1, 179, 244, 0.48)' : 'rgba(255, 215, 0, 0.55)',
                borderRadius: 28,
                borderWidth: 1,
                height: 56,
                justifyContent: 'center',
                marginRight: 12,
                padding: 2,
                width: 56,
              }}
              >
                {hasSquadLogo ? (
                  <Image
                    resizeMode="contain"
                    source={{ uri: squadLogoUri }}
                    style={{ height: 50, transform: [{ scale: 1.08 }], width: 50 }}
                  />
                ) : (
                  <TeamShield
                    initials={getSquadShieldInitials(squad?.name)}
                    isGold
                    size={48}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, marginRight: 8 }]}>
                    {squad?.name || 'Squad'}
                  </Text>
                  {isActiveSquad && (
                    <View style={{
                      alignItems: 'center',
                      backgroundColor: 'rgba(1, 179, 244, 0.14)',
                      borderColor: 'rgba(1, 179, 244, 0.45)',
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: 'row',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                    >
                      <Image
                        source={Images.check}
                        style={{
                          height: 12, marginRight: 4, tintColor: Colors.primary500, width: 12,
                        }}
                      />
                      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Actif</Text>
                    </View>
                  )}
                </View>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  {squad?.sport || 'Sport'}
                  {' '}
                  - Div
                  <Text style={{ color: Colors.gold500 }}>{squad?.division || 5}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomModal>
  );

  const proposalDefaults = React.useMemo(() => buildProposalDefaultsFromMatch(currentMatch), [currentMatch]);

  if (loadError && !mySquad && viewState !== 'no_squad') {
    return (
      <LeagueStateView
        actionLabel="Réessayer"
        description={loadError}
        onAction={() => loadMatchCenter()}
        title="Match Center indisponible"
      />
    );
  }

  if (viewState === 'loading' && !mySquad) {
    return (
      <LeagueStateView
        description="Synchronisation de votre squad et des opportunites de match en cours."
        isLoading
        title="Chargement du Match Center"
      />
    );
  }
  if (viewState === 'no_squad') return <View style={styles.screen}>{renderNoSquad()}</View>;

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        refreshControl={
          <RefreshControl colors={[Colors.primary500]} onRefresh={() => loadMatchCenter()} refreshing={loading} tintColor={Colors.primary500} />
             }
        style={styles.container}
      >
        {/* STANDARD HEADER */}
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween, Spaces.marginBottom[24]]}>
          <LeagueHeaderSwitch />
          <View style={{ alignItems: 'center', flexDirection: 'row', paddingTop: 4 }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>

        {renderLockerRoom()}
        <View style={{ height: scrollBottomPadding }} />
      </ScrollView>

      {/* MODALS OUTSIDE SCROLLVIEW */}
      {renderLobbyModal()}
      {renderSquadSelectorModal()}

      <VenueProposalModal
        durationMinutes={proposalDurationMinutes}
        initialDate={proposalDefaults.date}
        initialEndTime={proposalDefaults.end}
        initialStartTime={proposalDefaults.start}
        isSubmitting={loading}
        isVisible={isProposalModalVisible}
        legalAcceptanceConfig={{
          metadata: {
            matchLabel: currentMatchLegalLabel,
            teamName: mySquad?.name || null,
          },
          scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
          sourceScreen: 'match_center_proposal',
          targetDocumentId: getEntityDocumentId(currentMatch),
          targetLabel: currentMatchLegalLabel,
          targetType: 'league_match',
        }}
        onClose={() => setIsProposalModalVisible(false)}
        onSend={handleSendProposal}
        onSkip={() => {
          setIsProposalModalVisible(false);
          if (currentMatch && currentMatch.chat) {
            const chatId = getEntityDocumentId(currentMatch.chat);
            navigation.navigate(RouteNames.Conversation, {
              chatId,
              subTitle: 'Match de Ligue',
              title: opponentChatTitle,
            });
          }
        }}
        venueRequired={venueRequired}
      />
      {leagueLegalAcceptanceModal}
    </ScreenContainer>
  );
}

// Simplified Styles that rely on inline style overrides for Colors
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24, // BorderRadius.xl
    borderTopRightRadius: 24,
    minHeight: '50%',
    padding: 24, // Spacing.xl
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSubtitle: {
    marginBottom: 32, // Spacing.xl
    textAlign: 'center',
  },
  modalTitle: {
    marginBottom: 4, // Spacing.xs
    textAlign: 'center',
  },
  radarCircle: {
    alignItems: 'center',
    borderRadius: 75,
    borderWidth: 2,
    height: 150,
    justifyContent: 'center',
    marginBottom: 32, // Spacing.xl
    width: 150,
  },
  screen: {
    flex: 1,
    padding: 16, // Spacing.md
  },
  settingLabel: {
  },
  settingRow: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16, // Spacing.md
  },
  settingValue: {
  },
});

export default MatchCenterScreen;
