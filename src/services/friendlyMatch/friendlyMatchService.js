import { normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';

import client from '@/services/client';

/**
 * Appels HTTP des annonces de matchs amicaux.
 *
 * Calque de services/recruitment/recruitmentService.js, transpose sur les routes
 * livrees par le socle serveur (admin, branche staging, commit 6057bfb) :
 *   GET/POST   /friendly-match-ads  (+ findOne, PUT, DELETE — routeur core Strapi)
 *   POST       /friendly-match-ads/:id/apply     · /repost
 *   GET        /friendly-match-ads/:id/applications
 *   POST       /friendly-match-applications/:id/respond · /withdraw
 *
 * ⚠️ `find` est le controleur core Strapi : il ne sait NI calculer une distance,
 * NI ouvrir `candidateDates`. Distance, periode et « qui recoit » se filtrent
 * donc cote app, dans domains/search/friendlyMatchFlow.js.
 */

/** Ce qu il faut charger pour dessiner une carte d annonce. */
const AD_CARD_POPULATE = [
  'team',
  'team.club',
  'team.club.logo',
  'activity',
  // D90 — le singulier ET le pluriel. Les annonces publiees avant D90 n ont que
  // le singulier ; ne demander que le pluriel les afficherait « Catégorie libre »
  // et, pire, les ferait disparaitre des filtres. Les deux voyagent ensemble.
  'category',
  'categories',
  'section',
  'level',
  'levels',
  'installation',
];

/** Ce qu il faut en plus quand on regarde ses propres annonces / candidatures. */
const AD_OWNER_POPULATE = [
  ...AD_CARD_POPULATE,
  'author',
  'applications',
  'applications.team',
  'applications.team.club',
  'applications.team.club.logo',
  'applications.applicant',
  // Le fil ouvert par la candidature (§4.3). C est la SEULE facon pour l equipe
  // candidate d en connaitre l identifiant : `GET /friendly-match-ads/:id/
  // applications` est reserve au staff de l ANNONCE (assertManagesAdSide), et
  // `POST /apply` rend la candidature sans populate (friendly-match-workflow.ts:285).
  'applications.chat',
  'chat',
  'resultingEvent',
];

const APPLICATION_STATUSES = ['accepted', 'cancelled', 'declined', 'pending', 'withdrawn'];
const AD_STATUSES = ['cancelled', 'expired', 'matched', 'open'];

/**
 * Ramene un statut de candidature dans l enumeration du schema serveur.
 * @param {any} value
 * @returns {string}
 */
const normalizeApplicationStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return APPLICATION_STATUSES.includes(normalized) ? normalized : 'pending';
};

/**
 * Ramene un statut d annonce dans l enumeration du schema serveur.
 * @param {any} value
 * @returns {string}
 */
const normalizeAdStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return AD_STATUSES.includes(normalized) ? normalized : 'open';
};

/**
 * La cle d une entite, qu on recoive l objet ou deja son identifiant.
 * @param {any} value
 * @returns {string}
 */
const getDocumentKey = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value.documentId || value.id || '').trim();
  return String(value).trim();
};

/**
 * Une liste d identifiants uniques, non vides, a partir de n importe quelle
 * forme d entree (objet, chaine, tableau).
 * @param {any} values
 * @returns {string[]}
 */
const normalizeDocumentIds = (values) => Array.from(new Set(
  (Array.isArray(values) ? values : [values]).map(getDocumentKey).filter(Boolean),
));

/**
 * Une candidature avec ses enumerations remises en forme canonique.
 * @param {any} application
 * @returns {any}
 */
export const normalizeFriendlyMatchApplication = (application) => {
  if (!application || typeof application !== 'object') return application;
  return {
    ...application,
    chosenHosting: String(application.chosenHosting || '').trim().toUpperCase(),
    status: normalizeApplicationStatus(application.status),
  };
};

/**
 * Une annonce prete a etre affichee : dates candidates nettoyees, candidatures
 * normalisees et compteurs deja calcules.
 * @param {any} ad
 * @returns {any}
 */
export const normalizeFriendlyMatchAd = (ad) => {
  if (!ad || typeof ad !== 'object') return ad;

  const applications = Array.isArray(ad.applications)
    ? ad.applications.map(normalizeFriendlyMatchApplication)
    : [];

  return {
    ...ad,
    applications,
    applicationsCount: applications.length,
    candidateDates: normalizeCandidateDates(ad.candidateDates),
    hostingPreference: String(ad.hostingPreference || '').trim().toUpperCase(),
    pendingApplicationsCount: applications
      .filter((/** @type {any} */ item) => item?.status === 'pending').length,
    status: normalizeAdStatus(ad.status),
  };
};

