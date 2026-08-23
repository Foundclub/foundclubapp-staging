import Joi from 'joi';

import { celebrate } from '@/services/celebrations/celebrationRuntime';

import { createLogger } from '@/utils/logger/logger';

import client from '../client';

const teamMembershipRequestLogger = createLogger('team-membership-request');

const teamMembershipRequestSchema = Joi.object({
  decisionSource: Joi.string().allow('', null).optional(),
  // P10 — le SENS de la ligne. `null` sur toutes celles d'avant le lot, et
  // `null` se lit PARTOUT comme 'request'.
  // ⚠️ Ce champ est declare mais il ne FILTRE rien : `allowUnknown: true` (plus
  // bas) le laissait deja passer. Il est ecrit ici pour qu'on sache qu'il
  // existe — un champ qui traverse en silence est un champ qu'un lot futur
  // supprime sans le voir.
  direction: Joi.string().valid('request', 'invite').allow(null).optional(),
  documentId: Joi.string().required(),
  invitedBy: Joi.object().allow(null).optional(),
  permissions: Joi.object({
    canManage: Joi.boolean().optional(),
    canView: Joi.boolean().optional(),
  }).optional(),
  processedAt: Joi.string().allow('', null).optional(),
  processedBy: Joi.object().allow(null).optional(),
  state: Joi.string().valid('processed', 'refused', 'pending').required(),
  team: Joi.object().required(),
  user: Joi.object().required(),
}).required();

const teamMembershipRequestsMetaSchema = Joi.object({
  pagination: Joi.object({
    page: Joi.number().required(),
    pageCount: Joi.number().required(),
    pageSize: Joi.number().required(),
    total: Joi.number().required(),
  }).required(),
}).required();

/**
 * S01 — la validation se fait LIGNE PAR LIGNE, jamais sur le lot entier.
 *
 * `team` et `user` sont NULLABLES cote serveur (content-types/team-membership-
 * request/schema.json : aucune n'est `required`, et la suppression de compte
 * laisse `user: null`). Valider la reponse d'un bloc faisait donc echouer TOUTE
 * la section « Équipe » de l'ecran « Demandes » pour une seule ligne abimee —
 * avec un 200 cote serveur, donc sans la moindre trace dans son journal.
 * Constat d'Adel en recette le 2026-08-16 : « Équipe indisponible ».
 *
 * Une enveloppe illisible (`meta` absente) reste une erreur : on ne devine pas
 * une pagination.
 * @param {any} responseData
 * @returns {Promise<{ data: any[], meta: any }>}
 */
const selectValidTeamMembershipRequests = async (responseData) => {
  const meta = await teamMembershipRequestsMetaSchema.validateAsync(responseData?.meta, {
    allowUnknown: true,
  });

  const entries = Array.isArray(responseData?.data) ? responseData.data : [];
  /** @type {any[]} */
  const data = [];
  /** @type {string[]} */
  const rejectedIds = [];

  await Promise.all(entries.map(async (/** @type {any} */ entry) => {
    try {
      data.push(await teamMembershipRequestSchema.validateAsync(entry, { allowUnknown: true }));
    } catch {
      rejectedIds.push(String(entry?.documentId || 'sans-identifiant'));
    }
  }));

  if (rejectedIds.length) {
    // On NOMME ce qui est ecarte : une demande qui disparait sans explication est
    // exactement le defaut que ce filet remplace.
    teamMembershipRequestLogger.warn('demande(s) illisible(s) ecartee(s)', {
      documentIds: rejectedIds,
      rejected: rejectedIds.length,
    });
  }

  return { data, meta };
};

/**
 * Traduit une erreur HTTP en erreur lisible QUI GARDE SON STATUT — sans lui,
 * l'ecran ne peut plus distinguer un refus (403) d'un incident (500) et retombe
 * sur un message fourre-tout. Meme motif que friendlyMatchService.toReadableError.
 * @param {any} error
 * @param {string} fallbackMessage
 * @returns {Error & { status: number | null }}
 */
const toReadableError = (error, fallbackMessage) => {
  const requestError = /** @type {any} */ (error);
  const responseError = requestError?.response?.data?.error;
  const nextError = /** @type {any} */ (new Error(
    responseError?.message
    || requestError?.response?.data?.message
    || requestError?.message
    || fallbackMessage,
  ));
  nextError.status = Number(requestError?.response?.status || requestError?.status || 0) || null;
  return nextError;
};

/**
 * Create a new team membership request
 * @param {{user: string, team: string}} teamMembershipRequestData
 * @returns {Promise<TeamMembershipRequest>} - The created request
 */
export const createTeamMembershipRequest = async (teamMembershipRequestData) => {
  const response = await client.post('/team-membership-requests', {
    data: teamMembershipRequestData,
  });
  celebrate('team_membership_request_sent', {
    teamId: teamMembershipRequestData?.team,
  });
  return response.data;
};

