import { useQuery } from '@tanstack/react-query';

import {
  APP_UPDATE_GATE_QUERY_KEY,
  getAppUpdateGate,
} from './appUpdateGateService';

/**
 * 🔓 `retry: false` est volontaire : reessayer ne changerait rien au verdict
 * (un serveur muet ne bloque personne) et ferait des rafales au demarrage.
 * `staleTime` court pour qu'un retour d'app relise le levier rapidement.
 * @param {Record<string, unknown>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useAppUpdateGate = (options = {}) => useQuery({
  queryFn: getAppUpdateGate,
  queryKey: APP_UPDATE_GATE_QUERY_KEY,
  refetchOnMount: false,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: 1000 * 60,
  ...options,
});
