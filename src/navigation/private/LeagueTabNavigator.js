import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
// hooks
import useAuth from '@/domains/auth/useAuth';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';

import { useGetMyLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
// screens
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';
import Messaging from '@/views/Messaging';
import MyTeamList from '@/views/team/MyTeamList';

import LeagueNavigator from '@/navigation/LeagueNavigator';

// utils and misc
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '../../theme/themeContext';
import { commonOptions, getTabScreenCommonOptions } from '../commonOptions';
import { RouteNames } from '../routeNames';

const Tab = createBottomTabNavigator();

/**
 * LeagueTabs component - "Gold Mode"
 * Mirrored structure from PrivateTabNavigator but focused on League features.
 */
export default function LeagueTabNavigator() {
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();
  const { userData } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const insets = useSafeAreaInsets();
  const { data: myLeagueTeams } = useGetMyLeagueTeam(userData?.documentId || '', {
    enabled: Boolean(userData?.documentId),
    staleTime: 30_000,
  });

  const squadRequestsBadge = Array.isArray(myLeagueTeams)
    ? myLeagueTeams.reduce((total, squad) => {
      const isCaptain = String(squad?.captain?.documentId || '') === String(userData?.documentId || '');
      if (!isCaptain) return total;
      return total + Number(squad?.join_requests?.length || 0);
    }, 0)
    : 0;

  // Gold badge renderer (reused logic, updated style)
  const renderTabBarIcon = ({ badge, color, source }) => (
    <View>
      <Image source={source} style={{ height: 20, tintColor: color, width: 20 }} />
      {badge > 0 ? (
        <View style={{
          alignItems: 'center',
          backgroundColor: Colors.error500,
          borderRadius: 10,
          height: 16,
          justifyContent: 'center',
          minWidth: 16,
          position: 'absolute',
          right: -6,
          top: -4,
        }}
        >
          <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 10 }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={RouteNames.LeagueDashboard}
      screenOptions={{
        ...commonOptions,
        // tabBarBackground removed to eliminate gradient
      }}
    >
      {/* 1. Home / Dashboard */}
      <Tab.Screen
        component={LeagueNavigator}
        name={RouteNames.LeagueDashboard}
        options={({ route }) => {
          const baseOptions = getTabScreenCommonOptions({
            activeColor: Colors.gold500, // GOLD ACCENT
            bottomInset: insets.bottom,
            icon: Images.trophy, // Reuse Trophy or similar
            label: 'League', // TODO: Translate keys
            renderTabBarIcon,
          });
          const focusedRouteName = getFocusedRouteNameFromRoute(route) || RouteNames.LeagueDashboard;
          const hideTabBar = (
            focusedRouteName === RouteNames.EndMatchScreen
            || focusedRouteName === RouteNames.SquadFilters
          );
          return {
            headerShown: false,
            ...baseOptions,
            tabBarStyle: hideTabBar
              ? { ...baseOptions.tabBarStyle, display: 'none' }
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
            activeColor: Colors.gold500,
            badge: squadRequestsBadge,
            bottomInset: insets.bottom,
            icon: Images.strokeShield,
            label: 'Squad',
            renderTabBarIcon,
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
            activeColor: Colors.gold500,
            bottomInset: insets.bottom,
            icon: Images.whistle, // Reuse Whistle or similar
            label: 'Matchs',
            renderTabBarIcon,
          }),
        }}
      />

      {/* 4. Messaging (Replaces Standings) */}
      <Tab.Screen
        component={Messaging}
        name={RouteNames.Chat}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            activeColor: Colors.gold500,
            badge: unreadCount,
            bottomInset: insets.bottom,
            icon: Images.envelope,
            label: t('menu.chat'), // "Messagerie"
            renderTabBarIcon,
          }),
        }}
      />

    </Tab.Navigator>
  );
}