/**
 * La meme normalisation, appliquee a une liste.
 * @param {any} items
 * @returns {any[]}
 */
const normalizeFriendlyMatchCollection = (items) => (
  Array.isArray(items) ? items.map(normalizeFriendlyMatchAd) : []
);

/**
 * La candidature de MES equipes sur une annonce donnee, s il y en a une.
 *
 * Y04 — `scope.clubId` ouvre le meme calcul au staff d un CLUB. Un dirigeant
 * qui n entraine aucune equipe n a aucun `teamId` : sans cette seconde porte,
 * sa propre candidature ne se reconnait pas et disparait. La relation
 * `applications.team.club` est deja peuplee par AD_OWNER_POPULATE.
 * @param {any} ad
 * @param {any} teamIds
 * @param {{ clubId?: string }} [scope]
 * @returns {any | null}
 */
export const findMyApplicationOnAd = (ad, teamIds, scope = {}) => {
  const wantedTeamIds = new Set(normalizeDocumentIds(teamIds));
  const wantedClubId = String(scope?.clubId || '').trim();
  if (wantedTeamIds.size === 0 && !wantedClubId) return null;

  const applications = Array.isArray(ad?.applications) ? ad.applications : [];
  return applications.find((/** @type {any} */ application) => (
    wantedTeamIds.has(getDocumentKey(application?.team))
    || (Boolean(wantedClubId) && getDocumentKey(application?.team?.club) === wantedClubId)
  )) || null;
};

/**
 * L identifiant du fil ouvert par une candidature (§4.3).
 *
 * Le serveur cree bien le fil au moment du `apply`, mais rend la candidature
 * SANS le populer (friendly-match-workflow.ts:285) : on ne peut donc pas se
 * contenter de la reponse du POST. On accepte les deux formes — la relation
 * populee, ou l identifiant nu — et on rend '' plutot que de lever : ne pas
 * trouver le fil n annule pas la candidature, elle a bien ete envoyee.
 * @param {any} application
 * @returns {string}
 */
export const getFriendlyMatchChatId = (application) => getDocumentKey(application?.chat);

/**
 * Recherche texte : elle part au SERVEUR, pas au tableau deja charge. Filtrer la
 * page courante donnerait « aucun resultat » alors que la reponse est page 3.
 * @param {string} search
 * @returns {any}
 */
const buildSearchFilter = (search) => {
  const term = String(search || '').trim();
  if (term.length < 2) return null;
  return {
    $or: [
      { city: { $containsi: term } },
      { description: { $containsi: term } },
      { team: { name: { $containsi: term } } },
      { team: { club: { name: { $containsi: term } } } },
    ],
  };
};

/**
 * Liste publique des annonces (Q12 : visible sans compte).
 * @param {{ page?: number, pageSize?: number, search?: string, status?: string }} [filters]
 * @returns {Promise<{ data: any[], meta: any }>}
 */
export const getFriendlyMatchAds = async (filters = {}) => {
  const {
    page = 1, pageSize = 20, search = '', status = 'open',
  } = filters;
  const searchFilter = buildSearchFilter(search);

  const response = await client.get('/friendly-match-ads', {
    params: {
      filters: {
        isActive: true,
        ...(status ? { status } : {}),
        ...(searchFilter || {}),
      },
      pagination: { page, pageSize },
      populate: AD_CARD_POPULATE,
      sort: ['lastCandidateDate:asc', 'createdAt:desc'],
    },
  });

  return {
    ...response.data,
    data: normalizeFriendlyMatchCollection(response.data?.data),
  };
};

/**
 * Une annonce complete, candidatures comprises.
 * @param {string} adId
 * @returns {Promise<any>}
 */
export const getFriendlyMatchAd = async (adId) => {
  const response = await client.get(`/friendly-match-ads/${adId}`, {
    params: { populate: AD_OWNER_POPULATE },
  });
  return normalizeFriendlyMatchAd(response.data?.data);
};

/**
 * Les annonces publiees par mes equipes, actives ou non.
 * @param {{ authorDocumentId?: string, clubId?: string, teamIds?: any }} [filters]
 * @returns {Promise<any[]>}
 */
