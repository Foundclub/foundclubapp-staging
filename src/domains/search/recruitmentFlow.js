import { getUserRoleKey } from '@/domains/auth/authUseCases';

import coordonneesDeLaVille from '@/components/organisms/filtersSheet/cityCoordinates';

// D57 — Rechercher EXPLORE, « Mes activites » GERE. Deux onglets de gestion ont
// donc quitte cette liste : « Mes annonces » (staff) est repris par
// « Mes activites › Publications », et « Mes candidatures » (joueur) par
// « Mes activites › Mes reponses » — les DEUX lisent exactement la meme source
// que l'onglet retire (getMyRecruitmentAds et getMyApplications).
//
// ⛔ « candidatures » RESTE cote staff, et ce n'est pas un oubli : cet onglet
// montre les offres auxquelles le dirigeant a LUI-MEME postule
// (getMyApplications), or MyActivitiesScreen ne les charge JAMAIS pour un staff
// — il lui montre les reponses RECUES. Le retirer supprimerait un acces sans
// remplacant.
export const STAFF_RECRUITMENT_TABS = /** @type {const} */ ([
  'profils',
  'opportunites',
  'candidatures',
]);

export const PLAYER_RECRUITMENT_TABS = /** @type {const} */ ([
  'annonces',
]);

export const VALID_RECRUITMENT_TABS = /** @type {const} */ ([
  ...STAFF_RECRUITMENT_TABS,
  ...PLAYER_RECRUITMENT_TABS,
]);

const getRoleName = (userOrRole) => {
  if (typeof userOrRole === 'string') return userOrRole;
  if (userOrRole?.role?.name) return userOrRole.role.name;
  if (userOrRole?.name) return userOrRole.name;
  return '';
};

export const getRecruitmentRoleMode = (userOrRole) => {
  const roleKey = getUserRoleKey(getRoleName(userOrRole));
  if (roleKey === 'coach' || roleKey === 'president' || roleKey === 'superAdmin') {
    return 'staff';
  }
  return 'player';
};

export const canAccessRecruitmentProfiles = (userOrRole) => (
  getRecruitmentRoleMode(userOrRole) === 'staff'
);

export const getAllowedRecruitmentTabs = (userOrRole) => (
  canAccessRecruitmentProfiles(userOrRole) ? STAFF_RECRUITMENT_TABS : PLAYER_RECRUITMENT_TABS
);

export const getDefaultRecruitmentTab = (userOrRole) => (
  canAccessRecruitmentProfiles(userOrRole) ? 'profils' : 'annonces'
);

export const sanitizeRecruitmentTabForRole = (tab, userOrRole, fallbackTab = undefined) => {
  const allowedTabs = getAllowedRecruitmentTabs(userOrRole);
  const normalizedTab = typeof tab === 'string' ? tab.trim().toLowerCase() : '';
  if (allowedTabs.includes(
    /** @type {'annonces' | 'candidatures' | 'opportunites' | 'profils'} */ (normalizedTab),
  )) {
    return /** @type {'annonces' | 'candidatures' | 'opportunites' | 'profils'} */ (normalizedTab);
  }

  if (fallbackTab && allowedTabs.includes(fallbackTab)) {
    return fallbackTab;
  }

  return getDefaultRecruitmentTab(userOrRole);
};

export const getAppliedFilterCount = (filters, excludedKeys = []) => Object.entries(filters || {}).filter(([key, value]) => {
  if (excludedKeys.includes(key)) return false;
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Boolean(value?.value || value?.label || value?.documentId || value?.id);
  return true;
}).length;

/**
 * C04 Q3-15 — le compteur des filtres de la liste des profils. La feuille écrit chaque critère
 * sous plusieurs clés (`activity`, `activityIds`, `activityNames`…) et pose toujours le rayon :
 * compter les clés donnait 1 sans rien choisir et 4 pour un seul sport. On compte les 4 critères,
 * lus comme la recherche les lit.
 * @param {Record<string, any> | null | undefined} filters
 * @returns {number}
 */
export const getProfileFilterCount = (filters) => getAppliedFilterCount({
  activity: filters?.activityNames || filters?.activity,
  category: filters?.sectionIds || filters?.category,
  geohash: filters?.geohash,
  position: filters?.positions || filters?.position,
});

/**
 * PHASE3C02 · Q2-04 — les paramètres de la liste des profils (RecruitmentProfilesList). La ville
 * choisie donne aussi le point et le rayon : /search/profiles filtre alors à la vraie distance.
 * @param {Record<string, any> | null | undefined} filters - `mercatoFilters`.
 * @param {string} searchValue - Le texte tapé.
 * @returns {Record<string, any>}
 */
export const parametresDeRechercheDeProfils = (filters, searchValue) => {
  const texte = String(searchValue || '').trim();
  const coordonnees = coordonneesDeLaVille(filters?.city);
  return {
    activity: filters?.activityNames || filters?.activity,
    category: filters?.sectionIds || filters?.category,
    geohash: filters?.geohash,
    ...(coordonnees ? { lat: coordonnees.lat, lon: coordonnees.lon, radius: filters?.radius } : {}),
    position: filters?.positions || filters?.position,
    ...(texte.length >= 2 ? { q: texte, sort: 'relevance' } : { sort: 'date' }),
  };
};
