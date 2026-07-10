import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Joi from 'joi';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert, ScrollView, Text, View,
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

const schema = Joi.object({
  availabilityText: Joi.string().allow('').optional(),
  category: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  certificationsWanted: Joi.alternatives().try(Joi.array(), Joi.string()).optional(),
  coachExperienceLevel: Joi.string().allow('').optional(),
  coachRole: Joi.string().allow('').optional(),
  coachRoleOther: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
  engagementType: Joi.string().allow('').optional(),
  level: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  missions: Joi.string().allow('').optional(),
  position: Joi.string().allow('').optional(),
  quantity: Joi.number().min(1).required(),
  section: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
});

const buildDefaultValues = (ad) => ({
  availabilityText: ad?.availabilityText || '',
  category: ad?.category || null,
  certificationsWanted: Array.isArray(ad?.certificationsWanted) ? ad.certificationsWanted.join(', ') : '',
  coachExperienceLevel: ad?.coachExperienceLevel || '',
  coachRole: ad?.coachRole || '',
  coachRoleOther: ad?.coachRoleOther || '',
  description: ad?.description || '',
  engagementType: ad?.engagementType || '',
  level: ad?.level || null,
  missions: ad?.missions || '',
  position: ad?.position || '',
  quantity: ad?.quantity || 1,
  section: ad?.section || null,
});

const COACH_ROLE_OPTIONS = [
  { label: 'Entraîneur·e principal·e', value: 'entraineur_principal' },
  { label: 'Entraineur adjoint', value: 'entraineur_adjoint' },
  { label: 'Preparateur physique', value: 'preparateur_physique' },
  { label: 'Entraineur gardiens', value: 'entraineur_gardiens' },
  { label: 'Analyste video', value: 'analyste_video' },
  { label: 'Team manager', value: 'team_manager' },
  { label: 'Autre role', value: 'other' },
];

const COACH_EXPERIENCE_OPTIONS = [
  { label: 'Junior', value: 'junior' },
  { label: 'Confirme', value: 'confirme' },
  { label: 'Experimente', value: 'experimente' },
  { label: 'Diplome', value: 'diplome' },
];

