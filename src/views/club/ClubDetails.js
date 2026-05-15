// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import Loader from '@/components/atoms/loader/Loader';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { leaveClub, removeTrainerFromClub } from '@/services/auth/authService';
import { getCategorySortKey } from '@/services/category/categoryService';
import { useGetClub } from '@/services/club/clubQueries';
import { claimClub, updateClub } from '@/services/club/clubService';
import { createClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { createClubRequest, getPendingClubCreationRequests } from '@/services/clubRequest/clubRequestService';
import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { getFacilitySections } from '@/services/facility/facilityService';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import { getImageUrl } from '@/utils/imageUrl';
import safeJsonParse from '@/utils/safeJsonParse';

import ClubPlanning from './ClubPlanningScreen';

const getFacilityAddressLabel = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    return String(address?.description || address?.label || '').trim();
  }
  return '';
};

const getFacilityCapacityChipLabel = (maxSlots, t) => {
  const teams = Number(maxSlots || 1);
  const unit = teams > 1
    ? t('facilityList.capacity.teamPlural', 'équipes simultanées')
    : t('facilityList.capacity.teamSingular', 'équipe simultanée');
  return `${teams} ${unit}`;
};

const getFacilityCoordinates = (address) => {
  if (!address || typeof address !== 'object') return null;
  const coordinates = address?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const getTeamMetaValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value?.name || value?.label || '').trim();
  }
  return '';
};

const getTeamMetaSummary = (team) => (
  [
    getTeamMetaValue(team?.section),
    getTeamMetaValue(team?.category),
    getTeamMetaValue(team?.level),
  ]
    .filter(Boolean)
    .join(' | ')
);

const getTeamIdentity = (team) => String(team?.documentId || team?.id || '').trim();

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
};

const buildDefaultClubPartnerForm = () => ({
  holderEmail: '',
  holderFirstname: '',
  holderLastname: '',
  holderPhone: '',
});

const compareTeamsByAgeCategoryDesc = (teamA, teamB) => {
  const categoryA = getTeamMetaValue(teamA?.category);
  const categoryB = getTeamMetaValue(teamB?.category);
  const keyA = getCategorySortKey(categoryA);
  const keyB = getCategorySortKey(categoryB);

  const getAgePriority = (key) => {
    if (key.group === 2) return 400;
    if (key.group === 1) return 300;
    if (key.group === 0) return key.rank;
    return -1;
  };

  const agePriorityDiff = getAgePriority(keyB) - getAgePriority(keyA);
  if (agePriorityDiff !== 0) return agePriorityDiff;

  const nameA = String(teamA?.name || '').trim();
  const nameB = String(teamB?.name || '').trim();
  return nameA.localeCompare(nameB, 'fr', { numeric: true, sensitivity: 'base' });
};

/**
 * Club details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club details screen component
 */
