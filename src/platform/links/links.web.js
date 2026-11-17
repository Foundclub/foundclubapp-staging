import { buildWebPath } from '@/navigation/webRoutes';

export const openUrl = async (url) => {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

// T-PARCOURS-1 (17/11/2026, R8) — ouvrir DANS cet onglet. Une fenêtre ouverte après un appel
// au serveur (le lien de Stripe arrive par une requête) n'est plus un geste de la personne :
// le navigateur la bloque, sans rien dire.
/**
 * Ouvre l'adresse dans cet onglet.
 * @param {string} url - L'adresse (la page de paiement de Stripe).
 * @returns {Promise<void>} Rien.
 */
export const openUrlHere = async (url) => {
  if (typeof window === 'undefined') return;
  window.location.assign(url);
};

// T-PAGES-2 (17/11/2026, R8 du parcours d'inscription) — une page qui remplace l'écran
// courant (la page de paiement d'une place) s'ouvre dans le MÊME onglet : aucune fenêtre
// surgissante qu'un navigateur pourrait bloquer sans rien dire. Même geste que
// subscriptionPurchaseRail.js (Stripe).
export const openUrlInPlace = async (/** @type {string} */ url) => {
  if (typeof window === 'undefined' || !url) return;
  window.location.assign(url);
};

export const buildDeepLink = (routeName, params = {}) => buildWebPath(routeName, params, {
  absolute: true,
});

export default {
  buildDeepLink,
  openUrl,
  openUrlHere,
  openUrlInPlace,
};
