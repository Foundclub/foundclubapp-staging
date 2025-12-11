import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import { RouteNames } from '@/navigation/routeNames';
import useTheme from '@/theme/themeContext';
import { horizontalScale } from '@/theme/scaling';

/**
 * FeaturedEvents component
 * Displays a horizontal list of featured events
 * @param {object} props
 * @param {Array} props.events - List of featured events
 * @returns {React.ReactElement} FeaturedEvents component
 */
const FeaturedEvents = ({ events = [] }) => {
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
                navigation.navigate(RouteNames.EventDetails, { eventId: item.documentId });
            }
        }
    }, [navigation]);

    if (!events || events.length === 0) {
        return null;
    }

    return (
        <View style={[Spaces.gap[12]]}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                    {t('eventList.featured', 'À la une :')}
                </Text>
            </View>

            <ScrollView
                horizontal
                contentContainerStyle={[{ paddingVertical: 10 }, Spaces.gap[16]]}
                showsHorizontalScrollIndicator={false}
            >
                {events.map((item) => {
                    const cardWidth = Dimensions.get('window').width - horizontalScale(48); // Full width - padding
                    return (
                        <View key={item.documentId || Math.random()} style={{ width: cardWidth }}>
                            <EventCardNew
                                item={item}
                                onPress={handleCardPress}
                            />
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({});

export default FeaturedEvents;
