import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * ST-RETOURS (02/10) — CE QUE DIT UN RETOUR DU COACH, sans React : les lignes que la carte
 * affiche (planche 19) et ce qui est « nouveau ». Teste a part : `__tests__/coachFeedbackModel`.
 */

/**
 * Le jour du MATCH, court : « sam. 5 sept. ». Plus la date de publication (defaut 26).
 * @param {unknown} value - La date brute.
 * @returns {string} - Le jour, ou une chaine vide.
 */
export const formatFeedbackDay = (value) => {
  const date = new Date(String(value || ''));
  if (!value || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeDesFormats(), {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(date);
};

/**
 * « victoire 2 - 1 », « nul 2 - 2 », « défaite 0 - 3 » — ou rien sans score.
 * @param {(key: string, options?: any) => string} t - La traduction.
 * @param {any} item - Le retour.
 * @returns {string} - Le resultat vu de l equipe du joueur.
 */
export const feedbackResultLabel = (t, item) => {
  const scoreFor = item?.scoreFor;
  const scoreAgainst = item?.scoreAgainst;
  if (typeof scoreFor !== 'number' || typeof scoreAgainst !== 'number') return '';
  const score = `${scoreFor} - ${scoreAgainst}`;
  if (item?.result === 'win') return t('stRetours.feedback.resultWin', { score });
  if (item?.result === 'loss') return t('stRetours.feedback.resultLoss', { score });
  if (item?.result === 'draw') return t('stRetours.feedback.resultDraw', { score });
  return score;
};

/**
 * La ligne sous le titre d un retour.
 *   · dans la liste : « U15 · sam. 5 sept. · victoire 2 - 1 · de Karim » ;
 *   · sur la fiche de l enfant :
 *     « AS Montrivage — Test-COMPO · sam. 5 sept. · victoire 2 - 1 · Karim ».
 * @param {(key: string, options?: any) => string} t - La traduction.
 * @param {any} item - Le retour.
 * @param {'list' | 'latest'} [variant] - Ou la ligne s affiche.
 * @returns {string} - La ligne.
 */
export const feedbackMetaLine = (t, item, variant = 'list') => {
  const author = String(item?.authorFirstname || '').trim();
  const head = variant === 'latest' ? item?.matchLabel : item?.teamName;
  return [
    String(head || '').trim(),
    formatFeedbackDay(item?.matchDate || item?.publishedAt || item?.submittedAt),
    feedbackResultLabel(t, item),
    author && (variant === 'latest'
      ? author
      : t('stRetours.feedback.byAuthor', { name: author, ...SANS_ECHAPPEMENT })),
  ].filter(Boolean).join(' · ');
};

/**
 * Les clefs deja lues pour ce joueur, telles que le serveur les a rangees.
 * @param {any} follow - La reponse de `/firebase-auth/me/coach-feedback-follow`.
 * @param {string} playerDocumentId - Le joueur suivi (moi, ou mon enfant).
 * @returns {Set<string>} - Les clefs lues.
 */
export const seenFeedbackKeys = (follow, playerDocumentId) => new Set(
  Array.isArray(follow?.[playerDocumentId]?.seen) ? follow[playerDocumentId].seen : [],
);

/**
 * Les retours encore jamais lus.
 * @param {any[]} items - Les retours.
 * @param {Set<string>} seen - Les clefs lues.
 * @returns {Set<string>} - Les clefs nouvelles.
 */
export const newFeedbackKeys = (items, seen) => new Set(
  (Array.isArray(items) ? items : [])
    .map((item) => String(item?.feedbackKey || ''))
    .filter((key) => key && !seen.has(key)),
);

/**
 * Le parent veut-il etre prevenu pour cet enfant ? Allume par defaut (planche 22, etat 2).
 * @param {any} follow - La carte rangee.
 * @param {string} childDocumentId - L enfant.
 * @returns {boolean} - Faux seulement si le parent a coupe l alerte.
 */
export const wantsChildFeedbackAlert = (follow, childDocumentId) => (
  follow?.[childDocumentId]?.notify !== false
);
