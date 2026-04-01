import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions, ScrollView, Text, View,
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
  const { Fonts, Spaces } = useTheme();

  const handleCardPress = useCallback((item) => {
    if (!item?.documentId) return;

    // Reuse the main event-list navigation path to avoid route mismatches.
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: item.documentId },
      screen: RouteNames.EventDetails,
    });
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

export default FeaturedEvents;
