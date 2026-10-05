import localeDesFormats from '@/theme/strings/localeDesFormats';

/**
 * ANNONCE-RENOUVELER (decision d'Adel « renouveler A », 05/10) — L'ECHEANCE d'une annonce de
 * recrutement, telle que son AUTEUR la lit sur sa fiche.
 *
 * Une annonce vit 30 jours (admin : recruitment-ad/lifecycles.ts:228-231). Ensuite elle sort
 * sans bruit des alertes (search-alert/services/matcher.ts:61) et des cartes d'equipe
 * (domains/playerCard/teamCardModel.js:69) ; aucun serveur ne la ferme, personne n'est prevenu.
 * `POST /recruitment-ads/:id/renew` la relance pour 30 jours a partir de l'appui.
 *
 * Test : __tests__/recruitmentAdRenewal.test.js (a lancer sous TZ=UTC ET TZ=Europe/Paris).
 */

/** Le bouton « Renouveler 30 jours » apparait a 7 jours de l'echeance, ou apres. */
export const RENEWAL_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ou en est l'echeance de cette annonce ?
 * @param {any} ad L'annonce (avec `expirationDate`).
 * @param {Date} [now] L'instant de reference.
 * @returns {{ expiresAt: Date, isExpired: boolean, isRenewable: boolean } | null} null si
 *   l'annonce n'a pas d'echeance lisible : ni ligne, ni bouton.
 */
export const getRecruitmentAdExpiry = (ad, now = new Date()) => {
  // ANNONCE-RAPPEL, point 8 (choix du chef « A », 05/10) — une annonce liee a un EVENEMENT n'a
  // pas d'echeance propre : ses postes naissent avec « +30 jours » par defaut (admin event.ts,
  // createDetectionRecruitmentAdsForEvent), et c'est l'evenement qui la ferme. Ni badge
  // « EXPIRÉE », ni ligne, ni « Renouveler » — meme exclusion que le serveur (apply, rappel J-3).
  if (String(ad?.event?.documentId || '').trim()) return null;
  const expiresAt = Date.parse(String(ad?.expirationDate || ''));
  if (!Number.isFinite(expiresAt)) return null;

  const nowTimestamp = now.getTime();
  return {
    expiresAt: new Date(expiresAt),
    // Meme borne que le serveur (matcher.ts:61) et la carte d'equipe : expiree une fois PASSEE.
    isExpired: expiresAt < nowTimestamp,
    isRenewable: expiresAt - nowTimestamp <= RENEWAL_WINDOW_DAYS * DAY_MS,
  };
};

/**
 * La date de l'echeance AU CALENDRIER DE L'APPAREIL (« 12 novembre », et l'annee quand ce
 * n'est pas celle du jour). Jamais l'heure UTC du serveur : 23 h 30 UTC est deja le lendemain
 * a Paris.
 * @param {Date} date L'echeance.
 * @param {Date} [now] L'instant de reference, pour l'annee.
 * @returns {string} Le libelle.
 */
export const formatRecruitmentAdExpiryDate = (date, now = new Date()) => date.toLocaleDateString(
  localeDesFormats(),
  {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  },
);
