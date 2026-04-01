import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import { useGetSections } from '@/services/section/sectionQueries';

/**
 * Team section selection screen component. Allows users to select their team section (male/female).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User section screen component
 */
function UserSection({ navigation }) {
  // hooks
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();
  const { getNextOnboardingRoute } = useAuth();
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
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (userData?.section?.documentId) {
      setSection(userData.section.documentId);
    }
  }, [userData?.section?.documentId]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous r\u00E9cup\u00E9rons ton profil avant de choisir ta section."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="R\u00E9essayer"
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
        actionLabel="R\u00E9essayer"
        description={sectionsError?.message || 'Impossible de charger les sections.'}
        onAction={refetchSections}
        title="Chargement impossible"
      />
    );
  }

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserSection)
        || RouteNames.UserBirthdate);
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
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.section')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.section')}
          </Text>
        </View>
        <View style={[Spaces.gap[24]]}>
          {sections?.map((sectionItem) => (
            <TabButton
              isActive={section === sectionItem.documentId}
              key={sectionItem.documentId}
              onPress={() => handleSelection(sectionItem.documentId)}
              title={sectionItem.name}
            />
          ))}
        </View>
      </View>
      <Button
        disabled={!section}
        isLoading={updateUserMutation.isPending}
        onPress={handleNext}
        title={t('profile.actions.save')}
        variant="Primary"
      />
    </FormScreenContainer>
  );
}

export default UserSection;
