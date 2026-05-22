import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  markOnboardingComplete,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import Loader from '@/components/atoms/loader/Loader';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import TeamLocationIcon from '@/components/atoms/SvgIcon/SvgIcon';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import StatRow from '@/components/molecules/statRow/StatRow';
import TeamSlotList from '@/components/molecules/teamSlotList/TeamSlotList';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { navigateToLeagueMatchDetails } from '@/views/league/match/utils/leagueNavigation';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { removeTrainerFromClub } from '@/services/auth/authService';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetTeamPerformanceStats } from '@/services/matchStats/matchStatsQueries';
import { useGetTeamStats } from '@/services/stats/statsQueries';
import { resetTeamStats } from '@/services/stats/statsService';
import { useGetTeam } from '@/services/team/teamQueries';
import {
  connectExternalCompetition,
  createFFBBErrorReport,
  leaveTeam,
  previewExternalCompetition,
  refreshExternalCompetition,
  removePlayerFromTeam,
  updateTeam,
} from '@/services/team/teamService';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { getErrorMessage as getDisplayErrorMessage } from '@/utils/errors/displayError';
import { getImageUrl } from '@/utils/imageUrl';

const TeamLocationIconView = /** @type {any} */ (TeamLocationIcon);

/**
 * @typedef {{ externalTeamId?: string | null; externalTeamName: string }} ExternalTeamOption
 * @typedef {{ externalTeamId?: string | null; externalTeamName: string; confidence?: string | null; reason?: string | null }} RecommendedExternalTeamOption
 * @typedef {{ message?: string; response?: { data?: { code?: string; remainingSeconds?: number } } }} ApiError
 */

/**
 * Team details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team details screen component
 */
