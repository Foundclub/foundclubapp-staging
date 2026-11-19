import { estDeCompetition } from '@/domains/activity/familleDuSport';
import { getPendingClubRequests, getProfileClubs } from '@/domains/auth/authUseCases';

/**
 * INSCRIPTION-CODE-3 (19/11/2026, planche V2 B1-B5, validée « ok ») — quel « Bienvenue » montrer.
 * - `joueurAvecClub` (B1) : un joueur d'un sport de compétition, avec un club (demandé ou
 *   rejoint) ;
 * - `sansClub` (B2) : un joueur ou un pratiquant sans club ;
 * - `pratiquant` (B3) : loisir, nature ou culture (`estDeCompetition` faux), avec un club ;
 * - `coach` (B4) ; `parent` (B5).
 * Dirigeant et super-admin n'ont pas de cas : leur écran d'aujourd'hui reste (null).
 * Une activité inconnue garde les mots de la compétition (`estDeCompetition` vrai).
 * @param {{ roleKey: string, userData: any }} entree Le rôle (getUserRoleKey) et le compte.
 * @returns {{ cas: string, club: any, enAttente: boolean, equipe: string | null } | null}
 *   Le cas, le club (demandé d'abord), s'il attend la réponse du club, et l'équipe du coach.
 */
export const casDeBienvenue = ({ roleKey, userData }) => {
  const vide = { club: null, enAttente: false, equipe: null };
  if (roleKey === 'parent') return { cas: 'parent', ...vide };
  if (roleKey === 'coach') {
    const demande = (Array.isArray(userData?.teamMembershipRequests)
      ? userData.teamMembershipRequests : [])
      .find((/** @type {any} */ d) => d?.direction !== 'invite' && d?.state === 'pending');
    return { cas: 'coach', ...vide, equipe: demande?.team?.name || null };
  }
  if (roleKey !== 'player') return null;
  const demandee = getPendingClubRequests(userData)[0]?.club || null;
  const club = demandee || getProfileClubs(userData)[0] || null;
  if (!club) return { cas: 'sansClub', ...vide };
  const cas = estDeCompetition(userData?.preferredSport) ? 'joueurAvecClub' : 'pratiquant';
  return {
    cas, club, enAttente: Boolean(demandee), equipe: null,
  };
};

export default casDeBienvenue;
