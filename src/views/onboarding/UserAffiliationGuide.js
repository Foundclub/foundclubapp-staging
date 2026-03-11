import { useMutation } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  markOnboardingComplete,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';
import { createClubRequest } from '@/services/clubRequest/clubRequestService';
import { useGetTeams } from '@/services/team/teamQueries';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';

const DEBOUNCE_MS = 300;
const RESULT_CARD_MIN_HEIGHT = 96;
const SKELETON_RESULT_COUNT = 3;
const SKELETON_PLACEHOLDER_KEYS = ['one', 'two', 'three'];
const AFFILIATION_TUTORIAL_FLOW_PREFIX = 'onboarding-affiliation-v2';

const getClubCardMeta = (item, fallbackLabel) => {
  const city = item?.city || item?.addressDetails?.city;
  const firstActivity = Array.isArray(item?.activites) ? item.activites[0]?.name : undefined;
  return [city, firstActivity].filter(Boolean).join(' - ') || fallbackLabel;
};

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
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    userData,
  } = useAuth();
  const [{ clubFilters }] = useAppContext();
  const { getClubFiltersNumber } = useClub();
  const { isActive, startOnboarding, totalSteps } = useOnboarding();

  const roleName = userData?.role?.name;
  const isStaffAffiliationFlow = roleName === USER_ROLES.coach || roleName === USER_ROLES.president;
  const isPlayerAffiliationFlow = roleName === USER_ROLES.player;

  const [selectedClub, setSelectedClub] = useState(null);
  const isClubFlow = isStaffAffiliationFlow || (isPlayerAffiliationFlow && !selectedClub?.documentId);
  const isPlayerClubSelectionStep = isClubFlow && !isStaffAffiliationFlow;
  const roleTargetLabel = isClubFlow
    ? t('onboardingAffiliation.common.roleTargetClub', 'club')
    : t('onboardingAffiliation.common.roleTargetTeam', 'equipe');
  const selectedClubId = selectedClub?.documentId || undefined;
  const clubFiltersCount = getClubFiltersNumber(clubFilters);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isNotFoundModalVisible, setIsNotFoundModalVisible] = useState(false);
  const [requestedName, setRequestedName] = useState('');
  const [comment, setComment] = useState('');
  const [footerHeight, setFooterHeight] = useState(0);

  const stickyFooterInset = (footerHeight || 156) + 12;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (isActive || totalSteps === 0) return undefined;

    const timer = setTimeout(() => {
      startOnboarding();
    }, 900);

    return () => clearTimeout(timer);
  }, [isActive, startOnboarding, totalSteps]);

  const clubQueryParams = useMemo(() => ({
    activity: clubFilters?.activity || undefined,
    geohash: clubFilters?.geohash || undefined,
    includeMultisport: false,
    name: debouncedSearch || undefined,
    pageSize: 20,
  }), [clubFilters?.activity, clubFilters?.geohash, debouncedSearch]);

  const teamQueryParams = useMemo(() => ({
    clubId: selectedClubId,
    name: debouncedSearch || undefined,
    pageSize: 20,
  }), [debouncedSearch, selectedClubId]);

  const clubsQuery = useGetClubs(clubQueryParams, { enabled: isClubFlow });
  const teamsQuery = useGetTeams(teamQueryParams, { enabled: !isClubFlow });

  const activeQuery = isClubFlow ? clubsQuery : teamsQuery;
  const listData = useMemo(() => {
    const pages = activeQuery?.data?.pages || [];
    return pages.reduce((acc, page) => acc.concat(page?.data || []), []);
  }, [activeQuery?.data?.pages]);

  const isInitialLoading = Boolean(activeQuery?.isLoading && listData.length === 0);
  const hasInitialError = Boolean(activeQuery?.error && listData.length === 0);

  const createNotFoundMutation = useMutation({
    mutationFn: createClubRequest,
    onError: (error) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t(
          'onboardingAffiliation.feedback.requestError',
          'Impossible d envoyer votre demande.',
        ),
      );
    },
    onSuccess: () => {
      Alert.alert(
        t('onboardingAffiliation.feedback.requestSentTitle', 'Demande envoyee'),
        t(
          'onboardingAffiliation.feedback.requestSentDescription',
          'Votre demande a ete envoyee aux superadmins. Vous recevrez une notification.',
        ),
      );
      setIsNotFoundModalVisible(false);
      setComment('');
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
      params: { teamId: item.documentId },
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

  const handleOpenClubFilters = useCallback(() => {
    navigation.navigate(RouteNames.ClubStack, {
      params: { fromOnboardingAffiliation: true },
      screen: RouteNames.ClubFilters,
    });
  }, [navigation]);

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
            'Renseigne le nom de l equipe recherchee.',
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

  const handleEndReached = useCallback(() => {
    if (activeQuery?.hasNextPage && !activeQuery?.isFetchingNextPage) {
      activeQuery.fetchNextPage();
    }
  }, [activeQuery]);

  const handleRetry = useCallback(() => {
    activeQuery?.refetch?.();
  }, [activeQuery]);

  const handleFooterLayout = useCallback((event) => {
    const nextHeight = Math.ceil(event?.nativeEvent?.layout?.height || 0);
    setFooterHeight((prevHeight) => (prevHeight === nextHeight ? prevHeight : nextHeight));
  }, []);

  const modalFooter = (
    <View style={[Alignments.row, Spaces.gap[12]]}>
      <View style={{ flex: 1 }}>
        <Button
          accessibilityHint={t(
            'onboardingAffiliation.a11y.modalCancelHint',
            'Ferme la fenetre de demande.',
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

  const renderCard = ({ index, item }) => {
    const wrapperId = `${roleTargetLabel}-result-item`;
    const cardLogoUrl = isClubFlow ? item?.logo?.url : item?.club?.logo?.url;
    const cardName = item?.name || '-';
    const cardMeta = isClubFlow
      ? getClubCardMeta(
        item,
        t('onboardingAffiliation.results.openClubFallback', 'Voir fiche club'),
      )
      : getTeamCardMeta(
        item,
        t('onboardingAffiliation.results.openTeamFallback', 'Voir fiche equipe'),
      );
    const cardAccessibilityHint = (() => {
      if (!isClubFlow) {
        return t(
          'onboardingAffiliation.a11y.cardHintTeam',
          'Ouvre la fiche de l equipe pour demander a rejoindre.',
        );
      }
      if (isPlayerClubSelectionStep) {
        return t(
          'onboardingAffiliation.a11y.cardHintClubSelect',
          'Selectionne ce club pour voir ses equipes.',
        );
      }
      return t(
        'onboardingAffiliation.a11y.cardHintClub',
        'Ouvre la fiche du club pour confirmer l affiliation.',
      );
    })();
    const cardAccessibilityLabel = (() => {
      if (!isClubFlow) {
        return t(
          'onboardingAffiliation.a11y.cardLabelTeam',
          'Ouvrir la fiche de l equipe {{name}}',
          { name: cardName },
        );
      }
      if (isPlayerClubSelectionStep) {
        return t(
          'onboardingAffiliation.a11y.cardLabelClubSelect',
          'Selectionner le club {{name}}',
          { name: cardName },
        );
      }
      return t(
        'onboardingAffiliation.a11y.cardLabelClub',
        'Ouvrir la fiche du club {{name}}',
        { name: cardName },
      );
    })();
    const resultTutorialDescription = (() => {
      if (!isClubFlow) {
        return t(
          'onboardingAffiliation.tutorial.stepResultDescriptionTeam',
          'Ouvre la fiche equipe pour envoyer ta demande de rejoindre.',
        );
      }
      if (isPlayerClubSelectionStep) {
        return t(
          'onboardingAffiliation.tutorial.stepResultDescriptionClubSelect',
          'Selectionne ton club pour afficher ensuite ses equipes.',
        );
      }
      return t(
        'onboardingAffiliation.tutorial.stepResultDescriptionClub',
        'Ouvre la fiche du club pour utiliser le bouton C est mon club.',
      );
    })();
    const resultTutorialTitle = isClubFlow
      ? t('onboardingAffiliation.tutorial.stepResultTitleClub', 'Selectionner un club')
      : t('onboardingAffiliation.tutorial.stepResultTitleTeam', 'Selectionner une equipe');

    const cardButton = (
      <TouchableOpacity
        accessibilityHint={cardAccessibilityHint}
        accessibilityLabel={cardAccessibilityLabel}
        accessibilityRole="button"
        onPress={() => handleSelectResult(item)}
        style={[
          Spaces.padding[16],
          ApplicationStyle.borderRadius16,
          {
            backgroundColor: `${Colors.primary700}CC`,
            borderColor: `${Colors.primary500}55`,
            borderWidth: 1,
            minHeight: RESULT_CARD_MIN_HEIGHT,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          {cardLogoUrl ? (
            <ProfileAvatar imageUrl={cardLogoUrl} size={52} />
          ) : (
            <TeamShield
              initials={String(cardName).slice(0, 2).toUpperCase()}
              isSmall
              size={52}
            />
          )}

          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
              {cardName}
            </Text>
            <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[4]]}>
              {cardMeta}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );

    if (index !== tutorialResultIndex) {
      return (
        <View style={Spaces.marginBottom[12]}>
          {cardButton}
        </View>
      );
    }

    return (
      <OnboardingWrapper
        description={resultTutorialDescription}
        id={wrapperId}
        order={2}
        spotlight={{
          borderRadius: 18,
          overlayOpacity: 0.42,
          paddingX: 2,
          paddingY: 3,
        }}
        style={Spaces.marginBottom[12]}
        title={resultTutorialTitle}
      >
        {cardButton}
      </OnboardingWrapper>
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
              backgroundColor: `${Colors.primary700}88`,
              borderColor: `${Colors.primary500}44`,
              borderWidth: 1,
              minHeight: RESULT_CARD_MIN_HEIGHT,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <View
              style={{
                backgroundColor: `${Colors.neutral300}66`,
                borderRadius: 26,
                height: 52,
                width: 52,
              }}
            />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  backgroundColor: `${Colors.neutral200}66`,
                  borderRadius: 8,
                  height: 16,
                  marginBottom: 8,
                  width: '70%',
                }}
              />
              <View
                style={{
                  backgroundColor: `${Colors.neutral300}55`,
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
          backgroundColor: `${Colors.error700}22`,
          borderColor: `${Colors.error700}AA`,
        },
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t(
          'onboardingAffiliation.states.errorTitle',
          'Impossible de charger les resultats',
        )}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {activeQuery?.error?.message
          || t('onboardingAffiliation.states.errorSubtitle', 'Verifie ta connexion puis reessaie.')}
      </Text>
      <View style={{ width: 140 }}>
        <Button
          accessibilityHint={t(
            'onboardingAffiliation.a11y.retryHint',
            'Relance la recherche de resultats.',
          )}
          accessibilityLabel={t('onboardingAffiliation.states.retry', 'Reessayer')}
          onPress={handleRetry}
          size="sm"
          title={t('onboardingAffiliation.states.retry', 'Reessayer')}
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
          'Aucun club trouve pour "{{query}}".',
          { query: debouncedSearch },
        );
      }
      return t(
        'onboardingAffiliation.states.emptyWithQueryTeam',
        'Aucune equipe trouvee pour "{{query}}".',
        { query: debouncedSearch },
      );
    }
    if (isClubFlow) {
      return t('onboardingAffiliation.states.emptyWithoutQueryClub', 'Aucun club a afficher pour le moment.');
    }
    return t('onboardingAffiliation.states.emptyWithoutQueryTeam', 'Aucune equipe a afficher pour le moment.');
  })();

  const screenTitle = isClubFlow
    ? t('onboardingAffiliation.titleClub', 'Trouve ton club')
    : t('onboardingAffiliation.titleTeam', 'Trouve ton equipe');

  const screenSubtitle = (() => {
    if (!isClubFlow) {
      return t(
        'onboardingAffiliation.subtitleTeamFromClub',
        'Recherche ton equipe dans le club selectionne puis ouvre sa fiche pour envoyer ta demande.',
      );
    }
    if (isPlayerClubSelectionStep) {
      return t(
        'onboardingAffiliation.subtitleClubSelection',
        'Recherche puis selectionne ton club pour voir ses equipes.',
      );
    }
    return t(
      'onboardingAffiliation.subtitleClub',
      'Recherche ton club puis ouvre sa fiche pour valider C est mon club.',
    );
  })();

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.fill, Alignments.relative]}>
        <View style={[Spaces.gap[16], Alignments.fill, { paddingBottom: stickyFooterInset }]}>
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {screenTitle}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {screenSubtitle}
            </Text>
          </View>

          {!isClubFlow && selectedClub ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[10],
                Alignments.rowBetween,
                Alignments.alignCenter,
                Spaces.gap[12],
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t('onboardingAffiliation.selectedClubLabel', 'Club selectionne')}
                </Text>
                <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {selectedClub.name || '-'}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleResetSelectedClub}
                style={[
                  Spaces.paddingHorizontal[10],
                  Spaces.paddingVertical[8],
                  ApplicationStyle.borderRadius16,
                  {
                    borderColor: `${Colors.primary500}99`,
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

          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <OnboardingWrapper
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
                <Input
                  accessibilityHint={isClubFlow
                    ? t(
                      'onboardingAffiliation.a11y.searchInputHintClub',
                      'Saisis le nom du club pour filtrer la liste.',
                    )
                    : t(
                      'onboardingAffiliation.a11y.searchInputHintTeam',
                      'Saisis le nom de l equipe pour filtrer la liste.',
                    )}
                  accessibilityLabel={isClubFlow
                    ? t('onboardingAffiliation.a11y.searchInputLabelClub', 'Champ nom du club')
                    : t('onboardingAffiliation.a11y.searchInputLabelTeam', 'Champ nom de l equipe')}
                  icon="search"
                  onChangeText={setSearchValue}
                  placeholder={isClubFlow
                    ? t('onboardingAffiliation.search.placeholderClub', 'Nom du club')
                    : t('onboardingAffiliation.search.placeholderTeam', 'Nom de l equipe')}
                  value={searchValue}
                />
              </OnboardingWrapper>
            </View>

            {isClubFlow ? (
              <View style={[Alignments.relative]}>
                {clubFiltersCount > 0 ? (
                  <View
                    style={[
                      Alignments.absolute,
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      Spaces.paddingHorizontal[4],
                      ApplicationStyle.backgroundColor.primary500,
                      ApplicationStyle.borderRadius32,
                      {
                        right: 0,
                        top: 0,
                        width: 18,
                        zIndex: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3, Fonts.primary900]}>
                      {clubFiltersCount}
                    </Text>
                  </View>
                ) : null}
                <OnboardingWrapper
                  description={t(
                    'onboardingAffiliation.tutorial.stepFiltersDescription',
                    'On va maintenant ouvrir les filtres pour affiner ta recherche.',
                  )}
                  id="affiliation-open-filters-action"
                  onNext={handleOpenClubFilters}
                  order={4}
                  spotlight={{
                    borderRadius: 28,
                    overlayOpacity: 0.4,
                    paddingX: 2,
                    paddingY: 2,
                  }}
                  title={t(
                    'onboardingAffiliation.tutorial.stepFiltersTitle',
                    'Ouvrir les filtres',
                  )}
                >
                  <Button
                    accessibilityHint={t(
                      'onboardingAffiliation.a11y.filterHint',
                      'Ouvre les filtres de recherche de club.',
                    )}
                    accessibilityLabel={t(
                      'onboardingAffiliation.a11y.filterLabel',
                      'Ouvrir les filtres',
                    )}
                    icon="filter"
                    onPress={handleOpenClubFilters}
                    variant="Secondary"
                  />
                </OnboardingWrapper>
              </View>
            ) : null}
          </View>

          {isClubFlow && clubFiltersCount > 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('onboardingAffiliation.search.filtersActive', { count: clubFiltersCount })}
            </Text>
          ) : null}

          <View style={[Alignments.fill]}>
            {isInitialLoading ? loadingState : null}

            {hasInitialError ? errorState : null}

            {!isInitialLoading && !hasInitialError ? (
              <FlatList
                data={listData}
                keyExtractor={(item, index) => String(item?.documentId || item?.id || index)}
                ListEmptyComponent={(
                  <View style={[Spaces.paddingVertical[24], Alignments.alignCenter]}>
                    <Text style={[Fonts.p1, Fonts.neutral300]}>
                      {emptyMessage}
                    </Text>
                  </View>
                )}
                ListFooterComponent={activeQuery?.isFetchingNextPage ? (
                  <View style={[Spaces.paddingVertical[16], Alignments.alignCenter]}>
                    <ActivityIndicator color={Colors.primary500} size="small" />
                  </View>
                ) : null}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
                onRefresh={handleRetry}
                refreshing={Boolean(activeQuery?.isRefetching && !activeQuery?.isFetchingNextPage)}
                renderItem={renderCard}
                showsVerticalScrollIndicator={false}
              />
            ) : null}
          </View>
        </View>

        <View
          onLayout={handleFooterLayout}
          style={[
            Spaces.paddingTop[8],
            Spaces.gap[12],
            {
              backgroundColor: `${Colors.neutral900}9C`,
              borderTopColor: `${Colors.neutral700}66`,
              borderTopWidth: 1,
              bottom: 0,
              left: -24,
              paddingBottom: insets.bottom + 8,
              paddingHorizontal: 24,
              position: 'absolute',
              right: -24,
              zIndex: 30,
            },
          ]}
        >
          <OnboardingWrapper
            description={isClubFlow
              ? t(
                'onboardingAffiliation.tutorial.stepNotFoundDescriptionClub',
                'Si tu ne trouves pas ton club, envoie une demande guidee aux superadmins.',
              )
              : t(
                'onboardingAffiliation.tutorial.stepNotFoundDescriptionTeam',
                'Si tu ne trouves pas ton equipe, envoie une demande guidee aux superadmins.',
              )}
            id="affiliation-not-found-action"
            order={3}
            spotlight={{
              borderRadius: 28,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 3,
            }}
            title={isClubFlow
              ? t('onboardingAffiliation.tutorial.stepNotFoundTitleClub', 'Je ne trouve pas mon club')
              : t('onboardingAffiliation.tutorial.stepNotFoundTitleTeam', 'Je ne trouve pas mon equipe')}
          >
            <Button
              accessibilityHint={isClubFlow
                ? t(
                  'onboardingAffiliation.a11y.notFoundHintClub',
                  'Envoie une demande d aide si ton club est introuvable.',
                )
                : t(
                  'onboardingAffiliation.a11y.notFoundHintTeam',
                  'Envoie une demande d aide si ton equipe est introuvable.',
                )}
              accessibilityLabel={isClubFlow
                ? t('onboardingAffiliation.actions.notFoundClub', 'Je ne trouve pas mon club')
                : t('onboardingAffiliation.actions.notFoundTeam', 'Je ne trouve pas mon equipe')}
              onPress={handleOpenNotFoundModal}
              title={isClubFlow
                ? t('onboardingAffiliation.actions.notFoundClub', 'Je ne trouve pas mon club')
                : t('onboardingAffiliation.actions.notFoundTeam', 'Je ne trouve pas mon equipe')}
              variant="Secondary"
            />
          </OnboardingWrapper>

          <Button
            accessibilityHint={t(
              'onboardingAffiliation.a11y.continueLaterHint',
              'Passe cette etape et continue l onboarding.',
            )}
            accessibilityLabel={t('common.actions.continueLater', 'Continuer plus tard')}
            onPress={handleContinueLater}
            title={t('common.actions.continueLater', 'Continuer plus tard')}
            variant="Secondary"
          />
        </View>
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
              : t('onboardingAffiliation.modal.titleTeam', 'Je ne trouve pas mon equipe')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'onboardingAffiliation.modal.description',
              'Donnez un maximum de contexte pour aider les superadmins.',
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
                'Renseigne le nom de l equipe que tu recherches.',
              )}
            accessibilityLabel={isClubFlow
              ? t('onboardingAffiliation.modal.nameLabelClub', 'Nom du club recherche *')
              : t('onboardingAffiliation.modal.nameLabelTeam', 'Nom de l equipe recherchee *')}
            label={isClubFlow
              ? t('onboardingAffiliation.modal.nameLabelClub', 'Nom du club recherche *')
              : t('onboardingAffiliation.modal.nameLabelTeam', 'Nom de l equipe recherchee *')}
            onChangeText={setRequestedName}
            placeholder={isClubFlow
              ? t('onboardingAffiliation.modal.namePlaceholderClub', 'Ex: Olympique ...')
              : t('onboardingAffiliation.modal.namePlaceholderTeam', 'Ex: U17 Nationaux ...')}
            value={requestedName}
          />
          <Input
            accessibilityHint={t(
              'onboardingAffiliation.a11y.modalCommentHint',
              'Ajoute des informations utiles a la recherche.',
            )}
            accessibilityLabel={t('onboardingAffiliation.modal.commentLabel', 'Commentaire (optionnel)')}
            label={t('onboardingAffiliation.modal.commentLabel', 'Commentaire (optionnel)')}
            multiline
            numberOfLines={4}
            onChangeText={setComment}
            placeholder={t(
              'onboardingAffiliation.modal.commentPlaceholder',
              'Ex: ville, categorie, orthographe probable...',
            )}
            textAlignVertical="top"
            value={comment}
          />
        </View>
      </BottomModal>

      <OnboardingOverlay />
    </ScreenContainer>
  );
}

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
