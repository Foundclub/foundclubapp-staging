import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

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
  { label: 'V\u00E9t\u00E9ran', value: 'V\u00E9t\u00E9ran' },
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
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre \u00E0 jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserCategory) || getPostOnboardingHomeRoute());
    },
  });

  useEffect(() => {
    const categories = String(userData?.category || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length) {
      setSelectedCategories(categories);
    }
  }, [userData?.category]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ta catégorie."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

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
    <FormScreenContainer
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
            {t('onboarding.category.title', 'Ta cat\u00E9gorie ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.category.subtitle', "Dans quelle cat\u00E9gorie d'\u00E2ge joues-tu ?")}
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
        <OnboardingOptionalHint />
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
    </FormScreenContainer>
  );
}

export default UserCategory;
