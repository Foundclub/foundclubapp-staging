import { createStackNavigator } from '@react-navigation/stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Stepper from '@/components/atoms/stepper/Stepper';
import AddCoach from '@/views/club/AddCoach';
import AddSponsor from '@/views/club/AddSponsor';
import ClubDetails from '@/views/club/ClubDetails';
import ClubFilters from '@/views/club/ClubFilters';
import ClubList from '@/views/club/ClubList';
import ClubMembershipRequestList from '@/views/club/ClubMembershipRequestList';
import CreateClubRequest from '@/views/club/CreateClubRequest';
import UserAvatar from '@/views/onboarding/UserAvatar';
import UserBirthdate from '@/views/onboarding/UserBirthdate';
import UserName from '@/views/onboarding/UserName';
import UserType from '@/views/onboarding/UserRole';
import UserSection from '@/views/onboarding/UserSection';
import Welcome from '@/views/onboarding/Welcome';
import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';
import TeamDetails from '@/views/team/TeamDetails';
import TeamEdit from '@/views/team/TeamEdit';
import TeamFilters from '@/views/team/TeamFilters';
import TeamList from '@/views/team/TeamList';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import PrivateTabNavigator from './PrivateTabNavigator';

const Stack = createStackNavigator();

/**
 * PrivateNavigator component, with routes available for authenticated users.
 * Handles onboarding flow based on user data.
 * @returns {import('react').ReactElement | null} PrivateNavigator component.
 */
function PrivateNavigator() {
  // hooks
  const { Fonts, Spaces } = useTheme();
  const { onboardingViews, userData } = useAuth();
  const { t } = useTranslation();

  // methods
  /**
   * Get the step number based on the current route name.
   * @param {string} routeName
   * @returns {number} Step number
   */
  const getStepNumber = (routeName) => onboardingViews?.views?.find(
    (view) => view.route === routeName,
  )?.index || 0;

  /**
   * Get the total number of steps in the onboarding process.
   * @returns {number} Total steps
   */
  const getTotalSteps = () => onboardingViews?.totalViews || 0;

  // renderers
  /**
   * Render the stepper component.
   * @param {string} routeName
   * @returns {import('react').ReactElement}
   */
  const renderStepper = (routeName) => (
    <Stepper currentStep={getStepNumber(routeName)} steps={getTotalSteps()} />
  );

  /**
   * Render the stepper indicator.
   * @param {string} routeName
   * @returns {import('react').ReactElement}
   */
  const renderStepperIndicator = (routeName) => (
    <View style={[Spaces.marginHorizontal[12]]}>
      <Text style={[Fonts.p2, Fonts.neutral300]}>
        {getStepNumber(routeName)}
        /
        {getTotalSteps()}
      </Text>
    </View>
  );

  const initialRouteName = useMemo(() => {
    const route = onboardingViews?.views?.reduce((acc, view) => {
      if (view.index < acc.index && view.canShow) {
        return view;
      }
      return acc;
    }, { index: 100, route: '' })?.route;
    return route || RouteNames.HomeTab;
  }, [onboardingViews]);

  const canShowHome = useMemo(() => !!(onboardingViews?.views
    ?.filter(({ canShow }) => canShow)?.length || 0 <= 2), [onboardingViews]);

  const canShowView = useCallback((/** @type {string} */routeName) => {
    // console.log('canShowView', routeName, onboardingViews);
    const view = onboardingViews?.views?.find((item) => item.route === routeName);
    const viewable = onboardingViews?.views?.filter(({ canShow }) => canShow)?.length || 0;
    return !!(view && viewable > 1);
  }, [onboardingViews]);

  return userData?.documentId ? (
    <Stack.Navigator
      id={undefined}
      initialRouteName={initialRouteName}
      key={userData?.documentId}
      screenOptions={commonOptions}
    >
      {canShowHome ? (
        <Stack.Screen
          component={PrivateTabNavigator}
          name={RouteNames.HomeTab}
          options={{ headerShown: false }}
        />
      ) : null}
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
        component={AddCoach}
        name={RouteNames.AddCoach}
        options={{
          ...commonOptions,
          headerTitle: t('addCoach.titles.main'),
        }}
      />
      <Stack.Screen
        component={ClubList}
        name={RouteNames.ClubList}
        options={{
          ...commonOptions,
          headerTitle: t('clubList.title'),
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
        component={ClubDetails}
        name={RouteNames.Club}
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
        component={TeamList}
        name={RouteNames.TeamList}
        options={{
          ...commonOptions,
          headerTitle: t('teamList.title'),
        }}
      />
      <Stack.Screen
        component={TeamFilters}
        name={RouteNames.TeamFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
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
        component={TeamEdit}
        name={RouteNames.TeamEdit}
        options={{
          ...commonOptions,
          headerTitle: t('teamEdit.title'),
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
      {canShowView(RouteNames.UserRole) ? (
        <Stack.Screen
          component={UserType}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserRole}
          options={commonOptions}
        />
      ) : null}
      {canShowView(RouteNames.UserName) ? (
        <Stack.Screen
          component={UserName}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserName}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserName),
            headerTitle: () => renderStepper(RouteNames.UserName),
            headerTitleAlign: 'left',

          }}
        />
      ) : null}
      {canShowView(RouteNames.UserSection) ? (
        <Stack.Screen
          component={UserSection}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserSection}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserSection),
            headerTitle: () => renderStepper(RouteNames.UserSection),
            headerTitleAlign: 'left',

          }}
        />
      ) : null}

      {canShowView(RouteNames.UserBirthdate) ? (
        <Stack.Screen
          component={UserBirthdate}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserBirthdate}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserBirthdate),
            headerTitle: () => renderStepper(RouteNames.UserBirthdate),
            headerTitleAlign: 'left',

          }}
        />
      ) : null}

      {canShowView(RouteNames.UserAvatar) ? (
        <Stack.Screen
          component={UserAvatar}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserAvatar}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserAvatar),
            headerTitle: () => renderStepper(RouteNames.UserAvatar),
            headerTitleAlign: 'left',

          }}
        />
      ) : null}

      {canShowView(RouteNames.Welcome) ? (
        <Stack.Screen
          component={Welcome}
          key={onboardingViews?.totalViews}
          name={RouteNames.Welcome}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.Welcome),
            headerTitle: () => renderStepper(RouteNames.Welcome),
            headerTitleAlign: 'left',

          }}
        />
      ) : null}

    </Stack.Navigator>
  ) : null;
}

export default PrivateNavigator;
