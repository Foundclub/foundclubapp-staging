/**
 * Verrou d'envoi de SMS de connexion.
 *
 * Constat du 2026-07-29 : 4 demandes de code pour le même numéro en 45 secondes
 * ont fait répondre `auth/too-many-requests` à Firebase, ce qui bloque le numéro
 * pendant des heures et rend TOUTE recette OTP impossible. Le code n'avait
 * pourtant aucune boucle de reprise automatique : le bouton d'envoi est bien
 * désactivé pendant la requête (SigninPhoneForm.js:70). Ce qui manquait, c'est
 * un délai minimum ENTRE deux tentatives — rien n'empêchait de renvoyer un SMS
 * une seconde après un échec, ni de quitter puis revenir sur l'écran pour
 * repartir de zéro (l'état `confirm` vit dans le hook, il meurt au démontage).
 *
 * Le compteur vit donc au niveau du module, pas du composant : il survit au
 * démontage de l'écran de connexion, qui était le contournement involontaire.
 *
 * Le quota est compté par Firebase à la TENTATIVE, pas à la réussite : le délai
 * est armé dès qu'un envoi part, qu'il aboutisse ou non. La clé est le numéro,
 * donc corriger une faute de frappe n'attend pas.
 */

export const OTP_SEND_COOLDOWN_MS = 60000;
export const OTP_SEND_THROTTLED_CODE = 'OTP_SEND_THROTTLED';

/** @type {Map<string, number>} */
const lastSendAtByPhoneNumber = new Map();

const normalizePhoneNumber = (/** @type {unknown} */ phoneNumber) => String(phoneNumber || '')
  .replace(/[\s.-]/g, '')
  .trim();

/**
 * Millisecondes restantes avant qu'un nouvel envoi soit autorisé.
 * @param {unknown} phoneNumber
 * @returns {number} 0 quand l'envoi est autorisé tout de suite.
 */
export const getOtpCooldownRemainingMs = (phoneNumber) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return 0;

  const lastSendAt = lastSendAtByPhoneNumber.get(normalized);
  if (!lastSendAt) return 0;

  const elapsedMs = Date.now() - lastSendAt;
  if (elapsedMs < 0) {
    // Horloge reculée (changement de fuseau, correction NTP) : on repart propre
    // plutôt que de geler l'envoi sur une durée absurde.
    lastSendAtByPhoneNumber.delete(normalized);
    return 0;
  }

  return Math.max(0, OTP_SEND_COOLDOWN_MS - elapsedMs);
};

/**
 * Secondes restantes, arrondies au supérieur — pour l'affichage et pour
 * `details.retryAfterSeconds`.
 * @param {unknown} phoneNumber
 * @returns {number}
 */
export const getOtpCooldownRemainingSeconds = (phoneNumber) => Math.ceil(
  getOtpCooldownRemainingMs(phoneNumber) / 1000,
);

/**
 * Arme le délai pour ce numéro. À appeler AVANT d'attendre la réponse de
 * Firebase : deux envois lancés en parallèle compteraient tous les deux dans le
 * quota.
 * @param {unknown} phoneNumber
 * @returns {void}
 */
export const markOtpSendAttempt = (phoneNumber) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return;
  lastSendAtByPhoneNumber.set(normalized, Date.now());
};

/**
 * Refuse l'envoi quand le délai minimum n'est pas écoulé.
 * @param {unknown} phoneNumber
 * @returns {void}
 * @throws {Error & { code: string, details: { retryAfterSeconds: number } }}
 */
export const assertOtpSendAllowed = (phoneNumber) => {
  const remainingSeconds = getOtpCooldownRemainingSeconds(phoneNumber);
  if (remainingSeconds <= 0) return;

  const error = /** @type {any} */ (new Error(
    `Un code vient d'être envoyé. Nouvel envoi possible dans ${remainingSeconds} s.`,
  ));
  error.code = OTP_SEND_THROTTLED_CODE;
  error.details = { retryAfterSeconds: remainingSeconds };
  error.name = 'OtpSendThrottledError';
  throw error;
};

/**
 * Réarme tout (tests, et déconnexion volontaire).
 * @returns {void}
 */
export const resetOtpSendThrottle = () => {
  lastSendAtByPhoneNumber.clear();
};