export const getMyFriendlyMatchAds = async (filters = {}) => {
  const teamIds = normalizeDocumentIds(filters.teamIds);
  const clubId = String(filters.clubId || '').trim();
  const authorDocumentId = String(filters.authorDocumentId || '').trim();
  const requestFilters = /** @type {any} */ ({});

  // Y04 — LES DEUX PORTES, et le `$or` n est pas du confort. `teamIds` porte les
  // equipes qu on ENTRAINE ; `clubId` porte celles qu on GERE. Un dirigeant qui
  // n entraine rien n avait aucune des deux, et R02 avait mesure le resultat :
  // source coupee avant tout appel, zero annonce, zero erreur, zero trace.
  // Une equipe entrainee peut appartenir a un AUTRE club que le sien : les deux
  // conditions s additionnent, elles ne se remplacent pas.
  const teamConditions = [];
  if (teamIds.length > 0) {
    teamConditions.push({ documentId: teamIds.length === 1 ? teamIds[0] : { $in: teamIds } });
  }
  if (clubId) {
    teamConditions.push({ club: { documentId: clubId } });
  }

  if (teamConditions.length === 1) {
    [requestFilters.team] = teamConditions;
  } else if (teamConditions.length > 1) {
    requestFilters.$or = teamConditions.map((condition) => ({ team: condition }));
  } else if (authorDocumentId) {
    requestFilters.author = { documentId: authorDocumentId };
  } else {
    return [];
  }

  const response = await client.get('/friendly-match-ads', {
    params: {
      filters: requestFilters,
      pagination: { page: 1, pageSize: 50 },
      populate: AD_OWNER_POPULATE,
      sort: ['createdAt:desc'],
    },
  });

  return normalizeFriendlyMatchCollection(response.data?.data);
};

/**
 * Les annonces sur lesquelles MES equipes ont candidate.
 *
 * Il n existe pas de route « liste mes candidatures » cote serveur : lire les
 * candidatures d une annonce est reserve au staff de CETTE annonce
 * (friendly-match-ad-custom.applications). On interroge donc les annonces par
 * leurs candidatures — meme mecanisme que le repli de getMyApplications dans
 * recruitmentService.
 * ⚠️ Y04 — CE FILTRE TRAVERSE `applications`, ET C EST CE QUI LE FAISAIT ECHOUER.
 * Strapi 5 exige l action `<cible>.find` du role des qu une requete AUTHENTIFIEE
 * traverse une relation EN FILTRES (@strapi/utils 5.38,
 * validate/index.js:159-162 -> visitors/throw-restricted-relations.js). Sans
 * `api::friendly-match-application.friendly-match-application.find`, la reponse
 * est un **400 « Invalid key applications »**, jamais un 403 — et comme cet
 * appel partageait un `Promise.all` avec `getMyFriendlyMatchAds`, il emportait
 * AUSSI les propositions RECUES. Droit accorde cote serveur par S01 (admin
 * b2261de). Le `populate`, lui, n a jamais leve : `validateQuery` appelle
 * `validatePopulate` SANS `auth` (:169) — une relation interdite y est
 * silencieusement retiree de la reponse, elle ne la refuse pas.
 * @param {any} teamIds
 * @param {{ clubId?: string }} [scope]
 * @returns {Promise<any[]>}
 */
export const getMyFriendlyMatchApplications = async (teamIds, scope = {}) => {
  const normalizedTeamIds = normalizeDocumentIds(teamIds);
  const clubId = String(scope?.clubId || '').trim();
  if (normalizedTeamIds.length === 0 && !clubId) return [];

  const teamConditions = [];
  if (normalizedTeamIds.length > 0) {
    teamConditions.push({
      documentId: normalizedTeamIds.length === 1
        ? normalizedTeamIds[0]
        : { $in: normalizedTeamIds },
    });
  }
  if (clubId) {
    teamConditions.push({ club: { documentId: clubId } });
  }

  const applicationsFilter = teamConditions.length === 1
    ? { applications: { team: teamConditions[0] } }
    : { $or: teamConditions.map((condition) => ({ applications: { team: condition } })) };

  const response = await client.get('/friendly-match-ads', {
    params: {
      filters: applicationsFilter,
      pagination: { page: 1, pageSize: 50 },
      populate: AD_OWNER_POPULATE,
      sort: ['createdAt:desc'],
    },
  });

  return normalizeFriendlyMatchCollection(response.data?.data)
    .map((ad) => {
      const myApplication = findMyApplicationOnAd(ad, normalizedTeamIds, { clubId });
      return {
        ...ad,
        applicationStatus: myApplication?.status || null,
        myApplication,
      };
    })
    .filter((ad) => Boolean(ad.myApplication));
};

/**
 * Traduit une erreur HTTP en message lisible. Le serveur explique deja pourquoi
 * il refuse (§3.3) : on garde SON message plutot que d en inventer un.
 * @param {any} error
 * @param {string} fallbackMessage
 * @returns {Error}
 */
