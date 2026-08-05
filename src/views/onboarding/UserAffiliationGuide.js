import { useMutation } from '@tanstack/react-query';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getUserRoleKey,
  markOnboardingComplete,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { getGeohashForPointAndRadius } from '@/domains/places/placesUseCases';
import { ENABLE_AFFILIATION_ONBOARDING_TUTORIAL } from '@/domains/tutorial/tutorialFeatureFlags';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Stepper from '@/components/atoms/stepper/Stepper';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import Input from '@/components/molecules/input/Input';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingClubCard from '@/views/onboarding/components/OnboardingClubCard';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClubs } from '@/services/club/clubQueries';
import { createClubRequest } from '@/services/clubRequest/clubRequestService';
import { useGetTeams } from '@/services/team/teamQueries';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { requestCurrentSearchMapLocation } from '@/platform/maps/searchMapGeolocation';

const DEBOUNCE_MS = 300;
const RESULT_CARD_MIN_HEIGHT = 96;
const SKELETON_RESULT_COUNT = 3;
const SKELETON_PLACEHOLDER_KEYS = ['one', 'two', 'three'];
const AFFILIATION_TUTORIAL_FLOW_PREFIX = 'onboarding-affiliation-v2';

// Rayon du « Autour de moi ». Même valeur que le rayon par défaut de
// ClubFilters, pour que les deux chemins donnent le même périmètre.
const NEARBY_RADIUS_KM = 20;
const EARTH_RADIUS_KM = 6371;

// Repères de test (E6). Ce sont des poignées stables : le libellé visible change
// avec le design, pas ces identifiants — le test caractérisant vise la CIBLE
// (sauter l'étape, chercher, signaler un club absent), jamais le mot affiché.
export const AFFILIATION_TEST_IDS = Object.freeze({
  notFound: 'onboarding-affiliation-not-found',
  search: 'onboarding-affiliation-search',
  skip: 'onboarding-affiliation-skip',
});

/**
 * Distance à vol d'oiseau entre deux points, en kilomètres.
 * Le serveur ne renvoie pas de distance sur `/clubs` : elle est calculée ici
 * à partir de `address.lat/lng`, que la liste renvoie bien (mesuré le
 * 2026-07-31 sur api-staging).
 * @param {{ lat: number, lng: number } | null} from - Position de l'utilisateur.
 * @param {any} club - Club affiché.
 * @returns {number | null} - Distance en km, ou null si un point manque.
 */
