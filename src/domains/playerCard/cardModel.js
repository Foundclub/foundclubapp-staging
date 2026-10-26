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
  // Une date nue YYYY-MM-DD se lit en heure locale (sinon minuit UTC = la veille outre-mer).
  const jour = typeof birthdate === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  let dob = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (jour) dob = new Date(Number(jour[1]), Number(jour[2]) - 1, Number(jour[3]));
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
 * CARTECODE (registre des mineurs ligne 42) — la ville de la carte, avec son code postal
 * (« Aix-en-Provence 13090 ») ; jamais l'adresse.
 * @param {any} address
 * @returns {string}
 */
export const extractCityWithPostcode = (address) => {
  const city = extractCity(address);
  if (!city) return '';
  let raw = address;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (_e) { return city; }
  }
  const postcode = String(raw?.postcode || raw?.zipCode || '').trim();
  return [city, postcode].filter(Boolean).join(' ');
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
    // CARTECODE Q4 A — le serveur joint le logo ; un club tapé à la main n'en a jamais.
    clubLogoUrl: h?.club?.logo?.url || h?.multisport_club?.logo?.url || null,
    clubName: h?.club?.name || h?.multisport_club?.name || h?.customClubName || '',
    endYear: toInt(h?.endYear),
    isCurrentlyActive: Boolean(h?.isCurrentlyActive),
    level: h?.level?.name || '',
    startYear: toInt(h?.startYear),
  }));
};

const sansCasse = (nom) => String(nom || '').trim().toLowerCase();

/**
 * PAR-L14 — l'historique de la carte, UNE ligne par club et par saison.
 * L'assistant de parcours cree une entree par categorie cochee
 * (HistoryWizardSingle) : « Sporting Club, 2020-2022, Seniors » puis « … U20 »,
 * deux lignes identiques a l'oeil sur la carte, qui n'en montrait que le niveau.
 * On les reunit A L'AFFICHAGE (les donnees ne changent pas) : niveaux et
 * categories cumules dans l'ordre, sans doublon. Meme tri que pickTopHistory.
 * @param {Array<object>} histories user-histories brutes
 * @returns {Array<{ categories: string[], clubName: string, endYear: number|null,
 *   isCurrentlyActive: boolean, levels: string[], startYear: number|null }>}
 */
export const groupHistory = (histories) => {
  const groupes = new Map();
  pickTopHistory(histories, Infinity).forEach((h, rang) => {
    const fin = h.isCurrentlyActive ? 'actif' : h.endYear;
    // Un club supprime n'a plus de nom : deux clubs supprimes ne sont pas le meme club.
    const club = sansCasse(h.clubName) || `sans-nom-${rang}`;
    const cle = [club, h.startYear, fin].join('|');
    const groupe = groupes.get(cle) || {
      categories: [],
      clubLogoUrl: h.clubLogoUrl,
      clubName: h.clubName,
      endYear: h.endYear,
      isCurrentlyActive: h.isCurrentlyActive,
      levels: [],
      startYear: h.startYear,
    };
    const ajouter = (liste, valeur) => {
      const deja = [...groupe.levels, ...groupe.categories].map(sansCasse);
      if (valeur && !deja.includes(sansCasse(valeur))) liste.push(valeur);
    };
    ajouter(groupe.levels, h.level);
    ajouter(groupe.categories, h.category);
    groupes.set(cle, groupe);
  });
  return [...groupes.values()];
};

/**
 * PAR-L14 — le compteur de la carte compte des CLUBS, pas des lignes.
 * @param {Array<object>} histories user-histories brutes
 * @returns {number} clubs distincts (nom sans casse ni espaces autour) ; une entree dont le
 *   club a ete supprime (plus de nom) compte pour un club, comme sa ligne sur la carte.
 */
