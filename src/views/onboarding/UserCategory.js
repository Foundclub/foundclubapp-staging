import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * Player categories (age groups)
 */
const CATEGORIES = [
  { label: 'U7', value: 'U7' },
  { label: 'U8', value: 'U8' },
  { label: 'U9', value: 'U9' },
  { label: 'U10', value: 'U10' },
  { label: 'U11', value: 'U11' },
  { label: 'U12', value: 'U12' },
  { label: 'U13', value: 'U13' },
  { label: 'U14', value: 'U14' },
  { label: 'U15', value: 'U15' },
  { label: 'U16', value: 'U16' },
  { label: 'U17', value: 'U17' },
  { label: 'U18', value: 'U18' },
  { label: 'U19', value: 'U19' },
  { label: 'U20', value: 'U20' },
  { label: 'U21', value: 'U21' },
  { label: 'U23', value: 'U23' },
  { label: 'Senior', value: 'Senior' },
  { label: 'Vétéran', value: 'Veteran' },
];

/**
 * User category selection screen (onboarding step)
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserCategory({ navigation }) {
  const [selectedCategories, setSelectedCategories] = useState(/** @type {string[]} */ ([]));

  const { getNextOnboardingRoute, getPostOnboardingHomeRoute } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserCategory) || getPostOnboardingHomeRoute());
    },
  });

  const toggleCategory = (categoryValue) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryValue)) {
        return prev.filter((c) => c !== categoryValue);
      }
      return [...prev, categoryValue];
    });
  };

  const handleNext = () => {
    if (selectedCategories.length > 0 && userData) {
      updateUserMutation.mutate({ category: selectedCategories.join(', ') });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserCategory) || getPostOnboardingHomeRoute());
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.category.title', 'Ta catégorie ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.category.subtitle', 'Dans quelle catégorie d\'âge joues-tu ?')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.gap[10]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category.value);
              return (
                <TouchableOpacity
                  key={category.value}
                  onPress={() => toggleCategory(category.value)}
                  style={[
                    Spaces.padding[12],
                    {
                      alignItems: 'center',
                      backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 2,
                      minWidth: 70,
                    },
                  ]}
                >
                  <Text style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={[Spaces.gap[16], { paddingTop: 16 }]}>
        <Button
          disabled={selectedCategories.length === 0}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Suivant')}
          variant="Primary"
        />
        <Button
          accessibilityLabel={t('common.actions.continueLater', 'Continuer plus tard')}
          onPress={handleSkip}
          title={t('common.actions.continueLater', 'Continuer plus tard')}
          variant="Secondary"
        />
      </View>
    </ScreenContainer>
  );
}

export default UserCategory;
