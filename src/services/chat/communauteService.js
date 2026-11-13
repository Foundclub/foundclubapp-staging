/**
 * COMMUNAUTES-L2 (13/11/2026) — les 3 routes du socle serveur (admin,
 * `src/api/chat/routes/communaute.ts`).
 * Un serveur d'avant le socle répond 404 : l'appelant le traite comme « aucune communauté ».
 *
 * Le client est chargé à l'appel (`import()`), pas en tête : « Messages » importe ce module par
 * son bouton « Communautés », et le client exige l'adresse du serveur dès son chargement (les 9
 * témoins de « Messages » le montent sans).
 */

/**
 * Le client HTTP de l'app, chargé au premier appel.
 * @returns {Promise<any>} Le client.
 */
const client = async () => (await import('../client')).default;

/**
 * Mes communautés : club, omnisport, Ville, complexe ; Annonces, fils d'équipe, groupes à thème ;
 * `peutCreer`.
 * @returns {Promise<object[]>} La liste (vide si rien).
 */
export const getMesCommunautes = async () => {
  const response = await (await client()).get('/communautes/mine');
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * « Choisir les membres » : ceux que je peux cocher pour ce thème.
 * @param {{ genre: string, id: string, theme: string }} params
 * @returns {Promise<{ membres: object[], total: number }>} Les candidats.
 */
export const getCandidatsCommunaute = async ({ genre, id, theme }) => {
  const response = await (
    await client()
  ).get(`/communautes/${encodeURIComponent(genre)}/${encodeURIComponent(id)}/candidats`, {
    params: { theme },
  });
  return response?.data?.data || { membres: [], total: 0 };
};

/**
 * Crée un groupe à thème dans sa communauté.
 * @param {{ genre: string, id: string, corps: { data: object } }} params
 * @returns {Promise<{ chat: string, groupe: string | null }>} Le fil créé.
 */
export const creerGroupeCommunaute = async ({ corps, genre, id }) => {
  const response = await (
    await client()
  ).post(`/communautes/${encodeURIComponent(genre)}/${encodeURIComponent(id)}/groupes`, corps);
  return response?.data?.data;
};
