/**
 * teamInviteService.js — INVIT2 : les sept portes serveur des invitations d'équipe.
 *
 * `admin/src/api/team-invite/routes/team-invite.ts`. Les erreurs gardent leur
 * STATUT et leur CODE : l'écran distingue un plafond atteint d'un numéro
 * impossible et d'une panne.
 */
import i18next from 'i18next';

import client from '../client';

/**
 * Traduit une erreur HTTP en erreur lisible, avec son statut et son code serveur.
 * @param {any} error - l'erreur axios.
 * @param {string} fallbackMessage - le message quand le serveur ne dit rien.
 * @returns {Error & { code: string, status: number | null }} l'erreur.
 */
const toReadableError = (error, fallbackMessage) => {
  const responseError = error?.response?.data?.error;
  const nextError = /** @type {any} */ (new Error(
    responseError?.message || error?.message || fallbackMessage,
  ));
  nextError.status = Number(error?.response?.status || error?.status || 0) || null;
  nextError.code = String(responseError?.details?.code || '').trim();
  return nextError;
};

/**
 * Enveloppe commune : `{ data }` du serveur, ou une erreur lisible.
 * @param {() => Promise<any>} call - l'appel.
 * @param {string} fallbackMessage - le message de repli.
 * @returns {Promise<any>} la donnée.
 */
const unwrap = async (call, fallbackMessage) => {
  try {
    const response = await call();
    return response?.data?.data ?? null;
  } catch (error) {
    throw toReadableError(error, fallbackMessage);
  }
};

/**
 * Ce que montre un lien d'invitation : équipe, club, invitant. Public.
 * @param {string} code - le code du lien.
 * @returns {Promise<any>} l'aperçu.
 */
export const getTeamInvitePreview = (code) => unwrap(
  () => client.get(`/team-invites/preview/${encodeURIComponent(code)}`),
  i18next.t(
    'teamInviteService.errors.preview',
    'Impossible de lire cette invitation pour le moment.',
  ),
);

/**
 * La personne connectée ouvre un lien : que peut-elle faire ?
 * @param {string} code - le code du lien.
 * @returns {Promise<{ mode: string, requestId?: string, teamId: string }>} la décision.
 */
export const claimTeamInvite = (code) => unwrap(
  () => client.post(`/team-invites/claim/${encodeURIComponent(code)}`),
  i18next.t(
    'teamInviteService.errors.claim',
    'Impossible d\'ouvrir cette invitation pour le moment.',
  ),
);

/**
 * Le lien du staff pour cette équipe (réutilisé tant qu'il vit).
 * @param {string} teamId - l'équipe.
 * @returns {Promise<{ code: string, expiresAt: string }>} le code.
 */
export const createTeamInviteLink = (teamId) => unwrap(
  () => client.post('/team-invites/link', { data: { team: teamId } }),
  i18next.t('teamInviteService.errors.link', 'Impossible de préparer le lien d\'invitation.'),
);

/**
 * L'invitation par numéro de téléphone.
 * @param {{ firstname: string, phoneNumber: string, teamId: string }} params - la saisie.
 * @returns {Promise<any>} l'invitation créée.
 */
export const createTeamPhoneInvite = ({ firstname, phoneNumber, teamId }) => unwrap(
  () => client.post('/team-invites/phone', { data: { firstname, phoneNumber, team: teamId } }),
  i18next.t(
    'teamInviteService.errors.phone',
    'Impossible d\'enregistrer cette invitation pour le moment.',
  ),
);

/**
 * Les invitations envoyées pour cette équipe.
 * @param {string} teamId - l'équipe.
 * @returns {Promise<any[]>} la liste.
 */
export const getSentTeamInvites = async (teamId) => {
  const data = await unwrap(
    () => client.get('/team-invites/sent', { params: { team: teamId } }),
    i18next.t('teamInviteService.errors.sent', 'Impossible de charger les invitations envoyées.'),
  );
  return Array.isArray(data) ? data : [];
};

/**
 * Qui proposer, et pourquoi.
 * @param {string} teamId - l'équipe.
 * @returns {Promise<any[]>} les propositions.
 */
export const getTeamInviteSuggestions = async (teamId) => {
  const data = await unwrap(
    () => client.get('/team-invites/suggestions', { params: { team: teamId } }),
    i18next.t('teamInviteService.errors.suggestions', 'Impossible de charger les propositions.'),
  );
  return Array.isArray(data) ? data : [];
};

/**
 * Annuler une invitation encore en attente.
 * @param {{ id: string, type: string }} params - l'invitation.
 * @returns {Promise<any>} le résultat.
 */
export const cancelTeamInvite = ({ id, type }) => unwrap(
  () => client.post('/team-invites/cancel', { data: { id, type } }),
  i18next.t(
    'teamInviteService.errors.cancel',
    'Impossible d\'annuler cette invitation pour le moment.',
  ),
);
