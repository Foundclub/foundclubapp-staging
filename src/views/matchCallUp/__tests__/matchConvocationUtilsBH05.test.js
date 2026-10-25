import { buildPlayerIndex } from '../matchConvocationUtils';

// BH05 · P6-12 — un remplacant connu seulement par `reserveSnapshotPlayers`
// doit garder son nom dans le recapitulatif et l'amendement.
describe('BH05 — P6-12 index des joueurs', () => {
  test('les remplacants de reserveSnapshotPlayers sont indexes', () => {
    const index = buildPlayerIndex({
      reserveSnapshotPlayers: [{ documentId: 'remp-1', firstname: 'Paul' }],
      snapshotPlayers: [{ documentId: 'joueur-1', firstname: 'Jean' }],
    });
    expect(index.get('remp-1')?.firstname).toBe('Paul');
  });
});
