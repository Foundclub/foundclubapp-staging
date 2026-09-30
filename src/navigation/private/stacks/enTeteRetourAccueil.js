import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

/**
 * RETOUR-ONGLET (b) — A06 et A12 de l'audit V1 (30/09) : « JE N'AI PAS DE RETOUR ».
 *
 * 🔴 LE CONSTAT, photographie : la case « Événement » de l'accueil ouvre la
 * recherche DANS la pile de l'onglet ; « Accueil » y ramène bien, mais rien à
 * l'écran ne dit comment sortir. Toute la pile était montée `headerShown: false`,
 * et la flèche de la recherche avait été retirée par D07 (06/08) au motif que
 * l'icône d'onglet suffisait. L'audit dit le contraire : personne ne la devine —
 * ni sur « Mes activités », ni sur les huit écrans d'entraînement.
 *
 * ✅ LE REMÈDE, UNE FOIS : l'en-tête de la maison (`commonOptions`, le même que
 * les 65 écrans qui portent `HeaderBackButton`), posé par le NAVIGATEUR sur chaque
 * écran non racine. Pas une copie par écran : un écran ajouté demain à la pile
 * l'a sans que personne n'y pense. Transparent, comme partout ailleurs :
 * `ScreenContainer` lit sa hauteur (`HeaderHeightContext`) et pousse le contenu
 * dessous, le fond d'écran passe derrière.
 *
 * 🌐 Le site n'est PAS concerné : sa pile est une doublure
 * (`web/src/shims/react-navigation/stack.tsx`) qui ignore les options — la barre
 * du site reste la seule.
 */

/**
 * Les écrans de la pile qui ne reçoivent PAS cet en-tête :
 *  · la RACINE (`SearchHome`) — l'accueil garde son en-tête League + cloche +
 *    avatar (D07, A01 en attente d'Adel : on n'y touche pas) ;
 *  · les ALIAS de la recherche (`SearchClubs`, `SearchEvents`,
 *    `SearchRecruitment`, `SearchReservations` → `SearchHubRouteAlias`) — ils se
 *    remplacent par la recherche au premier rendu, un en-tête n'y ferait que
 *    clignoter ;
 *  · les cotisations (`MyLicenses`, `MyLicensesArchive`) — elles dessinent DÉJÀ
 *    leur barre flèche + titre (`MemberTopBar`, S9-bis) : une seconde flèche
 *    serait un doublon.
 */
const SANS_EN_TETE = new Set(/** @type {string[]} */ ([
  RouteNames.MyLicenses,
  RouteNames.MyLicensesArchive,
  RouteNames.SearchClubs,
  RouteNames.SearchEvents,
  RouteNames.SearchHome,
  RouteNames.SearchRecruitment,
  RouteNames.SearchReservations,
]));

/**
 * L'en-tête de la maison, sans ce qui n'est pas de l'en-tête : l'animation des
 * cartes de cette pile, elle, ne change pas.
 */
const EN_TETE_MAISON = {
  headerShadowVisible: commonOptions.headerShadowVisible,
  headerShown: true,
  headerTitleAlign: commonOptions.headerTitleAlign,
  headerTitleStyle: commonOptions.headerTitleStyle,
  headerTransparent: commonOptions.headerTransparent,
};

/**
 * Le geste de la flèche : l'écran d'avant, ou l'accueil s'il n'y a rien dessous
 * (pile reconstruite par un lien, par exemple). Jamais une sortie de l'onglet.
 * @param {Record<string, any>} navigation la navigation de l'écran
 * @returns {void}
 */
export const revenirDansLaPile = (navigation) => {
  if ((navigation.getState?.()?.index ?? 0) > 0) {
    navigation.goBack();
    return;
  }
  navigation.popTo(RouteNames.SearchHome);
};

/**
 * Les options d'un écran de la pile de l'onglet d'accueil.
 * @param {{ navigation: Record<string, any>, route: { name: string } }} ecran ce que
 *   `screenOptions` reçoit
 * @param {Record<string, string>} [titres] le titre de chaque route qui n'écrit pas
 *   déjà le sien en tête d'écran — les autres ne le répètent pas
 * @returns {Record<string, any>} les options du navigateur
 */
export const optionsDeLaPileAccueil = ({ navigation, route }, titres = {}) => {
  if (SANS_EN_TETE.has(route.name)) return { headerShown: false };
  return {
    ...EN_TETE_MAISON,
    headerLeft: () => <HeaderBackButton onPress={() => revenirDansLaPile(navigation)} />,
    headerTitle: titres[route.name] || '',
  };
};