const toReadableError = (error, fallbackMessage) => {
  const requestError = /** @type {any} */ (error);
  const responseError = requestError?.response?.data?.error;
  const message = responseError?.message
    || requestError?.response?.data?.message
    || requestError?.message
    || fallbackMessage;

  const nextError = /** @type {any} */ (new Error(message));
  nextError.status = Number(requestError?.response?.status || requestError?.status || 0) || null;
  nextError.details = responseError?.details || null;
  return nextError;
};

/**
 * Publie une annonce. L auteur est pose par le serveur, jamais par l app.
 * @param {any} adData
 * @returns {Promise<any>}
 */
export const createFriendlyMatchAd = async (adData) => {
  try {
    const response = await client.post('/friendly-match-ads', { data: adData });
    return normalizeFriendlyMatchAd(response.data?.data);
  } catch (error) {
    throw toReadableError(error, "Impossible de publier l'annonce.");
  }
};

/**
 * Modifie une annonce existante.
 * @param {string} adId
 * @param {any} adData
 * @returns {Promise<any>}
 */
export const updateFriendlyMatchAd = async (adId, adData) => {
  try {
    const response = await client.put(`/friendly-match-ads/${adId}`, { data: adData });
    return normalizeFriendlyMatchAd(response.data?.data);
  } catch (error) {
    throw toReadableError(error, "Impossible de modifier l'annonce.");
  }
};

/**
 * Supprime une annonce. Le serveur emporte ses candidatures en cascade (§4.7).
 * @param {string} adId
 * @returns {Promise<void>}
 */
export const deleteFriendlyMatchAd = async (adId) => {
  try {
    await client.delete(`/friendly-match-ads/${adId}`);
  } catch (error) {
    throw toReadableError(error, "Impossible de supprimer l'annonce.");
  }
};

/**
 * Candidater. `chosenHosting` est OBLIGATOIRE et toujours explicite (Q1) : le
 * serveur repond 400 s il est absent ou incompatible avec l annonce (§3.3).
 * @param {string} adId
 * @param {{
 *  chosenDate?: string, chosenHosting: string, message?: string,
 *  proposedLocation?: any, proposedVenue?: string, team: string
 * }} payload
 * @returns {Promise<any>}
 */
export const applyToFriendlyMatchAd = async (adId, payload) => {
  try {
    const response = await client.post(`/friendly-match-ads/${adId}/apply`, payload);
    return normalizeFriendlyMatchApplication(response.data?.data);
  } catch (error) {
    throw toReadableError(error, "Impossible d'envoyer la proposition de match.");
  }
};

/**
 * Les candidatures recues sur une annonce. Reserve au staff de l annonce.
 * @param {string} adId
 * @returns {Promise<any[]>}
 */
export const getFriendlyMatchApplications = async (adId) => {
  const response = await client.get(`/friendly-match-ads/${adId}/applications`);
  return Array.isArray(response.data?.data)
    ? response.data.data.map(normalizeFriendlyMatchApplication)
    : [];
};

/**
 * Accepter, refuser ou faire evoluer les modalites d une candidature.
 * @param {string} applicationId
 * @param {{ action: string, agreedTerms?: any, reviewNote?: string }} payload
 * @returns {Promise<any>}
 */
export const respondToFriendlyMatchApplication = async (applicationId, payload) => {
  try {
    const response = await client.post(
      `/friendly-match-applications/${applicationId}/respond`,
      payload,
    );
    return response.data?.data;
  } catch (error) {
    throw toReadableError(error, 'Impossible de répondre à cette proposition.');
  }
};

/**
 * Retire une candidature encore en attente (§4.6).
 * @param {string} applicationId
 * @returns {Promise<any>}
 */
export const withdrawFriendlyMatchApplication = async (applicationId) => {
  try {
    const response = await client.post(
      `/friendly-match-applications/${applicationId}/withdraw`,
    );
    return normalizeFriendlyMatchApplication(response.data?.data);
  } catch (error) {
    throw toReadableError(error, 'Impossible de retirer cette proposition.');
  }
};

/**
 * Reposter une annonce expiree a de nouvelles dates (Q7).
 * @param {string} adId
 * @param {{ candidateDates?: any[] }} [payload]
 * @returns {Promise<any>}
 */
export const repostFriendlyMatchAd = async (adId, payload = {}) => {
  try {
    const response = await client.post(`/friendly-match-ads/${adId}/repost`, payload);
    return normalizeFriendlyMatchAd(response.data?.data);
  } catch (error) {
    throw toReadableError(error, "Impossible de reposter l'annonce.");
  }
};
