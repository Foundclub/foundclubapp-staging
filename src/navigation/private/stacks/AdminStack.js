import { createStackNavigator } from '@react-navigation/stack';

import AdminClaimDetail from '@/views/admin/AdminClaimDetail';
import AdminClaimList from '@/views/admin/AdminClaimList';
import AdminClubDetail from '@/views/admin/AdminClubDetail';
import AdminClubList from '@/views/admin/AdminClubList';
import AdminDashboard from '@/views/admin/AdminDashboard';
import AdminEvents from '@/views/admin/AdminEvents';
import AdminLeagueDisputes from '@/views/admin/AdminLeagueDisputes';
import AdminReports from '@/views/admin/AdminReports';
import AdminRevenue from '@/views/admin/AdminRevenue';
import AdminUserDetail from '@/views/admin/AdminUserDetail';
import AdminUserList from '@/views/admin/AdminUserList';
import FeaturedRequestsList from '@/views/admin/FeaturedRequestsList';
import SuperAdminContentExplorer from '@/views/admin/SuperAdminContentExplorer';
import SuperAdminEntryDetail from '@/views/admin/SuperAdminEntryDetail';
import SuperAdminEntryForm from '@/views/admin/SuperAdminEntryForm';
import SuperAdminEntryList from '@/views/admin/SuperAdminEntryList';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
function AdminStack() {
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
      <Stack.Screen
        component={AdminClaimList}
        name={RouteNames.AdminClaimList}
        options={{
          ...commonOptions,
          headerTitle: 'Revendications',
        }}
      />
      <Stack.Screen
        component={AdminClaimDetail}
        name={RouteNames.AdminClaimDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Détail Demande',
        }}
      />
      <Stack.Screen
        component={AdminUserList}
        name={RouteNames.AdminUserList}
        options={{
          ...commonOptions,
          headerTitle: 'Utilisateurs',
        }}
      />
      <Stack.Screen
        component={AdminUserDetail}
        name={RouteNames.AdminUserDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Détail Utilisateur',
        }}
      />
      <Stack.Screen
        component={AdminClubList}
        name={RouteNames.AdminClubList}
        options={{
          ...commonOptions,
          headerTitle: 'Clubs',
        }}
      />
      <Stack.Screen
        component={AdminClubDetail}
        name={RouteNames.AdminClubDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Détail Club',
        }}
      />
      <Stack.Screen
        component={AdminLeagueDisputes}
        name={RouteNames.AdminLeagueDisputes}
        options={{
          ...commonOptions,
          headerTitle: 'Litiges League',
        }}
      />
      <Stack.Screen
        component={SuperAdminContentExplorer}
        name={RouteNames.SuperAdminContentExplorer}
        options={{
          ...commonOptions,
          headerTitle: 'Explorer CM',
        }}
      />
      <Stack.Screen
        component={SuperAdminEntryList}
        name={RouteNames.SuperAdminEntryList}
        options={{
          ...commonOptions,
          headerTitle: 'Entrées',
        }}
      />
      <Stack.Screen
        component={SuperAdminEntryDetail}
        name={RouteNames.SuperAdminEntryDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Détail',
        }}
      />
      <Stack.Screen
        component={SuperAdminEntryForm}
        name={RouteNames.SuperAdminEntryForm}
        options={{
          ...commonOptions,
          headerTitle: 'Edition',
        }}
      />
    </Stack.Navigator>
  );
}

export default AdminStack;
