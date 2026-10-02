/* eslint-disable global-require */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { collectiviteTabs } from '@/domains/collectivite/collectiviteAccueil';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';
import useTheme from '@/theme/themeContext';

import {
  commonOptions,
  getFloatingTabBarScenePaddingBottom,
  getTabScreenCommonOptions,
} from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import { createFocusedTabResetListener } from '@/navigation/tabRootReset';

import { useCollectiviteRequests } from '@/services/collectivite/collectiviteQueries';

const Tab = createBottomTabNavigator();

/**
 * 🏛️ L'ESPACE DE LA VILLE sur téléphone — COLL-ACCUEIL (01/10/2026), planche « Navigation
 * de l'espace de la Ville » : une barre du bas à quatre onglets, avec la pastille du nombre
 * de demandes en attente sur « Demandes » (même lecture, même clef que l'écran : elle suit
 * chaque décision sans code en plus).
 *
 * Paramètres de route : `collectiviteId` (la Ville), `returnLabel` (compte mixte : le nom de
 * son club, l'accueil de la Ville affiche « ‹ son club »).
 * Sur le site, la même navigation est le menu latéral (AppShell du dépôt web) : cet écran y
 * est exempté (webRouteExemptions.js).
 * @returns {import('react').ReactElement} L'espace de la Ville.
 */
function CollectiviteTabNavigator() {
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const params = /** @type {{ collectiviteId?: string, returnLabel?: string } | undefined} */ (
    route?.params
  );
  const collectiviteId = params?.collectiviteId || null;
  const pending = useCollectiviteRequests(collectiviteId, 'pending');
  const { unreadCount } = useUnreadMessages();
  const pendingCount = Array.isArray(pending.data) ? pending.data.length : 0;

  const renderIcone = (/** @type {{ badge: number, color: string, source: any }} */ {
    badge, color, source,
  }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
      <Image source={source} style={{ height: 20, width: 20 }} tintColor={color} />
      {badge > 0 ? (
        <View
          style={{
            alignItems: 'center',
            // Même jeton que la pastille de la cloche (NotificationBadge) : 5,2:1.
            backgroundColor: Colors.error700,
            borderRadius: 999,
            height: 18,
            justifyContent: 'center',
            minWidth: 18,
            paddingHorizontal: 4,
            position: 'absolute',
            right: -6,
            top: -3,
          }}
        >
          <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 10 }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const onglets = collectiviteTabs({
    Images, pendingCount, t, unreadCount,
  });
  const optionsDe = (/** @type {string} */ nom) => {
    const onglet = onglets.find((candidat) => candidat.name === nom) || onglets[0];
    return {
      headerShown: false,
      ...getTabScreenCommonOptions({
        accessibilityLabel: onglet.a11y,
        activeColor: Colors.primary500,
        badge: onglet.badge,
        bottomInset: insets.bottom,
        icon: onglet.icon,
        label: onglet.label,
        renderTabBarIcon: renderIcone,
        visualLabel: onglet.label,
      }),
    };
  };

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={RouteNames.CollectiviteHome}
      screenOptions={{
        ...commonOptions,
        sceneContainerStyle: {
          backgroundColor: 'transparent',
          paddingBottom: getFloatingTabBarScenePaddingBottom(insets.bottom),
        },
      }}
    >
      {/* Quatre déclarations EXPLICITES : le témoin de parité web lit chaque nom. */}
      <Tab.Screen
        getComponent={() => require('@/views/collectivite/CollectiviteHome').default}
        initialParams={{ collectiviteId, returnLabel: params?.returnLabel, space: true }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.CollectiviteHome}
        options={optionsDe(RouteNames.CollectiviteHome)}
      />
      <Tab.Screen
        getComponent={() => require('@/views/collectivite/CollectiviteRequests').default}
        initialParams={{ collectiviteId }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.CollectiviteRequests}
        options={optionsDe(RouteNames.CollectiviteRequests)}
      />
      <Tab.Screen
        getComponent={() => require('@/views/facility/FacilityList').default}
        initialParams={{ collectiviteId }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.CollectiviteInstallations}
        options={optionsDe(RouteNames.CollectiviteInstallations)}
      />
      <Tab.Screen
        getComponent={() => require('@/views/Messaging').default}
        // COLL-C4A (02/10) : la messagerie sait qu'elle est dans l'espace de la Ville (son canal
        // des actualités et « Publier » en tête, planche P3v2-messages-tel).
        initialParams={{ chatScope: 'classic', collectiviteId, espace: 'ville' }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.Chat}
        options={optionsDe(RouteNames.Chat)}
      />
    </Tab.Navigator>
  );
}

export default CollectiviteTabNavigator;
