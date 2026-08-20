import { StackActions } from '@react-navigation/native';

/**
 * AA04 ① — « JE RESTE BLOQUE DANS LA RECHERCHE ET JE NE PEUX PLUS RETOURNER
 * DANS L'ACCUEIL, SAUF EN FERMANT ET ROUVRANT L'APP » (Adel, 2026-08-20).
 *
 * Ce n'est pas un bouton manquant, c'est la PILE. L'onglet « Accueil » n'est pas
 * un ecran, c'est `SearchStack` : sa racine est `SearchHome` (le hub d'accueil)
 * et la recherche, `SearchHub`, s'EMPILE par-dessus. Depuis l'onglet Equipes,
 * « trouver un club » appelle `navigateToSearchHub`, qui bascule sur l'onglet
 * Accueil ET y empile la recherche. L'onglet Accueil est alors DEJA au premier
 * plan, et la barre d'onglets de `@react-navigation/bottom-tabs` ne fait
 * strictement RIEN dans ce cas :
 *
 *   // node_modules/@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx:406
 *   if (!focused && !event.defaultPrevented) { navigation.dispatch(...) }
 *
 * Plus aucun geste ne ramene a l'accueil : `SearchHub` est monte sans en-tete
 * (`SearchStack.js`, `headerShown: false`) et n'offre aucun retour. Poser un
 * bouton « retour » sur cet ecran ne reparerait que cet ecran-la, et laisserait
 * le bouton du telephone se comporter autrement — on repare donc la pile.
 *
 * La regle posee ici est celle que tout le monde connait des applications a
 * onglets : appuyer sur l'onglet DEJA au premier plan ramene a sa racine.
 */

/**
 * L'onglet presse est-il deja au premier plan avec quelque chose EMPILE dessus ?
 *
 * Rend la cle de la sous-pile a depiler, ou `null` quand il n'y a rien a faire :
 *  · onglet pas au premier plan  -> le navigateur bascule deja tout seul ;
 *  · onglet sans sous-navigateur -> il n'y a pas de pile a depiler ;
 *  · sous-pile deja a sa racine  -> on y est.
 * @param {any} tabState - L'etat du navigateur d'onglets (`navigation.getState()`).
 * @param {string} routeKey - La cle de l'onglet presse (`route.key`).
 * @returns {{ target: string } | null} La sous-pile a ramener a sa racine.
 */
export const resolveFocusedTabResetTarget = (tabState, routeKey) => {
  const routes = Array.isArray(tabState?.routes) ? tabState.routes : [];
  const focusedRoute = routes[tabState?.index];
  if (!focusedRoute || !routeKey || focusedRoute.key !== routeKey) {
    return null;
  }

  const nestedState = focusedRoute.state;
  const nestedRoutes = Array.isArray(nestedState?.routes) ? nestedState.routes : [];
  if (!nestedState?.key || nestedRoutes.length === 0) {
    return null;
  }

  const nestedIndex = typeof nestedState.index === 'number'
    ? nestedState.index
    : nestedRoutes.length - 1;

  return nestedIndex > 0 ? { target: nestedState.key } : null;
};

/**
 * L'ecouteur a poser sur chaque `Tab.Screen`. Il ne remplace RIEN : la bascule
 * d'un onglet a l'autre reste celle du navigateur, on n'ajoute que le cas qu'il
 * laissait sans reponse.
 * @param {{ navigation: any, route: any }} params - Ce que `listeners` recoit.
 * @returns {{ tabPress: (event: any) => void }} L'ecouteur d'onglet.
 */
export const createFocusedTabResetListener = ({ navigation, route }) => ({
  tabPress: () => {
    const reset = resolveFocusedTabResetTarget(navigation.getState(), route.key);
    if (!reset) {
      return;
    }

    navigation.dispatch({ ...StackActions.popToTop(), target: reset.target });
  },
});
