import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
// utils
import MyEventsList from '@/views/event/MyEventList';
import Home from '@/views/Home';
import Messaging from '@/views/Messaging';
import Profile from '@/views/profile/Profile';

import { commonOptions, getTabScreenCommonOptions } from '../commonOptions';
import { RouteNames } from '../routeNames';
// screens
// hooks
import useTheme from '../../theme/themeContext';

const Tab = createBottomTabNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {React.ReactElement} PublicNavigator component.
 */
function PrivateTabNavigator() {
  // hooks
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();

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
      initialRouteName={RouteNames.Search}
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
        component={MyEventsList}
        name={RouteNames.MyEventList}
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
        component={Profile}
        name={RouteNames.Profile}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              activeColor: Colors.primary500,
              icon: Images.strokeShield,
              label: t('menu.myAccount'),
              renderTabBarIcon,
            },
          ),
        })}
      />
      <Tab.Screen
        component={Messaging}
        name={RouteNames.Chat}
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

export default PrivateTabNavigator;
