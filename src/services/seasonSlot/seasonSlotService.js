import client from '@/services/client';

/**
 * COLL-C2B (02/10) — le CRENEAU DE SAISON, cote app. Contrat : `docs/CONTRAT_CRENEAUX_SAISON.md`
 * du depot admin (lot COLL-C2A, `e2153ca8`).
 *
 * Le serveur est le SEUL juge : droits (la mairie chez elle, le dirigeant sur son club),
 * place libre, periode, plateau. L app envoie ce qu on a saisi, puis affiche ce que le
 * serveur rend, ou son refus (`error.details.code`, traduit par `seasonSlotErrorKey`).
 * Aucune reponse ne porte de personne : `attributedBy` ne sort par aucune route.
 */

/**
 * Les creneaux d une installation, tries par jour puis par heure (§4.1).
 * @param {string} facilityId - documentId de l installation.
 * @param {{ from?: string, status?: 'active' | 'withdrawn' | 'all' }} [params] - `withdrawn`
 *   et `all` : ecrivains seulement (pour retablir).
 * @returns {Promise<any>} `{ data: creneaux, meta: { canManage, facility, season } }`.
 */
export const listFacilitySeasonSlots = async (facilityId, { from, status = 'active' } = {}) => {
  const response = await client.get(`/facilities/${facilityId}/season-slots`, {
    params: { from, status },
  });
  return response.data;
};

/**
 * La carte « Place libre », PENDANT la saisie (§4.2). Rien n est ecrit.
 * @param {string} facilityId - documentId de l installation.
 * @param {Record<string, string | number | undefined>} params - weekday, startTime, endTime,
 *   et facultatifs : validFrom, validUntil, plateau, excludeSlot.
 * @returns {Promise<any>} `{ data: { capacity, occupants, remaining, teamsAfter, overCapacity,
 *   plateau, needsConfirmation, next, period } }`.
 */
export const previewFacilitySeasonSlot = async (facilityId, params) => {
  const response = await client.get(`/facilities/${facilityId}/season-slots/preview`, { params });
  return response.data;
};

/**
 * Attribuer (§4.3). Un 409 `SEASON_SLOT_OVER_CAPACITY` n ecrit RIEN : il porte l apercu
 * (`details.preview`), et « Attribuer quand meme » renvoie le meme corps avec
 * `confirmOverCapacity: true`.
 * @param {string} facilityId - documentId de l installation.
 * @param {Record<string, any>} data - club, team?, weekday, startTime, endTime, validFrom?,
 *   validUntil?, plateau?, confirmOverCapacity?.
 * @returns {Promise<any>} `{ data: creneau }`.
 */
export const attributeSeasonSlot = async (facilityId, data) => {
  const response = await client.post(`/facilities/${facilityId}/season-slots`, { data });
  return response.data;
};

/**
 * Un creneau, avec `sessionsCount` (« Entrainements poses cette saison », §4.4).
 * @param {string} slotId - documentId du creneau.
 * @returns {Promise<any>} `{ data: creneau, meta: { canManage } }`.
 */
export const getSeasonSlot = async (slotId) => {
  const response = await client.get(`/season-slots/${slotId}`);
  return response.data;
};

/**
 * Modifier A PARTIR d une date (§4.5) : un creneau commence est coupe, les semaines
 * passees ne bougent pas. Le club ne change jamais.
 * @param {string} slotId - documentId du creneau.
 * @param {Record<string, any>} data - weekday, startTime, endTime, validUntil, plateau, team,
 *   effectiveFrom, confirmOverCapacity.
 * @returns {Promise<any>} `{ data: creneau en vigueur, meta: { split } }`.
 */
export const modifySeasonSlot = async (slotId, data) => {
  const response = await client.put(`/season-slots/${slotId}`, { data });
  return response.data;
};

/**
 * Retirer (§4.6, D67) : un ETAT, jamais une suppression. Aucune seance n est touchee.
 * @param {string} slotId - documentId du creneau.
 * @param {{ effectiveFrom?: string }} [data] - Defaut : aujourd hui (a Paris).
 * @returns {Promise<any>} `{ data: creneau }`.
 */
export const withdrawSeasonSlot = async (slotId, data = {}) => {
  const response = await client.post(`/season-slots/${slotId}/withdraw`, { data });
  return response.data;
};

/**
 * Retablir (§4.7) : la place est recomptee (409 sans `confirmOverCapacity`).
 * @param {string} slotId - documentId du creneau.
 * @param {{ confirmOverCapacity?: boolean }} [data] - La confirmation, apres un 409.
 * @returns {Promise<any>} `{ data: creneau }`.
 */
export const restoreSeasonSlot = async (slotId, data = {}) => {
  const response = await client.post(`/season-slots/${slotId}/restore`, { data });
  return response.data;
};

/**
 * Les equipes d un club, pour le champ « Equipe (facultatif) » : leur nom et leur
 * identifiant, rien d autre (aucune personne). Lecture publique de l annuaire des equipes.
 * @param {string} clubId - documentId du club.
 * @returns {Promise<Array<{ documentId: string, name: string }>>} Les equipes, par nom.
 */
export const getClubTeamsForSlot = async (clubId) => {
  const response = await client.get('/teams', {
    params: {
      fields: ['documentId', 'name'],
      filters: { club: { documentId: { $eq: clubId } } },
      pagination: { page: 1, pageSize: 100 },
      sort: ['name:asc'],
    },
  });
  const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
  return rows
    .filter((/** @type {any} */ team) => team?.documentId && team?.name)
    .map((/** @type {any} */ team) => ({ documentId: team.documentId, name: team.name }));
};
