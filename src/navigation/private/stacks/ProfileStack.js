import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import HistoryWizardCategory from '@/views/historyWizard/HistoryWizardCategory';
import HistoryWizardClub from '@/views/historyWizard/HistoryWizardClub';
import { HistoryWizardProvider } from '@/views/historyWizard/HistoryWizardContext';
import HistoryWizardLevel from '@/views/historyWizard/HistoryWizardLevel';
import HistoryWizardPeriod from '@/views/historyWizard/HistoryWizardPeriod';
import HistoryWizardRecap from '@/views/historyWizard/HistoryWizardRecap';
import PlayerCardScreen from '@/views/profile/PlayerCardScreen';
import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';
import SubscriptionOverview from '@/views/profile/SubscriptionOverview';
import UserDetails from '@/views/profile/UserDetails';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 * Profile stack and history wizard flow.
 * @returns {import('react').ReactElement}
 */
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
          component={SubscriptionOverview}
          name={RouteNames.SubscriptionOverview}
          options={{
            ...commonOptions,
            // Header court (handoff 7b) : le titre long entrait en collision avec la fleche.
            headerTitle: t('profile.subscription.headerTitle', 'Abonnement'),
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
        <Stack.Screen
          component={PlayerCardScreen}
          name={RouteNames.PlayerCard}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={HistoryWizardCategory}
          name={RouteNames.HistoryWizardCategory}
          options={{
            ...commonOptions,
            // C07 — un seul retour dans le tunnel « historique » : WizardStepLayout
            // porte déjà sa flèche ronde ; on masque l'entête (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardClub}
          name={RouteNames.HistoryWizardClub}
          options={{
            ...commonOptions,
            // C07 — un seul retour dans le tunnel « historique » : WizardStepLayout
            // porte déjà sa flèche ronde ; on masque l'entête (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardPeriod}
          name={RouteNames.HistoryWizardPeriod}
          options={{
            ...commonOptions,
            // C07 — un seul retour dans le tunnel « historique » : WizardStepLayout
            // porte déjà sa flèche ronde ; on masque l'entête (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardLevel}
          name={RouteNames.HistoryWizardLevel}
          options={{
            ...commonOptions,
            // C07 — un seul retour dans le tunnel « historique » : WizardStepLayout
            // porte déjà sa flèche ronde ; on masque l'entête (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          component={HistoryWizardRecap}
          name={RouteNames.HistoryWizardRecap}
          options={{
            ...commonOptions,
            // C07 — un seul retour dans le tunnel « historique » : WizardStepLayout
            // porte déjà sa flèche ronde ; on masque l'entête (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
      </Stack.Navigator>
    </HistoryWizardProvider>
  );
}

export default ProfileStack;