function ClubDetails({ navigation, route }) {
  const { clubId, fromOnboardingAffiliation = false } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const {
    canContactAdmin,
    canEditClub,
    canJoinClub,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    inviteTrainer,
    refetchUserData,
    USER_ROLES,
    userData,
  } = useAuth();
  const { startClubChat } = useMessaging();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const isAuthenticated = Boolean(userData?.documentId);
  const [selectedTab, setSelectedTab] = useState('infos');
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [isAddActivityModalVisible, setIsAddActivityModalVisible] = useState(false);
  const [clubPartnerRequestPending, setClubPartnerRequestPending] = useState(false);
  const [clubPartnerForm, setClubPartnerForm] = useState(() => buildDefaultClubPartnerForm(userData));
  const [isClubPartnerRequestVisible, setIsClubPartnerRequestVisible] = useState(false);
  const [isPlayerTeamPickerVisible, setIsPlayerTeamPickerVisible] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activitiesToAdd, setActivitiesToAdd] = useState(
    /** @type {string[]} */
    ([]),
  );
  const [planningSelection, setPlanningSelection] = useState({
    facilityId: null,
    nonce: 0,
    scope: 'club',
  });

  const handleGoToNextOnboardingStep = useCallback(() => {
    if (!fromOnboardingAffiliation) return;

    const parentNavigation = navigation.getParent?.();
    const onboardingNavigation = parentNavigation || navigation;
    const nextRoute = getNextOnboardingRoute(RouteNames.UserAffiliationGuide);
    if (nextRoute) {
      onboardingNavigation.navigate(nextRoute);
      return;
    }

    markOnboardingComplete(userData?.documentId);
    onboardingNavigation.reset({
      index: 0,
      routes: [{ name: getPostOnboardingHomeRoute() }],
    });
  }, [
    fromOnboardingAffiliation,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    navigation,
    userData?.documentId,
  ]);

  const openClubAuthFlow = useCallback((source, extraParams = {}) => {
    openPublicAuthFlow(navigation, {
      clubId,
      origin: RouteNames.Club,
      source,
      ...extraParams,
    });
  }, [clubId, navigation]);

  const {
    data: club,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useGetClub(clubId ?? '');
  const {
    data: facilityContext,
    isLoading: facilitiesLoading,
    refetch: refetchFacilities,
  } = useClubFacilityContext({ clubId: clubId ?? '', cmId: club?.parentMultisport?.documentId || null });
  const {
    data: allActivities,
    isLoading: activitiesLoading,
  } = useGetActivities();

  const sortedClubTeams = useMemo(
    () => [...(club?.teams || [])].sort(compareTeamsByAgeCategoryDesc),
    [club?.teams],
  );
  const clubHasNoTeams = sortedClubTeams.length === 0;

  const deleteTrainerMutation = useMutation({
    mutationFn: removeTrainerFromClub,
    onSuccess: () => {
      refetch();
    },
  });

  const leaveClubMutation = useMutation({
    mutationFn: leaveClub,
    onError: (mutationError) => {
      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('clubDetails.alerts.leave.error', 'Impossible de quitter ce club pour le moment.');

      Alert.alert(t('common.error', 'Erreur'), errorMessage);
    },
    onSuccess: () => {
      refetchUserData();
      refetch();
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: updateClub,
    onSuccess: () => {
      refetch();
    },
  });

  const hasPendingClubRequest = useMemo(() => (
    (userData?.clubMembershipRequests || [])
      .some((r) => (r.club?.documentId === clubId || r.club?.id === clubId) && r.state === 'pending')
  ), [userData?.clubMembershipRequests, clubId]);

  const createClubMembershipRequestMutation = useMutation({
    mutationFn: createClubMembershipRequest,
    onError: () => {
      setJoinRequestPending(false);
    },
    onSuccess: () => {
      setJoinRequestPending(true);
      if (fromOnboardingAffiliation) {
        refetch();
        refetchUserData();
        handleGoToNextOnboardingStep();
        return;
      }

      Alert.alert(
        t('clubDetails.alerts.joinClub.title'),
        t('clubDetails.alerts.joinClub.description'),
        [
          {
            onPress: () => {
              refetch();
              refetchUserData();
              handleGoToNextOnboardingStep();
            },
            text: t('clubDetails.alerts.joinClub.actions.ok'),
          },
        ],
      );
    },
  });

  const createTeamMembershipRequestMutation = useMutation({
    mutationFn: ({ teamId, userId }) => createTeamMembershipRequest({
      team: teamId,
      user: userId,
    }),
    onError: (mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        mutationError?.message
          || t(
            'clubDetails.alerts.playerTeamJoin.error',
            "Impossible d'envoyer votre demande pour le moment.",
          ),
      );
    },
    onSuccess: (_result, variables) => {
      const selectedTeamName = sortedClubTeams
        .find((teamItem) => getTeamIdentity(teamItem) === variables?.teamId)?.name
        || t('common.team', 'Equipe');

      refetchUserData();
      refetch();
      setIsPlayerTeamPickerVisible(false);

      Alert.alert(
        t('teamDetails.alerts.joinRequest.title', 'Demande envoyee'),
        t(
          'clubDetails.alerts.playerTeamJoin.description',
          'Votre demande pour rejoindre {{teamName}} a ete envoyee.',
          { teamName: selectedTeamName },
        ),
        [{
          onPress: () => {
            if (fromOnboardingAffiliation) {
              handleGoToNextOnboardingStep();
            }
          },
          text: t('teamDetails.alerts.joinRequest.actions.ok', 'OK'),
        }],
      );
    },
  });

  const createClubRequestMutation = useMutation({
    mutationFn: createClubRequest,
    onError: (mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        mutationError?.message
          || t(
            'clubDetails.alerts.clubPartnerRequest.error',
            "Impossible d'envoyer cette demande pour le moment.",
          ),
      );
    },
    onSuccess: () => {
      setClubPartnerRequestPending(true);
      setIsClubPartnerRequestVisible(false);
      setClubPartnerForm(buildDefaultClubPartnerForm(userData));
      refetchPendingClubCreationRequests();

      Alert.alert(
        t('clubDetails.alerts.clubPartnerRequest.title', 'Demande envoyee'),
        t(
          'clubDetails.alerts.clubPartnerRequest.description',
          "Nous allons contacter le dirigeant de ce club pour l'aider a rejoindre FoundClub.",
        ),
        [{
          onPress: () => {
            if (fromOnboardingAffiliation) {
              handleGoToNextOnboardingStep();
            }
          },
          text: t('common.actions.ok', 'OK'),
        }],
      );
    },
  });

  const claimClubMutation = useMutation({
    mutationFn: claimClub,
    onError: (err) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        err.message || t('clubDetails.alerts.claimClub.error', 'Une erreur est survenue.'),
        [{ text: 'OK' }],
      );
    },
    onSuccess: () => {
      if (fromOnboardingAffiliation) {
        refetch();
        refetchUserData();
        handleGoToNextOnboardingStep();
        return;
      }

      Alert.alert(
        t('clubDetails.alerts.claimClub.title', 'Demande envoyée'),
        t('clubDetails.alerts.claimClub.description', 'Votre demande pour revendiquer ce club a été envoyée aux administrateurs.'),
        [
          {
            onPress: () => {
              refetch();
              refetchUserData();
              handleGoToNextOnboardingStep();
            },
            text: t('common.ok', 'OK'),
          },
        ],
      );
    },
  });

  const handleClaimClub = () => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-claim-login');
      return;
    }

    Alert.alert(
      t('clubDetails.alerts.claimClub.confirmTitle', "C'est votre club ?"),
      t('clubDetails.alerts.claimClub.confirmDescription', 'Voulez-vous revendiquer la gestion de ce club ? Une vérification sera effectuée.'),
      [
        {
          style: 'cancel',
          text: t('common.cancel', 'Annuler'),
        },
        {
          onPress: () => {
            if (clubId) {
              claimClubMutation.mutate(clubId);
            }
          },
          text: t('common.confirm', 'Confirmer'),
        },
      ],
    );
  };

  const coachs = useMemo(
    () => (club?.members || []).filter(
      (user) => user?.role?.name === USER_ROLES.coach,
    ),
    [club, USER_ROLES.coach],
  );

  const owners = useMemo(
    () => (club?.members || []).filter(
      (user) => user?.role?.name === USER_ROLES.president,
    ),
    [club, USER_ROLES.president],
  );
  const areClubMembersHidden = club?.membersAreHidden === true;
  const clubMembersCount = Number(club?.membersCount || club?.members?.length || 0);

  const canEdit = useMemo(() => canEditClub(clubId), [clubId, canEditClub]);
  const facilities = useMemo(
    () => (Array.isArray(facilityContext?.allFacilities) ? facilityContext.allFacilities : []),
    [facilityContext?.allFacilities],
  );
  const facilitySections = useMemo(() => getFacilitySections(facilities, {
    clubTitle: t('facilityList.sections.club', 'Installations du club'),
    sharedTitle: t('facilityList.sections.shared', 'Installations partagées'),
  }), [facilities, t]);
  const resolvedFacilityCmId = facilityContext?.cmId || club?.parentMultisport?.documentId || null;

  // handlers
  const handleStartChat = async () => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-chat-login');
      return;
    }

    if (club?.documentId) {
      const newChat = await startClubChat(club?.documentId);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    }
  };

  const handleCreateCoach = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddCoach, { clubId, clubName: club?.name });
    }
  };

  const handleCreateSponsor = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddSponsor, { clubId });
    }
  };

  const handleEditClub = useCallback(() => {
    try {
      navigation.navigate(RouteNames.ClubEdit, { clubId });
    } catch (e) {
      navigation.getParent()?.navigate(RouteNames.ClubEdit, { clubId });
    }
  }, [clubId, navigation]);

  const handleOpenFacilityMap = useCallback((facility) => {
    const addressLabel = getFacilityAddressLabel(facility?.address) || facility?.name || '';
    if (!addressLabel) return;

    const coordinates = getFacilityCoordinates(facility?.address);
    const encodedAddress = encodeURIComponent(addressLabel);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const nativeUrl = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${coordinates.lat},${coordinates.lng}(${encodedAddress})`,
        default: fallbackUrl,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encodedAddress}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encodedAddress}`,
        default: fallbackUrl,
        ios: `maps:0,0?q=${encodedAddress}`,
      });

    if (!nativeUrl) {
      Linking.openURL(fallbackUrl).catch(() => {});
      return;
    }

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(fallbackUrl);
      })
      .catch(() => {
        Linking.openURL(fallbackUrl).catch(() => {});
      });
  }, []);

  const handleOpenFacilityPlanning = useCallback((facility, scope = 'club') => {
    const facilityId = facility?.documentId || facility?.id || null;
    if (!facilityId) return;

    setPlanningSelection({
      facilityId,
      nonce: Date.now(),
      scope,
    });
    setSelectedTab('planning');
  }, []);

  /**
   * Handle delete sponsor action
   * @param {Sponsor} sponsor
   */
  const handleDeleteSponsor = (sponsor) => {
    Alert.alert(
      t('clubDetails.alerts.deleteSponsor.title', { sponsorName: sponsor.title }),
      t('clubDetails.alerts.deleteSponsor.description'),
      [
        {
          style: 'cancel',
          text: t('clubDetails.alerts.deleteSponsor.actions.cancel'),
        },
        {
          onPress: () => {
            if (club) {
              const newClub = {
                ...club,
                sponsor: (club?.sponsor || []).filter((s) => s.link !== sponsor.link),
              };
              updateClubMutation.mutate(newClub);
            }
          },
          text: t('clubDetails.alerts.deleteSponsor.actions.confirm'),
        },
      ],
    );
  };

  /**
   * Handle delete activity action
   * @param {Activity} activity
   */
  const handleDeleteActivity = (activity) => {
    if (!club) return;

    const activityName = activity?.name || t('clubDetails.titles.activities');
    const removedActivityId = activity?.documentId || activity?.id || activity?.name;
    if (!removedActivityId) return;

    Alert.alert(
      `Supprimer le sport ${activityName} ?`,
      'Êtes-vous sûr de vouloir continuer ?',
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel', 'Annuler'),
        },
        {
          onPress: () => {
            const remainingActivities = (club?.activites || []).filter((item) => {
              const id = item?.documentId || item?.id || item?.name;
              return id !== removedActivityId;
            });

            const newClub = {
              ...club,
              activites: remainingActivities
                .map((item) => item?.documentId || item?.id)
                .filter(Boolean),
            };

            updateClubMutation.mutate(newClub);
          },
          text: t('common.actions.delete', 'Supprimer'),
        },
      ],
    );
  };

  /**
   * Handle delete trainer action
   * @param {string | undefined} trainerId
   */
  const handleDeleteTrainer = (trainerId) => {
    if (trainerId) {
      Alert.alert(
        t('clubDetails.alerts.deleteTrainer.title'),
        t('clubDetails.alerts.deleteTrainer.description'),
        [
          {
            style: 'cancel',
            text: t('clubDetails.alerts.deleteTrainer.actions.cancel'),
          },
          {
            onPress: () => {
              deleteTrainerMutation.mutate(trainerId);
            },
            text: t('clubDetails.alerts.deleteTrainer.actions.confirm'),
          },
        ],
      );
    }
  };

  const handleLeaveClub = useCallback(() => {
    leaveClubMutation.mutate();
  }, [leaveClubMutation]);

  const handleAskToLeaveClub = useCallback(() => {
    Alert.alert(
      t('clubDetails.alerts.leave.title', 'Quitter le club ?'),
      t(
        'clubDetails.alerts.leave.description',
        'Vous ne serez plus lie a ce club ni a ses equipes en tant qu encadrant. Etes-vous sur de vouloir continuer ?',
      ),
      [
        {
          style: 'cancel',
          text: t('clubDetails.alerts.leave.actions.cancel', 'Annuler'),
        },
        {
          onPress: handleLeaveClub,
          style: 'destructive',
          text: t('clubDetails.alerts.leave.actions.confirm', 'Quitter le club'),
        },
      ],
    );
  }, [handleLeaveClub, t]);

  const handleAskToJoinClub = () => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-join-login');
      return;
    }

    if (hasPendingClubRequest || joinRequestPending || createClubMembershipRequestMutation.isPending) {
      return;
    }
    if (canJoinClub && clubId && userData?.documentId) {
      createClubMembershipRequestMutation.mutate({
        club: clubId,
      });
    }
  };

  /**
   * Handle user press action
   * @param {User} user
   */
  const handleUserPress = (user) => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-user-profile-login', { userId: user?.documentId });
      return;
    }

    if (user?.documentId) {
      if (user?.documentId === userData?.documentId) {
        navigation.navigate(RouteNames.ProfileStack);
      } else {
        navigation.navigate(RouteNames.ProfileStack, {
          params: { userId: user.documentId },
          screen: RouteNames.UserDetails,
        });
      }
    }
  };

  /**
   * Handle team press action
   * @param {Team} team
   */
  const handleTeamPress = (team) => {
    if (team?.documentId) {
      navigateToStackScreenOrScreen(navigation, {
        params: { teamId: team.documentId },
        screen: RouteNames.TeamDetails,
        stack: RouteNames.TeamStack,
      });
    }
  };

  const isMember = useMemo(() => {
    if (!userData) return false;
    const roleName = String(userData.role?.name || '').toLowerCase();
    const roleType = String(userData.role?.type || '').toLowerCase();
    if (roleName === 'superadmin' || roleType === 'superadmin' || roleType === 'admin') return true;

    // Check direct club membership
    const userClubId = userData.club?.documentId || userData.club?.id;
    if (userClubId === clubId) return true;

    // Check team membership
    return userData.teams?.some((team) => {
      const teamClubId = team.club?.documentId || team.club?.id;
      return teamClubId === clubId;
    });
  }, [userData, clubId]);

  const isPlayerRole = userData?.role?.name === USER_ROLES.player;
  const isCoachRole = userData?.role?.name === USER_ROLES.coach;
  const canUseClubPartneringFlow = useMemo(() => (
    Boolean(club)
    && Boolean(clubId)
    && !isMember
    && clubHasNoTeams
    && (isPlayerRole || isCoachRole)
  ), [club, clubHasNoTeams, clubId, isCoachRole, isMember, isPlayerRole]);

  const {
    data: pendingClubCreationRequestsResponse,
    refetch: refetchPendingClubCreationRequests,
  } = useQuery({
    enabled: canUseClubPartneringFlow && !!userData?.documentId,
    queryFn: () => getPendingClubCreationRequests(userData?.documentId),
    queryKey: ['clubRequests', 'pending', 'clubCreation', userData?.documentId],
  });

  const hasPendingClubCreationRequest = useMemo(() => {
    const currentClubId = String(clubId || '').trim();
    const currentClubName = normalizeComparableValue(club?.name);

    return (pendingClubCreationRequestsResponse?.data || []).some((requestItem) => {
      const requestClubId = String(requestItem?.searchContext?.clubId || '').trim();
      const requestClubName = normalizeComparableValue(requestItem?.clubName);
      const matchesClubById = Boolean(currentClubId && requestClubId && currentClubId === requestClubId);
      const matchesClubByName = Boolean(currentClubName && requestClubName === currentClubName);
      return matchesClubById || matchesClubByName;
    });
  }, [club?.name, clubId, pendingClubCreationRequestsResponse?.data]);

  const hasPendingClubPartneringRequest = hasPendingClubCreationRequest || clubPartnerRequestPending;

  useFocusEffect(
    useCallback(() => {
      setClubPartnerRequestPending(false);
      setJoinRequestPending(false);
      refetch();
      refetchFacilities();
      if (canUseClubPartneringFlow) {
        refetchPendingClubCreationRequests();
      }
    }, [canUseClubPartneringFlow, refetch, refetchFacilities, refetchPendingClubCreationRequests]),
  );

  const clubTeamIds = useMemo(
    () => sortedClubTeams
      .map((teamItem) => getTeamIdentity(teamItem))
      .filter(Boolean),
    [sortedClubTeams],
  );

  const clubTeamIdsSet = useMemo(() => new Set(clubTeamIds), [clubTeamIds]);

  const pendingClubTeamRequestIds = useMemo(() => {
    const pendingIds = new Set();

    (userData?.teamMembershipRequests || []).forEach((request) => {
      const requestTeamId = getTeamIdentity(request?.team);
      if (request?.state === 'pending' && requestTeamId && clubTeamIdsSet.has(requestTeamId)) {
        pendingIds.add(requestTeamId);
      }
    });

    return pendingIds;
  }, [clubTeamIdsSet, userData?.teamMembershipRequests]);

  const hasPendingClubTeamRequest = useCallback((teamDocumentId) => (
    pendingClubTeamRequestIds.has(String(teamDocumentId || '').trim())
  ), [pendingClubTeamRequestIds]);

  const hasPendingViewedClubTeamRequest = useMemo(
    () => pendingClubTeamRequestIds.size > 0,
    [pendingClubTeamRequestIds],
  );

  const playerViewedClubTeamIds = useMemo(() => {
    const teamIds = new Set();

    (userData?.myTeams || []).forEach((teamItem) => {
      const teamId = getTeamIdentity(teamItem);
      const teamClubId = teamItem?.club?.documentId || teamItem?.club?.id;
      if ((teamClubId && teamClubId === clubId) || clubTeamIdsSet.has(teamId)) {
        teamIds.add(teamId);
      }
    });

    return teamIds;
  }, [clubId, clubTeamIdsSet, userData?.myTeams]);

  const isPlayerAlreadyInSelectedTeam = useCallback((teamDocumentId) => (
    playerViewedClubTeamIds.has(String(teamDocumentId || '').trim())
  ), [playerViewedClubTeamIds]);

  const isPlayerAlreadyInViewedClub = useMemo(() => (
    playerViewedClubTeamIds.size > 0
  ), [playerViewedClubTeamIds]);

  const canPlayerSignalClubTeam = useMemo(() => (
    userData?.role?.name === USER_ROLES.player
    && !isMember
    && !isPlayerAlreadyInViewedClub
    && clubTeamIds.length > 0
  ), [USER_ROLES.player, clubTeamIds.length, isMember, isPlayerAlreadyInViewedClub, userData?.role?.name]);

  const isParentClubAdmin = useMemo(() => {
    // Check if user is admin of the parent multisport club
    if (!userData?.club || !club?.parentMultisport) return false;

    // Normalize IDs (support objects and IDs)
    const userClubId = userData.club.documentId || userData.club.id;
    const parentId = club.parentMultisport.documentId || club.parentMultisport.id;

    // Check if IDs match
    return userClubId === parentId;
  }, [userData, club]);

  const isPresidentOfViewedClub = useMemo(() => (
    userData?.role?.name === USER_ROLES.president
    && (userData?.club?.documentId || userData?.club?.id) === clubId
  ), [USER_ROLES.president, clubId, userData]);

  const isCoachOfViewedClub = useMemo(() => (
    (userData?.trainedTeams || []).some((team) => (team?.club?.documentId || team?.club?.id) === clubId)
  ), [clubId, userData?.trainedTeams]);

  const canLeaveClub = useMemo(() => {
    const currentClubId = userData?.club?.documentId || userData?.club?.id;
    const currentRole = userData?.role?.name;

    return Boolean(currentClubId && clubId && currentClubId === clubId)
      && (currentRole === USER_ROLES.coach || currentRole === USER_ROLES.president);
  }, [USER_ROLES.coach, USER_ROLES.president, clubId, userData?.club, userData?.role?.name]);

  const isMultisportAdmin = useMemo(() => (
    (userData?.multisportClubs || []).some((multisportClub) => multisportClub?.documentId === resolvedFacilityCmId)
  ), [resolvedFacilityCmId, userData?.multisportClubs]);

  const canAccessSharedPlanning = useMemo(() => (
    Boolean(resolvedFacilityCmId)
    && (isParentClubAdmin || isPresidentOfViewedClub || isCoachOfViewedClub || isMultisportAdmin)
  ), [
    isCoachOfViewedClub,
    isMultisportAdmin,
    isParentClubAdmin,
    isPresidentOfViewedClub,
    resolvedFacilityCmId,
  ]);

  const tabs = useMemo(() => {
    const options = [{ label: 'Informations', value: 'infos' }];
    if (isMember) {
      options.push({ label: 'Planning', value: 'planning' });
    }
    return options;
  }, [isMember]);

  // Reset tab if access lost
  if (selectedTab === 'planning' && !isMember) {
    setSelectedTab('infos');
  }

  const isActivityEditMode = canEdit && isEditingActivities;

  const existingActivityIds = useMemo(
    () => (club?.activites || [])
      .map((activity) => activity?.documentId || activity?.id)
      .filter(Boolean),
    [club?.activites],
  );

  const addableActivities = useMemo(() => {
    const search = activitySearch.trim().toLowerCase();
    const existingIds = new Set(existingActivityIds.map(String));

    return (allActivities || []).filter((activity) => {
      const activityId = activity?.documentId || activity?.id;
      const activityName = String(activity?.name || '').trim();
      if (!activityId || !activityName) return false;
      if (existingIds.has(String(activityId))) return false;
      if (!search) return true;
      return activityName.toLowerCase().includes(search);
    });
  }, [activitySearch, allActivities, existingActivityIds]);

  const handleOpenAddActivityModal = useCallback(() => {
    setActivitiesToAdd([]);
    setActivitySearch('');
    setIsAddActivityModalVisible(true);
  }, []);

  const handleCloseAddActivityModal = useCallback(() => {
    setIsAddActivityModalVisible(false);
    setActivitiesToAdd([]);
    setActivitySearch('');
  }, []);

  const handleOpenClubPartnerRequest = useCallback(() => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-partner-request-login');
      return;
    }

    if (hasPendingClubPartneringRequest || createClubRequestMutation.isPending) {
      return;
    }
    setClubPartnerForm(buildDefaultClubPartnerForm(userData));
    setIsClubPartnerRequestVisible(true);
  }, [createClubRequestMutation.isPending, hasPendingClubPartneringRequest, isAuthenticated, openClubAuthFlow, userData]);

  const handleCloseClubPartnerRequest = useCallback(() => {
    if (createClubRequestMutation.isPending) return;
    setIsClubPartnerRequestVisible(false);
    setClubPartnerForm(buildDefaultClubPartnerForm(userData));
  }, [createClubRequestMutation.isPending, userData]);

  const handleChangeClubPartnerField = useCallback((field, value) => {
    setClubPartnerForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }, []);

  const handleSubmitClubPartnerRequest = useCallback(() => {
    const holderFirstname = String(clubPartnerForm?.holderFirstname || '').trim();
    const holderLastname = String(clubPartnerForm?.holderLastname || '').trim();
    const holderPhone = String(clubPartnerForm?.holderPhone || '').trim();
    const holderEmail = String(clubPartnerForm?.holderEmail || '').trim().toLowerCase();

    if (!holderFirstname || !holderLastname) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubDetails.alerts.clubPartnerRequest.missingName',
          'Ajoutez le prenom et le nom du dirigeant.',
        ),
      );
      return;
    }

    if (!holderPhone && !holderEmail) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubDetails.alerts.clubPartnerRequest.missingContact',
          'Ajoutez au moins un numero de telephone ou un email.',
        ),
      );
      return;
    }

    if (!isValidEmail(holderEmail)) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubDetails.alerts.clubPartnerRequest.invalidEmail',
          "L'adresse email du dirigeant est invalide.",
        ),
      );
      return;
    }

    createClubRequestMutation.mutate({
      clubName: club?.name,
      holderEmail,
      holderFirstname,
      holderLastname,
      holderPhone,
      requestKind: 'club_creation',
      searchContext: {
        clubId,
        role: userData?.role?.name || 'unknown',
        screen: RouteNames.Club,
        target: 'club_partnering',
      },
      source: 'manual',
    });
  }, [
    club?.name,
    clubId,
    clubPartnerForm,
    createClubRequestMutation,
    t,
    userData?.role?.name,
  ]);

  const handleOpenPlayerTeamPicker = useCallback(() => {
    if (!clubTeamIds.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('clubDetails.alerts.playerTeamJoin.noTeams', 'Aucune équipe n’est disponible dans ce club pour le moment.'),
      );
      return;
    }

    setIsPlayerTeamPickerVisible(true);
  }, [clubTeamIds.length, t]);

  const handleClosePlayerTeamPicker = useCallback(() => {
    setIsPlayerTeamPickerVisible(false);
  }, []);

  const handleSelectPlayerClubTeam = useCallback((teamItem) => {
    const teamDocumentId = getTeamIdentity(teamItem);
    const userId = userData?.documentId;
    if (!teamDocumentId || !userId) return;
    if (isPlayerAlreadyInSelectedTeam(teamDocumentId)) return;
    if (hasPendingClubTeamRequest(teamDocumentId)) return;

    Alert.alert(
      t('clubDetails.alerts.playerTeamJoin.title', 'Choisir cette equipe ?'),
      t(
        'clubDetails.alerts.playerTeamJoin.confirmation',
        'Une demande sera envoyee pour rejoindre {{teamName}}.',
        { teamName: teamItem?.name || t('common.team', 'Equipe') },
      ),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel', 'Annuler'),
        },
        {
          onPress: () => {
            createTeamMembershipRequestMutation.mutate({
              teamId: teamDocumentId,
              userId,
            });
          },
          text: t('common.actions.confirm', 'Confirmer'),
        },
      ],
    );
  }, [
    createTeamMembershipRequestMutation,
    hasPendingClubTeamRequest,
    isPlayerAlreadyInSelectedTeam,
    t,
    userData?.documentId,
  ]);

  const handleToggleActivityToAdd = useCallback((activityId) => {
    const normalizedId = String(activityId || '').trim();
    if (!normalizedId) return;

    setActivitiesToAdd((current) => {
      if (current.includes(normalizedId)) {
        return current.filter((id) => id !== normalizedId);
      }
      return [...current, normalizedId];
    });
  }, []);

  const handleConfirmAddActivities = useCallback(() => {
    if (!club || activitiesToAdd.length === 0) {
      handleCloseAddActivityModal();
      return;
    }

    const nextActivityIds = existingActivityIds.map(String);
    activitiesToAdd.map(String).forEach((activityId) => {
      if (!nextActivityIds.includes(activityId)) {
        nextActivityIds.push(activityId);
      }
    });

    const newClub = {
      ...club,
      activites: nextActivityIds,
    };

    updateClubMutation.mutate(newClub, {
      onSuccess: () => {
        handleCloseAddActivityModal();
      },
    });
  }, [
    activitiesToAdd,
    club,
    existingActivityIds,
    handleCloseAddActivityModal,
    updateClubMutation,
  ]);

  const activitiesHeaderActions = (() => {
    if (!canEdit) return null;

    if (isActivityEditMode) {
      return (
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Button
            icon="plus"
            isOption
            onPress={handleOpenAddActivityModal}
            variant="Primary"
          />
          <Button
            onPress={() => setIsEditingActivities(false)}
            size="small"
            title={t('common.finish', 'Terminer')}
            variant="Secondary"
          />
        </View>
      );
    }

    return (
      <Button
        onPress={() => setIsEditingActivities(true)}
        size="small"
        title={t('clubDetails.actions.editInfo', 'Modifier')}
        variant="Secondary"
      />
    );
  })();

  const activitiesContent = (() => {
    if (isActivityEditMode) {
      if (club?.activites?.length) {
        return (
          <View style={[Spaces.gap[12]]}>
            {club.activites.map((activity) => (
              <View
                key={activity?.documentId || activity?.id || activity?.name}
                style={[
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.backgroundColor.primary700,
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.padding[16],
                  Spaces.gap[12],
                ]}
              >
                <Text style={[Fonts.p1, Fonts.neutral00, { flex: 1 }]}>
                  {activity?.name}
                </Text>
                <Button
                  icon="trash"
                  isOption
                  onPress={() => handleDeleteActivity(activity)}
                  variant="SecondaryLight"
                />
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {t('common.messages.noData', 'Aucune donnée disponible')}
        </Text>
      );
    }

    return (
      <Text numberOfLines={3} style={[Fonts.p1, Fonts.neutral00]}>
        {club?.activites?.length
          ? club.activites.map(({ name }) => name).join(', ')
          : t('common.messages.noData', 'Aucune donnée disponible')}
      </Text>
    );
  })();

  const addActivitiesModalFooter = (
    <View style={[Spaces.paddingBottom[16]]}>
      <Button
        disabled={activitiesToAdd.length === 0 || updateClubMutation.isPending}
        isLoading={updateClubMutation.isPending}
        onPress={handleConfirmAddActivities}
        title="Ajouter"
        variant="Primary"
      />
    </View>
  );

  const isMissingClubId = !clubId;
  const isInitialClubLoading = isLoading && !club;
  const isRefreshing = isFetching && !isLoading;
  const isClubLoadingError = Boolean(error) && !club;
  const isClubNotFound = Boolean(clubId) && !isLoading && !error && !club;

  if (isInitialClubLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.justifyCenter,
          Alignments.fill,
        ]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Loader />
          <Text style={[Fonts.p2, Fonts.primary100]}>
            Chargement du club...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isClubLoadingError) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.justifyCenter,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            Impossible de charger le club
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {error?.message || 'Reessayez dans quelques instants.'}
          </Text>
          <Button onPress={() => refetch()} title="Réessayer" variant="Primary" />
          <Button onPress={() => navigation.navigate(RouteNames.ClubList)} title="Retour aux clubs" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  if (isMissingClubId || isClubNotFound) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.justifyCenter,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {isMissingClubId ? 'Club introuvable' : 'Ce club est introuvable'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {isMissingClubId
              ? 'Aucun identifiant de club n a ete fourni.'
              : 'Le lien est peut-etre obsolete ou le club a ete supprime.'}
          </Text>
          <Button onPress={() => navigation.navigate(RouteNames.ClubList)} title="Retour aux clubs" variant="Secondary" />
          {!isMissingClubId ? (
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
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isRefreshing}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          wrapperStyle={[Spaces.gap[32]]}
        >
          <View style={[
            ApplicationStyle.borderRadius24,
            ApplicationStyle.backgroundColor.primary700,
            Alignments.alignCenter,
            Spaces.gap[16],
            Spaces.paddingHorizontal[24],
            Spaces.paddingBottom[40],
            Spaces.marginTop[64],
            { overflow: 'visible' },
          ]}
          >
            {canEdit ? (
              <TouchableOpacity
                onPress={handleEditClub}
                style={[
                  Alignments.absolute,
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.gap[8],
                  { right: 16, top: 16, zIndex: 10 },
                ]}
              >
                <Image
                  source={Images.edit}
                  style={[
                    ApplicationStyle.icon20,
                    ApplicationStyle.tintColor.primary500,
                  ]}
                />
                <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                  {t('clubDetails.actions.editInfo') || 'Modifier'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ marginTop: -24, zIndex: 1 }}>
              {club?.logo?.url ? (
                <ProfileAvatar
                  imageUrl={club.logo.url}
                  shape="rounded"
                  size={80}
                  style={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    ApplicationStyle.backgroundColor.neutral00,
                    { borderRadius: 20 },
                  ]}
                  variant="logo"
                />
              ) : (
                <TeamShield
                  initials={club?.name ? getClubInitials(club?.name) : ''}
                />
              )}
            </View>
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter]}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                {club?.name}
              </Text>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {(() => {
                  const parsedAddress = safeJsonParse(club?.addressDetails, null);
                  return parsedAddress?.address || club?.addressDetails || '';
                })()}
              </Text>
            </View>
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter,
              Spaces.paddingHorizontal[24]]}
            >
              {club?.phoneNumber ? (
                <View style={[Alignments.row, Spaces.gap[4]]}>
                  <Image source={Images.phone} style={[ApplicationStyle.icon20]} />
                  <TouchableOpacity onPress={() => { Linking.openURL(`tel:${club?.phoneNumber}`); }}>
                    <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                      {club?.phoneNumber}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {club?.email ? (
                <View style={[
                  Alignments.row, Spaces.gap[4]]}
                >
                  <Image source={Images.envelope} style={[ApplicationStyle.icon20]} />
                  <TouchableOpacity onPress={() => { Linking.openURL(`mailto:${club?.email}`); }}>
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}
                    >
                      {club?.email}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          {/* Tabs */}
          <View style={[Alignments.alignCenter]}>
            <SegmentedControl
              onChange={setSelectedTab}
              options={tabs}
              value={selectedTab}
            />
          </View>

          {selectedTab === 'planning' ? (
            <ClubPlanning
              allowSharedPlanning={canAccessSharedPlanning}
              clubId={clubId}
              cmId={resolvedFacilityCmId}
              initialFacilityId={planningSelection.facilityId}
              initialScope={planningSelection.scope}
              initialSelectionKey={planningSelection.nonce}
            />
          ) : (
            <>
              {/* Facilities */}
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}>
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('facilityList.title', 'Installations')}
                  </Text>
                  {canEdit ? (
                    <Button
                      icon="plus"
                      isOption
                      onPress={() => navigation.navigate(RouteNames.FacilityList, {
                        clubId,
                        cmId: resolvedFacilityCmId,
                      })}
                      variant="Primary"
                    />
                  ) : null}
                </View>

                {facilitiesLoading ? (
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {t('common.loading', 'Chargement...')}
                  </Text>
                ) : null}

                {!facilitiesLoading && facilities.length === 0 ? (
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {t('common.messages.noData', 'Aucune donnée disponible')}
                  </Text>
                ) : null}

                {facilitySections.map((section) => (
                  <View key={section.title} style={[Spaces.gap[12]]}>
                    {facilitySections.length > 1 ? (
                      <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                        {section.title}
                      </Text>
                    ) : null}
                    {section.data.map((/** @type {any} */ facility) => {
                      const facilityId = facility?.documentId || facility?.id;
                      const capacityChipLabel = getFacilityCapacityChipLabel(facility?.maxSlots, t);
                      const typeLabel = facility?.type || t('facilityList.defaults.unknownType', 'Type inconnu');
                      const addressLabel = getFacilityAddressLabel(facility?.address);
                      const planningColor = resolveFacilityPlanningColor(facility);
                      const canOpenFacilityEdit = Boolean(canEdit && facilityId && !facility?.isShared);
                      const canOpenPlanning = Boolean(
                        facilityId
                        && (facility?.isShared ? canAccessSharedPlanning : isMember),
                      );
                      const handleOpenFacilityEdit = () => {
                        navigation.navigate(RouteNames.FacilityForm, {
                          clubId,
                          cmId: resolvedFacilityCmId,
                          facility,
                        });
                      };
                      const handleOpenPlanning = () => {
                        handleOpenFacilityPlanning(facility, facility?.isShared ? 'shared' : 'club');
                      };

                      return (
                        <TouchableOpacity
                          accessibilityLabel={canOpenFacilityEdit ? t(
                            'facilityList.accessibility.editCard',
                            `Modifier l'installation ${facility?.name || ''}`.trim(),
                          ) : undefined}
                          accessibilityRole={canOpenFacilityEdit ? 'button' : undefined}
                          activeOpacity={canOpenFacilityEdit ? 0.9 : 1}
                          disabled={!canOpenFacilityEdit}
                          key={String(facilityId || facility?.name)}
                          onPress={canOpenFacilityEdit ? handleOpenFacilityEdit : undefined}
                          style={[
                            ApplicationStyle.borderRadius24,
                            { paddingHorizontal: 18, paddingVertical: 18 },
                            Spaces.gap[12],
                            {
                              backgroundColor: `${planningColor}22`,
                              borderColor: planningColor,
                              borderWidth: 1,
                              overflow: 'hidden',
                              position: 'relative',
                            },
                          ]}
                        >
                          <View
                            style={{
                              backgroundColor: planningColor,
                              borderBottomRightRadius: 8,
                              borderTopRightRadius: 8,
                              height: '100%',
                              left: 0,
                              position: 'absolute',
                              top: 0,
                              width: 4,
                            }}
                          />
                          <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                            {facility?.name || 'Installation'}
                          </Text>
                          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                            <View
                              style={[
                                ApplicationStyle.borderRadius12,
                                Spaces.paddingHorizontal[8],
                                Spaces.paddingVertical[4],
                                {
                                  alignSelf: 'flex-start',
                                  backgroundColor: `${planningColor}1F`,
                                  borderColor: planningColor,
                                  borderWidth: 1,
                                },
                              ]}
                            >
                              <Text style={[Fonts.p3Bold, { color: planningColor }]}>
                                {capacityChipLabel}
                              </Text>
                            </View>
                            <View
                              style={[
                                ApplicationStyle.borderRadius12,
                                Spaces.paddingHorizontal[8],
                                Spaces.paddingVertical[4],
                                {
                                  alignSelf: 'flex-start',
                                  backgroundColor: Colors.neutral800,
                                  borderColor: Colors.neutral500,
                                  borderWidth: 1,
                                },
                              ]}
                            >
                              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                                {typeLabel}
                              </Text>
                            </View>
                            {facility?.isShared ? (
                              <>
                                <View
                                  style={[
                                    ApplicationStyle.borderRadius12,
                                    Spaces.paddingHorizontal[8],
                                    Spaces.paddingVertical[4],
                                    {
                                      alignSelf: 'flex-start',
                                      backgroundColor: `${Colors.primary500}1F`,
                                      borderColor: Colors.primary500,
                                      borderWidth: 1,
                                    },
                                  ]}
                                >
                                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                                    {t('facilityList.badges.shared', 'Partagee')}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    ApplicationStyle.borderRadius12,
                                    Spaces.paddingHorizontal[8],
                                    Spaces.paddingVertical[4],
                                    {
                                      alignSelf: 'flex-start',
                                      backgroundColor: `${Colors.warning500}1F`,
                                      borderColor: Colors.warning500,
                                      borderWidth: 1,
                                    },
                                  ]}
                                >
                                  <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                                    {t('facilityList.badges.multisport', 'Multisport')}
                                  </Text>
                                </View>
                              </>
                            ) : null}
                          </View>
                          {facility?.isShared ? (
                            <Text style={[Fonts.p3, Fonts.neutral300]}>
                              {t(
                                'facilityList.sharedOwnerHint',
                                'Installation partagée du multisport {{ownerName}}. Lecture seule cété club.',
                                { ownerName: facility?.ownerName || t('facilityList.badges.multisport', 'Multisport') },
                              )}
                            </Text>
                          ) : null}
                          {addressLabel ? (
                            <View
                              style={[
                                ApplicationStyle.borderRadius16,
                                Spaces.padding[12],
                                Spaces.gap[8],
                                {
                                  backgroundColor: `${Colors.primary900}BB`,
                                  borderColor: `${Colors.primary500}2E`,
                                  borderWidth: 1,
                                },
                              ]}
                            >
                              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                                <Image
                                  source={Images.pin}
                                  style={[
                                    ApplicationStyle.icon16,
                                    ApplicationStyle.tintColor.primary200,
                                    { marginTop: 1 },
                                  ]}
                                />
                                <Text numberOfLines={2} style={[Fonts.p2, Fonts.primary100, { flex: 1 }]}>
                                  {addressLabel}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <Text style={[Fonts.p2, Fonts.neutral300]}>
                              {t('facilityList.defaults.addressMissing', 'Adresse non renseignee')}
                            </Text>
                          )}
                          {(addressLabel || canOpenPlanning || canOpenFacilityEdit) ? (
                            <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, Spaces.gap[8], { marginTop: 2 }]}>
                              {addressLabel ? (
                                <Button
                                  onPress={() => handleOpenFacilityMap(facility)}
                                  size="small"
                                  title={t('common.actions.openInGps', 'Ouvrir dans le GPS')}
                                  variant="Secondary"
                                />
                              ) : null}
                              {canOpenPlanning ? (
                                <Button
                                  onPress={handleOpenPlanning}
                                  size="small"
                                  title={t('facilityList.actions.viewPlanning', 'Voir planning')}
                                  variant={facility?.isShared ? 'Primary' : 'Secondary'}
                                />
                              ) : null}
                              {canOpenFacilityEdit ? (
                                <View style={{ marginLeft: 'auto' }}>
                                  <Button
                                    icon="edit"
                                    onPress={handleOpenFacilityEdit}
                                    size="small"
                                    title={t('common.edit', 'Modifier')}
                                    variant="Secondary"
                                  />
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Activities */}
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}>
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.activities')}</Text>
                  {activitiesHeaderActions}
                </View>
                {activitiesContent}
              </View>
              {/* Sponsors */}
              {(club?.sponsor?.length || canEdit) && (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.sponsors')}</Text>
                    {canEdit ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleCreateSponsor}
                        variant="Primary"
                      />
                    ) : null}
                  </View>
                  <ScrollView
                    contentContainerStyle={[Spaces.gap[16]]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {club?.sponsor?.map((/** @type {Sponsor} */ sponsor) => (
                      <View
                        key={sponsor.link}
                        style={[Alignments.relative, Spaces.marginTop[8]]}
                      >
                        {
                          canEdit ? (
                            <TouchableOpacity
                              onPress={() => handleDeleteSponsor(sponsor)}
                              style={[
                                Alignments.absolute,
                                ApplicationStyle.backgroundColor.error700,
                                ApplicationStyle.borderRadius24,
                                Spaces.padding[8],
                                { right: -12, top: -8, zIndex: 1 },
                              ]}
                            >
                              <Image
                                source={Images.trash}
                                style={[
                                  ApplicationStyle.icon16,
                                  ApplicationStyle.tintColor.neutral00]}
                              />
                            </TouchableOpacity>
                          ) : null
                        }
                        <SponsorLogoTile
                          height={55}
                          imageUrl={sponsor?.logo?.url}
                          link={sponsor.link}
                          title={sponsor.title}
                          titleStyle={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 4, textAlign: 'center' }]}
                          width={110}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* teams */}
              {sortedClubTeams.length ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.teams')}</Text>
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      sortedClubTeams.map((/** @type {Team} */ team) => (
                        <TouchableOpacity
                          key={team.documentId}
                          onPress={() => handleTeamPress(team)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.alignCenter,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[8],
                            Spaces.gap[16]]}
                        >
                          <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter]}>
                            <TeamShield
                              initials={team?.name ? getClubInitials(team?.name) : ''}
                              isNeutral
                              isSmall
                            />
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                                {team.name}
                              </Text>
                              {getTeamMetaSummary(team) ? (
                                <Text
                                  numberOfLines={1}
                                  style={[Fonts.p3, Fonts.neutral300, { marginTop: 4 }]}
                                >
                                  {getTeamMetaSummary(team)}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}

              {areClubMembersHidden ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}>
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                      {t('clubDetails.titles.members', 'Membres')}
                    </Text>
                  </View>
                  <View
                    style={[
                      ApplicationStyle.borderRadius24,
                      ApplicationStyle.backgroundColor.primary700,
                      Spaces.padding[16],
                      Spaces.gap[8],
                    ]}
                  >
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {t('clubDetails.membersHidden.title', 'Membres masqués par le club')}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubDetails.membersHidden.description',
                        '{{count}} membres sont rattachés à ce club, mais leurs identités ne sont pas visibles publiquement.',
                        { count: clubMembersCount },
                      )}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Coachs */}
              {coachs?.length || canEdit ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.coachs')}</Text>
                    {canEdit ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleCreateCoach}
                        variant="Primary"
                      />
                    ) : null}
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      coachs?.map((/** @type {User} */ user) => (
                        <TouchableOpacity
                          key={user.documentId}
                          onPress={() => handleUserPress(user)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.fill,
                            Alignments.alignCenter,
                            Alignments.fill,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[16],
                            Spaces.gap[24],
                          ]}
                        >
                          <View style={[
                            Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                          >
                            <Image
                              source={user.avatar ? { uri: getImageUrl(user?.avatar?.url) } : Images.roundAvatar}
                              style={[
                                ApplicationStyle.roundIcon40,
                              ]}
                            />
                            <Text
                              numberOfLines={2}
                              style={[Fonts.p1Bold, Fonts.neutral00]}
                            >
                              {`${user.firstname} ${user.lastname}`}
                            </Text>
                          </View>
                          {canEdit ? (
                            <View style={[Alignments.row, Spaces.gap[8]]}>
                              <Button
                                icon="trash"
                                isOption
                                onPress={() => handleDeleteTrainer(user.documentId)}
                                variant="SecondaryLight"
                              />
                              <Button
                                icon="share"
                                isOption
                                onPress={() => {
                                  inviteTrainer({
                                    clubId: club?.documentId,
                                    clubName: club?.name,
                                    firstname: user.firstname,
                                    phoneNumber: user.phoneNumber,
                                  });
                                }}
                                variant="SecondaryLight"
                              />
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}
              {/* president */}
              {owners?.length ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.owners')}</Text>
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      owners?.map((/** @type {User} */ user) => (
                        <TouchableOpacity
                          key={user.documentId}
                          onPress={() => handleUserPress(user)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.alignCenter,
                            Alignments.fill,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[16],
                            Spaces.gap[16]]}
                        >
                          <View style={[
                            Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                          >
                            <Image
                              source={user.avatar ? { uri: getImageUrl(user?.avatar?.url) } : Images.roundAvatar}
                              style={[
                                ApplicationStyle.roundIcon40,
                              ]}
                            />
                            <Text
                              numberOfLines={2}
                              style={[Fonts.p1Bold, Fonts.neutral00]}
                            >
                              {`${user.firstname} ${user.lastname}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}
            </>
          )}
        </WithDataWrapper>
      </ScrollView>
      {
        !isAuthenticated ? (
          <Button
            onPress={() => openClubAuthFlow('club-public-claim-login')}
            style={[Spaces.marginTop[12], Spaces.marginBottom[24]]}
            title={t('clubDetails.actions.claimClub', "C'est mon club")}
            variant="Primary"
          />
        ) : null
      }
      {
        canJoinClub && !isParentClubAdmin && !canUseClubPartneringFlow ? (
          <Button
            disabled={hasPendingClubRequest || joinRequestPending || createClubMembershipRequestMutation.isPending}
            onPress={handleAskToJoinClub}
            style={[
              Spaces.marginTop[12],
              (hasPendingClubRequest || joinRequestPending || createClubMembershipRequestMutation.isPending)
                ? { opacity: 0.7 }
                : null,
            ]}
            title={
              (hasPendingClubRequest || joinRequestPending)
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t('clubDetails.actions.requestJoin', 'Demander à rejoindre ce club')
            }
            variant="Primary"
          />
        ) : null
      }
      {
        canContactAdmin && !club?.parentMultisport && (owners?.length > 0 || areClubMembersHidden) && !canUseClubPartneringFlow ? (
          <Button
            disabled={hasPendingClubRequest}
            onPress={handleClaimClub}
            style={[Spaces.marginTop[12], hasPendingClubRequest ? { opacity: 0.6 } : null]}
            title={
              hasPendingClubRequest
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t('clubDetails.actions.join')
            }
            variant="Primary"
          />
        ) : null
      }
      {
        canUseClubPartneringFlow ? (
          <Button
            disabled={hasPendingClubPartneringRequest || createClubRequestMutation.isPending}
            onPress={handleOpenClubPartnerRequest}
            style={[
              Spaces.marginTop[12],
              Spaces.marginBottom[24],
              (hasPendingClubPartneringRequest || createClubRequestMutation.isPending)
                ? { opacity: 0.7 }
                : null,
            ]}
            title={hasPendingClubPartneringRequest
              ? t('clubDetails.actions.requestPending', 'Demande en attente')
              : t('clubDetails.actions.claimClub', "C'est mon club")}
            variant="Primary"
          />
        ) : null
      }
      {
        coachs?.length && canEdit ? (
          <Button
            onPress={handleStartChat}
            style={Spaces.marginBottom[24]}
            title={t('clubDetails.actions.contactTrainers')}
            variant="Primary"
          />
        ) : null
      }
      {
        canLeaveClub ? (
          <Button
            disabled={leaveClubMutation.isPending}
            onPress={handleAskToLeaveClub}
            style={[
              Spaces.marginTop[12],
              Spaces.marginBottom[24],
              { backgroundColor: `${Colors.error500}12`, borderColor: Colors.error500 },
            ]}
            textStyle={{ color: Colors.error500 }}
            title={t('clubDetails.actions.leave', 'Quitter le club')}
            variant="Secondary"
          />
        ) : null
      }
      <BottomModal
        close={handleCloseAddActivityModal}
        footerComponent={addActivitiesModalFooter}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={1} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t('clubDetails.titles.activities')}
            </Text>
          </View>
        )}
        hideCloseButton
        isVisible={isAddActivityModalVisible}
        scrollable
        snapPoints={['86%']}
      >
        <View style={[Spaces.gap[16]]}>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            enterKeyHint="search"
            icon="search"
            inputMode="search"
            onChangeText={setActivitySearch}
            placeholder={t('modals.actions.search', 'Rechercher...')}
            value={activitySearch}
          />

          <View style={[Spaces.gap[12], Spaces.paddingBottom[8]]}>
            {activitiesLoading ? (
              <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral500]}>
                {t('common.messages.loading', 'Chargement...')}
              </Text>
            ) : null}

            {!activitiesLoading && addableActivities.map((activity) => {
              const activityId = String(activity?.documentId || activity?.id || '');
              const isChecked = activitiesToAdd.includes(activityId);

              return (
                <View key={`option-${activityId}`} style={[Alignments.row, Spaces.marginTop[8]]}>
                  <Checkable
                    customFillColor={Colors.neutral00}
                    disableBounceAnimation
                    isChecked={isChecked}
                    setIsChecked={() => handleToggleActivityToAdd(activityId)}
                    text={activity?.name || ''}
                    type="square"
                  />
                </View>
              );
            })}

            {!activitiesLoading && addableActivities.length === 0 ? (
              <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral500]}>
                {t('common.messages.noData', 'Aucune donnée disponible')}
              </Text>
            ) : null}
          </View>
        </View>
      </BottomModal>
      <BottomModal
        close={handleCloseClubPartnerRequest}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={2} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t('clubDetails.clubPartnerRequest.title', "C'est mon club")}
            </Text>
          </View>
        )}
        hideCloseButton
        isVisible={isClubPartnerRequestVisible}
        scrollable
        snapPoints={['88%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'clubDetails.clubPartnerRequest.description',
              "Votre club n'est pas encore partenaire FoundClub. Ajoutez les coordonnees du dirigeant pour que nous puissions le contacter et lui donner acces au classement, au calendrier et aux statistiques directement dans l'application.",
            )}
          </Text>

          <View
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[16],
              Spaces.gap[8],
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('clubDetails.clubPartnerRequest.clubLabel', 'Club concerne')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {club?.name || t('common.club', 'Club')}
            </Text>
          </View>

          <Input
            label={t('clubDetails.clubPartnerRequest.fields.holderFirstname', 'Prenom du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderFirstname', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderFirstname', 'Prenom du dirigeant')}
            value={clubPartnerForm.holderFirstname}
          />
          <Input
            label={t('clubDetails.clubPartnerRequest.fields.holderLastname', 'Nom du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderLastname', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderLastname', 'Nom du dirigeant')}
            value={clubPartnerForm.holderLastname}
          />
          <Input
            inputMode="tel"
            keyboardType="phone-pad"
            label={t('clubDetails.clubPartnerRequest.fields.holderPhone', 'Telephone du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderPhone', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderPhone', 'Telephone du dirigeant')}
            value={clubPartnerForm.holderPhone}
          />
          <Input
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            keyboardType="email-address"
            label={t('clubDetails.clubPartnerRequest.fields.holderEmail', 'Email du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderEmail', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderEmail', 'Email du dirigeant')}
            value={clubPartnerForm.holderEmail}
          />

          <Button
            isLoading={createClubRequestMutation.isPending}
            onPress={handleSubmitClubPartnerRequest}
            title={t('clubDetails.clubPartnerRequest.submit', 'Envoyer la demande')}
            variant="Primary"
          />
        </View>
      </BottomModal>
      <BottomModal
        close={handleClosePlayerTeamPicker}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={1} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t('clubDetails.playerTeamPicker.title', 'Choisir mon équipe')}
            </Text>
          </View>
        )}
        hideCloseButton
        isVisible={isPlayerTeamPickerVisible}
        scrollable
        snapPoints={['82%']}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'clubDetails.playerTeamPicker.description',
              'Sélectionne ton équipe dans ce club pour envoyer une demande d’affiliation.',
            )}
          </Text>

          <View style={[Spaces.gap[12], Spaces.paddingBottom[8]]}>
            {sortedClubTeams.map((teamItem) => {
              const teamDocumentId = getTeamIdentity(teamItem);
              const isPending = hasPendingClubTeamRequest(teamDocumentId);
              const isCurrentTeam = isPlayerAlreadyInSelectedTeam(teamDocumentId);
              const isDisabled = isPending
                || isCurrentTeam
                || createTeamMembershipRequestMutation.isPending;
              let actionLabel = t('clubDetails.playerTeamPicker.selectAction', 'Choisir');
              if (isPending) {
                actionLabel = t('clubDetails.actions.requestPending', 'Demande en attente');
              }
              if (isCurrentTeam) {
                actionLabel = t('clubDetails.actions.myTeam', 'Mon equipe');
              }

              return (
                <TouchableOpacity
                  disabled={isDisabled}
                  key={teamDocumentId || teamItem?.name}
                  onPress={() => handleSelectPlayerClubTeam(teamItem)}
                  style={[
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.backgroundColor.primary700,
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.padding[16],
                    {
                      opacity: isDisabled ? 0.65 : 1,
                    },
                  ]}
                >
                  <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                    <TeamShield
                      initials={getClubInitials(teamItem?.name || '')}
                      isSmall
                    />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {teamItem?.name || t('common.team', 'Equipe')}
                      </Text>
                      <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
                        {getTeamMetaSummary(teamItem) || teamItem?.club?.name || t('common.messages.noData', 'Aucune donnee disponible')}
                      </Text>
                    </View>
                  </View>

                  <Button
                    disabled={isDisabled}
                    onPress={() => handleSelectPlayerClubTeam(teamItem)}
                    size="small"
                    title={actionLabel}
                    variant={isDisabled ? 'Secondary' : 'Primary'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomModal>
      {
        canPlayerSignalClubTeam ? (
          <Button
            disabled={hasPendingViewedClubTeamRequest || createTeamMembershipRequestMutation.isPending}
            onPress={handleOpenPlayerTeamPicker}
            style={[
              Spaces.marginTop[12],
              Spaces.marginBottom[24],
              (hasPendingViewedClubTeamRequest || createTeamMembershipRequestMutation.isPending)
                ? { opacity: 0.7 }
                : null,
            ]}
            title={hasPendingViewedClubTeamRequest
              ? t('clubDetails.actions.requestPending', 'Demande en attente')
              : t('clubDetails.actions.claimClub', "C'est mon club")}
            variant="Primary"
          />
        ) : null
      }
      {
        /* Claim Club Button - Show if not member, not admin, and club has no owners */
        (
          !isMember
          && !canEdit
          && !canJoinClub
          && !canUseClubPartneringFlow
          && !areClubMembersHidden
          && owners?.length === 0
          && userData
          && userData?.role?.name !== USER_ROLES.player
        ) ? (
            (() => {
              if (hasPendingClubRequest) {
                return (
                  <Button
                    disabled
                    style={[Spaces.marginTop[12], Spaces.marginBottom[24], { opacity: 0.6 }]}
                    title={t('clubDetails.actions.requestPending', 'Demande en attente')}
                    variant="Secondary"
                  />
                );
              }

              return (
                <Button
                  onPress={handleClaimClub}
                  style={[Spaces.marginTop[12], Spaces.marginBottom[24]]}
                  title={t('clubDetails.actions.claimClub', "C'est mon club")}
                  variant="Secondary"
                />
              );
            })()
          ) : null
      }
    </ScreenContainer>
  );
}

export default ClubDetails;
