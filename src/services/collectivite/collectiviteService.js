import {
  listSuperadminEntries,
  searchSuperadminRelations,
} from '@/services/admin/superadminService';
import client from '@/services/client';

/**
 * COLLECTIVITES 1c (2026-09-29) — l espace « Ma collectivite » du GESTIONNAIRE de mairie.
 *
 * Le serveur est le SEUL juge : chaque route `/collectivites/:id/...` est gardee par
 * la policy `is-gestionnaire-collectivite` (la relation `gestionnaires`, jamais le role).
 * L app ne deduit rien : elle affiche ce que le serveur lui rend, ou son refus.
 * Aucune de ces reponses ne porte une personne d un club (SPEC §2 H), sauf la personne
 * qui DEMANDE un creneau (SPEC §2 E : « qui demande »).
 */

/**
 * Les collectivites que JE gere. Vide pour tout autre compte : c est la porte d entree.
 * @returns {Promise<object>} `{ data: [{ documentId, name, type, ... }] }`.
 */
export const getMyCollectivites = async () => {
  const response = await client.get('/collectivites/mine');
  return response.data;
};

/**
 * Ses clubs rattaches : nom, logo, contact GENERAL du club, nombres d equipes et de membres.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getCollectiviteClubs = async (collectiviteId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/clubs`);
  return response.data;
};

/**
 * Ses installations (horaires d ouverture et capacite compris).
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getCollectiviteInstallations = async (collectiviteId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/installations`);
  return response.data;
};

/**
 * Les demandes posees sur ses installations.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @param {'pending' | 'decided'} status - En attente (avec le conflit) ou traitees.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getCollectiviteRequests = async (collectiviteId, status) => {
  const response = await client.get(`/collectivites/${collectiviteId}/requests`, {
    params: { status },
  });
  return response.data;
};

/**
 * Cree ou modifie une installation de la collectivite. Le serveur ne lit qu une liste
 * blanche : nom, type, adresse, horaires, capacite, mode de conflit, couleur.
 * @param {{ collectiviteId: string, data: object, facilityId?: string | null }} params - La cible.
 * @returns {Promise<object>} `{ data: installation }`.
 */
export const saveCollectiviteInstallation = async ({ collectiviteId, data, facilityId = null }) => {
  const route = `/collectivites/${collectiviteId}/installations`;
  const response = facilityId
    ? await client.put(`${route}/${facilityId}`, { data })
    : await client.post(route, { data });
  return response.data;
};

// ─── CONSOLE SUPER-ADMIN (D61, 2026-09-29) ─────────────────────────────────────────────
//
// « Nous » activons, coupons, rattachons, nommons. AUCUNE route neuve : les LECTURES passent
// par l explorateur super-admin existant (`/superadmin/content/:uid/list`, qui accepte tout
// type `api::`), les GESTES par les 6 routes du lot 1a/1d (`/superadmin/collectivites/...`).
// Toutes gardees par `global::is-superadmin` (temoin admin COLL1A T9) : pour un autre
// compte, le serveur repond 403 et l ecran l affiche.

export const COLLECTIVITE_UID = 'api::collectivite.collectivite';

// La liste : une ligne par collectivite, ses clubs reduits a leur identifiant (on les compte).
// ponytail: 100 collectivites par page, sans page suivante — au-dela, l ecran le dit
// (`meta.pagination.total`) ; voie de sortie : paginer comme AdminClubList.
export const ADMIN_COLLECTIVITES_LIST_PAYLOAD = {
  fields: ['documentId', 'name', 'type', 'isActive'],
  pagination: { page: 1, pageSize: 100 },
  populate: { clubs: { fields: ['documentId'] } },
  sort: ['name:asc'],
};

// Le detail : la meme lecture, filtree sur UNE collectivite (un corps JSON, pas de
// `populate` imbrique dans une URL). Des gestionnaires, le nom et l e-mail seulement.
export const ADMIN_COLLECTIVITE_DETAIL_POPULATE = {
  clubs: { fields: ['documentId', 'name'], populate: { logo: { fields: ['url'] } } },
  gestionnaires: { fields: ['documentId', 'firstname', 'lastname', 'email'] },
  installations: { fields: ['documentId', 'name', 'type', 'maxSlots'] },
};

const idSur = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || '').trim());
const collectiviteRoute = (/** @type {unknown} */ collectiviteId) => (
  `/superadmin/collectivites/${idSur(collectiviteId)}`
);

/**
 * Toutes les collectivites, pour la liste de la console.
 * @returns {Promise<any>} `{ data: [{ documentId, name, type, isActive, clubs }], meta }`.
 */
export const getAdminCollectivites = async () => (
  listSuperadminEntries(COLLECTIVITE_UID, ADMIN_COLLECTIVITES_LIST_PAYLOAD)
);

/**
 * Une collectivite avec ses clubs, ses gestionnaires et ses installations.
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<any>} La ligne, ou null si elle n existe pas.
 */
