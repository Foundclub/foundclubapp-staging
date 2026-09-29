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
