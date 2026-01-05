import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, View, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { createCMSection } from '@/services/multisportClub/multisportClubService';

/**
 * Create Section - Form to create a new club section under a MultisportClub
 */
function CreateSectionScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};

  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');

  const createMutation = useMutation({
    mutationFn: (data) => createCMSection(cmId, data),
    onSuccess: (result) => {
      Alert.alert(
        'Section créée',
        `La section "${result?.data?.name || name}" a été créée avec succès.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    },
    onError: (error) => {
      Alert.alert(
        'Erreur',
        error?.message || 'Une erreur est survenue lors de la création de la section.',
      );
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom de la section est obligatoire.');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      sport: sport.trim() || undefined,
      city: city.trim() || undefined,
    });
  };

  const isValid = name.trim().length > 0;

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
              <Input
                value={sport}
                onChangeText={setSport}
                placeholder="Ex: Football"
                autoCapitalize="words"
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Ville
              </Text>
              <Input
                value={city}
                onChangeText={setCity}
                placeholder="Ex: Paris"
                autoCapitalize="words"
              />
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
