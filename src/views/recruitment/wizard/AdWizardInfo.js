import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetSections } from '@/services/section/sectionQueries';

const AdWizardInfo = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();
  
  // Fetch options from API using queries (same pattern as EventFilters)
  const { data: allLevels } = useGetLevels();
  const { data: allCategories } = useGetCategories();
  const { data: allSections } = useGetSections();

  // Format options for AutocompleteSelect (same format as EventFilters)
  const levels = useMemo(() => {
    return allLevels?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];
  }, [allLevels]);

  const categories = useMemo(() => {
    return allCategories?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];
  }, [allCategories]);

  const sections = useMemo(() => {
    return allSections?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];
  }, [allSections]);

  const handleNext = () => {
    if (!state.address) {
      Alert.alert(
        t('common.errors.title', 'Erreur'),
        t('adWizard.errors.missingAddress', 'Veuillez renseigner un lieu pour l\'annonce.')
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
      const section = allSections?.find(s => s.documentId === option.value);
      dispatch({ type: 'SET_SECTION', payload: section || null });
    }
  }, [dispatch, allSections]);

  const handleCategoryChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const category = allCategories?.find(c => c.documentId === option.value);
      dispatch({ type: 'SET_CATEGORY', payload: category || null });
    }
  }, [dispatch, allCategories]);

  const handleLevelChange = useCallback((option) => {
    if (option && !Array.isArray(option)) {
      const level = allLevels?.find(l => l.documentId === option.value);
      dispatch({ type: 'SET_MIN_LEVEL', payload: level || null });
    }
  }, [dispatch, allLevels]);

  return (
    <WizardStepLayout
      title="Informations de l'annonce"
      subtitle="Vérifiez et complétez les détails"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      nextLabel="Suivant"
    >
      {/* Team info header */}
      <View style={{
        backgroundColor: Colors.primary500 + '15',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.primary500,
        padding: 16,
        marginBottom: 24,
      }}>
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
          { opacity: 0.7 }
        ]}>
          <Text style={[Fonts.p1, { color: Colors.primary500 }]}>{sportName}</Text>
        </View>
      </View>

      {/* Section - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Section"
          options={sections}
          placeholder="Sélectionner une section"
          value={currentSectionValue}
          setValue={handleSectionChange}
        />
      </View>

      {/* Category - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Catégorie"
          options={categories}
          placeholder="Sélectionner une catégorie"
          value={currentCategoryValue}
          setValue={handleCategoryChange}
        />
      </View>

      {/* Level - Using AutocompleteSelect like in EventFilters */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteSelect
          label="Niveau minimum recherché"
          options={levels}
          placeholder="Sélectionner un niveau"
          value={currentLevelValue}
          setValue={handleLevelChange}
        />
      </View>

      {/* Address - Using AutocompleteAddressInput */}
      <View style={[Spaces.marginBottom[24]]}>
        <AutocompleteAddressInput
          label={
            <Text>
              Lieu (Stade, Ville...) <Text style={{ color: Colors.error500 }}>*</Text>
            </Text>
          }
          placeholder="Rechercher une adresse"
          address={state.address}
          setAddress={(addr) => dispatch({ type: 'SET_ADDRESS', payload: addr })}
        />
      </View>

      {/* Info note */}
      <View style={{
        padding: 14,
        backgroundColor: Colors.neutral800,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 16, marginRight: 10 }}>💡</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
          Ces informations aident les joueurs à trouver votre annonce.
        </Text>
      </View>
    </WizardStepLayout>
  );
};

export default AdWizardInfo;
