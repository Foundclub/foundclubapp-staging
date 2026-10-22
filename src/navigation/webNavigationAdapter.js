import { RouteNames } from './routeNames';
import { buildWebPath } from './webRoutes';

// ==========================================================================
// COMPO-WEB (29/09) — LES OBJETS DU PARCOURS DE COMPOSITION, EN MEMOIRE.
//
// Sur le site, un ecran recoit ses parametres PAR L'ADRESSE, qui ne porte que
// du texte : `buildQueryString` jette tout objet. Entre deux ecrans du parcours
// de composition, les joueurs coches, le terrain en cours et le joueur hors app
// tout juste saisi disparaissaient donc — la selection arrivait vide au terrain,
// et « Publier » aurait remplace la vraie compo par une compo vide.
//
// ⚖️ CE QUI EST GARDE, ET OU : les parametres COMPLETS de la navigation, dans
// CETTE memoire (un `Map` du module), sous une cle que porte l'entree
// d'historique. C'est l'equivalent exact des parametres de navigation du
// telephone : ils vivent le temps de l'onglet, jamais dans le navigateur
// (ni localStorage, ni sessionStorage). Recharger la page les oublie — l'ecran
// relit alors le serveur (`useSiteCompositionRecovery.web.js`).
//
// ⛔ SEULS les 6 ecrans du parcours sont concernes : les 148 autres ecrans du
// site gardent leur comportement d'avant, a l'octet pres.
// ponytail: une liste nommee plutot qu'une regle generale. Plafond : un ecran
// d'un autre parcours qui aurait besoin d'objets doit etre AJOUTE ici, avec
// son propre temoin — l'ouvrir a tous changerait 148 ecrans d'un coup.
// ==========================================================================
/** @type {Set<string>} */
const CARRIED_ROUTES = new Set([
  RouteNames.MatchCallUpManualPlayer,
  RouteNames.MatchCallUpSelection,
  RouteNames.MatchCompositionAmend,
  RouteNames.MatchCompositionBoard,
  RouteNames.MatchCompositionStart,
  RouteNames.MatchConvocationPublished,
  // RESA-FIN-SITE (21/10/2026, tournée connectée du 22/10) — la réservation d'un terrain :
  // l'aperçu du serveur, la réservation créée, le détail d'un refus voyagent en objets. Sans eux,
  // « Cette réservation n'existe plus. » s'affichait après « Réserver ». Rechargé, l'écran relit.
  RouteNames.ReserverEchec,
  RouteNames.ReserverRecapitulatif,
  RouteNames.ReserverResultat,
]);

/** Au-dela, les plus anciennes entrees s'oublient : un onglet ne grossit pas sans fin. */
const MAX_CARRIED = 40;

/** @type {Map<string, Record<string, any>>} */
const carriedParams = new Map();
let carriedCount = 0;

/**
 * La cible reelle d'une navigation imbriquee (`{ screen, params }`), comme
 * `buildWebPath` la resout.
 * @param {string} routeName
 * @param {Record<string, any>} params
 * @returns {{ params: Record<string, any>, routeName: string }}
 */
const resolveTarget = (routeName, params = {}) => (
  typeof params?.screen === 'string'
    ? resolveTarget(params.screen, params?.params || {})
    : { params, routeName }
);

const hasObjectParam = (/** @type {Record<string, any>} */ params) => Object.values(params || {})
  .some((value) => value !== null && typeof value === 'object');

/**
 * Garde les parametres d'une navigation vers un ecran du parcours.
 * @param {string} routeName
 * @param {Record<string, any>} params
 * @returns {{ carry: string } | undefined} L'etat a poser sur l'entree d'historique.
 */
const carryParams = (routeName, params = {}) => {
  const target = resolveTarget(routeName, params);
  if (!CARRIED_ROUTES.has(target.routeName) || !hasObjectParam(target.params)) return undefined;
  carriedCount += 1;
  const carry = `compo-${Date.now().toString(36)}-${carriedCount}`;
  carriedParams.set(carry, target.params);
  while (carriedParams.size > MAX_CARRIED) {
    carriedParams.delete(carriedParams.keys().next().value);
  }
  return { carry };
};

/**
 * Les parametres gardes sous cette cle, ou `null` (cle absente, inconnue, ou
 * oubliee par un rechargement).
 * @param {string | undefined | null} carry
 * @returns {Record<string, any> | null}
 */
