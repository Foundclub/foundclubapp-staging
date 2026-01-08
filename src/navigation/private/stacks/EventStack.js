import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import EventDetails from '@/views/event/EventDetails';
import EventEdit from '@/views/event/EventEdit';
import EventFilters from '@/views/event/EventFilters';
import TacticalBoardScreen from '@/views/event/TacticalBoardScreen';
import { TacticalSelection as TacticalSelectionV2, TacticalBoard as TacticalBoardV2 } from '@/views/tactical_v2';

import { EventWizardProvider } from '@/views/event/wizard/EventWizardContext';
import EventWizardType from '@/views/event/wizard/EventWizardType';
import EventWizardTeam from '@/views/event/wizard/EventWizardTeam';
import EventWizardInvites from '@/views/event/wizard/EventWizardInvites';
import EventWizardLogistics from '@/views/event/wizard/EventWizardLogistics';
import EventWizardDescription from '@/views/event/wizard/EventWizardDescription';
import EventWizardVisibility from '@/views/event/wizard/EventWizardVisibility';
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
        <Stack.Screen
          component={TacticalBoardScreen}
          name={RouteNames.TacticalBoard}
          options={{
            headerShown: false,
          }}
        />
        
        {/* Tactical V2 Screens */}
        <Stack.Screen
          component={TacticalSelectionV2}
          name={RouteNames.TacticalSelectionV2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TacticalBoardV2}
          name={RouteNames.TacticalBoardV2}
          options={{ headerShown: false }}
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
          component={EventWizardDescription}
          name={RouteNames.EventWizardDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardVisibility}
          name={RouteNames.EventWizardVisibility}
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

