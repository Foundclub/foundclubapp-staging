import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { useAdWizard } from './AdWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardInfo({ navigation }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();

  // Fetch options from API using queries (same pattern as EventFilters)
  const { data: allLevels } = useGetLevels();
  const { data: allCategories } = useGetCategories();
  const { data: allSections } = useGetSections();

  // Format options for AutocompleteSelect (same format as EventFilters)
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

  // Get current values for display
  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non défini';
  const currentSectionValue = state.section?.name || '';
  const currentCategoryValue = state.category?.name || '';
  const currentLevelValue = state.minLevel?.name || '';

  // Handle selection changes
  const handleSectionChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const section = allSections?.find((s) => s.documentId === option.value);
      dispatch({ payload: section || null, type: 'SET_SECTION' });
    }
  }, [dispatch, allSections]);

  const handleCategoryChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const category = allCategories?.find((c) => c.documentId === option.value);
      dispatch({ payload: category || null, type: 'SET_CATEGORY' });
    }
  }, [dispatch, allCategories]);

  const handleLevelChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const level = allLevels?.find((l) => l.documentId === option.value);
      dispatch({ payload: level || null, type: 'SET_MIN_LEVEL' });
    }
  }, [dispatch, allLevels]);

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      subtitle="Vérifiez et complétez les détails"
      title="Informations de l'annonce"
    >
      {/* Team info header */}
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
          Équipe sélectionnée
        </Text>
        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
          {state.team?.name || 'Non définie'}
        </Text>
        {state.team?.club?.name && (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
            {state.team.club.name}
          </Text>
        )}
      </View>

      {/* Sport - Read only display */}
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

      {/* Section - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Section"
          options={sections}
          placeholder="Sélectionner une section"
          setValue={handleSectionChange}
          value={currentSectionValue}
        />
      </View>

      {/* Category - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Catégorie"
          options={categories}
          placeholder="Sélectionner une catégorie"
          setValue={handleCategoryChange}
          value={currentCategoryValue}
        />
      </View>

      {/* Level - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Niveau minimum recherché"
          options={levels}
          placeholder="Sélectionner un niveau"
          setValue={handleLevelChange}
          value={currentLevelValue}
        />
      </View>

      {/* Address - Using AutocompleteAddressInput */}
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
          setAddress={(addr) => dispatch({ payload: addr, type: 'SET_ADDRESS' })}
        />
      </View>

      {/* Info note */}
      <View style={{
        alignItems: 'center',
        backgroundColor: Colors.neutral800,
        borderRadius: 12,
        flexDirection: 'row',
        padding: 14,
      }}
      >
        <Text style={{ fontSize: 16, marginRight: 10 }}>💡</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
          Ces informations aident les joueurs à trouver votre annonce.
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardInfo;