export const getAdminCollectivite = async (collectiviteId) => {
  const response = await listSuperadminEntries(COLLECTIVITE_UID, {
    fields: ['documentId', 'name', 'type', 'isActive', 'codeInsee', 'siren'],
    filters: { documentId: { $eq: String(collectiviteId || '').trim() } },
    pagination: { page: 1, pageSize: 1 },
    populate: ADMIN_COLLECTIVITE_DETAIL_POPULATE,
  });
  return Array.isArray(response?.data) ? response.data[0] || null : null;
};

/**
 * Active ou coupe la collectivite : le serveur pose ou retire l offre Club de chacun de ses
 * clubs rattaches (un club qui paie lui-meme n est pas touche).
 * @param {{ collectiviteId: string, isActive: boolean }} params - La cible et l etat voulu.
 * @returns {Promise<any>} `{ data: { changed, clubs: [{ clubDocumentId, offer }], isActive } }`.
 */
export const setAdminCollectiviteActive = async ({ collectiviteId, isActive }) => {
  const response = await client.put(`${collectiviteRoute(collectiviteId)}/active`, {
    data: { isActive: isActive === true },
  });
  return response.data;
};

/**
 * TEXTES-COLLECTIVITES (01/10) — l APERCU d « activer » ou « couper » : ce que le serveur
 * FERAIT, club par club et par leur nom, sans rien ecrire. Le corps ne porte PAS `isActive` :
 * un serveur d avant le lot le refuse (400) au lieu de faire le geste — une app neuve face a
 * un serveur ancien ne peut donc jamais activer ou couper en croyant demander un apercu.
 * @param {{ collectiviteId: string, isActive: boolean }} params - La cible et l etat vise.
 * @returns {Promise<any>} `{ data: { clubs: [{ clubDocumentId, name, offer }], isActive,
 *   preview: true } }`.
 */
export const previewAdminCollectiviteActive = async ({ collectiviteId, isActive }) => {
  const response = await client.put(`${collectiviteRoute(collectiviteId)}/active`, {
    data: { previewIsActive: isActive === true },
  });
  return response.data;
};

/**
 * Rattache un club existant (un club = une collectivite ; 409 s il en a deja une).
 * @param {{ collectiviteId: string, clubId: string }} params - documentIds.
 * @returns {Promise<any>} `{ data: { attached, changed, offer } }`.
 */
export const attachAdminCollectiviteClub = async ({ clubId, collectiviteId }) => {
  const response = await client.post(`${collectiviteRoute(collectiviteId)}/clubs/${idSur(clubId)}`);
  return response.data;
};

/**
 * Detache un club : la relation seule, le club reste intact (son offre offerte part).
 * @param {{ collectiviteId: string, clubId: string }} params - documentIds.
 * @returns {Promise<any>} `{ data: { attached, changed, offer } }`.
 */
export const detachAdminCollectiviteClub = async ({ clubId, collectiviteId }) => {
  const response = await client.delete(
    `${collectiviteRoute(collectiviteId)}/clubs/${idSur(clubId)}`,
  );
  return response.data;
};

/**
 * Nomme un gestionnaire (aucun role Strapi n est donne).
 * @param {{ collectiviteId: string, userId: string }} params - documentIds.
 * @returns {Promise<any>} `{ data: { changed, gestionnaire } }`.
 */
export const addAdminCollectiviteGestionnaire = async ({ collectiviteId, userId }) => {
  const response = await client.post(
    `${collectiviteRoute(collectiviteId)}/gestionnaires/${idSur(userId)}`,
  );
  return response.data;
};

/**
 * Retire un gestionnaire : son compte reste intact, il perd l acces.
 * @param {{ collectiviteId: string, userId: string }} params - documentIds.
 * @returns {Promise<any>} `{ data: { changed, gestionnaire } }`.
 */
export const removeAdminCollectiviteGestionnaire = async ({ collectiviteId, userId }) => {
  const response = await client.delete(
    `${collectiviteRoute(collectiviteId)}/gestionnaires/${idSur(userId)}`,
  );
  return response.data;
};

/**
 * Cree une collectivite (inactive : l activer est un geste a part).
 * @param {Record<string, string>} data - name, type, codeInsee et/ou siren, email, phoneNumber.
 * @returns {Promise<any>} `{ data: { documentId, ... } }`.
 */
export const createAdminCollectivite = async (data) => {
  const response = await client.post('/superadmin/collectivites', { data });
  return response.data;
};

// Ce que chaque recherche lit : un club par son nom, un compte par son nom et son e-mail.
const SEARCH_FIELDS = {
  club: ['documentId', 'name'],
  user: ['documentId', 'firstname', 'lastname', 'email'],
};
const SEARCH_UIDS = { club: 'api::club.club', user: 'plugin::users-permissions.user' };

/**
 * Cherche un club a rattacher, ou un compte a nommer gestionnaire.
 * @param {'club' | 'user'} kind - Ce qu on cherche.
 * @param {string} query - Le texte tape.
 * @returns {Promise<any>} `{ data: [{ documentId, label, subtitle }] }`.
 */
export const searchAdminCollectiviteTargets = async (kind, query) => (
  searchSuperadminRelations(SEARCH_UIDS[kind], {
    fields: SEARCH_FIELDS[kind],
    pageSize: 10,
    q: String(query || '').trim(),
  })
);
