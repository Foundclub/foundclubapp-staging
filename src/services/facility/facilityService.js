import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import client from '@/services/client';

const getFacilities = async (clubId) => {
  try {
    const response = await client.get(`/facilities?filters[club][documentId][$eq]=${clubId}&populate=*`);
    return response.data;
  } catch (error) {
    console.error('Error fetching facilities:', error);
    throw error;
  }
};

const PLANNING_FACILITY_FIELDS_QUERY = [
  'fields[0]=documentId',
  'fields[1]=id',
  'fields[2]=name',
  'fields[3]=planningColor',
  'fields[4]=capacityConflictMode',
  'fields[5]=maxSlots',
].join('&');

const PLANNING_FACILITY_POPULATE_QUERY = [
  'populate[club][fields][0]=documentId',
  'populate[club][fields][1]=id',
  'populate[club][fields][2]=name',
  'populate[multisportClub][fields][0]=documentId',
  'populate[multisportClub][fields][1]=id',
  'populate[multisportClub][fields][2]=name',
].join('&');

const getPlanningFacilities = async (clubId) => {
  try {
    const planningFacilitiesUrl = [
      `/facilities?filters[club][documentId][$eq]=${clubId}`,
      PLANNING_FACILITY_FIELDS_QUERY,
      PLANNING_FACILITY_POPULATE_QUERY,
    ].join('&');
    const response = await client.get(
      planningFacilitiesUrl,
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching planning facilities:', error);
    throw error;
  }
};

/**
 * Get facilities for a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<object>} List of facilities
 */
const getCMFacilities = async (cmId) => {
  try {
    const response = await client.get(`/cm/${cmId}/facilities`);
    return response.data;
  } catch (error) {
    console.error('Error fetching CM facilities:', error);
    throw error;
  }
};

const getFacilityOwnerName = (facility, fallback = '') => {
  if (facility?.multisportClub?.name) return facility.multisportClub.name;
  if (facility?.club?.name) return facility.club.name;
  return fallback;
};

const normalizeClubFacility = (facility) => ({
  ...facility,
  isReadOnly: false,
  isShared: false,
  ownerName: getFacilityOwnerName(facility, facility?.club?.name || ''),
  ownerType: 'club',
});

const normalizeSharedFacility = (facility) => ({
  ...facility,
  isReadOnly: true,
  isShared: true,
  ownerName: getFacilityOwnerName(facility, facility?.multisportClub?.name || 'Multisport'),
  ownerType: 'multisport',
  source: 'Multisport',
});

// COLL1B (29/09) — une installation de la COLLECTIVITE a laquelle le club est rattache
// (SPEC Collectivites §3). Lecture seule, comme celle d un omnisport, mais ce n est pas
// un omnisport : ni badge « Multisport », ni planning « partage » du club (`sharedFacilities`).
const normalizeCollectiviteFacility = (facility) => ({
  ...facility,
  isReadOnly: true,
  isShared: true,
  ownerName: facility?.collectivite?.name || '',
  ownerType: 'collectivite',
});

const isCollectiviteFacility = (facility) => facility?.ownerType === 'collectivite';

/**
 * Range les installations en sections : celles du club, celles de l omnisport, puis une par
 * collectivite.
 * @param {any[]} facilities - Les installations.
 * @param {{
 *   clubTitle?: string, collectiviteTitle?: (nom: string) => string, sharedTitle?: string,
 * }} [labels] - Les titres choisis par l ecran (COLL-C2C : celui de la Ville, par la fiche).
 * @returns {Array<{ data: any[], title: string }>} Les sections, dans l ordre d affichage.
 */
const getFacilitySections = (facilities, labels = {}) => {
  if (!Array.isArray(facilities) || facilities.length === 0) return [];

  const clubTitle = labels.clubTitle || i18next.t(
    'facilityService.sections.club',
    'Installations du club',
  );
  const sharedTitle = labels.sharedTitle || i18next.t(
    'facilityService.sections.shared',
    'Installations partagées',
  );
  const editableFacilities = facilities.filter((facility) => !facility?.isShared);
  const sharedFacilities = facilities.filter(
    (facility) => facility?.isShared && !isCollectiviteFacility(facility),
  );

  // COLL1B : les installations d une collectivite, une section par collectivite, APRES
  // celles du club et de l omnisport. Sans elles, les sections restent celles d avant.
  const collectiviteSections = [];
  facilities.filter(isCollectiviteFacility).forEach((facility) => {
    const name = facility?.ownerName || '';
    const section = collectiviteSections.find((candidate) => candidate.name === name);
    if (section) {
      section.data.push(facility);
      return;
    }
    collectiviteSections.push({
      data: [facility],
      name,
      // COLL-C2C (02/10) : l appelant peut nommer le groupe lui-meme (fiche du club).
      title: labels.collectiviteTitle ? labels.collectiviteTitle(name) : i18next.t(
        'facilityService.sections.collectivite',
        'Installations · {{name}}',
        { name, ...SANS_ECHAPPEMENT },
      ),
    });
  });
  const withCollectivites = (sections) => [
    ...sections,
    ...collectiviteSections.map(({ data, title }) => ({ data, title })),
  ];

  if (editableFacilities.length > 0 && sharedFacilities.length > 0) {
    return withCollectivites([
      { data: editableFacilities, title: clubTitle },
      { data: sharedFacilities, title: sharedTitle },
    ]);
  }

  if (sharedFacilities.length > 0) {
    return withCollectivites([{ data: sharedFacilities, title: sharedTitle }]);
  }

  if (editableFacilities.length === 0) {
    return withCollectivites([]);
  }

  return withCollectivites([{ data: editableFacilities, title: clubTitle }]);
};

const resolveParentMultisportId = async (clubId) => {
  if (!clubId) return null;

  try {
    const response = await client.get(`/clubs/${clubId}`, {
      params: {
        populate: {
          parentMultisport: {
            fields: ['documentId', 'name'],
          },
        },
      },
    });
    return response?.data?.data?.parentMultisport?.documentId || null;
  } catch (error) {
    console.error('Error resolving club parent multisport:', error);
    return null;
  }
};

/**
 * COLL1B (29/09) — les installations des collectivites auxquelles ce club est rattache.
 * Reservees a ses membres : le serveur en juge (policy is-member-of-club).
 * @param {string} clubId - documentId du club.
 * @returns {Promise<object>} `{ data: [...] }`, chaque installation portant
 *   `collectivite: { documentId, name }`.
 */
const getClubCollectiviteFacilities = async (clubId) => {
  const response = await client.get(`/clubs/${clubId}/collectivite-installations`);
  return response.data;
};

// Un refus (visiteur, pas membre) ou une panne ne doit pas emporter les installations du
// club avec lui : la liste de la collectivite est un AJOUT a l onglet, jamais sa condition.
// COLL-C2C (02/10) : la meme tolerance sert aux creneaux du club (une seule ecriture).
const readOrNone = async (lecture, libelle) => {
  try {
    return await lecture();
  } catch (error) {
    const status = error?.status || error?.response?.status || error?.error?.status || null;
    if (status !== 403 && status !== 401) {
      console.error(`Error fetching ${libelle}:`, error);
    }
    return null;
  }
};

const getClubCollectiviteFacilitiesOrNone = (clubId) => readOrNone(
  () => getClubCollectiviteFacilities(clubId),
  'collectivite facilities',
);

/**
 * COLL1B (29/09) — le planning d UNE installation, en lecture seule (route du lot 1b).
 * Chaque bloc dit « club · equipe » et ses heures ; seuls ceux du club du lecteur
 * portent un documentId (il peut les ouvrir).
 * @param {string} facilityId - documentId de l installation.
 * @param {{ from: string, to: string }} range - La semaine affichee (AAAA-MM-JJ).
 * @returns {Promise<object>} `{ data: blocs, meta: { facility, from, to, total } }`.
 */
const getFacilityPlanning = async (facilityId, { from, to }) => {
  const response = await client.get(`/facilities/${facilityId}/planning`, {
    params: { from, to },
  });
  return response.data;
};

// COLL-C2C (02/10) — les creneaux de saison DU CLUB, toutes installations
// (GET /clubs/:id/season-slots, contrat `docs/CONTRAT_CRENEAUX_SAISON.md` du depot admin).
// Meme tolerance que la liste de la Ville : un refus ou une panne rend `null`.
const getClubSeasonSlotsOrNone = (clubId) => readOrNone(
  async () => (await client.get(`/clubs/${clubId}/season-slots`)).data,
  'club season slots',
);

/**
 * COLL-C2C — joint a chaque installation les creneaux du club qui s y trouvent (`clubSeasonSlots`).
 * @param {any[]} facilities - Les installations.
 * @param {any} reponse - `{ data: creneaux }`, ou null.
 * @returns {any[]} Les memes installations ; celles ou le club a un creneau le portent.
 */
const attachClubSeasonSlots = (facilities, reponse) => {
  const creneaux = Array.isArray(reponse?.data) ? reponse.data : [];
  if (!creneaux.length) return facilities;
  return facilities.map((facility) => {
    const id = facility?.documentId || facility?.id;
    const siens = creneaux.filter((creneau) => creneau?.facility?.documentId === id);
    return siens.length ? { ...facility, clubSeasonSlots: siens } : facility;
  });
};

// COLL-C2C (02/10) — D32 : les installations de la Ville ou le club a un creneau, chacune avec
// SES creneaux. L etape « Lieu » de la creation d un evenement les propose a cote de celles du club
// (constate en recette le 29/09 : elle ne proposait QUE celles du club). Un refus : aucune de plus.
const getClubVilleFacilitiesWithSlots = async (clubId) => {
  if (!clubId) return [];
  const [ville, creneaux] = await Promise.all([
    getClubCollectiviteFacilitiesOrNone(clubId),
    getClubSeasonSlotsOrNone(clubId),
  ]);
  const installations = Array.isArray(ville?.data)
    ? ville.data.map(normalizeCollectiviteFacility)
    : [];
  return attachClubSeasonSlots(installations, creneaux).filter((facility) => (
    Array.isArray(facility.clubSeasonSlots) && facility.clubSeasonSlots.length > 0
  ));
};

// COLL-C2C — D32 : le dirigeant accepte (approve) ou refuse (refuse) la seance posee au-dela de la
// place de ses creneaux (POST /season-slots/sessions/:id/decision, contrat du depot admin).
const decideClubSession = async (eventId, decision) => {
  const response = await client.post(`/season-slots/sessions/${eventId}/decision`, {
    data: { decision },
  });
  return response.data;
};

const getClubFacilityContext = async (clubId, cmId, options = {}) => {
  const { includeClubSlots = false, includeCollectivite = false, resolveCmId = true } = options;
  const resolvedCmId = cmId || (resolveCmId ? await resolveParentMultisportId(clubId) : null);
  const [clubResponse, cmResponse, collectiviteResponse, clubSlotsResponse] = await Promise.all([
    clubId ? getPlanningFacilities(clubId) : Promise.resolve(null),
    resolvedCmId ? getCMFacilities(resolvedCmId) : Promise.resolve(null),
    clubId && includeCollectivite
      ? getClubCollectiviteFacilitiesOrNone(clubId)
      : Promise.resolve(null),
    // COLL-C2C : SEULEMENT si l ecran le demande (« Tes installations » du club) ; sans l option,
    // aucune lecture de plus et la reponse est celle d avant, a l identique.
    clubId && includeClubSlots ? getClubSeasonSlotsOrNone(clubId) : Promise.resolve(null),
  ]);
  const clubFacilities = Array.isArray(clubResponse?.data)
    ? clubResponse.data.map(normalizeClubFacility)
    : [];
  const sharedFacilities = Array.isArray(cmResponse?.data)
    ? cmResponse.data.map(normalizeSharedFacility)
    : [];
  const collectiviteFacilities = Array.isArray(collectiviteResponse?.data)
    ? collectiviteResponse.data.map(normalizeCollectiviteFacility)
    : [];
  const allFacilities = attachClubSeasonSlots(
    [...clubFacilities, ...sharedFacilities, ...collectiviteFacilities],
    clubSlotsResponse,
  );

  return {
    allFacilities,
    clubFacilities,
    cmId: resolvedCmId || null,
    hasSharedFacilities: sharedFacilities.length > 0,
    sharedFacilities,
    // COLL-C2C : le compte dirige-t-il le club (repartir ses creneaux entre ses equipes, D32) ?
    // COLL-C2C planche 3 : les seances qui attendent sa decision (D32), lues par lui seul.
    ...(includeClubSlots
      ? {
        canManageClubSlots: Boolean(clubSlotsResponse?.meta?.canManage),
        pendingClubSessions: Array.isArray(clubSlotsResponse?.meta?.pendingSessions)
          ? clubSlotsResponse.meta.pendingSessions
          : [],
      }
      : {}),
  };
};

const getFacility = async (id) => {
  try {
    const response = await client.get(`/facilities/${id}?populate=*`);
    return response.data;
  } catch (error) {
    console.error('Error fetching facility:', error);
    throw error;
  }
};

const createFacility = async (data) => {
  try {
    const response = await client.post('/facilities', { data });
    return response.data;
  } catch (error) {
    console.error('Error creating facility:', error);
    throw error;
  }
};

const updateFacility = async (id, data) => {
  try {
    const response = await client.put(`/facilities/${id}`, { data });
    return response.data;
  } catch (error) {
    console.error('Error updating facility:', error);
    throw error;
  }
};

const deleteFacility = async (id) => {
  try {
    const response = await client.delete(`/facilities/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting facility:', error);
    throw error;
  }
};

/**
 * Get availability for a facility on a specific date
 * @param {string} facilityId - The facility document ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{facility: object, date: string, slots: Array}>}
 */
const getAvailability = async (facilityId, date) => {
  try {
    const response = await client.get(`/facilities/${facilityId}/availability?date=${date}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching availability:', error);
    throw error;
  }
};

/**
 * Get occupancy snapshot for a facility on a specific time window.
 * @param {string} facilityId
 * @param {{ start: string, end: string, excludeEventId?: string | null }} params
 * @returns {Promise<any>}
 */
const getOccupancy = async (facilityId, { end, excludeEventId, start }) => {
  try {
    const response = await client.get(`/facilities/${facilityId}/occupancy`, {
      params: {
        end,
        excludeEventId: excludeEventId || undefined,
        start,
      },
    });
    return response.data;
  } catch (error) {
    const errorDetails = typeof error === 'string'
      ? { message: error }
      : {
        details: error?.details || null,
        message: error?.message || error?.error?.message || 'Unknown occupancy error',
        name: error?.name || null,
        status: error?.status || error?.error?.status || null,
      };
    console.error('Error fetching facility occupancy:', errorDetails);
    throw error;
  }
};

const getPendingFacilityOverrideRequests = async (clubId) => {
  try {
    const response = await client.get('/facility-override-requests/pending', {
      params: {
        clubId,
      },
    });
    return response.data;
  } catch (error) {
    const status = error?.status || error?.response?.status || error?.error?.status || null;
    if (status !== 403) {
      console.error('Error fetching facility override requests:', error);
    }
    throw error;
  }
};

// COLL-C3B (02/10) — `series` : « Accepter la série » / « Refuser la série » (toutes les dates en
// attente d une demande « chaque semaine » ; acceptée, la série devient un créneau de saison).
// Sans lui, le corps est celui d avant, au mot près.
// COLL-C3B-BIS (03/10) — `dates` : accepter une série DATE PAR DATE (les demandes choisies ; le
// serveur refuse les autres). Absent : la série entière, comme avant.
const decisionBody = (decisionReason, series, dates = null) => {
  if (!series) return { data: { decisionReason } };
  if (!Array.isArray(dates)) return { data: { decisionReason, series: true } };
  return { data: { dates, decisionReason, series: true } };
};

const approveFacilityOverrideRequest = async (
  requestId,
  decisionReason = '',
  series = false,
  dates = null,
) => {
  try {
    const response = await client.post(
      `/facility-override-requests/${requestId}/approve`,
      decisionBody(decisionReason, series, dates),
    );
    return response.data;
  } catch (error) {
    console.error('Error approving facility override request:', error);
    throw error;
  }
};

const refuseFacilityOverrideRequest = async (requestId, decisionReason = '', series = false) => {
  try {
    const response = await client.post(
      `/facility-override-requests/${requestId}/refuse`,
      decisionBody(decisionReason, series),
    );
    return response.data;
  } catch (error) {
    console.error('Error refusing facility override request:', error);
    throw error;
  }
};

/**
 * COLL-C3B (02/10) — « Tes demandes a la Ville » : les demandes de creneau que le club a
 * ENVOYEES aux Villes (GET /facility-override-requests/sent?clubId=), la reponse et le mot de
 * la mairie. Jamais une personne : le serveur ne rend ni le demandeur, ni l agent.
 * @param {string} clubId - documentId du club.
 * @returns {Promise<{ data: any[] }>} Les demandes, une serie par ligne.
 */
const getSentFacilityOverrideRequests = async (clubId) => {
  const response = await client.get('/facility-override-requests/sent', { params: { clubId } });
  return response.data;
};

/**
 * Create a booking from the Smart Slots system
 * @param {object} data - Booking data
 * @param {string} data.facilityId - Facility document ID
 * @param {string} data.date - Date in YYYY-MM-DD format
 * @param {string} data.startTime - Start time in HH:mm format
 * @param {string} data.endTime - End time in HH:mm format
 * @param {string} data.mode - 'private' or 'shared'
 * @param {number} [data.targetPlayers] - Total players needed (for shared mode)
 * @param {number} [data.currentPlayers] - Current players count
 * @returns {Promise<object>} The created event/booking
 */
const createBooking = async (data) => {
  try {
    const response = await client.post('/events/booking', { data });
    return response.data;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

/**
 * Get bookable facilities (for listing)
 * @returns {Promise<Array>} List of bookable facilities
 */
const getBookableFacilities = async () => {
  try {
    const response = await client.get('/facilities?filters[isBookable][$eq]=true&populate=*');
    return response.data;
  } catch (error) {
    console.error('Error fetching bookable facilities:', error);
    throw error;
  }
};

export {
  approveFacilityOverrideRequest,
  createBooking,
  createFacility,
  decideClubSession,
  deleteFacility,
  getAvailability,
  getBookableFacilities,
  getClubCollectiviteFacilities,
  getClubFacilityContext,
  getClubVilleFacilitiesWithSlots,
  getCMFacilities,
  getFacilities,
  getFacility,
  getFacilityPlanning,
  getFacilitySections,
  getOccupancy,
  getPendingFacilityOverrideRequests,
  getSentFacilityOverrideRequests,
  refuseFacilityOverrideRequest,
  updateFacility,
};
