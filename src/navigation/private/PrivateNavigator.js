import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useAuth } from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Stepper from '@/components/atoms/stepper/Stepper';
import AddCoach from '@/views/club/AddCoach';
import ClubDetails from '@/views/club/ClubDetails';
import ClubFilters from '@/views/club/ClubFilters';
import ClubList from '@/views/club/ClubList';
import Home from '@/views/Home';
import UserAvatar from '@/views/onboarding/UserAvatar';
import UserBirthdate from '@/views/onboarding/UserBirthdate';
import UserName from '@/views/onboarding/UserName';
import UserSection from '@/views/onboarding/UserSection';
import UserType from '@/views/onboarding/UserType';
import Welcome from '@/views/onboarding/Welcome';
import Profile from '@/views/profile/Profile';
import ProfileEdit from '@/views/profile/ProfileEdit';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 * PrivateNavigator component, with routes available for authenticated users.
 * Handles onboarding flow based on user data.
 * @returns {import('react').ReactElement | null} PrivateNavigator component.
 */
function PrivateNavigator() {
  // hooks
  const { Fonts, Spaces } = useTheme();
  const { onboardingViews } = useAuth();
  const { t } = useTranslation();

  // methods
  /**
   * Get the step number based on the current route name.
   * @param {string} routeName
   * @returns {number} Step number
   */
  const getStepNumber = (routeName) => {
    if (!onboardingViews?.includes(routeName)) return 0;
    return onboardingViews.indexOf(routeName) + 1;
  };

  /**
   * Get the total number of steps in the onboarding process.
   * @returns {number} Total steps
   */
  const getTotalSteps = () => onboardingViews?.length || 0;

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
    <View style={[Spaces.marginHorizontal[24]]}>
      <Text style={[Fonts.p2, Fonts.neutral300]}>
        {getStepNumber(routeName)}
        /
        {getTotalSteps()}
      </Text>
    </View>
  );

  /**
   * Get the next route name for a given current route
   * @param {string} currentRoute
   * @returns {string|undefined} Next route name or undefined if it's the last route
   */
  const getNextRoute = (currentRoute) => {
    const currentIndex = onboardingViews?.indexOf(currentRoute);
    return onboardingViews?.[currentIndex + 1];
  };

  return onboardingViews?.length ? (
    <Stack.Navigator
      id={undefined}
      initialRouteName={onboardingViews[0] || RouteNames.Home}
      screenOptions={commonOptions}
    >
      <Stack.Screen
        component={Home}
        name={RouteNames.Home}
        options={{ headerShown: false }}
      />
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
      {onboardingViews?.includes(RouteNames.UserType) && (
        <Stack.Screen
          component={UserType}
          initialParams={{
            nextRoute: getNextRoute(RouteNames.UserType),
          }}
          name={RouteNames.UserType}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserType),
            headerTitle: () => renderStepper(RouteNames.UserType),
          }}
        />
      )}
      {onboardingViews?.includes(RouteNames.UserName) && (
        <Stack.Screen
          component={UserName}
          initialParams={{ nextRoute: getNextRoute(RouteNames.UserName) }}
          name={RouteNames.UserName}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserName),
            headerTitle: () => renderStepper(RouteNames.UserName),
          }}
        />
      )}
      {onboardingViews?.includes(RouteNames.UserSection) && (
        <Stack.Screen
          component={UserSection}
          initialParams={{ nextRoute: getNextRoute(RouteNames.UserSection) }}
          name={RouteNames.UserSection}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserSection),
            headerTitle: () => renderStepper(RouteNames.UserSection),
          }}
        />
      )}
      {onboardingViews?.includes(RouteNames.UserBirthdate) && (
        <Stack.Screen
          component={UserBirthdate}
          initialParams={{ nextRoute: getNextRoute(RouteNames.UserBirthdate) }}
          name={RouteNames.UserBirthdate}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserBirthdate),
            headerTitle: () => renderStepper(RouteNames.UserBirthdate),
          }}
        />
      )}
      {onboardingViews?.includes(RouteNames.UserAvatar) && (
        <Stack.Screen
          component={UserAvatar}
          initialParams={{ nextRoute: getNextRoute(RouteNames.UserAvatar) }}
          name={RouteNames.UserAvatar}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserAvatar),
            headerTitle: () => renderStepper(RouteNames.UserAvatar),
          }}
        />
      )}
      {onboardingViews?.includes(RouteNames.Welcome) && (
        <Stack.Screen
          component={Welcome}
          initialParams={{ nextRoute: getNextRoute(RouteNames.Welcome) }}
          name={RouteNames.Welcome}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.Welcome),
            headerTitle: () => renderStepper(RouteNames.Welcome),
          }}
        />
      )}
    </Stack.Navigator>
  ) : null;
}

export default PrivateNavigator;
