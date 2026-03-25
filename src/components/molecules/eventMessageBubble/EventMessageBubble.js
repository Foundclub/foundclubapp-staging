import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import EventCardNew from '@/components/molecules/eventCard/EventCardNew';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Bubble to display an event in a chat
 * @param {object} props
 * @param {import('@/domains/event/types').FCEvent} props.event - The event object
 * @param {boolean} props.isMe - Whether the message is sent by current user
 * @returns {import('react').ReactElement}
 */
/**
 * Bubble to display an event in a chat
 * @param {object} props
 * @param {import('@/domains/event/types').FCEvent} props.event - The event object
 * @param {boolean} props.isMe - Whether the message is sent by current user
 * @param {() => void} [props.onJoin] - Handler for join action
 * @param {() => void} [props.onParticipate] - Handler for participate action
 * @param {() => void} [props.onDecline] - Handler for decline action
 * @returns {import('react').ReactElement}
 */
function EventMessageBubble({
  event,
  onDecline = () => {},
  onJoin = () => {},
  onParticipate = () => {},
}) {
  const { Spaces } = useTheme();
  const navigation = useNavigation();

  if (!event) return null;

  const handlePress = () => {
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  return (
    <View style={[{ width: 300 }, Spaces.marginTop[4]]}>
      <EventCardNew
        item={event}
        mode="share"
        onDecline={onDecline}
        onJoin={onJoin}
        onLogin={() => {}}
        onParticipate={onParticipate}
        onPress={handlePress}
            // @ts-ignore
        showClubHeader={false}
      />
    </View>
  );
}

export default EventMessageBubble;
