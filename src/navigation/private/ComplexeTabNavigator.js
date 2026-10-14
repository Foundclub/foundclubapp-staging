/* eslint-disable global-require */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useRoute } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { totalDesPages } from '@/domains/complexe/complexeReservation';
import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import useUnreadMessages from '@/domains/messaging/useUnreadMessages';
import useTheme from '@/theme/themeContext';

import { commonOptions, getTabScreenCommonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import { createFocusedTabResetListener } from '@/navigation/tabRootReset';

import { useComplexeChoisi, useReservationsDuComplexe } from '@/services/complexe/complexeQueries';

const Tab = createBottomTabNavigator();

/**
 * L'ESPACE DU COMPLEXE sur téléphone — RESA-L5A1 (13/10/2026), planche EG02 : la coquille de
 * l'espace Ville (CollectiviteTabNavigator), barre du bas Accueil · Demandes · Planning ·
 * Messages. Ce lot pose « Accueil » (E-G02) et « Messages » (la messagerie du compte) ;
 * « Demandes » (E-G06) et « Planning » (E-G03) viennent avec le lot L5A2, qui les insère entre les
 * deux (le témoin `ComplexeTabNavigator.test.js` fixe l'ordre).
 * RESA-L5A2 (14/10/2026) — « Demandes » porte la pastille du nombre de demandes en attente (la
 * même lecture que l'écran : le total du serveur).
 * Paramètres de route : `complexeId`, `justeCree` (E-G01, « … est en ligne »).
 * Monté seulement quand `COMPLEXES_GERANT` est allumé (PrivateNavigator). Sur le site, la même
 * navigation sera le menu latéral (lot web) : exempté (webRouteExemptions.js).
 * @returns {import('react').ReactElement} L'espace du complexe.
 */
function ComplexeTabNavigator() {
  const { t } = useTranslation();
  const { Colors, Images } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const params = /** @type {{ complexeId?: string, justeCree?: boolean } | undefined} */ (
    route?.params
  );
  const { unreadCount } = useUnreadMessages();
  const { userData } = useAuth();
  // RESA-L5A2 (planche RB, état 4) : ouvrir l'espace (par la bascule, « Mon compte » ou une
  // notification du complexe reçue en mode joueur) repasse le téléphone en mode complexe.
  useEffect(() => {
    ecrireModeComplexe(userData?.documentId, true);
  }, [userData?.documentId]);
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const enAttente = useReservationsDuComplexe(complexeId, { vue: 'demandes' });
  const demandes = totalDesPages(enAttente.data) || 0;

  const renderIcone = (/** @type {{ badge: number, color: string, source: any }} */ {
    badge, color, source,
  }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
      <Image source={source} style={{ height: 20, width: 20 }} tintColor={color} />
      {badge > 0 ? (
        <View
          style={{
            alignItems: 'center',
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

  const optionsDe = (
    /** @type {string} */ label,
    /** @type {any} */ icon,
    /** @type {number} */ badge,
  ) => ({
    headerShown: false,
    ...getTabScreenCommonOptions({
      accessibilityLabel: label,
      activeColor: Colors.primary500,
      badge,
      bottomInset: insets.bottom,
      icon,
      label,
      renderTabBarIcon: renderIcone,
      visualLabel: label,
    }),
  });

  // bottom-tabs 7 ne lit plus `sceneContainerStyle` (les autres barres du bas le posent encore,
  // sans effet) : rien à poser ici, l'écran a le même rendu que l'espace Ville.
  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={RouteNames.ComplexeAccueil}
      screenOptions={commonOptions}
    >
      {/* Des déclarations EXPLICITES : le témoin de parité web lit chaque nom. */}
      <Tab.Screen
        getComponent={() => require('@/views/complexe/ComplexeAccueil').default}
        initialParams={{ complexeId: params?.complexeId, justeCree: params?.justeCree }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.ComplexeAccueil}
        options={optionsDe(t('complexeGerant.onglets.accueil', 'Accueil'), Images.home, 0)}
      />
      <Tab.Screen
        getComponent={() => require('@/views/complexe/ComplexeDemandes').default}
        initialParams={{ complexeId: params?.complexeId }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.ComplexeDemandes}
        options={optionsDe(
          t('complexeGerant.gerer.demandes', 'Demandes'),
          Images.inboxArrowDown,
          demandes,
        )}
      />
      <Tab.Screen
        getComponent={() => require('@/views/complexe/ComplexePlanning').default}
        initialParams={{ complexeId: params?.complexeId }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.ComplexePlanning}
        options={optionsDe(t('complexeGerant.gerer.planning', 'Planning'), Images.calendar, 0)}
      />
      <Tab.Screen
        getComponent={() => require('@/views/Messaging').default}
        initialParams={{ chatScope: 'classic' }}
        listeners={createFocusedTabResetListener}
        name={RouteNames.Chat}
        options={optionsDe(
          t('complexeGerant.onglets.messages', 'Messages'),
          Images.envelope,
          unreadCount,
        )}
      />
    </Tab.Navigator>
  );
}

export default ComplexeTabNavigator;
