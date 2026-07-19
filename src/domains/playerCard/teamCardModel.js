// @ts-nocheck
/**
 * Logique PURE de la carte EQUIPE (variante Strategie 9).
 * Destination repo : app/src/domains/playerCard/teamCardModel.js
 *
 * La carte equipe ne montre jamais de visages : la zone visuelle est une grille
 * de "dos floques" (nom + numero). Elle affiche un bloc RECRUTE alimente par les
 * annonces de recrutement liees (recruitment-ad), issues des detections.
 * Terminologie imposee : "detections / seances d'essai".
 *
 * Testable en isolation : voir teamCardModel.test.js.
 */
import { computeRarity, RARITY } from './cardModel';

const CARD_MAX_BACKS = 6; // nb de dos floques affiches dans la grille visuelle

const toInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const COACH_ROLE_LABELS = {
  analyste_video: 'Analyste vidéo',
  entraineur_adjoint: 'Entraîneur adjoint',
  entraineur_gardiens: 'Entraîneur des gardiens',
  entraineur_principal: 'Entraîneur principal',
  other: 'Encadrement',
  preparateur_physique: 'Préparateur physique',
  team_manager: 'Team manager',
};

/**
 * Numero de dos deterministe 1..99 pour un membre (jamais aleatoire, jamais vide).
 * @param {object} member
 * @param {number} index
 * @returns {number}
 */
export const resolveMemberNumber = (member = {}, index = 0) => {
  const explicit = toInt(member.jerseyNumber);
  if (explicit !== null && explicit >= 0 && explicit <= 99) return explicit;
  const seed = String(member.documentId || member.lastname || member.firstname || `m${index}`);
  let hash = 0;
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 99) + 1;
};

/**
 * Transforme la liste des joueurs de l'equipe en "dos floques" (nom + numero),
 * limitee a CARD_MAX_BACKS. Aucun visage, aucune photo.
 * @param {Array<object>} players
 * @param {number} [limit]
 * @returns {Array<{ name: string, number: number }>}
 */
export const buildTeamBacks = (players, limit = CARD_MAX_BACKS) => {
  const source = Array.isArray(players) ? players : [];
  return source.slice(0, limit).map((p, i) => ({
    name: String(p?.lastname || p?.username || '').trim().toUpperCase() || 'JOUEUR',
    number: resolveMemberNumber(p, i),
  }));
};

const isAdActive = (ad, now) => {
  if (ad?.isActive === false) return false;
  if (ad?.status && String(ad.status).toLowerCase() !== 'active' && String(ad.status).toLowerCase() !== 'published') {
    // certains schemas utilisent un status; on reste permissif si absent
  }
  if (ad?.expirationDate) {
    const exp = new Date(ad.expirationDate);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) return false;
  }
  return true;
};

/**
 * Construit les entrees du bloc RECRUTE a partir des annonces de recrutement liees.
 * Une entree par poste recherche (player -> position, coach -> coachRole libelle),
 * avec la quantite. Deduplique/agrege par libelle.
 * @param {Array<object>} recruitmentAds annonces recruitment-ad liees a l'equipe/detection
 * @param {Date} [now]
 * @returns {Array<{ label: string, quantity: number, audienceType: 'player'|'coach' }>}
 */
export const buildRecruitingNeeds = (recruitmentAds, now = new Date()) => {
  const source = Array.isArray(recruitmentAds) ? recruitmentAds : [];
  const buckets = new Map();

  source.filter((ad) => isAdActive(ad, now)).forEach((ad) => {
    const audienceType = ad?.audienceType === 'coach' ? 'coach' : 'player';
    let label = '';
    if (audienceType === 'coach') {
      label = ad?.coachRole === 'other' && ad?.coachRoleOther
        ? String(ad.coachRoleOther).trim()
        : (COACH_ROLE_LABELS[ad?.coachRole] || 'Encadrement');
    } else {
      label = String(ad?.position || '').trim() || 'Joueur';
    }
    const key = `${audienceType}:${label.toLowerCase()}`;
    const qty = Math.max(1, toInt(ad?.quantity) || 1);
    const prev = buckets.get(key);
    if (prev) {
      prev.quantity += qty;
    } else {
      buckets.set(key, { audienceType, label, quantity: qty });
    }
  });

  return Array.from(buckets.values());
};

/**
 * Construit le modele d'affichage de la carte equipe.
 * @param {object} params
 * @param {object} params.team objet team (name, club, activities, players/members)
 * @param {Array<object>} [params.players] joueurs (sinon derives de team.players)
 * @param {Array<object>} [params.recruitmentAds] annonces liees (detections)
 * @param {string} [params.qrUrl]
 * @param {Date} [params.now]
 * @returns {object}
 */
export const buildTeamCardModel = ({
  now = new Date(), players, qrUrl = '', recruitmentAds = [], team = {},
} = {}) => {
  const roster = Array.isArray(players) && players.length
    ? players
    : (team?.players || team?.members || []);
  const backs = buildTeamBacks(roster);
  const needs = buildRecruitingNeeds(recruitmentAds, now);
  const clubName = team?.club?.name || '';
  const sport = team?.activities?.[0]?.name || team?.sport || '';
  const city = team?.club?.city || team?.city || '';
  const rosterCount = Array.isArray(roster) ? roster.length : 0;

  // Rarete de l'equipe : reutilise le meme moteur, entree = taille effectif +
  // presence d'un besoin de recrutement actif (equipe vivante).
  const pseudoCompleteness = Math.min(100, rosterCount * 12 + (needs.length ? 20 : 0) + (clubName ? 10 : 0));
  const rarityInfo = computeRarity({
    bestLevel: team?.level?.name || '',
    completeness: pseudoCompleteness,
    topHistory: [],
  });

  return {
    audience: 'team',
    backs, // grille de dos floques
    city: String(city || '').trim(),
    clubName,
    hasClub: Boolean(clubName),
    isRecruiting: needs.length > 0,
    qrUrl,
    rarity: rarityInfo.rarity,
    rarityScore: rarityInfo.score,
    recruitingNeeds: needs, // bloc "RECRUTE . Séances D'ESSAI"
    rosterCount,
    sport: String(sport || '').trim(),
    teamName: String(team?.name || '').trim().toUpperCase(),
  };
};

export { RARITY };
export default buildTeamCardModel;
