import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';
import UserDetails from '@/views/profile/UserDetails';

// History Wizard
import { HistoryWizardProvider } from '@/views/historyWizard/HistoryWizardContext';
import HistoryWizardClub from '@/views/historyWizard/HistoryWizardClub';
import HistoryWizardCategory from '@/views/historyWizard/HistoryWizardCategory';
import HistoryWizardLevel from '@/views/historyWizard/HistoryWizardLevel';
import HistoryWizardPeriod from '@/views/historyWizard/HistoryWizardPeriod';
import HistoryWizardRecap from '@/views/historyWizard/HistoryWizardRecap';

const Stack = createStackNavigator();

function ProfileStack() {
  const { t } = useTranslation();

  return (
    <HistoryWizardProvider>
      <Stack.Navigator
        id={undefined}
        initialRouteName={RouteNames.Profile}
        screenOptions={commonOptions}
      >
        <Stack.Screen
          component={Profile}
          name={RouteNames.Profile}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={ProfileEdit}
          name={RouteNames.ProfileEdit}
          options={{
            ...commonOptions,
            headerTitle: t('profile.titles.edit'),
          }}
        />
        <Stack.Screen
          component={UserDetails}
          name={RouteNames.UserDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        {/* History Wizard Screens */}
        <Stack.Screen
          component={HistoryWizardClub}
          name={RouteNames.HistoryWizardClub}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardCategory}
          name={RouteNames.HistoryWizardCategory}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardLevel}
          name={RouteNames.HistoryWizardLevel}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardPeriod}
          name={RouteNames.HistoryWizardPeriod}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardRecap}
          name={RouteNames.HistoryWizardRecap}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
      </Stack.Navigator>
    </HistoryWizardProvider>
  );
}

export default ProfileStack;
