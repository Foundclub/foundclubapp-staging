import { useTranslation } from 'react-i18next';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Event list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Event list screen component
 */
function EventList({ navigation, route }) {
  const { teamIds } = route?.params ?? {};
  const { t } = useTranslation();
  const { canManageEvents } = useAuth();

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  const handleAddEvent = () => {
    navigation.navigate(RouteNames.EventEdit);
  };

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
      <EventListContent additionalFilters={{ teamIds }} />
      {
        canManageEvents ? (
          <Button
            onPress={handleAddEvent}
            style={Spaces.marginVertical[24]}
            title={t('eventList.actions.add')}
            variant="Primary"
          />
        ) : null
      }
    </ScreenContainer>
  );
}

export default EventList;
