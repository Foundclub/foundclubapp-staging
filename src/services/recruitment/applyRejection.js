// FINITIONS9 (point 4) — LES REFUS DE `POST /recruitment-ads/:id/apply`, AVEC OU SANS ACCENTS.
//
// Le serveur refuse une candidature en 400 avec une phrase française (« Ce poste est déjà
// complet. »). L'app la lit pour deux choses : ne pas journaliser un refus métier comme une
// panne (`recruitmentService`), et poser tout de suite « Demande en attente » / « Je participe »
// quand le refus dit que la candidature existe déjà (`RecruitmentAdDetails`).
//
// ⚠️ Deux formes vivent en même temps : la prod garde « Votre candidature est deja validee »
// jusqu'à la publication groupée, puis dit « Ta candidature est déjà validée » ; et les applis
// déjà installées gardent leur ancienne règle. Les motifs sont donc écrits SANS accents, et le
// message est ramené à cette forme une seule fois, ici. L'ordre de déploiement est indifférent.
// Témoins : services/recruitment/__tests__/recruitmentService.FINITIONS9.refusAttendus.test.js,
// views/recruitment/__tests__/RecruitmentAdDetails.FINITIONS9.refusAccentues.test.js.

// ANNONCE-RAPPEL 6 (05/10) : « Cette annonce a expiré : elle n'accepte plus de candidatures. »
const EXPECTED_REJECTION = /deja candidate|deja une candidature en attente|deja postule|deja validee|deja acceptee|declaration de responsabilite|poste est deja complet|candidature active|detection fermee|annonce a expire/;
const ALREADY_PENDING = /deja candidate|deja une candidature en attente|deja postule/;
const ALREADY_ACCEPTED = /deja acceptee|deja validee|deja ete ajoute/;

/**
 * Le message en minuscules, sans accents : « Déjà validée » => « deja validee ».
 * @param {unknown} message
 * @returns {string}
 */
const withoutAccents = (message) => String(message ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/**
 * Vrai si le 400 est un refus métier attendu (pas une panne à journaliser).
 * @param {unknown} message
 * @returns {boolean}
 */
export const isExpectedApplyRejection = (message) => (
  EXPECTED_REJECTION.test(withoutAccents(message))
);

/**
 * L'état de MA candidature que le refus révèle, ou null s'il n'en dit rien.
 * @param {unknown} message
 * @returns {'accepted' | 'pending' | null}
 */
export const applicationStatusFromApplyRejection = (message) => {
  const normalized = withoutAccents(message);
  if (ALREADY_PENDING.test(normalized)) return 'pending';
  if (ALREADY_ACCEPTED.test(normalized)) return 'accepted';
  return null;
};
