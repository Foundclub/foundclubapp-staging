import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { RouteNames } from '@/navigation/routeNames';
import useTheme from '@/theme/themeContext';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';

/**
 * Bubble to display an event in a chat
 * @param {object} props
 * @param {import('@/domains/event/types').FCEvent} props.event - The event object
 * @param {boolean} props.isMe - Whether the message is sent by current user
 * @returns {import('react').ReactElement}
 */
const EventMessageBubble = ({ event, isMe }) => {
  const { Spaces } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  if (!event) return null;

  const handlePress = () => {
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, {
      screen: RouteNames.EventDetails,
      params: { eventId: event.documentId },
    });
  };

  return (
    <View style={[{ width: 300 }, Spaces.marginTop[4]]}>
        <EventCardNew 
            item={event}
            onPress={handlePress}
            onJoin={() => {}}
            onDecline={() => {}}
            onParticipate={() => {}}
            onLogin={() => {}}
            // @ts-ignore
            showClubHeader={false}
        />
    </View>
  );
};

export default EventMessageBubble;
