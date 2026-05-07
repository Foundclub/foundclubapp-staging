import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Animated, Image, ImageBackground, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfilePicturePreviewOverlay from '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay';
import TeamSlotList from '@/components/molecules/teamSlotList/TeamSlotList';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';

import {
  clearPendingSquadInviteLink,
  savePendingSquadInviteLink,
} from '@/navigation/pendingSquadInviteLink';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import MatchmakingService from '@/services/league/MatchmakingService';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import {
  assignSquadCaptain,
  cancelJoinRequest,
  deleteLeagueTeam,
  getRanking,
  joinSquadViaInviteLink,
  leaveSquad,
  removeSquadMember,
  requestToJoinSquad,
  respondToSquadInvite,
  updateLeagueTeam,
} from '@/services/leagueTeam/leagueTeamService';
import { useGetLeagueTeamPerformanceStats } from '@/services/matchStats/matchStatsQueries';
import { createTeamSlot, deleteTeamSlot, updateTeamSlot } from '@/services/teamSlot/teamSlotService';

import { getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';
import {
  getLeagueCaptainMembers,
  isLeagueCaptain,
  isLeagueMember,
} from '@/utils/league/captains';
import { normalizeLocationInput } from '@/utils/location';
import {
  buildInstallLandingUrl,
  buildShareMessageWithUrl,
} from '@/utils/shareLinks';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';
import SharePlatform from '@/platform/share';

const slotDayLabels = {
  friday: 'Vendredi',
  monday: 'Lundi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
  thursday: 'Jeudi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
};

const slotDayShortLabels = {
  friday: 'Ven',
  monday: 'Lun',
  saturday: 'Sam',
  sunday: 'Dim',
  thursday: 'Jeu',
  tuesday: 'Mar',
  wednesday: 'Mer',
};

const slotWeekdayOrder = {
  friday: 5,
  monday: 1,
  saturday: 6,
  sunday: 0,
  thursday: 4,
  tuesday: 2,
  wednesday: 3,
};

const formatSlotHour = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return '--';
  const [rawHour = '00', rawMinute = '00'] = timeValue.split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = String(rawMinute).padStart(2, '0');
  if (!Number.isFinite(hour)) return '--';
  return `${hour}h${minute}`;
};

const resolveSlotStartMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return Number.MAX_SAFE_INTEGER;
  const [rawHour = '00', rawMinute = '00'] = timeValue.split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER;
  return (hour * 60) + minute;
};

const resolveUpcomingSlot = (slots = []) => {
  if (!Array.isArray(slots) || slots.length === 0) return null;

  const now = new Date();
  const currentWeekday = now.getDay();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  const enriched = slots
    .map((slot) => {
      const recurrenceDay = String(slot?.recurrence_day || '').toLowerCase();
      const dayOrder = slotWeekdayOrder[recurrenceDay];
      if (dayOrder === undefined) return null;

      let deltaDays = (dayOrder - currentWeekday + 7) % 7;
      const startMinutes = resolveSlotStartMinutes(slot?.start_hour);
      if (deltaDays === 0 && startMinutes <= currentMinutes) {
        deltaDays = 7;
      }

      return {
        ...slot,
        deltaDays,
        recurrenceDay,
        startMinutes,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.deltaDays !== b.deltaDays) return a.deltaDays - b.deltaDays;
      return a.startMinutes - b.startMinutes;
    });

  return enriched[0] || null;
};

const formatLeagueMatchDate = (value) => {
  if (!value) return 'Date \u00E0 d\u00E9finir';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return 'Date \u00E0 d\u00E9finir';
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
};

const getLeagueResultMeta = (result, Colors) => {
  switch (String(result || '').trim().toLowerCase()) {
    case 'draw':
      return {
        backgroundColor: `${Colors.warning500}16`,
        borderColor: `${Colors.warning500}40`,
        label: 'Nul',
        textColor: Colors.warning500,
      };
    case 'loss':
      return {
        backgroundColor: `${Colors.error500}16`,
        borderColor: `${Colors.error500}40`,
        label: 'Defaite',
        textColor: Colors.error500,
      };
    case 'win':
      return {
        backgroundColor: `${Colors.success500}16`,
        borderColor: `${Colors.success500}40`,
        label: 'Victoire',
        textColor: Colors.success500,
      };
    default:
      return {
        backgroundColor: `${Colors.primary500}12`,
        borderColor: `${Colors.primary500}30`,
        label: 'En attente',
        textColor: Colors.primary100,
      };
  }
};

/**
 * @param {unknown} value
 * @returns {boolean}
 */
