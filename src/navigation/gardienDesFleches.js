// FIN-RESA (02/11/2026, p81) — LES FLÈCHES DU NAVIGATEUR, ENTENDUES AVANT LE ROUTEUR.
//
// BrowserRouter n'offre pas de blocage. Sur `window`, Chrome sert les écouteurs de `popstate` dans
// leur ordre d'inscription, même en capture (mesuré) : inscrit après le routeur, un écouteur arrive
// quand l'écran est déjà démonté. Celui-ci s'inscrit donc au chargement du module, importé par
// AppProviders.web, avant que BrowserRouter ne monte ; la capture sert les navigateurs qui la
// servent d'abord. Un écran garde les flèches en y posant son gardien (useGardeDeSortie).

/** @type {((evenement: any) => void) | null} */
let gardien = null;

/**
 * Transmet `popstate` au gardien posé, s'il y en a un.
 * @param {any} evenement - L'événement `popstate`.
 * @returns {void}
 */
export const entendreFleche = (evenement) => {
  gardien?.(evenement);
};

/**
 * Pose le gardien de l'écran au premier plan.
 * @param {(evenement: any) => void} rappel - Le gardien.
 * @returns {() => void} Le retire.
 */
export const poserGardienDesFleches = (rappel) => {
  gardien = rappel;
  return () => {
    if (gardien === rappel) gardien = null;
  };
};

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('popstate', entendreFleche, true);
}
