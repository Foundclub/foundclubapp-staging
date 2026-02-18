import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, View, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { createCMSection, getMultisportClubById } from '@/services/multisportClub/multisportClubService';
import { getActivities } from '@/services/activity/activityService';

/** @typedef {import('@/components/molecules/autocompleteSelect/types').Option} Option */
/**
 * @typedef {object} SectionPayload
 * @property {string} name
 * @property {(string | number | null)[]} [activites]
 * @property {string} [addressLabel]
 * @property {string | number | null} [coordinates]
 * @property {string} [managerPhone]
 */

/**
 * Create Section - Form to create a new club section under a MultisportClub
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route: { params?: { cmId?: string } };
 * }} props
 */
function CreateSectionScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(
    /** @type {Option | null} */ (null),
  );
  const [address, setAddress] = useState(
    /** @type {Option | undefined} */ (undefined),
  );
  const [managerPhone, setManagerPhone] = useState('');

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: getActivities,
    select: (data) => (Array.isArray(data) ? data : []).map((act) => ({
      label: act?.name || '',
      value: act?.documentId || '',
    })),
  });

  // Fetch CM details for pre-filling address
  const { data: cmDetails } = useQuery({
    queryKey: ['multisportClub', cmId],
    queryFn: () => getMultisportClubById(cmId),
    enabled: !!cmId,
  });

  // Pre-fill address when cmDetails is loaded
  useEffect(() => {
    if (cmDetails && !address) {
      if (cmDetails.address) {
        // If address object exists (Location Picker)
        setAddress({
          label: cmDetails.addressDetails || cmDetails.address.label,
          value: `${cmDetails.address.lng}|${cmDetails.address.lat}`, // Construct value expected by backend custom logic
        });
      } else if (cmDetails.addressDetails) {
        // Fallback if only text address
        setAddress({
          label: cmDetails.addressDetails,
          value: null, 
        });
      }
    }
  }, [cmDetails, address]);

  const createMutation = useMutation({
    mutationFn: (/** @type {SectionPayload} */ data) => createCMSection(cmId || '', data),
    onSuccess: (result) => {
      Alert.alert(
        'Section créée',
        `La section "${result?.data?.name || name}" a été créée avec succès.${managerPhone ? '\nUne demande d\'adhésion a été créée pour le dirigeant.' : ''}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    },
    onError: (error) => {
      const message = error && typeof error === 'object' && 'message' in error
        ? error.message
        : 'Une erreur est survenue lors de la création de la section.';
      Alert.alert(
        'Erreur',
        typeof message === 'string' ? message : 'Une erreur est survenue lors de la création de la section.',
      );
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom de la section est obligatoire.');
      return;
    }
    
    // Address validation (optional, but requested precise address)
    if (!address || !address.label) {
      Alert.alert('Erreur', 'L\'adresse est obligatoire.');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      activites: selectedActivity ? [selectedActivity.value] : [], 
      addressLabel: address.label,
      coordinates: address.value || undefined, // "lon|lat" from AutocompleteAddressInput
      managerPhone: managerPhone.trim() || undefined,
    });
  };

  const isValid = name.trim().length > 0 && !!address?.label;

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
          {/* Header */}
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.h3Black, Fonts.neutral00]}>
              Nouvelle section
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral200]}>
              Créez une nouvelle section sportive pour votre club multisport.
            </Text>
          </View>

          {/* Form */}
          <View style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.backgroundColor.primary700,
            Spaces.padding[16],
            Spaces.gap[16],
          ]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Nom de la section *
              </Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Ex: Football, Basketball..."
                autoCapitalize="words"
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Sport
              </Text>
              <AutocompleteSelect
                options={activities}
                value={selectedActivity?.label} 
                setValue={setSelectedActivity}
                isSearchable
                placeholder="Choisir un sport"
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Adresse / Ville *
              </Text>
              <AutocompleteAddressInput
                address={address}
                setAddress={(value) => setAddress(value)}
                placeholder="Ex: 10 rue de Paris..."
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Numéro du dirigeant (Optionnel)
              </Text>
              <Input
                value={managerPhone}
                onChangeText={setManagerPhone}
                placeholder="Ex: 0612345678"
                keyboardType="phone-pad"
              />
              <Text style={[Fonts.p3, Fonts.neutral100]}>
                Ce numéro sera utilisé pour assigner automatiquement le dirigeant lors de sa connexion.
              </Text>
            </View>
          </View>

          {/* Info */}
          <View style={[
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary700,
            Spaces.padding[16],
            Alignments.row,
            Spaces.gap[12],
          ]}>
            <Text style={{ fontSize: 20 }}>💡</Text>
            <Text style={[Fonts.p2, Fonts.neutral200, { flex: 1 }]}>
              Une fois la section créée, vous pourrez y ajouter des équipes, des événements et des membres.
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[Spaces.paddingTop[16]]}>
          <Button
            onPress={handleCreate}
            title={createMutation.isPending ? 'Création...' : 'Créer la section'}
            variant="Primary"
            disabled={!isValid || createMutation.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default CreateSectionScreen;