/**
 * Get team membership requests
 * @param {string|string[]} teamIds - Single teamId or array of teamIds
 * @param {{
 *   clubId?: string;
 *   includeHistory?: boolean;
 *   page?: number;
 *   pageSize?: number;
 * }} [params]
 * @returns {Promise<{data: TeamMembershipRequest[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getTeamMembershipRequests = async (teamIds, params = {}) => {
  const {
    clubId,
    includeHistory,
    page,
    pageSize,
  } = params;

  let normalizedTeamIds = [];
  if (Array.isArray(teamIds)) {
    normalizedTeamIds = teamIds.filter(Boolean);
  } else if (teamIds) {
    normalizedTeamIds = [teamIds];
  }
  let teamDocumentIdFilter;
  if (normalizedTeamIds.length > 1) {
    teamDocumentIdFilter = { $in: normalizedTeamIds };
  } else if (normalizedTeamIds.length === 1) {
    [teamDocumentIdFilter] = normalizedTeamIds;
  }

  const filters = {
    filters: {
      team: {
        ...(teamDocumentIdFilter ? { documentId: teamDocumentIdFilter } : {}),
        ...(clubId ? {
          club: {
            documentId: clubId,
          },
        } : {}),
      },
    },
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    // ⛔ AUCUN `populate` ici, et c'est deliberé : le controleur serveur
    // (team-membership-request.ts:127-172) appelle `validateQuery(ctx)` — donc il
    // VALIDE ce que l'app demande — puis remplace le populate par le sien.
    // Le parametre ne servait donc qu'a se faire refuser : nommer la relation
    // `user` exige `plugin::users-permissions.user.find`, action qu'AUCUN role ne
    // declare (elle ne survit en production que par heritage, hors manifeste), et
    // Strapi 5 rend alors 400 « Invalid key user » (validate/index.js:266,
    // throw-restricted-relations.js — ACTIONS_TO_VERIFY = ['find']).
    ...(includeHistory ? { includeHistory: true } : {}),
  };

  let response;
  try {
    response = await client.get('/team-membership-requests', { params: filters });
  } catch (error) {
    throw toReadableError(error, 'Failed to fetch team membership requests');
  }

  try {
    return await selectValidTeamMembershipRequests(response.data);
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error
      ? error.message
      : error;
    throw new Error(`Failed to fetch team membership requests: ${errorToDisplay}`);
  }
};

/**
 * Accept a team membership request
 * @param {string} requestId - The ID of the request to accept
 * @returns {Promise<TeamMembershipRequest>} - The updated request
 */
export const acceptTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/accept`);
  return response.data;
};

/**
 * Reject a team membership request
 * @param {string} requestId - The ID of the request to reject
 * @returns {Promise<TeamMembershipRequest>} - The updated request
 */
export const rejectTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/refuse`);
  return response.data;
};

/**
 * P10 — Inviter quelqu'un dans une equipe (geste du STAFF).
 *
 * ⛔ Ce n'est PAS `createTeamMembershipRequest` : celle-la cree une demande AU
 * NOM DE L'APPELANT (le serveur force `user` a l'appelant). Ici, la ligne porte
 * la personne INVITEE, et elle reste `pending` tant qu'elle n'a pas repondu —
 * personne n'est ajoute a l'equipe par ce geste.
 * @param {{ sourceApplication?: string, team: string, user: string }} invitation
 * @returns {Promise<any>} - The created invitation
 */
export const inviteToTeam = async (invitation) => {
  try {
    const response = await client.post('/team-membership-requests/invite', {
      data: invitation,
    });
    return response.data;
  } catch (error) {
    throw toReadableError(error, 'Impossible d\'envoyer l\'invitation pour le moment.');
  }
};

/**
 * P10 — Accepter une invitation recue (geste de la personne INVITEE).
 * @param {string} requestId - The ID of the invitation to accept
 * @returns {Promise<any>} - The accepted invitation
 */
export const acceptTeamInvitation = async (requestId) => {
  try {
    const response = await client.post(`/team-membership-requests/${requestId}/accept-invite`);
    return response.data;
  } catch (error) {
    throw toReadableError(error, 'Impossible d\'accepter cette invitation pour le moment.');
  }
};

/**
 * P10 — Refuser une invitation recue (geste de la personne INVITEE).
 * @param {string} requestId - The ID of the invitation to refuse
 * @returns {Promise<any>} - The refused invitation
 */
export const refuseTeamInvitation = async (requestId) => {
  try {
    const response = await client.post(`/team-membership-requests/${requestId}/refuse-invite`);
    return response.data;
  } catch (error) {
    throw toReadableError(error, 'Impossible de refuser cette invitation pour le moment.');
  }
};

/**
 * Delete a team membership request
 * @param {string} requestId - The ID of the request to delete
 * @returns {Promise<any>} - The response
 */
export const deleteTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/cancel`);
  return response.data;
};
