// @ts-nocheck
/**
 * Logique PURE de la carte joueur / coach / equipe (aucune dependance projet).
 * Destination repo : app/src/domains/playerCard/cardModel.js
 *
 * Responsabilites :
 *  - calcul de l'age a partir de birthdate
 *  - selection des 3 dernieres experiences (user-history)
 *  - calcul du badge de rarete (deterministe, sans reseau)
 *  - garde-fou mineurs (canPublishCard / requiresParentalConsent)
 *  - construction du modele d'affichage (buildPlayerCardModel)
 *
 * Testable en isolation : voir cardModel.test.js (jest) + cardModel.harness.mjs (node).
 */

export const RARITY = Object.freeze({
  COMMON: 'common',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  RARE: 'rare',
});

export const RARITY_ORDER = [RARITY.COMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

// Seuil de consentement parental pour publication auto d'une carte.
// Aligne sur la demande produit (<15 ans) tout en restant compatible avec
// le flux parentalDeclaration existant (declenche <13 a l'onboarding).
export const MINOR_CARD_PUBLISH_AGE = 15;

const toInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * Age en annees a partir d'une date de naissance ISO (ou Date).
 * @param {string|Date|null|undefined} birthdate
 * @param {Date} [now]
 * @returns {number|null}
 */
export const computeAge = (birthdate, now = new Date()) => {
  if (!birthdate) return null;
  const dob = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

/**
 * Parse l'objet address (json Strapi, eventuellement stringifie) -> ville.
 * @param {any} address
 * @returns {string}
 */
export const extractCity = (address) => {
  if (!address) return '';
  let raw = address;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (_e) { return ''; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  return String(raw.city || raw.town || raw.municipality || '').trim();
};

/**
 * Selectionne au plus N experiences les plus recentes (actives d'abord, puis
 * annee de debut decroissante). Reproduit le tri de UserHistorySection.
 * @param {Array<object>} histories
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export const pickTopHistory = (histories, limit = 3) => {
  const source = Array.isArray(histories) ? histories : [];
  const sorted = [...source].sort((a, b) => {
    const aAct = a?.isCurrentlyActive ? 1 : 0;
    const bAct = b?.isCurrentlyActive ? 1 : 0;
    if (aAct !== bAct) return bAct - aAct;
    const aStart = Number(a?.startYear || 0);
    const bStart = Number(b?.startYear || 0);
    if (aStart !== bStart) return bStart - aStart;
    return Number(b?.endYear || 0) - Number(a?.endYear || 0);
  });
  return sorted.slice(0, limit).map((h) => ({
    category: h?.category?.name || '',
    clubName: h?.club?.name || h?.multisport_club?.name || h?.customClubName || '',
    endYear: toInt(h?.endYear),
    isCurrentlyActive: Boolean(h?.isCurrentlyActive),
    level: h?.level?.name || '',
    startYear: toInt(h?.startYear),
  }));
};

// Poids de niveau normalises (libelles FR usuels FoundClub). Insensible casse.
const LEVEL_WEIGHTS = {
  departemental: 1,
  départemental: 1,
  district: 1,
  elite: 5,
  élite: 5,
  federal: 4,
  fédéral: 4,
  loisir: 0,
  national: 3,
  national1: 4,
  national2: 4,
  national3: 3,
  pro: 5,
  professionnel: 5,
  regional: 2,
  régional: 2,
};

const levelScore = (label) => {
  if (!label) return 0;
  const key = String(label).toLowerCase().replace(/[^a-z0-9à-ÿ]/g, '');
  return LEVEL_WEIGHTS[key] ?? 0;
};

/**
 * Score de completude de profil (0..100). Sert d'entree a la rarete et de
 * signal produit (inciter a completer le profil pour "ameliorer sa carte").
 * @param {object} user
 * @param {Array<object>} topHistory
 * @returns {number}
 */
export const computeCompleteness = (user = {}, topHistory = []) => {
  const checks = [
    Boolean(user.avatar?.url || user.avatarUrl),
    Boolean(user.firstname && user.lastname),
    Boolean(user.position),
    Boolean(user.preferredSport),
    Boolean(user.birthdate),
    Boolean(user.nationality),
    Boolean(extractCity(user.address)),
    Boolean(user.bestLevel),
    topHistory.length >= 1,
    topHistory.length >= 3,
  ];
  const hit = checks.filter(Boolean).length;
  return Math.round((hit / checks.length) * 100);
};

/**
 * Badge de rarete deterministe (aucun aleatoire, aucun reseau).
 * Combine completude du profil + meilleur niveau atteint + anciennete du parcours.
 * @param {object} args
 * @param {number} args.completeness 0..100
 * @param {string} [args.bestLevel]
 * @param {Array<object>} [args.topHistory]
 * @returns {{ rarity: string, score: number, completeness: number }}
 */
export const computeRarity = ({ bestLevel = '', completeness = 0, topHistory = [] } = {}) => {
  const histLevelMax = topHistory.reduce((max, h) => Math.max(max, levelScore(h.level)), 0);
  const lvl = Math.max(levelScore(bestLevel), histLevelMax); // 0..5
  const experience = Math.min(topHistory.length, 3); // 0..3

  // Score /100 pondere : completude 50%, niveau 35%, experience 15%.
  const score = Math.round(
    (completeness * 0.5)
    + ((lvl / 5) * 100 * 0.35)
    + ((experience / 3) * 100 * 0.15),
  );

  let rarity = RARITY.COMMON;
  if (score >= 85) rarity = RARITY.LEGENDARY;
  else if (score >= 65) rarity = RARITY.EPIC;
  else if (score >= 40) rarity = RARITY.RARE;

  return { completeness, rarity, score };
};

/**
 * Garde-fou mineurs.
 * @param {object} user
 * @param {Date} [now]
 * @returns {{ age: number|null, isMinor: boolean, requiresConsent: boolean, hasConsent: boolean, canPublish: boolean }}
 */
export const evaluateMinorGuard = (user = {}, now = new Date()) => {
  const age = computeAge(user.birthdate, now);
  const isMinor = age !== null && age < 18;
  const requiresConsent = age !== null && age < MINOR_CARD_PUBLISH_AGE;
  // Deux sources de consentement acceptees : la declaration parentale onboarding
  // (parentalDeclarationAccepted) OU le consentement carte specifique
  // (cardConsentAcceptedAt, champ optionnel a ajouter au schema).
  const hasConsent = Boolean(user.parentalDeclarationAccepted || user.cardConsentAcceptedAt);
  // Publication auto autorisee si adulte, OU mineur >=15, OU consentement present.
  const canPublish = age === null ? true : (!requiresConsent || hasConsent);
  return {
    age, canPublish, hasConsent, isMinor, requiresConsent,
  };
};

/**
 * Numero affiche sur la carte. Utilise user.jerseyNumber si present (champ a
 * ajouter cote schema, cf. diff), sinon derive un numero deterministe 1..99
 * a partir du documentId (stable, jamais aleatoire) pour ne jamais afficher vide.
 * @param {object} user
 * @returns {number}
 */
export const resolveJerseyNumber = (user = {}) => {
  const explicit = toInt(user.jerseyNumber);
  if (explicit !== null && explicit >= 0 && explicit <= 99) return explicit;
  const seed = String(user.documentId || user.username || user.firstname || 'FC');
  let hash = 0;
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 99) + 1; // 1..99
};

/**
 * Construit le modele d'affichage complet consomme par le composant RN PlayerCard.
 * @param {object} params
 * @param {object} params.user  userData Strapi (voir user schema)
 * @param {Array<object>} [params.histories]  user-histories brutes
 * @param {string} params.qrUrl  URL encodee dans le QR (profil public si visible, sinon install landing tracke)
 * @param {'coach'|'player'} [params.audience]
 * @param {Date} [params.now]
 * @returns {object} modele pret a rendre
 */
export const buildPlayerCardModel = ({
  audience = 'player', histories = [], now = new Date(), qrUrl = '', user = {},
} = {}) => {
  const topHistory = pickTopHistory(histories, 3);
  const age = computeAge(user.birthdate, now);
  const completeness = computeCompleteness(user, topHistory);
  const rarityInfo = computeRarity({ bestLevel: user.bestLevel, completeness, topHistory });
  const guard = evaluateMinorGuard(user, now);
  const city = extractCity(user.address);
  const hasPhoto = Boolean(user.avatar?.url || user.avatarUrl);
  const clubName = user.club?.name || '';
  // Un mineur sans consentement de publication ne montre jamais sa photo :
  // fallback dos floque impose (aligne garde-fou + defaut mineurs, cf. 00-PLAN Sec.8).
  const photoAllowed = guard.canPublish;
  const showPhoto = hasPhoto && photoAllowed;
  // Numero de maillot : toujours un chiffre (jerseyNumber saisi sinon derive
  // deterministe 1..99). Modifiable par l'utilisateur (bouton carte).
  const explicitNumber = toInt(user.jerseyNumber);
  const hasExplicitNumber = explicitNumber !== null && explicitNumber >= 0 && explicitNumber <= 99;
  const number = resolveJerseyNumber(user);

  return {
    age,
    audience,
    city,
    clubName,
    completeness,
    firstname: String(user.firstname || '').trim(),
    guard, // { age, isMinor, requiresConsent, hasConsent, canPublish }
    hasClub: Boolean(clubName),
    hasCustomNumber: hasExplicitNumber,
    hasPhoto: showPhoto,
    history: topHistory,
    isAvailable: Boolean(user.isLookingForClub),
    lastname: String(user.lastname || '').trim().toUpperCase(),
    nationality: String(user.nationality || '').trim(),
    number,
    photoUrl: showPhoto ? (user.avatar?.url || user.avatarUrl) : null,
    position: String(user.position || '').trim(),
    qrUrl,
    rarity: rarityInfo.rarity,
    rarityScore: rarityInfo.score,
    sport: String(user.preferredSport || '').trim(),
  };
};

export default buildPlayerCardModel;
