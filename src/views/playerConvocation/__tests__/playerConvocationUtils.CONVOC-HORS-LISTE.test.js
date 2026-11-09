// CONVOC-HORS-LISTE (07/11) — « le lecteur est-il laisse dehors par la convocation
// publiee de SON equipe ? ». Une seule regle, lue par la fiche du match (telephone
// et site) pour confier au non-convoque la phrase « tu peux te marquer present ».

import { estHorsDeSaConvocation } from '../playerConvocationUtils';

const TEAM_ID = 'team-1';
const PACK = {
  reservePlayerIds: ['joueur-2'],
  teams: [{ id: 'team_1', placements: [{ playerId: 'joueur-1' }] }],
};
const CONVOCATION = { branches: [{ published: PACK, team: { documentId: TEAM_ID } }] };

describe('estHorsDeSaConvocation', () => {
  test('membre de l equipe, ni au terrain ni au banc : dehors', () => {
    expect(estHorsDeSaConvocation(CONVOCATION, TEAM_ID, 'joueur-9')).toBe(true);
  });

  test('🔒 titulaire ou remplacant : pas dehors', () => {
    expect(estHorsDeSaConvocation(CONVOCATION, TEAM_ID, 'joueur-1')).toBe(false);
    expect(estHorsDeSaConvocation(CONVOCATION, TEAM_ID, 'joueur-2')).toBe(false);
  });

  test('🔒 rien de publie : personne n est dehors', () => {
    expect(estHorsDeSaConvocation(null, TEAM_ID, 'joueur-9')).toBe(false);
    expect(estHorsDeSaConvocation({ branches: [] }, TEAM_ID, 'joueur-9')).toBe(false);
  });

  test('🔒 seule l autre equipe a publie : ce n est pas SA convocation', () => {
    const adverse = { branches: [{ published: PACK, team: { documentId: 'team-adverse' } }] };

    expect(estHorsDeSaConvocation(adverse, TEAM_ID, 'joueur-9')).toBe(false);
  });

  test('🔒 sans equipe ou sans lecteur : on ne sait pas, donc non', () => {
    expect(estHorsDeSaConvocation(CONVOCATION, '', 'joueur-9')).toBe(false);
    expect(estHorsDeSaConvocation(CONVOCATION, TEAM_ID, '')).toBe(false);
  });

  test('l ancienne forme a plat (`published` + `team`) se lit aussi', () => {
    const aPlat = { published: PACK, team: { documentId: TEAM_ID } };

    expect(estHorsDeSaConvocation(aPlat, TEAM_ID, 'joueur-9')).toBe(true);
  });
});
