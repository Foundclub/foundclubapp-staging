import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';
import UserDetails from '@/views/profile/UserDetails';

const Stack = createStackNavigator();

function ProfileStack() {
  const { t } = useTranslation();

  return (
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
    </Stack.Navigator>
  );
}

export default ProfileStack;
