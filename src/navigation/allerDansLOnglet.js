import { RouteNames } from '@/navigation/routeNames';

/**
 * REVENIR DANS L'ONGLET DEPUIS UN ÉCRAN DE TÂCHE — la forme imbriquée, écrite une fois.
 *
 * 🔴 LE DÉFAUT QUE CE FICHIER FERME, mesuré à l'écran le 2026-09-08 et prouvé par le
 * journal de l'appareil :
 *
 *     The action 'NAVIGATE' with payload {"name":"TrainingSessionNow",…}
 *     was not handled by any navigator. Do you have a screen named…?
 *
 * On répondait aux cinq questions de forme, on appuyait sur « Commencer ma séance »…
 * et RIEN. Le verdict partait bien au serveur, la séance passait « en cours » — mais
 * l'écran ne bougeait pas. Cinq navigations étaient mortes de la même façon.
 *
 * 🔎 POURQUOI. Les écrans de TÂCHE (parcours guidé, relevé vidéo, schéma en grand,
 * questions de forme, fiche d'un test) vivent sur la pile RACINE : c'est ce qui cache
 * le dock, et c'est le motif maison — « une route hors des onglets n'a pas de dock »
 * (décision D5, précédent des cotisations S9). Mais les écrans de CONSULTATION
 * (« Ma séance », « Toutes mes séances », la file des relevés) vivent, eux, dans
 * `SearchStack`, deux niveaux plus bas :
 *
 *     pile racine → `HomeTab` → onglet `Search` → SearchStack → l'écran
 *
 * `navigate('TrainingSessionNow')` depuis la racine remonte vers les PARENTS ; il ne
 * descend jamais chez un voisin. Il faut donc nommer le chemin — c'est la forme que
 * le dépôt emploie déjà ailleurs (`EventDetails.js:3364`, `HomeHub.js:1118`…).
 *
 * ⚠️ POURQUOI UN FICHIER PLUTÔT QUE CINQ COPIES : deux niveaux d'imbrication écrits à
 * la main cinq fois, c'est cinq occasions de se tromper — et l'erreur ne se voit qu'à
 * l'exécution, sur le terrain. C'est exactement comme ça que celle-ci est arrivée.
 *
 * 🔴 RETOUR-ONGLET (A22 de l'audit V1, 30/09) — « APRÈS LA SÉANCE, JE SUIS BLOQUÉ ».
 * La forme imbriquée ARRIVAIT bien à l'écran… dans un SECOND onglet d'accueil. En
 * React Navigation 7, `navigate` ne revient plus en arrière vers une route déjà
 * empilée (StackRouter, cas 'NAVIGATE' : il ne cherche l'existante que si `pop` est
 * posé) : depuis la racine, il EMPILAIT un nouveau `HomeTab` dont la pile commençait
 * directement par l'écran visé. « Accueil » n'y avait plus rien à dépiler, et il
 * fallait quatre retours pour revoir l'accueil ; chaque « Revenir à ma séance » en
 * empilait un de plus. `pop` aux DEUX niveaux qui empilent : la racine revient au
 * `HomeTab` déjà ouvert (l'écran de tâche est retiré), et la pile de l'onglet revient
 * à l'écran s'il y est déjà, au lieu d'en poser une copie.
 * Preuve : `__tests__/allerDansLOnglet.pileRacine.test.js` (vrais routeurs).
 */

/**
 * Le chemin imbriqué `HomeTab` → onglet `Search` → l'écran, écrit une fois.
 * @param {string} ecran le nom de la route visée, dans `SearchStack`
 * @param {Record<string, any>} [parametres] ses paramètres
 * @returns {Record<string, any>} les paramètres à donner à `HomeTab`
 */
const versLEcranDeLOnglet = (ecran, parametres) => ({
  params: { params: parametres, pop: true, screen: ecran },
  screen: RouteNames.Search,
});

/**
 * Va vers un écran de l'onglet d'accueil depuis n'importe où.
 * @param {Record<string, any>} navigation l'objet de navigation de l'écran appelant
 * @param {string} ecran le nom de la route visée, dans `SearchStack`
 * @param {Record<string, any>} [parametres] ses paramètres
 * @returns {void}
 */
const allerDansLOnglet = (navigation, ecran, parametres) => {
  navigation.navigate(RouteNames.HomeTab, versLEcranDeLOnglet(ecran, parametres), { pop: true });
};

/**
 * RETOUR-ONGLET-2 — la même destination, depuis un écran de REDIRECTION de la racine
 * (`SearchHubLegacyRedirect`, `SearchRouteRedirect`), qui doit DISPARAÎTRE derrière lui.
 *
 * Ils faisaient `replace(HomeTab, …)` : `replace` remplace l'écran du DESSUS, il ne
 * revient pas au `HomeTab` du dessous. Depuis les alertes (`SearchAlerts:119`) ou depuis
 * le Planning (`EventListContent:833`), on obtenait donc [HomeTab, …, HomeTab].
 *
 * ⚠️ POURQUOI `popTo` ET PAS `allerDansLOnglet` : les deux reviennent au `HomeTab` déjà
 * empilé. Mais quand il n'y en a PAS (mode League : la racine commence par
 * `LeagueHomeTab`), `navigate` l'EMPILERAIT par-dessus l'écran de redirection — le
 * retour retomberait sur un écran qui tourne à vide, son effet ne se rejouant pas.
 * `popTo` le REMPLACE, exactement comme le faisait `replace`
 * (`@react-navigation/routers` StackRouter, cas 'POP_TO').
 * Sur le site, `popTo` est un `replace` (webNavigationAdapter.js) : rien ne change.
 * Preuve : `__tests__/retourOnglet2.pileRacine.test.js` (F1, et sa garde « mode League »).
 * @param {Record<string, any>} navigation l'objet de navigation de l'écran de redirection
 * @param {string} ecran le nom de la route visée, dans `SearchStack`
 * @param {Record<string, any>} [parametres] ses paramètres
 * @returns {void}
 */
export const remplacerParLOnglet = (navigation, ecran, parametres) => {
  navigation.popTo(RouteNames.HomeTab, versLEcranDeLOnglet(ecran, parametres));
};

export default allerDansLOnglet;
