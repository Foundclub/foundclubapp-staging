// @ts-nocheck
/* eslint-disable global-require */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
// hooks
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';

import { useClubScope } from '@/context/ClubScopeContext';
// utils and misc
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '../../theme/themeContext';
import {
  commonOptions,
  getFloatingTabBarScenePaddingBottom,
  getTabScreenCommonOptions,
} from '../commonOptions';
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
  const clubScope = useClubScope() || {};
  const insets = useSafeAreaInsets();
  const floatingScenePaddingBottom = getFloatingTabBarScenePaddingBottom(insets.bottom);
  const hasMultisportAccess = Boolean(userData?.multisportClubs?.length > 0);
  const isSectionScope = clubScope.activeMode === 'section';
  const activeSectionClubId = clubScope.activeSectionClubId || userData?.club?.documentId || '';
  const activeMultisportClubId = clubScope.activeMultisportClubId
    || userData?.club?.parentMultisport?.documentId
    || userData?.multisportClubs?.[0]?.documentId
    || '';
  const getTeamTabComponent = () => {
    if (canManageTeam && hasMultisportAccess && !isSectionScope) {
      return require('@/views/multisportClub/CMDashboard').default;
    }

    if (canManageTeam && userData?.club) {
      return require('@/views/team/TeamList').default;
    }

    return require('@/views/team/MyTeamList').default;
  };
  const teamTabLabel = canManageTeam && hasMultisportAccess && !isSectionScope
    ? t('menu.myClub')
    : t('menu.myTeams');

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
      {badge > 0 ? (
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
                shadowColor: 'black',
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
        // tabBarBackground removed to eliminate gradient
      }}
    >
      <Tab.Screen
        component={SearchStack}
        name={RouteNames.Search}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: t('menu.home', 'Accueil'),
            activeColor: Colors.primary500,
            bottomInset: insets.bottom,
            icon: Images.home,
            label: t('menu.home', 'Accueil'),
            renderTabBarIcon,
            visualLabel: t('menuDock.home', 'Accueil'),
          }),
        }}
      />
      <Tab.Screen
        getComponent={() => require('@/views/event/MyEventList').default}
        name={RouteNames.MyEventList}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: t('menu.planning', 'Mon planning'),
            activeColor: Colors.primary500,
            bottomInset: insets.bottom,
            icon: Images.stadium,
            label: t('menu.planning'),
            renderTabBarIcon,
            visualLabel: t('menuDock.planning', 'Planning'),
          }),
        }}
      />
      {userData?.id ? (
        <Tab.Screen
          getComponent={getTeamTabComponent}
          initialParams={{
            clubId: activeSectionClubId,
            cmId: activeMultisportClubId,
            playerId: userData?.documentId,
          }}
          name={RouteNames.MyTeamList}
          options={{
            headerShown: false,
            ...getTabScreenCommonOptions({
              accessibilityLabel: teamTabLabel,
              activeColor: Colors.primary500,
              bottomInset: insets.bottom,
              icon: Images.strokeShield,
              label: teamTabLabel,
              renderTabBarIcon,
              visualLabel: canManageTeam && hasMultisportAccess && !isSectionScope
                ? t('menuDock.myClub', 'Club')
                : t('menuDock.myTeams', 'Équipes'),
            }),
          }}
        />
      ) : null}
      <Tab.Screen
        getComponent={() => require('@/views/Messaging').default}
        initialParams={{ chatScope: 'classic' }}
        name={RouteNames.Chat}
        options={{
          headerShown: false,
          ...getTabScreenCommonOptions({
            accessibilityLabel: t('menu.chat', 'Messagerie'),
            activeColor: Colors.primary500,
            badge: unreadCount,
            bottomInset: insets.bottom,
            icon: Images.envelope,
            label: t('menu.chat'),
            renderTabBarIcon,
            visualLabel: t('menuDock.chat', 'Messages'),
          }),
        }}
      />
    </Tab.Navigator>
  );
}

export default PrivateTabNavigator;
