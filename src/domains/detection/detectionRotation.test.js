import {
  addTeam,
  closeRound,
  getCumulativePlaytime,
  getOnFieldIds,
  getUnassignedIds,
  isUnderPlaytimeFloor,
  movePlayerToTeam,
  PLAYTIME_FLOOR_MINUTES,
  readTeamLineup,
  startNextRound,
} from './detectionRotation';

/**
 * C-E — les 4 temoins de l'ecran 17 (rotation, temps de jeu) et de l'ecran 16
 * (terrains multi-equipes).
 *
 * ⛔ LE RISQUE GRAVE DU LOT : perdre une affectation en changeant de manche. Un
 * joueur perdu, c'est un candidat qui s'est deplace et que personne ne rappelle.
 * Les temoins 3 et 4 sont ecrits autour de cet invariant, pas autour d'un ecran.
 */

const makeTeams = () => ([
  {
    bibColor: 'jaune', name: 'Jaune', players: ['p1', 'p2', 'p3'], rotation: ['p3'], terrain: null,
  },
  {
    bibColor: 'rouge', name: 'Rouge', players: ['p4', 'p5'], rotation: [], terrain: null,
  },
]);

describe('detectionRotation — lecture d une equipe', () => {
  it('separe les joueurs places de ceux qui attendent leur tour', () => {
    const lineup = readTeamLineup(makeTeams()[0], 5);

    expect(lineup.placedIds).toEqual(['p1', 'p2']);
    expect(lineup.rotationIds).toEqual(['p3']);
  });

  it('ne perd ni ne duplique un joueur quand la rotation est incoherente', () => {
    const team = {
      bibColor: 'jaune',
      // `p9` n'est pas dans l'effectif, `p1` y est deux fois : les deux formes
      // arrivent d'un brouillon ecrit par une version anterieure.
      players: ['p1', 'p1', 'p2'],
      rotation: ['p9', 'p2'],
    };

    const lineup = readTeamLineup(team, 5);

    expect([...lineup.placedIds, ...lineup.rotationIds].sort()).toEqual(['p1', 'p2']);
  });

  it('renvoie en rotation les joueurs qui depassent le nombre de places', () => {
    const team = { players: ['p1', 'p2', 'p3'], rotation: [] };

    expect(readTeamLineup(team, 2)).toEqual({ placedIds: ['p1', 'p2'], rotationIds: ['p3'] });
  });
});

describe('temoin 1 — le temps de jeu cumule augmente quand le joueur est sur le terrain', () => {
  it('ajoute les minutes ecoulees aux seuls joueurs presents sur le terrain', () => {
    const rounds = [{ index: 1, playtimeByPlayer: {}, startedAt: null }];

    const closed = closeRound(rounds[0], ['p1', 'p2'], 12);
    const cumulative = getCumulativePlaytime([closed]);

    expect(cumulative.p1).toBe(12);
    expect(cumulative.p2).toBe(12);
    // `p3` etait en rotation : son compteur ne bouge pas.
    expect(cumulative.p3 || 0).toBe(0);
  });

  it('cumule les manches successives pour un meme joueur', () => {
    const first = closeRound({ index: 1, playtimeByPlayer: {} }, ['p1'], 8);
    const second = closeRound({ index: 2, playtimeByPlayer: {} }, ['p1', 'p3'], 6);

    const cumulative = getCumulativePlaytime([first, second]);

    expect(cumulative.p1).toBe(14);
    expect(cumulative.p3).toBe(6);
  });

  it('n enleve jamais de temps deja acquis', () => {
    const round = closeRound({ index: 1, playtimeByPlayer: { p1: 9 } }, ['p2'], 5);

    expect(round.playtimeByPlayer.p1).toBe(9);
    expect(round.playtimeByPlayer.p2).toBe(5);
  });
});

describe('temoin 2 — un joueur sous 5 minutes est signale', () => {
  it('signale zero et 4 minutes, pas 5 ni au-dela', () => {
    expect(PLAYTIME_FLOOR_MINUTES).toBe(5);
    expect(isUnderPlaytimeFloor(0)).toBe(true);
    expect(isUnderPlaytimeFloor(4)).toBe(true);
    expect(isUnderPlaytimeFloor(5)).toBe(false);
    expect(isUnderPlaytimeFloor(21)).toBe(false);
  });

  it('signale un joueur qui n a aucune ligne de temps de jeu', () => {
    const cumulative = getCumulativePlaytime([closeRound({ index: 1 }, ['p1'], 30)]);

    expect(isUnderPlaytimeFloor(cumulative.p7 || 0)).toBe(true);
  });
});

