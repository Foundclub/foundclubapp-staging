import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { activerNotificationsDepuisLeCompte } from '@/utils/notifications/preDemandeNotifications';

import { ENABLE_PUSH_NOTIFICATIONS } from '@/constants/runtimeFlags';

// NOTIF-COMPTE (D122, demande d'Adel du 13/11) — la rangée « Notifications » de « Mon compte ».
// Un iPhone qui a refusé une fois ne redemande plus jamais : seuls ses Réglages rallument. La
// pré-demande ne le proposait qu'au démarrage ; la rangée le propose tout le temps.
// Le site n'a pas de push (NotificationBootstrap.web.js ne monte rien) : pas de rangée.
const DISPONIBLE = Platform.OS !== 'web' && ENABLE_PUSH_NOTIFICATIONS;

/**
 * @typedef {import('@/utils/notifications/etatPermissionNotifications').EtatPermission}
 *   EtatPermission
 */

/**
 * L'état réel de la permission du téléphone, et le geste qui va avec.
 * @returns {{ agir: () => Promise<void>, etat: null | EtatPermission }} - `etat` vaut null tant
 *   qu'il n'est pas lu, et toujours sur le site ou quand le push est éteint (pas de rangée).
 */
export default function useNotificationsDuCompte() {
  /** @type {[null | EtatPermission, Function]} */
  const [etat, setEtat] = useState(null);
  /** @type {import('react').MutableRefObject<null | EtatPermission>} */
  const etatRef = useRef(null);

  const relire = useCallback(async () => {
    /** @type {EtatPermission} */
    let suivant;
    try {
      // Chargé ici, et seulement quand la rangée existe : ce module tire le module natif
      // notifee, que « Mon compte » n'importait pas (site, témoins jest du Profil).
      // eslint-disable-next-line global-require
      const { lireEtatPermissionNotifications } = require(
        '@/utils/notifications/etatPermissionNotifications',
      );
      suivant = await lireEtatPermissionNotifications();
    } catch {
      return;
    }
    const avant = etatRef.current;
    etatRef.current = suivant;
    setEtat(suivant);
    // Rallumée entre-temps (Réglages, ou fenêtre système) : le jeton s'enregistre MAINTENANT.
    // Le retour au premier plan de useNotifications le ferait aussi, mais freiné 30 s
    // (FCMSTORM) ; l'activation passe ce frein, et seulement à ce passage-là.
    if (suivant === 'accordee' && avant && avant !== 'accordee') {
      await activerNotificationsDepuisLeCompte();
    }
  }, []);

  useEffect(() => {
    if (!DISPONIBLE) return undefined;
    relire();
    const abonnement = AppState.addEventListener('change', (etatDeLApp) => {
      if (etatDeLApp === 'active') relire();
    });
    return () => abonnement?.remove?.();
  }, [relire]);

  const agir = useCallback(async () => {
    if (etatRef.current === 'refusee') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    if (etatRef.current === 'a_demander') {
      // L'activation enregistre déjà le jeton : la relecture qui suit (ou celle du retour de la
      // fenêtre système) ne doit pas la rejouer, d'où l'état « pas encore lu ».
      etatRef.current = null;
      await activerNotificationsDepuisLeCompte();
      await relire();
    }
  }, [relire]);

  return { agir, etat: DISPONIBLE ? etat : null };
}
