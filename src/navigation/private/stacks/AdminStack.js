import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import AdminDashboard from '@/views/admin/AdminDashboard';
import AdminEvents from '@/views/admin/AdminEvents';
import AdminReports from '@/views/admin/AdminReports';
import AdminRevenue from '@/views/admin/AdminRevenue';
import FeaturedRequestsList from '@/views/admin/FeaturedRequestsList';

const Stack = createStackNavigator();

function AdminStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={RouteNames.AdminDashboard}
      screenOptions={commonOptions}
    >
      <Stack.Screen
        component={AdminDashboard}
        name={RouteNames.AdminDashboard}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={AdminRevenue}
        name={RouteNames.AdminRevenue}
        options={{
          ...commonOptions,
          headerTitle: 'Revenus',
        }}
      />
      <Stack.Screen
        component={AdminEvents}
        name={RouteNames.AdminEvents}
        options={{
          ...commonOptions,
          headerTitle: 'Événements',
        }}
      />
      <Stack.Screen
        component={AdminReports}
        name={RouteNames.AdminReports}
        options={{
          ...commonOptions,
          headerTitle: 'Signalements',
        }}
      />
      <Stack.Screen
        component={FeaturedRequestsList}
        name={RouteNames.FeaturedRequestsList}
        options={{
          ...commonOptions,
          headerTitle: 'Demandes à la une',
        }}
      />
    </Stack.Navigator>
  );
}

export default AdminStack;