describe('temoin 3 — glisser un joueur d une equipe a l autre marche toujours', () => {
  it('retire le joueur de son equipe d origine et l ajoute a la cible', () => {
    const moved = movePlayerToTeam(makeTeams(), 'p4', 0);

    expect(moved[0].players).toContain('p4');
    expect(moved[1].players).not.toContain('p4');
  });

  it('ne duplique jamais un joueur, meme en le deplacant deux fois', () => {
    const once = movePlayerToTeam(makeTeams(), 'p1', 1);
    const twice = movePlayerToTeam(once, 'p1', 1);

    const everyone = twice.flatMap((team) => team.players);
    expect(everyone.filter((playerId) => playerId === 'p1')).toHaveLength(1);
  });

  it('sort le joueur de toutes les equipes quand la cible est « non affectes »', () => {
    const moved = movePlayerToTeam(makeTeams(), 'p2', null);

    expect(moved.flatMap((team) => team.players)).not.toContain('p2');
    expect(getUnassignedIds(['p1', 'p2', 'p3', 'p4', 'p5'], moved)).toEqual(['p2']);
  });

  it('emporte le joueur hors de la rotation de son ancienne equipe', () => {
    const moved = movePlayerToTeam(makeTeams(), 'p3', 1);

    expect(moved[0].rotation).not.toContain('p3');
    expect(moved[1].players).toContain('p3');
  });

  it('ajoute une equipe sans toucher aux affectations existantes', () => {
    const grown = addTeam(makeTeams());

    expect(grown).toHaveLength(3);
    expect(grown[0].players).toEqual(['p1', 'p2', 'p3']);
    expect(grown[1].players).toEqual(['p4', 'p5']);
    expect(grown[2].players).toEqual([]);
    expect(grown[2].bibColor).toBe('bleu');
  });
});

describe('temoin 4 — passer a la manche suivante ne perd aucune affectation', () => {
  it('garde les equipes a l identique et ouvre une manche de plus', () => {
    const split = {
      checkInFirst: true,
      memberMode: 'grouped',
      presentIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      rounds: [{ index: 1, playtimeByPlayer: {}, startedAt: '2026-08-15T10:00:00.000Z' }],
      splitBy: 'none',
      teamCount: 2,
      teams: makeTeams(),
    };

    const next = startNextRound(split, {
      elapsedMinutes: 10,
      onFieldIds: ['p1', 'p2'],
      startedAt: '2026-08-15T10:10:00.000Z',
    });

    // 🔒 L'invariant du lot : aucune equipe, aucun joueur, aucune rotation perdus.
    expect(next.teams).toEqual(split.teams);
    expect(next.teamCount).toBe(2);
    expect(next.memberMode).toBe('grouped');
    expect(next.presentIds).toEqual(split.presentIds);

    expect(next.rounds).toHaveLength(2);
    expect(next.rounds[0].playtimeByPlayer).toEqual({ p1: 10, p2: 10 });
    expect(next.rounds[1].index).toBe(2);
    expect(next.rounds[1].startedAt).toBe('2026-08-15T10:10:00.000Z');
    expect(next.rounds[1].playtimeByPlayer).toEqual({});
  });

  it('ouvre la manche 1 quand aucune manche n a encore ete lancee', () => {
    const next = startNextRound(
      { rounds: [], teams: makeTeams() },
      { elapsedMinutes: 0, onFieldIds: [], startedAt: '2026-08-15T09:00:00.000Z' },
    );

    expect(next.rounds).toHaveLength(1);
    expect(next.rounds[0].index).toBe(1);
    expect(next.teams).toHaveLength(2);
  });

  it('ne modifie pas la repartition recue (aucune mutation en place)', () => {
    const teams = makeTeams();
    const split = { rounds: [{ index: 1, playtimeByPlayer: {} }], teams };

    startNextRound(split, { elapsedMinutes: 7, onFieldIds: ['p1'], startedAt: null });

    expect(split.rounds).toHaveLength(1);
    expect(split.rounds[0].playtimeByPlayer).toEqual({});
    expect(teams[0].players).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('detectionRotation — qui est sur le terrain', () => {
  it('rend les joueurs places de l equipe visee', () => {
    expect(getOnFieldIds(makeTeams(), 0, 5)).toEqual(['p1', 'p2']);
    expect(getOnFieldIds(makeTeams(), 1, 5)).toEqual(['p4', 'p5']);
  });

  it('rend une liste vide pour une equipe qui n existe pas', () => {
    expect(getOnFieldIds(makeTeams(), 9, 5)).toEqual([]);
  });
});