function TeamDetails({ navigation, route }) {
  const {
    assignmentTrainerId,
    assignmentTrainerName,
    fromOnboardingAffiliation = false,
    invite,
    openExternalSourceSetup = false,
    teamId,
  } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    canEditClub,
    canJoinTeam,
    canManageTeam,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    inviteTeamPlayers,
    refetchUserData,
    USER_ROLES: AUTH_USER_ROLES,
    userData: currentUser,
  } = /** @type {any} */ (useAuth());
  const isAuthenticated = Boolean(currentUser?.documentId);
  const { getClubInitials } = useClub();
  const { startTeamChat, startWhisperChat } = /** @type {any} */ (useMessaging());
  const openTeamAuthFlow = useCallback((/** @type {string} */ source, /** @type {any} */ extraParams = {}) => {
    openPublicAuthFlow(navigation, {
      origin: RouteNames.TeamDetails,
      source,
      teamId,
      ...extraParams,
    });
  }, [navigation, teamId]);
  const isMyTeam = useMemo(
    () => {
      const allMyTeams = (currentUser?.myTeams || [])?.concat(currentUser?.trainedTeams || []);
      return !!allMyTeams?.some((/** @type {Team} */ item) => item.documentId === teamId);
    },
    [currentUser?.trainedTeams, currentUser?.myTeams, teamId],
  );
  const currentUserTeamSummary = useMemo(() => {
    const allMyTeams = [
      ...(Array.isArray(currentUser?.myTeams) ? currentUser.myTeams : []),
      ...(Array.isArray(currentUser?.trainedTeams) ? currentUser.trainedTeams : []),
    ];

    return allMyTeams.find((/** @type {any} */ item) => item?.documentId === teamId) || null;
  }, [currentUser?.myTeams, currentUser?.trainedTeams, teamId]);

  const {
    data: rawTeam, error, isFetching, isLoading, refetch,
  } = useGetTeam(teamId || '');
  const team = /** @type {any} */ (rawTeam);
  const { data: rawClubData, refetch: refetchClubData } = useGetClub(team?.club?.documentId || '');
  const clubData = /** @type {any} */ (rawClubData);
  const { data: rawTeamStatsData, isLoading: isTeamStatsLoading, refetch: refetchTeamStats } = useGetTeamStats(
    teamId || '',
    {
      enabled: Boolean(teamId && isMyTeam),
      staleTime: 1000 * 60,
    },
  );
  const teamStatsData = /** @type {any} */ (rawTeamStatsData);
  const {
    data: rawTeamPerformanceStats,
    isLoading: isTeamPerformanceLoading,
    refetch: refetchTeamPerformanceStats,
  } = useGetTeamPerformanceStats(teamId || '', {
    enabled: Boolean(teamId),
    staleTime: 1000 * 60,
  });
  const teamPerformanceStats = /** @type {any} */ (rawTeamPerformanceStats);

  const [activeTab, setActiveTab] = useState('infos');
  const [statsMode, setStatsMode] = useState(/** @type {'attendance' | 'performance'} */ ('attendance'));
  const [isCreateTrainerModalVisible, setIsCreateTrainerModalVisible] = useState(false);
  const [isTrainerPickerVisible, setIsTrainerPickerVisible] = useState(false);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState(/** @type {string[]} */ ([]));
  const [selectedMonthKey, setSelectedMonthKey] = useState(/** @type {string | null} */ (null));
  const [selectedUpcomingMatchKey, setSelectedUpcomingMatchKey] = useState(/** @type {string | null} */ (null));
  const [calendarDisplayMode, setCalendarDisplayMode] = useState(/** @type {'upcoming' | 'results' | 'all'} */ ('upcoming'));
  const [isTeamActionsPanelOpen, setIsTeamActionsPanelOpen] = useState(false);
  const [trainerSearch, setTrainerSearch] = useState('');
  const autoOpenedTeamActionsKeyRef = useRef(/** @type {string | null} */ (null));

  // FFBB Modal states
  const [showFFBBUrlModal, setShowFFBBUrlModal] = useState(false);
  const [showFFBBTeamModal, setShowFFBBTeamModal] = useState(false);
  const [showFFBBErrorModal, setShowFFBBErrorModal] = useState(false);
  const [showExternalSyncReportModal, setShowExternalSyncReportModal] = useState(false);
  const [ffbbUrl, setFfbbUrl] = useState('');
  const [ffbbTeamsList, setFfbbTeamsList] = useState(/** @type {ExternalTeamOption[]} */ ([]));
  const [recommendedExternalTeam, setRecommendedExternalTeam] = useState(
    /** @type {RecommendedExternalTeamOption | null} */ (null),
  );
  const [selectedExternalTeam, setSelectedExternalTeam] = useState(
    /** @type {ExternalTeamOption | null} */ (null),
  );
  const [externalPreviewContext, setExternalPreviewContext] = useState(/** @type {any} */ (null));
  const [latestExternalSyncReport, setLatestExternalSyncReport] = useState(/** @type {any} */ (null));
  const [externalCompetitionPhase, setExternalCompetitionPhase] = useState(
    /** @type {'idle' | 'previewing' | 'connecting' | 'refreshing' | 'reporting'} */ ('idle'),
  );
  const [ffbbErrorType, setFfbbErrorType] = useState('wrong_data');
  const [ffbbErrorDescription, setFfbbErrorDescription] = useState('');
  const [teamClubLogoRatio, setTeamClubLogoRatio] = useState(1);
  const createTrainerOpenTimeoutRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const assignmentPrefillHandledRef = useRef(false);
  const genericErrorMessage = t('APIerrors.generic', 'Une erreur est survenue. Veuillez reessayer plus tard.');

  /**
   * @param {unknown} sourceError
   * @param {string} [fallback]
   * @returns {string}
   */
  const getErrorMessage = useCallback((/** @type {unknown} */ sourceError, /** @type {string} */ fallback = 'Erreur') => {
    const resolvedMessage = getDisplayErrorMessage(/** @type {any} */ (sourceError), 'generic');
    if (fallback && resolvedMessage === genericErrorMessage) {
      return fallback;
    }
    return resolvedMessage || fallback || genericErrorMessage;
  }, [genericErrorMessage]);

  /**
   * @param {unknown} sourceError
   * @returns {{ code: string | null, message: string, remainingSeconds: number | null, status: number | null }}
   */
  const getApiErrorMeta = (sourceError) => {
    if (!sourceError || typeof sourceError !== 'object') {
      return {
        code: null,
        message: getErrorMessage(sourceError),
        remainingSeconds: null,
        status: null,
      };
    }

    const typedError = /** @type {any} */ (sourceError);
    const responseData = typedError?.response?.data;
    const responseError = responseData?.error;
    const responseDetails = responseError?.details || responseData?.details || {};
    const directDetails = typedError?.details || {};
    const code = [
      typedError?.code,
      directDetails?.code,
      responseData?.code,
      responseDetails?.code,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find(Boolean) || null;

    const remainingSecondsCandidate = [
      typedError?.remainingSeconds,
      directDetails?.remainingSeconds,
      responseData?.remainingSeconds,
      responseDetails?.remainingSeconds,
    ]
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value >= 0);

    const statusCandidate = [
      typedError?.status,
      responseData?.status,
      responseError?.status,
    ]
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0);

    return {
      code,
      message: getErrorMessage(sourceError),
      remainingSeconds: Number.isFinite(remainingSecondsCandidate) ? Number(remainingSecondsCandidate) : null,
      status: Number.isFinite(statusCandidate) ? Number(statusCandidate) : null,
    };
  };

  const normalizeTeamName = (/** @type {any} */ value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  const isSameExternalTeamName = (/** @type {any} */ leftValue, /** @type {any} */ rightValue) => {
    const left = normalizeTeamName(leftValue);
    const right = normalizeTeamName(rightValue);

    if (!left || !right) return false;
    if (left === right) return true;
    return left.includes(right) || right.includes(left);
  };

  const getSyncPayload = useCallback((/** @type {any} */ result) => result?.data || result || {}, []);

  const isExternalCompetitionPreviewing = externalCompetitionPhase === 'previewing';
  const isExternalCompetitionConnecting = externalCompetitionPhase === 'connecting';
  const isExternalCompetitionRefreshing = externalCompetitionPhase === 'refreshing';
  const isExternalCompetitionReporting = externalCompetitionPhase === 'reporting';
  const isExternalCompetitionFlowLocked = isExternalCompetitionPreviewing || isExternalCompetitionConnecting;
  const isExternalCompetitionPhaseActive = externalCompetitionPhase !== 'idle';

  const externalCompetitionLoadingMeta = useMemo(() => {
    if (isExternalCompetitionConnecting) {
      return {
        description: t(
          'teamDetails.external.loading.connectingDescription',
          'Nous r\u00E9cup\u00E9rons le classement, le calendrier et les donnees associees.',
        ),
        title: t('teamDetails.external.loading.connectingTitle', 'Connexion de votre équipe'),
      };
    }

    return {
      description: t(
        'teamDetails.external.loading.previewingDescription',
        'Nous r\u00E9cup\u00E9rons la liste des equipes disponibles.',
      ),
      title: t('teamDetails.external.loading.previewingTitle', 'Analyse de la compétition'),
    };
  }, [isExternalCompetitionConnecting, t]);

  const showExternalCompetitionLoadingOverlay = isExternalCompetitionFlowLocked;

  const notifyExternalCompetitionFlowLocked = useCallback(() => {
    Alert.alert(
      t('teamDetails.external.loading.waitTitle', 'Chargement en cours'),
      t('teamDetails.external.loading.waitDescription', 'Merci de patienter pendant la récupération des données.'),
    );
  }, [t]);

  const teamClubLogoUrl = useMemo(
    () => getImageUrl(team?.club?.logo?.url),
    [team?.club?.logo?.url],
  );

  const teamClubLogoFrame = useMemo(() => {
    const ratio = Number.isFinite(teamClubLogoRatio) && teamClubLogoRatio > 0 ? teamClubLogoRatio : 1;

    if (ratio >= 1.3) {
      return {
        borderRadius: 20,
        height: 78,
        safeInsetRatio: 0.02,
        width: 122,
      };
    }

    if (ratio <= 0.8) {
      return {
        borderRadius: 22,
        height: 102,
        safeInsetRatio: 0.02,
        width: 78,
      };
    }

    return {
      borderRadius: 22,
      height: 92,
      safeInsetRatio: 0,
      width: 92,
    };
  }, [teamClubLogoRatio]);

  const getExternalSyncStatusMeta = useCallback((/** @type {any} */ status) => {
    switch (status) {
      case 'configured':
        return {
          badgeBackground: `${Colors.neutral300}18`,
          badgeBorder: `${Colors.neutral300}40`,
          label: t('teamDetails.external.status.configured', 'Configuré'),
          textColor: Colors.neutral100,
        };
      case 'error':
        return {
          badgeBackground: `${Colors.error500}22`,
          badgeBorder: `${Colors.error500}55`,
          label: t('teamDetails.external.status.error', 'Erreur'),
          textColor: Colors.error500,
        };
      case 'synced':
        return {
          badgeBackground: `${Colors.success500}22`,
          badgeBorder: `${Colors.success500}55`,
          label: t('teamDetails.external.status.synced', 'Synchronisé'),
          textColor: Colors.success500,
        };
      case 'synced_with_warnings':
        return {
          badgeBackground: `${Colors.warning500}22`,
          badgeBorder: `${Colors.warning500}55`,
          label: t('teamDetails.external.status.syncedWithWarnings', 'Synchronisé avec avertissements'),
          textColor: Colors.warning500,
        };
      case 'syncing':
        return {
          badgeBackground: `${Colors.primary500}22`,
          badgeBorder: `${Colors.primary500}55`,
          label: t('teamDetails.external.status.syncing', 'Synchronisation'),
          textColor: Colors.primary500,
        };
      default:
        return {
          badgeBackground: `${Colors.neutral300}18`,
          badgeBorder: `${Colors.neutral300}40`,
          label: t('teamDetails.external.status.notConfigured', 'Non configuré'),
          textColor: Colors.neutral100,
        };
    }
  }, [Colors.error500, Colors.neutral100, Colors.neutral300, Colors.primary500, Colors.success500, Colors.warning500, t]);

  const getExternalSyncModeMeta = useCallback((/** @type {any} */ mode, /** @type {any} */ status = 'synced') => {
    switch (mode) {
      case 'connect':
        return {
          accentColor: Colors.primary500,
          label: t('teamDetails.external.mode.connect', 'Configuration initiale'),
        };
      case 'daily':
        return {
          accentColor: Colors.success500,
          label: t('teamDetails.external.mode.daily', 'Synchronisation auto quotidienne'),
        };
      case 'hot_window':
        return {
          accentColor: Colors.warning500,
          label: t('teamDetails.external.mode.hotWindow', 'Synchronisation auto autour des matchs'),
        };
      case 'manual':
        return {
          accentColor: Colors.neutral100,
          label: t('teamDetails.external.mode.manual', 'Synchronisation manuelle'),
        };
      default:
        return {
          accentColor: status === 'error' ? Colors.error500 : Colors.primary500,
          label: t('teamDetails.external.mode.unknown', 'Synchronisation'),
        };
    }
  }, [
    Colors.error500,
    Colors.neutral100,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    t,
  ]);

  const formatExternalSyncDate = useCallback((/** @type {any} */ value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const openExternalSyncReport = useCallback((/** @type {any} */ report) => {
    if (!report || typeof report !== 'object') return;
    setLatestExternalSyncReport(report);
    setShowExternalSyncReportModal(true);
  }, []);

  const applyExternalSyncFeedback = useCallback((/** @type {any} */ result) => {
    const payload = getSyncPayload(result);
    const syncReport = payload?.syncReport;
    const scoreUpdatedEventIds = (Array.isArray(syncReport?.scoreUpdatedEvents)
      ? syncReport.scoreUpdatedEvents
      : [])
      .map((/** @type {any} */ item) => item?.eventDocumentId)
      .filter(Boolean);

    queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    queryClient.invalidateQueries({ queryKey: ['pendingMatchStatsPrompts'] });
    queryClient.invalidateQueries({ queryKey: ['teamPerformanceStats', teamId] });
    scoreUpdatedEventIds.forEach((/** @type {any} */ updatedEventId) => {
      queryClient.invalidateQueries({ queryKey: ['event', updatedEventId] });
      queryClient.invalidateQueries({ queryKey: ['eventMatchResult', updatedEventId] });
      queryClient.invalidateQueries({ queryKey: ['eventMatchStats', updatedEventId] });
    });
    refetch();
    queryClient.invalidateQueries({ queryKey: ['get-me'] });
    refetchUserData?.();

    if (syncReport && typeof syncReport === 'object') {
      openExternalSyncReport(syncReport);
      return;
    }

    Alert.alert(
      t('common.success', 'Succes'),
      t('teamDetails.external.syncCompleted', 'Classement et calendrier synchronisés.'),
    );
  }, [getSyncPayload, openExternalSyncReport, queryClient, refetch, refetchUserData, t, teamId]);

  const allMembers = useMemo(() => {
    const allTrainers = team?.trainers || [];
    const allPlayers = team?.players || [];
    const byId = new Map();
    [...allTrainers, ...allPlayers].forEach((member) => {
      if (member?.documentId) {
        byId.set(member.documentId, member);
      }
    });
    return Array.from(byId.values());
  }, [team]);

  const filteredPlayers = useMemo(() => {
    const trainers = team?.trainers || [];
    const players = team?.players || [];

    if (team?.isLeague) {
      return players;
    }

    const trainerIds = new Set(
      trainers
        .map((/** @type {any} */ trainer) => trainer?.documentId)
        .filter(Boolean),
    );

    return players.filter((/** @type {any} */ player) => {
      const playerId = player?.documentId;
      if (!playerId) return false;
      return !trainerIds.has(playerId);
    });
  }, [team?.isLeague, team?.players, team?.trainers]);

  const areTeamMembersHidden = team?.membersAreHidden === true;

  const isMyClub = useMemo(
    () => team?.club?.documentId === currentUser?.club?.documentId,
    [team?.club?.documentId, currentUser?.club?.documentId],
  );

  const handleGoToNextOnboardingStep = useCallback(() => {
    if (!fromOnboardingAffiliation) return;

    const parentNavigation = navigation.getParent?.();
    const onboardingNavigation = /** @type {any} */ (parentNavigation || navigation);
    const nextRoute = getNextOnboardingRoute(RouteNames.UserAffiliationGuide);
    if (nextRoute) {
      onboardingNavigation.navigate(nextRoute);
      return;
    }

    markOnboardingComplete(currentUser?.documentId);
    onboardingNavigation.reset({
      index: 0,
      routes: [{ name: getPostOnboardingHomeRoute() }],
    });
  }, [
    currentUser?.documentId,
    fromOnboardingAffiliation,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    navigation,
  ]);

  const createTeamMembershipRequestMutation = /** @type {any} */ (useMutation({
    mutationFn: createTeamMembershipRequest,
    onSuccess: () => {
      Alert.alert(
        t('teamDetails.alerts.joinRequest.title'),
        currentUser?.role?.name === AUTH_USER_ROLES.coach && isMyClub && !isMyTeam
          ? t(
            'teamDetails.alerts.joinRequest.coachDescription',
            "Les entraîneurs de l'équipe et le dirigeant du club vont recevoir votre demande.",
          )
          : t('teamDetails.alerts.joinRequest.description'),
        [{
          onPress: () => {
            refetchUserData();
            refetch();
            if (fromOnboardingAffiliation) {
              handleGoToNextOnboardingStep();
              return;
            }
            navigation.goBack();
          },
          text: t('teamDetails.alerts.joinRequest.actions.ok'),
        }],
      );
    },
  }));

  const leaveTeamMutation = /** @type {any} */ (useMutation({
    mutationFn: leaveTeam,
    onSuccess: () => {
      refetchUserData();
      refetch();
    },
  }));

  const deleteTrainerMutation = /** @type {any} */ (useMutation({
    mutationFn: removeTrainerFromClub,
    onSuccess: () => {
      refetch();
    },
  }));

  const removePlayerMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {{ teamId: string; playerId: string }} */ payload) => removePlayerFromTeam(payload.teamId, payload.playerId),
    onSuccess: () => {
      refetch();
    },
  }));

  const addTrainerToTeamMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ payload) => updateTeam(payload),
    onError: (/** @type {any} */ mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessage(mutationError, t('teamDetails.alerts.addTrainerError', 'Impossible d\'ajouter cet entraîneur')),
      );
    },
    onSuccess: () => {
      refetch();
      refetchClubData();
    },
  }));

  const saveTeamTrainersMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ payload) => updateTeam(payload),
    onError: (/** @type {any} */ mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessage(mutationError, t('teamDetails.alerts.updateTrainersError', 'Impossible de mettre à jour les entraîneurs')),
      );
    },
    onSuccess: () => {
      setIsTrainerPickerVisible(false);
      refetch();
    },
  }));

  const resetTeamStatsMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {{ reason?: string }} */ payload = {}) => {
      const { reason } = payload;
      if (!teamId) {
        throw new Error('Team ID is required');
      }
      return resetTeamStats(teamId, reason);
    },
    onError: (/** @type {any} */ mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessage(mutationError, t('teamDetails.stats.resetError', 'Impossible de reinitialiser les statistiques')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamStats', teamId] });
      refetchTeamStats();
      Alert.alert(
        t('common.success', 'Succes'),
        t('teamDetails.stats.resetSuccess', 'Les statistiques ont été réinitialisées à partir de maintenant.'),
      );
    },
  }));

  const refreshScrapingMutation = /** @type {any} */ (useMutation({
    mutationFn: refreshExternalCompetition,
    onError: (/** @type {ApiError} */ err) => {
      const apiError = getApiErrorMeta(err);
      if (apiError.code === 'RATE_LIMITED') {
        const seconds = apiError.remainingSeconds || 0;
        Alert.alert(t('common.error'), t('teamDetails.ffbb.rateLimit', `Veuillez patienter ${seconds} secondes.`));
      } else if (apiError.code === 'TEAM_TRAINER_REQUIRED' || apiError.status === 403) {
        Alert.alert(
          t('common.error'),
          apiError.message || t('teamDetails.external.staffOnly', "Seul un entraîneur assigné à cette équipe ou un dirigeant du club peut lancer l'import."),
        );
      } else {
        Alert.alert(
          t('common.error'),
          t('teamDetails.alerts.scrapingError.description', `Erreur lors de la mise à jour : ${apiError.message}`),
        );
      }
    },
    onMutate: () => {
      setExternalCompetitionPhase('refreshing');
    },
    onSettled: () => {
      setExternalCompetitionPhase((currentPhase) => (currentPhase === 'refreshing' ? 'idle' : currentPhase));
    },
    onSuccess: (result) => {
      applyExternalSyncFeedback(result);
    },
  }));

  // Handler for FFBB URL configuration
  const openExternalSourceSetupModal = useCallback(() => {
    if (isExternalCompetitionFlowLocked) {
      notifyExternalCompetitionFlowLocked();
      return;
    }
    setActiveTab('standings');
    setRecommendedExternalTeam(null);
    setSelectedExternalTeam(null);
    setExternalPreviewContext(null);
    setShowFFBBUrlModal(true);
  }, [isExternalCompetitionFlowLocked, notifyExternalCompetitionFlowLocked]);

  const handleSetFFBBUrl = async () => {
    if (!ffbbUrl || !teamId || isExternalCompetitionPhaseActive) return;
    Keyboard.dismiss();
    setExternalCompetitionPhase('previewing');
    try {
      const result = /** @type {any} */ (await previewExternalCompetition(teamId, ffbbUrl, 'team-candidates'));
      const payload = result?.data || result || {};
      const candidates = Array.isArray(payload.teamCandidates) ? payload.teamCandidates : [];
      const recommendedCandidate = payload?.recommendedTeamSelection
        ? {
          confidence: payload.recommendedTeamSelection.confidence || null,
          externalTeamId: payload.recommendedTeamSelection.externalTeamId || null,
          externalTeamName: payload.recommendedTeamSelection.externalTeamName || '',
          reason: payload.recommendedTeamSelection.reason || null,
        }
        : null;
      const normalizedCandidates = candidates
        .map((/** @type {any} */ candidate) => ({
          externalTeamId: candidate.externalTeamId || null,
          externalTeamName: candidate.externalTeamName || '',
        }))
        .filter((/** @type {any} */ candidate) => candidate.externalTeamName)
        .sort((/** @type {any} */ a, /** @type {any} */ b) => {
          const aIsRecommended = recommendedCandidate
            && (
              (recommendedCandidate.externalTeamId && a.externalTeamId
                ? recommendedCandidate.externalTeamId === a.externalTeamId
                : false)
              || recommendedCandidate.externalTeamName === a.externalTeamName
            );
          const bIsRecommended = recommendedCandidate
            && (
              (recommendedCandidate.externalTeamId && b.externalTeamId
                ? recommendedCandidate.externalTeamId === b.externalTeamId
                : false)
              || recommendedCandidate.externalTeamName === b.externalTeamName
            );
          if (aIsRecommended && !bIsRecommended) return -1;
          if (!aIsRecommended && bIsRecommended) return 1;
          return a.externalTeamName.localeCompare(b.externalTeamName, 'fr');
        });

      if (!normalizedCandidates.length) {
        Alert.alert(
          t('common.error'),
          t('teamDetails.ffbb.noCandidate', 'Aucune équipe détectée depuis cette source.'),
        );
        return;
      }

      setFfbbTeamsList(normalizedCandidates);
      setRecommendedExternalTeam(recommendedCandidate);
      setSelectedExternalTeam(recommendedCandidate
        ? normalizedCandidates.find((/** @type {any} */ candidate) => (
          (recommendedCandidate.externalTeamId && candidate.externalTeamId
            ? recommendedCandidate.externalTeamId === candidate.externalTeamId
            : false)
          || recommendedCandidate.externalTeamName === candidate.externalTeamName
        )) || null
        : null);
      setExternalPreviewContext({
        provider: payload?.provider || null,
        requestedUrl: payload?.requestedUrl || ffbbUrl,
        sourceResolution: payload?.sourceResolution || null,
        sourceUrl: payload?.sourceUrl || ffbbUrl,
      });
      setShowFFBBUrlModal(false);
      setShowFFBBTeamModal(true);
    } catch (caughtError) {
      Alert.alert(
        t('common.error'),
        t('teamDetails.ffbb.urlError', 'Erreur lors de la configuration: ') + getErrorMessage(caughtError),
      );
    } finally {
      setExternalCompetitionPhase('idle');
    }
  };

  // Handler for FFBB team selection
  const submitExternalCompetitionSelection = useCallback(async (/** @type {any} */ selectedTeam) => {
    if (!teamId || isExternalCompetitionPhaseActive) return;

    setExternalCompetitionPhase('connecting');
    try {
      const result = await connectExternalCompetition(teamId, ffbbUrl, selectedTeam);
      setShowFFBBTeamModal(false);
      setSelectedExternalTeam(null);
      setRecommendedExternalTeam(null);
      setExternalPreviewContext(null);
      applyExternalSyncFeedback(result);
    } finally {
      setExternalCompetitionPhase('idle');
    }
  }, [applyExternalSyncFeedback, ffbbUrl, isExternalCompetitionPhaseActive, teamId]);

  const handleSelectFFBBTeam = async (/** @type {ExternalTeamOption} */ selectedTeam) => {
    if (!teamId || isExternalCompetitionPhaseActive) return;

    const normalizedExistingUrl = String(team?.externalStandingUrl || '').trim();
    const normalizedNextUrl = String(ffbbUrl || '').trim();
    const normalizedExistingTeamId = String(team?.externalTeamId || '').trim();
    const normalizedSelectedTeamId = String(selectedTeam?.externalTeamId || '').trim();
    const normalizedExistingTeamName = String(team?.externalTeamName || '').trim().toLowerCase();
    const normalizedSelectedTeamName = String(selectedTeam?.externalTeamName || '').trim().toLowerCase();
    const shouldConfirmReplacement = Boolean(
      normalizedExistingUrl
      && (
        normalizedExistingUrl !== normalizedNextUrl
        || normalizedExistingTeamId !== normalizedSelectedTeamId
        || normalizedExistingTeamName !== normalizedSelectedTeamName
      ),
    );

    if (shouldConfirmReplacement) {
      Alert.alert(
        t('teamDetails.external.replaceTitle', 'Remplacer la source externe ?'),
        t(
          'teamDetails.external.replaceDescription',
          "Cette équipe a déjà une source configurée. La nouvelle source remplacera l'ancienne configuration.",
        ),
        [
          {
            style: 'cancel',
            text: t('common.cancel', 'Annuler'),
          },
          {
            onPress: () => {
              submitExternalCompetitionSelection(selectedTeam).catch((caughtError) => {
                Alert.alert(t('common.error'), getErrorMessage(caughtError));
              });
            },
            text: t('common.confirm', 'Valider'),
          },
        ],
      );
      return;
    }

    try {
      await submitExternalCompetitionSelection(selectedTeam);
    } catch (caughtError) {
      Alert.alert(t('common.error'), getErrorMessage(caughtError));
    }
  };

  const handleConfirmSelectedExternalTeam = async () => {
    if (!selectedExternalTeam || isExternalCompetitionPhaseActive) return;
    await handleSelectFFBBTeam(selectedExternalTeam);
  };

  // Handler for FFBB error reporting
  const handleReportError = async () => {
    if (!teamId || isExternalCompetitionPhaseActive) return;
    setExternalCompetitionPhase('reporting');
    try {
      await createFFBBErrorReport({
        description: ffbbErrorDescription,
        problemType: ffbbErrorType,
        teamId,
      });
      setShowFFBBErrorModal(false);
      setFfbbErrorDescription('');
      Alert.alert(t('common.success'), t('teamDetails.ffbb.errorReported', 'Signalement envoye, merci !'));
    } catch (caughtError) {
      Alert.alert(t('common.error'), getErrorMessage(caughtError));
    } finally {
      setExternalCompetitionPhase('idle');
    }
  };

  const trainersCount = useMemo(() => {
    const explicitCount = Number(team?.trainersCount);
    if (areTeamMembersHidden && Number.isFinite(explicitCount) && explicitCount >= 0) {
      return explicitCount;
    }
    return team?.trainers?.length || 0;
  }, [areTeamMembersHidden, team?.trainers, team?.trainersCount]);
  const playersCount = useMemo(() => {
    const explicitCount = Number(team?.playersCount);
    if (areTeamMembersHidden && Number.isFinite(explicitCount) && explicitCount >= 0) {
      return explicitCount;
    }
    return filteredPlayers.length || 0;
  }, [areTeamMembersHidden, filteredPlayers, team?.playersCount]);
  const renderMembersHiddenCard = useCallback((message) => (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Spaces.padding[16],
        Spaces.gap[8],
        {
          borderColor: `${Colors.primary500}55`,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('teamDetails.sections.membersHiddenTitle', 'Membres masqués')}
      </Text>
      <Text style={[Fonts.p2, Fonts.primary100]}>
        {message}
      </Text>
    </View>
  ), [
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius24,
    Colors.primary500,
    Fonts.neutral00,
    Fonts.p2,
    Fonts.p2Bold,
    Fonts.primary100,
    Spaces.gap,
    Spaces.padding,
    t,
  ]);
  const hasStandingData = useMemo(
    () => Array.isArray(team?.externalStandingData) && team.externalStandingData.length > 0,
    [team?.externalStandingData],
  );
  const hasCalendarData = useMemo(
    () => Array.isArray(team?.externalCalendarData) && team.externalCalendarData.length > 0,
    [team?.externalCalendarData],
  );
  const externalSyncReport = useMemo(() => {
    const candidate = latestExternalSyncReport || team?.externalLastSyncReport || null;
    return candidate && typeof candidate === 'object' ? candidate : null;
  }, [latestExternalSyncReport, team?.externalLastSyncReport]);
  const externalSyncStatusMeta = useMemo(
    () => getExternalSyncStatusMeta(team?.externalSyncStatus),
    [getExternalSyncStatusMeta, team?.externalSyncStatus],
  );
  const externalSyncModeMeta = useMemo(
    () => getExternalSyncModeMeta(externalSyncReport?.mode, team?.externalSyncStatus),
    [externalSyncReport?.mode, getExternalSyncModeMeta, team?.externalSyncStatus],
  );
  const externalSyncSummary = useMemo(() => {
    const summary = externalSyncReport?.eventSyncSummary;
    return summary && typeof summary === 'object' ? summary : null;
  }, [externalSyncReport]);
  const externalSyncHistory = useMemo(() => {
    const history = Array.isArray(externalSyncReport?.history)
      ? externalSyncReport.history.filter((/** @type {any} */ entry) => entry && typeof entry === 'object')
      : [];

    if (history.length) {
      return history.slice(0, 3);
    }

    if (!externalSyncReport?.syncedAt || !externalSyncReport?.mode) {
      return [];
    }

    return [{
      archivedFuture: externalSyncSummary?.archivedFuture || 0,
      created: externalSyncSummary?.created || 0,
      errorsCount: Array.isArray(externalSyncReport?.errors) ? externalSyncReport.errors.length : 0,
      mode: externalSyncReport.mode,
      provider: externalSyncReport.provider || team?.externalProvider || null,
      scoreUpdated: externalSyncSummary?.scoreUpdated || 0,
      status: team?.externalSyncStatus || 'synced',
      syncedAt: externalSyncReport.syncedAt,
      unchanged: externalSyncSummary?.unchanged || 0,
      updated: externalSyncSummary?.updated || 0,
      warningsCount: Array.isArray(externalSyncReport?.warnings) ? externalSyncReport.warnings.length : 0,
    }];
  }, [
    externalSyncReport,
    externalSyncSummary,
    team?.externalProvider,
    team?.externalSyncStatus,
  ]);
  const externalSyncUpdatedLabel = useMemo(
    () => formatExternalSyncDate(
      externalSyncReport?.syncedAt || team?.externalSyncUpdatedAt || team?.externalDataLastUpdate,
    ),
    [externalSyncReport?.syncedAt, formatExternalSyncDate, team?.externalDataLastUpdate, team?.externalSyncUpdatedAt],
  );
  const externalSyncCompetitionName = useMemo(
    () => externalSyncReport?.competition?.competitionName
      || team?.externalCompetitionName
      || null,
    [externalSyncReport?.competition?.competitionName, team?.externalCompetitionName],
  );
  const externalSyncPouleName = useMemo(
    () => externalSyncReport?.competition?.pouleName
      || team?.externalPouleName
      || null,
    [externalSyncReport?.competition?.pouleName, team?.externalPouleName],
  );
  const externalSyncSelectedTeamName = useMemo(
    () => externalSyncReport?.selectedTeam?.externalTeamName
      || team?.externalTeamName
      || null,
    [externalSyncReport?.selectedTeam?.externalTeamName, team?.externalTeamName],
  );
  const externalSyncProviderLabel = useMemo(
    () => String(externalSyncReport?.provider || team?.externalProvider || '').toUpperCase() || null,
    [externalSyncReport?.provider, team?.externalProvider],
  );
  const externalSyncRequestedUrl = useMemo(
    () => externalSyncReport?.competition?.requestedUrl
      || team?.externalConfig?.requestedUrl
      || team?.externalStandingUrl
      || null,
    [externalSyncReport?.competition?.requestedUrl, team?.externalConfig?.requestedUrl, team?.externalStandingUrl],
  );
  const externalSyncResolvedSourceUrl = useMemo(
    () => externalSyncReport?.competition?.sourceUrl
      || team?.externalConfig?.sourceUrl
      || team?.externalStandingUrl
      || null,
    [externalSyncReport?.competition?.sourceUrl, team?.externalConfig?.sourceUrl, team?.externalStandingUrl],
  );
  const formatExternalSourceResolutionLabel = useCallback((/** @type {any} */ value) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (!normalizedValue) return null;

    const labels = {
      direct: 'Lien compétition direct',
      normalized_direct: 'Lien source normalisé',
      stored_source: 'Source configurée existante',
      'team-page-html': 'Page équipe FFBB résolue via le contenu HTML',
      'team-page-rewrite': 'Page équipe FFBB résolue via redirection',
    };

    return /** @type {Record<string, string>} */ (labels)[normalizedValue] || value;
  }, []);
  const externalSyncSourceResolution = useMemo(
    () => externalSyncReport?.competition?.sourceResolution
      || team?.externalConfig?.sourceResolution
      || team?.externalConfig?.providerMetadata?.ffbbSourceResolution
      || null,
    [
      externalSyncReport?.competition?.sourceResolution,
      team?.externalConfig?.providerMetadata?.ffbbSourceResolution,
      team?.externalConfig?.sourceResolution,
    ],
  );
  const externalSyncSourceResolutionLabel = useMemo(
    () => formatExternalSourceResolutionLabel(externalSyncSourceResolution),
    [externalSyncSourceResolution, formatExternalSourceResolutionLabel],
  );
  const externalSyncProviderMetadata = useMemo(
    () => externalSyncReport?.providerMetadata
      || team?.externalConfig?.providerMetadata
      || team?.externalConfig?.metadata
      || null,
    [externalSyncReport?.providerMetadata, team?.externalConfig?.metadata, team?.externalConfig?.providerMetadata],
  );
  const externalSyncStrategyLabel = useMemo(() => {
    const standingsStrategy = externalSyncProviderMetadata?.standingsStrategy;
    const calendarStrategy = externalSyncProviderMetadata?.calendarStrategy;

    const formatStrategy = (/** @type {string} */ label, /** @type {any} */ value) => {
      if (!value) return null;
      const normalizedValue = String(value || '').trim();
      const labels = {
        ng_state_fallback: 'fallback ng-state',
        secured_api: 'API sécurisée',
        secured_api_monthly: 'API sécurisée mensuelle',
        secured_api_scoped: 'API sécurisée ciblée',
        secured_api_team: 'API sécurisée équipe',
        skipped_preview: 'non chargé en preview',
        unavailable: 'indisponible',
      };
      return `${label}: ${/** @type {Record<string, string>} */ (labels)[normalizedValue] || normalizedValue}`;
    };

    return [
      formatStrategy('Classement', standingsStrategy),
      formatStrategy('Calendrier', calendarStrategy),
    ].filter(Boolean).join('  •  ') || null;
  }, [externalSyncProviderMetadata]);
  const externalCompetitionEligible = useMemo(
    () => Boolean(currentUserTeamSummary?.externalCompetitionEligible),
    [currentUserTeamSummary?.externalCompetitionEligible],
  );
  const externalConfigUpdatedLabel = useMemo(
    () => formatExternalSyncDate(team?.externalConfigUpdatedAt),
    [formatExternalSyncDate, team?.externalConfigUpdatedAt],
  );
  const externalConfigUpdatedByLabel = useMemo(() => {
    const firstname = String(team?.externalConfigUpdatedBy?.firstname || '').trim();
    const lastname = String(team?.externalConfigUpdatedBy?.lastname || '').trim();
    return [firstname, lastname].filter(Boolean).join(' ').trim() || null;
  }, [team?.externalConfigUpdatedBy?.firstname, team?.externalConfigUpdatedBy?.lastname]);
  const isAssignedTrainerForCurrentTeam = useMemo(
    () => Boolean(
      teamId
      && (currentUser?.trainedTeams || []).some((/** @type {any} */ trainedTeam) => trainedTeam?.documentId === teamId),
    ),
    [currentUser?.trainedTeams, teamId],
  );
  const isClubManagerForCurrentTeam = useMemo(
    () => Boolean(team?.club?.documentId && canEditClub(team.club.documentId)),
    [canEditClub, team?.club?.documentId],
  );
  const canManageCurrentTeamExternalSync = useMemo(
    () => isAssignedTrainerForCurrentTeam || isClubManagerForCurrentTeam,
    [isAssignedTrainerForCurrentTeam, isClubManagerForCurrentTeam],
  );
  const canConfigureFFBB = useMemo(
    () => !!(teamId && canManageCurrentTeamExternalSync && externalCompetitionEligible),
    [canManageCurrentTeamExternalSync, externalCompetitionEligible, teamId],
  );
  const showExternalSyncCard = useMemo(
    () => !!(
      canConfigureFFBB
      || team?.externalStandingUrl
      || externalSyncReport
      || team?.externalCompetitionName
      || team?.externalTeamName
      || externalCompetitionEligible
    ),
    [
      canConfigureFFBB,
      externalCompetitionEligible,
      externalSyncReport,
      team?.externalCompetitionName,
      team?.externalStandingUrl,
      team?.externalTeamName,
    ],
  );
  const canRefreshExternalSync = useMemo(
    () => !!(canManageCurrentTeamExternalSync && teamId && team?.externalStandingUrl),
    [canManageCurrentTeamExternalSync, team?.externalStandingUrl, teamId],
  );
  const showStandingsTab = useMemo(
    () => !!(isMyTeam || hasStandingData || canConfigureFFBB),
    [isMyTeam, hasStandingData, canConfigureFFBB],
  );
  const showCalendarTab = useMemo(
    () => !!(isMyTeam || hasCalendarData || canConfigureFFBB),
    [isMyTeam, hasCalendarData, canConfigureFFBB],
  );
  const showPerformanceTabs = useMemo(
    () => showStandingsTab || showCalendarTab,
    [showStandingsTab, showCalendarTab],
  );
  const areSlotActionsEnabled = String(process.env.APP_ENV || '').trim().toLowerCase() === 'local';
  const showSlotFeatureComingSoon = () => Alert.alert(
    'Bientot disponible',
    'La gestion des creneaux sera activee prochainement.',
  );
  const showStatsTab = useMemo(
    () => Boolean(
      isMyTeam
      || teamPerformanceStats?.totals
      || (Array.isArray(teamPerformanceStats?.pendingMatches) && teamPerformanceStats.pendingMatches.length > 0)
      || (Array.isArray(teamPerformanceStats?.players) && teamPerformanceStats.players.length > 0),
    ),
    [isMyTeam, teamPerformanceStats?.pendingMatches, teamPerformanceStats?.players, teamPerformanceStats?.totals],
  );
  const primaryActivityLabel = useMemo(
    () => String(team?.activities?.[0]?.name || '').trim(),
    [team?.activities],
  );
  const teamDescription = useMemo(() => {
    const value = String(team?.description || '').trim();
    return value.length >= 3 ? value : '';
  }, [team?.description]);
  const canAddTrainer = useMemo(
    () => !!(team?.club?.documentId && canEditClub(team.club.documentId)),
    [team?.club?.documentId, canEditClub],
  );
  const trainerPickerOptions = useMemo(() => {
    const normalizedSearch = trainerSearch.trim().toLowerCase();
    return (clubData?.members || [])
      .filter((/** @type {any} */ member) => member?.documentId
        && (member.role?.name === USER_ROLES.coach || member.role?.name === USER_ROLES.president))
      .map((/** @type {any} */ member) => ({
        label: `${member.firstname || ''} ${member.lastname || ''}`.trim() || member.phoneNumber || 'Utilisateur',
        value: member.documentId || '',
      }))
      .filter((/** @type {any} */ option) => !normalizedSearch || option.label.toLowerCase().includes(normalizedSearch))
      .sort((/** @type {any} */ a, /** @type {any} */ b) => a.label.localeCompare(b.label, 'fr'));
  }, [clubData?.members, trainerSearch]);

  const isExternalRowMyTeam = (/** @type {any} */ row) => {
    if (!row) return false;
    if (team?.externalTeamId && row.teamId) {
      return String(row.teamId) === String(team.externalTeamId);
    }
    if (team?.externalTeamName && row.teamName) {
      return isSameExternalTeamName(row.teamName, team.externalTeamName);
    }
    return false;
  };

  // Calculate team's rank and points from external data
  const myTeamRanking = useMemo(() => {
    if (!team?.externalStandingData?.length) return null;
    const index = team.externalStandingData.findIndex((/** @type {any} */ row) => isExternalRowMyTeam(row));
    if (index === -1) return null;
    const row = team.externalStandingData[index];
    const rank = row?.rank !== undefined && row?.rank !== null && row?.rank !== ''
      ? row.rank
      : index + 1;
    return {
      points: row.points,
      rank,
      total: team.externalStandingData.length,
    };
  }, [team?.externalStandingData, team?.externalTeamId, team?.externalTeamName]);

  const statsColumns = useMemo(
    () => ([
      { key: 'attendanceCount', label: 'Pres.' },
      { key: 'absenceCount', label: 'Abs.' },
      { key: 'lateCount', label: 'Ret.' },
      { key: 'lateMinutesTotal', label: 'Min ret.' },
    ]),
    [],
  );

  const teamStatsRows = useMemo(() => {
    const rows = Array.isArray(teamStatsData?.data) ? teamStatsData.data : [];
    return rows.map((/** @type {any} */ row) => ({
      ...row,
      lateCount: Number(row?.lateCount ?? row?.retardCount ?? 0),
      lateMinutesTotal: Number(row?.lateMinutesTotal ?? 0),
    }));
  }, [teamStatsData?.data]);

  const statsSummary = useMemo(() => {
    const rowCount = teamStatsRows.length;
    const fallbackTotals = teamStatsRows.reduce((/** @type {any} */ acc, /** @type {any} */ row) => ({
      absenceCount: acc.absenceCount + Number(row.absenceCount || 0),
      attendanceCount: acc.attendanceCount + Number(row.attendanceCount || 0),
      lateCount: acc.lateCount + Number(row.lateCount || 0),
      lateMinutesTotal: acc.lateMinutesTotal + Number(row.lateMinutesTotal || 0),
    }), {
      absenceCount: 0,
      attendanceCount: 0,
      lateCount: 0,
      lateMinutesTotal: 0,
    });

    const totals = teamStatsData?.totals || fallbackTotals;
    const lateMinutesAvg = Number(totals?.lateMinutesAvg)
      || (Number(totals?.lateCount || 0) > 0
        ? Math.round(Number(totals?.lateMinutesTotal || 0) / Number(totals?.lateCount || 0))
        : 0);

    return {
      baselineAt: teamStatsData?.baselineAt || null,
      lateCount: Number(totals?.lateCount || 0),
      lateMinutesAvg,
      lateMinutesTotal: Number(totals?.lateMinutesTotal || 0),
      rowCount,
      totalEvents: Number(teamStatsData?.totalEvents || 0),
    };
  }, [teamStatsData?.baselineAt, teamStatsData?.totalEvents, teamStatsData?.totals, teamStatsRows]);

  const statsBaselineLabel = useMemo(() => {
    if (!statsSummary.baselineAt) return '';
    const parsed = new Date(statsSummary.baselineAt);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('fr-FR');
  }, [statsSummary.baselineAt]);

  const teamPerformancePlayers = useMemo(
    () => (Array.isArray(teamPerformanceStats?.players) ? teamPerformanceStats.players : []),
    [teamPerformanceStats?.players],
  );
  const pendingPerformanceMatches = useMemo(
    () => (Array.isArray(teamPerformanceStats?.pendingMatches) ? teamPerformanceStats.pendingMatches : []),
    [teamPerformanceStats?.pendingMatches],
  );

  const performanceSummary = useMemo(() => {
    const totals = teamPerformanceStats?.totals || {};
    const sport = teamPerformanceStats?.sport || 'football';

    return {
      assists: Number(totals?.assists || 0),
      averageCollectiveRating: totals?.averageCollectiveRating ?? null,
      cleanSheets: Number(totals?.cleanSheets || 0),
      goals: Number(totals?.goals || 0),
      matches: Number(totals?.matchesPlayed || totals?.matches || 0),
      minutesPlayed: Number(totals?.minutesPlayed || 0),
      playerCollectiveRatingAverage: totals?.playerCollectiveRatingAverage ?? null,
      playerCollectiveRatingCount: Number(totals?.playerCollectiveRatingCount || 0),
      points: Number(totals?.points || 0),
      rebounds: Number(totals?.rebounds || 0),
      recentReports: Array.isArray(teamPerformanceStats?.recentReports) ? teamPerformanceStats.recentReports : [],
      scoreAgainstTotal: Number(totals?.scoreAgainstTotal || 0),
      scoreForTotal: Number(totals?.scoreForTotal || 0),
      sport,
      threePointsMade: Number(totals?.threePointsMade || 0),
    };
  }, [teamPerformanceStats?.recentReports, teamPerformanceStats?.sport, teamPerformanceStats?.totals]);

    const canResetTeamStats = useMemo(
    () => Boolean(canManageTeam && isMyTeam),
    [canManageTeam, isMyTeam],
  );

  // handlers
  const handleEditTeam = useCallback(() => {
    if (currentUser) {
      navigation.navigate(RouteNames.TeamStack, {
        params: { clubId: team?.club?.documentId, teamId },
        screen: RouteNames.TeamEdit,
      });
    }
  }, [navigation, team?.club?.documentId, teamId, currentUser]);

  const handleToggleTrainerSelection = useCallback((/** @type {string} */ trainerId) => {
    setSelectedTrainerIds((current) => (current.includes(trainerId)
      ? current.filter((id) => id !== trainerId)
      : [...current, trainerId]));
  }, []);

  const handleOpenTrainerPicker = useCallback(() => {
    const currentTrainerIds = (team?.trainers || [])
      .map((/** @type {any} */ trainer) => trainer.documentId)
      .filter(Boolean);
    setSelectedTrainerIds(currentTrainerIds);
    setTrainerSearch('');
    setIsTrainerPickerVisible(true);
  }, [team?.trainers]);

  const handleSaveTeamTrainers = useCallback(() => {
    if (!teamId) return;
    if (!selectedTrainerIds.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('teamDetails.alerts.trainerRequired', 'Au moins un entraîneur est requis'),
      );
      return;
    }

    saveTeamTrainersMutation.mutate({
      documentId: teamId,
      trainers: {
        set: selectedTrainerIds.map((id) => ({ documentId: id })),
      },
    });
  }, [saveTeamTrainersMutation, selectedTrainerIds, t, teamId]);

  const handleTrainerCreated = useCallback((/** @type {any} */ createdTrainer) => {
    if (!createdTrainer?.documentId || !teamId) return;

    setSelectedTrainerIds((current) => (
      current.includes(createdTrainer.documentId)
        ? current
        : [...current, createdTrainer.documentId]
    ));

    refetchClubData();

    addTrainerToTeamMutation.mutate({
      documentId: teamId,
      trainers: {
        connect: [{ documentId: createdTrainer.documentId }],
      },
    });
  }, [addTrainerToTeamMutation, refetchClubData, teamId]);

  const handleAddTrainer = useCallback(() => {
    if (!canAddTrainer) return;
    handleOpenTrainerPicker();
  }, [canAddTrainer, handleOpenTrainerPicker]);

  useEffect(() => {
    if (!assignmentTrainerId || assignmentPrefillHandledRef.current || !canAddTrainer) return;
    if (!team?.documentId) return;

    assignmentPrefillHandledRef.current = true;

    const currentTrainerIds = (team?.trainers || [])
      .map((/** @type {any} */ trainer) => trainer.documentId)
      .filter(Boolean);
    const nextTrainerIds = currentTrainerIds.includes(assignmentTrainerId)
      ? currentTrainerIds
      : [...currentTrainerIds, assignmentTrainerId];

    setSelectedTrainerIds(nextTrainerIds);
    setTrainerSearch('');
    setIsTrainerPickerVisible(true);

    Alert.alert(
      'Preselection effectuee',
      `${assignmentTrainerName || "L'entraîneur"} est présélectionné. Vérifiez puis appuyez sur "Valider".`,
      [{ text: t('common.actions.ok', 'OK') }],
    );

    navigation.setParams({
      assignmentTrainerId: undefined,
      assignmentTrainerName: undefined,
    });
  }, [assignmentTrainerId, assignmentTrainerName, canAddTrainer, navigation, t, team?.documentId, team?.trainers]);

  useEffect(() => {
    let isMounted = true;

    if (!teamClubLogoUrl) {
      setTeamClubLogoRatio(1);
      return () => {
        isMounted = false;
      };
    }

    Image.getSize(
      teamClubLogoUrl,
      (width, height) => {
        if (!isMounted) return;
        if (width > 0 && height > 0) {
          setTeamClubLogoRatio(width / height);
          return;
        }
        setTeamClubLogoRatio(1);
      },
      () => {
        if (!isMounted) return;
        setTeamClubLogoRatio(1);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [teamClubLogoUrl]);

  const handleOpenCreateTrainerModal = useCallback(() => {
    Keyboard.dismiss();
    setIsTrainerPickerVisible(false);
    setTrainerSearch('');

    if (createTrainerOpenTimeoutRef.current) {
      clearTimeout(createTrainerOpenTimeoutRef.current);
    }
    createTrainerOpenTimeoutRef.current = setTimeout(() => {
      setIsCreateTrainerModalVisible(true);
      createTrainerOpenTimeoutRef.current = null;
    }, 180);
  }, []);

  const pendingRequest = useMemo(() => {
    if (!currentUser?.teamMembershipRequests) {
      return null;
    }
    return currentUser.teamMembershipRequests.find(
      (/** @type {any} */ r) => r.team?.documentId === teamId && r.state === 'pending',
    );
  }, [currentUser, teamId]);

  const trainerContactIds = useMemo(
    () => (team?.trainers || [])
      .map((/** @type {any} */ trainer) => trainer?.documentId)
      .filter((/** @type {any} */ trainerId) => Boolean(trainerId) && trainerId !== currentUser?.documentId),
    [currentUser?.documentId, team?.trainers],
  );

  const canCoachRequestJoinViewedTeam = useMemo(() => (
    currentUser?.role?.name === AUTH_USER_ROLES.coach
    && isMyClub
    && !isMyTeam
    && Boolean(teamId)
  ), [AUTH_USER_ROLES.coach, currentUser?.role?.name, isMyClub, isMyTeam, teamId]);

  const canContactViewedTeamTrainers = useMemo(() => (
    currentUser?.role?.name === AUTH_USER_ROLES.coach
    && isMyClub
    && !isMyTeam
    && trainerContactIds.length > 0
  ), [AUTH_USER_ROLES.coach, currentUser?.role?.name, isMyClub, isMyTeam, trainerContactIds.length]);

  const handleJoinTeam = useCallback(() => {
    if (!isAuthenticated) {
      openTeamAuthFlow('team-join-login');
      return;
    }

    const userId = currentUser?.documentId;
    if (teamId && userId) {
      Alert.alert(
        t('teamDetails.actions.joinRequest', "Demander à rejoindre l'équipe"),
        canCoachRequestJoinViewedTeam
          ? t(
            'teamDetails.alerts.joinRequest.coachDescription',
            "Les entraîneurs de l'équipe et le dirigeant du club vont recevoir votre demande.",
          )
          : t('teamDetails.alerts.joinRequest.description'),
        [
          {
            style: 'cancel',
            text: t('common.actions.cancel'),
          },
          {
            onPress: () => {
              createTeamMembershipRequestMutation.mutate({
                team: teamId,
                user: userId,
              });
            },
            text: t('common.actions.confirm'),
          },
        ],
      );
    }
  }, [canCoachRequestJoinViewedTeam, teamId, createTeamMembershipRequestMutation, currentUser?.documentId, isAuthenticated, openTeamAuthFlow, t]);

  const handleContactTeamTrainers = useCallback(async () => {
    if (!isAuthenticated) {
      openTeamAuthFlow('team-contact-trainers-login');
      return;
    }

    if (!trainerContactIds.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('teamDetails.actions.noTrainerContact', "Aucun entraîneur n'est disponible pour cette équipe."),
      );
      return;
    }

    try {
      const chat = await startWhisperChat(trainerContactIds);
      if (chat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
      }
    } catch (contactError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        getErrorMessage(
          contactError,
          t('teamDetails.actions.contactTrainersError', "Impossible d'ouvrir la conversation pour le moment."),
        ),
      );
    }
  }, [getErrorMessage, isAuthenticated, navigation, openTeamAuthFlow, startWhisperChat, t, trainerContactIds]);

  const handleLeaveTeam = useCallback(() => {
    if (teamId && currentUser?.documentId) {
      leaveTeamMutation.mutate(teamId);
    }
  }, [teamId, currentUser?.documentId, leaveTeamMutation]);

  const handleAskToLeave = useCallback(() => {
    Alert.alert(
      t('teamDetails.alerts.leave.title'),
      t('teamDetails.alerts.leave.description'),
      [
        {
          text: t('teamDetails.alerts.leave.actions.cancel'),
        },
        {
          onPress: handleLeaveTeam,
          text: t('teamDetails.alerts.leave.actions.confirm'),
        },
      ],
    );
  }, [t, handleLeaveTeam]);

  const handleResetStats = useCallback(() => {
    if (!teamId || !canResetTeamStats) return;

    Alert.alert(
      t('teamDetails.stats.resetTitle', 'Reinitialiser les statistiques ?'),
      t('teamDetails.stats.resetDescription', 'Les compteurs repartiront de zéro à partir de maintenant. L\'historique est conservé.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => {
            resetTeamStatsMutation.mutate({
              reason: t('teamDetails.stats.resetReasonDefault', 'Reset manuel depuis Mon équipe'),
            });
          },
          style: 'destructive',
          text: t('common.confirm', 'Confirmer'),
        },
      ],
    );
  }, [canResetTeamStats, resetTeamStatsMutation, t, teamId]);

  const handleUserPress = (/** @type {User} */ user) => {
    if (!isAuthenticated) {
      openTeamAuthFlow('team-user-profile-login', { userId: user?.documentId });
      return;
    }

    if (user?.documentId) {
      if (user?.documentId === currentUser?.documentId) {
        navigation.navigate(RouteNames.ProfileStack);
      } else {
        navigation.navigate(RouteNames.ProfileStack, {
          params: { userId: user.documentId },
          screen: RouteNames.UserDetails,
        });
      }
    }
  };

  const handleStartChat = async () => {
    if (!isAuthenticated) {
      openTeamAuthFlow('team-chat-login');
      return;
    }

    if (team?.documentId) {
      const newChat = await startTeamChat(team?.documentId);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    }
  };

  const handleManageDefaultComposition = useCallback(() => {
    if (!team?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: {
        editorMode: 'team-default',
        players: filteredPlayers,
        sport: team?.activities?.[0]?.name || 'football',
        teamId: team.documentId,
        teamName: team.name || 'Equipe',
      },
      screen: RouteNames.TacticalSelectionV2,
    });
  }, [filteredPlayers, navigation, team?.activities, team?.documentId, team?.name]);

  const handleSyncStandings = useCallback(() => {
    if (!teamId || refreshScrapingMutation.isPending || isExternalCompetitionPhaseActive) return;

    refreshScrapingMutation.mutate(teamId);
  }, [isExternalCompetitionPhaseActive, refreshScrapingMutation, teamId]);

  const showEditAction = canManageTeam
    && isMyClub
    && (isMyTeam || (team?.club?.documentId ? canEditClub(team.club.documentId) : false));
  const showTeamChatAction = canManageTeam && allMembers?.length > 1 && isMyTeam;
  const showDefaultCompositionAction = canManageTeam;
  const showLeaveAction = isMyTeam;
  const showContactTrainersAction = canContactViewedTeamTrainers;
  const showJoinAction = !isAuthenticated || canJoinTeam(teamId) || canCoachRequestJoinViewedTeam;
  const joinActionTitle = (() => {
    if (pendingRequest) {
      return t('teamDetails.actions.requestPending', 'Demande en attente');
    }

    if (!isAuthenticated) {
      return t('teamDetails.actions.publicJoin', "C'est mon \u00E9quipe");
    }

    if (canCoachRequestJoinViewedTeam) {
      return t('teamDetails.actions.joinRequest', "Demander \u00E0 rejoindre l'\u00E9quipe");
    }

    return t('teamDetails.actions.join');
  })();
  const hasTeamActionsPanel = showEditAction
    || showTeamChatAction
    || showContactTrainersAction
    || showDefaultCompositionAction
    || showLeaveAction
    || showJoinAction;

  useEffect(() => {
    if (!hasTeamActionsPanel) {
      setIsTeamActionsPanelOpen(false);
    }
  }, [hasTeamActionsPanel]);

  useEffect(() => {
    if (!showJoinAction || !teamId) return;

    const autoOpenKey = `${teamId}:${canCoachRequestJoinViewedTeam ? 'coach' : 'player'}`;
    if (autoOpenedTeamActionsKeyRef.current === autoOpenKey) return;

    autoOpenedTeamActionsKeyRef.current = autoOpenKey;
    setIsTeamActionsPanelOpen(true);
  }, [canCoachRequestJoinViewedTeam, showJoinAction, teamId]);

  const handleDeleteTrainer = (/** @type {string} */ trainerId) => {
    Alert.alert(
      t('teamDetails.alerts.deleteTrainer.title'),
      t('teamDetails.alerts.deleteTrainer.description'),
      [
        {
          text: t('teamDetails.alerts.deleteTrainer.actions.cancel'),
        },
        {
          onPress: () => {
            deleteTrainerMutation.mutate(trainerId);
          },
          text: t('teamDetails.alerts.deleteTrainer.actions.confirm'),
        },
      ],
    );
  };

  const handleRemovePlayer = (/** @type {string} */ playerId) => {
    Alert.alert(
      t('teamDetails.alerts.removePlayer.title', 'Supprimer le joueur'),
      t('teamDetails.alerts.removePlayer.description', 'Voulez-vous vraiment retirer ce joueur de l\'equipe ?'),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel'),
        },
        {
          onPress: () => {
            const currentTeamId = teamId;
            if (currentTeamId) {
              removePlayerMutation.mutate({ playerId, teamId: currentTeamId });
            }
          },
          style: 'destructive',
          text: t('common.actions.confirm'),
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchTeamStats();
      refetchTeamPerformanceStats();
    }, [refetch, refetchTeamPerformanceStats, refetchTeamStats]),
  );

  useFocusEffect(
    useCallback(() => {
      if (invite && canJoinTeam(teamId) && !pendingRequest) {
        handleJoinTeam();
      }
    }, [invite, canJoinTeam, teamId, pendingRequest, handleJoinTeam]),
  );

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!isExternalCompetitionFlowLocked) {
      return;
    }

    event.preventDefault();
    notifyExternalCompetitionFlowLocked();
  }), [isExternalCompetitionFlowLocked, navigation, notifyExternalCompetitionFlowLocked]);

  useEffect(() => {
    if (!showPerformanceTabs && activeTab !== 'infos') {
      if (!(showStatsTab && activeTab === 'stats')) {
        setActiveTab('infos');
      }
      return;
    }

    if (showPerformanceTabs || showStatsTab) {
      const allowedTabs = ['infos'];
      if (showStandingsTab) allowedTabs.push('standings');
      if (showCalendarTab) allowedTabs.push('calendar');
      if (showStatsTab) allowedTabs.push('stats');
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('infos');
      }
    }
  }, [activeTab, showPerformanceTabs, showStandingsTab, showCalendarTab, showStatsTab]);

  useEffect(() => () => {
    if (createTrainerOpenTimeoutRef.current) {
      clearTimeout(createTrainerOpenTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof team?.externalStandingUrl === 'string' && team.externalStandingUrl.length > 0) {
      setFfbbUrl(team.externalStandingUrl);
    }
  }, [team?.externalStandingUrl]);

  useEffect(() => {
    if (!openExternalSourceSetup || !canConfigureFFBB) return;

    openExternalSourceSetupModal();
    navigation.setParams({
      ...route?.params,
      openExternalSourceSetup: false,
      source: undefined,
    });
  }, [
    canConfigureFFBB,
    navigation,
    openExternalSourceSetup,
    openExternalSourceSetupModal,
    route?.params,
  ]);

  useEffect(() => {
    setSelectedMonthKey(null);
    setSelectedUpcomingMatchKey(null);
  }, [team?.documentId, team?.externalDataLastUpdate, team?.externalSyncUpdatedAt]);

  useEffect(() => {
    setCalendarDisplayMode('upcoming');
  }, [team?.documentId]);

  useEffect(() => {
    setStatsMode(isMyTeam ? 'attendance' : 'performance');
  }, [isMyTeam, team?.documentId]);

  useEffect(() => {
    setSelectedMonthKey(null);
    setSelectedUpcomingMatchKey(null);
  }, [calendarDisplayMode]);

  const renderTab = (/** @type {string} */ key, /** @type {string} */ label, /** @type {() => void} */ onPress) => {
    const isActive = activeTab === key;
    return (
      <TouchableOpacity
        disabled={isExternalCompetitionFlowLocked}
        onPress={() => {
          if (isExternalCompetitionFlowLocked) {
            notifyExternalCompetitionFlowLocked();
            return;
          }

          (onPress || (() => setActiveTab(key)))();
        }}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          Spaces.paddingVertical[8],
          Spaces.paddingHorizontal[4],
          {
            borderRadius: 18,
            flex: 1,
            minHeight: 44,
          },
          isActive
            ? { backgroundColor: Colors.primary500 }
            : null,
          isExternalCompetitionFlowLocked ? { opacity: 0.8 } : null,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            isActive ? Fonts.p3Bold : Fonts.p3,
            isActive ? Fonts.neutral00 : Fonts.neutral100,
            Fonts.textCenter,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleOpenSyncedEvent = useCallback((/** @type {any} */ eventId) => {
    if (!eventId) return;
    setShowExternalSyncReportModal(false);
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const handleOpenPerformanceMatch = useCallback((/** @type {any} */ sourceType, /** @type {any} */ sourceDocumentId) => {
    if (!sourceDocumentId) return;

    if (String(sourceType || '').trim().toLowerCase() === 'league_match') {
      navigateToLeagueMatchDetails(navigation, sourceDocumentId);
      return;
    }

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: sourceDocumentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const renderExternalSyncItems = useCallback((/** @type {any} */ title, /** @type {any} */ items, /** @type {any} */ accentColor) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
        {items.map((/** @type {any} */ item, /** @type {number} */ index) => {
          const itemDateLabel = formatExternalSyncDate(item?.date);
          const roundLabel = item?.round !== null && item?.round !== undefined && item?.round !== ''
            ? `J${item.round}`
            : null;
          const opponentLabel = item?.opponent || t('teamDetails.external.report.unknownOpponent', 'Adversaire non precise');
          const reasonLabel = item?.reason || null;
          const homeAwayLabel = item?.homeAway === 'home'
            ? t('teamDetails.external.report.home', 'Domicile')
            : item?.homeAway === 'away'
              ? t('teamDetails.external.report.away', 'Exterieur')
              : null;

          return (
            <View
              key={`${title}-${item?.eventDocumentId || item?.matchId || index}`}
              style={[
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius16,
                Spaces.padding[12],
                Spaces.gap[6],
                {
                  borderColor: `${accentColor}55`,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {roundLabel ? `${roundLabel} - ${opponentLabel}` : opponentLabel}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.primary100]}>
                    {[homeAwayLabel, itemDateLabel].filter(Boolean).join(' - ') || t('teamDetails.external.report.dateUnknown', 'Date à confirmer')}
                  </Text>
                  {reasonLabel ? (
                    <Text style={[Fonts.p4, { color: accentColor }]}>
                      {reasonLabel}
                    </Text>
                  ) : null}
                </View>
                {item?.eventDocumentId ? (
                  <Button
                    onPress={() => handleOpenSyncedEvent(item.eventDocumentId)}
                    title={t('teamDetails.external.report.openEvent', "Ouvrir l'evenement")}
                    variant="SecondaryLight"
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [
    Alignments.alignCenter,
    Alignments.justifySpaceBetween,
    Alignments.row,
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius16,
    Fonts.neutral00,
    Fonts.p2Bold,
    Fonts.p3,
    Fonts.p4,
    Fonts.primary100,
    Spaces.gap,
    Spaces.padding,
    formatExternalSyncDate,
    handleOpenSyncedEvent,
    t,
  ]);

  const renderExternalSyncCard = () => {
    if (!showExternalSyncCard) return null;

    return (
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
          Spaces.gap[12],
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h5Bold, Fonts.neutral00]}>
              {t('teamDetails.external.cardTitle', 'Source externe')}
            </Text>
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {externalSyncCompetitionName || t('teamDetails.external.noSource', 'Aucune source configurée')}
            </Text>
          </View>
          <View
            style={[
              ApplicationStyle.borderRadius24,
              Spaces.paddingVertical[6],
              Spaces.paddingHorizontal[10],
              {
                backgroundColor: externalSyncStatusMeta.badgeBackground,
                borderColor: externalSyncStatusMeta.badgeBorder,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: externalSyncStatusMeta.textColor }]}>
              {externalSyncStatusMeta.label}
            </Text>
          </View>
        </View>

        <View style={[Spaces.gap[4]]}>
          {externalSyncProviderLabel ? (
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {`Provider: ${externalSyncProviderLabel}`}
            </Text>
          ) : null}
          {externalSyncSourceResolutionLabel ? (
            <Text style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.resolutionMode', 'Mode de résolution')}: {externalSyncSourceResolutionLabel}
            </Text>
          ) : null}
          {externalSyncSelectedTeamName ? (
            <Text style={[Fonts.p3, Fonts.neutral00]}>
              {t('teamDetails.external.followedTeam', 'Equipe suivie')}: {externalSyncSelectedTeamName}
            </Text>
          ) : null}
          {externalSyncPouleName ? (
            <Text style={[Fonts.p3, Fonts.neutral00]}>
              {t('teamDetails.external.pool', 'Poule')}: {externalSyncPouleName}
            </Text>
          ) : null}
          {externalSyncUpdatedLabel ? (
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {t('teamDetails.external.lastSync', 'Dernière synchronisation')}: {externalSyncUpdatedLabel}
            </Text>
          ) : null}
          {externalSyncRequestedUrl ? (
            <Text numberOfLines={2} style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.requestedSource', 'Lien demande')}: {externalSyncRequestedUrl}
            </Text>
          ) : null}
          {externalSyncResolvedSourceUrl && externalSyncResolvedSourceUrl !== externalSyncRequestedUrl ? (
            <Text numberOfLines={2} style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.resolvedSource', 'Source resolue')}: {externalSyncResolvedSourceUrl}
            </Text>
          ) : null}
          {externalSyncStrategyLabel ? (
            <Text style={[Fonts.p4, Fonts.primary100]}>
              {externalSyncStrategyLabel}
            </Text>
          ) : null}
          {externalConfigUpdatedLabel ? (
            <Text style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.lastConfigUpdate', 'Lien mis à jour')}: {externalConfigUpdatedLabel}
            </Text>
          ) : null}
          {externalConfigUpdatedByLabel ? (
            <Text style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.lastConfigUpdateBy', 'Mis à jour par')}: {externalConfigUpdatedByLabel}
            </Text>
          ) : null}
          {externalSyncReport?.mode ? (
            <Text style={[Fonts.p4, Fonts.primary100]}>
              {t('teamDetails.external.lastMode', 'Origine')}: {externalSyncModeMeta.label}
            </Text>
          ) : null}
        </View>

        {externalSyncSummary ? (
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {[
              {
                key: 'created',
                label: t('teamDetails.external.summary.created', 'Créés'),
                value: externalSyncSummary.created || 0,
              },
              {
                key: 'updated',
                label: t('teamDetails.external.summary.updated', 'Mis à jour'),
                value: externalSyncSummary.updated || 0,
              },
              {
                key: 'scoreUpdated',
                label: t('teamDetails.external.summary.scoreUpdated', 'Scores importes'),
                value: externalSyncSummary.scoreUpdated || 0,
              },
              {
                key: 'archivedFuture',
                label: t('teamDetails.external.summary.archived', 'Archives'),
                value: externalSyncSummary.archivedFuture || 0,
              },
              {
                key: 'unchanged',
                label: t('teamDetails.external.summary.unchanged', 'Inchangés'),
                value: externalSyncSummary.unchanged || 0,
              },
              {
                key: 'venueEnriched',
                label: t('teamDetails.external.summary.venueEnriched', 'Lieux enrichis'),
                value: externalSyncSummary.venueEnriched || 0,
              },
              {
                key: 'venueFallbackUsed',
                label: t('teamDetails.external.summary.venueFallbackUsed', 'Lieu à confirmer'),
                value: externalSyncSummary.venueFallbackUsed || 0,
              },
            ].map((stat) => (
              <View
                key={stat.key}
                style={[
                  ApplicationStyle.borderRadius16,
                  Spaces.paddingVertical[8],
                  Spaces.paddingHorizontal[12],
                  {
                    backgroundColor: `${Colors.primary500}14`,
                    borderColor: `${Colors.primary500}33`,
                    borderWidth: 1,
                    minWidth: 88,
                  },
                ]}
              >
                <Text style={[Fonts.p4, Fonts.primary100]}>{stat.label}</Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {team?.externalSyncError ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Spaces.padding[12],
              Spaces.gap[4],
              {
                backgroundColor: `${Colors.error500}16`,
                borderColor: `${Colors.error500}44`,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
              {t('teamDetails.external.errorTitle', 'Problème de synchronisation')}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral00]}>
              {team.externalSyncError}
            </Text>
          </View>
        ) : null}

        {externalSyncReport?.warnings?.length ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              Spaces.padding[12],
              Spaces.gap[4],
              {
                backgroundColor: `${Colors.warning500}18`,
                borderColor: `${Colors.warning500}44`,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
              {t('teamDetails.external.warningsTitle', 'Avertissements')}
            </Text>
            {externalSyncReport.warnings.slice(0, 2).map((/** @type {any} */ warning, /** @type {number} */ index) => (
              <Text key={`${warning}-${index}`} style={[Fonts.p4, Fonts.neutral00]}>
                {`- ${warning}`}
              </Text>
            ))}
          </View>
        ) : null}

        {externalSyncHistory.length ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {t('teamDetails.external.historyTitle', 'Dernières synchronisations')}
            </Text>
            {externalSyncHistory.map((/** @type {any} */ entry, /** @type {number} */ index) => {
              const historyModeMeta = getExternalSyncModeMeta(entry?.mode, entry?.status);
              const historyDateLabel = formatExternalSyncDate(entry?.syncedAt);
              const historySummary = [
                `${t('teamDetails.external.summary.created', 'Créés')}: ${entry?.created || 0}`,
                `${t('teamDetails.external.summary.updated', 'Mis à jour')}: ${entry?.updated || 0}`,
                `${t('teamDetails.external.summary.scoreUpdated', 'Scores importes')}: ${entry?.scoreUpdated || 0}`,
              ].join('  •  ');
              const historyFlags = [
                entry?.warningsCount
                  ? `${entry.warningsCount} ${t('teamDetails.external.history.warnings', 'avertissements')}`
                  : null,
                entry?.errorsCount
                  ? `${entry.errorsCount} ${t('teamDetails.external.history.errors', 'erreurs')}`
                  : null,
              ].filter(Boolean).join('  •  ');

              return (
                <View
                  key={`${entry?.syncedAt || 'history'}-${entry?.mode || index}`}
                  style={[
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[12],
                    Spaces.gap[4],
                    {
                      backgroundColor: `${historyModeMeta.accentColor}14`,
                      borderColor: `${historyModeMeta.accentColor}33`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: historyModeMeta.accentColor }]}>
                    {historyModeMeta.label}
                  </Text>
                  {historyDateLabel ? (
                    <Text style={[Fonts.p4, Fonts.primary100]}>
                      {historyDateLabel}
                    </Text>
                  ) : null}
                  <Text style={[Fonts.p4, Fonts.neutral00]}>
                    {historySummary}
                  </Text>
                  {historyFlags ? (
                    <Text style={[Fonts.p4, Fonts.primary100]}>
                      {historyFlags}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
          {canConfigureFFBB ? (
            <Button
              disabled={isExternalCompetitionPhaseActive}
              onPress={openExternalSourceSetupModal}
              style={{ flexGrow: 1 }}
              title={team?.externalStandingUrl
                ? t('teamDetails.external.actions.editSource', 'Modifier la source')
                : t('teamDetails.external.actions.addSource', 'Ajouter une source')}
              variant="SecondaryLight"
            />
          ) : null}
          {canRefreshExternalSync ? (
            <Button
              disabled={isExternalCompetitionFlowLocked}
              isLoading={isExternalCompetitionRefreshing || refreshScrapingMutation.isPending}
              onPress={handleSyncStandings}
              style={{ flexGrow: 1 }}
              title={t('teamDetails.external.actions.sync', 'Synchroniser')}
              variant="Secondary"
            />
          ) : null}
          {externalSyncReport ? (
            <Button
              onPress={() => openExternalSyncReport(externalSyncReport)}
              style={{ flexGrow: 1 }}
              title={t('teamDetails.external.actions.report', 'Voir le rapport')}
              variant="SecondaryLight"
            />
          ) : null}
          {canManageTeam ? (
            <Button
              disabled={isExternalCompetitionPhaseActive}
              onPress={() => setShowFFBBErrorModal(true)}
              style={{ flexGrow: 1 }}
              title={t('teamDetails.external.actions.reportBug', 'Signaler')}
              variant="SecondaryLight"
            />
          ) : null}
        </View>
      </View>
    );
  };

  const isMissingTeamId = !teamId;
  const isInitialTeamLoading = isLoading && !team;
  const isRefreshing = isFetching && !isLoading;
  const isTeamLoadingError = Boolean(error) && !team;
  const isTeamNotFound = Boolean(teamId) && !isLoading && !error && !team;

  if (isInitialTeamLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[32],
          Spaces.gap[16],
          Alignments.justifyCenter,
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Loader />
          <Text style={[Fonts.p2, Fonts.primary100]}>
            Chargement de l'équipe...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isTeamLoadingError) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[32],
          Spaces.gap[16],
          Alignments.justifyCenter,
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            Impossible de charger l'équipe
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {getErrorMessage(error, 'Reessayez dans quelques instants.')}
          </Text>
          <Button onPress={() => refetch()} title="Réessayer" variant="Primary" />
          <Button onPress={() => navigation.navigate(RouteNames.TeamList)} title="Retour aux équipes" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  if (isMissingTeamId || isTeamNotFound) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[32],
          Spaces.gap[16],
          Alignments.justifyCenter,
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {isMissingTeamId ? 'Équipe introuvable' : 'Cette équipe est introuvable'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {isMissingTeamId
              ? 'Aucun identifiant d\'équipe n\'a été fourni.'
              : 'Le lien est peut-être obsolète ou l\'équipe a été supprimée.'}
          </Text>
          <Button onPress={() => navigation.navigate(RouteNames.TeamList)} title="Retour aux équipes" variant="Secondary" />
          {!isMissingTeamId ? (
            <Button onPress={() => refetch()} title="Réessayer" variant="Primary" />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[32],
        Spaces.gap[16],
        Alignments.justifyStart,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.gap[8],
        Alignments.justifyCenter,
        Alignments.alignCenter]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t(`teamDetails.${isMyTeam ? 'myTitle' : 'title'}`).toUpperCase()}
        </Text>
        <View style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.neutral00,
          { width: 120 }]}
        />
        {primaryActivityLabel ? (
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {primaryActivityLabel.toUpperCase()}
          </Text>
        ) : null}
      </View>

      {(showPerformanceTabs || showStatsTab) ? (
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.fullWidth,
            Spaces.paddingHorizontal[4],
            Spaces.paddingVertical[4],
            {
              backgroundColor: 'rgba(23, 56, 68, 0.78)',
              borderColor: `${Colors.primary500}55`,
              borderRadius: 22,
              borderWidth: 1,
              elevation: 20,
              zIndex: 20,
            },
            Spaces.gap[4],
          ]}
        >
          {renderTab('infos', t('teamDetails.tabs.infos', 'Infos'))}
          {showStandingsTab
            ? renderTab('standings', t('teamDetails.tabs.standings', 'Classement'))
            : null}
          {showCalendarTab
            ? renderTab('calendar', t('teamDetails.tabs.calendar', 'Calendrier'))
            : null}
          {showStatsTab
            ? renderTab('stats', t('teamDetails.tabs.stats', 'Statistiques'))
            : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          Spaces.gap[24],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isRefreshing}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <WithDataWrapper
          isLoading={false}
          wrapperStyle={[Alignments.fill]}
        >
          {/* TAB CONTENT: INFOS */}
          {activeTab === 'infos' && (
          <View style={[Spaces.marginTop[8]]}>
            <View style={[Alignments.alignCenter, { elevation: 2, marginBottom: -40, zIndex: 2 }]}>
              {team?.club?.logo?.url ? (
                <ProfileAvatar
                  fitMode="contain"
                  imageStyle={{ backgroundColor: 'transparent' }}
                  imageUrl={team.club.logo.url}
                  safeInsetRatio={teamClubLogoFrame.safeInsetRatio}
                  shape="rounded"
                  size={90}
                  style={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    {
                      borderRadius: teamClubLogoFrame.borderRadius,
                      height: teamClubLogoFrame.height,
                      width: teamClubLogoFrame.width,
                    },
                  ]}
                  variant="logo"
                />
              ) : (
                <TeamShield
                  initials={team?.club?.name ? getClubInitials(team?.club?.name || '') : ''}
                />
              )}
            </View>
            <View
              key={team?.documentId}
              style={[
                ApplicationStyle.borderRadius24,
                ApplicationStyle.backgroundColor.primary700,
                Alignments.alignCenter,
                Spaces.gap[12],
                Spaces.padding[16],
                Spaces.paddingTop[40],
              ]}
            >
              <View style={[
                Spaces.gap[8],
                Alignments.alignCenter]}
              >
                <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                  {team?.name}
                </Text>
                {primaryActivityLabel ? (
                  <View
                    style={[
                      Spaces.paddingVertical[4],
                      Spaces.paddingHorizontal[12],
                      ApplicationStyle.borderRadius24,
                      { backgroundColor: `${Colors.primary500}22` },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                      {primaryActivityLabel.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                {showStandingsTab && myTeamRanking && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                    {`${myTeamRanking.rank}${myTeamRanking.rank === 1 ? 'er' : 'e'}`}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>-</Text>
                  <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                    {myTeamRanking.points}
                    {' '}
                    pts
                  </Text>
                </View>
                )}
              </View>
              {teamDescription ? (
                <View style={[Alignments.alignCenter]}>
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {teamDescription}
                  </Text>
                </View>
              ) : null}
              {(team?.city || team?.address?.properties?.label || team?.club?.address?.properties?.label || team?.club?.city) && (
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                <TeamLocationIconView
                  color={Colors.primary100}
                  height={14}
                  name="location-pin-alt-1"
                  width={14}
                />
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {team?.address?.properties?.label || team?.city || team?.club?.address?.properties?.label || team?.club?.city}
                </Text>
              </View>

              )}

              {/* Team Availability Slots are only relevant for League squads */}
              {team?.isLeague ? (
                <TeamSlotList
                  actionsEnabled={areSlotActionsEnabled}
                  isCaptain={canManageTeam}
                  onAddSlot={showSlotFeatureComingSoon}
                  onCheckIn={showSlotFeatureComingSoon}
                  slots={team?.slots || []}
                />
              ) : null}

              <View style={[
                Alignments.fullWidth,
                ApplicationStyle.separator,
                ApplicationStyle.backgroundColor.neutral00,
              ]}
              />
              <View style={[
                Spaces.gap[8],
                Alignments.row,
                Alignments.wrap,
                Alignments.justifyCenter,
              ]}
              >
                {team?.section ? (
                  <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                    {t('teamList.fields.section')}
                    {' : '}
                    <Text style={[Fonts.p2, Fonts.primary100]}>
                      {team?.section?.name}
                    </Text>
                  </Text>
                ) : null}
                {team?.category ? (
                  <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                    {t('teamList.fields.category')}
                    {' : '}
                    <Text style={[Fonts.p2, Fonts.primary100]}>
                      {team?.category?.name}
                    </Text>
                  </Text>
                ) : null}
                {team?.level ? (
                  <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                    {t('teamList.fields.level')}
                    {' : '}
                    <Text style={[Fonts.p2, Fonts.primary100]}>
                      {team?.level?.name}
                    </Text>
                  </Text>
                ) : null}
              </View>
            </View>
            <View
              style={[
                Spaces.gap[16],
                Spaces.marginTop[12],
                Spaces.paddingBottom[24],
              ]}
            >
              {((team?.club?.sponsor?.length ?? 0) > 0) && (
              <ScrollView
                contentContainerStyle={[Spaces.gap[16]]}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {team?.club?.sponsor?.map((/** @type {Sponsor} */ sponsor) => (
                  <View
                    key={sponsor.link}
                    style={[Alignments.relative, Spaces.marginTop[8]]}
                  >
                    <SponsorLogoTile
                      height={55}
                      imageUrl={sponsor?.logo?.url}
                      link={sponsor.link}
                      title={sponsor.title}
                      titleStyle={[Fonts.p2Bold, Fonts.neutral00]}
                      width={110}
                    />
                  </View>
                ))}
              </ScrollView>
              )}
              {(trainersCount || canAddTrainer) ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                      {t('teamDetails.sections.trainers', { count: trainersCount })}
                    </Text>
                    {canAddTrainer ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleAddTrainer}
                        variant="Primary"
                      />
                    ) : null}
                  </View>
                  {areTeamMembersHidden ? renderMembersHiddenCard(
                    t(
                      'teamDetails.sections.trainersHidden',
                      "Le club masque les entraîneurs de cette équipe pour les visiteurs externes.",
                    ),
                  ) : (
                    <>
                      {team?.trainers?.map((/** @type {User} */ trainer) => (
                    <TouchableOpacity
                      key={trainer.documentId}
                      onPress={() => handleUserPress(trainer)}
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.fill,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        Spaces.padding[16],
                        Spaces.gap[16]]}
                    >
                      <View
                        style={[
                          Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                      >
                        <ProfileAvatar
                          imageStyle={{ borderRadius: 40 }}
                          imageUrl={trainer?.avatar?.url}
                          size={40}
                          style={[
                            ApplicationStyle.borderWidth1,
                            ApplicationStyle.borderColor.neutral00,
                            { borderRadius: 40 },
                          ]}
                        />
                        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {`${trainer.firstname} ${trainer.lastname}`}
                        </Text>
                      </View>
                      {team?.club?.documentId && canEditClub(team?.club?.documentId)
                        && trainer?.role?.name === USER_ROLES.coach ? (
                          <View style={[Alignments.row, Spaces.gap[8]]}>
                            <Button
                              icon="trash"
                              isOption
                              onPress={() => handleDeleteTrainer(trainer.documentId || '')}
                              variant="SecondaryLight"
                            />
                          </View>
                        ) : null}
                    </TouchableOpacity>
                  ))}
                      {!trainersCount ? (
                    <View
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Spaces.padding[16],
                      ]}
                    >
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        {t('teamDetails.sections.noTrainer', 'Aucun entraîneur pour le moment')}
                      </Text>
                    </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
              {playersCount || canManageTeam ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                      {t('teamDetails.sections.players', { count: playersCount })}
                    </Text>
                    {canManageTeam && (
                    <Button
                      icon="share"
                      isOption
                      onPress={() => inviteTeamPlayers({
                        clubName: team?.club?.name,
                        teamId: team?.documentId || teamId,
                        teamName: team?.name,
                      })}
                      variant="Primary"
                    />
                    )}
                  </View>
                  {areTeamMembersHidden ? renderMembersHiddenCard(
                    t(
                      'teamDetails.sections.playersHidden',
                      "Le club masque les joueurs de cette équipe pour les visiteurs externes.",
                    ),
                  ) : (
                    <>
                      {filteredPlayers.map((/** @type {User} */ player) => (
                    <View
                      key={player.documentId}
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        Alignments.fill,
                        Spaces.padding[16],
                        Spaces.gap[16],
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => handleUserPress(player)}
                        style={[
                          Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                      >
                        <ProfileAvatar
                          imageStyle={{ borderRadius: 40 }}
                          imageUrl={player?.avatar?.url}
                          size={40}
                          style={[
                            ApplicationStyle.borderWidth1,
                            ApplicationStyle.borderColor.neutral00,
                            { borderRadius: 40 },
                          ]}
                        />
                        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {`${player.firstname} ${player.lastname}`}
                        </Text>
                      </TouchableOpacity>
                      {canManageTeam && (
                        <View style={[Alignments.row, Spaces.gap[8]]}>
                          <Button
                            icon="trash"
                            isOption
                            onPress={() => handleRemovePlayer(player.documentId || '')}
                            variant="SecondaryLight"
                          />
                        </View>
                      )}
                    </View>
                  ))}
                    </>
                  )}
                </View>
              ) : null}
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                >
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('teamDetails.sections.nextEvents')}
                  </Text>
                </View>
                <EventListContent
                  additionalFilters={{
                    ...(!isMyTeam ? { sessionStatus: 'open' } : {}),
                    teamIds: [team?.documentId || ''],
                  }}
                  showFilters={false}
                />
              </View>
            </View>
          </View>
          )}

          {/* TAB CONTENT: STANDINGS */}
          {showStandingsTab && activeTab === 'standings' && (
          <View style={[Spaces.padding[16], Alignments.alignCenter, Spaces.gap[16]]}>
            {team?.externalStandingData && team.externalStandingData.length > 0 ? (
              <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16], Alignments.fullWidth]}>
                <View style={[Alignments.row, Spaces.paddingBottom[8], { borderBottomColor: '#FFFFFF33', borderBottomWidth: 1 }]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { width: 25 }]}>#</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>Equipe</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center', width: 25 }]}>Pts</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center', width: 25 }]}>J</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center', width: 25 }]}>M</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center', width: 25 }]}>E</Text>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, { textAlign: 'center', width: 30 }]}>D</Text>
                </View>
                {team.externalStandingData
                  .slice()
                  .sort((/** @type {any} */ a, /** @type {any} */ b) => {
                    const aRank = Number(a?.rank ?? Number.MAX_SAFE_INTEGER);
                    const bRank = Number(b?.rank ?? Number.MAX_SAFE_INTEGER);
                    return aRank - bRank;
                  })
                  .map((/** @type {any} */ row, /** @type {number} */ index) => {
                    const isMyTeam = isExternalRowMyTeam(row);
                    const rowRank = row?.rank ?? index + 1;
                    return (
                      <View
                        key={`${row.teamName}-${index}`}
                        style={[
                          Alignments.row,
                          Spaces.paddingVertical[8],
                          { borderBottomColor: '#FFFFFF11', borderBottomWidth: 1 },
                          isMyTeam && {
                            backgroundColor: `${Colors.primary500}33`, borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { width: 25 }]}>{rowRank}</Text>
                        <Text numberOfLines={1} style={[Fonts.p2Bold, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { flex: 1 }]}>
                          {isMyTeam && '* '}
                          {row.teamName}
                        </Text>
                        <Text style={[Fonts.p2Bold, Fonts.primary500, { textAlign: 'center', width: 25 }]}>{row.points}</Text>
                        <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { textAlign: 'center', width: 25 }]}>{row.played}</Text>
                        <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { fontSize: 10, textAlign: 'center', width: 25 }]}>{row.goalFor || '-'}</Text>
                        <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { fontSize: 10, textAlign: 'center', width: 25 }]}>{row.goalAgainst || '-'}</Text>
                        <Text style={[Fonts.p2, isMyTeam ? Fonts.primary500 : Fonts.neutral00, { fontSize: 10, textAlign: 'center', width: 30 }]}>{row.goalDiff || '-'}</Text>
                      </View>
                    );
                  })}
              </View>
            ) : (
              <View style={[Alignments.alignCenter, Spaces.gap[16]]}>
                <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>
                  {t('teamDetails.ffbb.noData', 'Aucun classement externe configuré')}
                </Text>
                {canConfigureFFBB && (
                <Button
                  disabled={isExternalCompetitionPhaseActive}
                  onPress={openExternalSourceSetupModal}
                  title={t('teamDetails.ffbb.configure', 'Configurer le classement externe')}
                  variant="Primary"
                />
                )}
              </View>
            )}
            {renderExternalSyncCard()}
          </View>
          )}

          {/* TAB CONTENT: CALENDAR */}
          {showCalendarTab && activeTab === 'calendar' && (
          <View style={[Spaces.padding[16], Spaces.gap[16]]}>
            {team?.externalCalendarData && team.externalCalendarData.length > 0 ? (
              <View>
                {/* Calendar filters + list */}
                {(() => {
                  const modeOptions = /** @type {{ key: any; label: any }[]} */ ([
                    { key: 'upcoming', label: t('teamDetails.calendar.filters.myTeam', 'Mon équipe') },
                    { key: 'results', label: t('teamDetails.calendar.filters.poolResults', 'Résultats poule') },
                    { key: 'all', label: t('teamDetails.calendar.filters.poolCalendar', 'Calendrier poule') },
                  ]);

                  const nowTs = Date.now();
                  const selectedExternalTeamId = team?.externalTeamId
                    ? String(team.externalTeamId)
                    : '';
                  const normalizedExternalTeamName = team?.externalTeamName
                    ? normalizeTeamName(team.externalTeamName)
                    : '';

                  const normalizedMatches = /** @type {any[]} */ (team.externalCalendarData).map((/** @type {any} */ match, /** @type {number} */ index) => {
                    const matchDate = match?.date ? new Date(match.date) : null;
                    const dateTs = matchDate && !Number.isNaN(matchDate.getTime()) ? matchDate.getTime() : null;
                    const hasScore = (
                      match?.homeScore !== null && match?.homeScore !== undefined
                                    && match?.awayScore !== null && match?.awayScore !== undefined
                    );
                    const isPlayed = Boolean(match?.played) || hasScore;
                    const isUpcoming = !isPlayed && (dateTs === null || dateTs >= nowTs);
                    const roundLabel = (
                      match?.round !== null && match?.round !== undefined && match?.round !== ''
                    ) ? String(match.round) : null;
                    const monthKey = matchDate && !Number.isNaN(matchDate.getTime())
                      ? `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}`
                      : 'unknown';
                    const monthLabel = matchDate && !Number.isNaN(matchDate.getTime())
                      ? matchDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                      : t('teamDetails.calendar.monthUnknown', 'Date à confirmer');
                    const homeTeamId = match?.homeTeamId ? String(match.homeTeamId) : '';
                    const awayTeamId = match?.awayTeamId ? String(match.awayTeamId) : '';
                    const isMyHomeTeamById = Boolean(
                      selectedExternalTeamId && homeTeamId && homeTeamId === selectedExternalTeamId
                    );
                    const isMyAwayTeamById = Boolean(
                      selectedExternalTeamId && awayTeamId && awayTeamId === selectedExternalTeamId
                    );
                    const isMyHomeTeamByName = Boolean(
                      normalizedExternalTeamName
                      && isSameExternalTeamName(match?.homeTeam, team?.externalTeamName)
                    );
                    const isMyAwayTeamByName = Boolean(
                      normalizedExternalTeamName
                      && isSameExternalTeamName(match?.awayTeam, team?.externalTeamName)
                    );
                    const isMyTeamMatch = (
                      isMyHomeTeamById
                      || isMyAwayTeamById
                      || isMyHomeTeamByName
                      || isMyAwayTeamByName
                      || (!selectedExternalTeamId && !normalizedExternalTeamName)
                    );

                    return {
                      ...match,
                      _dateObj: matchDate,
                      _dateTs: dateTs,
                      _isPlayed: isPlayed,
                      _isUpcoming: isUpcoming,
                      _key: match?.matchId
                        ? `match-${match.matchId}`
                        : `${match?.homeTeam || 'home'}-${match?.awayTeam || 'away'}-${match?.date || 'no-date'}-${index}`,
                      _monthKey: monthKey,
                      _monthLabel: monthLabel,
                      _isMyTeamMatch: isMyTeamMatch,
                      _isMyHomeTeam: isMyHomeTeamById || isMyHomeTeamByName,
                      _isMyAwayTeam: isMyAwayTeamById || isMyAwayTeamByName,
                      _homeTeamId: homeTeamId,
                      linkedEventDocumentIdResolved: match?.linkedEventDocumentId || null,
                      _awayTeamId: awayTeamId,
                      _roundLabel: roundLabel,
                    };
                  });

                  const isUpcomingMode = calendarDisplayMode === 'upcoming';
                  const isMonthFilterMode = !isUpcomingMode;
                  const useRoundFilters = Boolean(
                    team?.externalProvider === 'ffbb' && !isUpcomingMode
                  );
                  const hasSelectedExternalTeam = Boolean(
                    selectedExternalTeamId || normalizedExternalTeamName
                  );

                  const modeScopedMatches = normalizedMatches.filter((/** @type {any} */ match) => {
                    if (calendarDisplayMode === 'upcoming') return match._isUpcoming;
                    if (calendarDisplayMode === 'results') return match._isPlayed;
                    return true;
                  });

                  const upcomingSourceMatches = hasSelectedExternalTeam
                    ? normalizedMatches.filter((/** @type {any} */ match) => match._isMyTeamMatch)
                    : normalizedMatches;

                  const upcomingMatches = upcomingSourceMatches
                    .filter((/** @type {any} */ match) => match._isUpcoming)
                    .slice()
                    .sort((/** @type {any} */ a, /** @type {any} */ b) => {
                      const aTs = a._dateTs;
                      const bTs = b._dateTs;
                      if (aTs === null && bTs === null) return String(a._key).localeCompare(String(b._key), 'fr');
                      if (aTs === null) return 1;
                      if (bTs === null) return -1;
                      return aTs - bTs;
                    });

                  const activeUpcomingIndex = (() => {
                    if (!upcomingMatches.length) return -1;
                    if (selectedUpcomingMatchKey) {
                      const index = upcomingMatches.findIndex((/** @type {any} */ match) => match._key === selectedUpcomingMatchKey);
                      if (index >= 0) return index;
                    }
                    return 0;
                  })();
                  const activeUpcomingMatch = activeUpcomingIndex >= 0
                    ? upcomingMatches[activeUpcomingIndex]
                    : null;
                  const canBrowseUpcoming = upcomingMatches.length > 1;
                  const activeUpcomingDateLabel = activeUpcomingMatch?._dateObj
                    ? activeUpcomingMatch._dateObj.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      weekday: 'short',
                      year: 'numeric',
                    })
                    : t('teamDetails.calendar.dateUnknown', 'Date à confirmer');
                  const activeUpcomingTimeLabel = activeUpcomingMatch?._dateObj
                    ? activeUpcomingMatch._dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';

                  const monthMetaByKey = modeScopedMatches.reduce((/** @type {Record<string, { count: number; label: string }>} */ acc, /** @type {any} */ match) => {
                    const key = useRoundFilters
                      ? (match._roundLabel ? `round-${match._roundLabel}` : 'round-unknown')
                      : (match._monthKey || 'unknown');
                    const current = acc[key] || {
                      count: 0,
                      label: useRoundFilters
                        ? (
                          match._roundLabel
                            ? t('teamDetails.calendar.round.chip', 'J{{round}}', { round: match._roundLabel })
                            : t('teamDetails.calendar.round.unknownShort', 'J?')
                        )
                        : (match._monthLabel || t('teamDetails.calendar.monthUnknown', 'Date à confirmer')),
                    };
                    current.count += 1;
                    acc[key] = current;
                    return acc;
                  }, /** @type {Record<string, { count: number; label: string }>} */ ({}));

                  const monthKeys = Object.keys(monthMetaByKey).sort((/** @type {string} */ a, /** @type {string} */ b) => {
                    if (useRoundFilters) {
                      if (a === 'round-unknown') return 1;
                      if (b === 'round-unknown') return -1;
                      const roundA = Number(String(a).replace('round-', ''));
                      const roundB = Number(String(b).replace('round-', ''));
                      if (Number.isNaN(roundA) && Number.isNaN(roundB)) return a.localeCompare(b);
                      if (Number.isNaN(roundA)) return 1;
                      if (Number.isNaN(roundB)) return -1;
                      return roundA - roundB;
                    }

                    if (a === 'unknown') return 1;
                    if (b === 'unknown') return -1;
                    return a.localeCompare(b);
                  });

                  const activeMonthKey = (
                    isMonthFilterMode
                                && selectedMonthKey
                                && monthMetaByKey[selectedMonthKey]
                  )
                    ? selectedMonthKey
                    : null;

                  const monthFilteredMatches = (isMonthFilterMode && activeMonthKey)
                    ? modeScopedMatches.filter((/** @type {any} */ match) => {
                      if (useRoundFilters) {
                        const roundKey = match._roundLabel ? `round-${match._roundLabel}` : 'round-unknown';
                        return String(roundKey) === String(activeMonthKey);
                      }
                      return String(match._monthKey) === String(activeMonthKey);
                    })
                    : modeScopedMatches;

                  const displayMatches = isUpcomingMode
                    ? (activeUpcomingMatch ? [activeUpcomingMatch] : [])
                    : monthFilteredMatches;

                  const sortedMatches = displayMatches
                    .slice()
                    .sort((/** @type {any} */ a, /** @type {any} */ b) => {
                      const aTs = a._dateTs;
                      const bTs = b._dateTs;
                      if (aTs === null && bTs === null) return String(a._key).localeCompare(String(b._key), 'fr');
                      if (aTs === null) return 1;
                      if (bTs === null) return -1;
                      if (calendarDisplayMode === 'results') return bTs - aTs;
                      return aTs - bTs;
                    });

                  const groupedMatches = sortedMatches.reduce((/** @type {any[]} */ groups, /** @type {any} */ match) => {
                    const monthLabel = match._monthLabel || t('teamDetails.calendar.monthUnknown', 'Date à confirmer');
                    const roundLabel = match._roundLabel
                      ? t('teamDetails.calendar.round.title', 'Journee {{round}}', { round: match._roundLabel })
                      : t('teamDetails.calendar.round.unknown', 'Journee non precisee');
                    const groupLabel = useRoundFilters ? roundLabel : monthLabel;
                    const groupSubtitle = useRoundFilters ? monthLabel : null;
                    const existingGroup = groups.find((/** @type {any} */ group) => group.label === groupLabel);
                    if (existingGroup) {
                      existingGroup.matches.push(match);
                      return groups;
                    }
                    return [...groups, { label: groupLabel, matches: [match], subtitle: groupSubtitle }];
                  }, /** @type {any[]} */ ([]));

                  const emptyLabel = calendarDisplayMode === 'upcoming'
                    ? t('teamDetails.calendar.empty.upcoming', 'Aucun match à venir pour cette équipe.')
                    : calendarDisplayMode === 'results'
                      ? t('teamDetails.calendar.empty.results', 'Aucun resultat disponible.')
                      : t('teamDetails.calendar.empty.all', 'Aucun match pour ce filtre.');
                  const totalVisibleMatches = isUpcomingMode ? upcomingMatches.length : sortedMatches.length;
                  const matchCountText = `${totalVisibleMatches} match${totalVisibleMatches > 1 ? 's' : ''}`;
                  const modeScopeText = isUpcomingMode
                    ? (
                      hasSelectedExternalTeam
                        ? t('teamDetails.calendar.scope.upcomingTeamOnly', 'Prochaines rencontres de votre équipe uniquement.')
                        : t('teamDetails.calendar.scope.upcomingAll', 'Rencontres à venir de la poule.')
                    )
                    : useRoundFilters
                      ? t('teamDetails.calendar.scope.ffbbRound', 'Affichage organise par journee FFBB.')
                      : t('teamDetails.calendar.scope.fullPool', 'Résultats et calendrier de toute la poule.');
                  const followedTeamName = String(team?.externalTeamName || team?.name || '').trim();
                  const showFollowedTeamBadge = hasSelectedExternalTeam && followedTeamName.length > 0;
                  const followedTeamLabel = t('teamDetails.calendar.followedTeam', 'Equipe suivie');
                  const followedTeamBadgeText = `${followedTeamLabel}: ${followedTeamName}`;

                  return (
                    <>
                      <ScrollView
                        contentContainerStyle={[Spaces.gap[8]]}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[Spaces.marginBottom[12]]}
                      >
                        {modeOptions.map((/** @type {any} */ option) => {
                          const isActive = calendarDisplayMode === option.key;
                          return (
                            <TouchableOpacity
                              key={option.key}
                              onPress={() => setCalendarDisplayMode(option.key)}
                              style={[
                                Spaces.paddingVertical[8],
                                Spaces.paddingHorizontal[16],
                                ApplicationStyle.borderRadius24,
                                isActive
                                  ? ApplicationStyle.backgroundColor.primary500
                                  : ApplicationStyle.backgroundColor.primary700,
                              ]}
                            >
                              <Text style={[Fonts.p2Bold, isActive ? Fonts.neutral900 : Fonts.neutral00]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      {showFollowedTeamBadge ? (
                        <View
                          style={[
                            Alignments.row,
                            Alignments.alignCenter,
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius24,
                            Spaces.paddingVertical[8],
                            Spaces.paddingHorizontal[12],
                            Spaces.marginBottom[8],
                            {
                              alignSelf: 'flex-start',
                              borderColor: `${Colors.primary500}66`,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              {
                                backgroundColor: Colors.primary500,
                                borderRadius: 999,
                                height: 8,
                                marginRight: 8,
                                width: 8,
                              },
                            ]}
                          />
                          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                            {followedTeamBadgeText}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[Fonts.p3, Fonts.primary100, Spaces.marginBottom[12]]}>
                        {modeScopeText}
                      </Text>

                      {isUpcomingMode ? (
                        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginBottom[16]]}>
                          <TouchableOpacity
                            onPress={() => {
                              if (!upcomingMatches.length) return;
                              const previousIndex = activeUpcomingIndex <= 0
                                ? upcomingMatches.length - 1
                                : activeUpcomingIndex - 1;
                              const previousMatch = upcomingMatches[previousIndex];
                              if (previousMatch?._key) setSelectedUpcomingMatchKey(previousMatch._key);
                            }}
                            style={[
                              Spaces.paddingVertical[8],
                              Spaces.paddingHorizontal[16],
                              ApplicationStyle.borderRadius24,
                              ApplicationStyle.backgroundColor.primary500,
                              { opacity: canBrowseUpcoming ? 1 : 0.75 },
                            ]}
                          >
                            <Text style={[Fonts.p2Bold, Fonts.neutral900]}>
                              {'<'}
                            </Text>
                          </TouchableOpacity>

                          <View style={[
                            Spaces.paddingVertical[8],
                            Spaces.paddingHorizontal[16],
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                          ]}
                          >
                            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                              {`${activeUpcomingDateLabel} - ${activeUpcomingTimeLabel}`}
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              if (!upcomingMatches.length) return;
                              const nextIndex = activeUpcomingIndex >= upcomingMatches.length - 1
                                ? 0
                                : activeUpcomingIndex + 1;
                              const nextMatch = upcomingMatches[nextIndex];
                              if (nextMatch?._key) setSelectedUpcomingMatchKey(nextMatch._key);
                            }}
                            style={[
                              Spaces.paddingVertical[8],
                              Spaces.paddingHorizontal[16],
                              ApplicationStyle.borderRadius24,
                              ApplicationStyle.backgroundColor.primary500,
                              { opacity: canBrowseUpcoming ? 1 : 0.75 },
                            ]}
                          >
                            <Text style={[Fonts.p2Bold, Fonts.neutral900]}>
                              {'>'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <ScrollView
                          contentContainerStyle={[Spaces.gap[8]]}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={[Spaces.marginBottom[16]]}
                        >
                          <TouchableOpacity
                            onPress={() => setSelectedMonthKey(null)}
                            style={[
                              Spaces.paddingVertical[8],
                              Spaces.paddingHorizontal[16],
                              ApplicationStyle.borderRadius24,
                              activeMonthKey === null
                                ? ApplicationStyle.backgroundColor.primary500
                                : ApplicationStyle.backgroundColor.primary700,
                            ]}
                          >
                            <Text style={[Fonts.p2Bold, activeMonthKey === null ? Fonts.neutral900 : Fonts.neutral00]}>
                              {useRoundFilters
                                ? t('teamDetails.calendar.rounds.all', 'Toutes les journees')
                                : t('teamDetails.calendar.months.all', 'Tous les mois')}
                            </Text>
                          </TouchableOpacity>
                          {monthKeys.map((monthKey) => {
                            const monthMeta = monthMetaByKey[monthKey];
                            if (!monthMeta) return null;
                            const isActive = String(activeMonthKey) === String(monthKey);
                            return (
                              <TouchableOpacity
                                key={monthKey}
                                onPress={() => setSelectedMonthKey(monthKey)}
                                style={[
                                  Spaces.paddingVertical[8],
                                  Spaces.paddingHorizontal[16],
                                  ApplicationStyle.borderRadius24,
                                  isActive
                                    ? ApplicationStyle.backgroundColor.primary500
                                    : ApplicationStyle.backgroundColor.primary700,
                                ]}
                              >
                                <Text style={[Fonts.p2Bold, isActive ? Fonts.neutral900 : Fonts.neutral00]}>
                                  {`${monthMeta.label} (${monthMeta.count})`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}

                      <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16]]}>
                        <Text style={[Fonts.p3, Fonts.primary100, Spaces.marginBottom[12]]}>
                          {matchCountText}
                        </Text>
                        {groupedMatches.length > 0 ? groupedMatches.map((group, groupIndex) => (
                          <View key={`${group.label}-${groupIndex}`} style={[groupIndex > 0 && Spaces.marginTop[16]]}>
                            <Text style={[
                              Fonts.p3Bold,
                              Fonts.primary100,
                              Spaces.marginBottom[8],
                              { textTransform: 'capitalize' },
                            ]}
                            >
                              {group.label}
                            </Text>
                            {group.subtitle ? (
                              <Text style={[Fonts.p4, Fonts.primary100, Spaces.marginBottom[8]]}>
                                {group.subtitle}
                              </Text>
                            ) : null}
                            {group.matches.map((/** @type {any} */ match) => {
                              const isMyHomeTeam = Boolean(match?._isMyHomeTeam);
                              const isMyAwayTeam = Boolean(match?._isMyAwayTeam);
                              const statusLabel = match._isPlayed
                                ? t('teamDetails.calendar.status.played', 'Termine')
                                : t('teamDetails.calendar.status.upcoming', 'A venir');
                              const dateLabel = match._dateObj
                                ? match._dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', weekday: 'short' })
                                : t('teamDetails.calendar.dateUnknown', 'Date à confirmer');
                              const timeLabel = match._dateObj
                                ? match._dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                : '--:--';

                              const canOpenLinkedEvent = Boolean(match?.linkedEventDocumentIdResolved);

                              return (
                                <TouchableOpacity
                                  activeOpacity={canOpenLinkedEvent ? 0.9 : 1}
                                  disabled={!canOpenLinkedEvent}
                                  key={match._key}
                                  onPress={() => {
                                    if (!canOpenLinkedEvent) return;
                                    handleOpenPerformanceMatch('event', match?.linkedEventDocumentIdResolved);
                                  }}
                                  style={[
                                    Spaces.padding[12],
                                    Spaces.marginBottom[10],
                                    {
                                      backgroundColor: '#FFFFFF08', borderColor: '#FFFFFF14', borderRadius: 12, borderWidth: 1,
                                    },
                                    canOpenLinkedEvent ? null : { opacity: 0.96 },
                                  ]}
                                >
                                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[8]]}>
                                    <Text style={[Fonts.p3, Fonts.primary100]}>
                                      {`${dateLabel} - ${timeLabel}`}
                                    </Text>
                                    <View
                                      style={[
                                        Spaces.paddingVertical[4],
                                        Spaces.paddingHorizontal[10],
                                        ApplicationStyle.borderRadius24,
                                        { backgroundColor: match._isPlayed ? '#FFFFFF22' : `${Colors.primary500}22` },
                                      ]}
                                    >
                                      <Text style={[Fonts.p3Bold, match._isPlayed ? Fonts.neutral00 : Fonts.primary500]}>
                                        {statusLabel}
                                      </Text>
                                    </View>
                                  </View>

                                  <View style={[Alignments.row, Alignments.alignCenter]}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                      <Text numberOfLines={2} style={[Fonts.p2Bold, isMyHomeTeam ? Fonts.primary500 : Fonts.neutral00]}>
                                        {match.homeTeam}
                                      </Text>
                                      {isMyHomeTeam ? (
                                        <Text style={[Fonts.p3, Fonts.primary100]}>
                                          {t('teamDetails.calendar.you', 'Vous')}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <View style={[Alignments.alignCenter, { width: 90 }]}>
                                      {match._isPlayed ? (
                                        <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                                          {`${match.homeScore} - ${match.awayScore}`}
                                        </Text>
                                      ) : (
                                        <Text style={[Fonts.p2Bold, Fonts.primary100]}>VS</Text>
                                      )}
                                      {!isUpcomingMode && match._roundLabel ? (
                                        <Text style={[Fonts.p3, Fonts.primary100]}>
                                          {`J${match._roundLabel}`}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 8 }}>
                                      <Text numberOfLines={2} style={[Fonts.p2Bold, isMyAwayTeam ? Fonts.primary500 : Fonts.neutral00]}>
                                        {match.awayTeam}
                                      </Text>
                                      {isMyAwayTeam ? (
                                        <Text style={[Fonts.p3, Fonts.primary100]}>
                                          {t('teamDetails.calendar.you', 'Vous')}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )) : (
                          <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>
                            {emptyLabel}
                          </Text>
                        )}
                      </View>
                    </>
                  );
                })()}
              </View>
            ) : (
              <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>Aucun calendrier disponible.</Text>
            )}

            {renderExternalSyncCard()}
          </View>
          )}

          {showStatsTab && activeTab === 'stats' && (
          <View style={[Spaces.padding[16], Spaces.gap[16]]}>
            <View style={[Alignments.row, Spaces.gap[8]]}>
              <TouchableOpacity
                onPress={() => setStatsMode('attendance')}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  Spaces.paddingVertical[10],
                  { borderRadius: 18, flex: 1 },
                  statsMode === 'attendance'
                    ? ApplicationStyle.backgroundColor.primary500
                    : ApplicationStyle.backgroundColor.primary700,
                ]}
              >
                <Text style={[statsMode === 'attendance' ? Fonts.p3Bold : Fonts.p3, Fonts.neutral00]}>
                  Vie d'équipe
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStatsMode('performance')}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  Spaces.paddingVertical[10],
                  { borderRadius: 18, flex: 1 },
                  statsMode === 'performance'
                    ? ApplicationStyle.backgroundColor.primary500
                    : ApplicationStyle.backgroundColor.primary700,
                ]}
              >
                <Text style={[statsMode === 'performance' ? Fonts.p3Bold : Fonts.p3, Fonts.neutral00]}>
                  Performance
                </Text>
              </TouchableOpacity>
            </View>

            {statsMode === 'attendance' ? (
              <>
                <View
                  style={[
                    Alignments.row,
                    Alignments.justifySpaceBetween,
                    ApplicationStyle.backgroundColor.primary700,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                  ]}
                >
                  <View style={[Alignments.alignCenter, { flex: 1 }]}>
                    <Text style={[Fonts.h3Bold, Fonts.primary500]}>{statsSummary.rowCount}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral00]}>Joueurs</Text>
                  </View>
                  <View style={[Alignments.alignCenter, { flex: 1 }]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{statsSummary.totalEvents}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral00]}>Événements</Text>
                  </View>
                  <View style={[Alignments.alignCenter, { flex: 1 }]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{statsSummary.lateCount}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral00]}>Retards</Text>
                  </View>
                  <View style={[Alignments.alignCenter, { flex: 1 }]}>
                    <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                      {statsSummary.lateMinutesAvg}
                      m
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral00]}>Moyenne</Text>
                  </View>
                </View>

                <View style={[Spaces.gap[8]]}>
                  <View style={[Alignments.row, Alignments.alignCenter, Spaces.paddingHorizontal[12]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1 }]}>Joueur</Text>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {statsColumns.map((column) => (
                        <View key={column.key} style={[Alignments.alignCenter, { width: 44 }]}>
                          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{column.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {isTeamStatsLoading ? (
                    <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>
                      {t('common.loading', 'Chargement...')}
                    </Text>
                  ) : teamStatsRows.length ? (
                    teamStatsRows.map((/** @type {any} */ row, /** @type {number} */ index) => (
                      <StatRow
                        columns={statsColumns}
                        isEven={index % 2 === 0}
                        key={row?.user?.documentId || `stats-${index}`}
                        player={row}
                      />
                    ))
                  ) : (
                    <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>
                      {t('teamDetails.stats.noData', 'Aucune statistique disponible pour le moment.')}
                    </Text>
                  )}
                </View>

                {statsBaselineLabel ? (
                  <Text style={[Fonts.p3, Fonts.primary100]}>
                    {t('teamDetails.stats.baselineLabel', 'Depuis le {{date}}', { date: statsBaselineLabel })}
                  </Text>
                ) : null}

                {canResetTeamStats ? (
                  <Button
                    isLoading={resetTeamStatsMutation.isPending}
                    onPress={handleResetStats}
                    title={t('teamDetails.stats.resetAction', 'Reinitialiser les statistiques')}
                    variant="Secondary"
                  />
                ) : null}
              </>
            ) : (
              <View style={[Spaces.gap[16]]}>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary700,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[8],
                  ]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.primary500]}>Performance équipe</Text>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Récap du groupe</Text>
                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    Lecture des stats publiées de l'équipe, avec prise en compte des réponses joueur quand elles sont disponibles.
                  </Text>
                </View>

                <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                  {[
                    { label: 'Matchs', value: performanceSummary.matches },
                    { label: 'Minutes', value: performanceSummary.minutesPlayed },
                    { label: performanceSummary.sport === 'basketball' ? 'Points' : 'Buts', value: performanceSummary.sport === 'basketball' ? performanceSummary.points : performanceSummary.goals },
                    { label: 'Passes D', value: performanceSummary.assists },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius20,
                        Spaces.padding[16],
                        Spaces.gap[4],
                        { flexGrow: 1, minWidth: '47%' },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.primary100]}>{stat.label}</Text>
                      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{stat.value}</Text>
                    </View>
                  ))}
                </View>

                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary700,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[8],
                  ]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {`Score cumule: ${performanceSummary.scoreForTotal} - ${performanceSummary.scoreAgainstTotal}`}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    {performanceSummary.sport === 'basketball'
                      ? `${performanceSummary.rebounds} rebonds - ${performanceSummary.threePointsMade} tirs à 3 points`
                      : `${performanceSummary.cleanSheets} clean sheets - ${performanceSummary.scoreAgainstTotal} buts encaissés`}
                  </Text>
                </View>

                {(performanceSummary.averageCollectiveRating !== null || performanceSummary.playerCollectiveRatingAverage !== null) ? (
                  <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    {performanceSummary.averageCollectiveRating !== null ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius20,
                          Spaces.padding[16],
                          Spaces.gap[4],
                          { flexGrow: 1, minWidth: '47%' },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, Fonts.primary100]}>Coach</Text>
                        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{`${performanceSummary.averageCollectiveRating}/10`}</Text>
                      </View>
                    ) : null}
                    {performanceSummary.playerCollectiveRatingAverage !== null ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius20,
                          Spaces.padding[16],
                          Spaces.gap[4],
                          { flexGrow: 1, minWidth: '47%' },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, Fonts.primary100]}>Joueurs</Text>
                        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{`${performanceSummary.playerCollectiveRatingAverage}/10`}</Text>
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {`${performanceSummary.playerCollectiveRatingCount} note${performanceSummary.playerCollectiveRatingCount > 1 ? 's' : ''}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {pendingPerformanceMatches.length ? (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Réponses joueur en attente de validation équipe</Text>
                    {pendingPerformanceMatches.map((/** @type {any} */ pendingMatch) => (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        disabled={!pendingMatch?.sourceDocumentId}
                        key={
                          [pendingMatch?.sourceType, pendingMatch?.sourceDocumentId, pendingMatch?.lastSubmittedAt]
                            .filter(Boolean)
                            .join(':')
                          || pendingMatch?.matchLabel
                          || 'pending-match'
                        }
                        onPress={() => handleOpenPerformanceMatch(pendingMatch?.sourceType, pendingMatch?.sourceDocumentId)}
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius20,
                          Spaces.padding[16],
                          Spaces.gap[8],
                          !pendingMatch?.sourceDocumentId ? { opacity: 0.92 } : null,
                        ]}
                      >
                        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[8]]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                              {pendingMatch?.matchLabel || 'Match'}
                            </Text>
                            <Text style={[Fonts.p4, Fonts.neutral100]}>
                              {`${Number(pendingMatch?.submittedResponses || 0)}/${Number(pendingMatch?.eligibleCount || 0)} joueurs ont répondu`}
                            </Text>
                          </View>
                          <View style={[Spaces.gap[8], { alignItems: 'flex-end' }]}>
                            <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[8]]}>
                              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                                {pendingMatch?.reportStatus === 'draft' ? 'Brouillon équipe' : 'En attente du bilan équipe'}
                              </Text>
                            </View>
                            {pendingMatch?.sourceDocumentId ? (
                              <View style={[ApplicationStyle.backgroundColor.primary800, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[8]]}>
                                <Text style={[Fonts.p4Bold, Fonts.primary500]}>Ouvrir</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {pendingMatch?.lastSubmittedAt ? (
                          <Text style={[Fonts.p4, Fonts.neutral100]}>
                            {`Dernière réponse le ${new Date(pendingMatch.lastSubmittedAt).toLocaleString('fr-FR')}`}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {performanceSummary.recentReports.length ? (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Derniers matchs renseignes</Text>
                    {performanceSummary.recentReports.map((/** @type {any} */ report) => (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        disabled={!report?.sourceDocumentId}
                        key={
                          report?.documentId
                          || [report?.sourceType, report?.sourceDocumentId, report?.finalizedAt]
                            .filter(Boolean)
                            .join(':')
                          || report?.matchLabel
                          || 'recent-report'
                        }
                        onPress={() => handleOpenPerformanceMatch(report?.sourceType, report?.sourceDocumentId)}
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius20,
                          Spaces.padding[16],
                          Spaces.gap[10],
                          !report?.sourceDocumentId ? { opacity: 0.94 } : null,
                        ]}
                      >
                        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[8]]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                              {report?.matchLabel || 'Match'}
                            </Text>
                            <Text style={[Fonts.p4, Fonts.neutral100]}>
                              {`${Number(report?.scoreFor || 0)} - ${Number(report?.scoreAgainst || 0)}`}
                            </Text>
                          </View>
                          <View style={[Spaces.gap[8], { alignItems: 'flex-end' }]}>
                            <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[6]]}>
                              <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                                {report?.finalizedAt ? new Date(report.finalizedAt).toLocaleDateString('fr-FR') : 'Publie'}
                              </Text>
                            </View>
                            {report?.hasNewResponsesSincePublication ? (
                              <View style={[ApplicationStyle.backgroundColor.primary800, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[8]]}>
                                <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                                  {report?.newResponsesCount > 1
                                    ? `${report.newResponsesCount} nouvelles reponses`
                                    : 'Nouvelle reponse'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                          {report?.collectiveRating !== null && report?.collectiveRating !== undefined ? (
                            <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[8]]}>
                              <Text style={[Fonts.p4Bold, Fonts.primary100]}>{`Coach ${report.collectiveRating}/10`}</Text>
                            </View>
                          ) : null}
                          {report?.playerCollectiveRatingAverage !== null && report?.playerCollectiveRatingAverage !== undefined ? (
                            <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[8]]}>
                              <Text style={[Fonts.p4Bold, Fonts.primary100]}>{`Joueurs ${report.playerCollectiveRatingAverage}/10`}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {`${Number(report?.responseCompletionCount || 0)}/${Number(report?.responseEligibleCount || 0)} joueurs ont répondu`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {(() => {
                  if (isTeamPerformanceLoading) {
                    return <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>Chargement des performances...</Text>;
                  }

                  if (teamPerformancePlayers.length) {
                    return (
                      <View style={[Spaces.gap[8]]}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Joueurs</Text>
                        {teamPerformancePlayers.map((/** @type {any} */ player, /** @type {number} */ index) => (
                          <View
                            key={player?.documentId || player?.manualPlayerName || `performance-${index}`}
                            style={[
                              ApplicationStyle.backgroundColor.primary700,
                              ApplicationStyle.borderRadius20,
                              Spaces.padding[16],
                              Spaces.gap[8],
                            ]}
                          >
                            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[8]]}>
                              <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                                {player?.manualPlayerName || `${player?.firstname || ''} ${player?.lastname || ''}`.trim() || 'Joueur'}
                              </Text>
                              <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[6]]}>
                                <Text style={[Fonts.p4Bold, Fonts.primary500]}>{`${Number(player?.matches || 0)} matchs`}</Text>
                              </View>
                            </View>
                            <Text style={[Fonts.p3, Fonts.neutral100]}>
                              {performanceSummary.sport === 'basketball'
                                ? `${Number(player?.points || 0)} points - ${Number(player?.assists || 0)} passes - ${Number(player?.rebounds || 0)} rebonds`
                                : `${Number(player?.goals || 0)} buts - ${Number(player?.assists || 0)} passes - ${Number(player?.minutesPlayed || 0)} min`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  }

                  if (pendingPerformanceMatches.length) {
                    return (
                      <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>
                        Des réponses joueur existent déjà pour des matchs en attente de publication équipe.
                      </Text>
                    );
                  }

                  return (
                    <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>
                      Aucune performance de match disponible pour le moment.
                    </Text>
                  );
                })()}
              </View>
            )}
          </View>
          )}

        </WithDataWrapper>
      </ScrollView>
      {hasTeamActionsPanel ? (
        <View style={[Spaces.marginTop[12], Spaces.paddingBottom[24], Spaces.paddingHorizontal[16], Spaces.gap[12]]}>
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.paddingHorizontal[16],
              { borderColor: `${Colors.primary500}44`, borderWidth: 1, overflow: 'hidden' },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsTeamActionsPanelOpen((previousValue) => !previousValue)}
              style={[
                Spaces.paddingTop[10],
                Spaces.paddingBottom[12],
                Spaces.gap[10],
              ]}
            >
              <View style={[Alignments.alignCenter]}>
                <View
                  style={{
                    backgroundColor: `${Colors.neutral00}55`,
                    borderRadius: 999,
                    height: 4,
                    width: 48,
                  }}
                />
              </View>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                  {t('teamDetails.actions.panelTitle', "Actions d'équipe")}
                </Text>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {isTeamActionsPanelOpen
                    ? t('common.close', 'Fermer')
                    : t('teamDetails.actions.openPanel', 'Ouvrir')}
                </Text>
              </View>
            </TouchableOpacity>

            {isTeamActionsPanelOpen ? (
              <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]}>
                {showJoinAction ? (
                  <Button
                    disabled={!!pendingRequest}
                    onPress={pendingRequest ? undefined : handleJoinTeam}
                    title={joinActionTitle}
                    variant={pendingRequest ? 'Secondary' : 'Primary'}
                  />
                ) : null}

                {(showEditAction || showTeamChatAction) ? (
                  <View style={[Alignments.row, Spaces.gap[16]]}>
                    {showEditAction ? (
                      <Button
                        onPress={handleEditTeam}
                        style={Alignments.fill}
                        title={t('teamDetails.actions.edit')}
                        variant="Primary"
                      />
                    ) : null}
                    {showTeamChatAction ? (
                      <Button
                        icon="envelope"
                        iconPosition="before"
                        onPress={handleStartChat}
                        style={Alignments.fill}
                        title={t('teamDetails.actions.teamChat', 'Equipe')}
                        variant="PrimaryLight"
                      />
                    ) : null}
                  </View>
                ) : null}

                {showDefaultCompositionAction ? (
                  <Button
                    onPress={handleManageDefaultComposition}
                    title={t('teamDetails.actions.defaultComposition', 'Composition type')}
                    variant="Secondary"
                  />
                ) : null}

                {showContactTrainersAction ? (
                  <Button
                    icon="envelope"
                    iconPosition="before"
                    onPress={handleContactTeamTrainers}
                    style={[Spaces.paddingHorizontal[24], { height: 52 }]}
                    title={
                      trainerContactIds.length > 1
                        ? t('teamDetails.actions.contactTrainers', 'Contacter les entraîneurs')
                        : t('teamDetails.actions.contactTrainer', "Contacter l'entraîneur")
                    }
                    variant="Secondary"
                  />
                ) : null}

                {showLeaveAction ? (
                  <Button
                    onPress={handleAskToLeave}
                    style={{ backgroundColor: `${Colors.error500}12`, borderColor: Colors.error500 }}
                    textStyle={{ color: Colors.error500 }}
                    title={t('teamDetails.actions.leave')}
                    variant="Secondary"
                  />
                ) : null}

              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setIsTrainerPickerVisible(false)}
        transparent
        visible={isTrainerPickerVisible}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', flex: 1, justifyContent: 'flex-end' }}>
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.padding[24],
              Spaces.gap[16],
              { maxHeight: '82%' },
            ]}
          >
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('teamDetails.modals.trainers.title', 'Choisir les entraîneurs')}
            </Text>

            <Input
              autoCapitalize="none"
              autoCorrect={false}
              enterKeyHint="search"
              icon="search"
              onChangeText={setTrainerSearch}
              placeholder={t('common.actions.search', 'Rechercher')}
              value={trainerSearch}
            />

            <ScrollView
              contentContainerStyle={[Spaces.gap[8], Spaces.paddingBottom[8]]}
              style={{ maxHeight: 300 }}
            >
              {trainerPickerOptions.map((/** @type {any} */ option) => (
                <Checkable
                  customFillColor={Colors.neutral00}
                  isChecked={selectedTrainerIds.includes(option.value)}
                  key={option.value}
                  setIsChecked={() => handleToggleTrainerSelection(option.value)}
                  text={option.label}
                  type="square"
                />
              ))}
              {!trainerPickerOptions.length ? (
                <Text style={[Fonts.p2, Fonts.neutral500]}>
                  {t('teamDetails.modals.trainers.noData', 'Aucun entraîneur ou dirigeant disponible')}
                </Text>
              ) : null}
            </ScrollView>

            <View style={[Spaces.gap[12]]}>
              <Button
                onPress={handleOpenCreateTrainerModal}
                title={t('teamDetails.modals.trainers.add', 'Ajouter un entraîneur')}
                variant="SecondaryLight"
              />
              <View style={[Alignments.row, Spaces.gap[12]]}>
                <Button
                  onPress={() => setIsTrainerPickerVisible(false)}
                  style={{ flex: 1 }}
                  title={t('common.cancel', 'Annuler')}
                  variant="Secondary"
                />
                <Button
                  disabled={!selectedTrainerIds.length}
                  isLoading={saveTeamTrainersMutation.isPending}
                  onPress={handleSaveTeamTrainers}
                  style={{ flex: 1 }}
                  title={t('common.confirm', 'Valider')}
                  variant="Primary"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <CreateTrainerModal
        clubId={team?.club?.documentId}
        isVisible={isCreateTrainerModalVisible}
        onClose={() => setIsCreateTrainerModalVisible(false)}
        onTrainerCreated={handleTrainerCreated}
      />

      {/* FFBB URL Configuration Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (isExternalCompetitionFlowLocked) {
            notifyExternalCompetitionFlowLocked();
            return;
          }
          setShowFFBBUrlModal(false);
        }}
        transparent
        visible={showFFBBUrlModal}
      >
        <View style={{
          alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', flex: 1, justifyContent: 'center',
        }}
        >
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { maxWidth: 400, width: '90%' }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.configureTitle', 'Configurer le classement externe')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.configureDescription', "Collez l'URL de votre compétition FFF ou FFBB")}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isExternalCompetitionPhaseActive}
              onChangeText={setFfbbUrl}
              placeholder="https://epreuves.fff.fr/... ou https://competitions.ffbb.com/..."
              placeholderTextColor="#888"
              style={[
                Fonts.p1, Fonts.neutral00,
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius12,
                Spaces.padding[12],
                Spaces.marginBottom[16],
              ]}
              value={ffbbUrl}
            />
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                disabled={isExternalCompetitionFlowLocked}
                onPress={() => {
                  if (isExternalCompetitionFlowLocked) {
                    notifyExternalCompetitionFlowLocked();
                    return;
                  }
                  setShowFFBBUrlModal(false);
                }}
                style={{ flex: 1 }}
                title={t('common.cancel', 'Annuler')}
                variant="Secondary"
              />
              <Button
                disabled={isExternalCompetitionPhaseActive}
                isLoading={isExternalCompetitionPreviewing}
                onPress={handleSetFFBBUrl}
                style={{ flex: 1 }}
                title={t('common.confirm', 'Valider')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* FFBB Team Selection Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (isExternalCompetitionFlowLocked) {
            notifyExternalCompetitionFlowLocked();
            return;
          }
          setSelectedExternalTeam(null);
          setRecommendedExternalTeam(null);
          setExternalPreviewContext(null);
          setShowFFBBTeamModal(false);
        }}
        transparent
        visible={showFFBBTeamModal}
      >
        <View style={{
          alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', flex: 1, justifyContent: 'center',
        }}
        >
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { maxHeight: '70%', maxWidth: 400, width: '90%' }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.selectTeam', 'Sélectionnez votre équipe')}
            </Text>
            {recommendedExternalTeam ? (
              <View
                style={[
                  ApplicationStyle.borderRadius16,
                  Spaces.padding[12],
                  Spaces.marginBottom[12],
                  Spaces.gap[4],
                  {
                    backgroundColor: `${Colors.primary500}16`,
                    borderColor: `${Colors.primary500}44`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('teamDetails.external.recommendedTeam', 'Équipe recommandée')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral00]}>
                  {recommendedExternalTeam.externalTeamName}
                </Text>
                {recommendedExternalTeam.reason ? (
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {recommendedExternalTeam.reason}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {externalPreviewContext?.requestedUrl ? (
              <View style={[Spaces.gap[4], Spaces.marginBottom[12]]}>
                <Text style={[Fonts.p4, Fonts.primary100]}>
                  {t('teamDetails.external.requestedSource', 'Lien demandé')}: {externalPreviewContext.requestedUrl}
                </Text>
                {externalPreviewContext?.sourceUrl
                && externalPreviewContext.sourceUrl !== externalPreviewContext.requestedUrl ? (
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {t('teamDetails.external.resolvedSource', 'Source résolue')}: {externalPreviewContext.sourceUrl}
                  </Text>
                  ) : null}
                {externalPreviewContext?.sourceResolution ? (
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {t('teamDetails.external.resolutionMode', 'Mode de résolution')}: {formatExternalSourceResolutionLabel(externalPreviewContext.sourceResolution)}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <FlatList
              contentContainerStyle={[Spaces.gap[8], Spaces.paddingBottom[4]]}
              data={ffbbTeamsList}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item, index) => item.externalTeamId || item.externalTeamName || String(index)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  disabled={isExternalCompetitionFlowLocked}
                  onPress={() => setSelectedExternalTeam(item)}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.padding[12],
                    ApplicationStyle.borderRadius12,
                    {
                      backgroundColor: selectedExternalTeam?.externalTeamId === item.externalTeamId
                        && selectedExternalTeam?.externalTeamName === item.externalTeamName
                        ? `${Colors.primary500}18`
                        : 'transparent',
                      borderColor: selectedExternalTeam?.externalTeamId === item.externalTeamId
                        && selectedExternalTeam?.externalTeamName === item.externalTeamName
                        ? `${Colors.primary500}88`
                        : `${Colors.primary500}33`,
                      borderWidth: 1,
                    },
                    isExternalCompetitionFlowLocked ? { opacity: 0.72 } : null,
                  ]}
                >
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{item.externalTeamName}</Text>
                  {recommendedExternalTeam
                  && (
                    (recommendedExternalTeam.externalTeamId && recommendedExternalTeam.externalTeamId === item.externalTeamId)
                    || recommendedExternalTeam.externalTeamName === item.externalTeamName
                  ) ? (
                    <View
                      style={[
                        ApplicationStyle.borderRadius24,
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[6],
                        {
                          backgroundColor: `${Colors.warning500}18`,
                          borderColor: `${Colors.warning500}44`,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>
                        {t('teamDetails.external.recommendedBadge', 'Recommandée')}
                      </Text>
                    </View>
                    ) : null}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={[Spaces.marginBottom[16], { maxHeight: 320 }]}
            />
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                disabled={isExternalCompetitionFlowLocked}
                onPress={() => {
                  if (isExternalCompetitionFlowLocked) {
                    notifyExternalCompetitionFlowLocked();
                    return;
                  }
                  setSelectedExternalTeam(null);
                  setRecommendedExternalTeam(null);
                  setExternalPreviewContext(null);
                  setShowFFBBTeamModal(false);
                }}
                style={{ flex: 1 }}
                title={t('common.cancel', 'Annuler')}
                variant="Secondary"
              />
              <Button
                disabled={!selectedExternalTeam || isExternalCompetitionPhaseActive}
                isLoading={isExternalCompetitionConnecting}
                onPress={() => {
                  handleConfirmSelectedExternalTeam().catch((caughtError) => {
                    Alert.alert(t('common.error'), getErrorMessage(caughtError));
                  });
                }}
                style={{ flex: 1 }}
                title={t('common.confirm', 'Valider')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={notifyExternalCompetitionFlowLocked}
        transparent
        visible={showExternalCompetitionLoadingOverlay}
      >
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(0, 18, 24, 0.78)',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              Spaces.padding[24],
              Spaces.gap[16],
              {
                borderColor: `${Colors.primary500}44`,
                borderWidth: 1,
                maxWidth: 360,
                width: '84%',
              },
            ]}
          >
            <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  ApplicationStyle.backgroundColor.primary900,
                  ApplicationStyle.borderRadius24,
                  {
                    borderColor: `${Colors.primary500}40`,
                    borderWidth: 1,
                    height: 64,
                    width: 64,
                  },
                ]}
              >
                <Loader color={Colors.primary500} size="large" />
              </View>
              <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
                {externalCompetitionLoadingMeta.title}
              </Text>
              <Text style={[Fonts.p2, Fonts.primary100, Fonts.textCenter]}>
                {externalCompetitionLoadingMeta.description}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowExternalSyncReportModal(false)}
        transparent
        visible={showExternalSyncReportModal}
      >
        <View style={{
          alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', flex: 1, justifyContent: 'center',
        }}
        >
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { maxHeight: '82%', maxWidth: 440, width: '92%' }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>
              {t('teamDetails.external.report.title', 'Classement et calendrier synchronisés')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100, Spaces.marginBottom[16]]}>
              {[
                externalSyncProviderLabel,
                externalSyncSelectedTeamName,
                externalSyncPouleName,
              ].filter(Boolean).join(' - ')}
            </Text>

            <ScrollView contentContainerStyle={[Spaces.gap[16]]} showsVerticalScrollIndicator={false}>
              <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
                {[
                  {
                    key: 'created',
                    label: t('teamDetails.external.summary.created', 'Créés'),
                    value: externalSyncSummary?.created || 0,
                  },
                  {
                    key: 'updated',
                    label: t('teamDetails.external.summary.updated', 'Mis à jour'),
                    value: externalSyncSummary?.updated || 0,
                  },
                  {
                    key: 'archivedFuture',
                    label: t('teamDetails.external.summary.archived', 'Archives'),
                    value: externalSyncSummary?.archivedFuture || 0,
                  },
                  {
                    key: 'unchanged',
                    label: t('teamDetails.external.summary.unchanged', 'Inchangés'),
                    value: externalSyncSummary?.unchanged || 0,
                  },
                  {
                    key: 'venueEnriched',
                    label: t('teamDetails.external.summary.venueEnriched', 'Lieux enrichis'),
                    value: externalSyncSummary?.venueEnriched || 0,
                  },
                  {
                    key: 'venueFallbackUsed',
                    label: t('teamDetails.external.summary.venueFallbackUsed', 'Lieu à confirmer'),
                    value: externalSyncSummary?.venueFallbackUsed || 0,
                  },
                  {
                    key: 'venueDetailFetchFailed',
                    label: t('teamDetails.external.summary.venueDetailFetchFailed', 'Details lieu KO'),
                    value: externalSyncSummary?.venueDetailFetchFailed || 0,
                  },
                ].map((stat) => (
                  <View
                    key={stat.key}
                    style={[
                      ApplicationStyle.borderRadius16,
                      Spaces.paddingVertical[8],
                      Spaces.paddingHorizontal[12],
                      {
                        backgroundColor: `${Colors.primary500}14`,
                        borderColor: `${Colors.primary500}33`,
                        borderWidth: 1,
                        minWidth: 96,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4, Fonts.primary100]}>{stat.label}</Text>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{stat.value}</Text>
                  </View>
                ))}
              </View>

              {externalSyncUpdatedLabel ? (
                <Text style={[Fonts.p3, Fonts.primary100]}>
                  {t('teamDetails.external.lastSync', 'Dernière synchronisation')}: {externalSyncUpdatedLabel}
                </Text>
              ) : null}
              {externalSyncReport?.mode ? (
                <Text style={[Fonts.p3, Fonts.primary100]}>
                  {t('teamDetails.external.lastMode', 'Origine')}: {externalSyncModeMeta.label}
                </Text>
              ) : null}

              {externalSyncReport?.warnings?.length ? (
                <View
                  style={[
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[12],
                    Spaces.gap[4],
                    {
                      backgroundColor: `${Colors.warning500}18`,
                      borderColor: `${Colors.warning500}44`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                    {t('teamDetails.external.warningsTitle', 'Avertissements')}
                  </Text>
                  {externalSyncReport.warnings.map((/** @type {any} */ warning, /** @type {number} */ index) => (
                    <Text key={`${warning}-${index}`} style={[Fonts.p4, Fonts.neutral00]}>
                      {`- ${warning}`}
                    </Text>
                  ))}
                </View>
              ) : null}

              {externalSyncReport?.errors?.length ? (
                <View
                  style={[
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[12],
                    Spaces.gap[4],
                    {
                      backgroundColor: `${Colors.error500}18`,
                      borderColor: `${Colors.error500}44`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                    {t('teamDetails.external.errorsTitle', 'Erreurs')}
                  </Text>
                  {externalSyncReport.errors.map((/** @type {any} */ entry, /** @type {number} */ index) => (
                    <Text key={`${entry}-${index}`} style={[Fonts.p4, Fonts.neutral00]}>
                      {`- ${entry}`}
                    </Text>
                  ))}
                </View>
              ) : null}

              {renderExternalSyncItems(
                t('teamDetails.external.report.createdSection', 'Événements créés'),
                externalSyncReport?.createdEvents,
                Colors.success500,
              )}
              {renderExternalSyncItems(
                t('teamDetails.external.report.scoreUpdatedSection', 'Scores importes'),
                externalSyncReport?.scoreUpdatedEvents,
                Colors.primary100,
              )}
              {renderExternalSyncItems(
                t('teamDetails.external.report.updatedSection', 'Événements mis à jour'),
                externalSyncReport?.updatedEvents,
                Colors.primary500,
              )}
              {renderExternalSyncItems(
                t('teamDetails.external.report.archivedSection', 'Événements archivés'),
                externalSyncReport?.archivedFutureEvents,
                Colors.warning500,
              )}
              {renderExternalSyncItems(
                t('teamDetails.external.report.skippedSection', 'Matchs ignorés'),
                externalSyncReport?.skippedMatches,
                Colors.error500,
              )}
            </ScrollView>

            <View style={[Spaces.marginTop[16], Spaces.gap[8]]}>
              <Button
                onPress={() => setShowExternalSyncReportModal(false)}
                title={t('common.close', 'Fermer')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* FFBB Error Report Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (isExternalCompetitionReporting) {
            notifyExternalCompetitionFlowLocked();
            return;
          }
          setShowFFBBErrorModal(false);
        }}
        transparent
        visible={showFFBBErrorModal}
      >
        <View style={{
          alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', flex: 1, justifyContent: 'center',
        }}
        >
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], { maxWidth: 400, width: '90%' }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00, Spaces.marginBottom[16]]}>
              {t('teamDetails.ffbb.reportTitle', 'Signaler un probleme')}
            </Text>

            {/* Problem Type Selector */}
            <Text style={[Fonts.p2Bold, Fonts.primary100, Spaces.marginBottom[8]]}>
              {t('teamDetails.ffbb.problemType', 'Type de probleme')}
            </Text>
            <View style={[Spaces.marginBottom[16], Spaces.gap[8]]}>
              {[
                { key: 'wrong_data', label: t('teamDetails.ffbb.problems.wrongData', 'Donnees incorrectes') },
                { key: 'missing_team', label: t('teamDetails.ffbb.problems.missingTeam', 'Equipe manquante') },
                { key: 'outdated', label: t('teamDetails.ffbb.problems.outdated', 'Donnees obsoletes') },
                { key: 'wrong_url', label: t('teamDetails.ffbb.problems.wrongUrl', 'Mauvaise URL') },
                { key: 'other', label: t('teamDetails.ffbb.problems.other', 'Autre') },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setFfbbErrorType(option.key)}
                  style={[
                    Alignments.row, Alignments.alignCenter, Spaces.gap[8],
                    Spaces.padding[12], ApplicationStyle.borderRadius12,
                    { borderColor: ffbbErrorType === option.key ? Colors.primary500 : '#FFFFFF33', borderWidth: 1 },
                    ffbbErrorType === option.key && { backgroundColor: `${Colors.primary500}22` },
                  ]}
                >
                  <View style={{
                    backgroundColor: ffbbErrorType === option.key ? Colors.primary500 : 'transparent',
                    borderColor: ffbbErrorType === option.key ? Colors.primary500 : '#FFFFFF66',
                    borderRadius: 10,
                    borderWidth: 2,
                    height: 20,
                    width: 20,
                  }}
                  />
                  <Text style={[Fonts.p2, ffbbErrorType === option.key ? Fonts.primary500 : Fonts.neutral00]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={[Fonts.p2Bold, Fonts.primary100, Spaces.marginBottom[8]]}>
              {t('teamDetails.ffbb.description', 'Description (optionnel)')}
            </Text>
            <TextInput
              multiline
              numberOfLines={3}
              onChangeText={setFfbbErrorDescription}
              placeholder={t('teamDetails.ffbb.descriptionPlaceholder', 'Decrivez le probleme...')}
              placeholderTextColor="#888"
              style={[
                Fonts.p2, Fonts.neutral00,
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius12,
                Spaces.padding[12],
                Spaces.marginBottom[16],
                {
                  borderColor: '#FFFFFF33', borderWidth: 1, minHeight: 80, textAlignVertical: 'top',
                },
              ]}
              value={ffbbErrorDescription}
            />

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                disabled={isExternalCompetitionPhaseActive}
                onPress={() => setShowFFBBErrorModal(false)}
                style={{ flex: 1 }}
                title={t('common.cancel', 'Annuler')}
                variant="Secondary"
              />
              <Button
                disabled={isExternalCompetitionPhaseActive}
                isLoading={isExternalCompetitionReporting}
                onPress={handleReportError}
                style={{ flex: 1 }}
                title={t('common.send', 'Envoyer')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default TeamDetails;
