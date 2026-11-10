/**
 * OÙ ARRIVE UN COMPTE SANS RÔLE SPORTIF — GERANT-INSCRIPTION (10/11/2026).
 *
 * Un compte qui ne gère qu'une Ville ou qu'un complexe garde le rôle provisoire (clef `new`). Le
 * téléphone (`PrivateNavigator`) et le site (`web/src/routes/SharedHomeRoute.tsx`) l'aiguillent
 * avec CETTE règle : le site, qui ne lisait pas les complexes, renvoyait le gérant d'un complexe
 * au choix du statut, comme un compte neuf (recette du gérant, 10/11).
 *
 * L'ordre est celui d'avant : la Ville, puis la demande de gestion d'une Ville, puis le complexe.
 * Un gérant de complexe sans identité (prénom, nom, date de naissance) passe d'abord par
 * « Qui es-tu ? » (UserName), avec les règles d'âge de tous les rôles.
 */

/**
 * GERANT-INSCRIPTION (10/11/2026, décision d'Adel « 224- B ») — l'âge minimum pour gérer un
 * complexe. Le serveur pose la même règle (admin `selfOnboard`, COMPLEXE_GERANT_MAJEUR_REQUIS).
 */
export const AGE_MINIMUM_GERANT = 18;

/**
 * Le compte a-t-il donné son prénom, son nom et sa date de naissance ?
 * @param {{ firstname?: unknown, lastname?: unknown, birthdate?: unknown } | null} [compte]
 * @returns {boolean} Vrai si les trois sont connus.
 */
export const identiteComplete = (compte) => Boolean(
  String(compte?.firstname || '').trim()
  && String(compte?.lastname || '').trim()
  && compte?.birthdate,
);

/**
 * L'arrivée d'un compte sans rôle sportif.
 * @param {{ compte?: any, villesGerees?: number, demandeVille?: boolean,
 *   complexesGeres?: number }} [lu]
 *   - Ce que l'accueil a lu : le profil, le nombre de Villes et de complexes gérés, une demande
 *   de gestion de Ville en cours.
 * @returns {'ville' | 'demande-ville' | 'identite' | 'complexe' | 'statut'} L'arrivée.
 */
export const arriveeSansRoleSportif = ({
  complexesGeres = 0, compte = null, demandeVille = false, villesGerees = 0,
} = {}) => {
  if (villesGerees > 0) return 'ville';
  if (demandeVille) return 'demande-ville';
  if (complexesGeres > 0) return identiteComplete(compte) ? 'complexe' : 'identite';
  return 'statut';
};

/**
 * Après « Qui es-tu ? » (ou la déclaration parentale) d'un compte sans rôle sportif : son
 * complexe s'il en gère un, la fiche du complexe s'il a choisi « Je gère un complexe » sans l'avoir
 * encore créé (le mode complexe, `modeComplexe.js`, garde ce choix), sinon le parcours habituel.
 * @param {{ complexesGeres?: number, intentionComplexe?: boolean }} lu - Ce que l'écran sait.
 * @returns {'complexe' | 'fiche-complexe' | null} La suite, ou null.
 */
export const suiteApresIdentite = ({ complexesGeres = 0, intentionComplexe = false } = {}) => {
  if (complexesGeres > 0) return 'complexe';
  if (intentionComplexe) return 'fiche-complexe';
  return null;
};
