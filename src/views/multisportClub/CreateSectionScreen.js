import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getActivities } from '@/services/activity/activityService';
import { createCMSection } from '@/services/multisportClub/multisportClubService';

import MultisportStateView from './components/MultisportStateView';
import useResolvedMultisportClub from './useResolvedMultisportClub';

/** @typedef {import('@/components/molecules/autocompleteSelect/types').Option} Option */
/**
 * @typedef {object} SectionPayload
 * @property {string} name
 * @property {(string | number | null)[]} [activites]
 * @property {string} [addressLabel]
 * @property {string | number | null} [coordinates]
 * @property {string} [managerPhone]
 */

const normalizeSearchText = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/**
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route: { params?: { cmId?: string } };
 * }} props
 */
function CreateSectionScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    cmData,
    cmError,
    isLoadingCmData,
    isLoadingUserData,
    refetchCm,
    refetchUserData,
    resolvedCmId,
    userDataError,
  } = useResolvedMultisportClub(cmId);

  const [name, setName] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(
    /** @type {Option | null} */ (null),
  );
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [address, setAddress] = useState(
    /** @type {Option | undefined} */ (undefined),
  );
  const [managerPhone, setManagerPhone] = useState('');

  const {
    data: activities = [],
    error: activitiesError,
    isLoading: isLoadingActivities,
    refetch: refetchActivities,
  } = useQuery({
    queryFn: getActivities,
    queryKey: ['activities'],
    select: (data) => {
      const activityList = Array.isArray(data) ? data : [];
      const seen = new Set();
      return activityList
        .map((activity) => ({
          label: String(activity?.name || '').trim(),
          value: activity?.documentId || '',
        }))
        .filter((option) => {
          if (!option.label || !option.value) return false;
          const uniqueKey = `${option.value}-${normalizeSearchText(option.label)}`;
          if (seen.has(uniqueKey)) return false;
          seen.add(uniqueKey);
          return true;
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
    },
  });

  const filteredActivities = useMemo(() => {
    const normalizedSearch = normalizeSearchText(activitySearchValue);
    if (!normalizedSearch) return activities;
    return activities.filter((activity) => normalizeSearchText(String(activity?.label || ''))
      .includes(normalizedSearch));
  }, [activities, activitySearchValue]);

  useEffect(() => {
    if (!cmData || address) return;
    if (cmData.address) {
      setAddress({
        label: cmData.addressDetails || cmData.address.label,
        value: `${cmData.address.lng}|${cmData.address.lat}`,
      });
      return;
    }
    if (cmData.addressDetails) {
      setAddress({
        label: cmData.addressDetails,
        value: null,
      });
    }
  }, [address, cmData]);

  const createMutation = useMutation({
    mutationFn: (data) => createCMSection(resolvedCmId || '', /** @type {SectionPayload} */ (data)),
    onError: (error) => {
      const fallbackMessage = t('multisport.formErrors.generic', 'Une erreur est survenue lors de la création de la section.');
      const message = error && typeof error === 'object' && 'message' in error
        ? error.message
        : fallbackMessage;
      Alert.alert(
        t('APIerrors.title', 'Erreur'),
        typeof message === 'string' ? message : fallbackMessage,
      );
    },
    onSuccess: async (result) => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['multisport-club', resolvedCmId] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
      ]);
      await Promise.allSettled([
        refetchCm(),
        refetchUserData(),
      ]);
      Alert.alert(
        t('multisport.sectionCreatedTitle', 'Section créée'),
        t(
          'multisport.sectionCreatedMessage',
          'La section "{{name}}" a été créée avec succès.',
          { name: result?.data?.name || name },
        ),
        [{ onPress: () => navigation.goBack(), text: 'OK' }],
      );
    },
  });

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      Alert.alert(t('APIerrors.title', 'Erreur'), t('multisport.formErrors.sectionNameRequired', 'Le nom de la section est obligatoire.'));
      return;
    }
    if (!address?.label) {
      Alert.alert(t('APIerrors.title', 'Erreur'), t('multisport.formErrors.addressRequired', "L'adresse est obligatoire."));
      return;
    }
    if (!resolvedCmId) {
      Alert.alert(t('APIerrors.title', 'Erreur'), t('multisport.formErrors.clubRequired', 'Impossible de retrouver le club multisport.'));
      return;
    }

    createMutation.mutate({
      activites: selectedActivity ? [selectedActivity.value] : [],
      addressLabel: address.label,
      coordinates: address.value || undefined,
      managerPhone: managerPhone.trim() || undefined,
      name: name.trim(),
    });
  }, [address, createMutation, managerPhone, name, resolvedCmId, selectedActivity, t]);

  const isValid = name.trim().length > 0
    && Boolean(address?.label)
    && !isLoadingActivities
    && !activitiesError
    && Boolean(resolvedCmId);

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.createSection.loadingUser', 'Nous préparons ta structure multisport avant la création de la section.')}
        isLoading
        title={t('multisport.createSection.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Réessayer')}
        description={t('multisport.createSection.userError', 'Impossible de retrouver ta structure multisport pour le moment.')}
        onAction={() => refetchUserData()}
        title={t('multisport.createSection.userErrorTitle', 'Création indisponible')}
      />
    );
  }

  if (!resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe à ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  if (isLoadingCmData && !cmData) {
    return (
      <MultisportStateView
        description={t('multisport.createSection.loading', 'Nous chargeons les informations de ta structure multisport.')}
        isLoading
        title={t('multisport.createSection.loadingTitle', 'Chargement de la fiche')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Réessayer')}
        description={t('multisport.createSection.error', 'Impossible de charger cette structure multisport pour le moment.')}
        onAction={() => refetchCm()}
        title={t('multisport.createSection.errorTitle', 'Création indisponible')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.createSection.notFound', "Cette structure multisport est introuvable ou n'est plus accessible.")}
        onAction={() => refetchCm()}
        title={t('multisport.createSection.notFoundTitle', 'Club introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[40]]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h3Black, Fonts.neutral00]}>
              {t('multisport.createSection.title', 'Nouvelle section')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral200]}>
              {t('multisport.createSection.subtitle', 'Crée une section sportive pour ton club multisport.')}
            </Text>
          </View>

          {activitiesError ? (
            <View
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderWidth1,
                Spaces.padding[16],
                Spaces.gap[8],
                { borderColor: 'rgba(255, 191, 71, 0.45)' },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('multisport.createSection.activitiesErrorTitle', 'Le referentiel des sports est indisponible')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {t('multisport.createSection.activitiesErrorDescription', 'Impossible de charger la liste des sports pour le moment.')}
              </Text>
              <Button
                onPress={() => refetchActivities()}
                title={t('common.retry', 'Réessayer')}
                variant="Secondary"
              />
            </View>
          ) : null}

          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.primary500,
              Spaces.padding[16],
              Spaces.gap[16],
            ]}
          >
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('multisport.createSection.fields.name.label', 'Nom de la section *')}
              </Text>
              <Input
                autoCapitalize="words"
                onChangeText={setName}
                placeholder={t('multisport.createSection.fields.name.placeholder', 'Ex: Football, Basketball')}
                value={name}
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('multisport.createSection.fields.sport.label', 'Sport')}
              </Text>
              <AutocompleteSelect
                disabled={Boolean(activitiesError)}
                isLoading={isLoadingActivities}
                isSearchable
                options={filteredActivities}
                placeholder={t('multisport.createSection.fields.sport.placeholder', 'Choisir un sport')}
                searchValue={activitySearchValue}
                setSearchValue={setActivitySearchValue}
                setValue={setSelectedActivity}
                value={selectedActivity?.label}
              />
              {activitySearchValue.trim().length > 0 && filteredActivities.length === 0 ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t('multisport.createSection.fields.sport.noResults', 'Aucun sport ne correspond à ta recherche.')}
                </Text>
              ) : null}
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('multisport.createSection.fields.address.label', 'Adresse / Ville *')}
              </Text>
              <AutocompleteAddressInput
                address={address}
                placeholder={t('multisport.createSection.fields.address.placeholder', 'Rechercher une adresse')}
                setAddress={(value) => setAddress(value)}
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('multisport.createSection.fields.managerPhone.label', 'Numéro du dirigeant (optionnel)')}
              </Text>
              <Input
                keyboardType="phone-pad"
                onChangeText={setManagerPhone}
                placeholder={t('multisport.createSection.fields.managerPhone.placeholder', 'Ex: 0612345678')}
                value={managerPhone}
              />
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {t('multisport.createSection.fields.managerPhone.help', 'Ce numéro sera utilise pour rattacher le dirigeant à la section.')}
              </Text>
            </View>
          </View>

          <View
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.primary500,
              Spaces.padding[16],
            ]}
          >
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('multisport.createSection.info', 'Une fois créée, la section pourra accueillir équipes, événements et membres.')}
            </Text>
          </View>
        </ScrollView>

        <View style={[Spaces.paddingTop[16]]}>
          <Button
            disabled={!isValid || createMutation.isPending}
            onPress={handleCreate}
            title={createMutation.isPending
              ? t('multisport.createSection.actions.creating', 'Creation...')
              : t('multisport.createSection.actions.create', 'Créer la section')}
            variant="Primary"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default CreateSectionScreen;