const getClubDistanceKm = (from, club) => {
  const lat = Number(club?.address?.lat ?? club?.lat);
  const lng = Number(club?.address?.lng ?? club?.lng);
  if (!from || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const toRad = (/** @type {number} */ deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat - from.lat);
  const dLng = toRad(lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.description
 * @param root0.id
 * @param root0.nextAction
 * @param root0.nextLabel
 * @param root0.nextTargetStepId
 * @param root0.onNext
 * @param root0.order
 * @param root0.spotlight
 * @param root0.style
 * @param root0.targetNodeResolver
 * @param root0.title
 */
function AffiliationTutorialStep({
  children,
  description,
  id,
  nextAction,
  nextLabel,
  nextTargetStepId,
  onNext,
  order,
  spotlight,
  style,
  targetNodeResolver,
  title,
}) {
  if (!ENABLE_AFFILIATION_ONBOARDING_TUTORIAL) {
    // Le drapeau est éteint : on ne monte pas le tour guidé, mais le `style` que
    // l'appelant confie à l'ancre reste le SIEN et doit s'appliquer. Sans cette
    // enveloppe, la carte de résultat qui porte l'ancre (index 1) perdait sa
    // gouttière et se collait à la suivante — écart de 0 px là où les autres en
    // ont 10 (règle « touch spacing », minimum 8 px entre cibles tactiles).
    return <View style={style}>{children}</View>;
  }

  return (
    <OnboardingWrapper
      description={description}
      id={id}
      nextAction={nextAction}
      nextLabel={nextLabel}
      nextTargetStepId={nextTargetStepId}
      onNext={onNext}
      order={order}
      spotlight={spotlight}
      style={style}
      targetNodeResolver={targetNodeResolver}
      title={title}
    >
      {children}
    </OnboardingWrapper>
  );
}

/**
 * Lien « Passer » du header. Il remplace le bouton « Continuer plus tard » du
 * pied de page et déclenche exactement la même navigation.
 * @param {object} props
 * @param {string} props.hint - Indication d'accessibilité.
 * @param {string} props.label - Libellé affiché.
 * @param {() => void} props.onPress - Navigation vers l'étape suivante.
 * @returns {import('react').ReactElement}
 */
function AffiliationSkipLink({ hint, label, onPress }) {
  const { ApplicationStyle, Colors, Spaces } = useTheme();

  return (
    <View testID={AFFILIATION_TEST_IDS.skip}>
      <TouchableOpacity
        accessibilityHint={hint}
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={ApplicationStyle.hitSlop?.min44From32}
        onPress={onPress}
        style={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[8]]}
      >
        <Text style={[styles.skipLabel, { color: Colors.primary500 }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * React Navigation exige une FONCTION pour `headerTitle` / `headerRight`.
 * On lui rend un élément déjà construit : ce n'est pas un composant défini au
 * rendu, donc pas de remontage du header à chaque passe.
 * @param {import('react').ReactElement} element - Élément à servir au header.
 * @returns {() => import('react').ReactElement} - Fabrique attendue par le navigateur.
 */
const asHeaderSlot = (element) => () => element;

const getTeamCardMeta = (item, fallbackLabel) => (
  [item?.section?.name, item?.category?.name, item?.level?.name]
    .filter(Boolean)
    .join(' - ') || item?.club?.name || fallbackLabel
);

/**
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function UserAffiliationGuideContent({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    onboardingViews,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const [{ clubFilters }] = useAppContext();
  const { getClubFiltersNumber } = useClub();
  const { isActive, startOnboarding, totalSteps } = useOnboarding();

  const roleName = userData?.role?.name;
  const roleKey = getUserRoleKey(roleName);
  const isStaffAffiliationFlow = roleKey === 'coach' || roleKey === 'president';
  const isPlayerAffiliationFlow = roleKey === 'player';

  const [selectedClub, setSelectedClub] = useState(null);
  const isClubFlow = isStaffAffiliationFlow || (isPlayerAffiliationFlow && !selectedClub?.documentId);
  const isPlayerClubSelectionStep = isClubFlow && !isStaffAffiliationFlow;
  const roleTargetLabel = isClubFlow
    ? t('onboardingAffiliation.common.roleTargetClub', 'club')
    : t('onboardingAffiliation.common.roleTargetTeam', 'équipe');
  const selectedClubId = selectedClub?.documentId || undefined;
  const clubFiltersCount = getClubFiltersNumber(clubFilters);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isNotFoundModalVisible, setIsNotFoundModalVisible] = useState(false);
  const [requestedName, setRequestedName] = useState('');
  const [comment, setComment] = useState('');
  // C02 / décision D3 : contact du coach/dirigeant saisi quand le club choisi
  // n'a aucune équipe (envoyé au superadmin via searchContext).
  const [coachName, setCoachName] = useState('');
  const [coachContact, setCoachContact] = useState('');
  // Géoloc de la chip « Autour de moi ». `denied` couvre le refus ET
  // l'indisponibilité (web sans HTTPS, capteur muet) : dans les deux cas on
  // retombe sur les SUGGESTIONS par sport, jamais sur l'alphabet brut.
  const [userPosition, setUserPosition] = useState(
    /** @type {{ lat: number, lng: number } | null} */(null),
  );
  const [geoStatus, setGeoStatus] = useState(
    /** @type {'idle' | 'pending' | 'granted' | 'denied'} */('idle'),
  );
  const [isSportChipActive, setIsSportChipActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (!ENABLE_AFFILIATION_ONBOARDING_TUTORIAL) return undefined;
    if (isActive || totalSteps === 0) return undefined;

    const timer = setTimeout(() => {
      startOnboarding();
    }, 900);

    return () => clearTimeout(timer);
  }, [isActive, startOnboarding, totalSteps]);

  // Sport de l'utilisateur (étape « Quel est ton sport ? ») : le filtre serveur
  // attend un documentId, le profil ne stocke qu'un nom — on fait la jointure ici.
  const { data: activities } = useGetActivities();
  const preferredSport = userData?.preferredSport
    ? String(userData.preferredSport).trim()
    : '';
  const preferredActivity = useMemo(() => {
    if (!preferredSport || !Array.isArray(activities)) return null;
    return activities.find(
      (activity) => String(activity?.name || '').toLowerCase() === preferredSport.toLowerCase(),
    ) || null;
  }, [activities, preferredSport]);

  const nearbyGeohash = useMemo(() => {
    if (!userPosition) return undefined;
    return getGeohashForPointAndRadius(userPosition.lat, userPosition.lng, NEARBY_RADIUS_KM);
  }, [userPosition]);

  const sportActivityId = isSportChipActive ? preferredActivity?.documentId : undefined;

  const clubQueryParams = useMemo(() => ({
    activity: clubFilters?.activity || sportActivityId || undefined,
    geohash: clubFilters?.geohash || nearbyGeohash || undefined,
    includeMultisport: false,
    name: debouncedSearch || undefined,
    pageSize: 20,
  }), [
    clubFilters?.activity,
    clubFilters?.geohash,
    debouncedSearch,
    nearbyGeohash,
    sportActivityId,
  ]);

  const teamQueryParams = useMemo(() => ({
    clubId: selectedClubId,
    name: debouncedSearch || undefined,
    pageSize: 20,
  }), [debouncedSearch, selectedClubId]);

  const clubsQuery = useGetClubs(clubQueryParams, { enabled: isClubFlow });
  const teamsQuery = useGetTeams(teamQueryParams, { enabled: !isClubFlow });

  const activeQuery = isClubFlow ? clubsQuery : teamsQuery;
  const rawListData = useMemo(() => {
    const pages = activeQuery?.data?.pages || [];
    return pages.reduce((acc, page) => acc.concat(page?.data || []), []);
  }, [activeQuery?.data?.pages]);

  // Pertinence, jamais l'alphabet brut : quand la position est connue, la liste
  // est triée par distance croissante ; les clubs sans coordonnées restent en
  // fin de liste plutôt que de disparaître.
  const listData = useMemo(() => {
    if (!isClubFlow || !userPosition) return rawListData;
    return [...rawListData].sort((left, right) => {
      const leftDistance = getClubDistanceKm(userPosition, left);
      const rightDistance = getClubDistanceKm(userPosition, right);
      if (leftDistance === null && rightDistance === null) return 0;
      if (leftDistance === null) return 1;
      if (rightDistance === null) return -1;
      return leftDistance - rightDistance;
    });
  }, [isClubFlow, rawListData, userPosition]);

  const isInitialLoading = Boolean(activeQuery?.isLoading && listData.length === 0);
  const hasInitialError = Boolean(activeQuery?.error && listData.length === 0);

  const createNotFoundMutation = useMutation({
    mutationFn: createClubRequest,
    onError: (error) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t(
          'onboardingAffiliation.feedback.requestError',
          'Impossible d\'envoyer ta demande.',
        ),
      );
    },
    onSuccess: () => {
      setIsNotFoundModalVisible(false);
      setRequestedName('');
      setComment('');
      setCoachName('');
      setCoachContact('');
      Alert.alert(
        t('onboardingAffiliation.feedback.requestSentTitle', 'Demande envoyée'),
        t(
          'onboardingAffiliation.feedback.requestSentDescription',
          'Ta demande a été envoyée aux superadmins. Tu recevras une notification.',
        ),
        [{
          onPress: handleContinueLater,
          text: t('common.actions.ok', 'OK'),
        }],
        { cancelable: false },
      );
    },
  });

  const handleContinueLater = useCallback(() => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserAffiliationGuide);
    if (nextRoute) {
      navigation.navigate(nextRoute);
      return;
    }

    markOnboardingComplete(userData?.documentId);
    navigation.reset({
      index: 0,
      routes: [{ name: getPostOnboardingHomeRoute() }],
    });
  }, [getNextOnboardingRoute, getPostOnboardingHomeRoute, navigation, userData?.documentId]);

  // Header : bouton retour rond (headerBackImage de commonOptions, inchangé).
  //
  // D15 — cet écran rejoint la progression COMMUNE : la même barre continue que
  // les 12 autres étapes, et le compteur « n/N » de retour à l'écran. Le stepper
  // segmenté propre à cette étape a été supprimé ; le pack ne veut plus qu'UNE
  // seule progression, identique partout. « Passer » reste à droite, à côté du
  // compteur.
  const stepNumber = onboardingViews?.views
    ?.find((view) => view.route === RouteNames.UserAffiliationGuide)?.index || 0;
  const onboardingTotalViews = onboardingViews?.totalViews || 0;
  const skipLabel = t('onboardingAffiliation.actions.skip', 'Passer');
  const skipHint = t(
    'onboardingAffiliation.a11y.continueLaterHint',
    'Passe cette étape et continue l\'onboarding.',
  );

  useLayoutEffect(() => {
    if (typeof navigation?.setOptions !== 'function') return;
    const headerRight = (
      <View style={[Alignments.row, Alignments.alignCenter]}>
        {stepNumber > 0 && onboardingTotalViews > 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {`${stepNumber}/${onboardingTotalViews}`}
          </Text>
        ) : null}
        <AffiliationSkipLink hint={skipHint} label={skipLabel} onPress={handleContinueLater} />
      </View>
    );
    const stepper = (
      <Stepper currentStep={stepNumber} steps={onboardingTotalViews} />
    );
    navigation.setOptions({
      headerRight: asHeaderSlot(headerRight),
      headerTitle: asHeaderSlot(stepper),
    });
  }, [
    Alignments,
    Fonts,
    handleContinueLater,
    navigation,
    onboardingTotalViews,
    skipHint,
    skipLabel,
    stepNumber,
  ]);

  const handleSelectResult = useCallback((item) => {
    if (!item?.documentId) return;
    if (isClubFlow) {
      if (isStaffAffiliationFlow) {
        navigation.navigate(RouteNames.ClubStack, {
          params: {
            clubId: item.documentId,
            fromOnboardingAffiliation: true,
          },
          screen: RouteNames.Club,
        });
      } else {
        setSelectedClub(item);
        setSearchValue('');
        setDebouncedSearch('');
      }
      return;
    }

    navigation.navigate(RouteNames.TeamStack, {
      params: {
        fromOnboardingAffiliation: true,
        teamId: item.documentId,
      },
      screen: RouteNames.TeamDetails,
    });
  }, [isClubFlow, isStaffAffiliationFlow, navigation]);

  const handleResetSelectedClub = useCallback(() => {
    setSelectedClub(null);
    setSearchValue('');
    setDebouncedSearch('');
  }, []);

  const handleOpenNotFoundModal = useCallback(() => {
    setRequestedName(searchValue.trim());
    setIsNotFoundModalVisible(true);
  }, [searchValue]);

  // Coach/dirigeant qui ne trouve pas son club : ouverture du tunnel de création
  // self-service (ClubWizardName -> ... -> ClubWizardRecap, qui poste
  // /clubs/self-onboard). Le flux « demande d'aide » reste accessible en lien
  // discret (décision B4).
  const handleOpenClubWizard = useCallback(() => {
    navigation.navigate(RouteNames.ClubStack, {
      params: { entry: 'onboarding', initialName: searchValue.trim() },
      screen: RouteNames.ClubWizardName,
    });
  }, [navigation, searchValue]);

  const handleOpenClubFilters = useCallback(() => {
    navigation.navigate(RouteNames.ClubStack, {
      params: { fromOnboardingAffiliation: true },
      screen: RouteNames.ClubFilters,
    });
  }, [navigation]);

  // « Autour de moi ». requestCurrentSearchMapLocation ne lève jamais : refus,
  // absence de capteur ou web sans HTTPS renvoient null. On dégrade en
  // SUGGESTIONS au lieu de planter (contrainte web du handoff).
  const handleUseMyLocation = useCallback(async () => {
    if (userPosition) {
      setUserPosition(null);
      setGeoStatus('idle');
      return;
    }

    setGeoStatus('pending');
    const position = await requestCurrentSearchMapLocation();
    if (!position) {
      setGeoStatus('denied');
      return;
    }
    setUserPosition(position);
    setGeoStatus('granted');
  }, [userPosition]);

  const handleToggleSportChip = useCallback(() => {
    setIsSportChipActive((previous) => !previous);
  }, []);

  const handleSubmitNotFound = useCallback(() => {
    const normalizedName = requestedName.trim();
    if (!normalizedName) {
      Alert.alert(
        t('onboardingAffiliation.feedback.missingInfoTitle', 'Information manquante'),
        isClubFlow
          ? t(
            'onboardingAffiliation.feedback.missingInfoMessageClub',
            'Renseigne le nom du club recherche.',
          )
          : t(
            'onboardingAffiliation.feedback.missingInfoMessageTeam',
            "Renseigne le nom de l'équipe recherchée.",
          ),
      );
      return;
    }

    createNotFoundMutation.mutate({
      clubName: normalizedName,
      comment: comment.trim() || undefined,
      requestKind: isClubFlow ? 'club_not_found' : 'team_not_found',
      searchContext: {
        clubId: selectedClubId,
        currentQuery: searchValue.trim(),
        role: roleName,
        screen: RouteNames.UserAffiliationGuide,
        target: roleTargetLabel,
      },
      source: 'onboarding',
    });
  }, [
    comment,
    createNotFoundMutation,
    isClubFlow,
    requestedName,
    roleName,
    roleTargetLabel,
    selectedClubId,
    searchValue,
    t,
  ]);

  // C02 / décision D3 : le joueur a choisi un club sans aucune équipe. On envoie
  // au superadmin une demande team_not_found en glissant le nom + contact du
  // coach/dirigeant dans searchContext (les champs holder* restent ceux du joueur).
  const handleSubmitTeamNotCreated = useCallback(() => {
    const trimmedCoachName = coachName.trim();
    const trimmedCoachContact = coachContact.trim();
    if (!trimmedCoachName && !trimmedCoachContact) {
      Alert.alert(
        t('onboardingAffiliation.feedback.missingInfoTitle', 'Information manquante'),
        t(
          'onboardingAffiliation.teamNotCreated.missingCoach',
          'Renseigne au moins le nom ou le contact de ton coach pour qu\'on puisse l\'inviter.',
        ),
      );
      return;
    }

    createNotFoundMutation.mutate({
      clubName: selectedClub?.name
        || searchValue.trim()
        || t('onboardingAffiliation.teamNotCreated.unknownClub', 'Club sans équipe'),
      requestKind: 'team_not_found',
      searchContext: {
        clubId: selectedClubId,
        coachContact: trimmedCoachContact || undefined,
        coachName: trimmedCoachName || undefined,
        currentQuery: searchValue.trim(),
        reason: 'team_not_created',
        role: roleName,
        screen: RouteNames.UserAffiliationGuide,
        target: roleTargetLabel,
      },
      source: 'onboarding',
    });
  }, [
    coachContact,
    coachName,
    createNotFoundMutation,
    roleName,
    roleTargetLabel,
    searchValue,
    selectedClub,
    selectedClubId,
    t,
  ]);

  const handleEndReached = useCallback(() => {
    if (activeQuery?.hasNextPage && !activeQuery?.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [activeQuery]);

  const handleRetry = useCallback(() => {
    activeQuery?.refetch?.();
  }, [activeQuery]);

  // Les early-returns doivent rester APRÈS tous les hooks (règle des hooks React) :
  // sinon le nombre de hooks change entre les rendus quand le profil finit de charger.
  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de lancer l'affiliation."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  const modalFooter = (
    <View style={[Alignments.row, Spaces.gap[12]]}>
      <View style={{ flex: 1 }}>
        <Button
          accessibilityHint={t(
            'onboardingAffiliation.a11y.modalCancelHint',
            'Ferme la fenêtre de demande.',
          )}
          accessibilityLabel={t('common.actions.cancel', 'Annuler')}
          onPress={() => setIsNotFoundModalVisible(false)}
          title={t('common.actions.cancel', 'Annuler')}
          variant="Secondary"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Button
          accessibilityHint={t(
            'onboardingAffiliation.a11y.modalSendHint',
            'Envoie ta demande aux superadmins.',
          )}
          accessibilityLabel={t('onboardingAffiliation.modal.send', 'Envoyer')}
          isLoading={createNotFoundMutation.isPending}
          onPress={handleSubmitNotFound}
          title={t('onboardingAffiliation.modal.send', 'Envoyer')}
          variant="Primary"
        />
      </View>
    </View>
  );

  const tutorialResultIndex = listData.length > 1 ? 1 : 0;

  const renderClubCard = (item) => (
    <OnboardingClubCard
      accessibilityHint={isPlayerClubSelectionStep
        ? t(
          'onboardingAffiliation.a11y.cardHintClubSelect',
          'Sélectionne ce club pour voir ses équipes.',
        )
        : t(
          'onboardingAffiliation.a11y.cardHintClub',
          'Ouvre la fiche du club pour confirmer l\'affiliation.',
        )}
      accessibilityLabel={isPlayerClubSelectionStep
        ? t(
          'onboardingAffiliation.a11y.cardLabelClubSelect',
          'Sélectionner le club {{name}}',
          { name: item?.name || '-' },
        )
        : t(
          'onboardingAffiliation.a11y.cardLabelClub',
          'Ouvrir la fiche du club {{name}}',
          { name: item?.name || '-' },
        )}
      distanceKm={getClubDistanceKm(userPosition, item)}
      item={item}
      onPress={() => handleSelectResult(item)}
    />
  );

  // L'étape ÉQUIPE n'est pas couverte par le handoff 6b : elle garde sa rangée
  // actuelle. Seule l'étape CLUB reçoit la carte compacte.
  const renderTeamCard = (item) => (
    <TouchableOpacity
      accessibilityHint={t(
        'onboardingAffiliation.a11y.cardHintTeam',
        "Ouvre la fiche de l'équipe pour demander à rejoindre.",
      )}
      accessibilityLabel={t(
        'onboardingAffiliation.a11y.cardLabelTeam',
        "Ouvrir la fiche de l'équipe {{name}}",
        { name: item?.name || '-' },
      )}
      accessibilityRole="button"
      onPress={() => handleSelectResult(item)}
      style={[
        Spaces.padding[16],
        ApplicationStyle.borderRadius16,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.8),
          borderColor: withAlpha(Colors.primary500, 0.33),
          borderWidth: 1,
          minHeight: RESULT_CARD_MIN_HEIGHT,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <ClubLogoMark club={item?.club} name={item?.club?.name || item?.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
            {item?.name || '-'}
          </Text>
          <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[4]]}>
            {getTeamCardMeta(
              item,
              t('onboardingAffiliation.results.openTeamFallback', 'Voir fiche équipe'),
            )}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCard = ({ index, item }) => {
    const card = isClubFlow ? renderClubCard(item) : renderTeamCard(item);

    if (index !== tutorialResultIndex) {
      return <View style={styles.listItem}>{card}</View>;
    }

    // Ancre du tour guidé (order 2) : elle enveloppe toujours une carte de
    // résultat, comme avant la refonte.
    return (
      <AffiliationTutorialStep
        description={(() => {
          if (!isClubFlow) {
            return t(
              'onboardingAffiliation.tutorial.stepResultDescriptionTeam',
              'Ouvre la fiche de l\'équipe pour envoyer ta demande de rejoindre.',
            );
          }
          if (isPlayerClubSelectionStep) {
            return t(
              'onboardingAffiliation.tutorial.stepResultDescriptionClubSelect',
              'Sélectionne ton club pour afficher ensuite ses équipes.',
            );
          }
          return t(
            'onboardingAffiliation.tutorial.stepResultDescriptionClub',
            'Ouvre la fiche du club pour le rejoindre ou le revendiquer.',
          );
        })()}
        id={`${roleTargetLabel}-result-item`}
        order={2}
        spotlight={{
          borderRadius: 18,
          overlayOpacity: 0.42,
          paddingX: 2,
          paddingY: 3,
        }}
        style={styles.listItem}
        title={isClubFlow
          ? t('onboardingAffiliation.tutorial.stepResultTitleClub', 'Sélectionner un club')
          : t('onboardingAffiliation.tutorial.stepResultTitleTeam', 'Sélectionner une équipe')}
      >
        {card}
      </AffiliationTutorialStep>
    );
  };

  const loadingState = (
    <View style={[Spaces.gap[12], Spaces.paddingTop[8]]}>
      <Text style={[Fonts.p2, Fonts.neutral300]}>
        {t('onboardingAffiliation.states.loading', 'Recherche en cours...')}
      </Text>
      {SKELETON_PLACEHOLDER_KEYS.slice(0, SKELETON_RESULT_COUNT).map((placeholderKey) => (
        <View
          key={`skeleton-${placeholderKey}`}
          style={[
            Spaces.padding[16],
            ApplicationStyle.borderRadius16,
            {
              backgroundColor: withAlpha(Colors.primary700, 0.53),
              borderColor: withAlpha(Colors.primary500, 0.27),
              borderWidth: 1,
              minHeight: RESULT_CARD_MIN_HEIGHT,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <View
              style={{
                backgroundColor: withAlpha(Colors.neutral300, 0.4),
                borderRadius: 12,
                height: 44,
                width: 44,
              }}
            />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  backgroundColor: withAlpha(Colors.neutral200, 0.4),
                  borderRadius: 8,
                  height: 16,
                  marginBottom: 8,
                  width: '70%',
                }}
              />
              <View
                style={{
                  backgroundColor: withAlpha(Colors.neutral300, 0.33),
                  borderRadius: 8,
                  height: 12,
                  width: '45%',
                }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const errorState = (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: withAlpha(Colors.error700, 0.13),
          borderColor: withAlpha(Colors.error700, 0.67),
        },
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t(
          'onboardingAffiliation.states.errorTitle',
          'Impossible de charger les résultats',
        )}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {activeQuery?.error?.message
          || t('onboardingAffiliation.states.errorSubtitle', 'Vérifie ta connexion puis réessaie.')}
      </Text>
      <View style={{ width: 140 }}>
        <Button
          accessibilityHint={t(
            'onboardingAffiliation.a11y.retryHint',
            'Relance la recherche de résultats.',
          )}
          accessibilityLabel={t('onboardingAffiliation.states.retry', 'Réessayer')}
          onPress={handleRetry}
          size="sm"
          title={t('onboardingAffiliation.states.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    </View>
  );

  const emptyMessage = (() => {
    if (debouncedSearch) {
      if (isClubFlow) {
        return t(
          'onboardingAffiliation.states.emptyWithQueryClub',
          'Aucun club trouvé pour "{{query}}".',
          { query: debouncedSearch },
        );
      }
      return t(
        'onboardingAffiliation.states.emptyWithQueryTeam',
        'Aucune équipe trouvée pour "{{query}}".',
        { query: debouncedSearch },
      );
    }
    if (isClubFlow) {
      return t('onboardingAffiliation.states.emptyWithoutQueryClub', 'Aucun club à afficher pour le moment.');
    }
    return t('onboardingAffiliation.states.emptyWithoutQueryTeam', 'Aucune équipe à afficher pour le moment.');
  })();

  // C02 / décision D3 : joueur ayant sélectionné un club qui n'a AUCUNE équipe
  // (liste vide sans recherche active). On remplace le message vide par un bloc
  // explicite + formulaire coach optionnel.
  const isPlayerTeamStepWithoutTeams = !isClubFlow
    && Boolean(selectedClub)
    && !debouncedSearch;

  const teamNotCreatedBlock = (
    <View style={[Spaces.gap[16], Spaces.paddingTop[8]]}>
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: withAlpha(Colors.primary700, 0.8),
            borderColor: withAlpha(Colors.primary500, 0.33),
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t(
            'onboardingAffiliation.teamNotCreated.title',
            'Ce club n\'a pas encore d\'équipe sur FoundClub',
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'onboardingAffiliation.teamNotCreated.description',
            'Tu ne peux pas encore rejoindre : ce sera possible dès que le club ou ton coach aura créé l\'équipe sur FoundClub. Laisse le contact de ton coach ou dirigeant, on l\'invite à la créer.',
          )}
        </Text>
      </View>

      <Input
        accessibilityHint={t(
          'onboardingAffiliation.teamNotCreated.coachNameHint',
          'Indique le nom de ton coach ou dirigeant.',
        )}
        accessibilityLabel={t(
          'onboardingAffiliation.teamNotCreated.coachNameLabel',
          'Nom de ton coach ou dirigeant',
        )}
        label={t(
          'onboardingAffiliation.teamNotCreated.coachNameLabel',
          'Nom de ton coach ou dirigeant',
        )}
        onChangeText={setCoachName}
        placeholder={t(
          'onboardingAffiliation.teamNotCreated.coachNamePlaceholder',
          'Ex: Karim Benali',
        )}
        value={coachName}
      />

      <Input
        accessibilityHint={t(
          'onboardingAffiliation.teamNotCreated.coachContactHint',
          'Indique un téléphone ou un e-mail pour joindre ton coach.',
        )}
        accessibilityLabel={t(
          'onboardingAffiliation.teamNotCreated.coachContactLabel',
          'Contact du coach (téléphone ou e-mail)',
        )}
        label={t(
          'onboardingAffiliation.teamNotCreated.coachContactLabel',
          'Contact du coach (téléphone ou e-mail)',
        )}
        onChangeText={setCoachContact}
        placeholder={t(
          'onboardingAffiliation.teamNotCreated.coachContactPlaceholder',
          'Ex: 06 12 34 56 78 ou coach@club.fr',
        )}
        value={coachContact}
      />

      <Button
        accessibilityHint={t(
          'onboardingAffiliation.teamNotCreated.sendHint',
          'Envoie le contact de ton coach aux superadmins FoundClub.',
        )}
        accessibilityLabel={t('onboardingAffiliation.teamNotCreated.send', 'Envoyer au club')}
        isLoading={createNotFoundMutation.isPending}
        onPress={handleSubmitTeamNotCreated}
        title={t('onboardingAffiliation.teamNotCreated.send', 'Envoyer au club')}
        variant="Primary"
      />
    </View>
  );

  const screenTitle = isClubFlow
    ? t('onboardingAffiliation.titleClub', 'Trouve ton club')
    : t('onboardingAffiliation.titleTeam', 'Trouve ton équipe');

  // Sous-titre BÉNÉFICE (il remplace le disclaimer « cette étape n'est pas
  // obligatoire » : le caractère optionnel est désormais porté par « Passer »).
  const screenSubtitle = (() => {
    if (!isClubFlow) {
      return t(
        'onboardingAffiliation.subtitleTeamFromClub',
        'Recherche ton équipe dans le club sélectionné puis ouvre sa fiche pour envoyer ta demande.',
      );
    }
    if (isStaffAffiliationFlow) {
      return t(
        'onboardingAffiliation.subtitleClubStaff',
        'Retrouve ton club pour le gérer sur FoundClub.',
      );
    }
    return t(
      'onboardingAffiliation.subtitleClub',
      'On personnalise ton accueil, ton planning et tes annonces autour de ton club.',
    );
  })();

  const sectionLabel = (() => {
    if (!isClubFlow) return t('onboardingAffiliation.sections.teams', 'ÉQUIPES');
    if (debouncedSearch) return t('onboardingAffiliation.sections.results', 'RÉSULTATS');
    if (userPosition) return t('onboardingAffiliation.sections.nearby', 'PRÈS DE CHEZ TOI');
    return t('onboardingAffiliation.sections.suggestions', 'SUGGESTIONS');
  })();

  const searchField = (
    <AffiliationTutorialStep
      description={t(
        'onboardingAffiliation.tutorial.stepSearchDescription',
        `Tape le nom du ${roleTargetLabel} pour filtrer la liste.`,
        { roleTargetLabel },
      )}
      id="affiliation-search-input"
      order={1}
      spotlight={{
        borderRadius: 14,
        overlayOpacity: 0.4,
        paddingX: 1,
        paddingY: 1,
      }}
      title={t('onboardingAffiliation.tutorial.stepSearchTitle', 'Recherche')}
    >
      <View
        style={[styles.searchField, { borderColor: withAlpha(Colors.neutral00, 0.35) }]}
        testID={AFFILIATION_TEST_IDS.search}
      >
        <View style={{ flex: 1 }}>
          <Input
            accessibilityHint={isClubFlow
              ? t(
                'onboardingAffiliation.a11y.searchInputHintClub',
                'Saisis le nom du club pour filtrer la liste.',
              )
              : t(
                'onboardingAffiliation.a11y.searchInputHintTeam',
                "Saisis le nom de l'équipe pour filtrer la liste.",
              )}
            accessibilityLabel={isClubFlow
              ? t('onboardingAffiliation.a11y.searchInputLabelClub', 'Champ nom du club')
              : t('onboardingAffiliation.a11y.searchInputLabelTeam', "Champ nom de l'équipe")}
            density="compact"
            icon="search"
            iconStyle={{ tintColor: Colors.neutral300 }}
            lightMode
            onChangeText={setSearchValue}
            placeholder={isClubFlow
              ? t('onboardingAffiliation.search.placeholderClub', 'Nom du club ou ville')
              : t('onboardingAffiliation.search.placeholderTeam', "Nom de l'équipe")}
            value={searchValue}
          />
        </View>

        {isClubFlow ? (
          <AffiliationTutorialStep
            description={t(
              'onboardingAffiliation.tutorial.stepFiltersDescription',
              'On va maintenant ouvrir les filtres pour affiner ta recherche.',
            )}
            id="affiliation-open-filters-action"
            order={4}
            spotlight={{
              borderRadius: 14,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            title={t(
              'onboardingAffiliation.tutorial.stepFiltersTitle',
              'Ouvrir les filtres',
            )}
          >
            <TouchableOpacity
              accessibilityHint={t(
                'onboardingAffiliation.a11y.filterHint',
                'Ouvre les filtres de recherche de club.',
              )}
              accessibilityLabel={t(
                'onboardingAffiliation.a11y.filterLabel',
                'Ouvrir les filtres',
              )}
              accessibilityRole="button"
              hitSlop={ApplicationStyle.hitSlop?.min44From32}
              onPress={handleOpenClubFilters}
              style={styles.filterButton}
            >
              <Image
                source={Images.filter}
                style={[styles.filterIcon, { tintColor: Colors.primary500 }]}
              />
              {clubFiltersCount > 0 ? (
                <View style={[styles.filterBadge, { backgroundColor: Colors.primary500 }]}>
                  <Text style={[styles.filterBadgeText, { color: Colors.primary900 }]}>
                    {clubFiltersCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </AffiliationTutorialStep>
        ) : null}
      </View>
    </AffiliationTutorialStep>
  );

  const isNearbyActive = Boolean(userPosition);
  const quickChips = (
    <View style={styles.chipsRow}>
      <TouchableOpacity
        accessibilityHint={t(
          'onboardingAffiliation.a11y.nearbyHint',
          'Autorise la localisation pour classer les clubs par distance.',
        )}
        accessibilityLabel={t('onboardingAffiliation.chips.nearby', 'Autour de moi')}
        accessibilityRole="button"
        accessibilityState={{ selected: isNearbyActive }}
        disabled={geoStatus === 'pending'}
        onPress={handleUseMyLocation}
        style={[
          styles.chip,
          {
            backgroundColor: withAlpha(Colors.primary500, isNearbyActive ? 0.24 : 0.14),
            borderColor: withAlpha(Colors.primary500, 0.4),
          },
        ]}
      >
        {geoStatus === 'pending' ? (
          <ActivityIndicator color={Colors.primary500} size="small" />
        ) : (
          <Image source={Images.pin} style={[styles.chipIcon, { tintColor: Colors.primary500 }]} />
        )}
        <Text style={[styles.chipText, { color: Colors.primary500 }]}>
          {t('onboardingAffiliation.chips.nearby', 'Autour de moi')}
        </Text>
      </TouchableOpacity>

      {preferredSport ? (
        <TouchableOpacity
          accessibilityHint={t(
            'onboardingAffiliation.a11y.sportChipHint',
            'Filtre la liste sur ton sport.',
          )}
          accessibilityLabel={preferredSport}
          accessibilityRole="button"
          accessibilityState={{ selected: isSportChipActive }}
          onPress={handleToggleSportChip}
          style={[
            styles.chip,
            {
              backgroundColor: withAlpha(Colors.neutral00, isSportChipActive ? 0.16 : 0.08),
              borderColor: withAlpha(Colors.neutral00, 0.16),
            },
          ]}
        >
          <Text style={[styles.chipText, { color: Colors.neutral100 }]}>{preferredSport}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // Ancre du tour guidé (order 3) : elle enveloppait le bouton « Je ne trouve
  // pas mon club » du pied de page ; elle enveloppe désormais la carte en
  // pointillés de fin de liste, qui est la MÊME cible (signaler un club absent).
  const addMyClubCard = (
    <AffiliationTutorialStep
      description={isClubFlow
        ? t(
          'onboardingAffiliation.tutorial.stepNotFoundDescriptionClub',
          'Si tu ne trouves pas ton club, envoie une demande guidée aux superadmins.',
        )
        : t(
          'onboardingAffiliation.tutorial.stepNotFoundDescriptionTeam',
          'Si tu ne trouves pas ton équipe, envoie une demande guidée aux superadmins.',
        )}
      id="affiliation-not-found-action"
      order={3}
      spotlight={{
        borderRadius: 16,
        overlayOpacity: 0.4,
        paddingX: 2,
        paddingY: 3,
      }}
      title={isClubFlow
        ? t('onboardingAffiliation.tutorial.stepNotFoundTitleClub', 'Je ne trouve pas mon club')
        : t('onboardingAffiliation.tutorial.stepNotFoundTitleTeam', 'Je ne trouve pas mon équipe')}
    >
      <View testID={AFFILIATION_TEST_IDS.notFound}>
        <TouchableOpacity
          accessibilityHint={isClubFlow
            ? t(
              'onboardingAffiliation.a11y.notFoundHintClub',
              'Envoie une demande d\'aide si ton club est introuvable.',
            )
            : t(
              'onboardingAffiliation.a11y.notFoundHintTeam',
              'Envoie une demande d\'aide si ton équipe est introuvable.',
            )}
          accessibilityLabel={isClubFlow
            ? t('onboardingAffiliation.actions.notFoundClub', 'Je ne trouve pas mon club')
            : t('onboardingAffiliation.actions.notFoundTeam', 'Je ne trouve pas mon équipe')}
          accessibilityRole="button"
          onPress={isStaffAffiliationFlow ? handleOpenClubWizard : handleOpenNotFoundModal}
          style={[styles.addCard, { borderColor: withAlpha(Colors.primary500, 0.45) }]}
        >
          <View
            style={[
              styles.addIconBox,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.12),
                borderColor: withAlpha(Colors.primary500, 0.4),
              },
            ]}
          >
            <Image
              source={Images.plus}
              style={[styles.addIcon, { tintColor: Colors.primary500 }]}
            />
          </View>
          <View style={styles.addTextBox}>
            <Text style={[styles.addTitle, { color: Colors.neutral00 }]}>
              {isClubFlow
                ? t('onboardingAffiliation.addClub.title', 'Ton club n\'est pas là ?')
                : t('onboardingAffiliation.addTeam.title', 'Ton équipe n\'est pas là ?')}
            </Text>
            <Text style={[styles.addSubtitle, { color: Colors.neutral300 }]}>
              {isClubFlow
                ? t(
                  'onboardingAffiliation.addClub.subtitle',
                  'Ajoute-le en 2 minutes, on s\'occupe du reste.',
                )
                : t(
                  'onboardingAffiliation.addTeam.subtitle',
                  'Signale-la, on s\'occupe du reste.',
                )}
            </Text>
          </View>
          <Text style={[styles.addAction, { color: Colors.primary500 }]}>
            {t('onboardingAffiliation.addClub.action', 'Ajouter')}
          </Text>
        </TouchableOpacity>
      </View>
    </AffiliationTutorialStep>
  );

  // D2 — la zone RÉSULTATS était écrasée sur iPhone. ScreenContainer pose
  // TOUJOURS un plancher `insets.bottom` (mode `none` ; sa documentation le dit
  // lignes 26-32), et cet écran applique DE NOUVEAU `insets.bottom + 8` sur son
  // lien d'aide plus bas : le retrait système était compté deux fois. La zone de
  // résultats étant le seul enfant élastique de la colonne, c'est elle — et elle
  // seule — qui payait les ~34 pt perdus. Sur Android `insets.bottom` vaut le
  // plus souvent 0, d'où un symptôme visible uniquement sur iPhone.
  // `edge-to-edge` est le mode que le conteneur prévoit exactement pour ça :
  // « les écrans qui appliquent déjà eux-mêmes insets.bottom à leur contenu ».
  return (
    <FormScreenContainer
      bgImage="bg2"
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        Alignments.fill,
      ]}
      contentWidth="wide"
    >
      <View style={[Alignments.fill, styles.screenColumn]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {screenTitle}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, styles.subtitle]}>
            {screenSubtitle}
          </Text>
        </View>

        {!isClubFlow && selectedClub ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[12],
              Alignments.rowBetween,
              Alignments.alignCenter,
              Spaces.gap[12],
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t('onboardingAffiliation.selectedClubLabel', 'Club sélectionné')}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {selectedClub.name || '-'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleResetSelectedClub}
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                ApplicationStyle.borderRadius16,
                {
                  borderColor: withAlpha(Colors.primary500, 0.6),
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('onboardingAffiliation.actions.changeClub', 'Changer de club')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {searchField}

        {isClubFlow ? quickChips : null}

        <Text style={[styles.sectionLabel, { color: Colors.neutral500 }]}>
          {sectionLabel}
        </Text>

        <View style={[Alignments.fill]}>
          {isInitialLoading ? loadingState : null}

          {hasInitialError ? errorState : null}

          {!isInitialLoading && !hasInitialError ? (
            <FlatList
              data={listData}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item, index) => String(item?.documentId || item?.id || index)}
              ListEmptyComponent={isPlayerTeamStepWithoutTeams ? teamNotCreatedBlock : (
                <View style={[Spaces.paddingVertical[16], Alignments.alignCenter]}>
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {emptyMessage}
                  </Text>
                </View>
              )}
              ListFooterComponent={(
                <View style={styles.listFooter}>
                  {activeQuery?.isFetchingNextPage ? (
                    <View style={[Spaces.paddingVertical[16], Alignments.alignCenter]}>
                      <ActivityIndicator color={Colors.primary500} size="small" />
                    </View>
                  ) : null}
                  {isPlayerTeamStepWithoutTeams ? null : addMyClubCard}
                </View>
              )}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              onRefresh={handleRetry}
              refreshing={Boolean(activeQuery?.isRefetching && !activeQuery?.isFetchingNextPage)}
              renderItem={renderCard}
              showsVerticalScrollIndicator={false}
            />
          ) : null}
        </View>

        <TouchableOpacity
          accessibilityHint={t(
            'onboardingAffiliation.a11y.askForHelpHint',
            'Envoie une demande aux superadmins FoundClub.',
          )}
          accessibilityLabel={t('onboardingAffiliation.actions.askForHelp', 'Besoin d\'aide ? Nous contacter')}
          accessibilityRole="button"
          onPress={handleOpenNotFoundModal}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Text style={[styles.helpLine, { color: Colors.neutral300 }]}>
            {t('onboardingAffiliation.actions.askForHelp', 'Besoin d\'aide ? Nous contacter')}
          </Text>
        </TouchableOpacity>
      </View>

      <BottomModal
        close={() => setIsNotFoundModalVisible(false)}
        footerComponent={modalFooter}
        isVisible={isNotFoundModalVisible}
        snapPoints={['66%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingTop[24]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {isClubFlow
              ? t('onboardingAffiliation.modal.titleClub', 'Je ne trouve pas mon club')
              : t('onboardingAffiliation.modal.titleTeam', 'Je ne trouve pas mon équipe')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'onboardingAffiliation.modal.description',
              'Donne un maximum de contexte pour aider les superadmins.',
            )}
          </Text>
          <Input
            accessibilityHint={isClubFlow
              ? t(
                'onboardingAffiliation.a11y.modalNameHintClub',
                'Renseigne le nom du club que tu recherches.',
              )
              : t(
                'onboardingAffiliation.a11y.modalNameHintTeam',
                "Renseigne le nom de l'équipe que tu recherches.",
              )}
            accessibilityLabel={isClubFlow
              ? t('onboardingAffiliation.modal.nameLabelClub', 'Nom du club recherché *')
              : t('onboardingAffiliation.modal.nameLabelTeam', "Nom de l'équipe recherchée *")}
            label={isClubFlow
              ? t('onboardingAffiliation.modal.nameLabelClub', 'Nom du club recherché *')
              : t('onboardingAffiliation.modal.nameLabelTeam', "Nom de l'équipe recherchée *")}
            onChangeText={setRequestedName}
            placeholder={isClubFlow
              ? t('onboardingAffiliation.modal.namePlaceholderClub', 'Ex: Olympique ...')
              : t('onboardingAffiliation.modal.namePlaceholderTeam', 'Ex: U17 Nationaux ...')}
            value={requestedName}
          />
          <Input
            accessibilityHint={t(
              'onboardingAffiliation.a11y.modalCommentHint',
              'Ajoute des informations utiles à la recherche.',
            )}
            accessibilityLabel={t('onboardingAffiliation.modal.commentLabel', 'Commentaire (optionnel)')}
            label={t('onboardingAffiliation.modal.commentLabel', 'Commentaire (optionnel)')}
            multiline
            numberOfLines={4}
            onChangeText={setComment}
            placeholder={t(
              'onboardingAffiliation.modal.commentPlaceholder',
              'Ex: ville, catégorie, orthographe probable...',
            )}
            textAlignVertical="top"
            value={comment}
          />
        </View>
      </BottomModal>

      {ENABLE_AFFILIATION_ONBOARDING_TUTORIAL ? <OnboardingOverlay /> : null}
    </FormScreenContainer>
  );
}

const styles = StyleSheet.create({
  addAction: {
    flexShrink: 0,
    fontFamily: 'Montserrat-Bold',
    fontSize: 12.5,
    fontWeight: '800',
  },
  addCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  addIcon: {
    height: 18,
    resizeMode: 'contain',
    width: 18,
  },
  addIconBox: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  addSubtitle: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    fontWeight: '500',
  },
  addTextBox: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  addTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: '800',
  },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipIcon: {
    height: 13,
    resizeMode: 'contain',
    width: 13,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    fontWeight: '700',
  },
  filterBadge: {
    alignItems: 'center',
    borderRadius: 32,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  filterBadgeText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    fontWeight: '800',
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterIcon: {
    height: 18,
    resizeMode: 'contain',
    width: 18,
  },
  helpLine: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12.5,
    textAlign: 'center',
  },
  listFooter: {
    paddingTop: 4,
  },
  listItem: {
    marginBottom: 10,
  },
  screenColumn: {
    gap: 14,
  },
  searchField: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    height: 48,
    paddingRight: 4,
  },
  sectionLabel: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  skipLabel: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    lineHeight: 20,
  },
});

/**
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function UserAffiliationGuide({ navigation }) {
  const { userData } = useAuth();
  const flowId = `${AFFILIATION_TUTORIAL_FLOW_PREFIX}:${userData?.documentId || 'anonymous'}`;

  return (
    <OnboardingProvider flowId={flowId}>
      <UserAffiliationGuideContent navigation={navigation} />
    </OnboardingProvider>
  );
}

export default UserAffiliationGuide;
