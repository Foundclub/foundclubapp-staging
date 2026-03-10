import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { horizontalScale } from '@/theme/scaling';
import useTheme from '@/theme/themeContext';

import EventCardNew from '@/components/molecules/eventCard/EventCardNew';

import { RouteNames } from '@/navigation/routeNames';

/**
 * FeaturedEvents component
 * Displays a horizontal list of featured events
 * @param {object} props
 * @param {Array} props.events - List of featured events
 * @param {boolean} [props.useFacilityAccentColorForPublic]
 * @returns {React.ReactElement} FeaturedEvents component
 */
function FeaturedEvents({ events = [], useFacilityAccentColorForPublic = false }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { Colors, Fonts, Spaces } = useTheme();

  const handleCardPress = useCallback((item) => {
    if (item?.documentId) {
      if (item.type?.name === 'Match') {
        navigation.navigate(RouteNames.MatchDetails, { matchId: item.documentId });
      } else if (item.type?.name === 'Entraînement') {
        navigation.navigate(RouteNames.TrainingDetails, { trainingId: item.documentId });
      } else {
        navigation.navigate(RouteNames.EventStack, { params: { eventId: item.documentId }, screen: RouteNames.EventDetails });
      }
    }
  }, [navigation]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={[Spaces.gap[12]]}>
      <View style={[{ alignItems: 'center', flexDirection: 'row', gap: 8 }]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('eventList.featured', 'À la une :')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[{ paddingVertical: 10 }, Spaces.gap[16]]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {events.map((item) => {
          const cardWidth = Dimensions.get('window').width - horizontalScale(48); // Full width - padding
          return (
            <View key={item.documentId || Math.random()} style={{ width: cardWidth }}>
              <EventCardNew
                item={item}
                onPress={handleCardPress}
                useFacilityAccentColor={useFacilityAccentColorForPublic && item?.sessionStatus === 'open'}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});

export default FeaturedEvents;
