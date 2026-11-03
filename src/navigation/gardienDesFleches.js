// FIN-RESA (02/11/2026, p81) — LES FLÈCHES DU NAVIGATEUR, ENTENDUES AVANT LE ROUTEUR.
//
// BrowserRouter n'offre pas de blocage. Sur `window`, Chrome sert les écouteurs de `popstate` dans
// leur ordre d'inscription, même en capture (mesuré) : inscrit après le routeur, un écouteur arrive
// quand l'écran est déjà démonté. Celui-ci s'inscrit donc au chargement du module, importé par
// AppProviders.web, avant que BrowserRouter ne monte ; la capture sert les navigateurs qui la
// servent d'abord. Un écran garde les flèches en y posant son gardien (useGardeDeSortie).

/** @type {((evenement: any) => void) | null} */
let gardien = null;

// T3-CHEMINS (03/11) — UN ASSISTANT FINI NE SE ROUVRE PAS PAR LA FLÈCHE. Un site ne vide pas
// l'historique : à la fin d'un assistant (`reset`, `popTo`), on note le numéro de l'entrée, le
// « plancher ». Sous lui, une étape d'assistant est morte : la flèche la saute, avant le routeur,
// donc sans écran vidé.
// ponytail: seules les adresses d'assistant sont sautées, et un assistant fini par un simple
// `replace` n'a pas de plancher. Sortie : poser le plancher à sa fin.
const CLE_PLANCHER = 'fc:web:plancherDeRetour';
const ASSISTANTS = /^\/(?:(?:events|teams|recruitment|friendly-matches)\/wizard|clubs\/onboarding|admin\/clubs\/create)\//;

const numeroDeLEntree = () => window.history?.state?.idx;

const lirePlancher = () => {
  try {
    const valeur = window.sessionStorage.getItem(CLE_PLANCHER);
    return valeur === null ? null : Number(valeur);
  } catch {
    return null;
  }
};

/**
 * Note que ce qui précède l'entrée courante est fini.
 * @returns {void}
 */
export const poserPlancherDeRetour = () => {
  const idx = typeof window === 'undefined' ? undefined : numeroDeLEntree();
  if (typeof idx !== 'number') return;
  try {
    window.sessionStorage.setItem(CLE_PLANCHER, String(idx));
  } catch {
    // Stockage refusé : la flèche reviendra dans l'assistant, comme avant.
  }
};

/**
 * Une page neuve posée à hauteur du plancher a écrasé les étapes au-dessus : il ne vaut plus.
 * @returns {void}
 */
export const oublierPlancherDepasse = () => {
  const plancher = lirePlancher();
  const idx = numeroDeLEntree();
  if (plancher === null || typeof idx !== 'number' || idx > plancher) return;
  try {
    window.sessionStorage.removeItem(CLE_PLANCHER);
  } catch {
    // Stockage refusé : rien à oublier.
  }
};

const sauterUnAssistantFini = (/** @type {any} */ evenement) => {
  const plancher = lirePlancher();
  const idx = numeroDeLEntree();
  if (plancher === null || typeof idx !== 'number' || idx >= plancher) return;
  if (!ASSISTANTS.test(window.location.pathname)) return;
  evenement.stopImmediatePropagation();
  if (idx === 0) window.location.replace('/');
  else window.history.back();
};

/**
 * Transmet `popstate` au gardien posé, s'il y en a un, puis saute un assistant fini.
 * @param {any} evenement - L'événement `popstate`.
 * @returns {void}
 */
export const entendreFleche = (evenement) => {
  gardien?.(evenement);
  if (!evenement.cancelBubble) sauterUnAssistantFini(evenement);
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
