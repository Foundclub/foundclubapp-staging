import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Home from '@/views/Home';

import {
  commonOptions,
  getFloatingTabBarScenePaddingBottom,
  getTabScreenCommonOptions,
} from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import { createLogger } from '@/utils/logger/logger';

import PublicAuthGateScreen from './PublicAuthGateScreen';
import { openPublicAuthFlow } from './publicAuthNavigation';

const publicTabLogger = createLogger('public-tab-navigator');

const Tab = createBottomTabNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {import('react').ReactElement} PublicNavigator component.
 */
function PublicTabNavigator() {
  const { Colors, Images } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const floatingScenePaddingBottom = getFloatingTabBarScenePaddingBottom(insets.bottom);
  publicTabLogger.debug('Rendering', {
    initialRoute: RouteNames.Search,
  });

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
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
      <Image source={source} style={{ height: 20, width: 20 }} tintColor={color} />
      {badge ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: Colors.error500,
            borderColor: 'rgba(9, 24, 35, 0.94)',
            borderRadius: 999,
            borderWidth: 1.5,
            height: 18,
            justifyContent: 'center',
            minWidth: 18,
            paddingHorizontal: 4,
            position: 'absolute',
            right: -6,
            top: -3,
            ...(Platform.OS === 'web'
              ? { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.22)' }
              : {
                shadowColor: '#000',
                shadowOffset: { height: 2, width: 0 },
                shadowOpacity: 0.22,
                shadowRadius: 4,
              }),
          }}
        >
          <Text
            style={{
              color: Colors.neutral00,
              fontFamily: 'Montserrat-Bold',
              fontSize: 10,
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={RouteNames.Search}
      screenOptions={{
        ...commonOptions,
        sceneContainerStyle: {
          backgroundColor: 'transparent',
          paddingBottom: floatingScenePaddingBottom,
        },
      }}
    >
      <Tab.Screen
        component={Home}
        name={RouteNames.Search}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              accessibilityLabel: t('menu.search', 'Rechercher'),
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.search,
              label: t('menu.search'),
              renderTabBarIcon,
              visualLabel: t('menuDock.search', 'Recherche'),
            },
          ),
        }}
      />
      <Tab.Screen
        component={PublicAuthGateScreen}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            openPublicAuthFlow(navigation, {
              origin: route.name,
              source: 'public-tab-press',
            });
          },
        })}
        name={RouteNames.AuthStackPlanning}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              accessibilityLabel: t('menu.planning', 'Mon planning'),
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.stadium,
              label: t('menu.planning'),
              renderTabBarIcon,
              visualLabel: t('menuDock.planning', 'Planning'),
            },
          ),
        })}
      />
      <Tab.Screen
        component={PublicAuthGateScreen}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            openPublicAuthFlow(navigation, {
              origin: route.name,
              source: 'public-tab-press',
            });
          },
        })}
        name={RouteNames.AuthStackAccount}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              accessibilityLabel: t('menu.myTeams', 'Mes équipes'),
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.strokeShield,
              label: t('menu.myTeams'),
              renderTabBarIcon,
              visualLabel: t('menuDock.myTeams', 'Équipes'),
            },
          ),
        })}
      />
      <Tab.Screen
        component={PublicAuthGateScreen}
        listeners={({ navigation, route }) => ({
          tabPress: (event) => {
            event.preventDefault();
            openPublicAuthFlow(navigation, {
              origin: route.name,
              source: 'public-tab-press',
            });
          },
        })}
        name={RouteNames.AuthStackMessaging}
        options={({
          headerShown: false,
          ...getTabScreenCommonOptions(
            {
              accessibilityLabel: t('menu.chat', 'Messagerie'),
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.envelope,
              label: t('menu.chat'),
              renderTabBarIcon,
              visualLabel: t('menuDock.chat', 'Messages'),
            },
          ),
        })}
      />
    </Tab.Navigator>
  );
}

export default PublicTabNavigator;
