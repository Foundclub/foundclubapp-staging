import { RouteNames } from '@/navigation/routeNames';

/**
 * FINITIONS12-STATS (point 2, tournee T11) — OUVRIR UNE VUE DU PROFIL PAR-DESSUS LE PROFIL.
 *
 * « Retours du coach », « Mes stats » et l apercu sont des vues de la MEME route
 * (`UserDetails` + `view` ou `preview`), et on les ouvre depuis cette route-la : la fiche
 * de l enfant chez son parent, ou « Mon profil » (`SelfProfilePlayerCoach`,
 * `SelfProfileUnified`, rendus DANS `UserDetails`). Or `navigate` vers l ecran deja
 * affiche REMPLACE ses parametres au lieu d empiler une page (React Navigation 7,
 * StackRouter : « If the route matches the current one, then navigate to it ») : la fiche
 * de Hugo devenait la vue de ses retours, et Retour ramenait a « Mes enfants ».
 * `push` empile : Retour revient a la page d ou l on vient.
 * Temoin : `__tests__/UserDetails.ST-RETOURS.parent.test.js` (pile du vrai routeur).
 * @param {{ push: (name: string, params?: object) => void }} navigation La navigation de l ecran.
 * @param {object} params Les parametres de la vue (`userId`, `view`, `preview`).
 * @returns {void}
 */
const ouvrirUneVueDuProfil = (navigation, params) => (
  navigation.push(RouteNames.UserDetails, params)
);

export default ouvrirUneVueDuProfil;
