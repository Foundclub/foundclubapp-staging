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
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: () => reactActuel.createElement(TexteRN, null, 'NOUVEAU BOARD'),
  };
});

jest.mock('./TacticalBoard', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: () => reactActuel.createElement(TexteRN, null, 'ANCIEN BOARD'),
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
      eventId: 'event-1',
      existingComposition: {
        manualPlayers: [],
        mode: 'manual',
        placementMode: 'slots',
        reservePlayerIds: ['p1'],
        schemaVersion: 3,
        teams: [{ id: 'team_1', placements: [], slots: [] }],
      },
      teamId: 'team-1',
    })).toBe('NOUVEAU');
  });
});

describe('TacticalBoardEntry — ce que le serveur renvoie vraiment', () => {
  // MESURE : createEmptyTeamPack (admin/src/api/event/services/event-composition.ts)
  // rend TOUJOURS un pack schemaVersion 3 avec un tableau teams, meme vide, et
  // getTeamComposition le renvoie sous `bootstrap.composition`. Une composition
  // d'evenement NEUVE dont le bootstrap serveur EST charge ouvrait donc DEJA le
  // nouveau board, avant meme ce lot : la porte 3 suffisait.
  test('bootstrap serveur vide (pack v3) — deja le NOUVEAU board avant D27', () => {
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

describe('TacticalBoardEntry — D27 : le chemin AJOUTE (composition neuve)', () => {
  // Le temoin d'arret du lot. Avant D27, ces trois cas rendaient 'ANCIEN'.
  test('composition NEUVE cote evenement, bootstrap serveur absent', () => {
    // Ce que EventDetails.openNewComposition envoie quand la requete
    // useGetEventTeamComposition n'a rien rendu (echec reseau, cache vide) :
    // existingComposition = null, multiTeamComposition = false. Le chip "Compo"
    // reste pressable dans ce cas, donc le trou etait atteignable.
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
    })).toBe('NOUVEAU');
  });

  test('retour de TacticalSelection sans brouillon serveur', () => {
    // TacticalSelection resout existingComposition a null quand il n'y a ni
    // brouillon ni bootstrapComposition en params, et ne transmet ni
    // multiTeamComposition ni canEdit.
    expect(boardOuvertAvec({
      editorMode: 'event',
      eventId: 'event-1',
      eventName: 'Match amical',
      existingComposition: null,
      selectedPlayers: [{ documentId: 'p1', firstname: 'A', lastname: 'B' }],
      sport: 'football',
      teamComposition: { availablePresets: [], draft: null, published: null },
      teamId: 'team-1',
      teamName: 'Equipe A',
    })).toBe('NOUVEAU');
  });

  test('composition heritee EDITEE dans un evenement', () => {
    // La conversion est sans perte : normalizeMultiTeamPack replie des
    // placements a plat dans teams[0].placements (prouve dans
    // multiTeamCompositionUtils.test.js).
    expect(boardOuvertAvec({
      eventId: 'event-1',
      existingComposition: {
        manualPlayers: [],
        placements: [{ playerId: 'p1', positionX: 50, positionY: 12 }],
        sportContext: 'football',
      },
      teamId: 'team-1',
    })).toBe('NOUVEAU');
  });
});

describe('TacticalBoardEntry — D27 : ce qui reste volontairement sur l\'ANCIEN', () => {
  test('aucun parametre du tout', () => {
    expect(boardOuvertAvec(undefined)).toBe('ANCIEN');
  });

  test('params vide', () => {
    expect(boardOuvertAvec({})).toBe('ANCIEN');
  });

  test('composition heritee consultee hors evenement', () => {
    expect(boardOuvertAvec({
      existingComposition: {
        manualPlayers: [],
        placements: [{ playerId: 'p1', positionX: 50, positionY: 12 }],
        sportContext: 'football',
      },
    })).toBe('ANCIEN');
  });

  test('composition par defaut d\'equipe NEUVE (mode team-default)', () => {
    // GARDE-FOU 1. Le nouveau board ne connait pas ce mode : handleSaveDraft et
    // handlePublish sortent sans rien faire quand eventId manque. Et le serveur
    // force schemaVersion 1 sur cette composition en jetant le tableau teams.
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

  test('team-default reste sur l\'ANCIEN meme si un eventId traine', () => {
    expect(boardOuvertAvec({
      editorMode: 'team-default',
      eventId: 'event-1',
      existingComposition: null,
      teamId: 'team-1',
    })).toBe('ANCIEN');
  });

  test('consultation en lecture seule d\'une composition heritee', () => {
    // GARDE-FOU 2. Ce que CompositionMessageBubble envoie pour une ancienne
    // composition partagee dans une conversation. Ce lot ne redessine pas ce
    // que voit un joueur.
    expect(boardOuvertAvec({
      eventId: 'event-1',
      existingComposition: {
        manualPlayers: [],
        placements: [{ playerId: 'p1', positionX: 50, positionY: 12 }],
        sportContext: 'football',
      },
      multiTeamComposition: false,
      readOnly: true,
      teamId: 'team-1',
    })).toBe('ANCIEN');
  });

  test('sans teamId, le nouveau board ne saurait pas enregistrer', () => {
    expect(boardOuvertAvec({
      editorMode: 'event',
      eventId: 'event-1',
      existingComposition: null,
    })).toBe('ANCIEN');
  });

  test('sans eventId, le nouveau board ne saurait pas enregistrer', () => {
    expect(boardOuvertAvec({
      editorMode: 'event',
      existingComposition: null,
      teamId: 'team-1',
    })).toBe('ANCIEN');
  });
});

describe('TacticalBoardEntry — la lecture seule agregee garde sa porte', () => {
  test('aggregateBranches passe malgre readOnly', () => {
    // La porte 1 est interrogee AVANT l'exclusion readOnly : la vue
    // "Voir la composition d'equipes" d'EventDetails ne bouge pas.
    expect(boardOuvertAvec({
      aggregateBranches: [{ published: { teams: [] } }],
      canEdit: false,
      readOnly: true,
    })).toBe('NOUVEAU');
  });

  test('une composition v3 publiee reste sur le NOUVEAU board en lecture seule', () => {
    expect(boardOuvertAvec({
      existingComposition: { schemaVersion: 3, teams: [] },
      readOnly: true,
    })).toBe('NOUVEAU');
  });
});
