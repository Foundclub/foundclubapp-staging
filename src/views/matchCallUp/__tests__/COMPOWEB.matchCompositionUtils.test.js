import {
  buildFieldFromServerComposition,
  pickCompositionToEdit,
  readCalledUpIdsFromPack,
} from '../matchCompositionUtils';

// ==========================================================================
// COMPO-WEB (29/09) — LES TROIS LECTURES PARTAGEES DU PARCOURS.
//
// Le site relit la composition sur le serveur quand un ecran arrive par
// l'adresse. Pour qu'il n'y ait AUCUNE divergence de regle avec le telephone,
// il lit avec ces fonctions-ci, et pas avec une copie :
//   · `readCalledUpIdsFromPack` — SORTIE A L'IDENTIQUE de l'amorce de
//     `MatchCallUpSelection` (ses temoins restent verts, inchanges) ;
//   · `pickCompositionToEdit` — l'ordre de « Gerer la composition » ;
//   · `buildFieldFromServerComposition` — le terrain a rouvrir.
// ==========================================================================

const joueur = (id, firstname = `P${id}`, lastname = `N${id}`) => ({
  documentId: id, firstname, lastname,
});

describe('readCalledUpIdsFromPack — qui est convoque dans un pack', () => {
  test('forme v3 : titulaires, puis retenus, puis banc, sans doublon', () => {
    expect(readCalledUpIdsFromPack({
      reservePlayerIds: ['c', 'b'],
      selectedPlayerIds: ['a', 'b', 'c'],
      teams: [{ placements: [{ playerId: 'a' }] }],
    })).toEqual(['a', 'b', 'c']);
  });

  test('forme ancienne : les placements a la racine l emportent sur `teams`', () => {
    expect(readCalledUpIdsFromPack({
      placements: [{ playerId: 'x' }],
      teams: [{ placements: [{ playerId: 'y' }] }],
    })).toEqual(['x']);
  });

  test('COMPODBL : un identifiant qui ne designe pas une personne n est pas convoque', () => {
    expect(readCalledUpIdsFromPack({
      reservePlayerIds: ['134'],
      selectedPlayerIds: ['sma3', '134'],
      snapshotPlayers: [joueur('sma3'), { id: 134 }],
    })).toEqual(['sma3']);
  });

  test('rien a lire : liste vide', () => {
    expect(readCalledUpIdsFromPack(null)).toEqual([]);
    expect(readCalledUpIdsFromPack('texte')).toEqual([]);
  });
});

describe('pickCompositionToEdit — quel pack ouvrir pour composer', () => {
  const effectif = [joueur('a'), joueur('b')];

  test('le brouillon d abord, avec l effectif eligible', () => {
    const draft = { selectedPlayerIds: ['a'] };
    expect(pickCompositionToEdit({ draft, eligiblePlayers: effectif, published: { version: 1 } }))
      .toEqual({ existingComposition: draft, players: effectif });
  });

  test('sinon la compo publiee, avec son instantane', () => {
    const published = { snapshotPlayers: [joueur('a')], version: 2 };
    expect(pickCompositionToEdit({ eligiblePlayers: effectif, published }))
      .toEqual({ existingComposition: published, players: published.snapshotPlayers });
  });

  test('sinon le point de depart du serveur', () => {
    const composition = { placements: [] };
    expect(pickCompositionToEdit({ bootstrap: { composition }, eligiblePlayers: effectif }))
      .toEqual({ existingComposition: composition, players: effectif });
    expect(pickCompositionToEdit({}).existingComposition).toBeNull();
  });
});

describe('buildFieldFromServerComposition — le terrain a rouvrir', () => {
  test('un brouillon SANS instantane : l effectif eligible sert d annuaire', () => {
    const a = joueur('a');
    const b = joueur('b');
    const terrain = buildFieldFromServerComposition({
      draft: {
        reservePlayerIds: ['b'],
        selectedPlayerIds: ['a', 'b'],
        teams: [{
          placements: [{
            playerId: 'a', positionX: 50, positionY: 88, slotId: 's1',
          }],
        }],
      },
      eligiblePlayers: [a, b],
    });

    expect(terrain.selectedPlayers).toEqual([a, b]);
    expect(terrain.startPlacements).toEqual([{
      playerId: 'a', positionX: 50, positionY: 88, slotId: 's1',
    }]);
    expect(terrain.missingPlayerIds).toEqual([]);
  });

  test('un joueur hors app est retrouve dans le pack lui-meme', () => {
    const horsApp = {
      documentId: 'manual-1', firstname: 'Zoe', isManual: true, lastname: 'Roux',
    };
    const terrain = buildFieldFromServerComposition({
      eligiblePlayers: [],
      published: { manualPlayers: [horsApp], reservePlayerIds: ['manual-1'], teams: [] },
    });
    expect(terrain.selectedPlayers).toEqual([horsApp]);
  });

  test('🔒 un convoque introuvable est NOMME, jamais lache en silence', () => {
    const terrain = buildFieldFromServerComposition({
      draft: { selectedPlayerIds: ['a', 'fantome'], teams: [] },
      eligiblePlayers: [joueur('a')],
    });
    expect(terrain.missingPlayerIds).toEqual(['fantome']);
    expect(terrain.selectedPlayers.map((p) => p.documentId)).toEqual(['a']);
  });

  test('🔒 sans brouillon ni compo publiee : terrain VIDE (jamais le depart propose)', () => {
    const terrain = buildFieldFromServerComposition({
      bootstrap: { composition: { selectedPlayerIds: ['a'] } },
      eligiblePlayers: [joueur('a')],
    });
    expect(terrain).toEqual({
      existingComposition: null, missingPlayerIds: [], selectedPlayers: [], startPlacements: [],
    });
  });
});
