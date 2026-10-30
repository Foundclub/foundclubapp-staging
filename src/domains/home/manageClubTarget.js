import { RouteNames } from '@/navigation/routeNames';

/**
 * RWDIRIG3 (30/10/2026) — où mène « Gérer mon club » sur l'accueil.
 * Un dirigeant sans club va à la création de son club : sans cela, aucun bouton
 * n'y menait une fois l'inscription fermée (bandeau « Contexte manquant »).
 * L'étape 1 vérifie que le club n'existe pas déjà.
 * @param {{ clubId?: string | null, cmId?: string | null, isPresident: boolean }} contexte
 *   Le compte.
 * @returns {{ name: string, params: object } | null} L'écran à ouvrir, ou null (rien à ouvrir).
 */
export const resolveManageClubTarget = ({ clubId, cmId, isPresident }) => {
  if (clubId) {
    return { name: RouteNames.ClubStack, params: { params: { clubId }, screen: RouteNames.Club } };
  }
  if (cmId) {
    return { name: RouteNames.CMDashboard, params: { cmId } };
  }
  if (isPresident) {
    return {
      name: RouteNames.ClubStack,
      params: { params: { entry: 'search' }, screen: RouteNames.ClubWizardName },
    };
  }
  return null;
};
