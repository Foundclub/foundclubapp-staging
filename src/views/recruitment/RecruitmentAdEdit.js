
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { joiResolver } from '@hookform/resolvers/joi';
import Joi from 'joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import Input from '@/components/molecules/input/Input';
import Button from '@/components/atoms/button/Button';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { updateRecruitmentAd } from '@/services/recruitment/recruitmentService';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

const schema = Joi.object({
  position: Joi.string().required().messages({
    'string.empty': 'Le poste est requis',
  }),
  description: Joi.string().allow('').optional(),
  quantity: Joi.number().min(1).required(),
  level: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  category: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  section: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
});

const RecruitmentAdEdit = ({ route, navigation }) => {
  const { adId, ad } = route.params || {};
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    resolver: joiResolver(schema),
    defaultValues: {
      position: ad?.position || '',
      description: ad?.description || '',
      quantity: ad?.quantity || 1,
      level: ad?.level || null,
      category: ad?.category || null,
      section: ad?.section || null,
    },
  });

  // Fetch options
  const { data: allLevels } = useGetLevels();
  const { data: allCategories } = useGetCategories();
  const { data: allSections } = useGetSections();

  const levelOptions = useMemo(() => allLevels?.map(l => ({ label: l.name, value: l.documentId })) || [], [allLevels]);
  const categoryOptions = useMemo(() => allCategories?.map(c => ({ label: c.name, value: c.documentId })) || [], [allCategories]);
  const sectionOptions = useMemo(() => allSections?.map(s => ({ label: s.name, value: s.documentId })) || [], [allSections]);

  const watchedLevel = watch('level');
  const watchedCategory = watch('category');
  const watchedSection = watch('section');
  const watchedQuantity = watch('quantity');

  const updateMutation = useMutation({
    mutationFn: (data) => updateRecruitmentAd(adId, data),
    onSuccess: (updatedAd) => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', adId] }); // Invalidate specific ad if cached
      
      Alert.alert(
        'Succès',
        'L\'annonce a été mise à jour avec succès.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error) => {
      console.error('Error updating ad:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'annonce.');
    },
  });

  const onSubmit = (data) => {
    const payload = {
      position: data.position,
      description: data.description,
      quantity: data.quantity,
      level: data.level?.documentId || data.level?.id || (data.level?.value /* from option */) || null,
      category: data.category?.documentId || data.category?.id || (data.category?.value) || null,
      section: data.section?.documentId || data.section?.id || (data.section?.value) || null,
    };
    
    // Clean up IDs if they were objects from options
    if (data.level && typeof data.level === 'object' && data.level.value) payload.level = data.level.value;
    if (data.category && typeof data.category === 'object' && data.category.value) payload.category = data.category.value;
    if (data.section && typeof data.section === 'object' && data.section.value) payload.section = data.section.value;

    const { adId, ...rest } = payload; // Ensure adId isn't in payload if it somehow got there
    
    updateMutation.mutate(payload);
  };

  if (!ad) return null;

  return (
    <ScreenContainer
      title="Modifier l'annonce"
      bgImage="bg2" // Match other pages
      onGoBack={() => navigation.goBack()}
    >
      <ScrollView contentContainerStyle={Spaces.padding[16]} showsVerticalScrollIndicator={false}>
        
        {/* Team Info (Read Only) */}
        <View style={[Spaces.marginBottom[24], { opacity: 0.7 }]}>
           <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 4 }]}>Équipe</Text>
           <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{ad.team?.name || 'Équipe inconnue'}</Text>
        </View>

        {/* Position */}
        <View style={Spaces.marginBottom[16]}>
          <Controller
            control={control}
            name="position"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Poste"
                placeholder="Ex: Attaquant, Gardien..."
                value={value}
                onChangeText={onChange}
                error={errors.position?.message}
              />
            )}
          />
        </View>

        {/* Quantity */}
        <View style={Spaces.marginBottom[24]}>
            <InputStepper
                label="Nombre de joueurs recherchés"
                value={watchedQuantity}
                onIncrement={() => setValue('quantity', watchedQuantity + 1)}
                onDecrement={() => setValue('quantity', Math.max(1, watchedQuantity - 1))}
                min={1}
                max={20}
            />
        </View>

        {/* Level */}
        <View style={Spaces.marginBottom[24]}>
            <AutocompleteSelect
                label="Niveau minimum"
                placeholder="Sélectionner un niveau"
                options={levelOptions}
                value={watchedLevel?.name || (levelOptions.find(o => o.value === watchedLevel)?.label) || ''}
                setValue={(option) => {
                     // Find full object if possible or just set option
                     const levelObj = allLevels?.find(l => l.documentId === option.value);
                     setValue('level', levelObj || option);
                }}
            />
        </View>

        {/* Category */}
        <View style={Spaces.marginBottom[24]}>
            <AutocompleteSelect
                label="Catégorie"
                placeholder="Sélectionner une catégorie"
                options={categoryOptions}
                value={watchedCategory?.name || (categoryOptions.find(o => o.value === watchedCategory)?.label) || ''}
                setValue={(option) => {
                     const catObj = allCategories?.find(c => c.documentId === option.value);
                     setValue('category', catObj || option);
                }}
            />
        </View>

        {/* Section */}
        <View style={Spaces.marginBottom[24]}>
            <AutocompleteSelect
                label="Section"
                placeholder="Sélectionner une section"
                options={sectionOptions}
                value={watchedSection?.name || (sectionOptions.find(o => o.value === watchedSection)?.label) || ''}
                setValue={(option) => {
                     const secObj = allSections?.find(s => s.documentId === option.value);
                     setValue('section', secObj || option);
                }}
            />
        </View>

        {/* Description */}
        <View style={Spaces.marginBottom[32]}>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Description"
                placeholder="Détails supplémentaires..."
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={4}
                height={120}
                textAlignVertical="top"
              />
            )}
          />
        </View>

        {/* Submit Button */}
        <Button
          title="Enregistrer les modifications"
          variant="Primary"
          onPress={handleSubmit(onSubmit)}
          isLoading={updateMutation.isPending}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
};

export default RecruitmentAdEdit;
