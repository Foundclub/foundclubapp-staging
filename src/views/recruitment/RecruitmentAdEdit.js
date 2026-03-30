import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Joi from 'joi';
import React, { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { getRecruitmentAd, updateRecruitmentAd } from '@/services/recruitment/recruitmentService';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

const schema = Joi.object({
  category: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  description: Joi.string().allow('').optional(),
  level: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  position: Joi.string().required().messages({
    'string.empty': 'Le poste est requis',
  }),
  quantity: Joi.number().min(1).required(),
  section: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
});

const buildDefaultValues = (ad) => ({
  category: ad?.category || null,
  description: ad?.description || '',
  level: ad?.level || null,
  position: ad?.position || '',
  quantity: ad?.quantity || 1,
  section: ad?.section || null,
});

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function RecruitmentAdEdit({ navigation, route }) {
  const { ad, adId } = route.params || {};
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resolvedAdId = ad?.documentId || ad?.id || adId;
  const {
    data: fetchedAd,
    error: adError,
    isLoading: isAdLoading,
    refetch: refetchAd,
  } = useQuery({
    enabled: Boolean(!ad && resolvedAdId),
    queryFn: () => getRecruitmentAd(resolvedAdId),
    queryKey: ['recruitmentAd', resolvedAdId],
  });
  const resolvedAd = fetchedAd || ad || null;

  const {
    control, formState: { errors }, handleSubmit, reset, setValue, watch,
  } = useForm({
    defaultValues: buildDefaultValues(ad),
    resolver: joiResolver(schema),
  });

  useEffect(() => {
    if (!resolvedAd) return;
    reset(buildDefaultValues(resolvedAd));
  }, [resolvedAd, reset]);

  // Fetch options
  const { data: allLevels } = useGetLevels();
  const { data: allCategories } = useGetCategories();
  const { data: allSections } = useGetSections();

  const levelOptions = useMemo(() => allLevels?.map((l) => ({ label: l.name, value: l.documentId })) || [], [allLevels]);
  const categoryOptions = useMemo(() => allCategories?.map((c) => ({ label: c.name, value: c.documentId })) || [], [allCategories]);
  const sectionOptions = useMemo(() => allSections?.map((s) => ({ label: s.name, value: s.documentId })) || [], [allSections]);

  const watchedLevel = watch('level');
  const watchedCategory = watch('category');
  const watchedSection = watch('section');
  const watchedQuantity = watch('quantity');

  const updateMutation = useMutation({
    mutationFn: (data) => updateRecruitmentAd(resolvedAdId, data),
    onError: (error) => {
      console.error('Error updating ad:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'annonce.');
    },
    onSuccess: (updatedAd) => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', resolvedAdId] });

      Alert.alert(
        'Succès',
        'L\'annonce a été mise à jour avec succès.',
        [{ onPress: () => navigation.goBack(), text: 'OK' }],
      );
    },
  });

  const onSubmit = (data) => {
    const payload = {
      category: data.category?.documentId || data.category?.id || (data.category?.value) || null,
      description: data.description,
      level: data.level?.documentId || data.level?.id || (data.level?.value /* from option */) || null,
      position: data.position,
      quantity: data.quantity,
      section: data.section?.documentId || data.section?.id || (data.section?.value) || null,
    };

    // Clean up IDs if they were objects from options
    if (data.level && typeof data.level === 'object' && data.level.value) payload.level = data.level.value;
    if (data.category && typeof data.category === 'object' && data.category.value) payload.category = data.category.value;
    if (data.section && typeof data.section === 'object' && data.section.value) payload.section = data.section.value;

    const { adId, ...rest } = payload; // Ensure adId isn't in payload if it somehow got there

    updateMutation.mutate(payload);
  };

  if (isAdLoading) {
    return (
      <ScreenContainer
        bgImage="bg2"
        onGoBack={() => navigation.goBack()}
        title="Modifier l'annonce"
      >
        <View style={[Spaces.padding[16], { gap: 12 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Chargement de l'annonce...</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            Preparation du formulaire d'edition.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (adError) {
    return (
      <ScreenContainer
        bgImage="bg2"
        onGoBack={() => navigation.goBack()}
        title="Modifier l'annonce"
      >
        <View style={[Spaces.padding[16], { gap: 16 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.error500 }]}>Chargement impossible</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {adError?.message || 'Impossible de charger cette annonce.'}
          </Text>
          <Button
            onPress={() => refetchAd()}
            title="Recharger"
            variant="Primary"
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!resolvedAd) {
    return (
      <ScreenContainer
        bgImage="bg2"
        onGoBack={() => navigation.goBack()}
        title="Modifier l'annonce"
      >
        <View style={[Spaces.padding[16], { gap: 12 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Annonce introuvable</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            Cette annonce n'est plus disponible ou ne peut pas etre modifiee depuis ce lien.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2" // Match other pages
      onGoBack={() => navigation.goBack()}
      title="Modifier l'annonce"
    >
      <ScrollView contentContainerStyle={Spaces.padding[16]} showsVerticalScrollIndicator={false}>

        {/* Team Info (Read Only) */}
        <View style={[Spaces.marginBottom[24], { opacity: 0.7 }]}>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 4 }]}>Équipe</Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{resolvedAd.team?.name || 'Équipe inconnue'}</Text>
        </View>

        {/* Position */}
        <View style={Spaces.marginBottom[16]}>
          <Controller
            control={control}
            name="position"
            render={({ field: { onChange, value } }) => (
              <Input
                error={errors.position?.message}
                label="Poste"
                onChangeText={onChange}
                placeholder="Ex: Attaquant, Gardien..."
                value={value}
              />
            )}
          />
        </View>

        {/* Quantity */}
        <View style={Spaces.marginBottom[24]}>
          <InputStepper
            label="Nombre de joueurs recherchés"
            max={20}
            min={1}
            onDecrement={() => setValue('quantity', Math.max(1, watchedQuantity - 1))}
            onIncrement={() => setValue('quantity', watchedQuantity + 1)}
            value={watchedQuantity}
          />
        </View>

        {/* Level */}
        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label="Niveau minimum"
            options={levelOptions}
            placeholder="Sélectionner un niveau"
            setValue={(option) => {
              // Find full object if possible or just set option
              const levelObj = allLevels?.find((l) => l.documentId === option.value);
              setValue('level', levelObj || option);
            }}
            value={watchedLevel?.name || (levelOptions.find((o) => o.value === watchedLevel)?.label) || ''}
          />
        </View>

        {/* Category */}
        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label="Catégorie"
            options={categoryOptions}
            placeholder="Sélectionner une catégorie"
            setValue={(option) => {
              const catObj = allCategories?.find((c) => c.documentId === option.value);
              setValue('category', catObj || option);
            }}
            value={watchedCategory?.name || (categoryOptions.find((o) => o.value === watchedCategory)?.label) || ''}
          />
        </View>

        {/* Section */}
        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label="Section"
            options={sectionOptions}
            placeholder="Sélectionner une section"
            setValue={(option) => {
              const secObj = allSections?.find((s) => s.documentId === option.value);
              setValue('section', secObj || option);
            }}
            value={watchedSection?.name || (sectionOptions.find((o) => o.value === watchedSection)?.label) || ''}
          />
        </View>

        {/* Description */}
        <View style={Spaces.marginBottom[32]}>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input
                height={120}
                label="Description"
                multiline
                numberOfLines={4}
                onChangeText={onChange}
                placeholder="Détails supplémentaires..."
                textAlignVertical="top"
                value={value}
              />
            )}
          />
        </View>

        {/* Submit Button */}
        <Button
          isLoading={updateMutation.isPending}
          onPress={handleSubmit(onSubmit)}
          title="Enregistrer les modifications"
          variant="Primary"
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default RecruitmentAdEdit;
