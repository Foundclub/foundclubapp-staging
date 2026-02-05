
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Image, View, Text } from 'react-native';
// hooks
import useAuth from '@/domains/auth/useAuth';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';
// screens
import LeagueNavigator from '@/navigation/LeagueNavigator';
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';
import MyTeamList from '@/views/team/MyTeamList';
import Messaging from '@/views/Messaging';

// utils and misc
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useTheme from '../../theme/themeContext';
import { commonOptions, getTabScreenCommonOptions } from '../commonOptions';
import { RouteNames } from '../routeNames';
import LinearGradient from 'react-native-linear-gradient';

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

  // Gold badge renderer (reused logic, updated style)
  const renderTabBarIcon = ({ badge, color, source }) => (
    <View>
      <Image source={source} style={{ height: 20, tintColor: color, width: 20 }} />
      {badge > 0 ? (
        <View style={{
            position: 'absolute', right: -6, top: -4, backgroundColor: Colors.error500,
            borderRadius: 10, height: 16, minWidth: 16, alignItems: 'center', justifyContent: 'center'
        }}>
          <Text style={{ color: Colors.neutral00, fontSize: 10, fontFamily: 'Montserrat-Bold' }}>{badge}</Text>
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
        tabBarBackground: () => (
            <LinearGradient
                colors={['rgba(165, 239, 255, 0.2)', 'rgba(110, 191, 244, 0.04)', 'rgba(70, 144, 213, 0)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ height: '100%', width: '100%' }}
            />
        ),
      }}
    >
      {/* 1. Home / Dashboard */}
      <Tab.Screen
        component={LeagueNavigator}
        name={RouteNames.LeagueDashboard}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            activeColor: Colors.gold500, // GOLD ACCENT
            bottomInset: insets.bottom,
            icon: Images.trophy, // Reuse Trophy or similar
            label: 'League', // TODO: Translate keys
            renderTabBarIcon,
          }),
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
            bottomInset: insets.bottom,
            badge: unreadCount,
            icon: Images.envelope,
            label: t('menu.chat'), // "Messagerie"
            renderTabBarIcon,
          }),
        }}
      />

    </Tab.Navigator>
  );
}
