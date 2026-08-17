import AppUpdateRequiredScreen from '@/views/appUpdate/AppUpdateRequiredScreen';

import { useAppUpdateGate } from '@/services/appUpdate/appUpdateGateQueries';
import {
  isBlockedByUpdateGate,
  resolveUpdateContactUrl,
  resolveUpdateStoreUrl,
} from '@/services/appUpdate/appUpdateGateRules';

import device from '@/platform/device';

/**
 * S09 — la porte « mise a jour obligatoire ».
 *
 * 🔓 SON COMPORTEMENT PAR DEFAUT EST DE LAISSER PASSER, ET C'EST LE POINT LE
 * PLUS IMPORTANT DU LOT. Pendant le chargement, en cas d'erreur reseau, sur une
 * reponse illisible, sur un verdict absent ou incompris : elle rend ses enfants.
 * Le blocage ne se declenche que sur `blocked === true`, un booleen, envoye
 * explicitement par le serveur.
 *
 * 🚪 QUAND ELLE BLOQUE, elle ne rend PAS ses enfants du tout — l'arbre de
 * navigation n'est jamais monte. Il n'y a donc rien a depiler : ni le bouton
 * retour du telephone, ni un geste de retour arriere ne peuvent reveler l'app.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function AppUpdateGate({ children }) {
  const { data } = useAppUpdateGate();
  const verdict = /** @type {Record<string, unknown>} */ (data || {});

  if (!isBlockedByUpdateGate(data)) {
    return /** @type {import('react').ReactElement} */ (children);
  }

  return (
    <AppUpdateRequiredScreen
      contactUrl={resolveUpdateContactUrl(data)}
      currentVersion={device.getAppVersion()}
      minimumVersion={String(verdict.minimumVersion || '') || null}
      storeUrl={resolveUpdateStoreUrl(data)}
    />
  );
}

export default AppUpdateGate;
