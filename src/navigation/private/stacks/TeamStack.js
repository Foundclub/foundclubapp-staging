import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import MyTeamList from '@/views/team/MyTeamList';
import TeamDetails from '@/views/team/TeamDetails';
import TeamEdit from '@/views/team/TeamEdit';
import TeamList from '@/views/team/TeamList';
import TeamMembershipRequestList from '@/views/team/TeamMembershipRequestList';

const Stack = createStackNavigator();

function TeamStack() {
  const { t } = useTranslation();

  return (
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
        component={TeamMembershipRequestList}
        name={RouteNames.TeamMembershipRequests}
        options={{
          ...commonOptions,
          headerTitle: t('teamMembershipRequestList.title'),
        }}
      />
      <Stack.Screen
        component={TeamEdit}
        name={RouteNames.TeamEdit}
        options={{
          ...commonOptions,
          headerTitle: t('teamEdit.title'),
        }}
      />
    </Stack.Navigator>
  );
}

export default TeamStack;
