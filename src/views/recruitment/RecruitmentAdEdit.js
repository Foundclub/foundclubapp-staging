import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import Joi from 'joi';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.main', 'Entraîneur·e principal·e');
    },
    value: 'entraineur_principal',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.assistant', 'Entraîneur adjoint');
    },
    value: 'entraineur_adjoint',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.fitness', 'Préparateur physique');
    },
    value: 'preparateur_physique',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.goalkeeper', 'Entraîneur gardiens');
    },
    value: 'entraineur_gardiens',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.videoAnalyst', 'Analyste vidéo');
    },
    value: 'analyste_video',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.teamManager', 'Team manager');
    },
    value: 'team_manager',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachRoles.other', 'Autre rôle');
    },
    value: 'other',
  },
];

const COACH_EXPERIENCE_OPTIONS = [
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachExperience.junior', 'Junior');
    },
    value: 'junior',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachExperience.confirmed', 'Confirme');
    },
    value: 'confirme',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachExperience.expert', 'Experimente');
    },
    value: 'experimente',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.coachExperience.qualified', 'Diplome');
    },
    value: 'diplome',
  },
];

const ENGAGEMENT_OPTIONS = [
  {
    get label() {
      return i18next.t('recruitmentAdEdit.engagement.volunteer', 'Benevole');
    },
    value: 'benevole',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.engagement.expenses', 'Indemnise');
    },
    value: 'indemnise',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.engagement.salaried', 'Salarie');
    },
    value: 'salarie',
  },
  {
    get label() {
      return i18next.t('recruitmentAdEdit.engagement.toBeDefined', 'A définir');
    },
    value: 'a_definir',
  },
];

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function RecruitmentAdEdit({ navigation, route }) {
  const { t } = useTranslation();
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
      Alert.alert(t('recruitmentAdEdit.alerts.errorTitle', 'Erreur'), t(
        'recruitmentAdEdit.alerts.updateError',
        "Impossible de mettre à jour l'annonce.",
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', resolvedAdId] });

      Alert.alert(
        t('recruitmentAdEdit.alerts.successTitle', 'Succès'),
        t('recruitmentAdEdit.alerts.updateSuccess', "L'annonce a été mise à jour avec succès."),
        [{ onPress: () => navigation.goBack(), text: t('recruitmentAdEdit.alerts.ok', 'OK') }],
      );
    },
  });

  const onSubmit = (data) => {
    if (isCoachAd) {
      if (!String(data.coachRole || '').trim()) {
        Alert.alert(t('recruitmentAdEdit.alerts.errorTitle', 'Erreur'), t(
          'recruitmentAdEdit.alerts.coachRoleRequired',
          'Le rôle entraîneur est requis.',
        ));
        return;
      }

      if (data.coachRole === 'other' && !String(data.coachRoleOther || '').trim()) {
        Alert.alert(t('recruitmentAdEdit.alerts.errorTitle', 'Erreur'), t(
          'recruitmentAdEdit.alerts.coachRoleOtherRequired',
          'Précise le rôle entraîneur recherche.',
        ));
        return;
      }
    } else if (!String(data.position || '').trim()) {
      Alert.alert(t('recruitmentAdEdit.alerts.errorTitle', 'Erreur'), t(
        'recruitmentAdEdit.alerts.positionRequired',
        'Le poste est requis.',
      ));
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
        title={t('recruitmentAdEdit.title', "Modifier l'annonce")}
      >
        <View style={[Spaces.padding[16], { gap: 12 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {t('recruitmentAdEdit.state.loadingTitle', 'Chargement de l’annonce...')}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t('recruitmentAdEdit.state.loadingBody', 'Préparation du formulaire d’édition.')}
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
        title={t('recruitmentAdEdit.title', "Modifier l'annonce")}
      >
        <View style={[Spaces.padding[16], { gap: 16 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.error500 }]}>
            {t('recruitmentAdEdit.state.loadErrorTitle', 'Chargement impossible')}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {adError?.message || t(
              'recruitmentAdEdit.state.loadErrorBody',
              'Impossible de charger cette annonce.',
            )}
          </Text>
          <Button
            onPress={() => refetchAd()}
            title={t('recruitmentAdEdit.state.reload', 'Recharger')}
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
        title={t('recruitmentAdEdit.title', "Modifier l'annonce")}
      >
        <View style={[Spaces.padding[16], { gap: 12 }]}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {t('recruitmentAdEdit.state.notFoundTitle', 'Annonce introuvable')}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t(
              'recruitmentAdEdit.state.notFoundBody',
              'Cette annonce n’est plus disponible ou ne peut pas etre modifiee depuis ce lien.',
            )}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      onGoBack={() => navigation.goBack()}
      title={t('recruitmentAdEdit.title', "Modifier l'annonce")}
    >
      <ScrollView contentContainerStyle={Spaces.padding[16]} showsVerticalScrollIndicator={false}>
        <View style={[Spaces.marginBottom[24], { opacity: 0.7 }]}>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 4 }]}>
            {t('recruitmentAdEdit.form.team', 'Équipe')}
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            {resolvedAd.team?.name || t('recruitmentAdEdit.form.unknownTeam', 'Équipe inconnue')}
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
                  label={t('recruitmentAdEdit.form.position', 'Poste')}
                  onChangeText={onChange}
                  placeholder={t(
                    'recruitmentAdEdit.form.positionPlaceholder',
                    'Ex: Attaquant, Gardien...',
                  )}
                  value={value}
                />
              )}
            />
          </View>
        ) : (
          <>
            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label={t('recruitmentAdEdit.form.coachRole', 'Rôle entraîneur')}
                options={COACH_ROLE_OPTIONS}
                placeholder={t(
                  'recruitmentAdEdit.form.coachRolePlaceholder',
                  'Sélectionner un rôle',
                )}
                setValue={(option) => setValue('coachRole', option?.value || '')}
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
                      label={t('recruitmentAdEdit.form.coachRoleOther', 'Autre rôle')}
                      onChangeText={onChange}
                      placeholder={t(
                        'recruitmentAdEdit.form.coachRoleOtherPlaceholder',
                        'Précise le rôle recherche',
                      )}
                      value={value}
                    />
                  )}
                />
              </View>
            ) : null}

            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label={t('recruitmentAdEdit.form.coachExperience', 'Expérience attendue')}
                options={COACH_EXPERIENCE_OPTIONS}
                placeholder={t('recruitmentAdEdit.form.levelPlaceholder', 'Sélectionner un niveau')}
                setValue={(option) => setValue('coachExperienceLevel', option?.value || '')}
                value={COACH_EXPERIENCE_OPTIONS.find((option) => option.value === watchedCoachExperienceLevel)?.label || ''}
              />
            </View>

            <View style={Spaces.marginBottom[24]}>
              <AutocompleteSelect
                label={t('recruitmentAdEdit.form.engagementType', "Type d'engagement")}
                options={ENGAGEMENT_OPTIONS}
                placeholder={t(
                  'recruitmentAdEdit.form.engagementPlaceholder',
                  'Sélectionner un cadre',
                )}
                setValue={(option) => setValue('engagementType', option?.value || '')}
                value={ENGAGEMENT_OPTIONS.find((option) => option.value === watchedEngagementType)?.label || ''}
              />
            </View>
          </>
        )}

        <View style={Spaces.marginBottom[24]}>
          <InputStepper
            label={isCoachAd ? t(
              'recruitmentAdEdit.form.quantityCoach',
              'Nombre de profils recherches',
            ) : t(
              'recruitmentAdEdit.form.quantityPlayers',
              'Nombre de joueurs recherches',
            )}
            max={20}
            min={1}
            onDecrement={() => setValue('quantity', Math.max(1, watchedQuantity - 1))}
            onIncrement={() => setValue('quantity', watchedQuantity + 1)}
            value={watchedQuantity}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label={isCoachAd ? t('recruitmentAdEdit.form.levelCoach', 'Niveau souhaite') : t(
              'recruitmentAdEdit.form.levelPlayers',
              'Niveau minimum',
            )}
            options={levelOptions}
            placeholder={t('recruitmentAdEdit.form.levelPlaceholder', 'Sélectionner un niveau')}
            setValue={(option) => {
              const levelObj = allLevels?.find((level) => level.documentId === option?.value);
              setValue('level', levelObj || option || null);
            }}
            value={watchedLevel?.name || levelOptions.find((option) => option.value === watchedLevel)?.label || ''}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label={t('recruitmentAdEdit.form.category', 'Categorie')}
            options={categoryOptions}
            placeholder={t(
              'recruitmentAdEdit.form.categoryPlaceholder',
              'Sélectionner une catégorie',
            )}
            setValue={(option) => {
              const categoryObj = allCategories?.find((category) => category.documentId === option?.value);
              setValue('category', categoryObj || option || null);
            }}
            value={watchedCategory?.name || categoryOptions.find((option) => option.value === watchedCategory)?.label || ''}
          />
        </View>

        <View style={Spaces.marginBottom[24]}>
          <AutocompleteSelect
            label={t('recruitmentAdEdit.form.section', 'Section')}
            options={sectionOptions}
            placeholder={t('recruitmentAdEdit.form.sectionPlaceholder', 'Sélectionner une section')}
            setValue={(option) => {
              const sectionObj = allSections?.find((section) => section.documentId === option?.value);
              setValue('section', sectionObj || option || null);
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
                    label={t('recruitmentAdEdit.form.availability', 'Disponibilites')}
                    onChangeText={onChange}
                    placeholder={t(
                      'recruitmentAdEdit.form.availabilityPlaceholder',
                      'Ex: soirs de semaine, mercredi, week-end...',
                    )}
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
                    label={t('recruitmentAdEdit.form.certifications', 'Certifications souhaitées')}
                    onChangeText={onChange}
                    placeholder={t(
                      'recruitmentAdEdit.form.certificationsPlaceholder',
                      'Ex: BMF, BPJEPS, formation jeunes',
                    )}
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
                    label={t('recruitmentAdEdit.form.missions', 'Missions')}
                    multiline
                    numberOfLines={4}
                    onChangeText={onChange}
                    placeholder={t(
                      'recruitmentAdEdit.form.missionsPlaceholder',
                      "Cadre, responsabilités, projet d'équipe...",
                    )}
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
                label={t('recruitmentAdEdit.form.description', 'Description')}
                multiline
                numberOfLines={4}
                onChangeText={onChange}
                placeholder={isCoachAd ? t(
                  'recruitmentAdEdit.form.descriptionPlaceholderCoach',
                  'Contexte du club, projet, environnement...',
                ) : t(
                  'recruitmentAdEdit.form.descriptionPlaceholder',
                  'Détails supplémentaires...',
                )}
                textAlignVertical="top"
                value={value}
              />
            )}
          />
        </View>

        <Button
          isLoading={updateMutation.isPending}
          onPress={handleSubmit(onSubmit)}
          title={t('recruitmentAdEdit.form.submit', 'Enregistrer les modifications')}
          variant="Primary"
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default RecruitmentAdEdit;
