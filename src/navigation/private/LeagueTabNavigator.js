import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  View,
} from 'react-native';

// hooks
import useAuth from '@/domains/auth/useAuth';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';

import { useGetLeagueTeamContext } from '@/services/leagueTeam/leagueTeamQueries';

import { isLeagueCaptain } from '@/utils/league/captains';
// screens
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';
import Messaging from '@/views/Messaging';
import MyTeamList from '@/views/team/MyTeamList';

import LeagueNavigator from '@/navigation/LeagueNavigator';

// utils and misc
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '../../theme/themeContext';
import {
  commonOptions,
  getFloatingTabBarScenePaddingBottom,
  getTabScreenCommonOptions,
} from '../commonOptions';
import { RouteNames } from '../routeNames';

const Tab = createBottomTabNavigator();

/**
 * LeagueTabs component - "Gold Mode"
 * Mirrored structure from PrivateTabNavigator but focused on League features.
 * @returns {React.ReactElement} LeagueTabNavigator component.
 */
export default function LeagueTabNavigator() {
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();
  const { userData } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const insets = useSafeAreaInsets();
  const floatingScenePaddingBottom = getFloatingTabBarScenePaddingBottom(insets.bottom);
  const { data: leagueTeamContext } = useGetLeagueTeamContext(userData?.documentId || '', {
    enabled: Boolean(userData?.documentId),
    staleTime: 30_000,
  });
  const myLeagueTeams = Array.isArray(leagueTeamContext?.squads) ? leagueTeamContext.squads : [];

  const squadRequestsBadge = myLeagueTeams.reduce((total, squad) => {
    if (!isLeagueCaptain(squad, userData)) return total;
    return total + Number(squad?.join_requests?.length || 0);
  }, 0);

  /**
   * Gold badge renderer (reused logic, updated style).
   * @param {{ badge?: number, color: string, source: import('react-native').ImageSourcePropType }} props
   * @returns {import('react').ReactElement}
   */
  const renderTabBarIcon = ({
    badge = 0,
    color,
    source,
  }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
      <Image source={source} style={{ height: 20, width: 20 }} tintColor={color} />
      {badge > 0 ? (
        <View style={{
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
              shadowColor: 'black',
              shadowOffset: { height: 2, width: 0 },
              shadowOpacity: 0.22,
              shadowRadius: 4,
            }),
        }}
        >
          <Text
            style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 10 }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const screenOptions = /** @type {any} */ ({
    ...commonOptions,
    sceneContainerStyle: {
      backgroundColor: 'transparent',
      paddingBottom: floatingScenePaddingBottom,
    },
    // tabBarBackground removed to eliminate gradient
  });

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={RouteNames.LeagueDashboard}
      screenOptions={screenOptions}
    >
      {/* 1. Home / Dashboard */}
      <Tab.Screen
        component={LeagueNavigator}
        name={RouteNames.LeagueDashboard}
        options={({ route }) => {
          const baseOptions = getTabScreenCommonOptions({
            accessibilityLabel: 'League',
            activeColor: Colors.gold500, // GOLD ACCENT
            bottomInset: insets.bottom,
            icon: Images.trophy, // Reuse Trophy or similar
            label: 'League', // TODO: Translate keys
            renderTabBarIcon,
            visualLabel: 'League',
          });
          const focusedRouteName = getFocusedRouteNameFromRoute(route)
            || RouteNames.LeagueDashboard;
          const hideTabBar = (
            focusedRouteName === RouteNames.EndMatchScreen
            || focusedRouteName === RouteNames.SquadFilters
          );
          return {
            headerShown: false,
            ...baseOptions,
            tabBarStyle: hideTabBar
              ? { ...(/** @type {Record<string, any>} */ (baseOptions.tabBarStyle || {})), display: 'none' }
              : baseOptions.tabBarStyle,
          };
        }}
      />

      {/* 2. My Squad (Reusing MyTeamList) */}
      <Tab.Screen
        component={MyTeamList}
        // Note: We'll filter for League teams via params later
        initialParams={{ isLeagueMode: true, playerId: userData?.documentId }}
        name={RouteNames.LeagueSquadTab}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: 'Squad',
            activeColor: Colors.gold500,
            badge: squadRequestsBadge,
            bottomInset: insets.bottom,
            icon: Images.strokeShield,
            label: 'Squad',
            renderTabBarIcon,
            visualLabel: 'Squad',
          }),
        }}
      />

      {/* 3. Match Center */}
      <Tab.Screen
        component={MatchCenterScreen}
        name={RouteNames.LeagueMatchTab}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: 'Matchs',
            activeColor: Colors.gold500,
            bottomInset: insets.bottom,
            icon: Images.whistle, // Reuse Whistle or similar
            label: 'Matchs',
            renderTabBarIcon,
            visualLabel: 'Matchs',
          }),
        }}
      />

      {/* 4. Messaging (Replaces Standings) */}
      <Tab.Screen
        component={Messaging}
        initialParams={{ chatScope: 'league' }}
        name={RouteNames.Chat}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: t('menu.chat', 'Messagerie'),
            activeColor: Colors.gold500,
            badge: unreadCount,
            bottomInset: insets.bottom,
            icon: Images.envelope,
            label: t('menu.chat'), // "Messagerie"
            renderTabBarIcon,
            visualLabel: t('menuDock.chat', 'Messages'),
          }),
        }}
      />

    </Tab.Navigator>
  );
}
