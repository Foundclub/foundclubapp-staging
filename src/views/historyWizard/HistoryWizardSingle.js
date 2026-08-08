import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import Input from '@/components/molecules/input/Input';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClubs, useSearchClubs as useLegacySearchClubs } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useSearchClubs as useSmartSearchClubs } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';
import { useCreateHistory, useUpdateHistory } from '@/services/userHistory/userHistoryQueries';

import { getLocationCoordinates, normalizeLocationInput } from '@/utils/location';

import { useHistoryWizard } from './HistoryWizardContext';

const DEFAULT_RADIUS = 20;
const FIRST_YEAR = 1990;

/** @typedef {import('@/domains/club/types').Club} Club */
/** @typedef {{ documentId?: string; name?: string }} ClubSection */

const createDefaultFilters = () => ({
  activity: '',
  lat: undefined,
  location: undefined,
  lon: undefined,
  radius: DEFAULT_RADIUS,
});

/**
 * @param {string} value
 * @param {{ label: string, value: string }[]} options
 * @returns {string}
 */
const getSelectedLabel = (value, options) => options.find((option) => option.value === value)?.label || '';

/**
 * @param {number} radius
 * @param {any} location
 * @param {string} activity
 * @returns {number}
 */
const getFilterCount = (radius, location, activity) => {
  let count = 0;
  if (location?.label) count += 1;
  if (location?.label && radius !== DEFAULT_RADIUS) count += 1;
  if (activity) count += 1;
  return count;
};

/**
 * Écran unifié « historique sportif » (C08, décision D4) : club en premier, puis
 * période, catégories et niveau, puis validation — le tout sur un seul écran.
 * Réutilise HistoryWizardContext (état partagé) et useCreateHistory/useUpdateHistory.
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route: { params?: { resetContext?: boolean; returnRoute?: string; editingEntry?: any } };
 * }} props
 * @returns {import('react').ReactElement}
 */
