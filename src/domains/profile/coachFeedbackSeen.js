import {
  newFeedbackKeys,
  seenFeedbackKeys,
} from '@/views/profile/coachFeedback/coachFeedbackModel';

/**
 * ST-VUES2 — « 1 NOUVEAU » SUR « RETOURS DU COACH » (écran 16, section Suivi de mon profil).
 *
 * UNE SEULE marque « lu » (« lu A », tranché par le chef d'orchestre le 02/10) : celle de
 * ST-RETOURS, `coachFeedbackFollow` — rangée sur MON compte, une clé par feuille publiée
 * (`feedbackKey` de chaque retour) ; un retour corrigé et republié redevient nouveau. La vue
 * des retours (`UserDetails`, vue `coachFeedback`) marque les clés lues en s'ouvrant. Les
 * deux aides viennent de ST-RETOURS (`coachFeedbackModel`) : rien n'est réécrit ici.
 */

/**
 * Combien de retours du coach ce lecteur n'a pas encore lus.
 * Tant que le suivi n'est pas chargé, rien n'est annoncé : sinon la pastille montrerait
 * « 3 nouveaux » le temps d'une requête, puis disparaîtrait.
 * @param {Array<{ feedbackKey?: string }> | null | undefined} items - Les retours
 *   (`personal-stats`, `recentCoachFeedback`).
 * @param {any} follow - La réponse de `/firebase-auth/me/coach-feedback-follow`.
 * @param {string | null | undefined} playerDocumentId - Le lecteur (le joueur lui-même).
 * @returns {number} Le nombre de retours nouveaux.
 */
export const countNewCoachFeedback = (items, follow, playerDocumentId) => {
  if (!follow || !playerDocumentId) return 0;
  return newFeedbackKeys(items || [], seenFeedbackKeys(follow, playerDocumentId)).size;
};
