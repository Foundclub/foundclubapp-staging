import {
  buildConvocationFieldTokens,
  buildPlayerConvocationView,
  CONVOCATION_ROLE_STARTER,
  CONVOCATION_ROLE_SUBSTITUTE,
  formatConvocationTime,
  getPlayerConvocationResponse,
} from '../playerConvocationUtils';

// C-C — ECRAN 10 du pack composition, la partie qui se DECIDE sans rendu.
//
// La regle que ce fichier tient, et la seule qui compte : le serveur envoie la
// meme notification a TOUTE l'equipe (entraineurs et organisateur compris). Un
// ecran « Tu es convoque » montre a quelqu'un qui ne l'est pas serait un
// mensonge — et le pack interdit noir sur blanc les promesses fausses.

const packAvec = (/** @type {any} */ extra = {}) => ({
  manualPlayers: [],
  reservePlayerIds: [],
  snapshotPlayers: [
    {
      documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla', number: 1, position: 'Gardien',
    },
    {
      documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra', number: 7, position: 'Ailier',
    },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [
      {
        playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      },
    ],
  }],
  ...extra,
});

const convocationAvec = (/** @type {any} */ pack) => ({
  event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
  published: pack,
  responses: { byPlayerId: {}, counts: { absent: 0, pending: 1, present: 0 } },
  team: { documentId: 'team-1', name: 'Senior 1' },
});

describe('buildPlayerConvocationView', () => {
  test('un joueur PLACE sur le terrain est titulaire, avec son poste et son numero', () => {
    const vue = buildPlayerConvocationView({
      convocation: convocationAvec(packAvec({
        publishedBy: { firstname: 'Coach', lastname: 'Karim' },
      })),
      userId: 'joueur-1',
    });

    expect(vue).not.toBeNull();
    expect(vue?.role).toBe(CONVOCATION_ROLE_STARTER);
    // Le poste vient du REPERE ou le jeton s'est pose (`slot_1` -> le 1er poste
    // du football), pas du poste declare du joueur.
    expect(vue?.positionLabel).toBe('GB');
    expect(vue?.jerseyNumber).toBe('1');
    expect(vue?.publishedByName).toBe('Coach Karim');
    expect(vue?.teamName).toBe('Senior 1');
  });

  test('un joueur du banc est convoque AUSSI — il est remplacant', () => {
    const vue = buildPlayerConvocationView({
      convocation: convocationAvec(packAvec({ reservePlayerIds: ['joueur-2'] })),
      userId: 'joueur-2',
    });

    expect(vue?.role).toBe(CONVOCATION_ROLE_SUBSTITUTE);
    // Sans repere, on retombe sur le poste DECLARE du joueur — jamais sur un
    // poste invente.
    expect(vue?.positionLabel).toBe('Ailier');
  });

  test('🔒 un joueur NON convoque ne recoit aucune vue', () => {
    expect(buildPlayerConvocationView({
      convocation: convocationAvec(packAvec()),
      userId: 'joueur-2',
    })).toBeNull();
  });

  test('🔒 l entraineur qui recoit la meme notification ne recoit aucune vue', () => {
    expect(buildPlayerConvocationView({
      convocation: convocationAvec(packAvec()),
      userId: 'coach-1',
    })).toBeNull();
  });

  test('une convocation non publiee ne rend rien', () => {
    expect(buildPlayerConvocationView({
      convocation: { published: null },
      userId: 'joueur-1',
    })).toBeNull();
    expect(buildPlayerConvocationView({ convocation: null, userId: 'joueur-1' })).toBeNull();
    expect(buildPlayerConvocationView({ convocation: convocationAvec(packAvec()), userId: '' }))
      .toBeNull();
  });

  test('le numero 0 est un vrai numero, pas une absence', () => {
    const vue = buildPlayerConvocationView({
      convocation: convocationAvec(packAvec({
        snapshotPlayers: [{ documentId: 'joueur-1', firstname: 'Karim', number: 0 }],
      })),
      userId: 'joueur-1',
    });

    expect(vue?.jerseyNumber).toBe('0');
  });
});

describe('buildConvocationFieldTokens', () => {
  test('n apparie que les placements dont le joueur est connu', () => {
    const jetons = buildConvocationFieldTokens({
      placements: [{ playerId: 'joueur-1' }, { playerId: 'fantome' }],
      snapshotPlayers: packAvec().snapshotPlayers,
    });

    expect(jetons).toHaveLength(1);
    expect(jetons[0].player.firstname).toBe('Karim');
  });
});

describe('getPlayerConvocationResponse', () => {
  test('lit la reponse CALCULEE PAR LE SERVEUR, et retombe sur « en attente »', () => {
    const byPlayerId = { 'joueur-1': 'present', 'joueur-2': 'absent' };
    const convocation = { responses: { byPlayerId } };

    expect(getPlayerConvocationResponse(convocation, 'joueur-1')).toBe('present');
    expect(getPlayerConvocationResponse(convocation, 'joueur-2')).toBe('absent');
    expect(getPlayerConvocationResponse(convocation, 'joueur-3')).toBe('pending');
    expect(getPlayerConvocationResponse(null, 'joueur-1')).toBe('pending');
  });
});

describe('formatConvocationTime', () => {
  test('sait lire les DEUX formes qui circulent, et n invente jamais une heure', () => {
    expect(formatConvocationTime('15:00:00.000')).toBe('15:00');
    expect(formatConvocationTime('')).toBe('');
    expect(formatConvocationTime(null)).toBe('');
    expect(formatConvocationTime('pas une date')).toBe('');
  });
});