const isTruthyRouteParam = (value) => {
  if (value === true || value === 1) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

/**
 * @param {any} status
 * @returns {string}
 */
const resolveMatchmakingStatusState = (status) => String(
  status?.legacyState
  || status?.state
  || status?.status
  || '',
).trim().toLowerCase();

/**
 * @param {any} status
 * @returns {string}
 */
const resolveMatchmakingStatusMatchId = (status) => (
  getEntityDocumentId(status?.match)
  || status?.matchId
  || ''
);

/**
 * @param {any} status
 * @returns {boolean}
 */
const shouldRevealMatchmakingStatus = (status) => {
  const statusState = resolveMatchmakingStatusState(status);
  return statusState === 'searching'
    || statusState === 'matched'
    || Boolean(resolveMatchmakingStatusMatchId(status));
};

/**
 * Squad Details Screen for FC League
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function SquadDetailsScreen({ navigation, route }) {
  const safeTeamId = String(route?.params?.teamId || '').trim();
  const focusSection = route?.params?.focusSection || null;
  const isShareInviteLink = isTruthyRouteParam(route?.params?.invite);
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { userData: currentUser } = /** @type {{ userData: User | null }} */ (useAuth());
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const { floatingActionBottomOffset, sceneBottomInset: dockSceneBottomInset } = useBottomDockLayout();
  
  const bottomInset = insets.bottom || 0;
  const hasTabBar = (tabBarHeight || 0) > 0;
  const fixedButtonBottomOffset = hasTabBar ? floatingActionBottomOffset : Math.max(bottomInset + 16, 24);
  const sceneBottomInset = hasTabBar ? dockSceneBottomInset : Math.max(bottomInset, 16);
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const currentUserId = getEntityDocumentId(currentUser);
  const { getClubInitials } = useClub();

  // Use League Team Hook
  const {
    data: team,
    error: teamError,
    isLoading,
    refetch,
  } = useGetLeagueTeam(safeTeamId);

  const [isSlotModalVisible, setIsSlotModalVisible] = useState(false);
  const [captainAssignmentTarget, setCaptainAssignmentTarget] = useState(null);
  const [captainAssignmentMode, setCaptainAssignmentMode] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [editingSlot, setEditingSlot] = useState(/** @type {LeagueSlot | null} */ (null));

  const [isCoverPreviewVisible, setIsCoverPreviewVisible] = useState(false);
  const scrollRef = useRef(null);
  const [sectionOffsets, setSectionOffsets] = useState({ effectif: 0, slots: 0, statistics: 0 });
  const heroEntry = useRef(new Animated.Value(0)).current;
  const bodyEntry = useRef(new Animated.Value(0)).current;
  const acceptedShareInviteKeyRef = useRef(null);
  const promptedShareInviteAuthKeyRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useEffect(() => {
    heroEntry.setValue(0);
    bodyEntry.setValue(0);
    Animated.sequence([
      Animated.timing(heroEntry, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(bodyEntry, {
        delay: 40,
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bodyEntry, heroEntry, team?.documentId]);

  const snapPoints = useMemo(() => ['85%'], []);
  const captainAssignmentSnapPoints = useMemo(() => ['58%'], []);

  const captainMembers = useMemo(() => getLeagueCaptainMembers(team), [team]);
  const captainIds = useMemo(() => {
    const ids = new Set();
    captainMembers.forEach((captain) => {
      const captainId = getEntityDocumentId(captain);
      if (captainId) ids.add(String(captainId));
    });
    return ids;
  }, [captainMembers]);
  const rosterDisplayMembers = useMemo(() => {
    const seenIds = new Set();
    const members = [];
    const pushMember = (member) => {
      const memberId = getEntityDocumentId(member);
      if (!memberId || seenIds.has(String(memberId))) return;
      seenIds.add(String(memberId));
      members.push(member);
    };

    captainMembers.forEach(pushMember);
    (team?.roster || []).forEach(pushMember);
    return members;
  }, [captainMembers, team?.roster]);
  const captainCount = captainMembers.length;

  const isCaptain = useMemo(() => isLeagueCaptain(team, currentUserId), [currentUserId, team]);

  const isMember = useMemo(() => isLeagueMember(team, currentUserId), [currentUserId, team]);
  const canViewStatistics = Boolean(isMember);

  const hasPendingRequest = useMemo(() => team?.join_requests?.some((/** @type {User} */ u) => u.documentId === currentUser?.documentId), [team, currentUser]);
  const hasInvitation = useMemo(() => team?.invitations?.some((/** @type {User} */ u) => u.documentId === currentUser?.documentId), [team, currentUser]);
  const shouldShowFixedJoinButton = !isCaptain && !isMember && !hasInvitation;
  const fixedJoinButtonTitle = (() => {
    if (isShareInviteLink) return 'Rejoindre la squad';
    if (hasPendingRequest) return 'Demande en attente';
    return 'Demander a rejoindre';
  })();
  const fixedJoinButtonHelperText = (() => {
    if (isShareInviteLink) {
      return 'Ce lien vous permet de rejoindre directement la squad';
    }
    if (hasPendingRequest) {
      return 'Votre demande attend la validation du capitaine';
    }
    return 'Envoyer une demande au capitaine de la squad';
  })();
  const isFixedJoinButtonDisabled = hasPendingRequest && !isShareInviteLink;
  const scrollBottomPadding = shouldShowFixedJoinButton
    ? Math.max(sceneBottomInset, fixedButtonBottomOffset + 92)
    : sceneBottomInset;

  const {
    data: leaguePerformanceStats,
    isFetching: isLeaguePerformanceFetching,
    refetch: refetchLeaguePerformanceStats,
  } = useGetLeagueTeamPerformanceStats(safeTeamId, {
    enabled: Boolean(safeTeamId && canViewStatistics),
  });

  const {
    data: rankingData,
    isFetching: isRankingFetching,
    refetch: refetchRanking,
  } = useQuery({
    enabled: Boolean(canViewStatistics && team?.division),
    queryFn: () => getRanking(team?.division),
    queryKey: ['leagueDivisionRanking', team?.division],
    staleTime: 60_000,
  });

  const rosterCount = rosterDisplayMembers.length;

  const normalizedHomeBase = useMemo(
    () => normalizeLocationInput(team?.home_base),
    [team?.home_base],
  );

  const locationLabel = useMemo(
    () => normalizedHomeBase?.city
      || normalizedHomeBase?.label
      || normalizedHomeBase?.address
      || t('squadDetails.labels.locationUnknown', 'Localisation non renseignee'),
    [normalizedHomeBase, t],
  );

  const slotCount = useMemo(() => {
    if (!Array.isArray(team?.slots)) return 0;
    return team.slots.length;
  }, [team?.slots]);
  const nextSlot = useMemo(() => resolveUpcomingSlot(team?.slots || []), [team?.slots]);
  const pendingRequestsCount = Number(team?.join_requests?.length || 0);
  const nextSlotShortLabel = useMemo(() => {
    if (!nextSlot) return '\u00C0 d\u00E9finir';
    return `${slotDayShortLabels[nextSlot.recurrenceDay] || 'A venir'} · ${formatSlotHour(nextSlot?.start_hour)}`;
  }, [nextSlot]);
  const nextSlotLongLabel = useMemo(() => {
    if (!nextSlot) return 'Ajoutez un cr\u00E9neau pour lancer votre rythme.';
    return `${slotDayLabels[nextSlot.recurrenceDay] || 'Jour'} · ${formatSlotHour(nextSlot?.start_hour)} - ${formatSlotHour(nextSlot?.end_hour)}`;
  }, [nextSlot]);
  const squadStatusChip = useMemo(() => {
    if (isCaptain) return { label: 'Capitaine', tone: 'gold' };
    if (hasInvitation) return { label: 'Invitation recue', tone: 'blue' };
    if (hasPendingRequest) return { label: 'Demande en attente', tone: 'blue' };
    if (isMember) return { label: 'Membre', tone: 'blue' };
    return { label: 'Squad ouverte', tone: 'blue' };
  }, [hasInvitation, hasPendingRequest, isCaptain, isMember]);
  const nextSlotParticipantsCount = Number(nextSlot?.participants?.length || 0);
  const nextSlotRemainingCount = Math.max(0, 5 - nextSlotParticipantsCount);
  const nextSlotStatus = useMemo(() => {
    if (!nextSlot) {
      return {
        badge: 'Aucun cr\u00E9neau',
        helper: 'Ajoutez un cr\u00E9neau pour donner un premier point de rendez-vous \u00E0 la squad.',
      };
    }
    if (nextSlotParticipantsCount >= 5) {
      return {
        badge: 'Pret a jouer',
        helper: 'Le prochain cr\u00E9neau est complet. La squad a d\u00E9j\u00E0 assez de monde pour se lancer.',
      };
    }
    if (nextSlotParticipantsCount >= 3) {
      return {
        badge: 'Presque pret',
        helper: `Encore ${nextSlotRemainingCount} pr\u00E9sence${nextSlotRemainingCount > 1 ? 's' : ''} pour atteindre le format ideal.`,
      };
    }
    return {
      badge: 'A renforcer',
      helper: `Seulement ${nextSlotParticipantsCount} pr\u00E9sence${nextSlotParticipantsCount > 1 ? 's' : ''} pour le moment. Il faut encore mobiliser la squad.`,
    };
  }, [nextSlot, nextSlotParticipantsCount, nextSlotRemainingCount]);
  const rosterSignals = useMemo(() => {
    const signals = [
      {
        key: 'members',
        label: 'Membres',
        value: `${rosterCount}`,
      },
    ];

    if (isCaptain) {
      signals.push({
        key: 'requests',
        label: 'Demandes',
        value: `${pendingRequestsCount}`,
      });
      signals.push({
        key: 'invitations',
        label: 'Invitations',
        value: `${Number(team?.invitations?.length || 0)}`,
      });
    } else {
      signals.push({
        key: 'captain',
        label: captainCount > 1 ? 'Capitaines' : 'Capitaine',
        value: captainMembers.length > 0
          ? captainMembers
            .map((captain) => `${captain?.firstname || ''} ${captain?.lastname || ''}`.trim() || captain?.username || 'Capitaine')
            .filter(Boolean)
            .join(', ')
          : '\u00C0 d\u00E9finir',
      });
      signals.push({
        key: 'status',
        label: 'Statut',
        value: squadStatusChip.label,
      });
    }

    return signals;
  }, [captainCount, captainMembers, isCaptain, pendingRequestsCount, rosterCount, squadStatusChip.label, team?.invitations?.length]);
  const nextSlotActionLabel = useMemo(() => {
    if (isCaptain) return 'Animer la squad';
    if (isMember) return 'Confirmer ma pr\u00E9sence';
    return 'Rejoindre la squad';
  }, [isCaptain, isMember]);
  const leagueCardBg = 'rgba(10, 28, 43, 0.84)';
  const leagueCardBorder = 'rgba(1, 179, 244, 0.24)';

  const uiTone = useMemo(() => ({
    captainBadgeBg: `${Colors.gold500}20`,
    captainBadgeBorder: `${Colors.gold500}55`,
    cardStroke: leagueCardBorder,
    chipInfoBg: `${Colors.primary500}1F`,
    chipInfoBorder: `${Colors.primary500}61`,
    editButtonBg: leagueCardBg,
    editButtonBorder: leagueCardBorder,
    insightCardBg: leagueCardBg,
    insightCardBorder: leagueCardBorder,
    overlayBg: `${Colors.primary900}B8`,
    panelBg: leagueCardBg,
    panelBorder: leagueCardBorder,
    playerBadgeBg: `${Colors.primary500}1F`,
    playerBadgeBorder: `${Colors.primary500}4D`,
    quickActionBg: leagueCardBg,
    quickActionBorder: leagueCardBorder,
    rosterCaptainBg: leagueCardBg,
    rosterCaptainBorder: leagueCardBorder,
    rosterPlayerBg: leagueCardBg,
    rosterPlayerBorder: leagueCardBorder,
    summaryCardBg: leagueCardBg,
    summaryCardBorder: leagueCardBorder,
    topActionBg: leagueCardBg,
    topActionBorder: leagueCardBorder,
  }), [Colors, leagueCardBg, leagueCardBorder]);

  const normalizedLeagueSport = useMemo(() => {
    const rawSport = String(team?.sport || '').trim().toLowerCase();
    if (rawSport.includes('padel')) return 'padel';
    if (rawSport.includes('foot')) return 'football';
    return null;
  }, [team?.sport]);

  const statisticsMode = leaguePerformanceStats?.mode || (normalizedLeagueSport === 'padel' ? 'padel_light' : 'football_full');
  const isPadelStatisticsMode = statisticsMode === 'padel_light';
  const statisticsModeLabel = isPadelStatisticsMode ? 'Padel light' : 'Football complet';

  const rankingEntries = useMemo(
    () => (Array.isArray(rankingData) ? rankingData : []),
    [rankingData],
  );

  const squadRank = useMemo(() => {
    if (!team?.documentId || !rankingEntries.length) return null;
    const index = rankingEntries.findIndex((entry) => getEntityDocumentId(entry) === team.documentId);
    return index >= 0 ? index + 1 : null;
  }, [rankingEntries, team?.documentId]);

  const recentLeagueMatches = useMemo(
    () => (Array.isArray(leaguePerformanceStats?.recentMatches) ? leaguePerformanceStats.recentMatches : []),
    [leaguePerformanceStats?.recentMatches],
  );
  const hasRecentLeagueMatches = recentLeagueMatches.length > 0;

  const leaguePendingMatches = useMemo(
    () => (Array.isArray(leaguePerformanceStats?.pendingMatches) ? leaguePerformanceStats.pendingMatches : []),
    [leaguePerformanceStats?.pendingMatches],
  );

  const leagueRecentReports = useMemo(
    () => (Array.isArray(leaguePerformanceStats?.recentReports) ? leaguePerformanceStats.recentReports : []),
    [leaguePerformanceStats?.recentReports],
  );

  const leaguePerformancePlayers = useMemo(
    () => (Array.isArray(leaguePerformanceStats?.players) ? leaguePerformanceStats.players : []),
    [leaguePerformanceStats?.players],
  );

  const leaguePerformanceSummary = useMemo(() => {
    const totals = leaguePerformanceStats?.totals || {};
    return {
      assists: Number(totals?.assists || 0),
      averageCollectiveRating: totals?.averageCollectiveRating ?? null,
      cleanSheets: Number(totals?.cleanSheets || 0),
      goals: Number(totals?.goals || 0),
      matches: Number(totals?.matchesPlayed || totals?.matches || 0),
      minutesPlayed: Number(totals?.minutesPlayed || 0),
      playerCollectiveRatingAverage: totals?.playerCollectiveRatingAverage ?? null,
      playerCollectiveRatingCount: Number(totals?.playerCollectiveRatingCount || 0),
      scoreAgainstTotal: Number(totals?.scoreAgainstTotal || 0),
      scoreForTotal: Number(totals?.scoreForTotal || 0),
      sport: leaguePerformanceStats?.sport || normalizedLeagueSport || 'football',
    };
  }, [leaguePerformanceStats?.sport, leaguePerformanceStats?.totals, normalizedLeagueSport]);

  const competitionCards = useMemo(() => {
    const divisionPoints = Number(team?.division_points ?? team?.divisionPoints ?? 0);
    const highestStreak = Number(team?.highest_streak ?? team?.highestStreak ?? 0);
    const streak = Number(team?.streak || 0);
    let streakLabel = 'Stable';
    if (streak > 0) {
      streakLabel = `x${streak}`;
    } else if (streak < 0) {
      streakLabel = 'Defaite';
    }

    return [
      {
        key: 'division',
        label: 'Division',
        value: team?.division ? `DIV ${team.division}` : '\u00C0 d\u00E9finir',
      },
      {
        key: 'divisionPoints',
        label: 'Points',
        value: `${divisionPoints}/100`,
      },
      {
        key: 'elo',
        label: 'ELO matchmaking',
        value: `${Number(team?.elo || 0)} pts`,
      },
      {
        key: 'rank',
        label: 'Classement',
        value: squadRank ? `#${squadRank}` : 'En attente',
      },
      {
        key: 'record',
        label: 'Bilan',
        value: `${Number(team?.wins || 0)}V ${Number(team?.draws || 0)}N ${Number(team?.losses || 0)}D`,
      },
      {
        key: 'streak',
        label: 'Serie',
        value: streakLabel,
      },
      {
        key: 'highestStreak',
        label: 'Meilleure serie',
        value: `x${highestStreak}`,
      },
      {
        key: 'reliability',
        label: 'Fiabilite',
        value: `${Number(team?.reliability_score || 0)}%`,
      },
    ];
  }, [squadRank, team?.division, team?.divisionPoints, team?.division_points, team?.draws, team?.elo, team?.highestStreak, team?.highest_streak, team?.losses, team?.reliability_score, team?.streak, team?.wins]);

  const getPlayerDisplayName = useCallback((player) => {
    const fullName = `${player?.firstname || ''} ${player?.lastname || ''}`.trim();
    return fullName || player?.username || t('squadDetails.roster.unknownPlayer', 'Joueur');
  }, [t]);

  const captainAssignmentTargetName = useMemo(
    () => getPlayerDisplayName(captainAssignmentTarget),
    [captainAssignmentTarget, getPlayerDisplayName],
  );

  const handleShare = useCallback(() => {
    const squadId = team?.documentId || safeTeamId;
    const inviterName = [currentUser?.firstname, currentUser?.lastname].filter(Boolean).join(' ').trim();
    const squadName = String(team?.name || '').trim();
    const intro = inviterName
      ? `${inviterName} vous invite a rejoindre sa squad${squadName ? ` ${squadName}` : ''} sur FoundClub League.`
      : `Rejoins${squadName ? ` la squad ${squadName}` : ' une squad'} sur FoundClub League.`;
    const shareUrl = buildInstallLandingUrl({
      id: squadId,
      invite: true,
      source: 'share',
      type: 'squad',
    });
    const message = buildShareMessageWithUrl({
      intro,
      linkLabel: 'Ouvrir dans FoundClub',
      url: shareUrl,
    });

    SharePlatform.share({
      message,
      title: inviterName ? `${inviterName} vous invite` : `Rejoins ${squadName || 'une squad'}`,
      url: shareUrl,
    }).catch(() => undefined);
  }, [currentUser?.firstname, currentUser?.lastname, safeTeamId, team?.documentId, team?.name]);

  const promptShareInviteAuthentication = useCallback(() => {
    if (!safeTeamId) return;

    savePendingSquadInviteLink(safeTeamId);
    Alert.alert(
      t('squad.inviteLink.loginTitle', 'Connexion requise'),
      t('squad.inviteLink.loginMessage', 'Connecte-toi ou cree ton compte pour rejoindre cette squad avec le lien d invitation.'),
      [
        {
          style: 'cancel',
          text: t('common.actions.later', 'Plus tard'),
        },
        {
          onPress: () => openPublicAuthFlow(navigation, {
            invite: true,
            origin: RouteNames.SquadDetails,
            source: 'squad-invite-link',
            teamId: safeTeamId,
          }),
          text: t('common.actions.login', 'Se connecter'),
        },
      ],
    );
  }, [navigation, safeTeamId, t]);

  const handleAcceptShareInviteLink = useCallback(async () => {
    try {
      if (!safeTeamId) return;

      if (!currentUserId) {
        promptShareInviteAuthentication();
        return;
      }

      if (isCaptain || isMember) {
        clearPendingSquadInviteLink();
        navigation.setParams?.({ invite: undefined });
        return;
      }

      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          inviteLink: true,
          teamName: team?.name || null,
        },
        scope: LEAGUE_LEGAL_SCOPES.TEAM_INVITATION_ACCEPT,
        sourceScreen: 'squad_details_share_invite_accept',
        targetDocumentId: safeTeamId,
        targetLabel: team?.name || 'Squad League',
        targetType: 'league_team',
      });
      if (!legalAcceptance) return;

      setIsUpdating(true);
      await joinSquadViaInviteLink(safeTeamId, currentUserId || '', { legalAcceptance });
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['myLeagueTeam', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingLeagueTeams', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['invitedLeagueTeams', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
        queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
      ]);
      clearPendingSquadInviteLink();
      navigation.setParams?.({ invite: undefined });
      Alert.alert(
        t('squad.inviteLink.acceptTitle', 'Squad rejointe'),
        t('squad.inviteLink.acceptMessage', 'Vous avez rejoint la squad.'),
      );
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('squad.inviteLink.error', 'Impossible de rejoindre la squad avec ce lien.'));
    } finally {
      setIsUpdating(false);
    }
  }, [
    currentUserId,
    isCaptain,
    isMember,
    navigation,
    promptShareInviteAuthentication,
    queryClient,
    refetch,
    requestLeagueLegalAcceptance,
    safeTeamId,
    t,
    team?.name,
  ]);

  useEffect(() => {
    if (!isShareInviteLink || !safeTeamId || isLoading || !team?.documentId) return;

    const inviteKey = `${safeTeamId}:${currentUserId || 'guest'}`;
    if (!currentUserId) {
      savePendingSquadInviteLink(safeTeamId);
      if (promptedShareInviteAuthKeyRef.current === inviteKey) return;

      promptedShareInviteAuthKeyRef.current = inviteKey;
      promptShareInviteAuthentication();
      return;
    }

    if (isCaptain || isMember) {
      clearPendingSquadInviteLink();
      navigation.setParams?.({ invite: undefined });
      return;
    }

    if (acceptedShareInviteKeyRef.current === inviteKey) return;
    acceptedShareInviteKeyRef.current = inviteKey;
    handleAcceptShareInviteLink();
  }, [
    currentUserId,
    handleAcceptShareInviteLink,
    isCaptain,
    isLoading,
    isMember,
    isShareInviteLink,
    navigation,
    promptShareInviteAuthentication,
    safeTeamId,
    team?.documentId,
  ]);

  const handleRequestJoin = useCallback(async () => {
    try {
      if (!safeTeamId || !currentUserId) {
        Alert.alert(t('common.error'), t('squad.join.error', 'Impossible d\'envoyer la demande.'));
        return;
      }
      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          teamName: team?.name || null,
        },
        scope: LEAGUE_LEGAL_SCOPES.TEAM_JOIN_REQUEST,
        sourceScreen: 'squad_details_join_request',
        targetDocumentId: safeTeamId,
        targetLabel: team?.name || 'Squad League',
        targetType: 'league_team',
      });
      if (!legalAcceptance) return;

      setIsUpdating(true);
      await requestToJoinSquad(safeTeamId, currentUserId || '', { legalAcceptance });
      await refetch();
      Alert.alert(t('squad.join.successTitle', 'Demande envoyée'), t('squad.join.successMessage', 'Le capitaine a recu votre demande.'));
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('squad.join.error', 'Impossible d\'envoyer la demande.'));
    } finally {
      setIsUpdating(false);
    }
  }, [currentUserId, refetch, requestLeagueLegalAcceptance, safeTeamId, t, team?.name]);

  const handleCancelJoinRequest = useCallback(async () => {
    try {
      if (!safeTeamId || !currentUserId) {
        Alert.alert(t('common.error'), t('squad.join.cancelError', 'Impossible d\'annuler la demande.'));
        return;
      }
      setIsUpdating(true);
      await cancelJoinRequest(safeTeamId, currentUserId || '');
      await refetch();
      Alert.alert(
        t('squad.join.cancelSuccessTitle', 'Demande annulée'),
        t('squad.join.cancelSuccessMessage', 'Votre demande à rejoindre la squad a bien été annulée.'),
      );
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('squad.join.cancelError', 'Impossible d\'annuler la demande.'));
    } finally {
      setIsUpdating(false);
    }
  }, [currentUserId, refetch, safeTeamId, t]);

  const handleRespondToInvitation = useCallback(async (accept) => {
    try {
      if (!safeTeamId || !currentUserId) {
        Alert.alert(t('common.error'), t('squad.invitation.error', 'Impossible de repondre a l invitation.'));
        return;
      }

      let legalAcceptance = null;
      if (accept) {
        legalAcceptance = await requestLeagueLegalAcceptance({
          metadata: {
            teamName: team?.name || null,
          },
          scope: LEAGUE_LEGAL_SCOPES.TEAM_INVITATION_ACCEPT,
          sourceScreen: 'squad_details_invitation_accept',
          targetDocumentId: safeTeamId,
          targetLabel: team?.name || 'Squad League',
          targetType: 'league_team',
        });
        if (!legalAcceptance) return;
      }

      setIsUpdating(true);
      await respondToSquadInvite(safeTeamId, currentUserId || '', accept, { legalAcceptance });
      await refetch();
      Alert.alert(
        accept
          ? t('squad.invitation.acceptTitle', 'Invitation acceptee')
          : t('squad.invitation.declineTitle', 'Invitation refusee'),
        accept
          ? t('squad.invitation.acceptMessage', 'Vous avez rejoint la squad.')
          : t('squad.invitation.declineMessage', 'Vous avez decline cette invitation.'),
      );
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('squad.invitation.error', 'Impossible de repondre a l invitation.'));
    } finally {
      setIsUpdating(false);
    }
  }, [currentUserId, refetch, requestLeagueLegalAcceptance, safeTeamId, t, team?.name]);

  const handleOpenCaptainAssignment = useCallback((player) => {
    if (!player || captainAssignmentMode) return;
    setCaptainAssignmentTarget(player);
  }, [captainAssignmentMode]);

  const handleCloseCaptainAssignment = useCallback(() => {
    if (captainAssignmentMode) return;
    setCaptainAssignmentTarget(null);
  }, [captainAssignmentMode]);

  const handleAssignCaptain = useCallback(async (mode) => {
    const targetId = getEntityDocumentId(captainAssignmentTarget);
    if (!safeTeamId || !targetId) {
      Alert.alert(t('common.error', 'Erreur'), t('squadDetails.captains.assignError', 'Impossible de mettre a jour les capitaines.'));
      return;
    }

    try {
      setCaptainAssignmentMode(mode);
      await assignSquadCaptain(safeTeamId, targetId, mode);
      await Promise.allSettled([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['leagueTeam', safeTeamId] }),
        queryClient.invalidateQueries({ queryKey: ['myLeagueTeam'] }),
        queryClient.invalidateQueries({ queryKey: ['league-matches'] }),
        queryClient.invalidateQueries({ queryKey: ['pendingLeagueAction'] }),
        currentUserId
          ? queryClient.invalidateQueries({ queryKey: ['myLeagueTeam', currentUserId] })
          : Promise.resolve(),
      ]);
      setCaptainAssignmentTarget(null);
      Alert.alert(
        t('squadDetails.captains.assignSuccessTitle', 'Capitaines mis a jour'),
        mode === 'transfer'
          ? t('squadDetails.captains.transferSuccess', '{{name}} devient le seul capitaine de la squad.', { name: captainAssignmentTargetName })
          : t('squadDetails.captains.addSuccess', '{{name}} est maintenant capitaine avec vous.', { name: captainAssignmentTargetName }),
      );
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error', 'Erreur'), t('squadDetails.captains.assignError', 'Impossible de mettre a jour les capitaines.'));
    } finally {
      setCaptainAssignmentMode('');
    }
  }, [
    captainAssignmentTarget,
    captainAssignmentTargetName,
    currentUserId,
    queryClient,
    refetch,
    safeTeamId,
    t,
  ]);

  /**
   * @param {'logo' | 'cover'} type
   */
  const handleImageUpload = (type) => { // type: 'logo' (mapped to crest) | 'cover'
    Alert.alert(
      'Modifier la photo',
      'Choisissez une option',
      [
        {
          onPress: () => openImagePicker(type, 'camera'),
          text: 'Camera',
        },
        {
          onPress: () => openImagePicker(type, 'library'),
          text: 'Galerie',
        },
        {
          style: 'cancel',
          text: 'Annuler',
        },
      ],
    );
  };

  /**
   * @param {'logo' | 'cover'} type
   * @param {'camera' | 'library'} source
   */
  const openImagePicker = async (type, source) => {
    try {
      const cameraOptions = /** @type {import('react-native-image-picker').CameraOptions} */ ({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      });
      const libraryOptions = /** @type {import('react-native-image-picker').ImageLibraryOptions} */ ({
        mediaType: 'photo',
        quality: 0.8,
      });

      const result = source === 'camera'
        ? await launchCamera(cameraOptions)
        : await launchImageLibrary(libraryOptions);

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file = {
          filename: asset.fileName || 'photo.jpg',
          mime: asset.type || 'image/jpeg',
          uri: asset.uri,
        };

        setIsUpdating(true);
        const payload = {
          documentId: safeTeamId,
          [type]: file, // Service maps 'logo' to 'crest'
        };

        await updateLeagueTeam(/** @type {any} */ (payload));
        await refetch();
        setIsUpdating(false);
      }
    } catch (e) {
      setIsUpdating(false);
      console.error(e);
      const pickerError = /** @type {{ code?: string }} */ (e);
      if (pickerError?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Erreur', 'Impossible de mettre à jour l\'image');
      }
    }
  };

  const handleSaveSlot = async (
    /** @type {{ day: string, startTime: string, endTime: string } | { day: string, startTime: string, endTime: string }[]} */ slotInput,
  ) => {
    let slotsToSave = [];
    if (Array.isArray(slotInput)) {
      slotsToSave = slotInput.filter(Boolean);
    } else if (slotInput) {
      slotsToSave = [slotInput];
    }
    if (slotsToSave.length === 0) return;

    try {
      setIsUpdating(true);

      if (editingSlot) {
        const slotData = slotsToSave[0];
        const editingSlotId = getEntityDocumentId(editingSlot);
        if (!editingSlotId) {
          throw new Error('Missing slot id');
        }

        const payload = {
          end_hour: `${slotData.endTime}:00`,
          league_team: safeTeamId,
          recurrence_day: slotData.day,
          start_hour: `${slotData.startTime}:00`,
          status: 'open',
        };

        await updateTeamSlot(editingSlotId, payload);
        Alert.alert(
          t('common.success', 'Succès'),
          t('squadDetails.slots.updated', 'Créneau modifié'),
        );
      } else {
        await Promise.all(
          slotsToSave.map((slotData) => {
            const payload = {
              end_hour: `${slotData.endTime}:00`,
              league_team: safeTeamId,
              recurrence_day: slotData.day,
              start_hour: `${slotData.startTime}:00`,
              status: 'open',
            };
            return createTeamSlot(payload);
          }),
        );

        Alert.alert(
          t('common.success', 'Succès'),
          slotsToSave.length > 1
            ? t('squadDetails.slots.multipleAdded', '{{count}} créneaux ajoutes', { count: slotsToSave.length })
            : t('squadDetails.slots.added', 'Créneau ajouté'),
        );
      }

      await refetch();
      setIsSlotModalVisible(false);
      setEditingSlot(null);
      setIsUpdating(false);
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.saveError', 'Impossible de sauvegarder le créneau'),
      );
    }
  };

  const handleDeleteSlot = async (/** @type {LeagueSlot} */ slot) => {
    try {
      setIsUpdating(true);
      const slotId = getEntityDocumentId(slot);
      if (!slotId) {
        throw new Error('Missing slot id');
      }
      await deleteTeamSlot(slotId);
      await refetch();
      setIsSlotModalVisible(false);
      setEditingSlot(null);
      setIsUpdating(false);
      Alert.alert(
        t('common.success', 'Succès'),
        t('squadDetails.slots.deleted', 'Créneau supprimé'),
      );
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.deleteError', 'Impossible de supprimer le créneau'),
      );
    }
  };

  const handleSlotPress = (/** @type {LeagueSlot} */ slot) => {
    setEditingSlot(slot);
    setIsSlotModalVisible(true);
  };

  const navigateToLeagueMatchCenter = useCallback((params = {}) => {
    let targetNavigation = navigation;
    let leagueHomeNavigation = null;

    while (targetNavigation) {
      const routeNames = targetNavigation.getState?.()?.routeNames || [];
      if (routeNames.includes(RouteNames.LeagueMatchTab)) {
        targetNavigation.navigate(RouteNames.LeagueMatchTab, params);
        return;
      }
      if (routeNames.includes(RouteNames.LeagueHomeTab)) {
        leagueHomeNavigation = targetNavigation;
      }
      targetNavigation = targetNavigation.getParent?.();
    }

    (leagueHomeNavigation || navigation).navigate(RouteNames.LeagueHomeTab, {
      params,
      screen: RouteNames.LeagueMatchTab,
    });
  }, [navigation]);

  const refreshMatchmakingStatusAfterCheckIn = useCallback(async () => {
    if (!safeTeamId) return;

    try {
      const status = await MatchmakingService.getActiveRequest(safeTeamId);
      if (!shouldRevealMatchmakingStatus(status)) return;

      const matchId = resolveMatchmakingStatusMatchId(status);
      navigateToLeagueMatchCenter({
        activeSquadId: safeTeamId,
        ...(matchId ? { matchId } : {}),
        squadSwitchToken: String(Date.now()),
      });
    } catch {
      // The check-in itself succeeded; Match Center will refresh again on focus.
    }
  }, [navigateToLeagueMatchCenter, safeTeamId]);

  const handleCheckIn = async (/** @type {LeagueSlot} */ slot) => {
    try {
      if (!currentUserId) return;
      if (!isMember) {
        Alert.alert(
          t('squadDetails.actions.unavailableTitle', 'Action non disponible'),
          t('squadDetails.slots.joinHint', 'Rejoignez la squad pour participer aux créneaux.'),
        );
        return;
      }
      // Check if already participant
      const isCheckedIn = slot.participants?.some((/** @type {User} */ p) => p.documentId === currentUser?.documentId);

      // Strapi v5 Connect/Disconnect syntax
      const payload = {
        participants: {
          [isCheckedIn ? 'disconnect' : 'connect']: [{ documentId: currentUserId }],
        },
      };

      const slotId = getEntityDocumentId(slot);
      if (!slotId) {
        throw new Error('Missing slot id');
      }
      await updateTeamSlot(slotId, payload);
      await refetch(); // Refresh UI
      if (!isCheckedIn) {
        await refreshMatchmakingStatusAfterCheckIn();
      }
    } catch (e) {
      console.error(e);
      const errorLike = /** @type {any} */ (e);
      const backendCode = errorLike?.response?.data?.code
            || errorLike?.response?.data?.error?.details?.code
            || errorLike?.response?.data?.error?.code;
      if (backendCode === 'SQUAD_MEMBERSHIP_REQUIRED') {
        Alert.alert(
          t('squadDetails.actions.unavailableTitle', 'Action non disponible'),
          t('squadDetails.slots.joinHint', 'Rejoignez la squad pour participer aux créneaux.'),
        );
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.statusError', 'Impossible de modifier votre statut.'),
      );
    }
  };

  const handleScrollToSection = useCallback((sectionKey) => {
    const targetOffset = sectionOffsets?.[sectionKey];
    if (!Number.isFinite(targetOffset)) return;
    scrollRef.current?.scrollTo?.({
      animated: true,
      y: Math.max(0, targetOffset - 24),
    });
  }, [sectionOffsets]);

  const handleRegisterSection = useCallback((sectionKey, y) => {
    setSectionOffsets((prev) => (
      prev?.[sectionKey] === y
        ? prev
        : { ...prev, [sectionKey]: y }
    ));
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([
      refetch(),
      canViewStatistics ? refetchLeaguePerformanceStats() : Promise.resolve(null),
      canViewStatistics && team?.division ? refetchRanking() : Promise.resolve(null),
    ]);
  }, [canViewStatistics, refetch, refetchLeaguePerformanceStats, refetchRanking, team?.division]);

  const handleOpenStatisticsMatch = useCallback((matchDocumentId) => {
    if (!matchDocumentId) return;
    navigation.navigate(RouteNames.LeagueMatchDetails, { matchId: matchDocumentId });
  }, [navigation]);

  const handleOpenStatisticsScreen = useCallback(() => {
    handleScrollToSection('statistics');
  }, [handleScrollToSection]);

  const handleOpenFullHistory = useCallback(() => {
    navigation.navigate(RouteNames.MatchHistoryScreen);
  }, [navigation]);

  useEffect(() => {
    let timeoutId = null;

    if (focusSection && !(focusSection === 'statistics' && !canViewStatistics)) {
      const targetOffset = sectionOffsets?.[focusSection];

      if (Number.isFinite(targetOffset)) {
        timeoutId = setTimeout(() => {
          scrollRef.current?.scrollTo?.({
            animated: true,
            y: Math.max(0, targetOffset - 24),
          });
          navigation.setParams?.({ focusSection: undefined });
        }, 80);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [canViewStatistics, focusSection, navigation, sectionOffsets]);

  const refreshLeagueTeamCachesAfterDelete = useCallback(async () => {
    queryClient.removeQueries({ queryKey: ['leagueTeam', safeTeamId] });
    queryClient.removeQueries({ queryKey: ['leagueTeamPerformanceStats', safeTeamId] });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leagueTeam'] }),
      queryClient.invalidateQueries({ queryKey: ['myLeagueTeam'] }),
      queryClient.invalidateQueries({ queryKey: ['pendingLeagueTeams'] }),
      queryClient.invalidateQueries({ queryKey: ['invitedLeagueTeams'] }),
      queryClient.invalidateQueries({ queryKey: ['league-matches'] }),
      queryClient.invalidateQueries({ queryKey: ['pendingLeagueAction'] }),
      currentUserId
        ? queryClient.invalidateQueries({ queryKey: ['myLeagueTeam', currentUserId] })
        : Promise.resolve(),
    ]);
  }, [currentUserId, queryClient, safeTeamId]);

  const resetToLeagueHome = useCallback(() => {
    let rootNavigation = navigation;
    while (rootNavigation?.getParent?.()) {
      rootNavigation = rootNavigation.getParent();
    }

    if (rootNavigation?.reset) {
      rootNavigation.reset({
        index: 0,
        routes: [{ name: RouteNames.LeagueHomeTab }],
      });
      return;
    }

    navigation.navigate(RouteNames.LeagueHomeTab, { screen: RouteNames.LeagueDashboard });
  }, [navigation]);

  const handleDeleteTeam = useCallback(() => {
    const teamDisplayName = String(team?.name || '').trim() || t('squadDetails.defaultName', 'Squad');
    Alert.alert(
      t('squadDetails.delete.title', 'Supprimer la squad'),
      t('squadDetails.delete.confirmationWithName', {
        defaultValue: `Êtes-vous sûr de vouloir supprimer la squad "${teamDisplayName}" ? Cette action est irréversible.`,
        teamName: teamDisplayName,
      }),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: async () => {
            try {
              setIsUpdating(true);
              await deleteLeagueTeam(safeTeamId);
              await refreshLeagueTeamCachesAfterDelete();
              resetToLeagueHome();
            } catch (error) {
              console.error(error);
              Alert.alert(
                t('common.error', 'Erreur'),
                t('squadDetails.actions.deleteTeamError', 'Impossible de supprimer la squad.'),
              );
            } finally {
              setIsUpdating(false);
            }
          },
          style: 'destructive',
          text: t('squadDetails.actions.deleteTeam', 'Supprimer la squad'),
        },
      ],
    );
  }, [refreshLeagueTeamCachesAfterDelete, resetToLeagueHome, safeTeamId, t, team?.name]);

  const handleLeaveSquad = useCallback(() => {
    const teamDisplayName = String(team?.name || '').trim() || t('squadDetails.defaultName', 'Squad');
    Alert.alert(
      t('squadDetails.leave.title', 'Quitter la squad'),
      t('squadDetails.leave.confirmationWithName', {
        defaultValue: `Voulez-vous quitter la squad "${teamDisplayName}" ? Si vous etes le dernier membre, elle sera archivee apres 7 jours.`,
        teamName: teamDisplayName,
      }),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: async () => {
            try {
              setIsUpdating(true);
              await leaveSquad(safeTeamId);
              await refreshLeagueTeamCachesAfterDelete();
              resetToLeagueHome();
            } catch (error) {
              console.error(error);
              Alert.alert(
                t('common.error', 'Erreur'),
                t('squadDetails.actions.leaveTeamError', 'Impossible de quitter la squad.'),
              );
            } finally {
              setIsUpdating(false);
            }
          },
          style: 'destructive',
          text: t('squadDetails.actions.leaveTeam', 'Quitter la squad'),
        },
      ],
    );
  }, [refreshLeagueTeamCachesAfterDelete, resetToLeagueHome, safeTeamId, t, team?.name]);

  const handleRemoveMember = useCallback((/** @type {User} */ player) => {
    const targetId = getEntityDocumentId(player);
    if (!targetId) return;

    const playerName = getPlayerDisplayName(player);
    Alert.alert(
      t('squadDetails.roster.removeTitle', 'Retirer le joueur'),
      t('squadDetails.roster.removeConfirmation', {
        defaultValue: `Retirer ${playerName} de la squad ?`,
        playerName,
      }),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: async () => {
            try {
              setIsUpdating(true);
              await removeSquadMember(safeTeamId, targetId);
              await Promise.allSettled([
                refetch(),
                queryClient.invalidateQueries({ queryKey: ['leagueTeam', safeTeamId] }),
                queryClient.invalidateQueries({ queryKey: ['myLeagueTeam'] }),
                queryClient.invalidateQueries({ queryKey: ['league-matches'] }),
                queryClient.invalidateQueries({ queryKey: ['pendingLeagueAction'] }),
                currentUserId
                  ? queryClient.invalidateQueries({ queryKey: ['myLeagueTeam', currentUserId] })
                  : Promise.resolve(),
              ]);
            } catch (error) {
              console.error(error);
              Alert.alert(
                t('common.error', 'Erreur'),
                t('squadDetails.roster.removeError', 'Impossible de retirer ce joueur.'),
              );
            } finally {
              setIsUpdating(false);
            }
          },
          style: 'destructive',
          text: t('squadDetails.roster.removeAction', 'Retirer'),
        },
      ],
    );
  }, [
    currentUserId,
    getPlayerDisplayName,
    queryClient,
    refetch,
    safeTeamId,
    t,
  ]);

  const openRequests = useCallback(() => {
    navigation.navigate(RouteNames.SquadRequests, { teamId: safeTeamId });
  }, [navigation, safeTeamId]);

  const openCaptainActionsMenu = useCallback(() => {
    Alert.alert(
      t('squadDetails.actions.menuTitle', 'Actions équipe'),
      t('squadDetails.actions.menuDescription', 'Choisissez une action.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: handleShare,
          text: t('squadDetails.actions.invitePlayer', 'Inviter un joueur'),
        },
        {
          onPress: () => navigation.navigate(RouteNames.SquadEdit, { teamId: safeTeamId }),
          text: t('squadDetails.actions.editTeam', 'Modifier l\'équipe'),
        },
        {
          onPress: openRequests,
          text: t('squadDetails.actions.openRequests', 'Voir les demandes'),
        },
        {
          onPress: handleLeaveSquad,
          style: 'destructive',
          text: t('squadDetails.actions.leaveTeam', 'Quitter la squad'),
        },
        {
          onPress: handleDeleteTeam,
          style: 'destructive',
          text: t('squadDetails.actions.deleteTeam', 'Supprimer la squad'),
        },
      ],
    );
  }, [handleDeleteTeam, handleLeaveSquad, handleShare, navigation, openRequests, safeTeamId, t]);

  const dynamicSummaryLabel = useMemo(() => {
    if (isCaptain) return 'Demandes';
    if (team?.division) return 'Division';
    return 'ELO matchmaking';
  }, [isCaptain, team?.division]);

  const dynamicSummaryValue = useMemo(() => {
    if (isCaptain) return `${pendingRequestsCount}`;
    if (team?.division) return `DIV ${team.division}`;
    return `${team?.elo || 0}`;
  }, [isCaptain, pendingRequestsCount, team?.division, team?.elo]);

  const summaryCards = useMemo(() => [
    {
      key: 'members',
      label: 'Effectif',
      value: `${rosterCount}`,
    },
    {
      key: 'slots',
      label: 'Cr\u00E9neaux',
      value: `${slotCount}`,
    },
    {
      key: 'next',
      label: 'Prochain',
      value: nextSlotShortLabel,
    },
    {
      key: 'dynamic',
      label: dynamicSummaryLabel,
      value: dynamicSummaryValue,
    },
  ], [dynamicSummaryLabel, dynamicSummaryValue, nextSlotShortLabel, rosterCount, slotCount]);

  const actionCard = useMemo(() => {
    if (isCaptain) {
      let description = 'Ajoutez un premier cr\u00E9neau pour rendre la squad active.';
      if (pendingRequestsCount > 0) {
        description = (
          <>
            <Text style={{ color: Colors.gold500 }}>{pendingRequestsCount}</Text>
            {' '}
            demande
            {pendingRequestsCount > 1 ? 's' : ''}
            {' '}
            attend
            {pendingRequestsCount > 1 ? 'ent' : ''}
            {' '}
            votre validation.
          </>
        );
      } else if (slotCount > 0) {
        description = `Prochain cr\u00E9neau: ${nextSlotLongLabel}`;
      }
      const primaryLabel = slotCount > 0 ? 'Gerer les cr\u00E9neaux' : 'Ajouter un cr\u00E9neau';
      const primaryPress = slotCount > 0
        ? () => handleScrollToSection('slots')
        : () => setIsSlotModalVisible(true);
      const secondaryLabel = pendingRequestsCount > 0 ? 'Voir les demandes' : 'Inviter un joueur';
      const secondaryPress = pendingRequestsCount > 0
        ? openRequests
        : handleShare;
      const secondaryIsShareAction = pendingRequestsCount <= 0;

      return {
        description,
        primaryLabel,
        primaryPress,
        secondaryIsShareAction,
        secondaryLabel,
        secondaryPress,
        title: pendingRequestsCount > 0 ? 'Votre squad attend votre validation' : 'Pilotez votre squad',
      };
    }

    if (isMember) {
      return {
        description: slotCount > 0
          ? `Confirmez votre pr\u00E9sence sur ${nextSlotLongLabel}.`
          : 'Aucun cr\u00E9neau d\u00E9fini pour le moment. Revenez bient\u00F4t ou contactez le capitaine.',
        primaryLabel: slotCount > 0 ? 'Voir les cr\u00E9neaux' : "Voir l'effectif",
        primaryPress: () => handleScrollToSection(slotCount > 0 ? 'slots' : 'effectif'),
        secondaryLabel: canViewStatistics ? 'Voir les stats' : "Voir l'effectif",
        secondaryPress: canViewStatistics ? handleOpenStatisticsScreen : () => handleScrollToSection('effectif'),
        title: 'Votre prochaine action',
      };
    }

    if (hasInvitation) {
      return {
        description: 'Une invitation vous attend. Acceptez-la pour rejoindre la squad et participer aux prochains cr\u00E9neaux.',
        primaryLabel: 'Accepter',
        primaryPress: () => handleRespondToInvitation(true),
        secondaryLabel: 'Refuser',
        secondaryPress: () => handleRespondToInvitation(false),
        title: 'Invitation recue',
      };
    }

    if (isShareInviteLink) {
      return {
        description: 'Ce lien vous invite a rejoindre directement la squad. Confirmez pour etre ajoute a l effectif.',
        primaryLabel: 'Rejoindre la squad',
        primaryPress: handleAcceptShareInviteLink,
        secondaryLabel: slotCount > 0 ? 'Voir les cr\u00E9neaux' : "Voir l'effectif",
        secondaryPress: () => handleScrollToSection(slotCount > 0 ? 'slots' : 'effectif'),
        title: 'Invitation squad',
      };
    }

    if (hasPendingRequest) {
      return {
        description: "Votre demande est bien envoy\u00E9e. Vous pouvez d\u00E9j\u00E0 consulter les cr\u00E9neaux et l'effectif.",
        primaryLabel: 'Annuler la demande',
        primaryPress: handleCancelJoinRequest,
        secondaryLabel: 'Voir les cr\u00E9neaux',
        secondaryPress: () => handleScrollToSection('slots'),
        title: 'Votre demande est en attente',
      };
    }

    return {
      description: slotCount > 0
        ? `La squad vit d\u00E9j\u00E0 autour de ${nextSlotLongLabel}. Rejoignez-la pour participer.`
        : "Rejoignez cette squad pour acc\u00E9der aux cr\u00E9neaux et \u00E0 l'effectif complet.",
      primaryLabel: 'Demander a rejoindre',
      primaryPress: handleRequestJoin,
      secondaryLabel: slotCount > 0 ? 'Voir les cr\u00E9neaux' : "Voir l'effectif",
      secondaryPress: () => handleScrollToSection(slotCount > 0 ? 'slots' : 'effectif'),
      title: 'Rejoignez cette squad',
    };
  }, [
    handleAcceptShareInviteLink,
    handleCancelJoinRequest,
    handleRequestJoin,
    handleRespondToInvitation,
    handleScrollToSection,
    handleShare,
    hasInvitation,
    hasPendingRequest,
    isCaptain,
    isMember,
    isShareInviteLink,
    nextSlotLongLabel,
    openRequests,
    pendingRequestsCount,
    slotCount,
    canViewStatistics,
    handleOpenStatisticsScreen,
    Colors.gold500,
  ]);

  const sectionShortcuts = useMemo(() => {
    const shortcuts = [];

    if (canViewStatistics) {
      shortcuts.push({
        key: 'statistics',
        label: 'Statistiques',
        onPress: handleOpenStatisticsScreen,
      });
    }

    shortcuts.push(
      {
        key: 'slots',
        label: 'Cr\u00E9neaux',
        onPress: () => handleScrollToSection('slots'),
      },
      {
        key: 'effectif',
        label: 'Effectif',
        onPress: () => handleScrollToSection('effectif'),
      },
    );

    if (isCaptain) {
      shortcuts.push({
        key: 'requests',
        label: 'Demandes',
        onPress: openRequests,
      });
    }

    return shortcuts;
  }, [canViewStatistics, handleOpenStatisticsScreen, handleScrollToSection, isCaptain, openRequests]);

  const heroAnimatedStyle = useMemo(() => ({
    opacity: heroEntry,
    transform: [
      {
        translateY: heroEntry.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  }), [heroEntry]);

  const bodyAnimatedStyle = useMemo(() => ({
    opacity: bodyEntry,
    transform: [
      {
        translateY: bodyEntry.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  }), [bodyEntry]);

  if (!safeTeamId) {
    return (
      <LeagueStateView
        actionLabel="Retour"
        description="L'identifiant de la squad est manquant. Ouvrez la fiche depuis la recherche League ou le dashboard."
        onAction={() => navigation.goBack()}
        title="Squad introuvable"
      />
    );
  }

  if (isLoading && !team) {
    return (
      <LeagueStateView
        description="Chargement de la fiche squad et des signaux League."
        isLoading
        title="Chargement de la squad"
      />
    );
  }

  if (teamError) {
    return (
      <LeagueStateView
        actionLabel="R\u00E9essayer"
        description="Impossible de charger cette squad League pour le moment. Relancez le chargement ou revenez a la recherche."
        onAction={() => refetch()}
        title="Chargement impossible"
      />
    );
  }

  if (!team) {
    return (
      <LeagueStateView
        actionLabel="Retour"
        description="Cette squad League est introuvable ou n'est plus disponible."
        onAction={() => navigation.goBack()}
        title="Squad indisponible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingVertical[12], Spaces.paddingHorizontal[4], { paddingBottom: scrollBottomPadding }]}
        ref={scrollRef}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={isLoading || isUpdating || isLeaguePerformanceFetching || isRankingFetching} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 16, marginTop: 4 }]}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                alignItems: 'center',
                backgroundColor: uiTone.topActionBg,
                borderColor: uiTone.topActionBorder,
                borderRadius: 16,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
                minWidth: 44,
                paddingHorizontal: 10,
              }}
            >
              <Image
                source={Images.share}
                style={[ApplicationStyle.icon24, { tintColor: Colors.primary500 }]}
              />
            </TouchableOpacity>
            {isCaptain && pendingRequestsCount > 0 ? (
              <TouchableOpacity
                onPress={openRequests}
                style={{
                  alignItems: 'center',
                  backgroundColor: `${Colors.error500}12`,
                  borderColor: `${Colors.error500}45`,
                  borderRadius: 16,
                  borderWidth: 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  minHeight: 44,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                  Demandes
                </Text>
                <View style={{
                  alignItems: 'center',
                  backgroundColor: Colors.error500,
                  borderRadius: 999,
                  height: 20,
                  justifyContent: 'center',
                  marginLeft: 8,
                  minWidth: 20,
                  paddingHorizontal: 6,
                }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                    {pendingRequestsCount}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
            {isCaptain ? (
              <TouchableOpacity
                onPress={openCaptainActionsMenu}
                style={{
                  alignItems: 'center',
                  backgroundColor: uiTone.topActionBg,
                  borderColor: uiTone.topActionBorder,
                  borderRadius: 16,
                  borderWidth: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                  minWidth: 44,
                  paddingHorizontal: 10,
                }}
              >
                <>
                  <Text style={[Fonts.h3, { color: Colors.primary500 }]}>...</Text>
                  {pendingRequestsCount > 0 ? (
                    <View style={{
                      backgroundColor: Colors.error500,
                      borderRadius: 4,
                      height: 8,
                      position: 'absolute',
                      right: 10,
                      top: 10,
                      width: 8,
                    }}
                    />
                  ) : null}
                </>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Header / Identity */}
        <View style={[Alignments.alignCenter, { marginBottom: 20, marginTop: 4 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.primary500, letterSpacing: 1.2, marginBottom: 8 }]}>SQUAD</Text>
          <Text style={[Fonts.h1Bold, { color: Colors.neutral00, marginBottom: 8, textAlign: 'center' }]}>{team?.name}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>{locationLabel}</Text>
        </View>

        {isCaptain && pendingRequestsCount > 0 ? (
          <TouchableOpacity
            onPress={openRequests}
            style={{
              backgroundColor: `${Colors.error500}12`,
              borderColor: `${Colors.error500}40`,
              borderRadius: 18,
              borderWidth: 1,
              marginBottom: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[Fonts.p2Bold, { color: Colors.error500, marginBottom: 4 }]}>
                  Validation capitaine en attente
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
                  {pendingRequestsCount}
                  {' '}
                  demande
                  {pendingRequestsCount > 1 ? 's' : ''}
                  {' '}
                  attendent votre réponse. Ouvrez la file pour accepter ou refuser rapidement.
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${Colors.error500}16`,
                  borderColor: `${Colors.error500}45`,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>Voir</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Info Card */}
        <Animated.View style={heroAnimatedStyle}>
          <TouchableOpacity
            activeOpacity={team?.cover?.url ? 0.9 : 1}
            onPress={() => {
              if (team?.cover?.url) setIsCoverPreviewVisible(true);
            }}
            style={[
              { marginBottom: 20, marginTop: 4 },
              {
                borderColor: uiTone.cardStroke,
                borderRadius: 20,
                borderWidth: 1,
                overflow: 'hidden',
              }, // Ensure border radius clips background
            ]}
          >
            <ImageBackground
              imageStyle={{ opacity: 0.6 }} // Dim background image for readability
              source={team?.cover?.url ? { uri: getImageUrl(team.cover.url) } : undefined}
              style={[
                !team?.cover?.url && { backgroundColor: leagueCardBg },
                Alignments.alignCenter,
                {
                  justifyContent: 'center',
                  minHeight: 158,
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                },
              ]}
            >
              {/* Overlay for better readability if image exists */}
              {team?.cover?.url && (
              <View style={{
                ...Alignments.absolute,
                backgroundColor: uiTone.overlayBg,
                zIndex: -1,
              }}
              />
              )}

              {/* Edit Cover Button (If simple card or captain) */}
              {isCaptain && (
              <View style={{
                left: 12, position: 'absolute', top: 12, zIndex: 10,
              }}
              >
                <TouchableOpacity
                  hitSlop={{
                    bottom: 8, left: 8, right: 8, top: 8,
                  }}
                  onPress={() => handleImageUpload('cover')}
                  style={{ alignItems: 'center' }}
                >
                  {/* Plus icon */}
                  <View style={{
                    alignItems: 'center',
                    backgroundColor: uiTone.editButtonBg,
                    borderColor: uiTone.editButtonBorder,
                    borderRadius: 18,
                    borderWidth: 1,
                    height: 34,
                    justifyContent: 'center',
                    width: 34,
                  }}
                  >
                    <Image
                      source={Images.plus}
                      style={[ApplicationStyle.icon16, { tintColor: Colors.primary500 }]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
              )}

              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {/* Logo or Shield (Using CREST for League Squad) */}
                  <View>
                    {team?.crest?.url ? (
                      <ProfileAvatar
                        imageUrl={team.crest.url}
                        size={72}
                        style={{ borderColor: Colors.primary200, borderRadius: 72, borderWidth: 2 }}
                        variant="logo"
                      />
                    ) : (
                      <TeamShield
                        initials={getClubInitials(team?.name || '')}
                        isGold
                        size={72}
                      />
                    )}

                    {/* Add Logo Button (Next to shield as requested) */}
                    {isCaptain && !team?.crest?.url && (
                      <TouchableOpacity
                        hitSlop={{
                          bottom: 8, left: 8, right: 8, top: 8,
                        }}
                        onPress={() => handleImageUpload('logo')}
                        style={{
                          alignItems: 'center',
                          backgroundColor: uiTone.editButtonBg,
                          borderColor: uiTone.editButtonBorder,
                          borderRadius: 15,
                          borderWidth: 1,
                          bottom: -1,
                          height: 30,
                          justifyContent: 'center',
                          position: 'absolute',
                          right: -8,
                          width: 30,
                        }}
                      >
                        <Image
                          source={Images.plus}
                          style={[ApplicationStyle.icon16, { height: 12, tintColor: Colors.primary500, width: 12 }]}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* League badges */}
                <View style={[
                  Alignments.row,
                  Alignments.wrap,
                  Alignments.justifyCenter,
                  Alignments.alignCenter,
                  Spaces.gap[10],
                  { marginBottom: 12, minHeight: 40 },
                ]}
                >
                  {team?.division ? (
                    <DivisionBadge
                      division={team.division}
                      showChrome={false}
                      showLabel={false}
                      size={42}
                    />
                  ) : null}
                  {team?.elo ? (
                    <View style={{
                      alignItems: 'center',
                      backgroundColor: uiTone.chipInfoBg,
                      borderColor: uiTone.chipInfoBorder,
                      borderRadius: 999,
                      borderWidth: 1,
                      justifyContent: 'center',
                      minHeight: 36,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                    }}
                    >
                      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
                        {team.elo}
                        {' '}
                        ELO matchmaking
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{
                  alignItems: 'center',
                  alignSelf: 'center',
                  backgroundColor: squadStatusChip.tone === 'gold' ? uiTone.captainBadgeBg : uiTone.chipInfoBg,
                  borderColor: squadStatusChip.tone === 'gold' ? uiTone.captainBadgeBorder : uiTone.chipInfoBorder,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: squadStatusChip.tone === 'gold' ? Colors.gold500 : Colors.primary100 }]}>
                    {squadStatusChip.label}
                  </Text>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={bodyAnimatedStyle}>
          <View style={{ marginBottom: 20 }}>
            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12], Spaces.marginBottom[16]]}>
              {summaryCards.map((item) => (
                <View
                  key={item.key}
                  style={{
                    backgroundColor: uiTone.summaryCardBg,
                    borderColor: uiTone.summaryCardBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    minWidth: '47%',
                    padding: 14,
                    width: '47%',
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 8 }]}>{item.label}</Text>
                  <Text
                    numberOfLines={2}
                    style={[Fonts.h4Bold, { color: Colors.gold500 }]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{
              backgroundColor: uiTone.quickActionBg,
              borderColor: uiTone.quickActionBorder,
              borderRadius: 18,
              borderWidth: 1,
              padding: 14,
            }}
            >
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00, marginBottom: 8 }]}>{actionCard.title}</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 14 }]}>{actionCard.description}</Text>
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <Button
                  isLoading={isUpdating}
                  onPress={actionCard.primaryPress}
                  size="sm"
                  style={{ flex: 1 }}
                  title={actionCard.primaryLabel}
                  variant="Primary"
                />
                <Button
                  isLoading={actionCard.secondaryIsShareAction ? false : isUpdating}
                  onPress={actionCard.secondaryPress}
                  size="sm"
                  style={{ flex: 1 }}
                  title={actionCard.secondaryLabel}
                  variant="Secondary"
                />
              </View>
            </View>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], { marginTop: 14 }]}>
              {sectionShortcuts.map((shortcut) => (
                <TouchableOpacity
                  key={shortcut.key}
                  onPress={shortcut.onPress}
                  style={{
                    backgroundColor: `${Colors.primary500}14`,
                    borderColor: `${Colors.primary500}36`,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>{shortcut.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {canViewStatistics ? (
            <View
              onLayout={(event) => handleRegisterSection('statistics', event.nativeEvent.layout.y)}
              style={{ marginBottom: 20 }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 12 }]}>
                {isPadelStatisticsMode
                  ? 'Suivez votre bilan League, votre position dans la division et l historique recent de la squad.'
                  : 'Retrouvez vos indicateurs League et les statistiques post-match de la squad au m\u00EAme endroit.'}
              </Text>

              <View style={{
                backgroundColor: uiTone.insightCardBg,
                borderColor: uiTone.insightCardBorder,
                borderRadius: 16,
                borderWidth: 1,
                marginBottom: 14,
                padding: 14,
              }}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                  <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Statistiques</Text>
                  <View style={{
                    backgroundColor: `${Colors.primary500}14`,
                    borderColor: `${Colors.primary500}36`,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.primary100 }]}>
                      {statisticsModeLabel}
                    </Text>
                  </View>
                </View>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {isPadelStatisticsMode
                    ? 'La squad voit d\u00E9j\u00E0 ses r\u00E9sultats, son historique et ses indicateurs League. Les statistiques post-match d\u00E9taill\u00E9es padel arriveront dans un lot d\u00E9di\u00E9.'
                    : 'La squad suit ici sa comp\u00E9tition League, ses derniers matchs et les retours post-match publi\u00E9s.'}
                </Text>
              </View>

              <Text style={[Fonts.h3Bold, { color: Colors.neutral00, marginBottom: 12 }]}>Competition League</Text>
              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12], { marginBottom: 14 }]}>
                {competitionCards.map((item) => (
                  <View
                    key={item.key}
                    style={{
                      backgroundColor: uiTone.summaryCardBg,
                      borderColor: uiTone.summaryCardBorder,
                      borderRadius: 16,
                      borderWidth: 1,
                      minWidth: '47%',
                      padding: 14,
                      width: '47%',
                    }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 8 }]}>{item.label}</Text>
                    <Text
                      numberOfLines={2}
                      style={[Fonts.h4Bold, { color: Colors.gold500 }]}
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{
                backgroundColor: uiTone.insightCardBg,
                borderColor: uiTone.insightCardBorder,
                borderRadius: 16,
                borderWidth: 1,
                marginBottom: 14,
                padding: 14,
              }}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                  <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Historique des matchs</Text>
                  <TouchableOpacity onPress={handleOpenFullHistory}>
                    <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Voir tout</Text>
                  </TouchableOpacity>
                </View>

                {isLeaguePerformanceFetching && !hasRecentLeagueMatches ? (
                  <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>Chargement de l historique...</Text>
                ) : null}
                {!isLeaguePerformanceFetching && hasRecentLeagueMatches ? (
                  <View style={[Spaces.gap[10]]}>
                    {recentLeagueMatches.map((matchItem, index) => {
                      const resultMeta = getLeagueResultMeta(matchItem?.result, Colors);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          key={matchItem?.documentId || `league-history-${index}`}
                          onPress={() => handleOpenStatisticsMatch(matchItem?.documentId)}
                          style={{
                            backgroundColor: uiTone.panelBg,
                            borderColor: uiTone.panelBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            padding: 14,
                          }}
                        >
                          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
                                {`vs ${matchItem?.opponent?.name || 'Adversaire'}`}
                              </Text>
                              <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                                {formatLeagueMatchDate(matchItem?.date)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 8 }}>
                              <View style={{
                                backgroundColor: resultMeta.backgroundColor,
                                borderColor: resultMeta.borderColor,
                                borderRadius: 999,
                                borderWidth: 1,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                              >
                                <Text style={[Fonts.p4Bold, { color: resultMeta.textColor }]}>{resultMeta.label}</Text>
                              </View>
                              <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>
                                {`${Number(matchItem?.scoreFor || 0)} - ${Number(matchItem?.scoreAgainst || 0)}`}
                              </Text>
                            </View>
                          </View>
                          {matchItem?.eloChange ? (
                            <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                              {`${matchItem.eloChange > 0 ? '+' : ''}${matchItem.eloChange} ELO matchmaking`}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                {!isLeaguePerformanceFetching && !hasRecentLeagueMatches ? (
                  <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
                    Aucun match League joue pour le moment.
                  </Text>
                ) : null}
              </View>

              {isPadelStatisticsMode ? (
                <View style={{
                  backgroundColor: uiTone.insightCardBg,
                  borderColor: uiTone.insightCardBorder,
                  borderRadius: 16,
                  borderWidth: 1,
                  padding: 14,
                }}
                >
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Bilan compétition</Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 10 }]}>
                    Cet espace suit déjà les resultats League, votre classement et votre historique. Les statistiques post-match détaillées pour le padel ne sont pas encore actives dans cette V1.
                  </Text>
                  <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
                    <View style={{
                      backgroundColor: `${Colors.primary500}10`,
                      borderColor: `${Colors.primary500}30`,
                      borderRadius: 12,
                      borderWidth: 1,
                      minWidth: '30%',
                      padding: 10,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Matchs</Text>
                      <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{Number(leaguePerformanceSummary.matches || recentLeagueMatches.length || 0)}</Text>
                    </View>
                    <View style={{
                      backgroundColor: `${Colors.primary500}10`,
                      borderColor: `${Colors.primary500}30`,
                      borderRadius: 12,
                      borderWidth: 1,
                      minWidth: '30%',
                      padding: 10,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Score cumule</Text>
                      <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{`${leaguePerformanceSummary.scoreForTotal} - ${leaguePerformanceSummary.scoreAgainstTotal}`}</Text>
                    </View>
                    <View style={{
                      backgroundColor: `${Colors.primary500}10`,
                      borderColor: `${Colors.primary500}30`,
                      borderRadius: 12,
                      borderWidth: 1,
                      minWidth: '30%',
                      padding: 10,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Mode</Text>
                      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>League</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[Spaces.gap[14]]}>
                  <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Performance match</Text>

                  <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                    {[
                      { label: 'Matchs', value: leaguePerformanceSummary.matches },
                      { label: 'Minutes', value: leaguePerformanceSummary.minutesPlayed },
                      { label: 'Buts', value: leaguePerformanceSummary.goals },
                      { label: 'Passes D', value: leaguePerformanceSummary.assists },
                    ].map((stat) => (
                      <View
                        key={stat.label}
                        style={{
                          backgroundColor: uiTone.summaryCardBg,
                          borderColor: uiTone.summaryCardBorder,
                          borderRadius: 16,
                          borderWidth: 1,
                          minWidth: '47%',
                          padding: 14,
                          width: '47%',
                        }}
                      >
                        <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 8 }]}>{stat.label}</Text>
                        <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{stat.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{
                    backgroundColor: uiTone.insightCardBg,
                    borderColor: uiTone.insightCardBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    padding: 14,
                  }}
                  >
                    <Text style={[Fonts.p2Bold, { color: Colors.gold500, marginBottom: 4 }]}>
                      {`Score cumule: ${leaguePerformanceSummary.scoreForTotal} - ${leaguePerformanceSummary.scoreAgainstTotal}`}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                      {`${leaguePerformanceSummary.cleanSheets} clean sheets - ${leaguePerformanceSummary.scoreAgainstTotal} buts encaisses`}
                    </Text>
                  </View>

                  {(leaguePerformanceSummary.averageCollectiveRating !== null || leaguePerformanceSummary.playerCollectiveRatingAverage !== null) ? (
                    <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                      {leaguePerformanceSummary.averageCollectiveRating !== null ? (
                        <View
                          style={{
                            backgroundColor: uiTone.summaryCardBg,
                            borderColor: uiTone.summaryCardBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            minWidth: '47%',
                            padding: 14,
                            width: '47%',
                          }}
                        >
                          <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 8 }]}>Capitaine</Text>
                          <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{`${leaguePerformanceSummary.averageCollectiveRating}/10`}</Text>
                        </View>
                      ) : null}
                      {leaguePerformanceSummary.playerCollectiveRatingAverage !== null ? (
                        <View
                          style={{
                            backgroundColor: uiTone.summaryCardBg,
                            borderColor: uiTone.summaryCardBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            minWidth: '47%',
                            padding: 14,
                            width: '47%',
                          }}
                        >
                          <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 8 }]}>Joueurs</Text>
                          <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{`${leaguePerformanceSummary.playerCollectiveRatingAverage}/10`}</Text>
                          <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                            {`${leaguePerformanceSummary.playerCollectiveRatingCount} note${leaguePerformanceSummary.playerCollectiveRatingCount > 1 ? 's' : ''}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {leaguePendingMatches.length ? (
                    <View style={[Spaces.gap[10]]}>
                      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>Réponses joueur en attente de validation équipe</Text>
                      {leaguePendingMatches.map((pendingMatch, index) => (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          key={pendingMatch?.sourceDocumentId || `league-pending-${index}`}
                          onPress={() => handleOpenStatisticsMatch(pendingMatch?.sourceDocumentId)}
                          style={{
                            backgroundColor: uiTone.panelBg,
                            borderColor: uiTone.panelBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            padding: 14,
                          }}
                        >
                          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
                                {pendingMatch?.matchLabel || 'Match League'}
                              </Text>
                              <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                                {`${Number(pendingMatch?.submittedResponses || 0)}/${Number(pendingMatch?.eligibleCount || 0)} joueurs ont repondu`}
                              </Text>
                            </View>
                            <View style={{
                              backgroundColor: `${Colors.primary500}14`,
                              borderColor: `${Colors.primary500}36`,
                              borderRadius: 999,
                              borderWidth: 1,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                            }}
                            >
                              <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                                {pendingMatch?.reportStatus === 'draft' ? 'Brouillon \u00E9quipe' : 'En attente'}
                              </Text>
                            </View>
                          </View>
                          {pendingMatch?.lastSubmittedAt ? (
                            <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                              {`Derni\u00E8re r\u00E9ponse le ${new Date(pendingMatch.lastSubmittedAt).toLocaleString('fr-FR')}`}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {leagueRecentReports.length ? (
                    <View style={[Spaces.gap[10]]}>
                      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>Derniers matchs renseignes</Text>
                      {leagueRecentReports.map((report, index) => (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          key={report?.documentId || report?.sourceDocumentId || `league-report-${index}`}
                          onPress={() => handleOpenStatisticsMatch(report?.sourceDocumentId)}
                          style={{
                            backgroundColor: uiTone.panelBg,
                            borderColor: uiTone.panelBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            padding: 14,
                          }}
                        >
                          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
                                {report?.matchLabel || 'Match League'}
                              </Text>
                              <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                                {`${Number(report?.scoreFor || 0)} - ${Number(report?.scoreAgainst || 0)}`}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 8 }}>
                              <View style={{
                                backgroundColor: `${Colors.primary500}14`,
                                borderColor: `${Colors.primary500}36`,
                                borderRadius: 999,
                                borderWidth: 1,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                              >
                                <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                                  {report?.finalizedAt ? new Date(report.finalizedAt).toLocaleDateString('fr-FR') : 'Publie'}
                                </Text>
                              </View>
                              {report?.hasNewResponsesSincePublication ? (
                                <View style={{
                                  backgroundColor: `${Colors.success500}16`,
                                  borderColor: `${Colors.success500}40`,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                }}
                                >
                                  <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                                    {report?.newResponsesCount > 1 ? `${report.newResponsesCount} nouvelles r\u00E9ponses` : 'Nouvelle r\u00E9ponse'}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], { marginBottom: 8 }]}>
                            {report?.collectiveRating !== null && report?.collectiveRating !== undefined ? (
                              <View style={{
                                backgroundColor: `${Colors.primary500}10`,
                                borderColor: `${Colors.primary500}30`,
                                borderRadius: 999,
                                borderWidth: 1,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                              >
                                <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>{`Capitaine ${report.collectiveRating}/10`}</Text>
                              </View>
                            ) : null}
                            {report?.playerCollectiveRatingAverage !== null && report?.playerCollectiveRatingAverage !== undefined ? (
                              <View style={{
                                backgroundColor: `${Colors.primary500}10`,
                                borderColor: `${Colors.primary500}30`,
                                borderRadius: 999,
                                borderWidth: 1,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                              }}
                              >
                                <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>{`Joueurs ${report.playerCollectiveRatingAverage}/10`}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[Fonts.p4, { color: Colors.gold500 }]}>
                            {`${Number(report?.responseCompletionCount || 0)}/${Number(report?.responseEligibleCount || 0)} joueurs ont repondu`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {leaguePerformancePlayers.length ? (
                    <View style={[Spaces.gap[10]]}>
                      <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>Joueurs</Text>
                      {leaguePerformancePlayers.map((player, index) => (
                        <View
                          key={player?.documentId || player?.manualPlayerName || `league-player-${index}`}
                          style={{
                            backgroundColor: uiTone.panelBg,
                            borderColor: uiTone.panelBorder,
                            borderRadius: 16,
                            borderWidth: 1,
                            padding: 14,
                          }}
                        >
                          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1, paddingRight: 12 }]}>
                              {player?.manualPlayerName || `${player?.firstname || ''} ${player?.lastname || ''}`.trim() || 'Joueur'}
                            </Text>
                            <View style={{
                              backgroundColor: `${Colors.primary500}14`,
                              borderColor: `${Colors.primary500}36`,
                              borderRadius: 999,
                              borderWidth: 1,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                            }}
                            >
                              <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>{`${Number(player?.matches || 0)} matchs`}</Text>
                            </View>
                          </View>
                          <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                            {`${Number(player?.goals || 0)} buts - ${Number(player?.assists || 0)} passes - ${Number(player?.minutesPlayed || 0)} min`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {!leaguePerformancePlayers.length && !leagueRecentReports.length && !leaguePendingMatches.length && !isLeaguePerformanceFetching ? (
                    <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
                      Aucune performance de match disponible pour le moment.
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {/* Availability Slots */}
          <View
            onLayout={(event) => handleRegisterSection('slots', event.nativeEvent.layout.y)}
            style={{ marginBottom: 20 }}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 12 }]}>
              {isCaptain
                ? 'Ajoutez et animez vos cr\u00E9neaux pour rendre la squad visible et active.'
                : 'Consultez les prochains cr\u00E9neaux et confirmez votre pr\u00E9sence en un geste.'}
            </Text>
            <View style={{
              backgroundColor: uiTone.insightCardBg,
              borderColor: uiTone.insightCardBorder,
              borderRadius: 16,
              borderWidth: 1,
              marginBottom: 14,
              padding: 14,
            }}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 8 }]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>Prochain créneau</Text>
                <View style={{
                  backgroundColor: `${Colors.primary500}14`,
                  borderColor: `${Colors.primary500}36`,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary100 }]}>{nextSlotStatus.badge}</Text>
                </View>
              </View>
              <Text style={[Fonts.h3Bold, { color: Colors.gold500, marginBottom: 4 }]}>
                {nextSlot ? nextSlotLongLabel : 'Aucun cr\u00E9neau programm\u00E9'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginBottom: 14 }]}>
                {nextSlotStatus.helper}
              </Text>
              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                <View style={{
                  backgroundColor: `${Colors.primary500}10`,
                  borderColor: `${Colors.primary500}30`,
                  borderRadius: 12,
                  borderWidth: 1,
                  minWidth: '30%',
                  padding: 10,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Confirmes</Text>
                  <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>
                    {nextSlotParticipantsCount}
                    /5
                  </Text>
                </View>
                <View style={{
                  backgroundColor: `${Colors.primary500}10`,
                  borderColor: `${Colors.primary500}30`,
                  borderRadius: 12,
                  borderWidth: 1,
                  minWidth: '30%',
                  padding: 10,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Manquants</Text>
                  <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{nextSlot ? nextSlotRemainingCount : '-'}</Text>
                </View>
                <View style={{
                  backgroundColor: `${Colors.primary500}10`,
                  borderColor: `${Colors.primary500}30`,
                  borderRadius: 12,
                  borderWidth: 1,
                  minWidth: '30%',
                  padding: 10,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 4 }]}>Action</Text>
                  <Text numberOfLines={2} style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{nextSlotActionLabel}</Text>
                </View>
              </View>
            </View>
            <TeamSlotList
              currentUserId={currentUser?.documentId}
              isCaptain={isCaptain}
              isMember={Boolean(isMember)}
              layout="list"
              onAddSlot={() => setIsSlotModalVisible(true)}
              onCheckIn={handleCheckIn}
              onSlotPress={handleSlotPress}
              showMemberHelperText
              slots={team?.slots || []}
              surfaceTone="league"
            />
          </View>

          {/* Roster Preview */}
          <View
            onLayout={(event) => handleRegisterSection('effectif', event.nativeEvent.layout.y)}
            style={{ marginBottom: 24 }}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[12]]}>
              <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>
                {t('squadDetails.roster.title', 'Effectif')}
                {' ('}
                <Text style={{ color: Colors.gold500 }}>{rosterCount}</Text>
                )
              </Text>
            </View>
            <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 14 }]}>
              {isCaptain
                ? 'Retrouvez les capitaines, les membres actifs et ajustez la responsabilite de la squad.'
                : 'Voyez qui compose d\u00E9j\u00E0 la squad et identifiez rapidement les capitaines.'}
            </Text>
            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12], { marginBottom: 14 }]}>
              {rosterSignals.map((item) => {
                const isNumericSignal = ['invitations', 'members', 'requests'].includes(item.key);
                return (
                  <View
                    key={item.key}
                    style={{
                      backgroundColor: uiTone.insightCardBg,
                      borderColor: uiTone.insightCardBorder,
                      borderRadius: 14,
                      borderWidth: 1,
                      minWidth: '30%',
                      padding: 10,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.primary200, marginBottom: 6 }]}>{item.label}</Text>
                    <Text numberOfLines={2} style={[Fonts.p2Bold, { color: isNumericSignal ? Colors.gold500 : Colors.neutral00 }]}>{item.value}</Text>
                  </View>
                );
              })}
            </View>
            {isCaptain ? (
              <Text style={[Fonts.p3, { color: Colors.neutral200, marginBottom: 14 }]}>
                {pendingRequestsCount > 0
                  ? 'Le groupe est actif: pensez a traiter les demandes et inviter les bons profils.'
                  : 'Le groupe est stable. Vous pouvez encore inviter des joueurs pour enrichir la squad.'}
              </Text>
            ) : null}

            {rosterDisplayMembers.map((/** @type {User} */ player) => {
              const playerId = getEntityDocumentId(player);
              const playerIsCaptain = Boolean(playerId && captainIds.has(String(playerId)));
              const canAssignCaptain = Boolean(isCaptain && playerId && !playerIsCaptain);
              const isCurrentUserPlayer = Boolean(
                playerId && currentUserId && String(playerId) === String(currentUserId),
              );
              const canRemoveMember = Boolean(isCaptain && playerId && !isCurrentUserPlayer);
              const canLeaveFromRoster = Boolean(isMember && isCurrentUserPlayer);

              return (
                <View
                  key={playerId || getPlayerDisplayName(player)}
                  style={[
                    Alignments.row, Alignments.alignCenter, Spaces.gap[12],
                    Spaces.padding[12],
                    Spaces.marginBottom[12],
                    {
                      backgroundColor: playerIsCaptain ? uiTone.rosterCaptainBg : uiTone.rosterPlayerBg,
                      borderColor: playerIsCaptain ? uiTone.rosterCaptainBorder : uiTone.rosterPlayerBorder,
                      borderRadius: 14,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <ProfileAvatar imageUrl={player.avatar?.url} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                      {getPlayerDisplayName(player)}
                    </Text>
                    <View style={{
                      alignSelf: 'flex-start',
                      backgroundColor: playerIsCaptain ? uiTone.captainBadgeBg : uiTone.playerBadgeBg,
                      borderColor: playerIsCaptain ? uiTone.captainBadgeBorder : uiTone.playerBadgeBorder,
                      borderRadius: 999,
                      borderWidth: 1,
                      marginTop: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, { color: playerIsCaptain ? Colors.gold500 : Colors.primary100 }]}>
                        {playerIsCaptain
                          ? t('squadDetails.roster.captain', 'Capitaine')
                          : t('squadDetails.roster.player', 'Joueur')}
                      </Text>
                    </View>
                  </View>
                  {canAssignCaptain || canRemoveMember || canLeaveFromRoster ? (
                    <View style={{ gap: 8, minWidth: 98 }}>
                      {canAssignCaptain ? (
                        <Button
                          disabled={isUpdating}
                          onPress={() => handleOpenCaptainAssignment(player)}
                          size="sm"
                          title={t('squadDetails.captains.assignButton', 'Nommer')}
                          variant="Secondary"
                        />
                      ) : null}
                      {canRemoveMember ? (
                        <Button
                          disabled={isUpdating}
                          onPress={() => handleRemoveMember(player)}
                          size="sm"
                          title={t('squadDetails.roster.removeAction', 'Retirer')}
                          variant="Secondary"
                        />
                      ) : null}
                      {canLeaveFromRoster ? (
                        <Button
                          disabled={isUpdating}
                          onPress={handleLeaveSquad}
                          size="sm"
                          title={t('squadDetails.actions.leaveTeam', 'Quitter')}
                          variant="Secondary"
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Animated.View>

      </ScrollView>
      {shouldShowFixedJoinButton ? (
        <View
          style={{
            backgroundColor: 'rgba(3, 15, 25, 0.94)',
            borderColor: `${Colors.primary500}33`,
            borderRadius: 24,
            borderWidth: 1,
            bottom: fixedButtonBottomOffset,
            elevation: 12,
            left: 0,
            paddingHorizontal: 12,
            paddingVertical: 10,
            position: 'absolute',
            right: 0,
            shadowColor: Colors.primary900,
            shadowOffset: { height: 8, width: 0 },
            shadowOpacity: 0.28,
            shadowRadius: 18,
          }}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary100, marginBottom: 8, textAlign: 'center' }]}>
            {fixedJoinButtonHelperText}
          </Text>
          <Button
            disabled={isFixedJoinButtonDisabled}
            isLoading={!isFixedJoinButtonDisabled && isUpdating}
            onPress={isShareInviteLink ? handleAcceptShareInviteLink : handleRequestJoin}
            style={isFixedJoinButtonDisabled ? { opacity: 0.75 } : null}
            title={fixedJoinButtonTitle}
            variant="Primary"
          />
        </View>
      ) : null}
      <BottomModal
        close={handleCloseCaptainAssignment}
        headerComponent={(
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            {t('squadDetails.captains.modalTitle', 'Assigner capitaine')}
          </Text>
        )}
        isVisible={Boolean(captainAssignmentTarget)}
        snapPoints={captainAssignmentSnapPoints}
      >
        <View style={{ paddingHorizontal: 4, paddingTop: 6 }}>
          <Text
            style={[
              Fonts.p2,
              {
                color: Colors.neutral200,
                lineHeight: 22,
                marginBottom: 16,
                textAlign: 'center',
              },
            ]}
          >
            {t('squadDetails.captains.modalDescription', 'Choisissez comment donner le role de capitaine a {{name}}.', {
              name: captainAssignmentTargetName,
            })}
          </Text>

          <View
            style={{
              backgroundColor: uiTone.panelBg,
              borderColor: uiTone.panelBorder,
              borderRadius: 14,
              borderWidth: 1,
              marginBottom: 12,
              padding: 14,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
              {t('squadDetails.captains.addTitle', 'Ajouter un capitaine')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20, marginBottom: 12 }]}>
              {t('squadDetails.captains.addHint', 'Vous gardez votre role et la squad peut avoir plusieurs capitaines.')}
            </Text>
            <Button
              disabled={Boolean(captainAssignmentMode)}
              isLoading={captainAssignmentMode === 'add'}
              onPress={() => handleAssignCaptain('add')}
              title={t('squadDetails.captains.addAction', 'Ajouter comme capitaine')}
              variant="Primary"
            />
          </View>

          <View
            style={{
              backgroundColor: uiTone.panelBg,
              borderColor: uiTone.panelBorder,
              borderRadius: 14,
              borderWidth: 1,
              padding: 14,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 4 }]}>
              {t('squadDetails.captains.transferTitle', 'Laisser ma place')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20, marginBottom: 12 }]}>
              {t('squadDetails.captains.transferHint', '{{name}} devient le seul capitaine de la squad.', {
                name: captainAssignmentTargetName,
              })}
            </Text>
            <Button
              disabled={Boolean(captainAssignmentMode)}
              isLoading={captainAssignmentMode === 'transfer'}
              onPress={() => handleAssignCaptain('transfer')}
              title={t('squadDetails.captains.transferAction', 'Transferer le capitanat')}
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>
      <BottomModal
        close={() => setIsSlotModalVisible(false)}
        headerComponent={(
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            {editingSlot
              ? t('squadDetails.slots.editTitle', 'Modifier le créneau')
              : t('squadDetails.slots.addTitle', 'Ajouter un créneau')}
          </Text>
           )}
        isVisible={isSlotModalVisible}
        snapPoints={snapPoints}
      >
        <TeamSlotCreationForm
          initialValues={editingSlot ? {
            day: /** @type {any} */ (editingSlot)?.recurrence_day,
            endTime: /** @type {any} */ (editingSlot)?.end_hour?.substring(0, 5),
            startTime: /** @type {any} */ (editingSlot)?.start_hour?.substring(0, 5),
          } : null}
          onAdd={handleSaveSlot}
          onCancel={() => setIsSlotModalVisible(false)}
          onDelete={() => {
            // Fix for "Alert not attached to Activity" on Android
            setTimeout(() => {
              Alert.alert(
                t('common.confirmation', 'Confirmation'),
                t('squadDetails.slots.deleteConfirm', 'Voulez-vous vraiment supprimer ce créneau ?'),
                [
                  { style: 'cancel', text: t('common.cancel', 'Annuler') },
                  {
                    onPress: () => editingSlot && handleDeleteSlot(editingSlot),
                    style: 'destructive',
                    text: t('common.delete', 'Supprimer'),
                  },
                ],
              );
            }, 500);
          }}
        />
      </BottomModal>

      {leagueLegalAcceptanceModal}

      <ProfilePicturePreviewOverlay
        imageUrl={team?.cover?.url ? (getImageUrl(team.cover.url) || '') : ''}
        isVisible={isCoverPreviewVisible}
        onClose={() => setIsCoverPreviewVisible(false)}
      />
    </ScreenContainer>
  );
}

export default SquadDetailsScreen;
