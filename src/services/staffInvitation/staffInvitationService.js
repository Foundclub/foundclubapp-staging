/**
 * staffInvitationService.js — INVITE-STAFF (« 202- A », maquette validée le 10/11/2026) :
 * les six portes serveur de l'invitation de staff (coach ou dirigeant).
 *
 * `admin/src/api/staff-invitation/routes/staff-invitation.ts`. L'envoi répond
 * PAREIL que le numéro ait un compte ou non : l'écran n'a rien à distinguer.
 * Les erreurs gardent leur STATUT et leur CODE serveur (`STAFF_INVITE_*`).
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
  const nextError = /** @type {any} */ (new Error(fallbackMessage));
  nextError.status = Number(error?.response?.status || error?.status || 0) || null;
  nextError.code = String(responseError?.details?.code || responseError?.message || '').trim();
  // La décision d'abonnement (offre manquante) reste lisible par
  // `extractSubscriptionDecisionFromError`.
  nextError.details = responseError?.details || null;
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
 * Envoyer une invitation de staff.
 * @param {{
 *   clubId: string, firstname?: string, phoneCountry?: string, phoneNumber: string,
 *   role: 'coach'|'dirigeant', teamId?: string|null,
 * }} params - la saisie.
 * @returns {Promise<{ sent: true, invitation: object }>} l'invitation (même forme partout).
 */
export const sendStaffInvitation = ({
  clubId,
  firstname,
  phoneCountry,
  phoneNumber,
  role,
  teamId,
}) => unwrap(
  () => client.post('/staff-invitations', {
    data: {
      clubId,
      firstname: firstname || undefined,
      phoneCountry,
      phoneNumber,
      role,
      teamId: teamId || undefined,
    },
  }),
  i18next.t('staffInvitation.errors.send', "Impossible d'envoyer l'invitation pour le moment."),
);

/**
 * Les invitations en attente d'un club (rubrique du Staff), et les comptes entrés par une
 * invitation acceptée depuis moins de 7 jours (INVITE-STAFF-DESIGN, maquette D ; champ absent
 * d'un serveur plus ancien : liste vide).
 * @param {string} clubId - le club.
 * @returns {Promise<{ invitations: any[], recentlyAccepted: string[] }>} la lecture.
 */
export const getSentStaffInvitations = async (clubId) => {
  const data = await unwrap(
    () => client.get('/staff-invitations/sent', { params: { clubId } }),
    i18next.t('staffInvitation.errors.sent', 'Impossible de charger les invitations en attente.'),
  );
  return {
    invitations: Array.isArray(data?.invitations) ? data.invitations : [],
    recentlyAccepted: Array.isArray(data?.recentlyAccepted) ? data.recentlyAccepted : [],
  };
};

/**
 * Annuler une invitation envoyée.
 * @param {string} documentId - l'invitation.
 * @returns {Promise<any>} `{ cancelled: true }`.
 */
export const cancelStaffInvitation = (documentId) => unwrap(
  () => client.post(`/staff-invitations/${encodeURIComponent(documentId)}/cancel`),
  i18next.t('staffInvitation.errors.cancel', "Impossible d'annuler cette invitation."),
);

/**
 * Les invitations reçues par le compte connecté.
 * @returns {Promise<any[]>} la liste.
 */
export const getMyStaffInvitations = async () => {
  const data = await unwrap(
    () => client.get('/staff-invitations/mine'),
    i18next.t('staffInvitation.errors.mine', 'Impossible de charger tes invitations.'),
  );
  return Array.isArray(data?.invitations) ? data.invitations : [];
};

/**
 * Accepter une invitation reçue.
 * @param {string} documentId - l'invitation.
 * @returns {Promise<{ accepted: true, club: object, role: string, team: object|null }>} réponse.
 */
export const acceptStaffInvitation = (documentId) => unwrap(
  () => client.post(`/staff-invitations/${encodeURIComponent(documentId)}/accept`),
  i18next.t(
    'staffInvitation.errors.accept',
    "Impossible d'accepter cette invitation pour le moment.",
  ),
);

/**
 * Refuser une invitation reçue.
 * @param {string} documentId - l'invitation.
 * @returns {Promise<{ refused: true }>} le résultat.
 */
export const refuseStaffInvitation = (documentId) => unwrap(
  () => client.post(`/staff-invitations/${encodeURIComponent(documentId)}/refuse`),
  i18next.t(
    'staffInvitation.errors.refuse',
    'Impossible de refuser cette invitation pour le moment.',
  ),
);
