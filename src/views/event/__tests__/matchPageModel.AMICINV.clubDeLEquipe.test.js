import { resolveCompositionClubId } from '../matchPageModel';

// 🤝 AMIC-INVITE (19/10, APRÈS 149) — le club de l'équipe qu'on compose, la règle seule.
// Les témoins d'écran (fiche du match, site, sélection des convoqués) prouvent les portes ;
// ce fichier fige les quatre cas de la règle, dont les deux replis qu'aucun écran ne montre.

const MATCH = {
  club: { documentId: 'club-evenement' },
  invitedTeams: [
    { club: { documentId: 'club-valbrune' }, documentId: 'team-valbrune' },
    { documentId: 'team-sans-club' },
  ],
  team: { club: { documentId: 'club-montrivage' }, documentId: 'team-montrivage' },
};

/**
 * Le club que la règle donne à cette équipe du match.
 * @param {string} teamId - L équipe composée.
 * @returns {string} Son club.
 */
const clubDe = (teamId) => resolveCompositionClubId({ event: MATCH, teamId });

describe('AMIC-INVITE — resolveCompositionClubId', () => {
  test('l équipe hôte (ou aucune équipe nommée) : le club de l hôte', () => {
    expect(clubDe('team-montrivage')).toBe('club-montrivage');
    expect(resolveCompositionClubId({ event: MATCH })).toBe('club-montrivage');
  });

  test('une équipe invitée : le club de CETTE équipe, jamais celui de l hôte', () => {
    expect(clubDe('team-valbrune')).toBe('club-valbrune');
  });

  test('🔒 une invitée sans club connu : vide (club affiché), pas le club de l hôte', () => {
    expect(clubDe('team-sans-club')).toBe('');
  });

  test('équipe inconnue ou événement pas encore chargé : comportement d avant', () => {
    expect(clubDe('team-inconnue')).toBe('club-montrivage');
    expect(resolveCompositionClubId({ event: null, teamId: 'team-valbrune' })).toBe('');
    expect(resolveCompositionClubId({
      event: { club: { documentId: 'club-evenement' }, team: { documentId: 't' } },
      teamId: 't',
    })).toBe('club-evenement');
  });
});
