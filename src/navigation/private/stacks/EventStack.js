import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import EventDetails from '@/views/event/EventDetails';
import EventEdit from '@/views/event/EventEdit';
import EventFilters from '@/views/event/EventFilters';

const Stack = createStackNavigator();

function EventStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={RouteNames.EventDetails}
      screenOptions={commonOptions}
    >
      <Stack.Screen
        component={EventDetails}
        name={RouteNames.EventDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={EventEdit}
        name={RouteNames.EventEdit}
        options={{
          ...commonOptions,
          headerTitle: t('eventEdit.title'),
        }}
      />
      <Stack.Screen
        component={EventFilters}
        name={RouteNames.EventFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
    </Stack.Navigator>
  );
}

export default EventStack;
