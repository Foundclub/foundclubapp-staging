import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import SquadDetailsScreen from '@/views/league/details/SquadDetailsScreen';
import SquadEditScreen from '@/views/league/edit/SquadEditScreen';
import CompositionPaywallScreen from '@/views/subscription/CompositionPaywallScreen';
import TeamCompoTemplateScreen from '@/views/team/composition/TeamCompoTemplateScreen';
import CreateSquadWizard from '@/views/team/createSquad/CreateSquadWizard';
import MyTeamList from '@/views/team/MyTeamList';
import TeamDetails from '@/views/team/TeamDetails';
import TeamEdit from '@/views/team/TeamEdit';
import TeamFilters from '@/views/team/TeamFilters';
import TeamList from '@/views/team/TeamList';
import TeamMembershipRequestList from '@/views/team/TeamMembershipRequestList';
import TeamStatsScreen from '@/views/team/TeamStatsScreen';
import TeamWizardActivity from '@/views/team/wizard/TeamWizardActivity';
import TeamWizardCategory from '@/views/team/wizard/TeamWizardCategory';
import { TeamWizardProvider } from '@/views/team/wizard/TeamWizardContext';
import TeamWizardDescription from '@/views/team/wizard/TeamWizardDescription';
import TeamWizardLevel from '@/views/team/wizard/TeamWizardLevel';
import TeamWizardName from '@/views/team/wizard/TeamWizardName';
import TeamWizardRecap from '@/views/team/wizard/TeamWizardRecap';
import TeamWizardSection from '@/views/team/wizard/TeamWizardSection';
import TeamWizardTrainers from '@/views/team/wizard/TeamWizardTrainers';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
function TeamStack() {
  const { t } = useTranslation();

  return (
    <TeamWizardProvider>
      <Stack.Navigator
        id={undefined}
        initialRouteName={RouteNames.TeamList}
        screenOptions={commonOptions}
      >
        <Stack.Screen
          component={TeamList}
          name={RouteNames.TeamList}
          options={{
            ...commonOptions,
            headerTitle: t('teamList.title'),
          }}
        />
        <Stack.Screen
          component={MyTeamList}
          name={RouteNames.MyTeamList}
          options={{
            ...commonOptions,
            headerTitle: t('myTeamList.title'),
          }}
        />
        <Stack.Screen
          component={TeamDetails}
          name={RouteNames.TeamDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={SquadEditScreen}
          name={RouteNames.SquadEdit}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={SquadDetailsScreen}
          name={RouteNames.SquadDetails}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          component={TeamMembershipRequestList}
          name={RouteNames.TeamMembershipRequests}
          options={{
            ...commonOptions,
            headerTitle: t('teamMembershipRequestList.title'),
          }}
        />
        {/* C-C — ecrans 11 et 12 du pack composition : la compo type d'une
            equipe, et le mur payant de la composition en ecran plein. */}
        <Stack.Screen
          component={TeamCompoTemplateScreen}
          name={RouteNames.TeamCompoTemplate}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={CompositionPaywallScreen}
          name={RouteNames.CompositionPaywall}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamEdit}
          name={RouteNames.TeamEdit}
          options={{
            ...commonOptions,
            headerTitle: t('teamEdit.title'),
          }}
        />
        <Stack.Screen
          component={TeamFilters}
          name={RouteNames.TeamFilters}
          options={{
            ...commonOptions,
            headerTitle: t('teamFilters.title', 'Filtres équipes'),
          }}
        />
        <Stack.Screen
          component={CreateSquadWizard}
          name={RouteNames.CreateSquad}
          options={{
            ...commonOptions,
            headerTitle: 'Créer une Squad',
          }}
        />
        <Stack.Screen
          component={TeamStatsScreen}
          name={RouteNames.TeamStats}
          options={{
            ...commonOptions,
            headerTitle: t('teamStats.title', 'Statistiques'),
          }}
        />

        <Stack.Screen
          component={TeamWizardName}
          name={RouteNames.TeamWizardName}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardDescription}
          name={RouteNames.TeamWizardDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardSection}
          name={RouteNames.TeamWizardSection}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardActivity}
          name={RouteNames.TeamWizardActivity}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardCategory}
          name={RouteNames.TeamWizardCategory}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardLevel}
          name={RouteNames.TeamWizardLevel}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardTrainers}
          name={RouteNames.TeamWizardTrainers}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TeamWizardRecap}
          name={RouteNames.TeamWizardRecap}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </TeamWizardProvider>
  );
}

export default TeamStack;
