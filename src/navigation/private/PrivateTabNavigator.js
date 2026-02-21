import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
// hooks
import useAuth from '@/domains/auth/useAuth';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';
import { useRequestsHubData } from '@/services/requests/requestsHubQueries';
// screens
import MyEventsList from '@/views/event/MyEventList';
import Messaging from '@/views/Messaging';
import RequestsHub from '@/views/requests/RequestsHub';
import CMDashboard from '@/views/multisportClub/CMDashboard';
import MyTeamList from '@/views/team/MyTeamList';
// utils and misc
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TeamList from '@/views/team/TeamList';

import useTheme from '../../theme/themeContext';
import { commonOptions, getTabScreenCommonOptions } from '../commonOptions';
import { RouteNames } from '../routeNames';
import SearchStack from './stacks/SearchStack';

const Tab = createBottomTabNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {React.ReactElement} PublicNavigator component.
 */
function PrivateTabNavigator() {
  // hooks
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();
  const { unreadCount } = useUnreadMessages();
  const { canManageTeam, userData } = useAuth();
  const insets = useSafeAreaInsets();
  const trainedTeamIds = (userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean);
  const clubId = userData?.club?.documentId || userData?.trainedTeams?.[0]?.club?.documentId || '';
  const cmId = userData?.multisportClubs?.[0]?.documentId || '';

  const requestsHubQuery = useRequestsHubData({
    clubId,
    cmId,
    teamIds: trainedTeamIds,
  }, {
    enabled: Boolean(canManageTeam && userData?.documentId),
    refetchInterval: 45_000,
  });
  const requestsCount = requestsHubQuery?.data?.counts?.total || 0;

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
      {badge > 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: Colors.error500,
            borderRadius: 10,
            height: 16,
            justifyContent: 'center',
            minWidth: 16,
            padding: 2,
            position: 'absolute',
            right: -6,
            top: -4,
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
        sceneContainerStyle: { backgroundColor: 'transparent' },
        // tabBarBackground removed to eliminate gradient
      }}
    >
      <Tab.Screen
        component={SearchStack}
        name={RouteNames.Search}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            activeColor: Colors.primary500,
            bottomInset: insets.bottom,
            icon: Images.search,
            label: t('menu.home', 'Accueil'),
            renderTabBarIcon,
          }),
        }}
      />
      <Tab.Screen
        component={MyEventsList}
        name={RouteNames.MyEventList}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            activeColor: Colors.primary500,
            bottomInset: insets.bottom,
            icon: Images.stadium,
            label: t('menu.planning'),
            renderTabBarIcon,
          }),
        }}
      />
      {userData?.id ? (
        <Tab.Screen
          component={
            canManageTeam && userData?.multisportClubs?.length > 0
              ? CMDashboard
              : canManageTeam && userData?.club
                ? TeamList
                : MyTeamList
          }
          initialParams={{
            clubId: userData?.club?.documentId,
            playerId: userData?.documentId,
            cmId: userData?.multisportClubs?.[0]?.documentId,
          }}
          name={RouteNames.MyTeamList}
          options={{
            headerShown: false,
            ...getTabScreenCommonOptions({
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.strokeShield,
              label: canManageTeam && userData?.multisportClubs?.length > 0
                ? t('menu.myClub')
                : t('menu.myTeams'),
              renderTabBarIcon,
            }),
          }}
        />
      ) : null}
      {canManageTeam ? (
        <Tab.Screen
          component={RequestsHub}
          initialParams={{ source: 'home' }}
          name={RouteNames.RequestsTab}
          options={{
            headerShown: false,
            ...getTabScreenCommonOptions({
              activeColor: Colors.primary500,
              badge: requestsCount,
              bottomInset: insets.bottom,
              icon: Images.bell,
              label: t('menu.requests', 'Demandes'),
              renderTabBarIcon,
            }),
          }}
        />
      ) : null}
      <Tab.Screen
        component={Messaging}
        name={RouteNames.Chat}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            activeColor: Colors.primary500,
            badge: unreadCount,
            bottomInset: insets.bottom,
            icon: Images.envelope,
            label: t('menu.chat'),
            renderTabBarIcon,
          }),
        }}
      />
    </Tab.Navigator>
  );
}

export default PrivateTabNavigator;
