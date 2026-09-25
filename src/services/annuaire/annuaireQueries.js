import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getClubsDuTerritoire, getTerritoires } from './annuaireService';

// RECHERCHE-UNIQUE (phase 3) — les deux lectures de l'annuaire dont a besoin le champ Lieu.
// Routes publiques (auth: false côté serveur) : elles partent avec ou sans session.

/**
 * Les départements et régions de l'annuaire. Ils changent au rythme de l'instantané du serveur
 * (plusieurs heures) : une lecture par jour et par appareil suffit.
 * @param {any} [options] Options react-query.
 * @returns {import('@tanstack/react-query').UseQueryResult<{
 *   departments: any[], regions: any[]
 * }>} La requête.
 */
export const useGetTerritoires = (options = {}) => useQuery({
  queryFn: getTerritoires,
  queryKey: ['annuaire', 'territoires'],
  staleTime: 6 * 60 * 60 * 1000,
  ...options,
});

/**
 * Les clubs d'un département ou d'une région, page par page, comptés comme sa page d'annuaire.
 * @param {{ department?: string, q?: string, region?: string, sport?: string }} params
 *   Slugs et nom cherché.
 * @param {any} [options] Options react-query.
 * @returns {any} La requête paginée.
 */
export const useGetClubsDuTerritoire = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam: (/** @type {any} */ page) => {
    const courante = Number(page?.pagination?.page);
    const total = Number(page?.pagination?.pageCount);
    const reste = Number.isFinite(courante) && Number.isFinite(total) && courante < total;
    return reste ? courante + 1 : undefined;
  },
  initialPageParam: 1,
  queryFn: (/** @type {any} */ { pageParam = 1 }) => getClubsDuTerritoire({
    ...params,
    page: pageParam,
  }),
  queryKey: [
    'annuaire',
    'clubs-du-territoire',
    params.sport || null,
    params.department || null,
    params.region || null,
    params.q || null,
  ],
  staleTime: 5 * 60 * 1000,
  ...options,
});
