import { useEffect } from 'react';

import { RouteNames } from '@/navigation/routeNames';

/**
 * RECOLTE-T11 K8 (14/11/2026) — interrupteur FC_COMMUNAUTES_V1 éteint : « Communautés » et
 * « Nouveau groupe » ne s'ouvrent pas (adresse tapée sur le site, lien) ; on revient aux Messages.
 * @param {{ navigation: any }} props
 * @returns {null} Rien à l'écran.
 */
function RetourAuxMessages({ navigation }) {
  useEffect(() => {
    navigation?.navigate?.(RouteNames.Chat);
  }, [navigation]);
  return null;
}

export default RetourAuxMessages;
