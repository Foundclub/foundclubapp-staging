// @ts-nocheck
import renderer, { act } from 'react-test-renderer';

import TacticalBoardEntry from './TacticalBoardEntry';

// D27 (E6) : TacticalBoardEntry.js fait 19 lignes, n'avait AUCUN test, et c'est
// pourtant lui qui decide, a chaque ouverture, si l'utilisateur voit l'ANCIEN
// board de composition ou le NOUVEAU (celui avec le glisser-deposer).
//
// Ce fichier fige le comportement AVANT toute modification de l'aiguillage. Il
// est pilote par le TEXTE rendu par chacun des deux boards (tous deux moques),
// jamais par la forme de l'arbre : l'aiguillage doit pouvoir etre reecrit sans
// qu'une seule ligne d'ici ne bouge.
//
// INVARIANT PROTEGE : les 7 portes d'entree existantes menent au NOUVEAU board.
// Ce sont les utilisateurs qui ont deja une composition ; on ne doit RIEN leur
// casser. Le seul cas dont le sens change volontairement dans ce lot est celui
// d'une composition NEUVE (aucun parametre exploitable).

/** @type {any} */
let mockRouteParams;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('./MultiTeamCompositionBoard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'NOUVEAU BOARD'),
  };
});

jest.mock('./TacticalBoard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'ANCIEN BOARD'),
  };
});

/**
 * Rend l'aiguillage avec les params de route donnes et rapporte le board obtenu.
 * @param {any} params
 * @returns {'NOUVEAU' | 'ANCIEN' | 'AUCUN'}
 */
const boardOuvertAvec = (params) => {
  mockRouteParams = params;
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<TacticalBoardEntry />);
  });
  const rendu = JSON.stringify(arbre.toJSON());
  act(() => {
    arbre.unmount();
  });
  if (rendu.includes('NOUVEAU BOARD')) return 'NOUVEAU';
  if (rendu.includes('ANCIEN BOARD')) return 'ANCIEN';
  return 'AUCUN';
};

describe('TacticalBoardEntry — les portes vers le NOUVEAU board', () => {
  // Les 7 portes d'entree de inferIsMultiTeamComposition, une par une.
  // Chacune correspond a un utilisateur qui a DEJA une composition : aucune ne
  // doit jamais se refermer.
  test('porte 1 — aggregateBranches non vide (vue convocation agregee)', () => {
    expect(boardOuvertAvec({
      aggregateBranches: [{ published: { teams: [] } }],
    })).toBe('NOUVEAU');
  });

  test('porte 2 — multiTeamComposition explicite', () => {
    expect(boardOuvertAvec({ multiTeamComposition: true })).toBe('NOUVEAU');
  });

  test('porte 3 — existingComposition.schemaVersion === 3', () => {
    expect(boardOuvertAvec({
      existingComposition: { schemaVersion: 3 },
    })).toBe('NOUVEAU');
  });

  test('porte 4 — existingComposition.teams est un tableau', () => {
    expect(boardOuvertAvec({
      existingComposition: { teams: [] },
    })).toBe('NOUVEAU');
  });

  test('porte 5 — existingComposition.reservePlayerIds est un tableau', () => {
    expect(boardOuvertAvec({
      existingComposition: { reservePlayerIds: [] },
    })).toBe('NOUVEAU');
  });

  test('porte 6 — teamComposition.draft.teams est un tableau', () => {
    expect(boardOuvertAvec({
      teamComposition: { draft: { teams: [] } },
    })).toBe('NOUVEAU');
  });

  test('porte 7 — teamComposition.published.teams est un tableau', () => {
    expect(boardOuvertAvec({
      teamComposition: { published: { teams: [] } },
    })).toBe('NOUVEAU');
  });

  test('une composition v3 complete passe par le NOUVEAU board', () => {
    expect(boardOuvertAvec({
      canEdit: true,
      existingComposition: {
        manualPlayers: [],
        mode: 'manual',
        placementMode: 'slots',
        reservePlayerIds: ['p1'],
        schemaVersion: 3,
        teams: [{ id: 'team_1', placements: [], slots: [] }],
      },
      eventId: 'event-1',
      teamId: 'team-1',
    })).toBe('NOUVEAU');
  });
});

describe('TacticalBoardEntry — ce qui tombe sur l\'ANCIEN board', () => {
  // CES TESTS DECRIVENT L'ETAT AVANT LE LOT D27. Leur sens change volontairement
  // avec l'aiguillage : ils sont ici pour qu'on VOIE ce qui bascule.
  test('aucun parametre du tout', () => {
    expect(boardOuvertAvec(undefined)).toBe('ANCIEN');
  });

  test('params vide', () => {
    expect(boardOuvertAvec({})).toBe('ANCIEN');
  });

  test('composition heritee (placements a plat, sans schemaVersion)', () => {
    expect(boardOuvertAvec({
      existingComposition: {
        manualPlayers: [],
        placements: [{ playerId: 'p1', positionX: 50, positionY: 12 }],
        sportContext: 'football',
      },
    })).toBe('ANCIEN');
  });

  test('composition NEUVE cote evenement, bootstrap serveur absent', () => {
    // Ce que EventDetails.openNewComposition envoie quand la requete
    // useGetEventTeamComposition n'a rien rendu : existingComposition = null,
    // multiTeamComposition = false, teamComposition = null.
    expect(boardOuvertAvec({
      canEdit: true,
      compositionIntent: 'manual',
      editorMode: 'event',
      editorSource: 'empty',
      eventId: 'event-1',
      existingComposition: null,
      multiTeamComposition: false,
      players: [],
      readOnly: false,
      sport: 'football',
      teamComposition: null,
      teamId: 'team-1',
    })).toBe('ANCIEN');
  });

  test('composition d\'equipe NEUVE (mode team-default, jamais enregistree)', () => {
    // Ce que TacticalSelection envoie depuis TeamDetails quand l'equipe n'a
    // aucune composition par defaut : teamDefaultComposition.composition = null
    // cote serveur, donc existingComposition = null et aucun teamComposition.
    expect(boardOuvertAvec({
      editorMode: 'team-default',
      existingComposition: null,
      selectedPlayers: [{ documentId: 'p1', firstname: 'A', lastname: 'B' }],
      sport: 'football',
      teamComposition: null,
      teamDefaultComposition: null,
      teamId: 'team-1',
      teamName: 'Equipe A',
    })).toBe('ANCIEN');
  });
});

describe('TacticalBoardEntry — ce que le serveur renvoie vraiment', () => {
  // MESURE : createEmptyTeamPack (admin/src/api/event/services/event-composition.ts)
  // rend TOUJOURS un pack schemaVersion 3 avec un tableau teams, meme vide.
  // Une composition d'evenement NEUVE dont le bootstrap serveur EST charge
  // ouvre donc DEJA le nouveau board, sans rien changer.
  test('bootstrap serveur vide (pack v3) — deja le NOUVEAU board', () => {
    const packVideDuServeur = {
      manualPlayers: [],
      mode: 'manual',
      placementMode: 'slots',
      reservePlayerIds: [],
      reserveSnapshotPlayers: [],
      schemaVersion: 3,
      sportContext: 'football',
      teams: [{
        id: 'team_1', name: 'Equipe 1', placements: [], slots: [],
      }],
      updatedAt: null,
      updatedBy: null,
    };

    expect(boardOuvertAvec({
      canEdit: true,
      editorSource: 'empty',
      eventId: 'event-1',
      existingComposition: packVideDuServeur,
      teamId: 'team-1',
    })).toBe('NOUVEAU');
  });
});
