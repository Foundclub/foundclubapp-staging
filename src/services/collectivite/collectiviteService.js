import { getAuthTokens } from '@/domains/auth/authUseCases';

import {
  listSuperadminEntries,
  searchSuperadminRelations,
  updateSuperadminEntry,
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
 * COLL-CLUBS (01/10/2026) — la FICHE d UN club rattache : ses dirigeants NOMMES (SPEC §2 G),
 * ses nombres et noms d equipes, ses demandes sur les installations de la Ville, son contact
 * general et ses partenaires, son offre. Aucune autre personne. 404 si le club n est pas
 * rattache a CETTE collectivite.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @param {string} clubId - documentId du club.
 * @returns {Promise<object>} `{ data: fiche }`.
 */
export const getCollectiviteClub = async (collectiviteId, clubId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/clubs/${clubId}`);
  return response.data;
};

/**
 * Couleur de ce club dans les plannings de cette Ville ; null revient a l'automatique.
 * @param {{
 * collectiviteId: string, clubId: string, planningColor: string | null
 * }} params - Le choix.
 * @returns {Promise<any>} Le choix accepte par le serveur.
 */
export const setClubPlanningColor = async ({ clubId, collectiviteId, planningColor }) => {
  const response = await client.put(
    `/collectivites/${collectiviteId}/clubs/${clubId}/planning-color`,
    { data: { planningColor } },
  );
  return response.data;
};

// ─── COLL-CLUBS (01/10/2026) : INVITER UN CLUB ABSENT ──────────────────────────────────
//
// Le lien de la Ville, la demande « Par FoundClub » (AUCUN e-mail n est envoye : une demande
// est enregistree pour l equipe FoundClub), « Relancer », et — cote club qui ouvre le lien —
// la page publique, « mes clubs » et la demande de rattachement (D70 : FoundClub verifie,
// puis rattache). Serveur : api::collectivite-invitation (admin fix/COLL-CLUBS-admin).

/**
 * Le lien d invitation de la Ville (fabrique a la premiere lecture).
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<object>} `{ data: { token } }`.
 */
export const getCollectiviteInvitationLink = async (collectiviteId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/invitation-link`);
  return response.data;
};

/**
 * « Changer le lien » : l ancien cesse de marcher.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<object>} `{ data: { token } }`.
 */
export const rotateCollectiviteInvitationLink = async (collectiviteId) => {
  const response = await client.post(`/collectivites/${collectiviteId}/invitation-link`);
  return response.data;
};

/**
 * Les invitations en cours de la Ville, avec leur etat (envoyee, inscrit, rattache).
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getCollectiviteInvitations = async (collectiviteId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/invitations`);
  return response.data;
};

/**
 * « Par FoundClub » : le nom et le contact GENERAL d un club absent. Enregistre une demande pour
 * l equipe FoundClub ; le serveur n envoie rien.
 * @param {{ clubContact: string, clubName: string, collectiviteId: string }} params - La demande.
 * @returns {Promise<object>} `{ data: invitation }`.
 */
export const inviteClubByFoundClub = async ({ clubContact, clubName, collectiviteId }) => {
  const response = await client.post(`/collectivites/${collectiviteId}/invitations`, {
    data: { clubContact, clubName },
  });
  return response.data;
};

/**
 * « Relancer » : la demande remonte a l equipe FoundClub.
 * @param {{ collectiviteId: string, invitationId: string }} params - L invitation.
 * @returns {Promise<object>} `{ data: invitation }`.
 */
export const remindCollectiviteInvitation = async ({ collectiviteId, invitationId }) => {
  const response = await client.post(
    `/collectivites/${collectiviteId}/invitations/${invitationId}/remind`,
  );
  return response.data;
};

/**
 * La page PUBLIQUE du lien (sans compte) : la Ville qui invite et ses installations.
 * @param {string} token - Le code du lien.
 * @returns {Promise<object>} `{ data: { collectivite, installations } }`.
 */
export const getCollectiviteInvitationPreview = async (token) => {
  const response = await client.get(`/collectivite-invitations/${encodeURIComponent(token)}`);
  return response.data;
};

