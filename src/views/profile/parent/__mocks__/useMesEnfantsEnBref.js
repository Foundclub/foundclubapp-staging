/**
 * PAR-L7 (13/10) — LA DOUBLURE DE `useMesEnfantsEnBref` pour les témoins des écrans.
 *
 * Le vrai crochet lit trois services, qui chargent le client HTTP — lequel refuse de se charger
 * sans `.env`, absent de toute copie de travail. Un témoin d'écran (« Mon compte », « Mon
 * profil ») écrit simplement `jest.mock('@/views/profile/parent/useMesEnfantsEnBref');` : il
 * reçoit cette doublure, « aucun enfant » par défaut. Ses règles ont leurs propres témoins
 * (`parent/__tests__/useMesEnfantsEnBref.test.js`, `mesEnfantsEnBref.test.js`).
 *
 * Pour donner des enfants à un témoin : `useMesEnfantsEnBref.regler({ lignes, reste, total })` ;
 * ce que l'écran a demandé : `useMesEnfantsEnBref.appels` (les `{ actif }` reçus).
 */

/** @typedef {{ lignes: any[], reste: number, total: number }} Bref */

/** @type {Bref} */
const AUCUN = Object.freeze({ lignes: [], reste: 0, total: 0 });

/** @type {{ valeur: Bref }} */
const etat = { valeur: AUCUN };

/** @type {Array<{ actif: boolean }>} */
const appels = [];

/**
 * La doublure : elle note ce qu'on lui demande et rend ce qu'on lui a réglé.
 * @param {{ actif: boolean }} options - Ce que l'écran demande.
 * @returns {Bref} - Les enfants réglés (aucun par défaut).
 */
const useMesEnfantsEnBref = (options) => {
  appels.push(options);
  return etat.valeur;
};

/**
 * Régler les enfants que la doublure rend ; sans argument, « aucun enfant ».
 * @param {Bref} [valeur] - Les enfants à rendre.
 * @returns {void}
 */
useMesEnfantsEnBref.regler = (valeur = AUCUN) => {
  etat.valeur = valeur;
};
useMesEnfantsEnBref.appels = appels;

export default useMesEnfantsEnBref;
