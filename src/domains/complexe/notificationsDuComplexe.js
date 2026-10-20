import { RouteNames } from '@/navigation/routeNames';

import { COMPLEXES_GERANT } from '@/config/fonctionsMasquees';

/**
 * LES NOTIFICATIONS DU GÉRANT DE COMPLEXE — RESA-L5A2 (14/10/2026), planche RB état 4 et contrat
 * d'API L2A (« Notifications ») : `complexeReservationGerant`, `data.change` = `nouvelle |
 * demande | expire-bientot | annulee`, `reservationId`, `complexeId` ; AUCUN `ctaRoute` : l'app
 * aiguille.
 *   · une demande et son rappel ⇒ « Demandes » (E-G06), dans l'espace du complexe ;
 *   · une nouvelle réservation, une annulation ⇒ sa fiche (E-G05).
 * RESA-L5B-1 (20/10/2026, serveur RESA-L2B, plan E-G19 :1119-1149) :
 *   · le bannissement automatique (N-12, « bannissement-auto ») ⇒ la fiche du CLIENT (E-G15), par
 *     sa réservation (la notification ne porte pas le joueur : l'écran le lit dans la fiche) ;
 *   · le résumé du matin (N-05, « resume-matin ») ⇒ l'accueil (E-G02) ;
 *   · l'icône de chaque ligne (planche EG19), dans le jeu d'icônes de l'app (`SvgIcon`) ;
 *   · partie B (serveur RESA-L2C) : N-06 « Hier » (« hier », cloche seulement, sans réservation)
 *     ⇒ les réservations, onglet « Passées » (E-G04), où l'on marque les non honorées.
 * RESA-L5B-2 (20/10/2026, serveur RESA-L4) : N-11, le statut du complexe (`complexeStatut`,
 * `data.change` = `suspendu | retabli | retire`, `motif`, sans réservation) ⇒ l'accueil (E-G02),
 * où le bandeau dit l'état ; l'icône du bouclier.
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

/** RESA-L5B-2 — N-11, le statut du complexe (serveur RESA-L4, `COMPLEXE_STATUT`). */
export const TYPE_STATUT_DU_COMPLEXE = 'complexeStatut';

/** RESA-L5B-2 — N-09, un joueur a signalé un complexe : aux SuperAdmin (`COMPLEXE_SIGNALE`). */
export const TYPE_SIGNALEMENT_DU_COMPLEXE = 'complexeSignale';

const TYPES_DU_GERANT = Object.freeze([TYPE_DU_GERANT, TYPE_STATUT_DU_COMPLEXE]);

/**
 * RESA-L5B-2 — N-09 : la fiche du complexe signalé dans la console du SuperAdmin (E-S01), ou la
 * liste (« À traiter ») sans complexe. Éteint (`COMPLEXES_GERANT`) : null.
 * @param {Record<string, any>} charge - `complexeId`, `signalementId`.
 * @returns {{ params: Record<string, any>, route: string } | null} La destination, ou null.
 */
export const destinationDuSignalement = (charge) => {
  if (!interrupteur()) return null;
  const complexeId = String(charge?.complexeId || '');
  return {
    params: complexeId
      ? { params: { complexeId }, screen: RouteNames.AdminComplexeDetail }
      : { params: {}, screen: RouteNames.AdminComplexeList },
    route: RouteNames.AdminStack,
  };
};

/**
 * Un type que l'app aiguille vers l'espace du complexe (sans regarder l'interrupteur) ?
 * @param {unknown} type - Le type de la notification.
 * @returns {boolean} Vrai pour les réservations du gérant et le statut du complexe.
 */
export const estTypeDuGerant = (type) => TYPES_DU_GERANT.includes(String(type));

const VERS_LES_DEMANDES = Object.freeze(['demande', 'expire-bientot']);

/**
 * RESA-L5B-1 — l'icône de chaque ligne (planche EG19). Le jeu de l'app n'a ni « boîte de
 * demandes », ni « sablier », ni « interdit » : le calendrier détaillé, l'horloge et le bouclier
 * les remplacent (aucune icône neuve sans le design, décision du 01/10).
 */
const ICONES_DU_GERANT = Object.freeze({
  annulee: 'close',
  'bannissement-auto': 'shield',
  demande: 'calendar-days',
  'expire-bientot': 'clock-two-thirty',
  hier: 'flag',
  nouvelle: 'calendar',
  'resume-matin': 'stadium',
});

/**
 * Une notification du complexe (la pastille « Mode complexe » de la liste) ?
 * @param {unknown} type - Le type de la notification.
 * @returns {boolean} Vrai pour une notification du gérant, interrupteur allumé.
 */
export const estNotificationDuComplexe = (type) => interrupteur() && estTypeDuGerant(type);

/**
 * RESA-L5B-1 — l'icône d'une notification du gérant (`SvgIcon`), ou null : interrupteur éteint
 * (la cloche de toujours) ou une autre notification.
 * @param {unknown} type - Le type de la notification.
 * @param {Record<string, any> | null | undefined} data - Ses données (`change`).
 * @returns {string | null} Le nom de l'icône.
 */
export const iconeDuGerant = (type, data) => {
  if (!estNotificationDuComplexe(type)) return null;
  if (type === TYPE_STATUT_DU_COMPLEXE) return 'shield';
  return /** @type {Record<string, string>} */ (ICONES_DU_GERANT)[String(data?.change || '')]
    || 'stadium';
};

/**
 * La destination d'une notification du gérant (charge utile déjà aplatie).
 * @param {Record<string, any>} charge - `change`, `complexeId`, `reservationId`.
 * @returns {{ params: Record<string, any>, route: string } | null} La destination, ou null.
 */
export const destinationDuGerant = (charge) => {
  if (!interrupteur()) return null;
  const complexeId = String(charge?.complexeId || '') || undefined;
  const reservationId = String(charge?.reservationId || '');
  const change = String(charge?.change || '');
  if (VERS_LES_DEMANDES.includes(change)) {
    return {
      params: { params: { complexeId }, screen: RouteNames.ComplexeDemandes },
      route: RouteNames.ComplexeEspace,
    };
  }
  // RESA-L5B-1, partie B — N-06 « Hier » : l'onglet « Passées » des réservations.
  if (change === 'hier') {
    return { params: { complexeId, vue: 'passees' }, route: RouteNames.ComplexeReservations };
  }
  // RESA-L5B-1 — N-05 (et toute notification sans réservation, N-11) : l'accueil.
  if (!reservationId || change === 'resume-matin') {
    return {
      params: { params: { complexeId }, screen: RouteNames.ComplexeAccueil },
      route: RouteNames.ComplexeEspace,
    };
  }
  // RESA-L5B-1 — N-12 : la fiche du client banni, par sa réservation.
  if (change === 'bannissement-auto') {
    return { params: { complexeId, reservationId }, route: RouteNames.ComplexeClient };
  }
  return { params: { complexeId, reservationId }, route: RouteNames.ComplexeReservation };
};
