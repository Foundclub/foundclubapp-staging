/* eslint-disable max-len -- chemins d'import du tunnel amicaux : les raccourcir
   demanderait de renommer les 7 etapes, pour zero gain de lisibilite. */
import { createStackNavigator } from '@react-navigation/stack';

import { FriendlyMatchWizardProvider } from '@/views/friendlyMatch/wizard/FriendlyMatchWizardContext';
import FriendlyMatchWizardDates from '@/views/friendlyMatch/wizard/FriendlyMatchWizardDates';
import FriendlyMatchWizardDescription from '@/views/friendlyMatch/wizard/FriendlyMatchWizardDescription';
import FriendlyMatchWizardHosting from '@/views/friendlyMatch/wizard/FriendlyMatchWizardHosting';
import FriendlyMatchWizardLocation from '@/views/friendlyMatch/wizard/FriendlyMatchWizardLocation';
import FriendlyMatchWizardOpponent from '@/views/friendlyMatch/wizard/FriendlyMatchWizardOpponent';
import FriendlyMatchWizardRecap from '@/views/friendlyMatch/wizard/FriendlyMatchWizardRecap';
import FriendlyMatchWizardTeam from '@/views/friendlyMatch/wizard/FriendlyMatchWizardTeam';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 * L assistant de publication d une annonce de match amical (spec §4.1).
 *
 * Calque de AdWizardStack : un fournisseur d etat qui enveloppe la pile, une
 * etape par ecran. Sur le web ces etapes deviendront des URLs independantes
 * (lot L7) — c est pourquoi le brouillon se persiste dans `sessionStorage`
 * plutot que de reposer sur la pile de navigation.
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardStack() {
  return (
    <FriendlyMatchWizardProvider>
      <Stack.Navigator
        id={undefined}
        initialRouteName={RouteNames.FriendlyMatchWizardTeam}
        screenOptions={commonOptions}
      >
        <Stack.Screen
          component={FriendlyMatchWizardTeam}
          name={RouteNames.FriendlyMatchWizardTeam}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardHosting}
          name={RouteNames.FriendlyMatchWizardHosting}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardDates}
          name={RouteNames.FriendlyMatchWizardDates}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardLocation}
          name={RouteNames.FriendlyMatchWizardLocation}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardOpponent}
          name={RouteNames.FriendlyMatchWizardOpponent}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardDescription}
          name={RouteNames.FriendlyMatchWizardDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={FriendlyMatchWizardRecap}
          name={RouteNames.FriendlyMatchWizardRecap}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </FriendlyMatchWizardProvider>
  );
}

export default FriendlyMatchWizardStack;
