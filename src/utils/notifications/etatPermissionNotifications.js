import notifee from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

import { lireMemoirePreDemande } from '@/utils/notifications/preDemandeNotifications';

// NOTIF-PREDEMANDE — a part de `preDemandeNotifications.js` : ce fichier tire le module
// natif notifee, l'autre est importe par des services (demande d'adhesion) et leurs tests.

/** @typedef {'accordee' | 'a_demander' | 'refusee'} EtatPermission */

/**
 * L'etat de la permission systeme, sans jamais ouvrir la fenetre.
 * @returns {Promise<EtatPermission>} - Accordee, a demander, ou refusee (Reglages).
 */
export const lireEtatPermissionNotifications = async () => {
  if (Platform.OS === 'android') {
    const accordee = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (accordee) return 'accordee';
    return lireMemoirePreDemande().refusDefinitif ? 'refusee' : 'a_demander';
  }
  // notifee : -1 jamais demande, 0 refuse, 1 accorde, 2 provisoire.
  const { authorizationStatus } = await notifee.getNotificationSettings();
  if (Number(authorizationStatus) > 0) return 'accordee';
  return Number(authorizationStatus) === 0 ? 'refusee' : 'a_demander';
};