/**
 * Les clubs que JE dirige, chacun avec « dans la commune ? » et « deja rattache ? ».
 * @param {string} token - Le code du lien.
 * @returns {Promise<object>} `{ data: [...] }`.
 */
export const getMyClubsForCollectiviteInvitation = async (token) => {
  const response = await client.get(
    `/collectivite-invitations/${encodeURIComponent(token)}/my-clubs`,
  );
  return response.data;
};

/**
 * Un dirigeant demande le rattachement de son club a la Ville du lien.
 * @param {{ clubId: string, token: string }} params - Le lien et le club.
 * @returns {Promise<object>} `{ data: { status, outsideCommune } }`.
 */
export const requestCollectiviteAttach = async ({ clubId, token }) => {
  const response = await client.post(
    `/collectivite-invitations/${encodeURIComponent(token)}/attach-requests`,
    { data: { clubDocumentId: clubId } },
  );
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
// COLL-CONSOLE-BIS (03/10) — + `activatedAt` : « Activée le » (planche 13).
export const ADMIN_COLLECTIVITES_LIST_PAYLOAD = {
  // COLL-C6-DEMO (03/10) — + `isDemo` : la Ville de démonstration ne compte pas comme un client.
  // ⚠️ SERVEUR AVANT L'APP : un serveur d'avant le lot refuse ce champ inconnu (400).
  fields: ['documentId', 'name', 'type', 'isActive', 'activatedAt', 'isDemo'],
  pagination: { page: 1, pageSize: 100 },
  populate: { clubs: { fields: ['documentId'] } },
  sort: ['name:asc'],
};

// Le detail : la meme lecture, filtree sur UNE collectivite (un corps JSON, pas de
// `populate` imbrique dans une URL). Des gestionnaires, le nom et l e-mail seulement.
// COLL-CONSOLE-BIS (03/10) — + la ville des clubs et la couleur des installations (planche
// 15). Des gestionnaires, toujours le nom et l e-mail seulement. Lu par le SEUL SuperAdmin
// (route global::is-superadmin).
export const ADMIN_COLLECTIVITE_DETAIL_POPULATE = {
  clubs: {
    fields: ['documentId', 'name', 'cityName', 'addressDetails'],
    populate: { logo: { fields: ['url'] } },
  },
  gestionnaires: { fields: ['documentId', 'firstname', 'lastname', 'email'] },
  installations: { fields: ['documentId', 'name', 'type', 'maxSlots', 'planningColor'] },
};

const idSur = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || '').trim());
const collectiviteRoute = (/** @type {unknown} */ collectiviteId) => (
  `/superadmin/collectivites/${idSur(collectiviteId)}`
);

/**
 * Toutes les collectivites, pour la liste de la console.
 * C10BIS · P9-12 — `q` : la recherche faite PAR LE SERVEUR (toutes les pages, pas
 * la seule chargee).
 * @param {string} [q] - Le texte cherche ; vide = la premiere page entiere.
 * @returns {Promise<any>} `{ data: [{ documentId, name, type, isActive, clubs }], meta }`.
 */
export const getAdminCollectivites = async (q = '') => (
  listSuperadminEntries(
    COLLECTIVITE_UID,
    q ? { ...ADMIN_COLLECTIVITES_LIST_PAYLOAD, q } : ADMIN_COLLECTIVITES_LIST_PAYLOAD,
  )
);

/**
 * Une collectivite avec ses clubs, ses gestionnaires et ses installations.
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<any>} La ligne, ou null si elle n existe pas.
 */
export const getAdminCollectivite = async (collectiviteId) => {
  const response = await listSuperadminEntries(COLLECTIVITE_UID, {
    // COLL-CONSOLE-BIS (03/10) — + `activatedAt` : « Depuis le … » (planche 15).
    // R17-QUAND-2 — + `schoolHolidayZone` : la zone de vacances corrigée par FoundClub (le serveur
    // joint `holidayZone` : la zone déduite du code INSEE, et celle qui vaut).
    fields: [
      'documentId', 'name', 'type', 'isActive', 'codeInsee', 'siren', 'activatedAt',
      'schoolHolidayZone',
    ],
    filters: { documentId: { $eq: String(collectiviteId || '').trim() } },
    pagination: { page: 1, pageSize: 1 },
    populate: ADMIN_COLLECTIVITE_DETAIL_POPULATE,
  });
  return Array.isArray(response?.data) ? response.data[0] || null : null;
};

