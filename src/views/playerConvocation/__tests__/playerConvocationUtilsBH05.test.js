import { buildPlayerConvocationView } from '../playerConvocationUtils';

// BH05 · P6-10 — formation du catalogue (3-5-2) : le poste vient du libelle du
// placement, pas de la table du 4-3-3 par defaut.
describe('BH05 — P6-10 poste du joueur convoque', () => {
  test('3-5-2, slot_5 libelle « MD » : le joueur lit MD, pas DG', () => {
    const vue = buildPlayerConvocationView({
      convocation: {
        published: {
          reservePlayerIds: [],
          snapshotPlayers: [{ documentId: 'joueur-1', firstname: 'Jean', position: 'Ailier' }],
          teams: [{
            id: 'team_1',
            name: 'Senior 1',
            placements: [{
              label: 'MD', playerId: 'joueur-1', positionX: 50, positionY: 50, slotId: 'team_1:slot_5',
            }],
          }],
        },
        responses: { byPlayerId: {} },
        team: { documentId: 'team-1', name: 'Senior 1' },
      },
      userId: 'joueur-1',
    });
    expect(vue?.positionLabel).toBe('MD');
  });
});
