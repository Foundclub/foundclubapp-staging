import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { HistoryWizardProvider } from '@/views/historyWizard/HistoryWizardContext';
import HistoryWizardSingle from '@/views/historyWizard/HistoryWizardSingle';
import BlockedUsers from '@/views/profile/BlockedUsers';
import PlayerCardScreen from '@/views/profile/PlayerCardScreen';
import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';
import SubscriptionCompare from '@/views/profile/SubscriptionCompare';
import SubscriptionOffers from '@/views/profile/SubscriptionOffers';
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
        {/* L33 — les deux ecrans pousses par le hub. L'entete NATIF porte deja
            la fleche de retour et le titre : aucun des deux ecrans ne dessine
            la sienne, sinon l'ecran affiche DEUX fleches empilees (defaut trouve
            a la recette du lot D2, corrige par soustraction). */}
        <Stack.Screen
          component={SubscriptionOffers}
          name={RouteNames.SubscriptionOffers}
          options={{
            ...commonOptions,
            headerTitle: t('profile.subscription.offersHeaderTitle', 'Changer d\'offre'),
          }}
        />
        <Stack.Screen
          component={SubscriptionCompare}
          name={RouteNames.SubscriptionCompare}
          options={{
            ...commonOptions,
            headerTitle: t('profile.subscription.compareHeaderTitle', 'Comparer'),
          }}
        />
        {/* 🚫 BLOQUER — la porte de sortie exigee par les deux magasins :
            voir qui l on a bloque, et le debloquer. */}
        <Stack.Screen
          component={BlockedUsers}
          name={RouteNames.BlockedUsers}
          options={{
            ...commonOptions,
            headerTitle: '',
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
          component={HistoryWizardSingle}
          name={RouteNames.HistoryWizardCategory}
          options={{
            ...commonOptions,
            // C08 (D4) — historique sportif en UN SEUL écran. WizardStepLayout porte
            // déjà sa flèche ronde de retour ; on masque l'entête natif (2ᵉ flèche).
            headerShown: false,
            headerTitle: 'Ajouter une expérience',
          }}
        />
      </Stack.Navigator>
    </HistoryWizardProvider>
  );
}

export default ProfileStack;
