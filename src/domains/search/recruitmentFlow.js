import { getUserRoleKey } from '@/domains/auth/authUseCases';

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
