import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import StrapiImage from '@/components/atoms/strapiImage/StrapiImage';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/* eslint-disable import/order, perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';
/* eslint-enable import/order, perfectionist/sort-imports */

/**
 * Wizard step dedicated to editable ad metadata.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardInfo({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const { showBanner } = useAppFeedback();
  const { dispatch, state } = useAdWizard();
  const { width } = useWindowDimensions();

  const levelsQuery = useGetLevels();
  const categoriesQuery = useGetCategories();
  const sectionsQuery = useGetSections();

  const allLevels = levelsQuery.data;
  const allCategories = categoriesQuery.data;
  const allSections = sectionsQuery.data;

  const isTaxonomyLoading = levelsQuery.isLoading || categoriesQuery.isLoading || sectionsQuery.isLoading;
  const hasTaxonomyError = Boolean(levelsQuery.error || categoriesQuery.error || sectionsQuery.error);

  const levels = useMemo(() => (
    allLevels?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || []
  ), [allLevels]);

  const categories = useMemo(() => (
    allCategories?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || []
  ), [allCategories]);

  const sections = useMemo(() => (
    allSections?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || []
  ), [allSections]);

  const handleNext = () => {
    if (!state.address) {
      showBanner({
        body: 'Ajoutez un lieu précis pour que les joueurs comprennent où se déroule le recrutement.',
        title: 'Lieu requis',
        tone: 'error',
      });
      return;
    }

    navigation.navigate(RouteNames.AdWizardPositions);
  };

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non défini';
  const currentSectionValue = state.section?.name || '';
  const currentCategoryValue = state.category?.name || '';
  const currentLevelValue = state.minLevel?.name || '';
  const teamSummaryMeta = [
    { label: 'Section', value: currentSectionValue },
    { label: 'Catégorie', value: currentCategoryValue },
    { label: 'Niveau', value: currentLevelValue },
  ].filter((item) => String(item.value || '').trim().length > 0).slice(0, 3);
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };
  const shouldUseSingleColumnFields = width <= 430;
  const compactFieldWidth = shouldUseSingleColumnFields ? '100%' : '48%';
  const teamIdentityNode = state.team?.club?.logo?.url ? (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: Colors.neutral00,
        borderColor: Colors.primary500,
        borderRadius: 28,
        borderWidth: 1.5,
        height: 56,
        justifyContent: 'center',
        overflow: 'hidden',
        width: 56,
      }}
    >
      <StrapiImage
        resizeMode="contain"
        source={{ uri: state.team.club.logo.url }}
        style={{ backgroundColor: Colors.neutral00, height: 44, width: 44 }}
      />
    </View>
  ) : (
    <TeamShield
      initials={getClubInitials(state.team?.club?.name || state.team?.name || '')}
      isSmall
    />
  );

  const handleSectionChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const section = allSections?.find((entry) => entry.documentId === option.value);
      dispatch({ payload: section || null, type: 'SET_SECTION' });
    }
  }, [allSections, dispatch]);

  const handleCategoryChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const category = allCategories?.find((entry) => entry.documentId === option.value);
      dispatch({ payload: category || null, type: 'SET_CATEGORY' });
    }
  }, [allCategories, dispatch]);

  const handleLevelChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const level = allLevels?.find((entry) => entry.documentId === option.value);
      dispatch({ payload: level || null, type: 'SET_MIN_LEVEL' });
    }
  }, [allLevels, dispatch]);

  const handleRetryTaxonomy = useCallback(() => {
    levelsQuery.refetch();
    categoriesQuery.refetch();
    sectionsQuery.refetch();
  }, [categoriesQuery, levelsQuery, sectionsQuery]);

  return (
    <WizardStepLayout
      isNextDisabled={!state.address}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={2}
      subtitle="Affinez le profil recherché et le lieu de publication."
      title="Informations de l'annonce"
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[24]]}>
        {isTaxonomyLoading ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[16],
              cardSurfaceStyle,
            ]}
          >
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={[Fonts.p2, Fonts.neutral100, Alignments.fill]}>
              Chargement des sections, catégories et niveaux disponibles.
            </Text>
          </View>
        ) : null}

        {hasTaxonomyError ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[16],
              {
                backgroundColor: 'rgba(53, 19, 24, 0.88)',
                borderColor: 'rgba(239, 68, 68, 0.45)',
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              Certaines options n&apos;ont pas pu être chargées
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Vous pouvez réessayer pour récupérer toutes les références, ou continuer avec les informations déjà préremplies depuis l&apos;équipe.
            </Text>
            <Button onPress={handleRetryTaxonomy} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        {state.team ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[20],
              cardSurfaceStyle,
            ]}
          >
            <View style={[Spaces.gap[16]]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16], { flex: 1 }]}>
                {teamIdentityNode}
                <View style={[Spaces.gap[8], { flex: 1 }]}>
                  <Text numberOfLines={1} style={[Fonts.h4, Fonts.neutral00]}>
                    {state.team?.name || '-'}
                  </Text>
                  <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral100]}>
                    {state.team?.club?.name || 'Club non renseigné'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.9}
                onPress={() => navigation.navigate(RouteNames.AdWizardTeam)}
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  Spaces.paddingHorizontal[16],
                  Spaces.paddingVertical[12],
                  {
                    alignSelf: 'flex-start',
                    backgroundColor: 'rgba(1, 179, 244, 0.12)',
                    borderColor: 'rgba(1, 179, 244, 0.28)',
                    borderRadius: 999,
                    borderWidth: 1,
                    minWidth: 144,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Changer l&apos;équipe</Text>
              </TouchableOpacity>
            </View>

            {teamSummaryMeta.length > 0 ? (
              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                {teamSummaryMeta.map((item) => (
                  <View
                    key={item.label}
                    style={[
                      Spaces.paddingHorizontal[14],
                      Spaces.paddingVertical[10],
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.10)',
                        borderColor: 'rgba(1, 179, 244, 0.18)',
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                      {`${item.label} : ${item.value}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[20], cardSurfaceStyle]}>
          <View style={[Spaces.gap[12]]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>Profil recherché</Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Affinez la cible de votre annonce avec les bons repères sportifs.
              </Text>
            </View>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>{sportName}</Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[16]]}>
            <AutocompleteSelect
              displayVariant="card"
              label="Section"
              options={sections}
              placeholder="Sélectionner une section"
              setValue={handleSectionChange}
              value={currentSectionValue}
              wrapperStyle={{ width: compactFieldWidth }}
            />

            <AutocompleteSelect
              displayVariant="card"
              label="Catégorie"
              options={categories}
              placeholder="Sélectionner une catégorie"
              setValue={handleCategoryChange}
              value={currentCategoryValue}
              wrapperStyle={{ width: compactFieldWidth }}
            />

            <AutocompleteSelect
              description="Définissez le niveau minimum attendu pour candidater."
              displayVariant="card"
              label="Niveau minimum recherché"
              options={levels}
              placeholder="Sélectionner un niveau"
              setValue={handleLevelChange}
              value={currentLevelValue}
              wrapperStyle={{ width: '100%' }}
            />
          </View>
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[20], cardSurfaceStyle]}>
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h4, Fonts.neutral00]}>Lieu de l&apos;annonce</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Ajoutez un lieu clair pour situer rapidement votre recrutement.
            </Text>
          </View>

          <AutocompleteAddressInput
            address={state.address}
            label={(
              <Text>
                Lieu (stade, ville, gymnase...)
                {' '}
                <Text style={{ color: Colors.error500 }}>*</Text>
              </Text>
            )}
            placeholder="Rechercher une adresse"
            setAddress={(address) => dispatch({ payload: address, type: 'SET_ADDRESS' })}
          />

          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
              Spaces.paddingHorizontal[16],
              Spaces.paddingVertical[12],
              {
                backgroundColor: 'rgba(1, 179, 244, 0.08)',
                borderColor: 'rgba(1, 179, 244, 0.16)',
                borderRadius: 16,
                borderWidth: 1,
              },
            ]}
          >
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                height: 8,
                width: 8,
              }}
            />
            <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>
              Conseil publication : gardez un lieu précis et un niveau cohérent pour attirer les bons profils dès les premiers résultats.
            </Text>
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardInfo;
