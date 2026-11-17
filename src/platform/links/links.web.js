import { buildWebPath } from '@/navigation/webRoutes';

export const openUrl = async (url) => {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

// T-PAGES-2 (17/11/2026, R8 du parcours d'inscription) — une page qui remplace l'écran
// courant (la page de paiement d'une place) s'ouvre dans le MÊME onglet : aucune fenêtre
// surgissante qu'un navigateur pourrait bloquer sans rien dire. Même geste que
// subscriptionPurchaseRail.js (Stripe).
export const openUrlInPlace = async (url) => {
  if (typeof window === 'undefined' || !url) return;
  window.location.assign(url);
};

export const buildDeepLink = (routeName, params = {}) => buildWebPath(routeName, params, {
  absolute: true,
});

export default {
  buildDeepLink,
  openUrl,
  openUrlInPlace,
};
