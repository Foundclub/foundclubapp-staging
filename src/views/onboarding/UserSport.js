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
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { updateMe } from '@/services/auth/authService';

// import statique (pas require) : sur le rendu web (Vite/ESM), require n'existe
// pas et l'ecran entier mourait (revue design 20/07, P0).
import searchIcon from '@/assets/icons/search.png';

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

  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
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
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: () => {
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: ['get-me'] });

      // Calculate next route based on the NEW sport, not the old userData
      const chosenSport = selectedSport.trim();
      const tempUserData = { ...userData, preferredSport: chosenSport };
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
        // D23 - le sport voyage EN PARAMETRE jusqu'a l'etape Poste.
        // `UserPosition` sait deja le lire (`route.params.selectedSport`) mais
        // personne ne le lui passait : il attendait que `get-me` soit
        // rafraichi, ce qui n'arrive pas dans le meme tour de rendu.
        navigation.navigate(
          nextRoute,
          nextRoute === RouteNames.UserPosition ? { selectedSport: chosenSport } : undefined,
        );
      }
    },
  });

  useEffect(() => {
    if (userData?.preferredSport) {
      setSelectedSport(String(userData.preferredSport));
    }
  }, [userData?.preferredSport]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchQuery.trim()) return activities;
    const query = searchQuery.toLowerCase().trim();
    return activities.filter((activity) => activity.name?.toLowerCase().includes(query));
  }, [activities, searchQuery]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ton sport."
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
        actionLabel="Réessayer"
        description={activitiesError?.message || 'Impossible de charger les sports.'}
        onAction={refetchActivities}
        title="Chargement impossible"
      />
    );
  }

  const handleNext = () => {
    if (selectedSport && userData) {
      updateUserMutation.mutate({ preferredSport: selectedSport.trim() });
    }
  };

  const handleSkip = () => {
    // D23 - sauter le sport saute AUSSI le poste. L'etape Poste reste au
    // programme tant que le sport n'est pas repondu (c'est ce qui la rend
    // joignable quand un sport EST choisi) : sans ce saut, on la traverserait
    // en clignotant, puisqu'elle se retire d'elle-meme faute de sport.
    const afterSport = getNextOnboardingRoute(RouteNames.UserSport);
    const nextRoute = resolveAvailableRoute(
      navigation,
      afterSport === RouteNames.UserPosition
        ? getNextOnboardingRoute(RouteNames.UserPosition)
        : afterSport,
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
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
      contentWidth="readable"
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
              filteredActivities.map((activity) => {
                const isSelected = selectedSport === activity.name;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={activity.documentId || activity.id}
                    onPress={() => setSelectedSport((currentSport) => (
                      currentSport === activity.name ? null : activity.name
                    ))}
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
                      {formatActivityName(activity.name)}
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
              })
            )}
          </ScrollView>
        )}
      </View>

      <OnboardingStickyFooter contentWidth="readable">
        <Button
          disabled={!selectedSport}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserSport;
