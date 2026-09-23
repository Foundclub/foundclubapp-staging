import { getItem, setItem } from '@/platform/storage';

// FCMSYNC (23/09) — « CE TELEPHONE EST DEJA ENREGISTRE POUR CE COMPTE », ET CA SURVIT
// AU REDEMARRAGE.
//
// Avant, cette memoire ne vivait que le temps du processus : a chaque demarrage, le compte
// actif puis tous les comptes lies du telephone repartaient d'un coup vers
// `/user-fcm-token/me/device`, qui ecrit chaque fois la MEME fiche cote serveur.
//
// Regle (decision du chef d'orchestre, 23/09) : un compte repart si le jeton a change, si
// 24 h ont passe, ou si sa session a quitte le telephone entre-temps (une deconnexion retire
// son lien cote serveur). Le serveur ne purge que les installations sans compte, jamais par
// anciennete : un enregistrement par jour suffit.
// ponytail: la version de l'app n'entre pas dans la cle — apres une mise a jour, la version
// vue par le serveur (diagnostic seulement) peut retarder de 24 h. L'ajouter a la cle si un
// jour le serveur en depend.

const STORAGE_KEY = 'fcm_device_registrations_v1';
export const DEVICE_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Lit la memoire ; une valeur illisible vaut « rien d'enregistre » (on reenregistre).
 * @returns {Record<string, { at: number, token: string }>} - Par compte, le dernier
 *   enregistrement reussi.
 */
const readRegistrations = () => {
  try {
    const parsed = JSON.parse(getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Dit si l'enregistrement de ce compte peut etre saute.
 * @param {string} accountDocumentId - Le compte.
 * @param {string} token - Le jeton de notification du telephone.
 * @param {number} [now] - L'instant present.
 * @returns {boolean} - Vrai si ce compte a enregistre CE jeton il y a moins de 24 h.
 */
export const isDeviceRegistrationFresh = (accountDocumentId, token, now = Date.now()) => {
  const entry = readRegistrations()[accountDocumentId];
  if (!entry || entry.token !== token) return false;
  const ageMs = now - Number(entry.at);
  // Une horloge revenue en arriere rend un age negatif : on reenregistre plutot que de
  // se taire des jours.
  return ageMs >= 0 && ageMs < DEVICE_REGISTRATION_TTL_MS;
};

/**
 * Note un enregistrement reussi.
 * @param {string} accountDocumentId - Le compte qui vient d'etre enregistre.
 * @param {string} token - Le jeton enregistre.
 * @param {number} [now] - L'instant present.
 * @returns {void}
 */
export const rememberDeviceRegistration = (accountDocumentId, token, now = Date.now()) => {
  if (!accountDocumentId || !token) return;
  setItem(STORAGE_KEY, JSON.stringify({
    ...readRegistrations(),
    [accountDocumentId]: { at: now, token },
  }));
};

/**
 * Oublie les comptes dont la session a quitte le telephone.
 * @param {string[]} accountDocumentIds - Les comptes encore presents.
 * @returns {void}
 */
export const forgetDeviceRegistrationsExcept = (accountDocumentIds) => {
  const registrations = readRegistrations();
  const kept = Object.fromEntries(Object.entries(registrations)
    .filter(([accountDocumentId]) => accountDocumentIds.includes(accountDocumentId)));
  if (Object.keys(kept).length === Object.keys(registrations).length) return;
  setItem(STORAGE_KEY, JSON.stringify(kept));
};
