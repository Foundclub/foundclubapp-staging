import { Linking } from 'react-native';

/**
 * 🔗 LIENS-APP (07/10/2026, décision du chef d'orchestre) — LE LIEN QUI A LANCÉ L'APP, LU UNE FOIS.
 *
 * appNavigator.js remonte le NavigationContainer à chaque changement de compte (connexion,
 * inscription, déconnexion, ajout de compte), et React Navigation relit `Linking.getInitialURL()`
 * à CHAQUE montage (useLinking.native.tsx, getInitialState). Le lien de lancement se rejouait donc
 * après la connexion : son écran devenait l'état initial de la pile connectée, SEUL (aucun Retour),
 * et pour un compte neuf il passait devant l'accueil — le contrôle d'âge compris.
 *
 * Ici : lu une fois par lancement. Connecté, il n'ouvre plus la pile : il attend (lienEnAttente),
 * puis useLiensEnAttente l'envoie à l'écoute ordinaire des liens une fois le compte prêt et
 * l'accueil fait — comme un lien reçu app ouverte, l'écran s'empile et le Retour existe.
 * Témoin : src/navigation/__tests__/LIENSAPP.lienDeLancementUneFois.test.js.
 */

/** Même délai que React Navigation (useLinking.native.tsx, ticket 25675 de react-native). */
const DELAI_MS = 150;

let dejaLu = false;
/** @type {string | null} */
let enAttente = null;
/** @type {Set<(url: string) => void>} */
const ecouteurs = new Set();

/**
 * Le lien qui a lancé l'app — au premier appel du lancement ; ensuite, null.
 * @returns {Promise<string | null>} Le lien, ou null.
 */
export const lireLeLienDeLancement = async () => {
  if (dejaLu) return null;
  dejaLu = true;
  const url = await Promise.race([
    Linking.getInitialURL(),
    new Promise((resolve) => { setTimeout(() => resolve(null), DELAI_MS); }),
  ]);
  return typeof url === 'string' && url ? url : null;
};

/**
 * Met un lien de côté jusqu'à ce que le compte soit prêt (connecté au lancement).
 * @param {string} url - Le lien.
 * @returns {void}
 */
export const mettreLeLienEnAttente = (url) => {
  enAttente = url || null;
};

/**
 * L'écoute des liens donnée à React Navigation (`linking.subscribe`) : celle de React Navigation
 * par défaut (useLinking.native.tsx), plus la porte par laquelle le lien en attente lui arrive.
 * @param {(url: string) => void} ecouteur - L'écouteur de React Navigation.
 * @returns {() => void} Le désabonnement.
 */
export const ecouterLesLiens = (ecouteur) => {
  const abonnement = Linking.addEventListener('url', ({ url }) => ecouteur(url));
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
    abonnement?.remove?.();
  };
};

/**
 * Envoie le lien en attente à l'écoute des liens, une fois.
 * @returns {boolean} Vrai si un lien est parti.
 */
export const envoyerLeLienEnAttente = () => {
  if (!enAttente || ecouteurs.size === 0) return false;
  const url = enAttente;
  enAttente = null;
  ecouteurs.forEach((ecouteur) => ecouteur(url));
  return true;
};
