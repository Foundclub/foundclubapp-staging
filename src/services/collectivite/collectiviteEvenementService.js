/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — les appels de l'ÉVÉNEMENT DE LA VILLE
 * (`api::collectivite-evenement`). La Ville : lister, voir les séances touchées avant de publier,
 * publier, modifier, annuler (policy du gestionnaire). Tout lecteur : la fiche (le serveur ne rend
 * que ce que « Qui le voit ? » permet, sinon 404) et la recherche publique (niveau 3).
 */

const client = async () => (await import('../client')).default;

const lire = async (chemin, options) => (await (await client()).get(chemin, options)).data;

/**
 * GET /collectivites/:id/evenements?from&to&status — ceux de la Ville.
 * @param {string} collectiviteId - La Ville.
 * @param {{ from?: string, status?: string, to?: string }} [params] - La fenêtre.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getEvenementsDeLaVille = (collectiviteId, params = {}) => {
  const chemin = `/collectivites/${collectiviteId}/evenements`;
  return lire(chemin, { params });
};

/**
 * GET /collectivites/:id/evenements-apercu — « 1 séance touchée », AVANT de publier.
 * @param {string} collectiviteId - La Ville.
 * @param {{ endDate?: string|null, endTime: string, facilityId: string, startDate: string,
 *   startTime: string }} params - L'installation, les jours, les heures.
 * @returns {Promise<any>} `{ data: { sessions, sessionsCount, clubs, clubsCount } }`.
 */
export const getApercuEvenement = (collectiviteId, params) => {
  const chemin = `/collectivites/${collectiviteId}/evenements-apercu`;
  const remplis = Object.entries(params || {}).filter(([, valeur]) => Boolean(valeur));
  return lire(chemin, { params: Object.fromEntries(remplis) });
};

/**
 * POST /collectivites/:id/evenements — « Publier l'événement ».
 * @param {{ collectiviteId: string, data: any }} params - La Ville et le corps.
 * @returns {Promise<any>} `{ data: vue }`.
 */
export const publierEvenement = async ({ collectiviteId, data }) => {
  const http = await client();
  return (await http.post(`/collectivites/${collectiviteId}/evenements`, { data })).data;
};

/**
 * PUT /collectivites/:id/evenements/:evenementId — « Modifier ».
 * @param {{ collectiviteId: string, data: any, evenementId: string }} params - Le corps.
 * @returns {Promise<any>} `{ data: vue }`.
 */
export const modifierEvenement = async ({ collectiviteId, data, evenementId }) => {
  const http = await client();
  return (await http.put(`/collectivites/${collectiviteId}/evenements/${evenementId}`, { data }))
    .data;
};

/**
 * POST /collectivites/:id/evenements/:evenementId/annuler — « Annuler l'événement ».
 * @param {{ collectiviteId: string, evenementId: string }} params - Lequel.
 * @returns {Promise<any>} `{ data: vue }`.
 */
export const annulerEvenement = async ({ collectiviteId, evenementId }) => {
  const http = await client();
  return (await http.post(`/collectivites/${collectiviteId}/evenements/${evenementId}/annuler`))
    .data;
};

/**
 * GET /evenements-de-la-ville/:id — la fiche.
 * @param {string} evenementId - L'événement.
 * @returns {Promise<any>} `{ data: vue }`.
 */
export const getEvenementDeLaVille = (evenementId) => lire(
  `/evenements-de-la-ville/${evenementId}`,
);

/**
 * GET /evenements-de-la-ville?q= — la recherche publique (niveau 3).
 * @param {{ q?: string }} [params] - Le mot cherché.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getEvenementsPublicsDeLaVille = (params = {}) => lire(
  '/evenements-de-la-ville',
  { params },
);
