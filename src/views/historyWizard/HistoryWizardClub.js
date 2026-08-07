import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { useGetClubs, useSearchClubs as useLegacySearchClubs } from '@/services/club/clubQueries';
import { useSearchClubs as useSmartSearchClubs } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

import { getLocationCoordinates, normalizeLocationInput } from '@/utils/location';

import { useHistoryWizard } from './HistoryWizardContext';

const DEFAULT_RADIUS = 20;

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
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route: { params?: { resetContext?: boolean; returnRoute?: string } };
 * }} props
 */
function HistoryWizardClub({ navigation, route }) {
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

  useEffect(() => {
    if (route.params?.resetContext) {
      dispatch({ type: 'RESET' });
    }

    if (route.params?.returnRoute) {
      dispatch({ payload: route.params.returnRoute, type: 'SET_RETURN_ROUTE' });
    }
  }, [route.params, dispatch]);

  const hasSelectedClub = Boolean(state.club || state.multisportClub);

  const { data: allActivities } = useGetActivities();

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
  const isLoading = isSmartLoading || (shouldEnableLegacyFallback && isLegacyLoading);
  const hasSearchError = Boolean(smartSearchError && (!shouldEnableLegacyFallback || !legacyClubResults?.length));
  const defaultClubResults = useMemo(() => defaultClubPages?.pages?.reduce(
    (acc, page) => acc.concat(page?.data || []),
    [],
  ) || [], [defaultClubPages]);
  const displayedResults = hasSearchTerm ? clubResults : defaultClubResults;
  const displayedIsLoading = hasSearchTerm ? isLoading : isDefaultLoading;
  const shouldShowNoResults = !displayedIsLoading
    && !hasSelectedClub
    && displayedResults.length === 0
    && (hasSearchTerm || hasActiveFilters);

  const appliedFilterCount = useMemo(
    () => getFilterCount(appliedFilters.radius, appliedFilters.location, appliedFilters.activity),
    [appliedFilters.activity, appliedFilters.location, appliedFilters.radius],
  );

  const draftLocationHasCoordinates = Boolean(getLocationCoordinates(draftFilters.location));

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
    navigation.navigate(RouteNames.HistoryWizardPeriod);
  };

  const handleSelectMultisportParent = () => {
    dispatch({ payload: selectedMultisport, type: 'SET_MULTISPORT_CLUB' });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardPeriod);
  };

  const handleSelectMultisportSection = (/** @type {ClubSection} */ section) => {
    dispatch({ payload: section, type: 'SET_CLUB' });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardPeriod);
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

  // D23 (defaut ③ de la recette du 07/08) — LE CLUB CHOISI SE RETIRE.
  // Une fois un club selectionne, la liste de resultats disparaissait
  // (`!hasSelectedClub`) et la carte du club retenu etait rendue SANS
  // `onPress` : `ClubSearchResultCard` se met alors en `disabled`. Il ne
  // restait qu'un chemin, invisible : retaper dans le champ de recherche.
  // Une faute de frappe devenait definitive dans le tunnel.
  const handleClearClubSelection = () => {
    dispatch({ type: 'CLEAR_CLUB_SELECTION' });
    setSearchQuery('');
  };

  const handleNext = () => {
    if (showCustomInput) {
      const value = customClubName.trim();
      if (!value) return;
      dispatch({ payload: value, type: 'SET_CUSTOM_CLUB' });
    }

    navigation.navigate(RouteNames.HistoryWizardPeriod);
  };

  const canProceed = Boolean(
    state.club
      || state.multisportClub
      || (showCustomInput && customClubName.trim())
      || (!showCustomInput && state.useCustomClub && state.customClubName.trim()),
  );

  const selectedClubCard = state.club || state.multisportClub
    ? {
      ...(state.club || state.multisportClub),
      sectionsCount: state.multisportClub?.sectionsCount,
    }
    : null;

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
        isNextDisabled={!canProceed}
        nextLabel={t('common.actions.next', 'Continuer')}
        onBack={() => navigation.goBack()}
        onNext={handleNext}
        subtitle="Recherche ton club ou saisis-le manuellement"
        title="Quel club ?"
      >
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

              <TouchableOpacity onPress={handleOpenCustomInput}>
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

              <TouchableOpacity onPress={handleBackToSearch}>
                <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
                  Revenir à la recherche
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </OnboardingWrapper>

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
                Aucune section listee.
              </Text>
            ) : null}
          </View>
        </BottomModal>
      </WizardStepLayout>
    </TutorialFlowBoundary>
  );
}

export default HistoryWizardClub;
