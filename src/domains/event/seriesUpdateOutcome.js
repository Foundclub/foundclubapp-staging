// SERIES (08/10, décision d'Adel « séries lot », point 5) — CE QUE « MODIFIER LA SÉRIE » A
// FAIT DES DATES. Le serveur juge chaque date déplacée comme la date modifiée (admin
// event-recurrence.ts) et rend le bilan des AUTRES dates (`meta.recurrence` : awaitingCity,
// awaitingClub) ; la date modifiée, elle, se lit dans `data` (son statut, sa raison
// d'attente). Un serveur d'avant ne rend pas de bilan : rien n'est dit, comme avant.
// Témoin : __tests__/seriesUpdateOutcome.SERIES.test.js.

/**
 * Combien de dates de la série attendent la Ville, combien le dirigeant du club.
 * @param {any} reponse - Le corps rendu par `PUT /events/:id` avec `recurrenceMode`.
 * @returns {{ city: number, club: number } | null} `null` : rien en attente, ou pas de bilan.
 */
export const seriesUpdateWaiting = (reponse) => {
  const autres = reponse?.meta?.recurrence;
  if (!autres) return null;
  const courante = reponse?.data;
  const attend = String(courante?.status || '') === 'pending_validation';
  const raison = String(courante?.pendingReason || '');
  const courantePourLaVille = attend && raison === 'facility_overbooking' ? 1 : 0;
  const courantePourLeClub = attend && raison === 'club_slot_overflow' ? 1 : 0;
  const city = Number(autres.awaitingCity || 0) + courantePourLaVille;
  const club = Number(autres.awaitingClub || 0) + courantePourLeClub;
  return city || club ? { city, club } : null;
};

/**
 * Le message à montrer après l'enregistrement, ou `null`.
 * @param {any} reponse - Le corps rendu par `PUT /events/:id` avec `recurrenceMode`.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @returns {string | null}
 */
export const seriesUpdateMessage = (reponse, t) => {
  const attente = seriesUpdateWaiting(reponse);
  if (!attente) return null;
  return [
    attente.city ? t('eventEdit.modals.seriesOutcome.awaitingCity', { count: attente.city }) : null,
    attente.club ? t('eventEdit.modals.seriesOutcome.awaitingClub', { count: attente.club }) : null,
  ].filter(Boolean).join('\n\n');
};
