import useTheme from '@/theme/themeContext';

import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Event list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Event list screen component
 */
function EventList({ route }) {
  const { teamIds } = route?.params ?? {};

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <EventListContent teamIds={teamIds} />
    </ScreenContainer>
  );
}

export default EventList;
