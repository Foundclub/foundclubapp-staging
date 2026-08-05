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
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import { useGetSections } from '@/services/section/sectionQueries';

const resolveAvailableRoute = (navigation, ...candidates) => {
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const firstCandidate = candidates.find(Boolean);

  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return firstCandidate;
  }

  return candidates.find(
    (candidate) => candidate && routeNames.includes(candidate),
  ) || firstCandidate;
};

/**
 * Team section selection screen component. Allows users to select their team section (male/female).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User section screen component
 */
function UserSection({ navigation }) {
  // hooks
  const {
    getNextOnboardingRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    data: sections,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useGetSections();
  const insets = useSafeAreaInsets();

  // local state
  const [section, setSection] = useState(userData?.section?.documentId || '');
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userData?.section?.documentId) {
      setSection(userData.section.documentId);
    }
  }, [userData?.section?.documentId]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      const nextRoute = resolveAvailableRoute(
        navigation,
        getNextOnboardingRoute(RouteNames.UserSection),
        // D15 - le repli etait `UserBirthdate`, qui n'est plus une etape :
        // la date de naissance est saisie sur l'ecran fusionne « Qui es-tu ? »,
        // AVANT celui-ci. L'etape suivante commune aux parcours est l'adresse.
        RouteNames.UserAddress,
      );
      if (nextRoute) {
        navigation.navigate(nextRoute);
      }
    },
  });

  const handleNext = () => {
    if (section && userData) {
      updateUserMutation.mutate({ section });
    }
  };

  /**
   * Handle the selection of the user section
   * @param {string} selectedSection
   */
  const handleSelection = (selectedSection) => {
    setSection((currentSection) => (selectedSection === currentSection ? '' : selectedSection));
  };

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ta section."
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

  if (sectionsLoading && !sections?.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons les sections disponibles."
        isLoading
        title="Chargement des sections"
      />
    );
  }

  if (sectionsError && !sections?.length) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={sectionsError?.message || 'Impossible de charger les sections.'}
        onAction={refetchSections}
        title="Chargement impossible"
      />
    );
  }

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { marginBottom: insets.bottom },
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.section')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.section')}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {(sections || []).map((sectionItem) => {
            const isSelected = section === sectionItem.documentId;

            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={sectionItem.documentId || sectionItem.name}
                onPress={() => handleSelection(sectionItem.documentId)}
                style={[
                  Spaces.padding[16],
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.gap[12],
                  {
                    backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                    borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    Fonts.p1Bold,
                    { color: isSelected ? Colors.primary500 : Colors.neutral00, flex: 1 },
                  ]}
                >
                  {sectionItem.name}
                </Text>
                {isSelected ? (
                  <Text
                    importantForAccessibility="no"
                    style={[Fonts.p1Bold, Fonts.primary500]}
                  >
                    ✓
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <OnboardingStickyFooter>
        <Button
          disabled={!section}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserSection;