function HistoryWizardSingle({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const { dispatch, state } = useHistoryWizard();

  const [searchQuery, setSearchQuery] = useState('');
  const [customClubName, setCustomClubName] = useState(state.customClubName || '');
  const [showCustomInput, setShowCustomInput] = useState(state.useCustomClub);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(createDefaultFilters);
  const [draftFilters, setDraftFilters] = useState(createDefaultFilters);
  const [selectedMultisport, setSelectedMultisport] = useState(/** @type {Club | undefined} */ (undefined));
  const [showMultisportModal, setShowMultisportModal] = useState(false);

  const isEditing = Boolean(state.editingEntry);

  // Paramètres de route : réinitialisation, entrée en édition, route de retour.
  useEffect(() => {
    if (route?.params?.resetContext) {
      dispatch({ type: 'RESET' });
    }

    if (route?.params?.editingEntry) {
      dispatch({ payload: route.params.editingEntry, type: 'SET_EDITING_ENTRY' });
    }

    if (route?.params?.returnRoute) {
      dispatch({ payload: route.params.returnRoute, type: 'SET_RETURN_ROUTE' });
    }
  }, [dispatch, route?.params]);

  // ----- Données de référence -----
  const { data: allActivities } = useGetActivities();
  const {
    data: categories,
    error: categoriesError,
    isLoading: isCategoriesLoading,
    refetch: refetchCategories,
  } = useGetCategories();
  const {
    data: levels,
    error: levelsError,
    isLoading: isLevelsLoading,
    refetch: refetchLevels,
  } = useGetLevels();

  const categoryOptions = Array.isArray(categories) ? categories : [];
  const levelOptions = Array.isArray(levels) ? levels : [];

  const createHistoryMutation = useCreateHistory();
  const updateHistoryMutation = useUpdateHistory();
  const isSubmitting = createHistoryMutation.isPending || updateHistoryMutation.isPending;

  // ----- Recherche de club (portée depuis HistoryWizardClub) -----
  const hasSelectedClub = Boolean(state.club || state.multisportClub);

  const activityOptions = useMemo(() => {
    const options = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })) || [];

    if (!activitySearchValue.trim()) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(activitySearchValue.trim().toLowerCase()));
  }, [activitySearchValue, allActivities]);

  const hasSearchTerm = searchQuery.trim().length >= 2;
  const hasGeoFilter = Number.isFinite(appliedFilters.lat) && Number.isFinite(appliedFilters.lon);
  const hasActivityFilter = Boolean(appliedFilters.activity);
  const hasActiveFilters = hasGeoFilter || hasActivityFilter;

  const searchParams = useMemo(() => ({
    activity: appliedFilters.activity || undefined,
    lat: appliedFilters.lat,
    lon: appliedFilters.lon,
    pageSize: 10,
    q: searchQuery.trim(),
    radius: appliedFilters.lat && appliedFilters.lon ? appliedFilters.radius : undefined,
    sort: 'relevance',
  }), [appliedFilters.activity, appliedFilters.lat, appliedFilters.lon, appliedFilters.radius, searchQuery]);

  const shouldSearch = hasSearchTerm && !showCustomInput && !hasSelectedClub;

  const geohash = useMemo(() => {
    if (!hasGeoFilter) return undefined;
    return getGeohashForPointAndRadius(
      Number(appliedFilters.lat),
      Number(appliedFilters.lon),
      Number(appliedFilters.radius || DEFAULT_RADIUS),
    );
  }, [
    appliedFilters.lat,
    appliedFilters.lon,
    appliedFilters.radius,
    getGeohashForPointAndRadius,
    hasGeoFilter,
  ]);

  const defaultListParams = useMemo(() => ({
    activity: appliedFilters.activity || undefined,
    geohash,
    pageSize: 12,
  }), [appliedFilters.activity, geohash]);

  const { data: defaultClubPages, isLoading: isDefaultLoading } = useGetClubs(defaultListParams, {
    enabled: !shouldSearch && !showCustomInput && !hasSelectedClub,
  });

  const {
    data: smartClubPages,
    error: smartSearchError,
    isLoading: isSmartLoading,
  } = useSmartSearchClubs(searchParams, {
    enabled: searchQuery.length >= 2 && !showCustomInput && !hasSelectedClub,
  });

  const smartClubResults = useMemo(() => smartClubPages?.pages?.reduce(
    (acc, page) => acc.concat(mapSearchPayload(page)),
    [],
  ) || [], [smartClubPages]);

  const shouldEnableLegacyFallback = shouldSearch
    && !hasActiveFilters
    && (Boolean(smartSearchError) || smartClubResults.length === 0);

  const {
    data: legacyClubResults,
    isLoading: isLegacyLoading,
  } = useLegacySearchClubs(searchQuery, {
    enabled: shouldEnableLegacyFallback,
  });

  const clubResults = useMemo(() => {
    if (smartClubResults.length > 0) {
      return smartClubResults;
    }

    if (shouldEnableLegacyFallback) {
      return legacyClubResults || [];
    }

    return [];
  }, [legacyClubResults, shouldEnableLegacyFallback, smartClubResults]);

  const isClubLoading = isSmartLoading || (shouldEnableLegacyFallback && isLegacyLoading);
  const hasSearchError = Boolean(smartSearchError && (!shouldEnableLegacyFallback || !legacyClubResults?.length));
  const defaultClubResults = useMemo(() => defaultClubPages?.pages?.reduce(
    (acc, page) => acc.concat(page?.data || []),
    [],
  ) || [], [defaultClubPages]);
  const displayedResults = hasSearchTerm ? clubResults : defaultClubResults;
  const displayedIsLoading = hasSearchTerm ? isClubLoading : isDefaultLoading;
  const shouldShowNoResults = !displayedIsLoading
    && !hasSelectedClub
    && displayedResults.length === 0
    && (hasSearchTerm || hasActiveFilters);

  const appliedFilterCount = useMemo(
    () => getFilterCount(appliedFilters.radius, appliedFilters.location, appliedFilters.activity),
    [appliedFilters.activity, appliedFilters.location, appliedFilters.radius],
  );

  const draftLocationHasCoordinates = Boolean(getLocationCoordinates(draftFilters.location));

  // ----- Période -----
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= FIRST_YEAR; y -= 1) {
      years.push(y);
    }
    return years;
  }, []);

  // ----- Handlers club -----
  const handleSearchField = (value) => {
    setSearchQuery(value);

    if (value && (state.club || state.multisportClub || state.useCustomClub)) {
      dispatch({ type: 'CLEAR_CLUB_SELECTION' });
    }
  };

  const handleSelectClub = (/** @type {Club} */ club) => {
    if (Reflect.get(club, '_type') === 'multisport') {
      setSelectedMultisport(club);
      setShowMultisportModal(true);
      return;
    }

    dispatch({ payload: club, type: 'SET_CLUB' });
  };

  const handleSelectMultisportParent = () => {
    dispatch({ payload: selectedMultisport, type: 'SET_MULTISPORT_CLUB' });
    setShowMultisportModal(false);
  };

  const handleSelectMultisportSection = (/** @type {ClubSection} */ section) => {
    dispatch({ payload: section, type: 'SET_CLUB' });
    setShowMultisportModal(false);
  };

  const handleApplyFilters = () => {
    const normalizedLocation = normalizeLocationInput(draftFilters.location);
    const coordinates = getLocationCoordinates(normalizedLocation);

    const nextFilters = {
      activity: draftFilters.activity || '',
      lat: coordinates?.lat,
      location: normalizedLocation || undefined,
      lon: coordinates?.lng,
      radius: draftFilters.radius || DEFAULT_RADIUS,
    };

    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    setShowFiltersPanel(false);
  };

  const handleClearFilters = () => {
    const emptyFilters = createDefaultFilters();
    setAppliedFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setActivitySearchValue('');
    setShowFiltersPanel(false);
  };

  const handleOpenFilters = () => {
    setDraftFilters({
      activity: appliedFilters.activity || '',
      lat: appliedFilters.lat,
      location: appliedFilters.location,
      lon: appliedFilters.lon,
      radius: appliedFilters.radius || DEFAULT_RADIUS,
    });
    setShowFiltersPanel((current) => !current);
  };

  const handleOpenCustomInput = () => {
    setShowCustomInput(true);
    setShowFiltersPanel(false);
    setSearchQuery('');
    dispatch({ type: 'CLEAR_CLUB_SELECTION' });
  };

  const handleBackToSearch = () => {
    setShowCustomInput(false);
    setCustomClubName('');

    if (state.useCustomClub) {
      dispatch({ type: 'CLEAR_CLUB_SELECTION' });
    }
  };

  // D40 marche 1 — LE CLUB CHOISI SE RETIRE, sur l'ecran du TELEPHONE.
  // D23 (`99467f9`) avait corrige le meme defaut dans `HistoryWizardClub.js`,
  // qui est la copie WEB : le bloc fautif etait reste ici, caractere pour
  // caractere. Une fois un club selectionne, la liste de resultats disparait
  // (`!hasSelectedClub`) et la carte du club retenu etait rendue SANS `onPress`
  // : `ClubSearchResultCard` se met alors en `disabled`. Il ne restait qu'un
  // chemin, invisible : retaper dans le champ de recherche. Une faute de frappe
  // devenait definitive.
  const handleClearClubSelection = () => {
    dispatch({ type: 'CLEAR_CLUB_SELECTION' });
    setSearchQuery('');
  };

  // ----- Handlers catégorie / niveau -----
  const handleSelectCategory = (/** @type {any} */ category) => {
    if (isEditing) {
      dispatch({ payload: [category], type: 'SET_CATEGORIES' });
      return;
    }

    dispatch({ payload: category, type: 'TOGGLE_CATEGORY' });
  };

  const handleSelectLevel = (/** @type {any} */ level) => {
    dispatch({ payload: level, type: 'SET_LEVEL' });
  };

  // ----- Validation -----
  const useCustom = showCustomInput
    ? Boolean(customClubName.trim())
    : Boolean(state.useCustomClub && state.customClubName.trim());
  const resolvedCustomName = showCustomInput ? customClubName.trim() : state.customClubName;

  const canSubmit = Boolean(state.club || state.multisportClub || useCustom);

  const buildPayloads = () => {
    const basePayload = {
      club: state.club?.documentId || null,
      customClubName: useCustom ? resolvedCustomName : null,
      endYear: state.isCurrentlyActive ? null : state.endYear,
      isCurrentlyActive: state.isCurrentlyActive,
      level: state.level?.documentId || null,
      multisport_club: state.multisportClub?.documentId || null,
      startYear: state.startYear,
    };

    const categoryIds = state.categories
      .map((category) => category?.documentId)
      .filter(Boolean);

    if (isEditing) {
      return [{
        ...basePayload,
        category: categoryIds[0] || null,
      }];
    }

    if (categoryIds.length === 0) {
      return [{
        ...basePayload,
        category: null,
      }];
    }

    return categoryIds.map((categoryId) => ({
      ...basePayload,
      category: categoryId,
    }));
  };

  const handleSuccess = () => {
    dispatch({ type: 'RESET' });

    if (state.returnRoute) {
      navigation.navigate(state.returnRoute);
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: RouteNames.Profile }],
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // On fige la saisie manuelle dans le contexte pour garder l'état cohérent.
    if (showCustomInput && customClubName.trim() && !state.useCustomClub) {
      dispatch({ payload: customClubName.trim(), type: 'SET_CUSTOM_CLUB' });
    }

    const payloads = buildPayloads();

    try {
      if (isEditing) {
        await updateHistoryMutation.mutateAsync({
          data: payloads[0],
          id: state.editingEntry.documentId,
        });
      } else {
        await payloads.reduce(
          (promise, payload) => promise.then(() => createHistoryMutation.mutateAsync(payload)),
          Promise.resolve(),
        );
      }

      handleSuccess();
    } catch (_error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer cette expérience pour le moment.');
    }
  };

  const selectedClubCard = state.club || state.multisportClub
    ? {
      ...(state.club || state.multisportClub),
      sectionsCount: state.multisportClub?.sectionsCount,
    }
    : null;

  /**
   * Petit intitulé de section, encre neutre.
   * @param label
   * @param helper
   */
  const renderSectionTitle = (/** @type {string} */ label, /** @type {string} */ helper) => (
    <View style={[Spaces.gap[4]]}>
      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{label}</Text>
      {helper ? (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{helper}</Text>
      ) : null}
    </View>
  );

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.HISTORY_WIZARD}
      userId={userData?.documentId}
    >
      <WizardStepLayout
        collapsibleHeader
        isNextDisabled={!canSubmit}
        isNextLoading={isSubmitting}
        nextLabel={isEditing ? 'Enregistrer' : 'Valider'}
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        subtitle="Ajoute une expérience : ton club d'abord, puis la période, les catégories et le niveau."
        title={isEditing ? 'Modifier l\'expérience' : 'Ton parcours sportif'}
      >
        <View style={[Spaces.gap[32]]}>
          {/* 1. CLUB (en premier) */}
          <View style={[Spaces.gap[16]]}>
            {renderSectionTitle('Quel club ?', 'Recherche ton club ou saisis-le manuellement.')}

            <OnboardingWrapper
              description="Commence par rechercher ton club ou saisis le nom manuellement."
              id="history-wizard-club-input"
              order={1}
              spotlight={{
                borderRadius: 16,
                maxHeight: 280,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Sélection du club"
            >
              {!showCustomInput ? (
                <View style={[Spaces.gap[16]]}>
                  <SearchComponent
                    filterNumber={appliedFilterCount}
                    handleSearchField={handleSearchField}
                    inputStyle={{
                      includeFontPadding: false,
                      lineHeight: 22,
                      minHeight: 24,
                      paddingVertical: 0,
                      textAlignVertical: 'center',
                    }}
                    openFilters={handleOpenFilters}
                    placeholder="Rechercher un club..."
                    searchDefaultValue={searchQuery}
                  />

                  {showFiltersPanel ? (
                    <View
                      style={[
                        Spaces.gap[16],
                        Spaces.padding[16],
                        {
                          backgroundColor: Colors.neutral800,
                          borderColor: Colors.primary200,
                          borderRadius: 16,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <AutocompleteAddressInput
                        address={draftFilters.location}
                        label="Ville ou adresse"
                        placeholder="Choisir une localisation"
                        setAddress={(location) => setDraftFilters((current) => ({
                          ...current,
                          location,
                        }))}
                      />

                      <View style={[Spaces.gap[8]]}>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                          {`Rayon : ${draftFilters.radius} km`}
                        </Text>
                        <Slider
                          disabled={!draftLocationHasCoordinates}
                          maximumTrackTintColor={Colors.primary700}
                          maximumValue={50}
                          minimumTrackTintColor={Colors.primary500}
                          minimumValue={2}
                          onValueChange={(radius) => setDraftFilters((current) => ({
                            ...current,
                            radius,
                          }))}
                          step={1}
                          style={{ height: 50, width: '100%' }}
                          tapToSeek
                          thumbTintColor={Colors.primary500}
                          value={draftFilters.radius}
                        />
                      </View>

                      <AutocompleteSelect
                        isSearchable
                        label="Sport"
                        options={activityOptions}
                        placeholder="Choisir un sport"
                        searchValue={activitySearchValue}
                        setSearchValue={setActivitySearchValue}
                        setValue={(option) => setDraftFilters((current) => ({
                          ...current,
                          activity: option?.value || '',
                        }))}
                        value={getSelectedLabel(draftFilters.activity, activityOptions)}
                      />

                      <View style={[Alignments.row, Spaces.gap[12]]}>
                        <View style={{ flex: 1 }}>
                          <Button
                            onPress={handleClearFilters}
                            title="Effacer"
                            variant="Secondary"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            onPress={handleApplyFilters}
                            title="Appliquer"
                            variant="Primary"
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {!hasSelectedClub ? (
                    <View style={[Spaces.gap[8]]}>
                      {displayedIsLoading ? (
                        <ActivityIndicator color={Colors.primary500} size="small" />
                      ) : null}

                      {displayedResults.slice(0, hasSearchTerm ? 6 : 8).map((/** @type {Club} */ club) => (
                        <ClubSearchResultCard
                          item={club}
                          key={club.documentId}
                          onPress={() => handleSelectClub(club)}
                        />
                      ))}

                      {shouldShowNoResults ? (
                        <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
                          Aucun club trouvé pour cette recherche.
                        </Text>
                      ) : null}
                      {!displayedIsLoading && hasSearchTerm && hasSearchError ? (
                        <Text style={[Fonts.p3, { color: Colors.error500, textAlign: 'center' }]}>
                          {shouldEnableLegacyFallback
                            ? 'La recherche intelligente est indisponible, fallback actif.'
                            : 'La recherche intelligente est indisponible.'}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {selectedClubCard ? (
                    <View style={[Spaces.gap[8]]}>
                      <ClubSearchResultCard
                        isMultisport={Boolean(state.multisportClub)}
                        isSelected
                        item={selectedClubCard}
                        onPress={handleClearClubSelection}
                      />
                      {/*
                        Le lien double la carte : une carte qu'il faut deviner
                        tapable est le meme defaut sous une autre forme.
                      */}
                      <TouchableOpacity
                        accessibilityHint={t(
                          'historyWizard.club.clearSelectionHint',
                          'Retire le club retenu et rouvre la recherche.',
                        )}
                        accessibilityRole="button"
                        onPress={handleClearClubSelection}
                      >
                        <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
                          {t('historyWizard.club.clearSelection', 'Changer de club')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    hitSlop={{
                      bottom: 8, left: 8, right: 8, top: 8,
                    }}
                    onPress={handleOpenCustomInput}
                    style={{ justifyContent: 'center', minHeight: 44 }}
                  >
                    <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
                      Club non trouvé ? Saisir manuellement
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[Spaces.gap[16]]}>
                  <Input
                    autoFocus
                    onChangeText={setCustomClubName}
                    placeholder="Nom du club..."
                    value={customClubName}
                  />

                  {customClubName.trim() ? (
                    <View
                      style={{
                        backgroundColor: `${Colors.primary500}16`,
                        borderColor: Colors.primary500,
                        borderRadius: 12,
                        borderWidth: 1,
                        padding: 16,
                      }}
                    >
                      <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                        {customClubName.trim()}
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    hitSlop={{
                      bottom: 8, left: 8, right: 8, top: 8,
                    }}
                    onPress={handleBackToSearch}
                    style={{ justifyContent: 'center', minHeight: 44 }}
                  >
                    <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
                      Revenir à la recherche
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </OnboardingWrapper>
          </View>

          {/* 2. PÉRIODE */}
          <View style={[Spaces.gap[16]]}>
            {renderSectionTitle('Quelle période ?', 'Indique les années de ta présence dans ce club.')}

            <View style={[Spaces.gap[24]]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Année de début</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[Alignments.row, Spaces.gap[8]]}>
                    {yearOptions.map((year) => {
                      const isSelected = state.startYear === year;
                      return (
                        <TouchableOpacity
                          key={`start-${year}`}
                          onPress={() => dispatch({ payload: year, type: 'SET_START_YEAR' })}
                          style={{
                            alignItems: 'center',
                            backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                            borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                            borderRadius: 12,
                            borderWidth: 1,
                            justifyContent: 'center',
                            minHeight: 44,
                            paddingHorizontal: 16,
                          }}
                        >
                          <Text style={[Fonts.p1, { color: isSelected ? Colors.primary900 : Colors.neutral300 }]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                <Switch
                  onValueChange={(value) => dispatch({ payload: value, type: 'SET_CURRENTLY_ACTIVE' })}
                  thumbColor={Colors.neutral00}
                  trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
                  value={state.isCurrentlyActive}
                />
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Je suis toujours dans ce club</Text>
              </View>

              {!state.isCurrentlyActive ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Année de fin</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {yearOptions.filter((y) => y >= state.startYear).map((year) => {
                        const isSelected = state.endYear === year;
                        return (
                          <TouchableOpacity
                            key={`end-${year}`}
                            onPress={() => dispatch({ payload: year, type: 'SET_END_YEAR' })}
                            style={{
                              alignItems: 'center',
                              backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                              borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                              borderRadius: 12,
                              borderWidth: 1,
                              justifyContent: 'center',
                              minHeight: 44,
                              paddingHorizontal: 16,
                            }}
                          >
                            <Text style={[Fonts.p1, { color: isSelected ? Colors.primary900 : Colors.neutral300 }]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </View>

          {/* 3. CATÉGORIES (optionnel) */}
          <View style={[Spaces.gap[16]]}>
            {renderSectionTitle(
              'Quelles catégories ?',
              isEditing
                ? 'Sélectionne une catégorie (facultatif).'
                : 'Sélectionne une ou plusieurs catégories (facultatif).',
            )}

            {isCategoriesLoading && (
              <ActivityIndicator color={Colors.primary500} size="large" />
            )}
            {!isCategoriesLoading && categoriesError && (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
                  {t(
                    'historyWizard.category.error',
                    'Impossible de charger les catégories pour le moment.',
                  )}
                </Text>
                <TouchableOpacity
                  onPress={() => refetchCategories()}
                  style={{
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    borderColor: Colors.primary500,
                    borderRadius: 20,
                    borderWidth: 1,
                    justifyContent: 'center',
                    minHeight: 44,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                    {t('common.retry', 'Réessayer')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!isCategoriesLoading && !categoriesError && categoryOptions.length === 0 && (
              <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
                {t(
                  'historyWizard.category.empty',
                  'Aucune catégorie disponible pour le moment.',
                )}
              </Text>
            )}
            {!isCategoriesLoading && !categoriesError && categoryOptions.length > 0 && (
              <View style={[Spaces.gap[12]]}>
                {categoryOptions.map((category) => {
                  const isSelected = state.categories.some(
                    (selectedCategory) => selectedCategory?.documentId === category.documentId,
                  );

                  return (
                    <TouchableOpacity
                      key={category.documentId}
                      onPress={() => handleSelectCategory(category)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 12,
                        borderWidth: 2,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        minHeight: 44,
                        padding: 20,
                      }}
                    >
                      <Text
                        style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}
                      >
                        {category.name}
                      </Text>
                      {isSelected ? (
                        <Text style={{ color: Colors.primary500, fontSize: 18 }}>OK</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. NIVEAU (optionnel) */}
          <View style={[Spaces.gap[16]]}>
            {renderSectionTitle('Quel niveau ?', 'Sélectionne le meilleur niveau joué (facultatif).')}

            {isLevelsLoading && (
              <ActivityIndicator color={Colors.primary500} size="large" />
            )}
            {!isLevelsLoading && levelsError && (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
                  Impossible de charger les niveaux pour le moment.
                </Text>
                <TouchableOpacity
                  onPress={() => refetchLevels()}
                  style={{
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    borderColor: Colors.primary500,
                    borderRadius: 20,
                    borderWidth: 1,
                    justifyContent: 'center',
                    minHeight: 44,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                    Réessayer
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!isLevelsLoading && !levelsError && levelOptions.length === 0 && (
              <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
                Aucun niveau disponible pour le moment.
              </Text>
            )}
            {!isLevelsLoading && !levelsError && levelOptions.length > 0 && (
              <View style={[Spaces.gap[12]]}>
                {levelOptions.map((level) => {
                  const isSelected = state.level?.documentId === level.documentId;
                  return (
                    <TouchableOpacity
                      key={level.documentId}
                      onPress={() => handleSelectLevel(level)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 12,
                        borderWidth: 2,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        minHeight: 44,
                        padding: 20,
                      }}
                    >
                      <Text style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}>
                        {level.name}
                      </Text>
                      {isSelected ? (
                        <Text style={{ color: Colors.primary500, fontSize: 18 }}>OK</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Déclaration sur l'honneur */}
          <View
            style={{
              backgroundColor: Colors.neutral800,
              borderColor: Colors.primary200,
              borderRadius: 16,
              borderWidth: 1,
              padding: 16,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 4 }]}>
              Déclaration sur l&apos;honneur
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral00, lineHeight: 18 }]}>
              Ces informations peuvent être vérifiées par la communauté.
            </Text>
          </View>
        </View>

        <BottomModal
          close={() => setShowMultisportModal(false)}
          headerComponent={(
            <View style={[Alignments.alignCenter]}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
                {selectedMultisport?.name}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
                Sélectionne ton entité de rattachement
              </Text>
            </View>
          )}
          isVisible={showMultisportModal}
          snapPoints={['90%']}
        >
          <View style={[Spaces.gap[12]]}>
            <ClubSearchResultCard
              item={selectedMultisport}
              onPress={handleSelectMultisportParent}
            />

            <View style={{ backgroundColor: Colors.neutral700, height: 1, marginVertical: 8 }} />

            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
              Sections disponibles :
            </Text>

            {selectedMultisport?.sections?.map((section) => (
              <TouchableOpacity
                key={section.documentId}
                onPress={() => handleSelectMultisportSection(section)}
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.neutral800,
                  borderColor: Colors.neutral700,
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: 'row',
                  minHeight: 44,
                  padding: 16,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: Colors.neutral700,
                    borderRadius: 8,
                    height: 40,
                    justifyContent: 'center',
                    marginRight: 12,
                    width: 40,
                  }}
                >
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral300 }]}>
                    {section.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  {section.name}
                </Text>
              </TouchableOpacity>
            ))}

            {(!selectedMultisport?.sections || selectedMultisport.sections.length === 0) ? (
              <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>
                Aucune section listée.
              </Text>
            ) : null}
          </View>
        </BottomModal>
      </WizardStepLayout>
    </TutorialFlowBoundary>
  );
}

export default HistoryWizardSingle;
