import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
import { createCMSection, getMultisportClubById } from '@/services/multisportClub/multisportClubService';

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
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  const [name, setName] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(
    /** @type {Option | null} */ (null),
  );
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [address, setAddress] = useState(
    /** @type {Option | undefined} */ (undefined),
  );
  const [managerPhone, setManagerPhone] = useState('');

  const { data: activities = [] } = useQuery({
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

  const { data: cmDetails } = useQuery({
    enabled: !!cmId,
    queryFn: () => getMultisportClubById(cmId),
    queryKey: ['multisportClub', cmId],
  });

  useEffect(() => {
    if (!cmDetails || address) return;
    if (cmDetails.address) {
      setAddress({
        label: cmDetails.addressDetails || cmDetails.address.label,
        value: `${cmDetails.address.lng}|${cmDetails.address.lat}`,
      });
      return;
    }
    if (cmDetails.addressDetails) {
      setAddress({
        label: cmDetails.addressDetails,
        value: null,
      });
    }
  }, [address, cmDetails]);

  const createMutation = useMutation({
    mutationFn: (data) => createCMSection(cmId || '', /** @type {SectionPayload} */ (data)),
    onError: (error) => {
      const fallbackMessage = t('multisport.formErrors.generic', 'Une erreur est survenue lors de la cr?ation de la section.');
      const message = error && typeof error === 'object' && 'message' in error
        ? error.message
        : fallbackMessage;
      Alert.alert(
        t('APIerrors.title', 'Erreur'),
        typeof message === 'string' ? message : fallbackMessage,
      );
    },
    onSuccess: (result) => {
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

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert(t('APIerrors.title', 'Erreur'), t('multisport.formErrors.sectionNameRequired', 'Le nom de la section est obligatoire.'));
      return;
    }
    if (!address?.label) {
      Alert.alert(t('APIerrors.title', 'Erreur'), t('multisport.formErrors.addressRequired', "L'adresse est obligatoire."));
      return;
    }

    createMutation.mutate({
      activites: selectedActivity ? [selectedActivity.value] : [],
      addressLabel: address.label,
      coordinates: address.value || undefined,
      managerPhone: managerPhone.trim() || undefined,
      name: name.trim(),
    });
  };

  const isValid = name.trim().length > 0 && Boolean(address?.label);

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
              {t('multisport.createSection.subtitle', 'Créez une section sportive pour votre club multisport.')}
            </Text>
          </View>

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
                  {t('multisport.createSection.fields.sport.noResults', 'Aucun sport ne correspond à votre recherche.')}
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
                {t('multisport.createSection.fields.managerPhone.label', 'Numero du dirigeant (optionnel)')}
              </Text>
              <Input
                keyboardType="phone-pad"
                onChangeText={setManagerPhone}
                placeholder={t('multisport.createSection.fields.managerPhone.placeholder', 'Ex: 0612345678')}
                value={managerPhone}
              />
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                {t('multisport.createSection.fields.managerPhone.help', 'Ce num?ro sera utilise pour rattacher le dirigeant à la section.')}
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
              ? t('multisport.createSection.actions.creating', 'Cr?ation...')
              : t('multisport.createSection.actions.create', 'Créer la section')}
            variant="Primary"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default CreateSectionScreen;