const ENGAGEMENT_OPTIONS = [
  { label: 'Benevole', value: 'benevole' },
  { label: 'Indemnise', value: 'indemnise' },
  { label: 'Salarie', value: 'salarie' },
  { label: 'A definir', value: 'a_definir' },
];

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function RecruitmentAdEdit({ navigation, route }) {
  const { ad, adId } = route.params || {};
  const { Colors, Fonts, Spaces } = useTheme();
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
  const isCoachAd = String(resolvedAd?.audienceType || '').trim().toLowerCase() === 'coach';

  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm({
    defaultValues: buildDefaultValues(ad),
    resolver: joiResolver(schema),
  });

  useEffect(() => {
    if (!resolvedAd) return;
    reset(buildDefaultValues(resolvedAd));
  }, [resolvedAd, reset]);

  const { data: allLevels } = useGetLevels();
  const { data: allCategories } = useGetCategories();
  const { data: allSections } = useGetSections();

  const levelOptions = useMemo(
    () => allLevels?.map((level) => ({ label: level.name, value: level.documentId })) || [],
    [allLevels],
  );
  const categoryOptions = useMemo(
    () => allCategories?.map((category) => ({ label: category.name, value: category.documentId })) || [],
    [allCategories],
  );
  const sectionOptions = useMemo(
    () => allSections?.map((section) => ({ label: section.name, value: section.documentId })) || [],
    [allSections],
  );

  const watchedCategory = watch('category');
  const watchedCoachExperienceLevel = watch('coachExperienceLevel');
  const watchedCoachRole = watch('coachRole');
  const watchedEngagementType = watch('engagementType');
  const watchedLevel = watch('level');
  const watchedQuantity = watch('quantity');
  const watchedSection = watch('section');

  const updateMutation = useMutation({
    mutationFn: (data) => updateRecruitmentAd(resolvedAdId, data),
    onError: () => {
      Alert.alert('Erreur', "Impossible de mettre a jour l'annonce.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', resolvedAdId] });

      Alert.alert(
        'Succes',
        "L'annonce a ete mise a jour avec succes.",
        [{ onPress: () => navigation.goBack(), text: 'OK' }],
      );
    },
  });

  const onSubmit = (data) => {
    if (isCoachAd) {
      if (!String(data.coachRole || '').trim()) {
        Alert.alert('Erreur', 'Le role entraineur est requis.');
        return;
      }

      if (data.coachRole === 'other' && !String(data.coachRoleOther || '').trim()) {
        Alert.alert('Erreur', 'Precisez le role entraineur recherche.');
        return;
      }
    } else if (!String(data.position || '').trim()) {
      Alert.alert('Erreur', 'Le poste est requis.');
      return;
    }

    const payload = {
      availabilityText: isCoachAd ? data.availabilityText || null : null,
      category: data.category?.documentId || data.category?.id || data.category?.value || null,
      certificationsWanted: isCoachAd
        ? String(data.certificationsWanted || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        : [],
      coachExperienceLevel: isCoachAd ? data.coachExperienceLevel || null : null,
      coachRole: isCoachAd ? data.coachRole || null : null,
      coachRoleOther: isCoachAd && data.coachRole === 'other' ? data.coachRoleOther || null : null,
      description: data.description,
      engagementType: isCoachAd ? data.engagementType || null : null,
      level: data.level?.documentId || data.level?.id || data.level?.value || null,
      missions: isCoachAd ? data.missions || null : null,
      position: isCoachAd ? null : data.position,
      quantity: data.quantity,
      section: data.section?.documentId || data.section?.id || data.section?.value || null,
    };

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
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Chargement de l&rsquo;annonce...</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Preparation du formulaire d&rsquo;edition.</Text>
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
            Cette annonce n&rsquo;est plus disponible ou ne peut pas etre modifiee depuis ce lien.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      onGoBack={() => navigation.goBack()}
      title="Modifier l'annonce"
    >
      <ScrollView contentContainerStyle={Spaces.padding[16]} showsVerticalScrollIndicator={false}>
        <View style={[Spaces.marginBottom[24], { opacity: 0.7 }]}>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 4 }]}>Equipe</Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {resolvedAd.team?.name || 'Equipe inconnue'}
          </Text>
        </View>

        {!isCoachAd ? (
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
        ) : (
          <>
            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label="Role entraineur"
                options={COACH_ROLE_OPTIONS}
                placeholder="Selectionner un role"
                setValue={(option) => setValue('coachRole', option.value)}
                value={COACH_ROLE_OPTIONS.find((option) => option.value === watchedCoachRole)?.label || ''}
              />
            </View>

            {watchedCoachRole === 'other' ? (
              <View style={Spaces.marginBottom[24]}>
                <Controller
                  control={control}
                  name="coachRoleOther"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Autre role"
                      onChangeText={onChange}
                      placeholder="Precisez le role recherche"
                      value={value}
                    />
                  )}
                />
              </View>
            ) : null}

            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label="Experience attendue"
                options={COACH_EXPERIENCE_OPTIONS}
                placeholder="Selectionner un niveau"
                setValue={(option) => setValue('coachExperienceLevel', option.value)}
                value={COACH_EXPERIENCE_OPTIONS.find((option) => option.value === watchedCoachExperienceLevel)?.label || ''}
              />
            </View>

            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label="Type d'engagement"
                options={ENGAGEMENT_OPTIONS}
                placeholder="Selectionner un cadre"
                setValue={(option) => setValue('engagementType', option.value)}
                value={ENGAGEMENT_OPTIONS.find((option) => option.value === watchedEngagementType)?.label || ''}
              />
            </View>
          </>
        )}

        <View style={Spaces.marginBottom[24]}>
          <InputStepper
            label={isCoachAd ? 'Nombre de profils recherches' : 'Nombre de joueurs recherches'}
            max={20}
            min={1}
            onDecrement={() => setValue('quantity', Math.max(1, watchedQuantity - 1))}
            onIncrement={() => setValue('quantity', watchedQuantity + 1)}
            value={watchedQuantity}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label={isCoachAd ? 'Niveau souhaite' : 'Niveau minimum'}
            options={levelOptions}
            placeholder="Selectionner un niveau"
            setValue={(option) => {
              const levelObj = allLevels?.find((level) => level.documentId === option.value);
              setValue('level', levelObj || option);
            }}
            value={watchedLevel?.name || levelOptions.find((option) => option.value === watchedLevel)?.label || ''}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label="Categorie"
            options={categoryOptions}
            placeholder="Selectionner une categorie"
            setValue={(option) => {
              const categoryObj = allCategories?.find((category) => category.documentId === option.value);
              setValue('category', categoryObj || option);
            }}
            value={watchedCategory?.name || categoryOptions.find((option) => option.value === watchedCategory)?.label || ''}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label="Section"
            options={sectionOptions}
            placeholder="Selectionner une section"
            setValue={(option) => {
              const sectionObj = allSections?.find((section) => section.documentId === option.value);
              setValue('section', sectionObj || option);
            }}
            value={watchedSection?.name || sectionOptions.find((option) => option.value === watchedSection)?.label || ''}
          />
        </View>

        {isCoachAd ? (
          <>
            <View style={Spaces.marginBottom[24]}>
              <Controller
                control={control}
                name="availabilityText"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Disponibilites"
                    onChangeText={onChange}
                    placeholder="Ex: soirs de semaine, mercredi, week-end..."
                    value={value}
                  />
                )}
              />
            </View>

            <View style={Spaces.marginBottom[24]}>
              <Controller
                control={control}
                name="certificationsWanted"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Certifications souhaitees"
                    onChangeText={onChange}
                    placeholder="Ex: BMF, BPJEPS, formation jeunes"
                    value={value}
                  />
                )}
              />
            </View>

            <View style={Spaces.marginBottom[24]}>
              <Controller
                control={control}
                name="missions"
                render={({ field: { onChange, value } }) => (
                  <Input
                    height={120}
                    label="Missions"
                    multiline
                    numberOfLines={4}
                    onChangeText={onChange}
                    placeholder="Cadre, responsabilites, projet d'equipe..."
                    textAlignVertical="top"
                    value={value}
                  />
                )}
              />
            </View>
          </>
        ) : null}

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
                placeholder={isCoachAd ? 'Contexte du club, projet, environnement...' : 'Details supplementaires...'}
                textAlignVertical="top"
                value={value}
              />
            )}
          />
        </View>

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