export const readCarriedWebParams = (carry) => (
  (carry && carriedParams.get(carry)) || null
);

const buildRouteState = (routeName, params = {}) => ({
  key: `${routeName}:${Date.now()}`,
  name: routeName,
  params,
});

export const createWebNavigationAdapter = ({
  currentPath = '/',
  currentRouteName,
  goBack,
  params = {},
  parentNavigation,
  push,
  replace,
  setSearchParams,
}) => {
  const resolveResetTarget = (resetState = {}) => {
    const nextRoute = resetState?.routes?.[resetState?.index ?? 0];
    if (!nextRoute?.name) return null;
    return {
      params: nextRoute.params || {},
      routeName: nextRoute.name,
    };
  };

  const adapter = {
    addListener: () => () => {},
    canGoBack: () => {
      if (typeof window === 'undefined') return false;
      return window.history.length > 1;
    },
    currentPath,
    currentRouteName,
    dispatch: (action) => {
      const type = action?.type;
      const payload = action?.payload || {};

      if (type === 'GO_BACK') {
        adapter.goBack();
        return;
      }

      if (type === 'REPLACE') {
        adapter.replace(payload.name, payload.params || {});
        return;
      }

      if (type === 'NAVIGATE') {
        adapter.navigate(payload.name, payload.params || {});
        return;
      }

      if (type === 'RESET') {
        const resetTarget = resolveResetTarget(payload);
        if (!resetTarget) return;
        adapter.replace(resetTarget.routeName, resetTarget.params);
      }
    },
    getParent: () => parentNavigation || adapter,
    goBack: () => {
      if (typeof goBack === 'function') {
        goBack();
      }
    },
    isFocused: () => true,
    navigate: (routeName, nextParams = {}) => {
      if (typeof push !== 'function') {
        return;
      }
      push(buildWebPath(routeName, nextParams), carryParams(routeName, nextParams));
    },
    // COMPO-WEB — `popTo` MANQUAIT : l'appeler faisait planter la page (apres
    // « Publier », `MatchCompositionBoard` y revient vers la fiche du match).
    // Le site n'a pas de pile a depiler : l'entree courante est REMPLACEE par la
    // cible, donc le retour ne repasse pas par l'ecran qu'on quitte.
    popTo: (/** @type {string} */ routeName, nextParams = {}) => {
      adapter.replace(routeName, nextParams);
    },
    push: (routeName, nextParams = {}) => {
      if (typeof push !== 'function') {
        return;
      }
      push(buildWebPath(routeName, nextParams), carryParams(routeName, nextParams));
    },
    replace: (routeName, nextParams = {}) => {
      if (typeof replace !== 'function') {
        return;
      }
      replace(buildWebPath(routeName, nextParams), carryParams(routeName, nextParams));
    },
    reset: (resetState = {}) => {
      const resetTarget = resolveResetTarget(resetState);
      if (!resetTarget) {
        return;
      }
      adapter.replace(resetTarget.routeName, resetTarget.params);
    },
    route: buildRouteState(currentRouteName, params),
    setOptions: () => {},
    setParams: (nextParams = {}) => {
      const mergedParams = {
        ...params,
        ...nextParams,
      };
      // COMPO-WEB — un ecran du parcours porte des OBJETS : `setSearchParams` les
      // ecrirait « [object Object] » dans l'adresse (et « undefined » pour un
      // parametre efface). On reecrit donc l'entree courante par le meme chemin
      // que toute navigation : texte dans l'adresse, objets en memoire.
      if (CARRIED_ROUTES.has(currentRouteName)) {
        adapter.replace(currentRouteName, mergedParams);
        return;
      }
      if (typeof setSearchParams !== 'function') {
        return;
      }
      // FINITIONS18 · POINT 12 (T16) — `initialTab=undefined` dans l'adresse de l'équipe :
      // un paramètre EFFACÉ (`undefined`) s'écrivait « undefined » (react-router écrit chaque
      // clé reçue). La règle de `buildQueryString` : ni vide, ni objet ; un `false` reste écrit.
      setSearchParams(Object.fromEntries(Object.entries(mergedParams)
        .filter(([, valeur]) => valeur !== undefined && valeur !== null && valeur !== ''
          && typeof valeur !== 'object')
        .map(([cle, valeur]) => [cle, String(valeur)])));
    },
  };

  return adapter;
};

export default createWebNavigationAdapter;
