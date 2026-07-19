import Slider from '@react-native-community/slider';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { getTeams } from '@/services/team/teamService';

import { useEventWizard } from './EventWizardContext';
import { getEventWizardStepCount } from './eventWizardDetectionUtils';

const getDocumentId = (value) => String(value?.documentId || value?.id || value || '').trim();

const getUserDisplayName = (user) => (
  `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim()
  || String(user?.username || '').trim()
  || 'Membre'
);

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const buildExternalClubSearchHaystack = (club) => [
  club?.name,
  club?.address,
  club?.city,
  club?.postalCode,
  club?.section?.name,
  ...(Array.isArray(club?.activities) ? club.activities.map((activity) => activity?.name) : []),
  ...(Array.isArray(club?.activites) ? club.activites.map((activity) => activity?.name) : []),
]
  .map((value) => normalizeSearchText(value))
  .filter(Boolean)
  .join(' ');

const buildExternalTeamSearchHaystack = (team) => [
  team?.name,
  team?.category?.name,
  team?.level?.name,
  team?.section?.name,
  ...(Array.isArray(team?.activities) ? team.activities.map((activity) => activity?.name) : []),
]
  .map((value) => normalizeSearchText(value))
  .filter(Boolean)
  .join(' ');

const uniqueUsers = (users = []) => {
  const map = new Map();
  users.forEach((user) => {
    const key = getDocumentId(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

const buildRosterFromTeam = (team) => uniqueUsers([
  ...(Array.isArray(team?.players) ? team.players : []),
  ...(Array.isArray(team?.trainers) ? team.trainers : []),
  ...(Array.isArray(team?.members) ? team.members : []),
]);

const getInternalInvitedTeamIdsFromAudiences = (audiences = []) => (
  audiences
    .filter((audience) => audience?.audienceKind !== 'external_invited')
    .map((audience) => getDocumentId(audience?.team))
    .filter(Boolean)
);

const buildInternalAudienceSummary = (audience) => {
  if (!audience) return 'Appuie pour choisir les membres ou inviter toute l equipe.';
  if (audience.selectionMode === 'SELECTED_MEMBERS') {
    return `${Array.isArray(audience.selectedMembers) ? audience.selectedMembers.length : 0} membre(s) invites`;
  }
  return 'Tous les membres invites';
};

const buildExternalAudienceSummary = (audience) => {
  if (!audience) return 'Appuie pour ajouter cette equipe externe.';
  return 'Invitation en attente de reponse';
};

const buildInviteModeCountLabel = (count, singular, plural) => {
  if (!count) return 'Aucune invitation configuree';
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
};

const normalizeExternalClubGeohash = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return String(value[0] || '');
  }

  return '';
};

const createDefaultExternalClubFilters = (filters = {}) => ({
  activity: typeof filters?.activity === 'string' ? filters.activity : '',
  city: {
    label: String(filters?.city?.label || ''),
    value: String(filters?.city?.value || ''),
  },
  geohash: normalizeExternalClubGeohash(filters?.geohash),
  radius: Number.isFinite(Number(filters?.radius)) ? Number(filters.radius) : 20,
});

const getExternalClubFilterCount = (filters = {}) => {
  let count = 0;
  if (filters?.activity) count += 1;
  if (filters?.city?.value) count += 1;
  return count;
};

const formatExternalClubLocationLabel = (filters = {}) => {
  if (!filters?.city?.label) return '';
  const radius = Number.isFinite(Number(filters?.radius)) ? Number(filters.radius) : 20;
  return `${filters.city.label} - ${radius} km`;
};

const mergeClubActivities = (club = {}, team = {}) => {
  let existingActivities = [];
  if (Array.isArray(club?.activities)) {
    existingActivities = club.activities;
  } else if (Array.isArray(club?.activites)) {
    existingActivities = club.activites;
  }
  const teamActivities = Array.isArray(team?.activities) ? team.activities : [];
  const byId = new Map();

  [...existingActivities, ...teamActivities].forEach((activity) => {
    const activityId = getDocumentId(activity);
    if (!activityId || byId.has(activityId)) return;
    byId.set(activityId, activity);
  });

  return Array.from(byId.values());
};

const buildInviteableClubFromTeam = (team) => {
  const club = team?.club;
  const clubId = getDocumentId(club);
  if (!clubId) return null;

  const mergedActivities = mergeClubActivities(club, team);

  return {
    ...club,
    activites: mergedActivities,
    activities: mergedActivities,
    documentId: clubId,
  };
};

const clubMatchesExternalFilters = (club, filters = {}) => {
  if (!club) return false;

  if (filters?.activity) {
    const clubActivityIds = [
      ...(Array.isArray(club?.activities) ? club.activities : []),
      ...(Array.isArray(club?.activites) ? club.activites : []),
    ]
      .map((activity) => getDocumentId(activity))
      .filter(Boolean);

    if (!clubActivityIds.includes(filters.activity)) {
      return false;
    }
  }

  const searchGeohash = String(filters?.geohash || '').trim();
  if (searchGeohash) {
    const clubGeohash = String(club?.geohash || '').trim();
    const geohashMatches = clubGeohash
      && (clubGeohash.startsWith(searchGeohash) || searchGeohash.startsWith(clubGeohash));
    if (!geohashMatches) {
      return false;
    }
  }

  return true;
};

const MODE_CARD_CONTENT = {
  external: {
    description: 'Recherche un club externe, ouvre ses equipes et ajoute celles que tu veux inviter.',
    title: 'Inviter une equipe externe',
  },
  internal: {
    description: 'Choisis une equipe de ton club, puis invite tous ses membres ou seulement certains joueurs.',
    title: 'Inviter des membres d\'une equipe de mon club',
  },
};

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardInvites({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const { dispatch, state } = useEventWizard();
  const {
    data: allActivities,
    error: activitiesError,
    isLoading: isLoadingActivities,
    refetch: refetchActivities,
  } = useGetActivities();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  const [isExternalSectionOpen, setIsExternalSectionOpen] = useState(false);
  const [isInternalSectionOpen, setIsInternalSectionOpen] = useState(false);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState('');
  const [selectionMode, setSelectionMode] = useState('ALL_MEMBERS');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [externalClubSearch, setExternalClubSearch] = useState('');
  const [externalClubSearchNonce, setExternalClubSearchNonce] = useState(0);
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [externalClubResults, setExternalClubResults] = useState([]);
  const [isLoadingExternalClubs, setIsLoadingExternalClubs] = useState(false);
  const [hasExternalClubSearchError, setHasExternalClubSearchError] = useState(false);
  const [selectedExternalClub, setSelectedExternalClub] = useState(null);
  const [externalClubTeams, setExternalClubTeams] = useState([]);
  const [inviteableExternalClubsPool, setInviteableExternalClubsPool] = useState([]);
  const [externalTeamSearch, setExternalTeamSearch] = useState('');
  const [isLoadingExternalTeams, setIsLoadingExternalTeams] = useState(false);
  const [hasExternalTeamsError, setHasExternalTeamsError] = useState(false);
  const [isExternalFiltersModalOpen, setIsExternalFiltersModalOpen] = useState(false);
  const [externalClubFiltersDraft, setExternalClubFiltersDraft] = useState(
    createDefaultExternalClubFilters(state.externalClubFilters),
  );
  const inviteableExternalClubsLoadedRef = useRef(false);

  const selectedOrganizerTeamId = getDocumentId(state.team);
  const clubId = getDocumentId(state.team?.club) || getDocumentId(userData?.club);
  const externalClubFilters = useMemo(
    () => createDefaultExternalClubFilters(state.externalClubFilters),
    [state.externalClubFilters],
  );
  const allAudiences = useMemo(
    () => (Array.isArray(state.teamAudiences) ? state.teamAudiences : []),
    [state.teamAudiences],
  );
  const internalAudiences = useMemo(
    () => allAudiences.filter((audience) => audience?.audienceKind !== 'external_invited'),
    [allAudiences],
  );
  const externalAudiences = useMemo(
    () => allAudiences.filter((audience) => audience?.audienceKind === 'external_invited'),
    [allAudiences],
  );
  const internalAudienceMap = useMemo(() => {
    const map = new Map();
    internalAudiences.forEach((audience) => {
      const teamId = getDocumentId(audience?.team);
      if (teamId) {
        map.set(teamId, audience);
      }
    });
    return map;
  }, [internalAudiences]);
  const externalAudienceMap = useMemo(() => {
    const map = new Map();
    externalAudiences.forEach((audience) => {
      const teamId = getDocumentId(audience?.team);
      if (teamId) {
        map.set(teamId, audience);
      }
    });
    return map;
  }, [externalAudiences]);
  const externalClubFilterCount = useMemo(
    () => getExternalClubFilterCount(externalClubFilters),
    [externalClubFilters],
  );
  const externalClubSearchQuery = useMemo(
    () => String(externalClubSearch || '').trim(),
    [externalClubSearch],
  );
  const hasExternalClubSearchQuery = externalClubSearchQuery.length >= 2;
  const hasActiveExternalClubFilters = externalClubFilterCount > 0;

  const loadClubTeams = useCallback(async () => {
    if (!clubId) {
      setAvailableTeams([]);
      setHasFetchError(false);
      return;
    }

    setIsLoading(true);
    setHasFetchError(false);
    try {
      const response = await getTeams({ clubId, pageSize: 100 });
      const allTeams = Array.isArray(response?.data) ? response.data : [];
      const inviteable = allTeams.filter((team) => team.documentId !== selectedOrganizerTeamId);
      setAvailableTeams(inviteable);
    } catch (_error) {
      setHasFetchError(true);
      setAvailableTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, selectedOrganizerTeamId]);

  useEffect(() => {
    loadClubTeams();
  }, [loadClubTeams]);

  useEffect(() => {
    if (!isExternalFiltersModalOpen) return;
    setExternalClubFiltersDraft(externalClubFilters);
  }, [externalClubFilters, isExternalFiltersModalOpen]);

  const loadExternalClubTeams = useCallback(async (club) => {
    const externalClubId = getDocumentId(club);
    if (!externalClubId) {
      setExternalClubTeams([]);
      setHasExternalTeamsError(false);
      return;
    }

    setIsLoadingExternalTeams(true);
    setHasExternalTeamsError(false);
    try {
      const response = await getTeams({ clubId: externalClubId, pageSize: 100 });
      setExternalClubTeams(Array.isArray(response?.data) ? response.data : []);
    } catch (_error) {
      setExternalClubTeams([]);
      setHasExternalTeamsError(true);
    } finally {
      setIsLoadingExternalTeams(false);
    }
  }, []);

  const loadInviteableExternalClubs = useCallback(async () => {
    if (inviteableExternalClubsLoadedRef.current) {
      return inviteableExternalClubsPool;
    }

    const uniqueClubs = new Map();
    const ingestTeams = (teams = []) => {
      teams.forEach((team) => {
        const inviteableClub = buildInviteableClubFromTeam(team);
        const externalClubId = getDocumentId(inviteableClub);
        if (!inviteableClub || !externalClubId || externalClubId === getDocumentId(clubId)) {
          return;
        }

        const existingClub = uniqueClubs.get(externalClubId);
        if (!existingClub) {
          uniqueClubs.set(externalClubId, inviteableClub);
          return;
        }

        const mergedActivities = mergeClubActivities(existingClub, team);
        uniqueClubs.set(externalClubId, {
          ...existingClub,
          activites: mergedActivities,
          activities: mergedActivities,
        });
      });
    };

    const firstPageResponse = await getTeams({ page: 1, pageSize: 100 });
    ingestTeams(Array.isArray(firstPageResponse?.data) ? firstPageResponse.data : []);

    const pageCount = Number(firstPageResponse?.meta?.pagination?.pageCount) || 1;
    if (pageCount > 1) {
      const remainingResponses = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) => getTeams({ page: index + 2, pageSize: 100 })),
      );
      remainingResponses.forEach((response) => {
        ingestTeams(Array.isArray(response?.data) ? response.data : []);
      });
    }

    const clubs = Array.from(uniqueClubs.values()).sort((left, right) => (
      String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' })
    ));

    inviteableExternalClubsLoadedRef.current = true;
    setInviteableExternalClubsPool(clubs);
    return clubs;
  }, [clubId, inviteableExternalClubsPool]);

  useEffect(() => {
    let cancelled = false;

    if (!isExternalSectionOpen || selectedExternalClub) {
      setIsLoadingExternalClubs(false);
      setHasExternalClubSearchError(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsLoadingExternalClubs(true);
      setHasExternalClubSearchError(false);
      try {
        const clubs = await loadInviteableExternalClubs();
        if (cancelled) return;

        const normalizedQuery = normalizeSearchText(externalClubSearchQuery);
        const filteredClubs = clubs
          .filter((club) => clubMatchesExternalFilters(club, externalClubFilters))
          .filter((club) => {
            if (!normalizedQuery) return true;
            return buildExternalClubSearchHaystack(club).includes(normalizedQuery);
          });
        setExternalClubResults(filteredClubs);
      } catch (_error) {
        if (cancelled) return;
        setExternalClubResults([]);
        setHasExternalClubSearchError(true);
      } finally {
        if (!cancelled) {
          setIsLoadingExternalClubs(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    clubId,
    externalClubFilters,
    externalClubSearchQuery,
    externalClubSearchNonce,
    hasExternalClubSearchQuery,
    isExternalSectionOpen,
    loadInviteableExternalClubs,
    selectedExternalClub,
  ]);

  const teamsByOwnership = useMemo(() => {
    const myTeamIds = new Set((userData?.trainedTeams || []).map((team) => team.documentId));
    const myTeams = [];
    const otherTeams = [];

    availableTeams.forEach((team) => {
      if (myTeamIds.has(team.documentId)) {
        myTeams.push(team);
      } else {
        otherTeams.push(team);
      }
    });

    return { myTeams, otherTeams };
  }, [availableTeams, userData?.trainedTeams]);

  const activeTeam = useMemo(
    () => availableTeams.find((team) => getDocumentId(team) === activeTeamId) || null,
    [activeTeamId, availableTeams],
  );
  const activeTeamRoster = useMemo(() => buildRosterFromTeam(activeTeam), [activeTeam]);
  const canSaveModalSelection = selectionMode === 'ALL_MEMBERS' || selectedMemberIds.length > 0;
  const selectedExternalClubId = getDocumentId(selectedExternalClub);
  const externalTeamsForSelectedClub = useMemo(() => (
    [...externalClubTeams].sort((left, right) => {
      const leftSelected = externalAudienceMap.has(getDocumentId(left)) ? 1 : 0;
      const rightSelected = externalAudienceMap.has(getDocumentId(right)) ? 1 : 0;
      return rightSelected - leftSelected;
    })
  ), [externalAudienceMap, externalClubTeams]);
  const filteredExternalTeamsForSelectedClub = useMemo(() => {
    const query = normalizeSearchText(externalTeamSearch);
    if (!query) return externalTeamsForSelectedClub;
    return externalTeamsForSelectedClub.filter((team) => buildExternalTeamSearchHaystack(team).includes(query));
  }, [externalTeamSearch, externalTeamsForSelectedClub]);
  const selectedExternalAudiences = useMemo(
    () => externalAudiences.filter((audience) => {
      if (!selectedExternalClubId) return true;
      return getDocumentId(audience?.team?.club) === selectedExternalClubId;
    }),
    [externalAudiences, selectedExternalClubId],
  );
  const activityOptions = useMemo(
    () => (allActivities || []).map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })),
    [allActivities],
  );
  const filteredActivityOptions = useMemo(() => {
    const query = String(activitySearchValue || '').trim().toLowerCase();
    if (!query) return activityOptions;
    return activityOptions.filter((activity) => activity.label.toLowerCase().includes(query));
  }, [activityOptions, activitySearchValue]);
  const activeExternalActivityLabel = useMemo(
    () => activityOptions.find((activity) => activity.value === externalClubFilters.activity)?.label || '',
    [activityOptions, externalClubFilters.activity],
  );
  const draftExternalActivityLabel = useMemo(
    () => activityOptions.find((activity) => activity.value === externalClubFiltersDraft.activity)?.label || '',
    [activityOptions, externalClubFiltersDraft.activity],
  );
  let externalClubResultsTitle = 'Clubs proposes';
  if (hasExternalClubSearchQuery) {
    externalClubResultsTitle = 'Resultats de recherche';
  } else if (hasActiveExternalClubFilters) {
    externalClubResultsTitle = 'Clubs correspondant aux filtres';
  }

  let externalClubEmptyMessage = 'Aucun club externe disponible pour le moment.';
  if (hasExternalClubSearchQuery) {
    externalClubEmptyMessage = 'Aucun club externe trouve pour cette recherche.';
  } else if (hasActiveExternalClubFilters) {
    externalClubEmptyMessage = 'Aucun club externe ne correspond a ces filtres pour le moment.';
  }
  if (!hasExternalClubSearchQuery && !hasActiveExternalClubFilters) {
    externalClubEmptyMessage = 'Aucun club externe avec equipe disponible pour le moment.';
  }

  const syncAudiences = useCallback((nextInternalAudiences, nextExternalAudiences) => {
    const safeInternalAudiences = Array.isArray(nextInternalAudiences) ? nextInternalAudiences : [];
    const safeExternalAudiences = Array.isArray(nextExternalAudiences) ? nextExternalAudiences : [];
    dispatch({
      payload: [...safeInternalAudiences, ...safeExternalAudiences],
      type: 'SET_TEAM_AUDIENCES',
    });
    dispatch({
      payload: getInternalInvitedTeamIdsFromAudiences(safeInternalAudiences),
      type: 'SET_INVITES',
    });
  }, [dispatch]);

  const updateInternalAudiences = useCallback((nextInternalAudiences) => {
    syncAudiences(nextInternalAudiences, externalAudiences);
  }, [externalAudiences, syncAudiences]);

  const updateExternalAudiences = useCallback((nextExternalAudiences) => {
    syncAudiences(internalAudiences, nextExternalAudiences);
  }, [internalAudiences, syncAudiences]);

  const openTeamInviteModal = (team) => {
    const teamId = getDocumentId(team);
    const existingAudience = internalAudienceMap.get(teamId);
    let nextSelectionMode = 'SELECTED_MEMBERS';
    if (existingAudience) {
      nextSelectionMode = existingAudience.selectionMode === 'SELECTED_MEMBERS'
        ? 'SELECTED_MEMBERS'
        : 'ALL_MEMBERS';
    }
    setActiveTeamId(teamId);
    setSelectionMode(nextSelectionMode);
    setSelectedMemberIds(
      (Array.isArray(existingAudience?.selectedMembers) ? existingAudience.selectedMembers : [])
        .map((member) => getDocumentId(member))
        .filter(Boolean),
    );
    setIsTeamModalOpen(true);
  };

  const closeTeamInviteModal = () => {
    setIsTeamModalOpen(false);
    setActiveTeamId('');
    setSelectionMode('ALL_MEMBERS');
    setSelectedMemberIds([]);
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    ));
  };

  const saveInternalAudience = () => {
    if (!activeTeam || !canSaveModalSelection) return;

    const teamId = getDocumentId(activeTeam);
    const nextAudience = {
      audienceKind: 'internal_invited',
      selectedMembers: selectionMode === 'SELECTED_MEMBERS' ? selectedMemberIds : [],
      selectionMode,
      status: 'ACCEPTED',
      team: activeTeam,
    };

    const nextInternalAudiences = internalAudiences.filter((audience) => getDocumentId(audience?.team) !== teamId);
    nextInternalAudiences.push(nextAudience);
    updateInternalAudiences(nextInternalAudiences);
    closeTeamInviteModal();
  };

  const removeInternalAudience = () => {
    if (!activeTeam) return;
    const teamId = getDocumentId(activeTeam);
    const nextInternalAudiences = internalAudiences.filter((audience) => getDocumentId(audience?.team) !== teamId);
    updateInternalAudiences(nextInternalAudiences);
    closeTeamInviteModal();
  };

  const handleSelectExternalClub = async (club) => {
    setSelectedExternalClub(club);
    setExternalTeamSearch('');
    await loadExternalClubTeams(club);
  };

  const handleResetExternalClub = () => {
    setSelectedExternalClub(null);
    setExternalTeamSearch('');
    setExternalClubTeams([]);
    setHasExternalTeamsError(false);
  };

  const openExternalFiltersModal = () => {
    setExternalClubFiltersDraft(externalClubFilters);
    setActivitySearchValue('');
    setIsExternalFiltersModalOpen(true);
  };

  const closeExternalFiltersModal = () => {
    setIsExternalFiltersModalOpen(false);
    setActivitySearchValue('');
  };

  const persistExternalClubFilters = (filters) => {
    dispatch({
      payload: { externalClubFilters: filters },
      type: 'SET_META',
    });
    setExternalClubSearchNonce((current) => current + 1);
  };

  const handleApplyExternalFilters = () => {
    const nextFilters = createDefaultExternalClubFilters(externalClubFiltersDraft);
    const coordinates = String(nextFilters.city?.value || '').split('|');
    const lon = Number.parseFloat(coordinates?.[0] || '');
    const lat = Number.parseFloat(coordinates?.[1] || '');
    const hasCoordinates = Boolean(nextFilters.city?.value)
      && Number.isFinite(lat)
      && Number.isFinite(lon);
    const geohash = hasCoordinates
      ? getGeohashForPointAndRadius(lat, lon, nextFilters.radius)
      : '';

    persistExternalClubFilters({
      ...nextFilters,
      geohash: typeof geohash === 'string' ? geohash : '',
    });
    closeExternalFiltersModal();
  };

  const clearAppliedExternalFilters = () => {
    const emptyFilters = createDefaultExternalClubFilters();
    setExternalClubFiltersDraft(emptyFilters);
    persistExternalClubFilters(emptyFilters);
  };

  const resetExternalFilterDraft = () => {
    setActivitySearchValue('');
    setExternalClubFiltersDraft(createDefaultExternalClubFilters());
  };

  const toggleExternalTeamInvitation = (team) => {
    const teamId = getDocumentId(team);
    const alreadySelected = externalAudienceMap.has(teamId);

    if (alreadySelected) {
      updateExternalAudiences(
        externalAudiences.filter((audience) => getDocumentId(audience?.team) !== teamId),
      );
      return;
    }

    updateExternalAudiences([
      ...externalAudiences,
      {
        audienceKind: 'external_invited',
        selectedMembers: [],
        selectionMode: 'ALL_MEMBERS',
        status: 'PENDING',
        team,
      },
    ]);
  };

  const handleNext = () => {
    dispatch({ payload: getInternalInvitedTeamIdsFromAudiences(internalAudiences), type: 'SET_INVITES' });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const handleSkip = () => {
    dispatch({ payload: [], type: 'SET_INVITES' });
    dispatch({ payload: [], type: 'SET_TEAM_AUDIENCES' });
    navigation.navigate(RouteNames.EventWizardLogistics);
  };

  const renderInviteModeCard = (mode, {
    expanded,
    onToggle,
  }) => {
    const content = MODE_CARD_CONTENT[mode];
    const count = mode === 'internal' ? internalAudiences.length : externalAudiences.length;
    const countLabel = mode === 'internal'
      ? buildInviteModeCountLabel(count, 'equipe interne configuree', 'equipes internes configurees')
      : buildInviteModeCountLabel(count, 'equipe externe ajoutee', 'equipes externes ajoutees');

    return (
      <View
        key={mode}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: expanded ? 'rgba(1, 179, 244, 0.16)' : 'rgba(4, 31, 44, 0.82)',
            borderColor: expanded ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
            borderWidth: expanded ? 1.5 : 1,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onToggle}
          style={Spaces.gap[12]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {content.title}
              </Text>
            </View>
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[8],
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: expanded ? `${Colors.primary500}16` : 'rgba(255,255,255,0.05)',
                  borderColor: expanded ? `${Colors.primary500}66` : 'rgba(255,255,255,0.10)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, expanded ? Fonts.primary100 : Fonts.neutral200]}>
                {expanded ? 'Masquer' : 'Ouvrir'}
              </Text>
              <Image
                source={Images.chevronDown}
                style={{
                  height: 14,
                  tintColor: expanded ? Colors.primary500 : Colors.neutral200,
                  transform: [{ rotate: expanded ? '180deg' : '0deg' }],
                  width: 14,
                }}
              />
            </View>
          </View>

          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {content.description}
          </Text>

          <View
            style={[
              Alignments.selfStart,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              {
                backgroundColor: expanded ? `${Colors.primary500}16` : 'rgba(255,255,255,0.05)',
                borderColor: expanded ? `${Colors.primary500}66` : 'rgba(255,255,255,0.10)',
                borderRadius: 999,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, expanded ? Fonts.primary100 : Fonts.neutral200]}>
              {countLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInternalTeamCard = (team) => {
    const audience = internalAudienceMap.get(getDocumentId(team));
    return (
      <EventWizardTeamCard
        isSelected={Boolean(audience)}
        key={team.documentId}
        onPress={() => openTeamInviteModal(team)}
        selectionSummary={buildInternalAudienceSummary(audience)}
        showSelectionIndicator
        team={team}
      />
    );
  };

  const renderExternalTeamCard = (team) => {
    const audience = externalAudienceMap.get(getDocumentId(team));
    return (
      <EventWizardTeamCard
        isSelected={Boolean(audience)}
        key={team.documentId}
        onPress={() => toggleExternalTeamInvitation(team)}
        selectionSummary={buildExternalAudienceSummary(audience)}
        showSelectionIndicator
        team={team}
      />
    );
  };

  const renderExternalFilterChip = (label) => (
    <View
      key={label}
      style={[
        Alignments.selfStart,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[8],
        {
          backgroundColor: `${Colors.primary500}12`,
          borderColor: `${Colors.primary500}44`,
          borderRadius: 999,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary100]}>
        {label}
      </Text>
    </View>
  );

  return (
    <WizardStepLayout
      isNextDisabled={isLoading || hasFetchError}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip={false}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={3}
      subtitle={t(
        'eventWizard.steps.invites.subtitle',
        'Tu peux inviter des membres de ton club, une ou plusieurs equipes externes, ou les deux.',
      )}
      title={t('eventWizard.steps.invites.title')}
    >
      <View style={Spaces.gap[16]}>
        <View style={Spaces.gap[12]}>
          {renderInviteModeCard('internal', {
            expanded: isInternalSectionOpen,
            onToggle: () => setIsInternalSectionOpen((current) => !current),
          })}

          {isInternalSectionOpen ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[16],
                cardSurfaceStyle,
              ]}
            >
              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  Equipes de mon club
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Clique sur une equipe pour inviter tout le groupe ou choisir seulement les membres concernes.
                </Text>
              </View>

              {isLoading ? (
                <ActivityIndicator color={Colors.primary500} size="large" />
              ) : null}

              {!isLoading && hasFetchError ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, Spaces.marginBottom[12]]}>
                    {t('eventWizard.errors.invitesFetch')}
                  </Text>
                  <Button
                    onPress={loadClubTeams}
                    title={t('common.retry', 'Recharger')}
                    variant="Primary"
                  />
                </View>
              ) : null}

              {!isLoading && !hasFetchError && availableTeams.length === 0 ? (
                <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                  <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
                    {t('eventWizard.errors.noOtherTeams')}
                  </Text>
                </View>
              ) : null}

              {!isLoading && !hasFetchError && availableTeams.length > 0 ? (
                <View style={[Spaces.gap[16]]}>
                  {teamsByOwnership.myTeams.length > 0 ? (
                    <>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                        {t('eventWizard.steps.invites.myTeams')}
                      </Text>
                      <View style={[Spaces.gap[12]]}>
                        {teamsByOwnership.myTeams.map(renderInternalTeamCard)}
                      </View>
                    </>
                  ) : null}

                  {teamsByOwnership.otherTeams.length > 0 ? (
                    <>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200, Spaces.marginTop[8]]}>
                        {t('eventWizard.steps.invites.otherTeams')}
                      </Text>
                      <View style={[Spaces.gap[12]]}>
                        {teamsByOwnership.otherTeams.map(renderInternalTeamCard)}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={Spaces.gap[12]}>
          {renderInviteModeCard('external', {
            expanded: isExternalSectionOpen,
            onToggle: () => setIsExternalSectionOpen((current) => !current),
          })}

          {isExternalSectionOpen ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[16],
                cardSurfaceStyle,
              ]}
            >
              <View style={Spaces.gap[8]}>
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      Recherche club
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      Reprends la logique de recherche club, ouvre le club externe puis ajoute une ou plusieurs equipes.
                    </Text>
                  </View>
                  <View
                    style={[
                      Alignments.selfStart,
                      Spaces.paddingHorizontal[12],
                      Spaces.paddingVertical[8],
                      {
                        backgroundColor: externalClubFilterCount > 0 ? `${Colors.primary500}16` : 'rgba(255,255,255,0.05)',
                        borderColor: externalClubFilterCount > 0 ? `${Colors.primary500}66` : 'rgba(255,255,255,0.10)',
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, externalClubFilterCount > 0 ? Fonts.primary100 : Fonts.neutral200]}>
                      {externalClubFilterCount > 0
                        ? `${externalClubFilterCount} filtre(s)`
                        : 'Sans filtre'}
                    </Text>
                  </View>
                </View>
              </View>

              {!selectedExternalClub ? (
                <View style={Spaces.gap[12]}>
                  <SearchBar
                    onChangeText={setExternalClubSearch}
                    onFilterPress={openExternalFiltersModal}
                    placeholder="Rechercher un club externe"
                    value={externalClubSearch}
                    withCalendar={false}
                    withFilter
                  />

                  {externalClubFilterCount > 0 ? (
                    <View style={Spaces.gap[8]}>
                      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                        {activeExternalActivityLabel ? renderExternalFilterChip(activeExternalActivityLabel) : null}
                        {externalClubFilters.city?.label
                          ? renderExternalFilterChip(formatExternalClubLocationLabel(externalClubFilters))
                          : null}
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={clearAppliedExternalFilters}
                        style={Alignments.selfStart}
                      >
                        <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                          Effacer les filtres
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      Ajoute un sport ou une zone pour affiner la recherche comme dans la recherche club.
                    </Text>
                  )}

                  {!hasExternalClubSearchQuery ? (
                    <View style={[ApplicationStyle.card, Spaces.padding[16], cardSurfaceStyle]}>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {hasActiveExternalClubFilters
                          ? 'Parcours les clubs correspondant a tes filtres, ou tape un nom pour affiner encore.'
                          : 'Parcours les clubs proposes, ou tape un nom pour affiner la recherche.'}
                      </Text>
                    </View>
                  ) : null}

                  {isLoadingExternalClubs ? (
                    <ActivityIndicator color={Colors.primary500} size="large" />
                  ) : null}

                  {!isLoadingExternalClubs && hasExternalClubSearchError ? (
                    <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                      <Text style={[Fonts.p1, Fonts.neutral100, Spaces.marginBottom[12]]}>
                        Impossible de charger les clubs externes pour le moment.
                      </Text>
                      <Button
                        onPress={() => setExternalClubSearchNonce((current) => current + 1)}
                        title="Reessayer"
                        variant="Primary"
                      />
                    </View>
                  ) : null}

                  {!isLoadingExternalClubs && !hasExternalClubSearchError && externalClubResults.length > 0 ? (
                    <View style={Spaces.gap[12]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{externalClubResultsTitle}</Text>
                      {externalClubResults.map((club) => (
                        <ClubSearchResultCard
                          footer={(
                            <Text style={[Fonts.p3, Fonts.primary200]}>
                              Appuie pour voir les equipes du club
                            </Text>
                          )}
                          item={club}
                          key={club.documentId || club.id}
                          onPress={() => handleSelectExternalClub(club)}
                        />
                      ))}
                    </View>
                  ) : null}

                  {!isLoadingExternalClubs
                    && !hasExternalClubSearchError
                    && externalClubResults.length === 0 ? (
                      <View style={[ApplicationStyle.card, Spaces.padding[16], cardSurfaceStyle]}>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>{externalClubEmptyMessage}</Text>
                      </View>
                    ) : null}

                  {externalAudiences.length > 0 ? (
                    <View style={Spaces.gap[12]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                        Equipes externes deja ajoutees
                      </Text>
                      <View style={Spaces.gap[12]}>
                        {externalAudiences.map((audience) => (
                          <EventWizardTeamCard
                            isSelected
                            key={`external-audience-${getDocumentId(audience?.team)}`}
                            onPress={async () => {
                              setIsExternalSectionOpen(true);
                              if (audience?.team?.club) {
                                setSelectedExternalClub(audience.team.club);
                                await loadExternalClubTeams(audience.team.club);
                              }
                            }}
                            selectionSummary={buildExternalAudienceSummary(audience)}
                            showSelectionIndicator
                            team={audience?.team}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={Spaces.gap[16]}>
                  <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
                    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                          Club selectionne
                        </Text>
                      </View>
                      <Button
                        onPress={handleResetExternalClub}
                        title="Changer de club"
                        variant="Secondary"
                      />
                    </View>
                    <ClubSearchResultCard
                      footer={(
                        <Text style={[Fonts.p3, Fonts.primary200]}>
                          Choisis une ou plusieurs equipes ci-dessous
                        </Text>
                      )}
                      isSelected
                      item={selectedExternalClub}
                    />
                  </View>

                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      Equipes du club
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      Appuie sur une equipe pour ajouter cette equipe a l evenement. Tu peux en selectionner plusieurs.
                    </Text>
                  </View>

                  <SearchBar
                    onChangeText={setExternalTeamSearch}
                    placeholder="Rechercher une equipe"
                    value={externalTeamSearch}
                    withCalendar={false}
                  />

                  {isLoadingExternalTeams ? (
                    <ActivityIndicator color={Colors.primary500} size="large" />
                  ) : null}

                  {!isLoadingExternalTeams && hasExternalTeamsError ? (
                    <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                      <Text style={[Fonts.p1, Fonts.neutral100, Spaces.marginBottom[12]]}>
                        Impossible de charger les equipes de ce club.
                      </Text>
                      <Button
                        onPress={() => loadExternalClubTeams(selectedExternalClub)}
                        title="Reessayer"
                        variant="Primary"
                      />
                    </View>
                  ) : null}

                  {!isLoadingExternalTeams && !hasExternalTeamsError && externalTeamsForSelectedClub.length === 0 ? (
                    <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        Aucune equipe disponible pour ce club.
                      </Text>
                    </View>
                  ) : null}

                  {!isLoadingExternalTeams
                    && !hasExternalTeamsError
                    && externalTeamsForSelectedClub.length > 0
                    && filteredExternalTeamsForSelectedClub.length === 0 ? (
                      <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          Aucune equipe ne correspond a cette recherche.
                        </Text>
                      </View>
                    ) : null}

                  {!isLoadingExternalTeams && !hasExternalTeamsError && filteredExternalTeamsForSelectedClub.length > 0 ? (
                    <View style={Spaces.gap[12]}>
                      {filteredExternalTeamsForSelectedClub.map(renderExternalTeamCard)}
                    </View>
                  ) : null}

                  {selectedExternalAudiences.length > 0 ? (
                    <View style={Spaces.gap[8]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                        Invitations externes configurees
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        Les equipes cochees recevront une demande et devront accepter cette invitation.
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>

      {isTeamModalOpen ? (
        <BottomModal close={closeTeamInviteModal} isVisible snapPoints={['88%']} webPresentation="dialog">
          <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]} showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                {activeTeam?.name || 'Equipe'}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Choisis si tu invites tout le groupe ou seulement certains membres a cet evenement.
              </Text>
            </View>

            <View style={[Spaces.gap[8]]}>
              <Button
                onPress={() => {
                  setSelectionMode('ALL_MEMBERS');
                  setSelectedMemberIds([]);
                }}
                title="Inviter tous les membres"
                variant={selectionMode === 'ALL_MEMBERS' ? 'Primary' : 'Secondary'}
              />
              <Button
                onPress={() => setSelectionMode('SELECTED_MEMBERS')}
                title="Choisir certains membres"
                variant={selectionMode === 'SELECTED_MEMBERS' ? 'Primary' : 'Secondary'}
              />
            </View>

            {selectionMode === 'SELECTED_MEMBERS' ? (
              <View style={Spaces.gap[12]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {selectedMemberIds.length > 0
                    ? `${selectedMemberIds.length} membre(s) selectionne(s)`
                    : 'Selectionne les membres a inviter'}
                </Text>

                {activeTeamRoster.length > 0 ? (
                  <View style={Spaces.gap[8]}>
                    {activeTeamRoster.map((member) => {
                      const memberId = getDocumentId(member);
                      const checked = selectedMemberIds.includes(memberId);
                      return (
                        <TouchableOpacity
                          key={memberId}
                          onPress={() => toggleMemberSelection(memberId)}
                          style={[
                            Alignments.row,
                            Alignments.alignCenter,
                            Spaces.gap[12],
                            {
                              backgroundColor: `${Colors.primary800}A6`,
                              borderColor: checked ? Colors.primary500 : `${Colors.primary500}33`,
                              borderRadius: 16,
                              borderWidth: 1,
                              padding: 12,
                            },
                          ]}
                        >
                          <Checkbox onValueChange={() => toggleMemberSelection(memberId)} value={checked} />
                          <ProfileAvatar
                            enablePreview={false}
                            imageUrl={member?.avatar?.url}
                            size={36}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{getUserDisplayName(member)}</Text>
                            <Text style={[Fonts.p3, Fonts.neutral200]}>{member?.role?.name || 'Membre'}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    Aucun membre disponible pour cette equipe.
                  </Text>
                )}
              </View>
            ) : (
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  {
                    backgroundColor: `${Colors.primary500}12`,
                    borderColor: `${Colors.primary500}44`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Tous les membres de cette equipe recevront cette invitation et verront ensuite l evenement dans leur planning.
                </Text>
              </View>
            )}

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingTop[8]]}>
              {internalAudienceMap.has(activeTeamId) ? (
                <Button
                  onPress={removeInternalAudience}
                  style={{ borderColor: Colors.error500, flex: 1 }}
                  textStyle={{ color: Colors.error500 }}
                  title="Retirer cette invitation"
                  variant="Secondary"
                />
              ) : null}
              <Button onPress={closeTeamInviteModal} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
              <Button
                disabled={!canSaveModalSelection}
                onPress={saveInternalAudience}
                style={{ flex: 1 }}
                title="Enregistrer"
              />
            </View>
          </ScrollView>
        </BottomModal>
      ) : null}

      {isExternalFiltersModalOpen ? (
        <BottomModal close={closeExternalFiltersModal} isVisible snapPoints={['88%']} webPresentation="dialog">
          <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]} showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                Filtres de recherche club
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Reprends les filtres utiles de la recherche de clubs pour trouver plus vite la bonne equipe externe.
              </Text>
            </View>

            <AutocompleteAddressInput
              address={externalClubFiltersDraft.city}
              label={t('clubFilters.fields.city.label', 'Ville')}
              placeholder={t('clubFilters.fields.city.placeholder', 'Entrez une ville')}
              setAddress={(city) => setExternalClubFiltersDraft((current) => ({
                ...current,
                city: city || { label: '', value: '' },
              }))}
            />

            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {`${t('clubFilters.fields.radius.label', 'Rayon')} : ${externalClubFiltersDraft.radius}km`}
              </Text>
              <Slider
                disabled={!externalClubFiltersDraft.city?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={2}
                onValueChange={(radius) => setExternalClubFiltersDraft((current) => ({
                  ...current,
                  radius,
                }))}
                step={1}
                style={[Alignments.fullWidth, { height: 50 }]}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={externalClubFiltersDraft.radius}
              />
            </View>

            <View style={Spaces.gap[12]}>
              <AutocompleteSelect
                disabled={Boolean(activitiesError)}
                isLoading={isLoadingActivities}
                isSearchable
                label={t('clubFilters.fields.activity.label', 'Sport')}
                options={filteredActivityOptions}
                placeholder={t('clubFilters.fields.activity.placeholder', 'Selectionner une activite')}
                searchValue={activitySearchValue}
                setSearchValue={setActivitySearchValue}
                setValue={(option) => setExternalClubFiltersDraft((current) => ({
                  ...current,
                  activity: option?.value || '',
                }))}
                value={draftExternalActivityLabel}
              />

              {activitiesError ? (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.p3, Fonts.error500]}>
                    Impossible de charger la liste des sports pour le moment.
                  </Text>
                  <Button
                    onPress={() => refetchActivities()}
                    title="Reessayer"
                    variant="Secondary"
                  />
                </View>
              ) : null}
            </View>

            <View style={[Alignments.row, Spaces.gap[8], Spaces.paddingTop[8]]}>
              <Button
                onPress={resetExternalFilterDraft}
                style={{ flex: 1 }}
                title={t('clubFilters.actions.clear', 'Vider')}
                variant="Secondary"
              />
              <Button
                onPress={closeExternalFiltersModal}
                style={{ flex: 1 }}
                title="Annuler"
                variant="Secondary"
              />
              <Button
                onPress={handleApplyExternalFilters}
                style={{ flex: 1 }}
                title={t('clubFilters.actions.apply', 'Appliquer')}
              />
            </View>
          </ScrollView>
        </BottomModal>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleSkip}
        style={[Alignments.selfCenter, Spaces.paddingVertical[8], Spaces.marginTop[8]]}
      >
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          Passer cette etape
        </Text>
      </TouchableOpacity>

      <View style={Spaces.paddingBottom[24]} />
    </WizardStepLayout>
  );
}

export default EventWizardInvites;
