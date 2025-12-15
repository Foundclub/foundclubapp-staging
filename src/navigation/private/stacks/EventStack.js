import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import EventDetails from '@/views/event/EventDetails';
import EventEdit from '@/views/event/EventEdit';
import EventFilters from '@/views/event/EventFilters';

import { EventWizardProvider } from '@/views/event/wizard/EventWizardContext';
import EventWizardType from '@/views/event/wizard/EventWizardType';
import EventWizardTeam from '@/views/event/wizard/EventWizardTeam';
import EventWizardInvites from '@/views/event/wizard/EventWizardInvites';
import EventWizardLogistics from '@/views/event/wizard/EventWizardLogistics';
import EventWizardLocation from '@/views/event/wizard/EventWizardLocation';
import EventWizardRecap from '@/views/event/wizard/EventWizardRecap';

const Stack = createStackNavigator();

function EventStack() {
  const { t } = useTranslation();

  return (
    <EventWizardProvider>
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

        {/* Wizard Screens */}
        <Stack.Screen
          component={EventWizardType}
          name={RouteNames.EventWizardType}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardTeam}
          name={RouteNames.EventWizardTeam}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardInvites}
          name={RouteNames.EventWizardInvites}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardLogistics}
          name={RouteNames.EventWizardLogistics}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardLocation}
          name={RouteNames.EventWizardLocation}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardRecap}
          name={RouteNames.EventWizardRecap}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </EventWizardProvider>
  );
}

export default EventStack;
