// @ts-nocheck
import client from '../client';

/**
 * 👪 PAR-L11b (13/10) — LES SIX GESTES DU TIROIR « INSCRIPTION D UN ENFANT DECLARE ».
 *
 * Le serveur (admin `api/event-child-registration/`) n a QUE six routes, aucune par
 * defaut : ce fichier ne peut pas en inventer une septieme. Le parent inscrit, relit et
 * annule SES lignes (PAR-L11c) ; l organisateur lit celles de son evenement, accepte,
 * refuse. Chaque reponse est deja reduite par le serveur : prenom et age de l enfant, nom
 * du parent, jamais une date de naissance ni une coordonnee.
 */

/**
 * POST /event-child-registrations — inscrire 1 a 10 enfants. La declaration du
 * representant legal est exigee par le serveur : l ecran ne l envoie qu une fois cochee.
 * @param {{ childIds: string[], eventId: string }} params - L evenement et les fiches.
 * @returns {Promise<{ admission: string, event: string, results: any[] }>} Un resultat
 * PAR enfant.
 */
export const registerChildrenToEvent = async ({ childIds, eventId }) => {
  const response = await client.post('/event-child-registrations', {
    data: { acceptResponsibility: true, children: childIds, event: eventId },
  });
  return response?.data?.data || { admission: null, event: eventId, results: [] };
};

/**
 * GET /event-child-registrations/mine?event= — les inscriptions de MES enfants ici. Sans
 * evenement (PAR-L11c, fiche de l enfant « Ses evenements ») : TOUTES mes lignes, les plus
 * recentes d abord (200 au plus, plafond du serveur).
 * @param {string} [eventId] - L evenement, ou rien.
 * @returns {Promise<any[]>} Mes lignes.
 */
export const getMyChildRegistrations = async (eventId) => {
  const response = await client.get('/event-child-registrations/mine', {
    params: eventId ? { event: eventId } : {},
  });
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * 👪 PAR-L11c (14/10) — DELETE /event-child-registrations/:id : le parent annule SA ligne. Le
 * serveur l efface (une inscription immediate rend sa place a la reservation).
 * @param {string} registrationId - La ligne.
 * @returns {Promise<any>} `{ deleted, documentId }`.
 */
export const cancelChildRegistration = async (registrationId) => {
  const response = await client.delete(`/event-child-registrations/${registrationId}`);
  return response?.data?.data || null;
};

/**
 * GET /event-child-registrations/event/:eventId — l organisateur voit les enfants inscrits.
 * @param {string} eventId - L evenement.
 * @returns {Promise<any[]>} Les lignes en attente et acceptees.
 */
export const getEventChildRegistrations = async (eventId) => {
  const response = await client.get(`/event-child-registrations/event/${eventId}`);
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * POST /event-child-registrations/:id/accept ou /refuse — l organisateur tranche.
 * @param {{ decision: 'accept'|'refuse', reason?: string, registrationId: string }} params
 * Le geste.
 * @returns {Promise<any>} La ligne, telle que l organisateur la voit.
 */
export const decideChildRegistration = async ({ decision, reason, registrationId }) => {
  const action = decision === 'accept' ? 'accept' : 'refuse';
  const response = await client.post(
    `/event-child-registrations/${registrationId}/${action}`,
    { data: action === 'refuse' && reason ? { reason } : {} },
  );
  return response?.data?.data || null;
};
