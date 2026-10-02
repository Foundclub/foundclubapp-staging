/**
 * ST-VUES2 — LE « LU » DES RETOURS DU COACH (écran 16, « 1 nouveau » sur « Retours du coach »).
 *
 * La marque existe côté serveur : la carte des visites du compte (`guidanceState.routeVisits`,
 * JSON PRIVÉ du compte, admin `app-guidance`). On y pose la visite `coachFeedback` quand le
 * joueur ouvre ses retours (`updateMyGuidance` de `authService`) ; `/app/bootstrap` la rend ;
 * un retour publié après elle est « nouveau ». La plus récente gagne côté serveur : deux
 * téléphones ne se contredisent pas.
 * ⚠️ ST-RETOURS (écran 19, « Nouveau » sur chaque retour) lit la MÊME marque : ne pas en créer
 * une seconde. Module PUR (aucun appel réseau) : l'écran qui l'importe reste testable.
 */

/** La clé de la visite, dans `guidanceState.routeVisits`. */
export const COACH_FEEDBACK_VISIT_KEY = 'coachFeedback';

/**
 * Quand le joueur a ouvert ses retours pour la dernière fois.
 * @param {any} bootstrapData - La réponse de `/app/bootstrap` (`useAuth().appBootstrapData`).
 * @returns {string | null} La date ISO, ou rien s'il ne les a jamais ouverts.
 */
export const readCoachFeedbackSeenAt = (bootstrapData) => {
  const value = bootstrapData?.guidanceState?.routeVisits?.[COACH_FEEDBACK_VISIT_KEY];
  return typeof value === 'string' && value ? value : null;
};

/**
 * Combien de retours du coach ont paru depuis la dernière ouverture.
 * Jamais ouverts : tous les retours datés sont nouveaux.
 * @param {Array<{ submittedAt?: string | null }> | null | undefined} items - Les retours
 *   (`personal-stats`, `recentCoachFeedback` : `submittedAt` est la publication de la feuille).
 * @param {string | null} seenAt - La dernière ouverture.
 * @returns {number} Le nombre de retours nouveaux.
 */
export const countUnseenCoachFeedback = (items, seenAt) => {
  const seenMs = seenAt ? new Date(seenAt).getTime() : Number.NEGATIVE_INFINITY;
  return (Array.isArray(items) ? items : []).filter((item) => {
    const publishedMs = new Date(item?.submittedAt || '').getTime();
    return Number.isFinite(publishedMs) && publishedMs > seenMs;
  }).length;
};

/**
 * Ce qu'on envoie au serveur pour dire « ouverts maintenant ».
 * @param {Date} [now] - L'instant de l'ouverture.
 * @returns {{ routeVisits: Record<string, string> }} Le corps de PATCH /app-guidance/me.
 */
export const buildCoachFeedbackVisit = (now = new Date()) => ({
  routeVisits: { [COACH_FEEDBACK_VISIT_KEY]: now.toISOString() },
});