export const countHistoryClubs = (histories) => {
  const noms = pickTopHistory(histories, Infinity).map((h) => sansCasse(h.clubName));
  return new Set(noms.filter(Boolean)).size + noms.filter((nom) => !nom).length;
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

const RARITY_FLOORS = [[85, RARITY.LEGENDARY], [65, RARITY.EPIC], [40, RARITY.RARE]];

// ponytail: copie de SPORTS_WITH_POSITIONS (constants/positions.js) — ce module reste SANS
// dependance projet, le serveur le charge tel quel (SECUEVENT-verifications-age). Sortie : un
// temoin compare les deux listes (cardModel.CARTECODE.test.js).
export const CARD_SPORTS_WITH_POSITIONS = [
  'football', 'basketball', 'handball', 'volleyball', 'rugby',
];
const sportHasPositions = (sport) => CARD_SPORTS_WITH_POSITIONS
  .includes(String(sport || '').toLowerCase());

/** CARTECODE Q5 B — les 13 cases de la carte. */
export const CARD_FILL_TOTAL = 13;

const isJersey = (value) => {
  const n = toInt(value);
  return n !== null && n >= 0 && n <= 99;
};

/**
 * CARTECODE Q5 B — combien des 13 cases de la carte sont remplies : photo, nom, âge, section,
 * poids, taille, niveau, catégorie, sport, poste, nationalité, numéro, ville.
 * Un sport sans poste (tennis…) compte la case du poste comme remplie.
 * @param {object} user
 * @returns {number} 0..13
 */
export const countCardFill = (user = {}) => [
  user.avatar?.url || user.avatarUrl,
  user.firstname && user.lastname,
  user.birthdate,
  user.section?.name || user.section?.documentId
    || (typeof user.section === 'string' && user.section),
  user.weight,
  user.height,
  user.bestLevel,
  user.category,
  user.preferredSport,
  user.position || (user.preferredSport && !sportHasPositions(user.preferredSport)),
  user.nationality,
  isJersey(user.jerseyNumber),
  extractCity(user.address),
].filter(Boolean).length;

/**
 * CARTECODE Q5 B — la rareté de la carte joueur : remplissage 50, parcours 15 (5 par club
 * déclaré, jusqu'à 3), vie dans FoundClub 35 (membre d'une équipe 10, 5 matchs 10, 20 matchs
 * 15 de plus). Jamais les présences, les notes ni les avis. Paliers : < 40 commune,
 * 40-64 rare, 65-84 épique, ≥ 85 légendaire.
 * @param {{ clubCount?: number, fill?: number, isTeamMember?: boolean, matchCount?: number }} args
 * @returns {{ rarity: string, score: number }}
 */
export const computeCardRarity = ({
  clubCount = 0, fill = 0, isTeamMember = false, matchCount = 0,
} = {}) => {
  const score = Math.round((Math.min(fill, CARD_FILL_TOTAL) / CARD_FILL_TOTAL) * 50)
    + (Math.min(clubCount, 3) * 5)
    + (isTeamMember ? 10 : 0)
    + (matchCount >= 5 ? 10 : 0)
    + (matchCount >= 20 ? 15 : 0);
  const palier = RARITY_FLOORS.find(([seuil]) => score >= seuil);
  return { rarity: palier ? palier[1] : RARITY.COMMON, score };
};

/**
 * CARTECODE Q3 A — la bande du club : le club du compte, sinon celui de son équipe principale ;
 * l'équipe dessous. Le logo, s'il existe (sinon le dessin pose le shield aux initiales).
 * @param {object} user
 * @returns {{ logoUrl: string|null, name: string, teamName: string } | null}
 */
export const resolveCardClub = (user = {}) => {
  const teams = Array.isArray(user.myTeams) ? user.myTeams : [];
  const clubId = user.club?.documentId;
  const team = (clubId && teams.find((t) => t?.club?.documentId === clubId)) || teams[0] || null;
  const club = user.club?.name ? user.club : team?.club;
  const name = String(club?.name || '').trim();
  if (!name) return null;
  return { logoUrl: club?.logo?.url || null, name, teamName: String(team?.name || '').trim() };
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
 * Construit le modele d'affichage complet consomme par le composant RN PlayerCard.
 * @param {object} params
 * @param {object} params.user  userData Strapi (voir user schema)
 * @param {Array<object>} [params.histories]  user-histories brutes
 * @param {string} params.qrUrl  URL encodee dans le QR (profil public si visible, sinon install landing tracke)
 * @param {'coach'|'player'} [params.audience]
 * @param {number} [params.matchCount] matchs joués (rareté, vie dans FoundClub)
 * @param {Date} [params.now]
 * @returns {object} modele pret a rendre
 */
export const buildPlayerCardModel = ({
  audience = 'player', histories = [], matchCount = 0, now = new Date(), qrUrl = '', user = {},
} = {}) => {
  const topHistory = pickTopHistory(histories, 3);
  const age = computeAge(user.birthdate, now);
  const fill = countCardFill(user);
  const historyClubCount = countHistoryClubs(histories);
  const rarityInfo = computeCardRarity({
    clubCount: historyClubCount,
    fill,
    isTeamMember: Array.isArray(user.myTeams) && user.myTeams.length > 0,
    matchCount,
  });
  const guard = evaluateMinorGuard(user, now);
  const city = extractCityWithPostcode(user.address);
  const hasPhoto = Boolean(user.avatar?.url || user.avatarUrl);
  const club = resolveCardClub(user);
  const clubName = club?.name || '';
  // Un mineur sans consentement de publication ne montre jamais sa photo :
  // fallback dos floque impose (aligne garde-fou + defaut mineurs, cf. 00-PLAN Sec.8).
  const photoAllowed = guard.canPublish;
  const showPhoto = hasPhoto && photoAllowed;
  // CARTECODE — le numéro saisi, sinon AUCUN : il n'est plus jamais fabriqué (le « 52 »).
  const number = isJersey(user.jerseyNumber) ? toInt(user.jerseyNumber) : null;

  return {
    age,
    audience,
    city,
    club,
    clubName,
    completeness: Math.round((fill / CARD_FILL_TOTAL) * 100),
    fill,
    firstname: String(user.firstname || '').trim(),
    guard, // { age, isMinor, requiresConsent, hasConsent, canPublish }
    hasClub: Boolean(clubName),
    hasCustomNumber: number !== null,
    hasPhoto: showPhoto,
    // `history` (3 lignes brutes) nourrit la rarete et la completude, inchangees.
    // La carte AFFICHE `historyGroups` et compte `historyClubCount` (PAR-L14).
    history: topHistory,
    historyClubCount,
    historyGroups: groupHistory(histories),
    isAvailable: Boolean(user.isLookingForClub),
    isPrivate: user.isProfileVisible === false,
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

/**
 * PAR-L13 (13/10, design parent E28 et E29) — la carte d'un ENFANT DÉCLARÉ (moins de 13 ans),
 * « pareille que les autres » (décision d'Adel du 12/10, registre des mineurs ligne 23) : les
 * props de `PlayerCard`, tirées de la fiche que rend le serveur (prénom, nom, ÂGE — jamais la
 * date —, équipe, club, numéro, poste, photo, ville, nationalité).
 *  - JAMAIS de code QR ni de lien : aucune `qrValue` (la case reste « FC »).
 *  - AUCUN statut : « disponible » n'existe pas pour une fiche.
 *  - Numéro « ? » tant qu'il n'est pas choisi (le dos de maillot le porte aussi).
 *  - Rareté COMMUNE (la maquette) : la rareté d'un adulte mesure un profil et un parcours
 *    qu'une fiche n'a pas.
 * @param {object} params
 * @param {object} [params.enfant] la fiche (`GET /declared-children/mine`)
 * @param {{ noTeam?: string, years?: string }} [params.libelles] « Pas encore d'équipe », « ANS »
 * @param {Record<string, unknown> | null} [params.saisie] ce que le parent tape (E28) : passe
 *   devant la fiche, la carte se remplit
 * @returns {object} les props de la carte, plus `photoUrl` (à résoudre par l'écran)
 */
export const buildDeclaredChildCardProps = ({ enfant = {}, libelles = {}, saisie = null } = {}) => {
  const lire = (cle) => String((saisie && cle in saisie ? saisie[cle] : enfant[cle]) ?? '').trim();
  const equipe = [enfant.team?.name, enfant.club?.name]
    .map((nom) => String(nom || '').trim())
    .filter(Boolean)
    .join(' · ');
  const team = enfant.team || {};
  return {
    age: typeof enfant.age === 'number' ? `${enfant.age} ${libelles.years || 'ANS'}` : '',
    // CARTECODE Q7 B — les cases qu'apporte son équipe ; ni taille ni poids, aucun champ neuf.
    categorie: String(team.category || '').trim(),
    equipe: equipe || libelles.noTeam || '',
    nationalite: lire('nationality'),
    niveau: String(team.level || '').trim(),
    nom: String(enfant.lastname || '').trim().toUpperCase(),
    numero: lire('number') || '?',
    photoUrl: enfant.photo?.url || null,
    poste: lire('position'),
    prenom: String(enfant.firstname || '').trim(),
    rarity: 'COMMON',
    section: String(team.section || '').trim(),
    sport: String(team.sport || '').trim(),
    statut: null,
    ville: lire('city'),
  };
};

export default buildPlayerCardModel;
