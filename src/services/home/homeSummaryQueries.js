import { useQuery } from '@tanstack/react-query';

import { getHomeSummary } from './homeSummaryService';

export const HOME_SUMMARY_QUERY_KEY = ['home-summary'];

/**
 * D78 — les compteurs de l'accueil, relus a chaque focus de l'ecran.
 *
 * ⛔ `staleTime: 0` EST LA REGLE, PAS UN OUBLI. Le lot serveur D76 a
 * volontairement livre cette route SANS CACHE : `/app/bootstrap` en a un
 * (30 s frais, 4 min perimes) et une pastille servie depuis ce cache pourrait
 * survivre jusqu'a QUATRE MINUTES apres que l'utilisateur a vide sa file — ce
 * qui casse la regle centrale du pack (« zero en attente = aucune pastille »).
 * Remettre un cache long ici annulerait cette decision cote app.
 *
 * 🛟 L'ECHEC NE SE PROPAGE PAS : en cas de rejet, `data` reste `undefined`,
 * `normalizeHomeCounters` rend l'etat vide, et l'accueil s'affiche comme avant
 * le lot. Le filet global du QueryClient ne fait que journaliser vers Sentry
 * (App.js:154) — aucune alerte, aucun ecran d'erreur.
 *
 * ⚠️ Les reprises restent celles du QueryClient (`shouldRetryQuery`) : 2 au
 * plus, et seulement sur panne reseau ou 5xx. Ce reglage a ete mesure le
 * 29/07, on ne le rejoue pas ici.
 * @param {Record<string, any>} [options] - Options de query, `enabled` en tete.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Le resume.
 */
export const useHomeSummary = (options = {}) => useQuery({
  queryFn: getHomeSummary,
  queryKey: HOME_SUMMARY_QUERY_KEY,
  staleTime: 0,
  ...options,
});
