import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import AddCoach from '@/views/club/AddCoach';
import AddSponsor from '@/views/club/AddSponsor';
import AssignCoachTeams from '@/views/club/AssignCoachTeams';
import ClubDetails from '@/views/club/ClubDetails';
import ClubEdit from '@/views/club/ClubEdit';
import ClubFilters from '@/views/club/ClubFilters';
import ClubList from '@/views/club/ClubList';
import ClubMembershipRequestList from '@/views/club/ClubMembershipRequestList';
import CreateClubRequest from '@/views/club/CreateClubRequest';
import RequestsDashboard from '@/views/club/RequestsDashboard';
import FacilityForm from '@/views/facility/FacilityForm';
import FacilityList from '@/views/facility/FacilityList';
import ClubLicenseCampaignSettings from '@/views/license/ClubLicenseCampaignSettings';
import ClubLicenseMemberDetail from '@/views/license/ClubLicenseMemberDetail';
import ClubLicensePayments from '@/views/license/ClubLicensePayments';
import ClubLicenses from '@/views/license/ClubLicenses';
import MultisportClubEditDetails from '@/views/multisportClub/MultisportClubEditDetails';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
function ClubStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={RouteNames.ClubList}
      screenOptions={commonOptions}
    >
      <Stack.Screen
        component={ClubList}
        name={RouteNames.ClubList}
        options={{
          ...commonOptions,
          headerTitle: t('clubList.title'),
        }}
      />
      <Stack.Screen
        component={ClubDetails}
        name={RouteNames.Club}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={ClubEdit}
        name={RouteNames.ClubEdit}
        options={{
          ...commonOptions,
          headerTitle: t('clubEdit.title') || 'Modifier le club',
        }}
      />
      <Stack.Screen
        component={ClubFilters}
        name={RouteNames.ClubFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={ClubMembershipRequestList}
        name={RouteNames.ClubMembershipRequests}
        options={{
          ...commonOptions,
          headerTitle: t('clubMembershipRequestList.title'),
        }}
      />
      <Stack.Screen
        component={AssignCoachTeams}
        name={RouteNames.AssignCoachTeams}
        options={{
          ...commonOptions,
          headerTitle: 'Assigner a une équipe',
        }}
      />
      <Stack.Screen
        component={AddCoach}
        name={RouteNames.AddCoach}
        options={{
          ...commonOptions,
          headerTitle: t('addCoach.titles.main'),
        }}
      />
      <Stack.Screen
        component={AddSponsor}
        name={RouteNames.AddSponsor}
        options={{
          ...commonOptions,
          headerTitle: t('addSponsor.title'),
        }}
      />
      <Stack.Screen
        component={CreateClubRequest}
        name={RouteNames.CreateClub}
        options={{
          ...commonOptions,
          headerTitle: t('createClubRequest.title'),
        }}
      />
      <Stack.Screen
        component={FacilityList}
        name={RouteNames.FacilityList}
        options={{
          ...commonOptions,
          headerTitle: 'Installations',
        }}
      />
      <Stack.Screen
        component={FacilityForm}
        name={RouteNames.FacilityForm}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={RequestsDashboard}
        name={RouteNames.RequestsDashboard}
        options={{
          ...commonOptions,
          headerTitle: t('requests.title', 'Demandes'),
        }}
      />

      <Stack.Screen
        component={ClubLicenses}
        name={RouteNames.ClubLicenses}
        options={{
          ...commonOptions,
          headerTitle: 'Cotisations',
        }}
      />
      <Stack.Screen
        component={ClubLicenses}
        name={RouteNames.ClubLicenseCampaignDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Campagne cotisation',
        }}
      />
      <Stack.Screen
        component={ClubLicenseMemberDetail}
        name={RouteNames.ClubLicenseMemberDetail}
        options={{
          ...commonOptions,
          headerTitle: 'Cotisation membre',
        }}
      />
      <Stack.Screen
        component={ClubLicenseCampaignSettings}
        name={RouteNames.ClubLicenseCampaignSettings}
        options={{
          ...commonOptions,
          headerTitle: 'Parametres cotisations',
        }}
      />
      <Stack.Screen
        component={ClubLicensePayments}
        name={RouteNames.ClubLicensePayments}
        options={{
          ...commonOptions,
          headerTitle: 'Paiements cotisations',
        }}
      />

      <Stack.Screen
        component={MultisportClubEditDetails}
        name={RouteNames.MultisportClubEdit}
        options={{
          ...commonOptions,
          headerTitle: 'Modifier le club',
        }}
      />
    </Stack.Navigator>
  );
}

export default ClubStack;
