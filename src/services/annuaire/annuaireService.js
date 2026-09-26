import client from '../client';

// RECHERCHE-UNIQUE (phase 3, 25/09) — décision d'Adel (« Q2 = B ») : un seul champ « Lieu », qui
// accepte une ville, un département ou une région. Pour un département ou une région, la liste de
// clubs lit l'ANNUAIRE, pas la table des clubs : mesure du 25/09 en production, le titre d'une page
// département compte 404 clubs de football dans les Bouches-du-Rhône, la table n'en marque que 250
// (departmentCode) et aucun en région. L'annuaire rattache un club par le code postal de son
// adresse ; lire la même source, c'est afficher le même nombre que le titre.

/**
 * @typedef {{ code: string | null, name: string, slug: string }} Territoire
 */

/**
 * Les départements et régions de l'annuaire, avec les slugs de ses pages (route publique légère :
 * `/public-directory/facets` porte la même liste mais pèse 8,9 Mo).
 * @returns {Promise<{ departments: Territoire[], regions: Territoire[] }>} Les deux listes.
 */
export const getTerritoires = async () => {
  const response = await client.get('/public-directory/territories');
  const data = response?.data?.data || {};
  return {
    departments: Array.isArray(data.departments) ? data.departments : [],
    regions: Array.isArray(data.regions) ? data.regions : [],
  };
};

/**
 * Une page de clubs d'un département ou d'une région, telle que la page d'annuaire la compte.
 * @param {{
 *   department?: string, page?: number, pageSize?: number,
 *   q?: string, region?: string, sport?: string
 * }} params `department` / `region` : slug de la page ; `sport` : slug du sport ;
 *   `q` : nom cherché (2 lettres ou plus).
 * @returns {Promise<{
 *   items: any[], pagination: { page: number, pageCount: number, total: number }
 * }>} La page.
 */
export const getClubsDuTerritoire = async ({
  department, page = 1, pageSize = 24, q, region, sport,
}) => {
  const response = await client.get('/public-directory/landing', {
    params: {
      department: department || undefined,
      page,
      pageSize,
      q: q && String(q).trim().length >= 2 ? String(q).trim() : undefined,
      region: region || undefined,
      sport: sport || undefined,
    },
  });
  const data = response?.data?.data;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination || {
      page: 1, pageCount: 1, pageSize, total: 0,
    },
  };
};
