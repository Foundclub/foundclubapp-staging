import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardInfo({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();

  const levelsQuery = useGetLevels();
  const categoriesQuery = useGetCategories();
  const sectionsQuery = useGetSections();

  const allLevels = levelsQuery.data;
  const allCategories = categoriesQuery.data;
  const allSections = sectionsQuery.data;

  const isTaxonomyLoading = levelsQuery.isLoading || categoriesQuery.isLoading || sectionsQuery.isLoading;
  const hasTaxonomyError = Boolean(levelsQuery.error || categoriesQuery.error || sectionsQuery.error);

  const levels = useMemo(() => allLevels?.map(({ documentId, name }) => ({
    label: name,
    value: documentId || '',
  })) || [], [allLevels]);

  const categories = useMemo(() => allCategories?.map(({ documentId, name }) => ({
    label: name,
    value: documentId || '',
  })) || [], [allCategories]);

  const sections = useMemo(() => allSections?.map(({ documentId, name }) => ({
    label: name,
    value: documentId || '',
  })) || [], [allSections]);

  const handleNext = () => {
    if (!state.address) {
      Alert.alert(
        t('common.errors.title', 'Erreur'),
        t('adWizard.errors.missingAddress', 'Veuillez renseigner un lieu pour l\'annonce.'),
      );
      return;
    }

    navigation.navigate(RouteNames.AdWizardPositions);
  };

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non defini';
  const currentSectionValue = state.section?.name || '';
  const currentCategoryValue = state.category?.name || '';
  const currentLevelValue = state.minLevel?.name || '';

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
    void levelsQuery.refetch();
    void categoriesQuery.refetch();
    void sectionsQuery.refetch();
  }, [categoriesQuery, levelsQuery, sectionsQuery]);

  return (
    <WizardStepLayout
      isNextDisabled={!state.address}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={2}
      subtitle="Verifiez et completez les details"
      title="Informations de l'annonce"
    >
      {isTaxonomyLoading ? (
        <View style={[Spaces.marginBottom[24], Spaces.padding[16], {
          alignItems: 'center',
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 12,
        }]}
        >
          <ActivityIndicator color={Colors.primary500} size="small" />
          <Text style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>
            Chargement des sections, categories et niveaux disponibles.
          </Text>
        </View>
      ) : null}

      {hasTaxonomyError ? (
        <View style={[Spaces.marginBottom[24], Spaces.padding[16], {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.error500,
          borderRadius: 16,
          borderWidth: 1,
        }]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
            Certaines options n'ont pas pu etre chargees
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 12 }]}>
            Vous pouvez reessayer pour recuperer tous les referentiels, ou continuer avec les informations deja preremplies.
          </Text>
          <Button onPress={handleRetryTaxonomy} title="Reessayer" variant="Secondary" />
        </View>
      ) : null}

      <View style={{
        backgroundColor: `${Colors.primary500}15`,
        borderColor: Colors.primary500,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 24,
        padding: 16,
      }}
      >
        <Text style={[Fonts.p3, { color: Colors.primary500, marginBottom: 2 }]}>
          Equipe selectionnee
        </Text>
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
          {state.team?.name || 'Non definie'}
        </Text>
        {state.team?.club?.name ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
            {state.team.club.name}
          </Text>
        ) : null}
      </View>

      <View style={[Spaces.marginBottom[24]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Sport</Text>
        <View style={[
          ApplicationStyle.input,
          Alignments.row,
          Alignments.alignCenter,
          { opacity: 0.7 },
        ]}
        >
          <Text style={[Fonts.p1, { color: Colors.primary500 }]}>{sportName}</Text>
        </View>
      </View>

      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Section"
          options={sections}
          placeholder="Selectionner une section"
          setValue={handleSectionChange}
          value={currentSectionValue}
        />
      </View>

      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Categorie"
          options={categories}
          placeholder="Selectionner une categorie"
          setValue={handleCategoryChange}
          value={currentCategoryValue}
        />
      </View>

      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Niveau minimum recherche"
          options={levels}
          placeholder="Selectionner un niveau"
          setValue={handleLevelChange}
          value={currentLevelValue}
        />
      </View>

      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteAddressInput
          address={state.address}
          label={(
            <Text>
              Lieu (Stade, Ville...)
              {' '}
              <Text style={{ color: Colors.error500 }}>*</Text>
            </Text>
          )}
          placeholder="Rechercher une adresse"
          setAddress={(address) => dispatch({ payload: address, type: 'SET_ADDRESS' })}
        />
      </View>

      <View style={{
        alignItems: 'center',
        backgroundColor: Colors.neutral800,
        borderRadius: 12,
        flexDirection: 'row',
        padding: 14,
      }}
      >
        <Text style={{ fontSize: 16, marginRight: 10 }}>i</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
          Ces informations aident les joueurs a trouver votre annonce. Le lieu est obligatoire pour continuer.
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardInfo;
