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
 */

/**
 * Va vers un écran de l'onglet d'accueil depuis n'importe où.
 * @param {Record<string, any>} navigation l'objet de navigation de l'écran appelant
 * @param {string} ecran le nom de la route visée, dans `SearchStack`
 * @param {Record<string, any>} [parametres] ses paramètres
 * @returns {void}
 */
const allerDansLOnglet = (navigation, ecran, parametres) => {
  navigation.navigate(RouteNames.HomeTab, {
    params: { params: parametres, screen: ecran },
    screen: RouteNames.Search,
  });
};

export default allerDansLOnglet;
