import {
  BIB_COLORS,
  buildDetectionSplitPayload,
  buildDraftPayloadWithSplit,
  countRequestedPositions,
  MAX_DETECTION_TEAMS,
  MEMBER_MODES,
  SPLIT_BY,
  splitIntoTeams,
} from './detectionSplit';

// Fabrique un joueur au format que le SERVEUR envoie deja a l'app
// (event-composition.ts:184-200) : participantSource dit s'il est membre de
// l'equipe organisatrice ou candidat a la detection, appliedPosition porte le
// poste qu'il a demande en candidatant.
const makePlayer = (id, extra = {}) => ({
  appliedPosition: null,
  firstname: `Prenom${id}`,
  id,
  lastname: `Nom${id}`,
  participantSource: 'external_participant',
  ...extra,
});

const makeMember = (id, extra = {}) => makePlayer(
  id,
  { participantSource: 'team_player', ...extra },
);

// Tous les joueurs ranges quelque part, equipes ET non affectes confondus.
const collectAll = (result) => [
  ...result.teams.flatMap((team) => team.playerIds),
  ...result.unassignedIds,
];

describe('C-D · repartition d une detection', () => {
  // 🔒 LE TEMOIN QUI COMPTE. Un joueur perdu, c'est un candidat qui s'est
  // deplace et que personne n'appelle. Un joueur duplique, c'est deux equipes
  // qui l'attendent. Les deux sont pires qu'une repartition moche.
  describe('temoin 1 — ne perd ni ne duplique personne', () => {
    it('repartit 17 joueurs en 3 equipes sans perte ni doublon', () => {
      const players = Array.from({ length: 17 }, (_, index) => makePlayer(`p${index + 1}`));

      const result = splitIntoTeams({ players, teamCount: 3 });

      const placed = collectAll(result);
      expect(placed).toHaveLength(17);
      expect(new Set(placed).size).toBe(17);
      expect([...placed].sort()).toEqual(players.map((player) => player.id).sort());
    });

    it('tient l invariant sur toute la rampe de 1 a 8 equipes, membres et candidats meles', () => {
      const players = [
        ...Array.from({ length: 12 }, (_, index) => makeMember(`m${index + 1}`)),
        ...Array.from({ length: 22 }, (_, index) => makePlayer(`c${index + 1}`)),
      ];
      const expected = players.map((player) => player.id).sort();

      Object.values(MEMBER_MODES).forEach((memberMode) => {
        for (let teamCount = 1; teamCount <= MAX_DETECTION_TEAMS; teamCount += 1) {
          const result = splitIntoTeams({ memberMode, players, teamCount });
          const placed = collectAll(result);

          expect(new Set(placed).size).toBe(placed.length);
          expect([...placed].sort()).toEqual(expected);
        }
      });
    });

    it('ne duplique pas un joueur envoye deux fois dans la liste', () => {
      const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p1')];

      const result = splitIntoTeams({ players, teamCount: 2 });

      expect(collectAll(result)).toHaveLength(2);
      expect(new Set(collectAll(result)).size).toBe(2);
    });

    it('repartit equitablement : jamais plus d un joueur d ecart entre deux equipes', () => {
      const players = Array.from({ length: 17 }, (_, index) => makePlayer(`p${index + 1}`));

      const sizes = splitIntoTeams({ players, teamCount: 3 })
        .teams.map((team) => team.playerIds.length);

      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    });
  });

  describe('temoin 2 — exclure un joueur le retire de TOUTES les equipes', () => {
    it('sort les membres de l equipe de la repartition en mode « les sortir »', () => {
      const players = [
        makeMember('m1'),
        makeMember('m2'),
        ...Array.from({ length: 6 }, (_, index) => makePlayer(`c${index + 1}`)),
      ];

      const result = splitIntoTeams({ memberMode: MEMBER_MODES.EXCLUDED, players, teamCount: 2 });

      const inTeams = result.teams.flatMap((team) => team.playerIds);
      expect(inTeams).not.toContain('m1');
      expect(inTeams).not.toContain('m2');
      // Sortis de la repartition, pas de l'existence : ils restent visibles.
      expect(result.unassignedIds).toEqual(expect.arrayContaining(['m1', 'm2']));
    });

    it('un joueur exclu nommement ne figure dans aucune equipe, quel que soit le mode', () => {
      const players = Array.from({ length: 9 }, (_, index) => makePlayer(`p${index + 1}`));

      Object.values(MEMBER_MODES).forEach((memberMode) => {
        const result = splitIntoTeams({
          excludedIds: ['p4'],
          memberMode,
          players,
          teamCount: 3,
        });

        result.teams.forEach((team) => expect(team.playerIds).not.toContain('p4'));
        expect(result.unassignedIds).toContain('p4');
        expect(collectAll(result)).toHaveLength(9);
      });
    });

    it('garde l equipe groupee dans UNE seule equipe verrouillee', () => {
      const players = [
        ...Array.from({ length: 4 }, (_, index) => makeMember(`m${index + 1}`)),
        ...Array.from({ length: 8 }, (_, index) => makePlayer(`c${index + 1}`)),
      ];

      const result = splitIntoTeams({ memberMode: MEMBER_MODES.GROUPED, players, teamCount: 3 });

      const teamsHoldingMembers = result.teams.filter(
        (team) => team.playerIds.some((playerId) => playerId.startsWith('m')),
      );
      expect(teamsHoldingMembers).toHaveLength(1);
      expect(teamsHoldingMembers[0].playerIds.sort()).toEqual(['m1', 'm2', 'm3', 'm4']);
      // Et les candidats ne rentrent jamais dans l'equipe verrouillee.
      const allAreMembers = teamsHoldingMembers[0].playerIds
        .every((playerId) => playerId.startsWith('m'));
      expect(allAreMembers).toBe(true);
    });
  });

  describe('temoin 3 — la repartition est deterministe et sourde a l ordre d entree', () => {
    // NOTE : le prompt demandait « le meme resultat qu'avant le deplacement ».
    // La mesure a montre qu'il n'y a PAS de deplacement : l'ancien hub calcule
    // un placement sur terrain (ecran 16), pas une constitution d'equipes
    // (ecran 15). Le temoin utile est donc celui-ci — deux coachs, deux
    // telephones, la meme detection, le meme decoupage.
    it('deux appels identiques rendent exactement le meme decoupage', () => {
      const players = Array.from({ length: 23 }, (_, index) => makePlayer(`p${index + 1}`));

      const first = splitIntoTeams({ players, teamCount: 4 });
      const second = splitIntoTeams({ players, teamCount: 4 });

      expect(second).toEqual(first);
    });

    it('l ordre de la liste d entree ne change pas le decoupage', () => {
      const players = Array.from({ length: 23 }, (_, index) => makePlayer(`p${index + 1}`));

      const straight = splitIntoTeams({ players, teamCount: 4 });
      const shuffled = splitIntoTeams({ players: [...players].reverse(), teamCount: 4 });

      expect(shuffled).toEqual(straight);
    });

    it('separe par poste recherche : chaque poste est etale sur les equipes', () => {
      const players = [
        ...Array.from({ length: 3 }, (_, index) => makePlayer(
          `gb${index + 1}`,
          { appliedPosition: 'Gardien' },
        )),
        ...Array.from({ length: 6 }, (_, index) => makePlayer(
          `at${index + 1}`,
          { appliedPosition: 'Attaquant' },
        )),
      ];

      const result = splitIntoTeams({
        players, splitBy: SPLIT_BY.REQUESTED_POSITION, teamCount: 3,
      });

      result.teams.forEach((team) => {
        const keepers = team.playerIds.filter((playerId) => playerId.startsWith('gb'));
        expect(keepers).toHaveLength(1);
      });
      expect(collectAll(result)).toHaveLength(9);
    });

    it('compte les postes recherches et dit combien manquent pour 1 par equipe', () => {
      const players = [
        makePlayer('gb1', { appliedPosition: 'Gardien' }),
        makePlayer('at1', { appliedPosition: 'Attaquant' }),
        makePlayer('at2', { appliedPosition: 'Attaquant' }),
        makePlayer('at3', { appliedPosition: 'Attaquant' }),
        makePlayer('sp1'),
      ];

      const rows = countRequestedPositions(players, 3);

      expect(rows).toEqual([
        {
          count: 3, missing: 0, onePerTeam: true, position: 'Attaquant',
        },
        {
          count: 1, missing: 2, onePerTeam: false, position: 'Gardien',
        },
      ]);
    });
  });

  describe('temoin 4 — le pointage commande vraiment la repartition', () => {
    it('un joueur non pointe n est reparti dans aucune equipe quand le pointage est actif', () => {
      const players = Array.from({ length: 6 }, (_, index) => makePlayer(`p${index + 1}`));

      const result = splitIntoTeams({
        checkInFirst: true,
        players,
        presentIds: ['p1', 'p2', 'p3', 'p4'],
        teamCount: 2,
      });

      const inTeams = result.teams.flatMap((team) => team.playerIds);
      expect(inTeams.sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(result.unassignedIds.sort()).toEqual(['p5', 'p6']);
      expect(collectAll(result)).toHaveLength(6);
    });

    it('pointage eteint : tout le monde est reparti, meme les non pointes', () => {
      const players = Array.from({ length: 6 }, (_, index) => makePlayer(`p${index + 1}`));

      const result = splitIntoTeams({
        checkInFirst: false,
        players,
        presentIds: ['p1'],
        teamCount: 2,
      });

      expect(result.teams.flatMap((team) => team.playerIds)).toHaveLength(6);
      expect(result.unassignedIds).toHaveLength(0);
    });

    it('pointage actif mais personne de pointe : aucune equipe peuplee, personne perdu', () => {
      const players = Array.from({ length: 5 }, (_, index) => makePlayer(`p${index + 1}`));

      const result = splitIntoTeams({
        checkInFirst: true, players, presentIds: [], teamCount: 3,
      });

      expect(result.teams.flatMap((team) => team.playerIds)).toHaveLength(0);
      expect(result.unassignedIds).toHaveLength(5);
    });
  });

  describe('la charge envoyee au serveur reste dans le contrat de D73', () => {
    it('n emet que les clefs que normalizeDetectionSplit sait relire', () => {
      const players = [makePlayer('p1'), makePlayer('p2')];

      const payload = buildDetectionSplitPayload({
        checkInFirst: true,
        memberMode: MEMBER_MODES.MIX,
        players,
        presentIds: ['p1', 'p2'],
        splitBy: SPLIT_BY.NONE,
        teamCount: 2,
      });

      expect(Object.keys(payload).sort()).toEqual([
        'checkInFirst',
        'memberMode',
        'presentIds',
        'rounds',
        'splitBy',
        'teamCount',
        'teams',
      ]);
      payload.teams.forEach((team) => {
        expect(Object.keys(team).sort())
          .toEqual(['bibColor', 'name', 'players', 'rotation', 'terrain']);
      });
    });

    it('n attribue une chasuble qu aux 4 premieres equipes (au dela : null)', () => {
      const players = Array.from({ length: 12 }, (_, index) => makePlayer(`p${index + 1}`));

      const payload = buildDetectionSplitPayload({ players, teamCount: 6 });

      expect(payload.teams.slice(0, 4).map((team) => team.bibColor)).toEqual(BIB_COLORS);
      expect(payload.teams.slice(4).map((team) => team.bibColor)).toEqual([null, null]);
    });

    // 🧨 `saveDraft` REMPLACE le brouillon de l'equipe par ce qu'on lui envoie
    // (admin `event-composition.ts:1818-1835`). Ranger la repartition ne doit
    // jamais coûter la composition deja posee.
    it('n efface pas le brouillon existant en y accrochant la repartition', () => {
      const existingDraft = {
        mode: 'manual',
        reservePlayerIds: ['p9'],
        schemaVersion: 3,
        teams: [{ id: 'team_1', placements: [{ playerId: 'p1', slotId: 's1' }] }],
      };

      const payload = buildDraftPayloadWithSplit(existingDraft, { teamCount: 2 });

      expect(payload.teams).toEqual(existingDraft.teams);
      expect(payload.reservePlayerIds).toEqual(['p9']);
      expect(payload.mode).toBe('manual');
      expect(payload.detectionSplit).toEqual({ teamCount: 2 });
    });

    it('accepte un brouillon absent sans fabriquer de pack fantome', () => {
      expect(buildDraftPayloadWithSplit(null, { teamCount: 3 })).toEqual({
        detectionSplit: { teamCount: 3 },
      });
    });

    it('reconduit les manches sans y toucher : ce lot ne fait pas tourner les equipes', () => {
      const rounds = [{
        index: 1, playtimeByPlayer: { p1: 12 }, startedAt: '2026-08-14T10:00:00.000Z',
      }];

      const payload = buildDetectionSplitPayload({
        players: [makePlayer('p1')], rounds, teamCount: 1,
      });

      expect(payload.rounds).toEqual(rounds);
    });
  });
});
