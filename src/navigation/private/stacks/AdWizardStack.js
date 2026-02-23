import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { AdWizardProvider } from '@/views/recruitment/wizard/AdWizardContext';
import AdWizardDescription from '@/views/recruitment/wizard/AdWizardDescription';
import AdWizardInfo from '@/views/recruitment/wizard/AdWizardInfo';
import AdWizardPositions from '@/views/recruitment/wizard/AdWizardPositions';
import AdWizardRecap from '@/views/recruitment/wizard/AdWizardRecap';
import AdWizardTeam from '@/views/recruitment/wizard/AdWizardTeam';
import AdWizardValidation from '@/views/recruitment/wizard/AdWizardValidation';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
function AdWizardStack() {
  const { t } = useTranslation();

  return (
    <AdWizardProvider>
      <Stack.Navigator
        id={undefined}
        initialRouteName={RouteNames.AdWizardTeam}
        screenOptions={commonOptions}
      >
        <Stack.Screen
          component={AdWizardTeam}
          name={RouteNames.AdWizardTeam}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={AdWizardInfo}
          name={RouteNames.AdWizardInfo}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={AdWizardPositions}
          name={RouteNames.AdWizardPositions}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={AdWizardValidation}
          name={RouteNames.AdWizardValidation}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={AdWizardDescription}
          name={RouteNames.AdWizardDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={AdWizardRecap}
          name={RouteNames.AdWizardRecap}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </AdWizardProvider>
  );
}

export default AdWizardStack;
