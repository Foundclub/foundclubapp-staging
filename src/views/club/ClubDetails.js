// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import Loader from '@/components/atoms/loader/Loader';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ClubSelector from '@/components/molecules/clubSelector/ClubSelector';
import ClubScopeToggle from '@/components/molecules/header/ClubScopeToggle';
import Input from '@/components/molecules/input/Input';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import {
  leaveClub,
  removeManagerFromClub,
  removeTrainerFromClub,
  switchManagedClub,
} from '@/services/auth/authService';
import { getCategorySortKey } from '@/services/category/categoryService';
import { useGetClub } from '@/services/club/clubQueries';
import { claimClub, updateClub } from '@/services/club/clubService';
import { useGetMyClubInterestRequests } from '@/services/clubInterestRequest/clubInterestRequestQueries';
import { createClubInterestRequest } from '@/services/clubInterestRequest/clubInterestRequestService';
import { createClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { createClubRequest, getPendingClubCreationRequests } from '@/services/clubRequest/clubRequestService';
import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { getFacilitySections } from '@/services/facility/facilityService';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import {
  getClubCertificationLabel,
  getClubCertificationPalette,
  isPartnerClub,
} from '@/utils/clubCertification';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import safeJsonParse from '@/utils/safeJsonParse';
import { buildPublicWebUrl } from '@/utils/shareLinks';

import { resolveClubDetailsActionMatrix } from './clubDetailsActionMatrix';
import ClubPlanning from './ClubPlanningScreen';
import { ClubHubGroup, ClubHubRow } from './components/ClubHubRow';

// D34 ecran 07 : la rangee partenaire du pack fait 56 pt de haut — assez pour
// un logo rond de 38 et une corbeille de 40 sans les serrer.
const SPONSOR_ROW_HEIGHT = 56;

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

// D34 ecran 11 : le pack reprochait a cet ecran d'afficher « Masculine · Senior »
// partout. La MESURE dit le contraire : la meta est composee de la section, de
// la categorie et du niveau REELS de chaque equipe, et ce depuis le 2026-03-17
// (f95c04e). Le seul ecart avec le pack etait le separateur — une barre au lieu
// du point median. C'est lui qui change ici, rien d'autre.
const getTeamMetaSummary = (team) => (
  [
    getTeamMetaValue(team?.section),
    getTeamMetaValue(team?.category),
    getTeamMetaValue(team?.level),
  ]
    .filter(Boolean)
    .join(' · ')
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
  const { fromOnboardingAffiliation = false } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const {
    activeClubId,
    canContactAdmin,
    canEditClub,
    canJoinClub,
    clubs,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    hasClubAccess,
    inviteTrainer,
    refetchUserData,
    USER_ROLES,
    userData,
  } = useAuth();
  const routeClubId = route?.params?.clubId;
  const clubId = routeClubId || activeClubId || clubs?.[0]?.documentId || clubs?.[0]?.id || null;
  const { startClubChat } = useMessaging();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = Boolean(userData?.documentId);
  const [selectedTab, setSelectedTab] = useState(
    route?.params?.planningFacilityId ? 'planning' : 'infos',
  );
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [isAddActivityModalVisible, setIsAddActivityModalVisible] = useState(false);
  const [clubPartnerRequestPending, setClubPartnerRequestPending] = useState(false);
  const [clubPartnerForm, setClubPartnerForm] = useState(() => buildDefaultClubPartnerForm(userData));
  const [isClubPartnerRequestVisible, setIsClubPartnerRequestVisible] = useState(false);
  const [isClubInterestTeamPickerVisible, setIsClubInterestTeamPickerVisible] = useState(false);
  const [isPlayerTeamPickerVisible, setIsPlayerTeamPickerVisible] = useState(false);
  // D95 — « ce club n'a pas encore d'equipe ». Les deux champs de contact sont
  // FACULTATIFS : la demande part avec la seule identite du joueur si on les laisse
  // vides (le serveur retombe alors sur ses propres coordonnees).
  const [isPlayerNoTeamRequestVisible, setIsPlayerNoTeamRequestVisible] = useState(false);
  const [playerNoTeamRequestPending, setPlayerNoTeamRequestPending] = useState(false);
  const [playerNoTeamForm, setPlayerNoTeamForm] = useState({ coachContact: '', coachName: '' });
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [activitiesToAdd, setActivitiesToAdd] = useState(
    /** @type {string[]} */
    ([]),
  );
  // D34 ecran 03 : « Voir le planning » depuis la liste des installations
  // revient ICI avec l'installation a selectionner. Le planning du club est un
  // onglet de cet ecran, pas une route : on le pilote donc par parametre.
  const [planningSelection, setPlanningSelection] = useState({
    facilityId: route?.params?.planningFacilityId || null,
    nonce: 0,
    scope: route?.params?.planningScope || 'club',
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
  const clubParentMultisportId = club?.parentMultisport?.documentId || club?.parentMultisport?.id || null;
  const hasParentMultisportClub = Boolean(clubParentMultisportId);
  const canLoadFacilityContext = Boolean(clubId) && !isLoading && !error;
  const {
    data: facilityContext,
    isLoading: isLoadingFacilities,
    refetch: refetchFacilities,
  } = useClubFacilityContext(
    { clubId: clubId ?? '', cmId: clubParentMultisportId },
    {
      enabled: canLoadFacilityContext,
      resolveCmId: false,
      retry: 0,
    },
  );
  const {
    data: allActivities,
    isLoading: activitiesLoading,
  } = useGetActivities();

  const sortedClubTeams = useMemo(
    () => [...(club?.teams || [])].sort(compareTeamsByAgeCategoryDesc),
    [club?.teams],
  );
  const clubHasNoTeams = sortedClubTeams.length === 0;
  const clubCertificationPalette = getClubCertificationPalette(club, Colors);
  const clubCertificationLabel = getClubCertificationLabel(club);

  const deleteTrainerMutation = useMutation({
    mutationFn: removeTrainerFromClub,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('clubDetails.alerts.deleteTrainer.error', 'Impossible de retirer cet entraîneur pour le moment.');

      Alert.alert(t('common.error', 'Erreur'), errorMessage);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: removeManagerFromClub,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('clubDetails.alerts.deleteManager.error', 'Impossible de retirer ce dirigeant pour le moment.');

      Alert.alert(t('common.error', 'Erreur'), errorMessage);
    },
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
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('clubDetails.alerts.update.error', 'Impossible de mettre à jour ce club pour le moment.');

      Alert.alert(t('common.error', 'Erreur'), errorMessage);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const switchClubMutation = useMutation({
    mutationFn: switchManagedClub,
    onError: (mutationError) => {
      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || 'Impossible de changer de club pour le moment.';

      Alert.alert('Erreur', errorMessage);
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
    onSuccess: async () => {
      setJoinRequestPending(true);
      let refreshedUser = userData;

      try {
        const refreshedUserResult = await refetchUserData();
        refreshedUser = refreshedUserResult?.data || refreshedUser;
      } catch {
        refreshedUser = userData;
      }

      refetch();
      const refreshedUserClubId = String(
        refreshedUser?.club?.documentId || refreshedUser?.club?.id || '',
      ).trim();
      const joinedImmediately = Boolean(
        userData?.role?.name === USER_ROLES.coach
        && !isPartnerClub(club)
        && refreshedUserClubId
        && refreshedUserClubId === String(clubId || '').trim(),
      );

      if (fromOnboardingAffiliation) {
        handleGoToNextOnboardingStep();
        return;
      }

      Alert.alert(
        t('clubDetails.alerts.joinClub.title'),
        joinedImmediately
          ? t(
            'clubDetails.alerts.joinClub.autoAffiliatedDescription',
            'Tu as été ajouté directement à ce club. Tu peux maintenant créer des équipes et compléter ton organisation.',
          )
          : t('clubDetails.alerts.joinClub.description'),
        [
          {
            onPress: () => {
              refetch();
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
            "Impossible d'envoyer ta demande pour le moment.",
          ),
      );
    },
    onSuccess: (_result, variables) => {
      const selectedTeamName = sortedClubTeams
        .find((teamItem) => getTeamIdentity(teamItem) === variables?.teamId)?.name
        || t('common.team', 'Équipe');

      refetchUserData();
      refetch();
      setIsPlayerTeamPickerVisible(false);

      Alert.alert(
        t('teamDetails.alerts.joinRequest.title', 'Demande envoyée'),
        t(
          'clubDetails.alerts.playerTeamJoin.description',
          'Ta demande pour rejoindre {{teamName}} a été envoyée.',
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
        t('clubDetails.alerts.clubPartnerRequest.title', 'Demande envoyée'),
        t(
          'clubDetails.alerts.clubPartnerRequest.description',
          "Nous allons contacter le dirigeant de ce club pour l'aider à rejoindre FoundClub.",
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

  // D95 — mutation dediee : elle partage le meme endpoint que la demande de
  // partenariat, mais pas ses messages. Un joueur qui fait venir son club ne lit
  // pas « nous allons contacter le dirigeant », il lit ce qu'IL vient de faire.
  const createPlayerNoTeamRequestMutation = useMutation({
    mutationFn: createClubRequest,
    onError: (mutationError) => {
      // Le serveur dedoublonne (club-request.ts) : une 2e demande pour le meme
      // club rend une erreur. Ce n'est PAS un echec pour le joueur — sa demande
      // est deja partie. On bascule donc le bouton en « Demande en attente »
      // plutot que de lui montrer un mur rouge.
      const rawMessage = String(
        mutationError?.response?.data?.error?.message
        || mutationError?.message
        || '',
      ).toLowerCase();

      if (rawMessage.includes('already exists')) {
        setPlayerNoTeamRequestPending(true);
        setIsPlayerNoTeamRequestVisible(false);
        refetchPendingTeamNotFoundRequests();
        Alert.alert(
          t('clubDetails.alerts.playerNoTeamRequest.alreadySentTitle', 'Demande déjà envoyée'),
          t(
            'clubDetails.alerts.playerNoTeamRequest.alreadySentDescription',
            'Tu attends déjà ce club. On te prévient dès qu’une équipe y est créée.',
          ),
        );
        return;
      }

      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubDetails.alerts.playerNoTeamRequest.error',
          "Impossible d'envoyer ta demande pour le moment.",
        ),
      );
    },
    onSuccess: () => {
      setPlayerNoTeamRequestPending(true);
      setIsPlayerNoTeamRequestVisible(false);
      setPlayerNoTeamForm({ coachContact: '', coachName: '' });
      refetchPendingTeamNotFoundRequests();

      Alert.alert(
        t('clubDetails.alerts.playerNoTeamRequest.title', 'Demande envoyée'),
        t(
          'clubDetails.alerts.playerNoTeamRequest.description',
          'On a bien noté que tu attends ce club. On te prévient dès qu’une équipe y est créée.',
        ),
        [{ text: t('common.actions.ok', 'OK') }],
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
        t('clubDetails.alerts.claimClub.description', 'Ta demande pour revendiquer ce club a été envoyée aux administrateurs.'),
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
      t('clubDetails.alerts.claimClub.confirmTitle', 'Tu diriges ce club ?'),
      t('clubDetails.alerts.claimClub.confirmDescription', 'Veux-tu demander la gestion de ce club ? Une vérification sera effectuée.'),
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
  // Club sans dirigeant visible : l'affiliation coach est instantanee cote serveur,
  // le bouton doit donc dire « C'est mon club ! » plutot que « Demander a rejoindre ».
  const isClubWithoutVisibleOwner = owners.length === 0 && !areClubMembersHidden;
  const clubMembersCount = Number(club?.membersCount || club?.members?.length || 0);

  const canEdit = useMemo(() => canEditClub(clubId), [clubId, canEditClub]);
  const facilitiesLoading = canLoadFacilityContext && isLoadingFacilities;
  const facilities = useMemo(
    () => (Array.isArray(facilityContext?.allFacilities) ? facilityContext.allFacilities : []),
    [facilityContext?.allFacilities],
  );
  const facilitySections = useMemo(() => getFacilitySections(facilities, {
    clubTitle: t('facilityList.sections.club', 'Installations du club'),
    sharedTitle: t('facilityList.sections.shared', 'Installations partagées'),
  }), [facilities, t]);
  const resolvedFacilityCmId = facilityContext?.cmId || clubParentMultisportId || null;
  const isMultisportAdmin = useMemo(() => (
    (userData?.multisportClubs || []).some((multisportClub) => multisportClub?.documentId === resolvedFacilityCmId)
  ), [resolvedFacilityCmId, userData?.multisportClubs]);

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

  const handleCreateManager = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddClubManager, { clubId, clubName: club?.name, staffType: 'manager' });
    }
  };

  const handleCreateSponsor = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddSponsor, { clubId });
    }
  };

  // D34 ecran 11 : meme point d'entree que `AssignCoachTeams` — le tunnel de
  // creation d'equipe vit dans l'autre stack, on ne le reecrit pas.
  const handleCreateTeam = useCallback(() => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { clubId },
      screen: RouteNames.TeamWizardName,
    });
  }, [clubId, navigation]);

  const handleEditClub = useCallback(() => {
    try {
      navigation.navigate(RouteNames.ClubEdit, { clubId });
    } catch (e) {
      navigation.getParent()?.navigate(RouteNames.ClubEdit, { clubId });
    }
  }, [clubId, navigation]);

  // D50 : la rangee « Installations » du hub ouvre l'ecran DEJA route, celui-la
  // meme que visait le « + » de l'ancienne section. C'est aussi le seul endroit
  // d'ou l'on rejoint le planning du club (D34) — la rangee est donc le chemin
  // qui le garde atteignable une fois les onglets retires.
  const handleOpenFacilityList = useCallback(() => {
    navigation.navigate(RouteNames.FacilityList, {
      clubId,
      cmId: resolvedFacilityCmId,
    });
  }, [clubId, navigation, resolvedFacilityCmId]);

  const handleOpenClubPoster = useCallback(() => {
    if (!clubId) return;
    navigation.navigate(RouteNames.VisualShowcase, {
      chatShareEnabled: false,
      shareUrl: buildPublicWebUrl({ path: `/clubs/${clubId}` }),
      subjectId: clubId,
      subjectType: 'club',
      template: 'affiche-club',
    });
  }, [clubId, navigation]);

  const handleSelectManagedClub = useCallback(async (selectedClub) => {
    const selectedClubId = String(selectedClub?.documentId || selectedClub?.id || '').trim();
    const currentClubId = String(clubId || '').trim();
    if (!selectedClubId || selectedClubId === currentClubId) {
      return;
    }

    try {
      await switchClubMutation.mutateAsync({ clubId: selectedClubId });
      await refetchUserData?.();
      navigation.replace(RouteNames.Club, {
        clubId: selectedClubId,
        ...(fromOnboardingAffiliation ? { fromOnboardingAffiliation } : {}),
      });
    } catch (_error) {
      // Handled by the mutation onError alert.
    }
  }, [clubId, fromOnboardingAffiliation, navigation, refetchUserData, switchClubMutation]);

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
      'Es-tu sûr de vouloir continuer ?',
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

  const handleDeleteManager = (managerId) => {
    if (managerId) {
      Alert.alert(
        t('clubDetails.alerts.deleteManager.title', 'Retirer ce dirigeant ?'),
        t(
          'clubDetails.alerts.deleteManager.description',
          'Ce dirigeant ne sera plus rattaché à cette section. Tu pourras le réajouter plus tard si besoin.',
        ),
        [
          {
            style: 'cancel',
            text: t('clubDetails.alerts.deleteManager.actions.cancel', 'Annuler'),
          },
          {
            onPress: () => {
              deleteManagerMutation.mutate(managerId);
            },
            text: t('clubDetails.alerts.deleteManager.actions.confirm', 'Retirer'),
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
        "Tu ne seras plus lié à ce club ni à ses équipes en tant qu'encadrant. Es-tu sûr de vouloir continuer ?",
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

    if (isUserAlreadyAttachedToViewedClub) {
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

  const relatedTeams = useMemo(() => ([
    ...(Array.isArray(userData?.myTeams) ? userData.myTeams : []),
    ...(Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    ...(Array.isArray(userData?.teams) ? userData.teams : []),
  ]), [userData?.myTeams, userData?.teams, userData?.trainedTeams]);

  const isMember = useMemo(() => {
    if (!userData) return false;
    const roleName = String(userData.role?.name || '').toLowerCase();
    const roleType = String(userData.role?.type || '').toLowerCase();
    if (roleName === 'superadmin' || roleType === 'superadmin' || roleType === 'admin') return true;

    if (clubId && hasClubAccess(clubId)) return true;

    // Check team membership
    return relatedTeams.some((team) => {
      const teamClubId = team.club?.documentId || team.club?.id;
      return teamClubId === clubId;
    });
  }, [clubId, hasClubAccess, relatedTeams, userData]);

  const isPlayerRole = userData?.role?.name === USER_ROLES.player;
  const isCoachRole = userData?.role?.name === USER_ROLES.coach;
  // D95 — le JOUEUR sort de ce parcours. Il y entrait par la ligne
  // `(isPlayerRole || isCoachRole)` et tombait sur un bouton « Je dirige ce club »
  // qui lui demandait le telephone de son dirigeant : ce n'est ni ce qu'il vient
  // faire, ni une affirmation qu'il peut tenir. Il a desormais sa propre action
  // (`canPlayerSignalMissingTeam`). Le parcours de l'entraineur ne bouge pas :
  // `isCoachRole && !(isCoachRole && !isPartnerClub(club))` == `isCoachRole && isPartnerClub(club)`.
  const canUseClubPartneringFlow = useMemo(() => (
    Boolean(club)
    && Boolean(clubId)
    && !isMember
    && clubHasNoTeams
    && isCoachRole
    && isPartnerClub(club)
  ), [club, clubHasNoTeams, clubId, isCoachRole, isMember]);

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

  // D95 — meme motif que juste au-dessus, pour la demande « ce club n'a pas
  // d'equipe ». Adel : « quand on envoie une demande, elle doit apparaitre EN
  // ATTENTE » — la source est le serveur, jamais un drapeau local seul.
  const {
    data: pendingTeamNotFoundResponse,
    refetch: refetchPendingTeamNotFoundRequests,
  } = useQuery({
    enabled: isPlayerRole && clubHasNoTeams && !isMember && !!userData?.documentId,
    queryFn: () => getPendingClubCreationRequests(userData?.documentId, {}, 'team_not_found'),
    queryKey: ['clubRequests', 'pending', 'teamNotFound', userData?.documentId],
  });

  const hasPendingTeamNotFoundRequest = useMemo(() => {
    const currentClubId = String(clubId || '').trim();
    const currentClubName = normalizeComparableValue(club?.name);

    return (pendingTeamNotFoundResponse?.data || []).some((requestItem) => {
      const requestClubId = String(requestItem?.searchContext?.clubId || '').trim();
      const requestClubName = normalizeComparableValue(requestItem?.clubName);
      const matchesClubById = Boolean(currentClubId && requestClubId && currentClubId === requestClubId);
      const matchesClubByName = Boolean(currentClubName && requestClubName === currentClubName);
      return matchesClubById || matchesClubByName;
    });
  }, [club?.name, clubId, pendingTeamNotFoundResponse?.data]);

  const hasPendingPlayerNoTeamRequest = hasPendingTeamNotFoundRequest || playerNoTeamRequestPending;

  useFocusEffect(
    useCallback(() => {
      setClubPartnerRequestPending(false);
      setJoinRequestPending(false);
      setPlayerNoTeamRequestPending(false);
      refetch();
      if (canLoadFacilityContext) {
        refetchFacilities();
      }
      if (canUseClubPartneringFlow) {
        refetchPendingClubCreationRequests();
      }
      if (isPlayerRole && clubHasNoTeams && !isMember) {
        refetchPendingTeamNotFoundRequests();
      }
    }, [
      canLoadFacilityContext,
      canUseClubPartneringFlow,
      clubHasNoTeams,
      isMember,
      isPlayerRole,
      refetch,
      refetchFacilities,
      refetchPendingClubCreationRequests,
      refetchPendingTeamNotFoundRequests,
    ]),
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

  // D95 — le miroir exact du precedent, pour le club qui n'a AUCUNE equipe.
  const canPlayerSignalMissingTeam = useMemo(() => (
    userData?.role?.name === USER_ROLES.player
    && !isMember
    && !isPlayerAlreadyInViewedClub
    && clubTeamIds.length === 0
  ), [USER_ROLES.player, clubTeamIds.length, isMember, isPlayerAlreadyInViewedClub, userData?.role?.name]);

  const isUserAlreadyAttachedToViewedClub = useMemo(() => (
    isMember
    || canEdit
    || isPlayerAlreadyInViewedClub
    || (userData?.trainedTeams || []).some((team) => (team?.club?.documentId || team?.club?.id) === clubId)
  ), [canEdit, clubId, isMember, isPlayerAlreadyInViewedClub, userData?.trainedTeams]);

  const myClubInterestRequestsQuery = useGetMyClubInterestRequests(
    { clubId },
    {
      enabled: Boolean(isAuthenticated && clubId && clubTeamIds.length > 0 && !isUserAlreadyAttachedToViewedClub),
      retry: 0,
    },
  );

  const pendingClubInterestTeamIds = useMemo(() => {
    const pendingIds = new Set();

    (myClubInterestRequestsQuery?.data?.data || []).forEach((request) => {
      const requestTeamId = getTeamIdentity(request?.team);
      if (request?.status === 'pending' && requestTeamId && clubTeamIdsSet.has(requestTeamId)) {
        pendingIds.add(requestTeamId);
      }
    });

    return pendingIds;
  }, [clubTeamIdsSet, myClubInterestRequestsQuery?.data?.data]);

  const hasPendingClubInterestRequest = useCallback((teamDocumentId) => (
    pendingClubInterestTeamIds.has(String(teamDocumentId || '').trim())
  ), [pendingClubInterestTeamIds]);

  const hasPendingViewedClubInterestRequest = useMemo(
    () => clubTeamIds.length > 0 && clubTeamIds.every((teamId) => pendingClubInterestTeamIds.has(teamId)),
    [clubTeamIds, pendingClubInterestTeamIds],
  );

  const createClubInterestRequestMutation = useMutation({
    mutationFn: ({ teamId }) => createClubInterestRequest({ team: teamId }),
    onError: (mutationError) => {
      const rawMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.message
        || mutationError?.error?.message
        || mutationError?.message
        || mutationError?.name
        || '';
      const normalizedMessage = rawMessage
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const statusCode = Number(
        mutationError?.response?.status
        || mutationError?.response?.data?.error?.status
        || mutationError?.status
        || 0,
      );
      const isDuplicate = normalizedMessage.includes('already pending')
        || normalizedMessage.includes('deja');
      const isAlreadyMember = normalizedMessage.includes('already belongs');
      const isForbidden = statusCode === 403 || normalizedMessage.includes('forbidden');
      const isTeamNotFound = statusCode === 404
        || normalizedMessage.includes('team not found')
        || normalizedMessage.includes('requested team not found');

      let alertMessage = t(
        'clubDetails.clubInterest.error',
        "Impossible d'envoyer ton intérêt pour le moment.",
      );
      if (isDuplicate) {
        alertMessage = t('clubDetails.clubInterest.alreadySent', 'Intérêt déjà envoyé.');
      } else if (isAlreadyMember) {
        alertMessage = t(
          'clubDetails.clubInterest.alreadyMember',
          'Tu es déjà rattaché à ce club.',
        );
      } else if (isForbidden) {
        alertMessage = t(
          'clubDetails.clubInterest.forbidden',
          "Ton compte n'a pas encore l'autorisation d'envoyer un intérêt. Réessaie dans quelques instants.",
        );
      } else if (isTeamNotFound) {
        alertMessage = t(
          'clubDetails.clubInterest.teamNotFound',
          "Cette équipe n'est plus disponible.",
        );
      }

      Alert.alert(
        t('common.error', 'Erreur'),
        alertMessage,
      );
    },
    onSuccess: (_result, variables) => {
      const selectedTeamName = sortedClubTeams
        .find((teamItem) => getTeamIdentity(teamItem) === variables?.teamId)?.name
        || t('common.team', 'Équipe');

      myClubInterestRequestsQuery.refetch();
      setIsClubInterestTeamPickerVisible(false);

      Alert.alert(
        t('clubDetails.clubInterest.sentTitle', 'Intérêt envoyé'),
        t(
          'clubDetails.clubInterest.sentDescription',
          'Le staff de {{teamName}} a reçu ton intérêt et pourra te répondre.',
          { teamName: selectedTeamName },
        ),
        [{ text: t('common.actions.ok', 'OK') }],
      );
    },
  });

  const isParentClubAdmin = useMemo(() => {
    // Check if user is admin of the parent multisport club
    if (!club?.parentMultisport) return false;

    const parentId = String(
      club.parentMultisport.documentId || club.parentMultisport.id || '',
    ).trim();
    if (!parentId) return false;

    const userManagedParentIds = new Set(
      (userData?.multisportClubs || [])
        .map((multisportClub) => String(multisportClub?.documentId || multisportClub?.id || '').trim())
        .filter(Boolean),
    );

    return userManagedParentIds.has(parentId) || hasClubAccess(parentId);
  }, [club, hasClubAccess, userData?.multisportClubs]);

  const isPresidentOfViewedClub = useMemo(() => (
    userData?.role?.name === USER_ROLES.president
    && hasClubAccess(clubId)
  ), [USER_ROLES.president, clubId, hasClubAccess, userData?.role?.name]);

  const isCoachOfViewedClub = useMemo(() => (
    userData?.role?.name === USER_ROLES.coach
    && (
      hasClubAccess(clubId)
      || (userData?.trainedTeams || []).some((team) => (team?.club?.documentId || team?.club?.id) === clubId)
    )
  ), [USER_ROLES.coach, clubId, hasClubAccess, userData?.role?.name, userData?.trainedTeams]);

  const canLeaveClub = useMemo(() => {
    const currentRole = userData?.role?.name;
    return Boolean(clubId && hasClubAccess(clubId))
      && (currentRole === USER_ROLES.coach || currentRole === USER_ROLES.president);
  }, [USER_ROLES.coach, USER_ROLES.president, clubId, hasClubAccess, userData?.role?.name]);
  const {
    showClubInterestAction,
    showClubPartneringAction,
    showContactAdminClaimAction,
    showEmptyClubClaimAction,
    showJoinClubAction,
    showLeaveClubAction,
    showPlayerClubAction,
    showPlayerNoTeamAction,
    showPublicClaimLogin,
    showPublicPlayerLogin,
  } = useMemo(() => resolveClubDetailsActionMatrix({
    areClubMembersHidden,
    canContactAdmin,
    canEdit,
    canJoinClub,
    canLeaveClub,
    canPlayerSignalClubTeam,
    canPlayerSignalMissingTeam,
    canUseClubPartneringFlow,
    clubHasTeams: clubTeamIds.length > 0,
    hasParentMultisportClub,
    isAuthenticated,
    isMultisportAdmin,
    isParentClubAdmin,
    isPlayerRole,
    isUserAlreadyAttachedToViewedClub,
    ownerCount: owners.length,
  }), [
    areClubMembersHidden,
    canContactAdmin,
    canEdit,
    canJoinClub,
    canLeaveClub,
    canPlayerSignalClubTeam,
    canPlayerSignalMissingTeam,
    canUseClubPartneringFlow,
    clubTeamIds.length,
    hasParentMultisportClub,
    isAuthenticated,
    isMultisportAdmin,
    isParentClubAdmin,
    isPlayerRole,
    isUserAlreadyAttachedToViewedClub,
    owners.length,
  ]);
  const shouldShowSectionScopeToggle = hasParentMultisportClub && isMultisportAdmin;

  // ---------------------------------------------------------------------------
  // D50 — la page-fleuve du dirigeant devient un HUB.
  //
  // Les sections ne disparaissent pas : elles deviennent des SOUS-PAGES, ouvertes
  // par le parametre de route `section`. C'est l'idiome que D34 a deja pose dans
  // ce meme domaine pour le planning (`FacilityList` y revient par
  // `planningFacilityId` « plutot que d'ajouter une route pour un ecran qui
  // existe deja ailleurs »). Aucune route neuve n'est donc creee ici — ce qui met
  // hors-jeu le piege le plus cher du projet (une route ajoutee dans `app` sans
  // sa moitie dans `web/src/routes/screenRegistry.tsx`).
  //
  // Un VISITEUR garde la page complete : le pack ne decrit que l'espace du
  // dirigeant, et la page publique d'un club n'est pas un hub de gestion.
  const hubSection = route?.params?.section || null;
  const isClubHub = canEdit && !hubSection && selectedTab !== 'planning';
  const isClubSubPage = canEdit && Boolean(hubSection);
  const showsClubSection = (sectionName) => !canEdit || hubSection === sectionName;

  // Les compteurs se lisent sur les MEMES sources que les sections qu'ils
  // annoncent : un compteur ecrit en dur ment des la premiere modification.
  const clubSportsCount = club?.activites?.length || 0;
  const clubSponsorsCount = club?.sponsor?.length || 0;
  const clubStaffSummary = [
    `${owners.length} ${owners.length > 1
      ? t('clubDetails.hub.owners', 'dirigeants')
      : t('clubDetails.hub.owner', 'dirigeant')}`,
    `${coachs.length} ${coachs.length > 1
      ? t('clubDetails.hub.coachs', 'entraîneurs')
      : t('clubDetails.hub.coach', 'entraîneur')}`,
  ].join(' · ');

  // La rangee Adhesions affiche le reglage REEL de l'ecran « Modifier le club ».
  // Le repli suit celui du formulaire (`ClubEdit`), qui retombe sur la delegation
  // quand le club n'a encore rien enregistre — les deux ecrans doivent raconter
  // la meme chose.
  const clubMembershipModeLabel = club?.membershipRequestManagementMode === 'CLUB_OWNER_ONLY'
    ? t('clubDetails.hub.membership.ownerOnly', 'Dirigeant')
    : t('clubDetails.hub.membership.coachAllowed', 'Délégation');

  const openClubHubSection = useCallback((sectionName) => {
    // `push` empile une seconde instance de l'ecran : le retour ramene donc au
    // hub. `navigate` se contenterait de changer les parametres de l'ecran
    // courant, et le bouton retour quitterait le club.
    const params = { clubId, section: sectionName };
    if (typeof navigation.push === 'function') {
      navigation.push(RouteNames.Club, params);
      return;
    }
    navigation.navigate(RouteNames.Club, params);
  }, [clubId, navigation]);

  const floatingClubActionsCount = [
    showPublicPlayerLogin,
    showPublicClaimLogin,
    showPlayerClubAction,
    showPlayerNoTeamAction,
    showClubPartneringAction,
    showEmptyClubClaimAction,
    showClubInterestAction,
  ].filter(Boolean).length;
  const hasFloatingClubActions = floatingClubActionsCount > 0;
  const floatingClubActionsBottomInset = Math.max(insets.bottom, 12);
  const floatingClubActionsScrollPaddingBottom = hasFloatingClubActions
    ? floatingClubActionsBottomInset + 128 + ((floatingClubActionsCount - 1) * 72)
    : 40;
  const floatingClubActionButtonStyle = {
    elevation: 18,
    shadowColor: Colors.neutral900,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  };
  const floatingClubInterestButtonStyle = {
    backgroundColor: Colors.primary900,
    borderRadius: 20,
    minHeight: 52,
    paddingVertical: 14,
  };

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
          'Ajoute le prénom et le nom du dirigeant.',
        ),
      );
      return;
    }

    if (!holderPhone && !holderEmail) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'clubDetails.alerts.clubPartnerRequest.missingContact',
          'Ajoute au moins un numéro de téléphone ou un email.',
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

  // D95 — les 3 gestes de « ce club n'a pas encore d'equipe ».
  const handleOpenPlayerNoTeamRequest = useCallback(() => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-no-team-request-login');
      return;
    }
    if (hasPendingPlayerNoTeamRequest || createPlayerNoTeamRequestMutation.isPending) {
      return;
    }
    setPlayerNoTeamForm({ coachContact: '', coachName: '' });
    setIsPlayerNoTeamRequestVisible(true);
  }, [
    createPlayerNoTeamRequestMutation.isPending,
    hasPendingPlayerNoTeamRequest,
    isAuthenticated,
    openClubAuthFlow,
  ]);

  const handleClosePlayerNoTeamRequest = useCallback(() => {
    if (createPlayerNoTeamRequestMutation.isPending) return;
    setIsPlayerNoTeamRequestVisible(false);
  }, [createPlayerNoTeamRequestMutation.isPending]);

  const handleChangePlayerNoTeamField = useCallback((field, value) => {
    setPlayerNoTeamForm((currentValue) => ({ ...currentValue, [field]: value }));
  }, []);

  const handleSubmitPlayerNoTeamRequest = useCallback(() => {
    const coachName = String(playerNoTeamForm?.coachName || '').trim();
    const coachContact = String(playerNoTeamForm?.coachContact || '').trim();

    // 🔒 Les champs de contact sont FACULTATIFS et ne partent QUE dans
    // `searchContext`. Les champs d'identite de la demande (`holder*`) restent
    // ceux du joueur : le serveur les remplit avec son propre profil quand on ne
    // les envoie pas (club-request.ts:175-186). C'est le meme contrat que le
    // parcours d'onboarding (decision C02/D3, UserAffiliationGuide.js:660-698),
    // a une difference assumee : ici on n'exige rien, pour qu'aucun joueur ne
    // reste bloque faute de connaitre le numero de son coach.
    createPlayerNoTeamRequestMutation.mutate({
      clubName: club?.name || t('common.club', 'Club'),
      requestKind: 'team_not_found',
      searchContext: {
        clubId,
        coachContact: coachContact || undefined,
        coachName: coachName || undefined,
        reason: 'club_without_team',
        role: userData?.role?.name || 'unknown',
        screen: RouteNames.Club,
        target: 'club_without_team',
      },
      source: 'manual',
    });
  }, [
    club?.name,
    clubId,
    createPlayerNoTeamRequestMutation,
    playerNoTeamForm,
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
      t('clubDetails.alerts.playerTeamJoin.title', 'Choisir cette équipe ?'),
      t(
        'clubDetails.alerts.playerTeamJoin.confirmation',
        'Une demande sera envoyée pour rejoindre {{teamName}}.',
        { teamName: teamItem?.name || t('common.team', 'Équipe') },
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

  const handleOpenClubInterestTeamPicker = useCallback(() => {
    if (!isAuthenticated) {
      openClubAuthFlow('club-interest-login');
      return;
    }

    if (!clubTeamIds.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('clubDetails.clubInterest.noTeams', "Aucune équipe n'est disponible dans ce club pour le moment."),
      );
      return;
    }

    setIsClubInterestTeamPickerVisible(true);
  }, [clubTeamIds.length, isAuthenticated, openClubAuthFlow, t]);

  const handleCloseClubInterestTeamPicker = useCallback(() => {
    if (createClubInterestRequestMutation.isPending) return;
    setIsClubInterestTeamPickerVisible(false);
  }, [createClubInterestRequestMutation.isPending]);

  const handleSelectClubInterestTeam = useCallback((teamItem) => {
    const teamDocumentId = getTeamIdentity(teamItem);
    if (!teamDocumentId || createClubInterestRequestMutation.isPending) return;

    if (hasPendingClubInterestRequest(teamDocumentId)) {
      Alert.alert(
        t('clubDetails.clubInterest.alreadySentTitle', 'Intérêt déjà envoyé'),
        t('clubDetails.clubInterest.alreadySentDescription', 'Le staff de cette équipe a déjà reçu ton intérêt.'),
      );
      return;
    }

    Alert.alert(
      t('clubDetails.clubInterest.confirmTitle', 'Envoyer ton intérêt ?'),
      t(
        'clubDetails.clubInterest.confirmDescription',
        'Le staff de {{teamName}} verra ton profil et pourra te répondre.',
        { teamName: teamItem?.name || t('common.team', 'Équipe') },
      ),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel', 'Annuler'),
        },
        {
          onPress: () => {
            createClubInterestRequestMutation.mutate({ teamId: teamDocumentId });
          },
          text: t('clubDetails.clubInterest.sendAction', 'Envoyer mon intérêt'),
        },
      ],
    );
  }, [createClubInterestRequestMutation, hasPendingClubInterestRequest, t]);

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
            {error?.message || 'Réessaie dans quelques instants.'}
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
              ? 'Aucun identifiant de club n a été fourni.'
              : 'Le lien est peut-être obsolète ou le club a été supprimé.'}
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
        Alignments.relative,
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
          { paddingBottom: floatingClubActionsScrollPaddingBottom },
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isRefreshing}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        {clubs?.length > 1 ? (
          <ClubSelector
            activeClubId={clubId}
            clubs={clubs}
            isLoading={switchClubMutation.isPending}
            onSelectClub={handleSelectManagedClub}
            title="Choisir un club"
          />
        ) : null}
        <WithDataWrapper
          wrapperStyle={[Spaces.gap[32]]}
        >
          {/* D50 : la carte d'identite du club appartient au HUB (et a la page
              publique). Une sous-page n'est pas le club : elle est UNE de ses
              rubriques, et l'en-tete de pile porte deja le retour. */}
          {!isClubSubPage ? (
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
                <ClubLogoMark
                  club={club}
                  logoStyle={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    ApplicationStyle.backgroundColor.neutral00,
                    { borderRadius: 20 },
                  ]}
                  size={80}
                />
              </View>
              <View style={[
                Spaces.gap[4],
                Alignments.alignCenter]}
              >
                {/* D50 : le pack veut le nom du club en capitales sur la carte.
                    C'est une transformation de STYLE : le texte rendu reste le
                    nom tel qu'il est en base, donc rien ne change pour un
                    lecteur d'ecran ni pour une recherche. */}
                <Text style={[
                  Fonts.h3Black,
                  Fonts.neutral00,
                  Fonts.textCenter,
                  { textTransform: 'uppercase' },
                ]}
                >
                  {club?.name}
                </Text>
                <View
                  style={[
                    ApplicationStyle.borderRadius24,
                    Spaces.paddingVertical[4],
                    Spaces.paddingHorizontal[12],
                    {
                      backgroundColor: clubCertificationPalette.backgroundColor,
                      borderColor: clubCertificationPalette.borderColor,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: clubCertificationPalette.textColor }]}>
                    {clubCertificationLabel}
                  </Text>
                </View>
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
                    <TouchableOpacity
                      accessibilityLabel={t('clubDetails.a11y.callClub', {
                        defaultValue: 'Appeler le club au {{phoneNumber}}',
                        phoneNumber: club?.phoneNumber,
                      })}
                      accessibilityRole="link"
                      onPress={() => { Linking.openURL(`tel:${club?.phoneNumber}`); }}
                    >
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
                    <TouchableOpacity
                      accessibilityLabel={t('clubDetails.a11y.emailClub', {
                        defaultValue: 'Envoyer un e-mail a {{email}}',
                        email: club?.email,
                      })}
                      accessibilityRole="link"
                      onPress={() => { Linking.openURL(`mailto:${club?.email}`); }}
                    >
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
          ) : null}

          {canEdit && clubId && !isClubSubPage ? (
            <Button
              onPress={handleOpenClubPoster}
              title={t('clubDetails.actions.joinPoster', 'Affiche — Rejoindre le club')}
              variant="Secondary"
            />
          ) : null}

          {/* D50 : la bascule de perimetre pilote le CONTENU des sections. Sur le
              hub il n'y a pas de section a piloter : elle suit ses sections dans
              les sous-pages. */}
          {shouldShowSectionScopeToggle && !isClubHub ? (
            <View style={[Alignments.alignCenter, Spaces.marginTop[12]]}>
              <ClubScopeToggle
                clubId={club?.documentId}
                parentMultisportId={club?.parentMultisport?.documentId || club?.parentMultisport?.id}
              />
            </View>
          ) : null}

          {isClubHub ? (
            <View style={[Spaces.gap[16]]}>
              <ClubHubGroup label={t('clubDetails.hub.groups.manage', 'Gérer')}>
                <ClubHubRow
                  icon={Images.stadium}
                  label={t('facilityList.title', 'Installations')}
                  onPress={handleOpenFacilityList}
                  value={facilitiesLoading ? '…' : String(facilities.length)}
                />
                <ClubHubRow
                  divider
                  icon={Images.trophy}
                  label={t('clubDetails.titles.activities')}
                  onPress={() => openClubHubSection('sports')}
                  value={String(clubSportsCount)}
                />
                <ClubHubRow
                  divider
                  icon={Images.check}
                  label={t('clubDetails.titles.sponsors')}
                  onPress={() => openClubHubSection('partners')}
                  value={String(clubSponsorsCount)}
                />
                <ClubHubRow
                  divider
                  icon={Images.shield}
                  label={t('clubDetails.titles.teams')}
                  onPress={() => openClubHubSection('teams')}
                  value={String(sortedClubTeams.length)}
                />
                <ClubHubRow
                  divider
                  icon={Images.users}
                  label={t('clubDetails.hub.rows.staff', 'Staff')}
                  onPress={() => openClubHubSection('staff')}
                  value={clubStaffSummary}
                />
              </ClubHubGroup>

              <ClubHubGroup label={t('clubDetails.hub.groups.membership', 'Adhésions')}>
                <ClubHubRow
                  icon={Images.bell}
                  label={t('clubDetails.hub.rows.membershipRequests', 'Demandes d\'adhésion')}
                  onPress={handleEditClub}
                  value={clubMembershipModeLabel}
                />
              </ClubHubGroup>
            </View>
          ) : null}

          {/* D50 : les onglets « Informations / Planning » quittent l'espace du
              dirigeant — son « Informations » EST le hub. Le planning du club
              reste atteignable, par le seul autre chemin qui existe : la rangee
              Installations ouvre `FacilityList`, d'ou « Voir le planning »
              revient ici (D34, FacilityList.js). */}
          {canEdit ? null : (
            <View style={[Alignments.alignCenter]}>
              <SegmentedControl
                onChange={setSelectedTab}
                options={tabs}
                value={selectedTab}
              />
            </View>
          )}

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
              {/* D50 : cette section reste la page PUBLIQUE du club, pour un
                  visiteur. Le dirigeant l'atteint par la rangee du hub, qui
                  ouvre `FacilityList` — un ecran DEJA route, et le seul
                  endroit d'ou « Voir le planning » sait revenir ici (D34). */}
              {showsClubSection('facilities') ? (
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
                        const capacityChipLabel = getFacilityCapacityChipLabel(
                          facility?.maxSlots,
                          t,
                        );
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
                                    <Text style={[Fonts.p3Bold, Fonts.primary300]}>
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
                                <View
                                  style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
                                >
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
                                {t(
                                  'facilityList.defaults.addressMissing',
                                  'Adresse non renseignée',
                                )}
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
              ) : null}

              {/* Activities */}
              {showsClubSection('sports') ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}>
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.activities')}</Text>
                    {activitiesHeaderActions}
                  </View>
                  {activitiesContent}
                </View>
              ) : null}
              {/* Sponsors */}
              {showsClubSection('partners') && (club?.sponsor?.length || canEdit) && (
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
                  {/* D34 ecran 07 : les partenaires defilaient horizontalement, */}
                  {/* chacun surmonte d'une pastille ROUGE flottant sur son logo. */}
                  {/* Le rouge est reserve a l'erreur et au destructif : il ne */}
                  {/* peut pas servir de decoration sur chaque logo. On passe a */}
                  {/* des rangees verticales, logo a gauche, nom au milieu, et */}
                  {/* une corbeille GRISE alignee dans la rangee. */}
                  <View
                    style={[
                      ApplicationStyle.borderRadius16,
                      Spaces.paddingHorizontal[12],
                      club?.sponsor?.length ? {
                        backgroundColor: withAlpha(Colors.neutral00, 0.04),
                        borderColor: withAlpha(Colors.neutral00, 0.09),
                        borderWidth: 1,
                      } : null,
                    ]}
                  >
                    {club?.sponsor?.map((/** @type {Sponsor} */ sponsor, sponsorIndex) => (
                      <View
                        key={sponsor.link}
                        style={[
                          Alignments.row,
                          Alignments.alignCenter,
                          Spaces.gap[12],
                          Spaces.paddingVertical[8],
                          sponsorIndex ? {
                            borderTopColor: withAlpha(Colors.neutral00, 0.07),
                            borderTopWidth: 1,
                          } : null,
                          { minHeight: SPONSOR_ROW_HEIGHT },
                        ]}
                      >
                        <SponsorLogoTile
                          height={38}
                          imageUrl={sponsor?.logo?.url}
                          link={sponsor.link}
                          width={38}
                        />
                        <Text
                          numberOfLines={1}
                          style={[Fonts.p2Bold, Fonts.neutral100, { flex: 1 }]}
                        >
                          {sponsor.title}
                        </Text>
                        {canEdit ? (
                          <TouchableOpacity
                            accessibilityLabel={t(
                              'clubDetails.a11y.deleteSponsor',
                              {
                                defaultValue: 'Supprimer le sponsor {{sponsorName}}',
                                sponsorName: sponsor.title,
                              },
                            )}
                            accessibilityRole="button"
                            hitSlop={{
                              bottom: 8, left: 8, right: 8, top: 8,
                            }}
                            onPress={() => handleDeleteSponsor(sponsor)}
                            style={[
                              Alignments.alignCenter,
                              Alignments.justifyCenter,
                              {
                                borderColor: withAlpha(Colors.neutral00, 0.2),
                                borderRadius: 10,
                                borderWidth: 1,
                                height: 40,
                                width: 40,
                              },
                            ]}
                          >
                            <Image
                              source={Images.trash}
                              style={[
                                ApplicationStyle.icon16,
                                { tintColor: Colors.neutral400 },
                              ]}
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* teams */}
              {/* D34 ecran 11 : la section apparait aussi quand le club n'a */}
              {/* AUCUNE equipe, sinon un dirigeant qui debute n'a nulle part */}
              {/* ou en creer une depuis son club. */}
              {showsClubSection('teams') && (sortedClubTeams.length || canEdit) ? (
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
                            <ClubLogoMark
                              club={team?.club || club}
                              isNeutral
                              name={team?.club?.name || club?.name || team?.name}
                              size={60}
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
                              <View
                                style={[
                                  ApplicationStyle.borderRadius24,
                                  Spaces.paddingVertical[4],
                                  Spaces.paddingHorizontal[8],
                                  Spaces.marginTop[4],
                                  {
                                    alignSelf: 'flex-start',
                                    backgroundColor: getClubCertificationPalette(team?.club || club, Colors).backgroundColor,
                                    borderColor: getClubCertificationPalette(team?.club || club, Colors).borderColor,
                                    borderWidth: 1,
                                  },
                                ]}
                              >
                                <Text style={[Fonts.p4Bold, { color: getClubCertificationPalette(team?.club || club, Colors).textColor }]}>
                                  {getClubCertificationLabel(team?.club || club)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          {/* D34 ecran 11 : la rangee ouvre la fiche equipe — */}
                          {/* le chevron le DIT, au lieu de le laisser deviner. */}
                          <Text style={[Fonts.p1, Fonts.neutral600]}>›</Text>
                        </TouchableOpacity>
                      ))
                    }
                    {canEdit ? (
                      <TouchableOpacity
                        accessibilityLabel={t('clubDetails.actions.createTeam', 'Créer une équipe')}
                        accessibilityRole="button"
                        onPress={handleCreateTeam}
                        style={[
                          Alignments.alignCenter,
                          Alignments.justifyCenter,
                          {
                            backgroundColor: withAlpha(Colors.primary500, 0.06),
                            borderColor: withAlpha(Colors.primary500, 0.4),
                            borderRadius: 16,
                            borderStyle: 'dashed',
                            borderWidth: 1.5,
                            minHeight: 52,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                          {`+ ${t('clubDetails.actions.createTeam', 'Créer une équipe')}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {showsClubSection('staff') && areClubMembersHidden ? (
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
              {showsClubSection('staff') && (coachs?.length || canEdit) ? (
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
                            <ProfileAvatar
                              enablePreview={false}
                              imageUrl={user?.avatar?.url}
                              name={[user.firstname, user.lastname].filter(Boolean).join(' ')}
                              size={40}
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
                  {/* D62 (recette Adel du 09/08) : ce bouton etait rendu HORS de la */}
                  {/* ScrollView, colle en bas du hub — il masquait la rangee « Staff ». */}
                  {/* Il ne disparait pas pour autant : `startClubChat` n'a AUCUN autre */}
                  {/* appelant (useMessaging.js:1148), donc le retirer rendrait la */}
                  {/* conversation du club impossible a ouvrir. Il redescend ici, dans le */}
                  {/* flux qui defile, sous les entraineur·e·s qu'il contacte. */}
                  {coachs?.length && canEdit ? (
                    <Button
                      onPress={handleStartChat}
                      title={t('clubDetails.actions.contactTrainers')}
                      variant="Primary"
                    />
                  ) : null}
                </View>
              ) : null}
              {/* president */}
              {showsClubSection('staff') && (owners?.length || canEdit) ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                    Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.owners')}</Text>
                    {canEdit ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleCreateManager}
                        variant="Primary"
                      />
                    ) : null}
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
                            <ProfileAvatar
                              enablePreview={false}
                              imageUrl={user?.avatar?.url}
                              name={[user.firstname, user.lastname].filter(Boolean).join(' ')}
                              size={40}
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
                                onPress={() => handleDeleteManager(user.documentId)}
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

              {/* D34 ecran 01 : « Quitter le club » etait un bouton BORDE et */}
              {/* COLLANT, rendu hors de la ScrollView — il barrait le bas de */}
              {/* l'ecran en permanence. Le pack en fait un simple TEXTE centre */}
              {/* tout en bas du contenu, qui defile avec le reste. La couleur */}
              {/* est `error300`, le rouge doux reserve a ce seul endroit. */}
              {/* D50 : quitter le club se decide depuis le club, pas depuis une */}
              {/* de ses rubriques — le texte reste donc au pied du HUB seul. */}
              {showLeaveClubAction && !isClubSubPage ? (
                <TouchableOpacity
                  accessibilityLabel={t('clubDetails.actions.leave', 'Quitter le club')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: leaveClubMutation.isPending }}
                  disabled={leaveClubMutation.isPending}
                  hitSlop={{
                    bottom: 12, left: 12, right: 12, top: 12,
                  }}
                  onPress={handleAskToLeaveClub}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    Spaces.marginTop[16],
                    { minHeight: 48 },
                  ]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.error300 }]}>
                    {t('clubDetails.actions.leave', 'Quitter le club')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </WithDataWrapper>
      </ScrollView>
      {
        showJoinClubAction ? (
          <Button
            disabled={hasPendingClubRequest || joinRequestPending || createClubMembershipRequestMutation.isPending}
            onPress={handleAskToJoinClub}
            style={[
              Spaces.marginTop[12],
              (hasPendingClubRequest || joinRequestPending || createClubMembershipRequestMutation.isPending)
                ? { opacity: 0.7 }
                : null,
            ]}
            title={(() => {
              if (hasPendingClubRequest || joinRequestPending) {
                return t('clubDetails.actions.requestPending', 'Demande en attente');
              }
              if (isClubWithoutVisibleOwner) {
                return t('clubDetails.actions.joinAsMyClub', "C'est mon club !");
              }
              return t('clubDetails.actions.requestJoin', 'Demander à rejoindre ce club');
            })()}
            variant="Primary"
          />
        ) : null
      }
      {
        showContactAdminClaimAction ? (
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
      {/* D62 : « Contacter les entraineur·e·s » a quitte ce pied collant a son */}
      {/* tour — il vit desormais dans la sous-page Staff, voir plus haut. */}
      {/* D34 ecran 01 : « Quitter le club » a quitte ce pied collant — il vit */}
      {/* desormais tout en bas du contenu qui defile, voir plus haut. */}
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
              <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral300]}>
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
              <Text style={[Fonts.p2, Spaces.margin[8], Fonts.neutral300]}>
                {t('common.messages.noData', 'Aucune donnée disponible')}
              </Text>
            ) : null}
          </View>
        </View>
      </BottomModal>
      <BottomModal
        close={handleClosePlayerNoTeamRequest}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={2} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t(
                'clubDetails.playerNoTeamRequest.title',
                'Ce club n’a pas encore d’équipe sur FoundClub',
              )}
            </Text>
          </View>
        )}
        hideCloseButton
        isVisible={isPlayerNoTeamRequestVisible}
        scrollable
        snapPoints={['82%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'clubDetails.playerNoTeamRequest.description',
              'Ton club est bien là, mais personne n’y a encore créé d’équipe. Dis-nous que tu l’attends : on contacte le club pour qu’il rejoigne FoundClub, et on te prévient dès qu’une équipe existe.',
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
              {t('clubDetails.playerNoTeamRequest.clubLabel', 'Club que tu attends')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {club?.name || t('common.club', 'Club')}
            </Text>
          </View>

          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'clubDetails.playerNoTeamRequest.coachSectionTitle',
              'Tu connais ton coach ou un dirigeant ? (facultatif)',
            )}
          </Text>
          {/* 🔒 D95 — la phrase qui rend la collecte indirecte loyale : elle dit ce
              qu'on fait du contact ET d'ou il vient. Sans elle, on stockerait la
              donnee d'un tiers qui n'a rien demande, sans qu'il puisse le savoir. */}
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'clubDetails.playerNoTeamRequest.coachSectionNotice',
              'Tu peux laisser vide : ta demande part quand même. Si tu donnes un contact, on le prévient que c’est toi qui nous as transmis ses coordonnées, et on l’efface s’il nous le demande.',
            )}
          </Text>

          <Input
            accessibilityLabel={t(
              'clubDetails.playerNoTeamRequest.fields.coachName',
              'Nom de ton coach ou dirigeant',
            )}
            label={t(
              'clubDetails.playerNoTeamRequest.fields.coachName',
              'Nom de ton coach ou dirigeant',
            )}
            onChangeText={(value) => handleChangePlayerNoTeamField('coachName', value)}
            placeholder={t(
              'clubDetails.playerNoTeamRequest.fields.coachNamePlaceholder',
              'Ex: Karim Benali',
            )}
            value={playerNoTeamForm.coachName}
          />
          <Input
            accessibilityLabel={t(
              'clubDetails.playerNoTeamRequest.fields.coachContact',
              'Contact du coach (téléphone ou e-mail)',
            )}
            autoCapitalize="none"
            label={t(
              'clubDetails.playerNoTeamRequest.fields.coachContact',
              'Contact du coach (téléphone ou e-mail)',
            )}
            onChangeText={(value) => handleChangePlayerNoTeamField('coachContact', value)}
            placeholder={t(
              'clubDetails.playerNoTeamRequest.fields.coachContactPlaceholder',
              'Ex: 06 12 34 56 78 ou coach@club.fr',
            )}
            value={playerNoTeamForm.coachContact}
          />

          <Button
            isLoading={createPlayerNoTeamRequestMutation.isPending}
            onPress={handleSubmitPlayerNoTeamRequest}
            title={t(
              'clubDetails.playerNoTeamRequest.submit',
              'Me prévenir dès qu’une équipe existe',
            )}
            variant="Primary"
          />
        </View>
      </BottomModal>
      <BottomModal
        close={handleCloseClubPartnerRequest}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={2} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t('clubDetails.clubPartnerRequest.title', 'Je dirige ce club')}
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
              "Ton club n'est pas encore partenaire FoundClub. Ajoute les coordonnées du dirigeant pour que nous puissions le contacter et lui donner accès au classement, au calendrier et aux statistiques directement dans l'application.",
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
            label={t('clubDetails.clubPartnerRequest.fields.holderFirstname', 'Prénom du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderFirstname', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderFirstname', 'Prénom du dirigeant')}
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
            label={t('clubDetails.clubPartnerRequest.fields.holderPhone', 'Téléphone du dirigeant')}
            onChangeText={(value) => handleChangeClubPartnerField('holderPhone', value)}
            placeholder={t('clubDetails.clubPartnerRequest.fields.holderPhone', 'Téléphone du dirigeant')}
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
                actionLabel = t('clubDetails.actions.myTeam', 'Mon équipe');
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
                    <ClubLogoMark
                      club={teamItem?.club || club}
                      name={teamItem?.club?.name || club?.name || teamItem?.name}
                      size={60}
                    />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {teamItem?.name || t('common.team', 'Équipe')}
                      </Text>
                      <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
                        {getTeamMetaSummary(teamItem) || teamItem?.club?.name || t('common.messages.noData', 'Aucune donnée disponible')}
                      </Text>
                      <View
                        style={[
                          ApplicationStyle.borderRadius24,
                          Spaces.paddingVertical[4],
                          Spaces.paddingHorizontal[8],
                          Spaces.marginTop[4],
                          {
                            alignSelf: 'flex-start',
                            backgroundColor: getClubCertificationPalette(teamItem?.club || club, Colors).backgroundColor,
                            borderColor: getClubCertificationPalette(teamItem?.club || club, Colors).borderColor,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, { color: getClubCertificationPalette(teamItem?.club || club, Colors).textColor }]}>
                          {getClubCertificationLabel(teamItem?.club || club)}
                        </Text>
                      </View>
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
      <BottomModal
        close={handleCloseClubInterestTeamPicker}
        headerComponent={(
          <View style={[Alignments.row, Alignments.alignCenter]}>
            <Text numberOfLines={1} style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginRight[16], { flex: 1 }]}>
              {t('clubDetails.clubInterest.pickerTitle', "Quelle équipe t'intéresse ?")}
            </Text>
          </View>
        )}
        hideCloseButton
        isVisible={isClubInterestTeamPickerVisible}
        scrollable
        snapPoints={['82%']}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'clubDetails.clubInterest.pickerDescription',
              "Sélectionne une équipe pour signaler ton intérêt au staff, sans créer de demande d'adhésion.",
            )}
          </Text>

          <View style={[Spaces.gap[12], Spaces.paddingBottom[8]]}>
            {sortedClubTeams.map((teamItem) => {
              const teamDocumentId = getTeamIdentity(teamItem);
              const isPending = hasPendingClubInterestRequest(teamDocumentId);
              const isDisabled = isPending || createClubInterestRequestMutation.isPending;
              const actionLabel = isPending
                ? t('clubDetails.clubInterest.alreadySentShort', 'Intérêt déjà envoyé')
                : t('clubDetails.clubInterest.sendAction', 'Envoyer mon intérêt');

              return (
                <TouchableOpacity
                  disabled={isDisabled}
                  key={`interest-${teamDocumentId || teamItem?.name}`}
                  onPress={() => handleSelectClubInterestTeam(teamItem)}
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
                    <ClubLogoMark
                      club={teamItem?.club || club}
                      name={teamItem?.club?.name || club?.name || teamItem?.name}
                      size={60}
                    />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {teamItem?.name || t('common.team', 'Équipe')}
                      </Text>
                      <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
                        {getTeamMetaSummary(teamItem) || teamItem?.club?.name || t('common.messages.noData', 'Aucune donnée disponible')}
                      </Text>
                      <Text numberOfLines={2} style={[Fonts.p4, Fonts.primary200, Spaces.marginTop[4]]}>
                        {t(
                          'clubDetails.clubInterest.cardHint',
                          'Le staff pourra répondre avec un message ou ouvrir une conversation.',
                        )}
                      </Text>
                    </View>
                  </View>

                  <Button
                    disabled={isDisabled}
                    isLoading={createClubInterestRequestMutation.isPending && !isPending}
                    onPress={() => handleSelectClubInterestTeam(teamItem)}
                    size="small"
                    title={actionLabel}
                    variant={isPending ? 'Secondary' : 'Primary'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </BottomModal>
      {hasFloatingClubActions ? (
        <View
          pointerEvents="box-none"
          style={[
            Alignments.absolute,
            Spaces.gap[12],
            {
              bottom: floatingClubActionsBottomInset,
              elevation: 24,
              left: 0,
              right: 0,
              zIndex: 24,
            },
          ]}
        >
          {/* D98 — le joueur passe EN PREMIER et en Primary : c'est le cas
              majoritaire d'une fiche club trouvee depuis Google. « Je dirige ce
              club » reste, en Secondary, parce qu'un dirigeant sait ce qu'il
              cherche alors qu'un joueur, lui, repartait faute de porte.
              Les deux motifs entrent dans le MEME parcours de connexion. */}
          {showPublicPlayerLogin ? (
            <Button
              onPress={() => openClubAuthFlow('club-public-player-login')}
              style={floatingClubActionButtonStyle}
              title={t('clubDetails.actions.playAtClub', 'Je joue dans ce club')}
              variant="Primary"
            />
          ) : null}

          {showPublicClaimLogin ? (
            <Button
              onPress={() => openClubAuthFlow('club-public-claim-login')}
              style={floatingClubActionButtonStyle}
              title={t('clubDetails.actions.manageClub', 'Je dirige ce club')}
              variant="Secondary"
            />
          ) : null}

          {showPlayerClubAction ? (
            <Button
              disabled={hasPendingViewedClubTeamRequest || createTeamMembershipRequestMutation.isPending}
              onPress={handleOpenPlayerTeamPicker}
              style={[
                floatingClubActionButtonStyle,
                (hasPendingViewedClubTeamRequest || createTeamMembershipRequestMutation.isPending)
                  ? { opacity: 0.7 }
                  : null,
              ]}
              title={hasPendingViewedClubTeamRequest
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t('clubDetails.actions.joinClubMember', 'Je fais partie de ce club')}
              variant="Primary"
            />
          ) : null}

          {showPlayerNoTeamAction ? (
            <Button
              disabled={hasPendingPlayerNoTeamRequest || createPlayerNoTeamRequestMutation.isPending}
              onPress={handleOpenPlayerNoTeamRequest}
              style={[
                floatingClubActionButtonStyle,
                (hasPendingPlayerNoTeamRequest || createPlayerNoTeamRequestMutation.isPending)
                  ? { opacity: 0.7 }
                  : null,
              ]}
              title={hasPendingPlayerNoTeamRequest
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t(
                  'clubDetails.actions.bringClubOver',
                  'Me prévenir dès qu’une équipe existe',
                )}
              variant="Primary"
            />
          ) : null}

          {showClubPartneringAction ? (
            <Button
              disabled={hasPendingClubPartneringRequest || createClubRequestMutation.isPending}
              onPress={handleOpenClubPartnerRequest}
              style={[
                floatingClubActionButtonStyle,
                (hasPendingClubPartneringRequest || createClubRequestMutation.isPending)
                  ? { opacity: 0.7 }
                  : null,
              ]}
              title={hasPendingClubPartneringRequest
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t('clubDetails.actions.manageClub', 'Je dirige ce club')}
              variant="Primary"
            />
          ) : null}

          {showEmptyClubClaimAction ? (
            <Button
              disabled={hasPendingClubRequest}
              onPress={handleClaimClub}
              style={[
                floatingClubActionButtonStyle,
                hasPendingClubRequest ? { opacity: 0.6 } : null,
              ]}
              title={hasPendingClubRequest
                ? t('clubDetails.actions.requestPending', 'Demande en attente')
                : t('clubDetails.actions.manageClub', 'Je dirige ce club')}
              variant={hasPendingClubRequest ? 'Secondary' : 'Primary'}
            />
          ) : null}

          {showClubInterestAction ? (
            <Button
              disabled={hasPendingViewedClubInterestRequest || createClubInterestRequestMutation.isPending}
              onPress={handleOpenClubInterestTeamPicker}
              style={[
                floatingClubActionButtonStyle,
                floatingClubInterestButtonStyle,
                (hasPendingViewedClubInterestRequest || createClubInterestRequestMutation.isPending)
                  ? { opacity: 0.7 }
                  : null,
              ]}
              title={hasPendingViewedClubInterestRequest
                ? t('clubDetails.clubInterest.alreadySentShort', 'Intérêt déjà envoyé')
                : t('clubDetails.clubInterest.button', 'Intéressé par le club')}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : null}
      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={club?.documentId || clubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default ClubDetails;