/**
 * 🌴 R17-QUAND-2 (planches P11-quand-v2-tel « La zone », P11-quand-v2-ordi C) — CORRIGER LA ZONE DE
 * VACANCES d'une collectivité : A, B, C, Corse, Outre-mer, ou `null` (celle que le code INSEE
 * déduit). La route générique de la console : aucun droit neuf.
 * @param {{ collectiviteId: string, zone: string | null }} params - La cible et la zone.
 * @returns {Promise<any>} La ligne écrite.
 */
export const setAdminCollectiviteHolidayZone = ({ collectiviteId, zone }) => updateSuperadminEntry(
  COLLECTIVITE_UID,
  String(collectiviteId || '').trim(),
  { schoolHolidayZone: zone || null },
  'Zone de vacances scolaires',
);

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
// COLL-CONSOLE (02/10) — et l adresse du club (publique, celle de sa fiche) : la recherche dit
// sa ville, pour rattacher le bon club (planche P2-fiche, « chaque résultat dit sa ville »).
// COLL-CONSOLE-BIS (03/10) — et sa ville officielle, son code INSEE (la proximite) et son SPORT
// (`activites`, une relation : l explorateur la relaie desormais), planche 15.
const SEARCH_FIELDS = {
  club: ['documentId', 'name', 'addressDetails', 'cityName', 'inseeCom'],
  user: ['documentId', 'firstname', 'lastname', 'email'],
};
const SEARCH_POPULATE = { club: { activites: { fields: ['name'] } } };
const SEARCH_UIDS = { club: 'api::club.club', user: 'plugin::users-permissions.user' };

/**
 * Cherche un club a rattacher, ou un compte a nommer gestionnaire.
 * @param {'club' | 'user'} kind - Ce qu on cherche.
 * @param {string} query - Le texte tape.
 * @param {{ signal?: AbortSignal }} [options] - VT18E : pour couper une recherche depassee.
 * @returns {Promise<any>} `{ data: [{ documentId, label, subtitle }] }`.
 */
export const searchAdminCollectiviteTargets = async (kind, query, options) => (
  searchSuperadminRelations(SEARCH_UIDS[kind], {
    fields: SEARCH_FIELDS[kind],
    // COLL-CONSOLE-BIS (03/10) — 20 clubs : la proximite les range ensuite (commune d abord).
    pageSize: kind === 'club' ? 20 : 10,
    ...(SEARCH_POPULATE[/** @type {'club'} */ (kind)]
      ? { populate: SEARCH_POPULATE[/** @type {'club'} */ (kind)] } : {}),
    q: String(query || '').trim(),
  }, options)
);

// ─── COLL-ACCUEIL (01/10/2026) : LA DEMANDE DE GESTIONNAIRE ────────────────────────────
// L inscription « Je represente une collectivite » n ouvre RIEN : elle envoie une demande que
// seul le SuperAdmin tranche (decision d Adel « console oui »). Serveur :
// admin/src/api/collectivite-manager-request (routes sans routeur par defaut).

/**
 * Cherche une collectivite DEJA sur FoundClub par son nom (3 lettres au moins).
 * @param {string} query - Le texte tape.
 * @returns {Promise<any>} `{ data: [{ documentId, name, type }] }` (5 au plus).
 */
export const searchCollectivitesForSignup = async (query) => {
  const response = await client.get('/collectivite-manager-requests/collectivites', {
    params: { q: String(query || '').trim() },
  });
  return response.data;
};

/**
 * COLL-CONSOLE-BIS (03/10/2026) — « CHERCHER LA COMMUNE » (planches 7, 8 et 14) : les communes du
 * referentiel de l Etat (geo.api.gouv.fr, lu PAR LE SERVEUR), avec leurs codes postaux, leur
 * code INSEE et leur SIREN ; une commune deja sur FoundClub porte sa collectivite. Meme route
 * que la recherche ci-dessus, avec `communes=1`. Referentiel en panne : une liste vide.
 * @param {string} query - Le texte tape (3 lettres au moins).
 * @returns {Promise<any>} `{ data: [{ codeInsee, codesPostaux, collectivite, departement, name,
 *   siren }] }`.
 */
