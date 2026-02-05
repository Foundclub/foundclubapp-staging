import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getOnboardingViews } from '@/domains/auth/authUseCases';
import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import { useGetActivities } from '@/services/activity/activityQueries';

const searchIcon = require('@/assets/icons/search.png');

/**
 * User preferred sport selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserSport({ navigation }) {
  const [selectedSport, setSelectedSport] = useState(/** @type {string | null} */ (null));
  const [searchQuery, setSearchQuery] = useState('');

  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { data: activities, isLoading: activitiesLoading } = useGetActivities();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: ['me'] });

      // Calculate next route based on the NEW sport, not the old userData
      const tempUserData = { ...userData, preferredSport: selectedSport.trim() };
      const views = getOnboardingViews(tempUserData);
      
      // Find current view index
      const currentView = views.views.find(v => v.route === RouteNames.UserSport);
      const currentIndex = currentView?.index || 0;
      
      // Get next view that canShow
      // We look for the first view with index > currentIndex that has canShow !== false
      // Note: getOnboardingViews returns views with canShow property
      const nextView = views.views.find(v => v.index > currentIndex && v.canShow !== false);
      const nextRoute = nextView?.route || RouteNames.Welcome;

      navigation.navigate(nextRoute, { selectedSport: selectedSport.trim() });
    },
  });

  // Filter activities based on search query
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchQuery.trim()) return activities;
    const query = searchQuery.toLowerCase().trim();
    return activities.filter(activity => 
      activity.name?.toLowerCase().includes(query)
    );
  }, [activities, searchQuery]);

  const handleNext = () => {
    if (selectedSport && userData) {
      updateUserMutation.mutate({ preferredSport: selectedSport.trim() });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserSport) || RouteNames.Welcome);
  };

  // Capitalize first letter of activity name
  const formatActivityName = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
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
          height: 48,
          borderBottomWidth: 1.5,
          borderBottomColor: '#FFFFFF',
          borderRadius: 2,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <Image
            source={searchIcon}
            style={{
              width: 24,
              height: 24,
              tintColor: '#FFFFFF',
              marginLeft: 8,
              marginRight: 12,
            }}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('common.search', 'Rechercher un sport...')}
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            style={{
              flex: 1,
              fontFamily: 'Montserrat-Regular',
              fontSize: 16,
              lineHeight: 23,
              color: '#FFFFFF',
              paddingVertical: 12,
            }}
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
            style={[Alignments.fill]} 
            contentContainerStyle={[Spaces.gap[12]]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredActivities.length === 0 ? (
              <Text style={[Fonts.p1, Fonts.neutral300, { textAlign: 'center', marginTop: 24 }]}>
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
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: selectedSport === activity.name ? Colors.primary500 : Colors.neutral700,
                      backgroundColor: selectedSport === activity.name ? Colors.primary500 + '20' : Colors.neutral800,
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
        <Button
          disabled={!selectedSport}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Suivant')}
          variant="Primary"
        />
        <TouchableOpacity onPress={handleSkip} style={[Alignments.alignCenter]}>
          <Text style={[Fonts.p1, Fonts.neutral300, Fonts.underlineText]}>
            {t('profile.actions.ignore', 'Ignorer')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

export default UserSport;
