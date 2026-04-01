import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOnboardingViews } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

const searchIcon = require('@/assets/icons/search.png');

const resolveAvailableRoute = (
  navigation,
  ...candidates
) => {
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const firstCandidate = candidates.find(Boolean);

  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return firstCandidate;
  }

  return candidates.find((candidate) => candidate && routeNames.includes(candidate)) || firstCandidate;
};

/**
 * User preferred sport selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserSport({ navigation }) {
  const [selectedSport, setSelectedSport] = useState(/** @type {string | null} */ (null));
  const [searchQuery, setSearchQuery] = useState('');

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
  const {
    data: activities,
    error: activitiesError,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useGetActivities();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: ['get-me'] });

      // Calculate next route based on the NEW sport, not the old userData
      const tempUserData = { ...userData, preferredSport: selectedSport.trim() };
      const views = getOnboardingViews(tempUserData);

      // Find current view index
      const currentView = views.views.find((v) => v.route === RouteNames.UserSport);
      const currentIndex = currentView?.index || 0;

      // Get next view that canShow
      // We look for the first view with index > currentIndex that has canShow !== false
      // Note: getOnboardingViews returns views with canShow property
      const nextView = views.views.find((v) => v.index > currentIndex && v.canShow !== false);
      const sequentialNextRoute = getNextOnboardingRoute(RouteNames.UserSport);
      const postOnboardingRoute = getPostOnboardingHomeRoute();
      const nextRoute = resolveAvailableRoute(
        navigation,
        nextView?.route,
        sequentialNextRoute,
        postOnboardingRoute,
      );

      if (nextRoute) {
        navigation.navigate(nextRoute);
      }
    },
  });

  useEffect(() => {
    if (userData?.preferredSport) {
      setSelectedSport(String(userData.preferredSport));
    }
  }, [userData?.preferredSport]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous r\u00E9cup\u00E9rons ton profil avant de choisir ton sport."
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

  if (activitiesLoading && !activities?.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons la liste des sports."
        isLoading
        title="Chargement des sports"
      />
    );
  }

  if (activitiesError && !activities?.length) {
    return (
      <OnboardingStateView
        actionLabel="R\u00E9essayer"
        description={activitiesError?.message || 'Impossible de charger les sports.'}
        onAction={refetchActivities}
        title="Chargement impossible"
      />
    );
  }

  // Filter activities based on search query
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchQuery.trim()) return activities;
    const query = searchQuery.toLowerCase().trim();
    return activities.filter((activity) => activity.name?.toLowerCase().includes(query));
  }, [activities, searchQuery]);

  const handleNext = () => {
    if (selectedSport && userData) {
      updateUserMutation.mutate({ preferredSport: selectedSport.trim() });
    }
  };

  const handleSkip = () => {
    const nextRoute = resolveAvailableRoute(
      navigation,
      getNextOnboardingRoute(RouteNames.UserSport),
      getPostOnboardingHomeRoute(),
    );
    if (nextRoute) {
      navigation.navigate(nextRoute);
    }
  };

  // Capitalize first letter of activity name
  const formatActivityName = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentWidth="readable"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[16]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.sport.title', 'Quel est ton sport ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.sport.subtitle', 'Choisis ton sport de préférence')}
          </Text>
        </View>

        {/* Search Bar - Same style as main app */}
        <View style={{
          alignItems: 'center',
          borderBottomColor: '#FFFFFF',
          borderBottomWidth: 1.5,
          borderRadius: 2,
          flexDirection: 'row',
          height: 48,
        }}
        >
          <Image
            source={searchIcon}
            style={{
              height: 24,
              marginLeft: 8,
              marginRight: 12,
              tintColor: '#FFFFFF',
              width: 24,
            }}
          />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder={t('common.search', 'Rechercher un sport...')}
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            style={{
              color: '#FFFFFF',
              flex: 1,
              fontFamily: 'Montserrat-Regular',
              fontSize: 16,
              lineHeight: 23,
              paddingVertical: 12,
            }}
            value={searchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={{ padding: 8 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {activitiesLoading ? (
          <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
            <ActivityIndicator color={Colors.primary500} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[Spaces.gap[12]]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={[Alignments.fill]}
          >
            {filteredActivities.length === 0 ? (
              <Text style={[Fonts.p1, Fonts.neutral300, { marginTop: 24, textAlign: 'center' }]}>
                {t('common.noResults', 'Aucun résultat')}
              </Text>
            ) : (
              filteredActivities.map((activity) => (
                <TouchableOpacity
                  key={activity.documentId || activity.id}
                  onPress={() => setSelectedSport(activity.name)}
                  style={[
                    Spaces.padding[16],
                    {
                      backgroundColor: selectedSport === activity.name ? `${Colors.primary500}20` : Colors.neutral800,
                      borderColor: selectedSport === activity.name ? Colors.primary500 : Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Text style={[Fonts.p1Bold, { color: selectedSport === activity.name ? Colors.primary500 : Colors.neutral00 }]}>
                    {formatActivityName(activity.name)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <View style={[Spaces.gap[16], { paddingTop: 16 }]}>
        <OnboardingOptionalHint />
        <Button
          disabled={!selectedSport}
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

export default UserSport;