export const searchCommunes = async (query) => {
  const response = await client.get('/collectivite-manager-requests/collectivites', {
    params: { communes: 1, q: String(query || '').trim() },
  });
  return response.data;
};

/**
 * VILLE-INSCRIPTION (07/10/2026) — la LISTE COMPLETE d un type, que l etape 1 de l inscription
 * affiche des l ouverture : regions, departements, intercommunalites ; les communes D UN
 * departement. Referentiel de l Etat lu par le serveur (cache 24 h), meme route que la recherche,
 * avec `referentiel`. Une ligne deja sur FoundClub porte sa collectivite ; celles-la d abord.
 * Referentiel en panne : une liste vide.
 * @param {string} type - `region`, `departement`, `intercommunalite` ou `commune`.
 * @param {string} [departement] - Le code du departement (communes seulement).
 * @returns {Promise<any>} `{ data: [{ code, name, collectivite, ... }] }` ; pour les communes, la
 *   forme de `searchCommunes`.
 */
export const getCollectiviteReferentiel = async (type, departement) => {
  const response = await client.get('/collectivite-manager-requests/collectivites', {
    params: { referentiel: type, ...(departement ? { departement } : {}) },
  });
  return response.data;
};

/**
 * Envoie MA demande de gestionnaire.
 * @param {{ codeInsee?: string, collectiviteDocumentId?: string, collectiviteName?: string,
 *   collectiviteType?: string, jobTitle: string, professionalEmail: string }} data - La demande.
 * @returns {Promise<any>} `{ data: { documentId, status, collectivite, createdAt, ... } }`.
 */
export const createManagerRequest = async (data) => {
  const response = await client.post('/collectivite-manager-requests', { data });
  return response.data;
};

/**
 * MES demandes de gestionnaire, les plus recentes d abord.
 * @returns {Promise<any>} `{ data: [{ documentId, status, collectivite, createdAt, decidedAt,
 *   refusalReason }] }`.
 */
export const getMyManagerRequests = async () => {
  const response = await client.get('/collectivite-manager-requests/mine');
  return response.data;
};

/**
 * La file de la console (SuperAdmin) : en attente, ou traitees.
 * @param {'pending' | 'decided'} status - L onglet.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getAdminManagerRequests = async (status) => {
  const response = await client.get('/superadmin/collectivite-manager-requests', {
    params: { status },
  });
  return response.data;
};

/**
 * Accepte (la personne devient gestionnaire) ou refuse (avec un motif) une demande.
 * `data` : `{ reason }` pour refuser, `{ codeInsee, siren, name }` pour accepter une
 * collectivite a creer.
 * @param {{ data?: object, decision: string, requestId: string }} decision - La decision.
 * @returns {Promise<any>} `{ data: la demande tranchee }`.
 */
export const decideManagerRequest = async (decision) => {
  const { data = {}, requestId } = decision;
  const action = decision.decision === 'accept' ? 'accept' : 'refuse';
  const response = await client.post(
    `/superadmin/collectivite-manager-requests/${idSur(requestId)}/${action}`,
    { data },
  );
  return response.data;
};

// ─── COLL-CONSOLE (02/10/2026) : CE QUE L EQUIPE FOUNDCLUB A A TRAITER ───────────────────
// Les demandes « Par FoundClub » (une mairie a donne le nom et le contact GENERAL d un club
// absent) et les demandes de rattachement (un dirigeant a ouvert le lien de sa Ville), lues
// par la console (serveur : api::collectivite-invitation, lot COLL-CLUBS). L etat d une
// demande se LIT (envoyee, inscrit, rattache) : rattacher reste le geste de la fiche.

/**
 * Les demandes, avec leur Ville, leur club et leur etat (500 au plus, les plus recentes d abord).
 * @returns {Promise<any>} `{ data: [{ documentId, kind, status, clubName, clubContact, club,
 *   collectivite, outsideCommune, remindCount, remindedAt, createdAt }] }`.
 */
export const getAdminCollectiviteInvitations = async () => {
  const response = await client.get('/superadmin/collectivite-invitations');
  return response.data;
};

