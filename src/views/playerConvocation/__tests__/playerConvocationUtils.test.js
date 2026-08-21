import {
  buildConvocationFieldTokens,
  buildConvocationReserveList,
  buildPlayerConvocationView,
  CONVOCATION_ROLE_STARTER,
  CONVOCATION_ROLE_SUBSTITUTE,
  formatConvocationTime,
  getPlayerConvocationResponse,
  getViewerConvocationRole,
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

// ==========================================================================
// AC08 — LA CHARGE TELLE QUE LE SERVEUR L'ENVOIE VRAIMENT.
//
// 🧨 Mesure du 2026-08-21 : `getPlayerConvocationView` (`event-composition.ts`,
// forme `branches` depuis le 2026-07-07) ne met AUCUN `published` a la racine.
// L'ecran, ecrit le 2026-08-15 contre l'ancienne forme, lisait donc toujours
// `undefined` — et reposait TOUT LE MONDE sur la page de l'evenement, y compris
// le joueur convoque venu par la notification. L'ecran n'etait pas seulement
// sans porte : il etait sans contenu.
// ==========================================================================

const chargeServeur = (/** @type {any} */ pack, /** @type {any} */ responses = undefined) => ({
  branches: [{
    published: pack,
    responses: responses || { byPlayerId: {}, counts: { absent: 0, pending: 1, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
    viewer: { inReserve: false, teamEntryIds: [] },
  }],
  event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
});

describe('AC08 — la forme « branches » du serveur', () => {
  test('🥇 un joueur PLACE y est reconnu titulaire — c est ce qui manquait', () => {
    const vue = buildPlayerConvocationView({
      convocation: chargeServeur(packAvec({
        publishedBy: { firstname: 'Coach', lastname: 'Karim' },
      })),
      userId: 'joueur-1',
    });

    expect(vue).not.toBeNull();
    expect(vue?.role).toBe(CONVOCATION_ROLE_STARTER);
    expect(vue?.teamName).toBe('Senior 1');
    expect(vue?.publishedByName).toBe('Coach Karim');
  });

  test('un remplacant y est reconnu remplacant', () => {
    expect(buildPlayerConvocationView({
      convocation: chargeServeur(packAvec({ reservePlayerIds: ['joueur-2'] })),
      userId: 'joueur-2',
    })?.role).toBe(CONVOCATION_ROLE_SUBSTITUTE);
  });

  test('🔒 un non-convoque n en tire toujours rien', () => {
    expect(buildPlayerConvocationView({
      convocation: chargeServeur(packAvec()),
      userId: 'coach-1',
    })).toBeNull();
  });

  test('la BONNE branche est retenue quand l evenement en porte plusieurs', () => {
    const charge = chargeServeur(packAvec());
    charge.branches = [
      {
        published: packAvec({
          snapshotPlayers: [],
          teams: [{ id: 'team_9', name: 'Adverse', placements: [] }],
        }),
        responses: { byPlayerId: {} },
        team: { documentId: 'team-9', name: 'Adverse' },
      },
      charge.branches[0],
    ];

    expect(buildPlayerConvocationView({ convocation: charge, userId: 'joueur-1' })?.teamName)
      .toBe('Senior 1');
  });

  test('la reponse deja donnee se lit DANS la branche du lecteur', () => {
    const charge = chargeServeur(packAvec(), { byPlayerId: { 'joueur-1': 'present' } });

    expect(getPlayerConvocationResponse(charge, 'joueur-1')).toBe('present');
  });
});

describe('AC08 — getViewerConvocationRole, la reponse a « suis-je convoque ? »', () => {
  test('titulaire, remplacant, ou rien du tout', () => {
    const charge = chargeServeur(packAvec({ reservePlayerIds: ['joueur-2'] }));

    expect(getViewerConvocationRole(charge, 'joueur-1')).toBe(CONVOCATION_ROLE_STARTER);
    expect(getViewerConvocationRole(charge, 'joueur-2')).toBe(CONVOCATION_ROLE_SUBSTITUTE);
    expect(getViewerConvocationRole(charge, 'coach-1')).toBeNull();
    expect(getViewerConvocationRole(charge, '')).toBeNull();
    expect(getViewerConvocationRole(null, 'joueur-1')).toBeNull();
  });

  test('il lit AUSSI la forme a plat — celle de la carte du tchat', () => {
    expect(getViewerConvocationRole(
      { published: packAvec() },
      'joueur-1',
    )).toBe(CONVOCATION_ROLE_STARTER);
  });
});

describe('AC08 — buildConvocationReserveList, le banc que personne ne voyait', () => {
  test('il rend les remplacants dans l ordre voulu par le coach', () => {
    const banc = buildConvocationReserveList(packAvec({
      reservePlayerIds: ['joueur-2', 'joueur-1'],
      reserveSnapshotPlayers: [
        { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' },
      ],
    }));

    expect(banc.map((/** @type {any} */ entree) => entree.id)).toEqual(['joueur-2', 'joueur-1']);
    expect(banc[0].player.firstname).toBe('Leo');
  });

  test('⛔ un identifiant sans personne connue n est PAS affiche', () => {
    expect(buildConvocationReserveList(packAvec({ reservePlayerIds: ['fantome'] }))).toEqual([]);
    expect(buildConvocationReserveList(null)).toEqual([]);
  });
});

// ==========================================================================
// AD08 — LE REMPLACANT QUE SEULE `reserveSnapshotPlayers` CONNAIT.
//
// 🧨 Mesure du 2026-08-21 : la MEME personne etait cherchee de DEUX facons
// dans ce fichier. `buildConvocationReserveList` fusionne `snapshotPlayers` ET
// `reserveSnapshotPlayers` ; `buildPlayerConvocationView` ne regardait que
// `snapshotPlayers`. Sur une charge ou le remplacant n'est QUE dans
// `reserveSnapshotPlayers` — celle du temoin d'ecran AC08, et celle de la
// carte de compo du tchat (forme a plat, conservee volontairement) — il lisait
// son nom sur le banc, mais sa PROPRE carte ne le connaissait pas : pas
// d'avatar, pas de poste, et pas de numero alors qu'il porte le 7.
// ==========================================================================

const packBancSeul = () => ({
  reservePlayerIds: ['joueur-2'],
  reserveSnapshotPlayers: [{
    documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra', number: 7, position: 'Ailier',
  }],
  snapshotPlayers: [
    { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla', number: 1 },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [{
      playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  }],
});

describe('AD08 — le remplacant a droit a sa propre carte d identite', () => {
  test('T1 · il est reconnu, alors qu il n est QUE dans `reserveSnapshotPlayers`', () => {
    const vue = buildPlayerConvocationView({
      convocation: chargeServeur(packBancSeul()),
      userId: 'joueur-2',
    });

    expect(vue?.role).toBe(CONVOCATION_ROLE_SUBSTITUTE);
    expect(vue?.viewerPlayer).not.toBeNull();
    expect(vue?.viewerPlayer?.firstname).toBe('Leo');
  });

  test('T2 · il lit son NUMERO et son POSTE, pas deux chaines vides', () => {
    const vue = buildPlayerConvocationView({
      convocation: chargeServeur(packBancSeul()),
      userId: 'joueur-2',
    });

    expect(vue?.jerseyNumber).toBe('7');
    // Sans repere sur le terrain, le poste vient du poste DECLARE — jamais
    // d'un poste invente.
    expect(vue?.positionLabel).toBe('Ailier');
  });

  test('⛔ et rien ne change pour un titulaire : sa fiche vient toujours de `snapshotPlayers`', () => {
    const vue = buildPlayerConvocationView({
      convocation: chargeServeur(packBancSeul()),
      userId: 'joueur-1',
    });

    expect(vue?.jerseyNumber).toBe('1');
    expect(vue?.role).toBe(CONVOCATION_ROLE_STARTER);
  });

  test('🔒 le garde-fou ne bouge pas : un non-convoque n en tire toujours rien', () => {
    expect(buildPlayerConvocationView({
      convocation: chargeServeur(packBancSeul()),
      userId: 'coach-1',
    })).toBeNull();
  });
});
