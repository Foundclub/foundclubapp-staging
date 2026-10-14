import { RouteNames } from '@/navigation/routeNames';

import { COMPLEXES_GERANT } from '@/config/fonctionsMasquees';

/**
 * LES NOTIFICATIONS DU GÉRANT DE COMPLEXE — RESA-L5A2 (14/10/2026), planche RB état 4 et contrat
 * d'API L2A (« Notifications ») : `complexeReservationGerant`, `data.change` = `nouvelle |
 * demande | expire-bientot | annulee`, `reservationId`, `complexeId` ; AUCUN `ctaRoute` : l'app
 * aiguille.
 *   · une demande et son rappel ⇒ « Demandes » (E-G06), dans l'espace du complexe ;
 *   · une nouvelle réservation, une annulation ⇒ sa fiche (E-G05).
 * Elles arrivent aussi en mode joueur, avec la pastille « Mode complexe » ; l'espace du complexe,
 * une fois ouvert, repasse le téléphone en mode complexe (`ComplexeTabNavigator`).
 * Tout est éteint avec `COMPLEXES_GERANT` (aucune destination, aucune pastille).
 *
 * Témoin : `notificationsDuComplexe.test.js`.
 */

// L'interrupteur par un `import`, JAMAIS par `require` : ce module est chargé par la liste des
// notifications, que le site compile (Vite ne connaît pas `require` : « require is not defined »).
// Lu À L'APPEL (`COMPLEXES_GERANT` reste une liaison vivante : le témoin le bascule).
const interrupteur = () => Boolean(COMPLEXES_GERANT);

/** Le type de notification du gérant (serveur RESA-L2A, `notification-templates.ts`). */
export const TYPE_DU_GERANT = 'complexeReservationGerant';

const VERS_LES_DEMANDES = Object.freeze(['demande', 'expire-bientot']);

/**
 * Une notification du complexe (la pastille « Mode complexe » de la liste) ?
 * @param {unknown} type - Le type de la notification.
 * @returns {boolean} Vrai pour une notification du gérant, interrupteur allumé.
 */
export const estNotificationDuComplexe = (type) => interrupteur() && type === TYPE_DU_GERANT;

/**
 * La destination d'une notification du gérant (charge utile déjà aplatie).
 * @param {Record<string, any>} charge - `change`, `complexeId`, `reservationId`.
 * @returns {{ params: Record<string, any>, route: string } | null} La destination, ou null.
 */
export const destinationDuGerant = (charge) => {
  if (!interrupteur()) return null;
  const complexeId = String(charge?.complexeId || '') || undefined;
  const reservationId = String(charge?.reservationId || '');
  if (VERS_LES_DEMANDES.includes(String(charge?.change || ''))) {
    return {
      params: { params: { complexeId }, screen: RouteNames.ComplexeDemandes },
      route: RouteNames.ComplexeEspace,
    };
  }
  if (!reservationId) {
    return {
      params: { params: { complexeId }, screen: RouteNames.ComplexeAccueil },
      route: RouteNames.ComplexeEspace,
    };
  }
  return { params: { complexeId, reservationId }, route: RouteNames.ComplexeReservation };
};
