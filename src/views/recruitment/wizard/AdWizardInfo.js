import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

/* eslint-disable perfectionist/sort-imports */
import { useAppFeedback } from '@/context/AppFeedbackContext';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardInfoStepIndex,
  getAdWizardStepCount,
  isAdWizardSportProfileComplete,
  isCoachAdWizard,
} from './adWizardStepUtils';
/* eslint-enable perfectionist/sort-imports */

/**
 * Wizard step dedicated to editable ad metadata.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardInfo({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { showBanner } = useAppFeedback();
  const { dispatch, state } = useAdWizard();
  const { width } = useWindowDimensions();

  const levelsQuery = useGetLevels();
  const categoriesQuery = useGetCategories();
  const sectionsQuery = useGetSections();

  const allLevels = levelsQuery.data;
  const allCategories = categoriesQuery.data;
  const allSections = sectionsQuery.data;

  const isTaxonomyLoading = (
    levelsQuery.isLoading
    || categoriesQuery.isLoading
    || sectionsQuery.isLoading
  );
  const hasTaxonomyError = Boolean(
    levelsQuery.error
    || categoriesQuery.error
    || sectionsQuery.error,
  );

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
    if (!isAdWizardSportProfileComplete(state)) {
      showBanner({
        body: t(
          'adWizardInfo.required.body',
          'Complète la section, la catégorie et le niveau minimum pour qualifier clairement ton annonce.', // eslint-disable-line max-len
        ),
        title: t('adWizardInfo.required.title', 'Profil requis'),
        tone: 'error',
      });
      return;
    }

    navigation.navigate(RouteNames.AdWizardLocation);
  };

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || t(
    'adWizardInfo.sportUndefined',
    'Non défini',
  );
  const currentSectionValue = state.section?.name || '';
  const currentCategoryValue = state.category?.name || '';
  const currentLevelValue = state.minLevel?.name || '';
  const teamSummaryMeta = [
    { label: t('adWizardInfo.teamSummary.section', 'Section'), value: currentSectionValue },
    { label: t('adWizardInfo.teamSummary.category', 'Catégorie'), value: currentCategoryValue },
    { label: t('adWizardInfo.teamSummary.level', 'Niveau'), value: currentLevelValue },
  ].filter((item) => String(item.value || '').trim().length > 0).slice(0, 3);

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };
  const shouldUseSingleColumnFields = width <= 430;
  const compactFieldWidth = shouldUseSingleColumnFields ? '100%' : '48%';

  const teamIdentityNode = (
    <ClubLogoMark
      club={state.team?.club}
      logoStyle={{
        backgroundColor: Colors.neutral00,
        borderColor: Colors.primary500,
        borderRadius: 28,
        borderWidth: 1.5,
      }}
      name={state.team?.club?.name || state.team?.name}
      safeInsetRatio={0.1}
      size={56}
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
      isNextDisabled={!isAdWizardSportProfileComplete(state)}
      nextLabel={t('adWizardInfo.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardInfoStepIndex(state)}
      subtitle={isCoachAdWizard(state)
        ? t(
          'adWizardInfo.subtitleCoach',
          'Précise le cadre sportif dans lequel tu recherches un profil coach.',
        )
        : t(
          'adWizardInfo.subtitle',
          'Précise la cible sportive recherchee avant de passer au lieu de publication.',
        )}
      title={t('adWizardInfo.title', 'Ciblage sportif')}
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[40]]}>
        {isTaxonomyLoading ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[24],
              cardSurfaceStyle,
            ]}
          >
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={[Fonts.p2, Fonts.neutral100, Alignments.fill, { lineHeight: 24 }]}>
              {t(
                'adWizardInfo.taxonomy.loading',
                'Chargement des sections, catégories et niveaux disponibles.',
              )}
            </Text>
          </View>
        ) : null}

        {hasTaxonomyError ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[24],
              {
                backgroundColor: 'rgba(53, 19, 24, 0.88)',
                borderColor: 'rgba(239, 68, 68, 0.45)',
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'adWizardInfo.taxonomy.errorTitle',
                "Certaines options n'ont pas pu être chargées",
              )}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
              {t(
                'adWizardInfo.taxonomy.errorBody',
                "Tu peux réessayer pour récupérer toutes les références, ou continuer avec les informations déjà préremplies depuis l'équipe.", // eslint-disable-line max-len
              )}
            </Text>
            <Button
              onPress={handleRetryTaxonomy}
              title={t('adWizardInfo.taxonomy.retry', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {state.team ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[24],
              cardSurfaceStyle,
            ]}
          >
            <View style={[Spaces.gap[24]]}>
              <View style={[Spaces.gap[16]]}>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                  {t('adWizardInfo.team.selected', 'Équipe sélectionnée')}
                </Text>

                <View
                  style={[
                    Alignments.row,
                    Spaces.gap[24],
                    { alignItems: 'flex-start', flex: 1 },
                  ]}
                >
                  {teamIdentityNode}

                  <View style={[Spaces.gap[16], { flex: 1 }]}>
                    <Text numberOfLines={1} style={[Fonts.h4, Fonts.neutral00]}>
                      {state.team?.name || '-'}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}
                    >
                      {state.team?.club?.name || t(
                        'adWizardInfo.team.clubMissing',
                        'Club non renseigné',
                      )}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[Spaces.gap[24]]}>
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
                      minWidth: 168,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                    {t('adWizardInfo.team.change', 'Choisir une autre équipe')}
                  </Text>
                </TouchableOpacity>

                {teamSummaryMeta.length > 0 ? (
                  <View style={[Alignments.row, Alignments.wrap, Spaces.gap[16], Spaces.marginTop[8]]}>
                    {teamSummaryMeta.map((item) => (
                      <View
                        key={item.label}
                        style={[
                          Spaces.paddingHorizontal[16],
                          Spaces.paddingVertical[8],
                          {
                            backgroundColor: 'rgba(1, 179, 244, 0.10)',
                            borderColor: 'rgba(1, 179, 244, 0.18)',
                            borderRadius: 999,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                          {t(
                            'adWizardInfo.teamSummary.item',
                            '{{label}} : {{value}}',
                            { label: item.label, value: item.value, ...SANS_ECHAPPEMENT },
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], cardSurfaceStyle]}>
          <View style={[Spaces.gap[24]]}>
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {isCoachAdWizard(state) ? t(
                  'adWizardInfo.profile.titleCoach',
                  'Contexte du rôle recherche',
                ) : t('adWizardInfo.profile.title', 'Profil recherche')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
                {isCoachAdWizard(state)
                  ? t(
                    'adWizardInfo.profile.bodyCoach',
                    'Précise le sport, la section, la catégorie et le niveau de référence de ton besoin staff.', // eslint-disable-line max-len
                  )
                  : t(
                    'adWizardInfo.profile.body',
                    'Affine la cible de ton annonce avec les bons repères sportifs.',
                  )}
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

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[24], Spaces.marginTop[24]]}>
            <AutocompleteSelect
              displayVariant="card"
              label={t('adWizardInfo.form.section', 'Section *')}
              options={sections}
              placeholder={t('adWizardInfo.form.sectionPlaceholder', 'Sélectionner une section')}
              setValue={handleSectionChange}
              value={currentSectionValue}
              wrapperStyle={{ width: compactFieldWidth }}
            />

            <AutocompleteSelect
              displayVariant="card"
              label={t('adWizardInfo.form.category', 'Catégorie *')}
              options={categories}
              placeholder={t('adWizardInfo.form.categoryPlaceholder', 'Sélectionner une catégorie')}
              setValue={handleCategoryChange}
              value={currentCategoryValue}
              wrapperStyle={{ width: compactFieldWidth }}
            />

            <AutocompleteSelect
              description={t(
                'adWizardInfo.form.levelHelper',
                'Définis le niveau minimum attendu pour candidater.',
              )}
              displayVariant="card"
              label={t('adWizardInfo.form.level', 'Niveau minimum recherché *')}
              options={levels}
              placeholder={t('adWizardInfo.form.levelPlaceholder', 'Sélectionner un niveau')}
              setValue={handleLevelChange}
              value={currentLevelValue}
              wrapperStyle={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardInfo;
