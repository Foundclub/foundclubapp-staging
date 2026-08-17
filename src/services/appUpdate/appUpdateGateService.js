import { Platform } from 'react-native';

import client from '@/services/client';

import device from '@/platform/device';

export const APP_UPDATE_GATE_QUERY_KEY = ['app', 'update-gate'];

/**
 * Le verdict du serveur. `platform` et `version` partent en clair : c'est le
 * serveur qui tranche, jamais l'app (une version minimale ecrite en dur dans le
 * telephone deviendrait fausse et ne serait plus corrigeable).
 *
 * ⛔ Ce fichier ne DECIDE rien : les regles vivent dans `appUpdateGateRules.js`.
 * @returns {Promise<Record<string, unknown> | null>}
 */
export const getAppUpdateGate = async () => {
  const response = await client.get('/app/update-gate', {
    params: {
      platform: Platform.OS,
      version: device.getAppVersion(),
    },
  });

  return response?.data?.data || null;
};
