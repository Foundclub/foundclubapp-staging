import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';

import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Home from '@/views/Home';

import { commonOptions, getTabScreenCommonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import AuthStackNavigator from './AuthStackNavigator';

const Tab = createBottomTabNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {import('react').ReactElement} PublicNavigator component.
 */
function PublicTabNavigator() {
  const { Colors, Images } = useTheme();
  const { t } = useTranslation();
  const [{ isAddingAccount }] = useAppContext();

  console.log('[PublicTabNavigator] Rendering. isAddingAccount:', isAddingAccount, 'Initial Route:', isAddingAccount ? RouteNames.AuthStackAccount : RouteNames.Search);

  /**
   * Render tab bar icon.
   * @param {object} props - Component props.
   * @param {import('react-native').ImageSourcePropType} props.source - Icon source.
   * @param {number} props.badge - Icon badge.
   * @param {string} props.color - Icon color.
   * @returns {React.ReactElement} TabBarIcon component.
   */
  const renderTabBarIcon = ({
    badge, color, source,
  }) => (
    <View>
      <Image source={source} style={{ height: 20, tintColor: color, width: 20 }} />
      {badge ? (
        <View style={{
          paddingLeft: 21,
          position: 'absolute',
          top: 7,
        }}
        />
      ) : null}
    </View>
  );

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={isAddingAccount ? RouteNames.AuthStackAccount : RouteNames.Search}
      screenOptions={commonOptions}
    >
      <Tab.Screen
        component={Home}
        name={RouteNames.Search}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              activeColor: Colors.primary500,
              icon: Images.search,
              label: t('menu.search'),
              renderTabBarIcon,
            },
          ),
        }}
      />
      <Tab.Screen
        component={AuthStackNavigator}
        name={RouteNames.AuthStackPlanning}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              activeColor: Colors.primary500,
              icon: Images.stadium,
              label: t('menu.planning'),
              renderTabBarIcon,
            },
          ),
        })}
      />
      <Tab.Screen
        component={AuthStackNavigator}
        name={RouteNames.AuthStackAccount}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              activeColor: Colors.primary500,
              icon: Images.strokeShield,
              label: t('menu.myTeams'),
              renderTabBarIcon,
            },
          ),
        })}
      />
      <Tab.Screen
        component={AuthStackNavigator}
        name={RouteNames.AuthStackMessaging}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              activeColor: Colors.primary500,
              icon: Images.envelope,
              label: t('menu.chat'),
              renderTabBarIcon,
            },
          ),
        })}
      />
    </Tab.Navigator>
  );
}

export default PublicTabNavigator;