/**
 * VILLE-INVITER-CLUB, VOIE 3 (« collectivité A », 07/10) — les PISTES « Prévenir ma mairie » : un
 * dirigeant dont la collectivité n'est pas sur FoundClub l'a signalée (le club, sa commune, son
 * contact général). Pour l'équipe FoundClub et ses agents commerciaux.
 * @returns {Promise<any>} `{ data: [{ documentId, club, communeCode, communeName, createdAt,
 *   attached }] }`.
 */
export const getAdminCollectiviteLeads = async () => {
  const response = await client.get('/superadmin/collectivite-leads');
  return response.data;
};

/**
 * Relie une demande « Par FoundClub » au club qui s est inscrit depuis (ou la delie, avec
 * `clubId` vide : une erreur de liaison se corrige).
 * @param {{ clubId?: string | null, invitationId: string }} params - documentIds.
 * @returns {Promise<any>} `{ data: la demande relue }`.
 */
export const linkAdminCollectiviteInvitationClub = async ({ clubId = null, invitationId }) => {
  const response = await client.put(
    `/superadmin/collectivite-invitations/${idSur(invitationId)}/club`,
    { data: { clubDocumentId: clubId ? String(clubId) : null } },
  );
  return response.data;
};

// ─── COLL-C5 (03/10/2026) : LES CHIFFRES DE LA VILLE ─────────────────────────────────────
// La page « Chiffres » (planche 30), la jauge de l accueil et l « Utilisation » d un club lisent
// la MEME route ; le contrat de chaque nombre est admin/docs/CONTRAT_CHIFFRES_VILLE.md. Le serveur
// garde la porte : le gestionnaire de CETTE Ville et le super-admin. Aucune personne.

/**
 * Les chiffres de la Ville sur une periode.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @param {'semaine' | 'mois' | 'saison'} periode - La periode.
 * @returns {Promise<any>} `{ data: { periode, from, to, installations, clubs, seances, ville,
 *   demandes } }`.
 */
export const getCollectiviteChiffres = async (collectiviteId, periode) => {
  const response = await client.get(`/collectivites/${idSur(collectiviteId)}/chiffres`, {
    params: { periode },
  });
  return response.data;
};

/**
 * « Un tableau pour le service » : le CSV des seances de la periode (une ligne par seance).
 * Lu en TEXTE, tel quel : aucune transformation JSON.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @param {'semaine' | 'mois' | 'saison'} periode - La periode.
 * @returns {Promise<string>} Le CSV.
 */
export const getCollectiviteChiffresExport = async (collectiviteId, periode) => {
  const response = await client.get(`/collectivites/${idSur(collectiviteId)}/chiffres/export`, {
    params: { periode },
    responseType: 'text',
    transformResponse: [(/** @type {any} */ brut) => brut],
  });
  return String(response.data ?? '');
};

/**
 * COLL-AFFICHE (03/10/2026) — « Une affiche pour l'installation » (planche 30 B) : l'adresse
 * du PDF du planning d'UNE installation pour UNE semaine, et l'en-tête du compte connecté. La
 * route est gardée (gestionnaire de CETTE Ville, ou super-admin) : le fichier est rapatrié avec
 * le jeton par `downloadRemoteFile`, qui le pose sur le téléphone (ou le télécharge, sur le site).
 * @param {string} collectiviteId - documentId de la collectivite.
 * COLL-AFFICHE-2 (03/10, « saison A ») : `periode: 'saison'` demande l'affiche de TOUTE la saison
 * (`periode=saison`, sans semaine : le serveur prend la saison de maintenant).
 * @param {{ installation: string, periode?: 'semaine' | 'saison', semaine?: string }} choix -
 *   L'installation (documentId), la période (la semaine par défaut), le lundi de la semaine.
 * @returns {{ headers: Record<string, string>, url: string }} L'adresse complète et l'en-tête.
 */
export const requeteAfficheInstallation = (collectiviteId, { installation, periode, semaine }) => {
  const jeton = getAuthTokens()?.token;
  return {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    url: client.getUri({
      params: periode === 'saison' ? { installation, periode } : { installation, semaine },
      url: `/collectivites/${idSur(collectiviteId)}/chiffres/affiche`,
    }),
  };
};
