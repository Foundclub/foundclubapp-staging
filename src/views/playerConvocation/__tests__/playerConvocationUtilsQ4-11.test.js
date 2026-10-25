import {
  buildMatchCompositionPack,
  buildSlotsFromFormation,
} from '@/views/matchCallUp/matchCompositionUtils';
import { getMatchFormationByKey } from '@/views/matchCallUp/matchFormationCatalog';

import { buildPlayerConvocationView } from '../playerConvocationUtils';

// 🐞 Q4-11 (PERSISTANT P6-10) — LE JOUEUR LISAIT LE POSTE DU 4-3-3, QUELLE QUE SOIT LA FORMATION.
// Le correctif P6-10 lisait `placement.label`, que personne ne publie ; et le pack publiait
// les reperes du 4-3-3 par defaut au lieu de ceux de la compo type choisie. La chaine
// entiere est rejouee : le plateau du coach fabrique le pack, le joueur le lit.

/**
 * Le pack publie par le plateau pour une formation, un joueur pose sur un repere.
 * @param {string} cle la compo type (« 3-5-2 »…)
 * @param {number} index le repere ou le jeton est pose
 * @returns {{ pack: any, repere: any }}
 */
const publier = (cle, index) => {
  const formation = getMatchFormationByKey('football_11', null, cle);
  const slots = buildSlotsFromFormation(formation);
  const repere = slots[index];
  const pack = buildMatchCompositionPack({
    placements: [{
      playerId: 'p1',
      positionX: repere.positionX,
      positionY: repere.positionY,
      slotId: repere.slotId,
    }],
    players: [{ documentId: 'p1', position: '' }],
    slots,
    sport: 'football_11',
  });
  pack.snapshotPlayers = [{ documentId: 'p1', id: 'p1' }];
  return { pack, repere };
};

describe('🐞 Q4-11 — le joueur lit le poste de SA formation', () => {
  it('3-5-2 : le piston droit lit le libelle du 3-5-2, pas « DG »', () => {
    const { pack, repere } = publier('3-5-2', 4);
    const vue = buildPlayerConvocationView({ convocation: { published: pack }, userId: 'p1' });

    expect(repere.label).not.toBe('DG');
    expect(vue?.positionLabel).toBe(repere.label);
  });

  it('le pack publie les reperes de la compo type choisie', () => {
    const { pack } = publier('3-5-2', 4);
    const attendus = buildSlotsFromFormation(getMatchFormationByKey('football_11', null, '3-5-2'));

    expect(pack.teams[0].slots.map((s) => s.label)).toEqual(attendus.map((s) => s.label));
  });
});
