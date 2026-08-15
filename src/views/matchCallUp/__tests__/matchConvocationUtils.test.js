import { buildMatchCompositionPack } from '../matchCompositionUtils';
import {
  buildCompositionDiff,
  buildConvocationRoster,
  getConvocationCounts,
  getPlayerRoleInPack,
  getWithdrawnStarters,
} from '../matchConvocationUtils';

// C-B — le calcul des ecrans 7 et 8 du pack composition.
//
// Ce que ce fichier tient, et pourquoi chaque regle est ici plutot qu'a l'ecran :
//   1. Les 3 pastilles de l'ecran 7 viennent des `counts` du SERVEUR. C'est le
//      branchement que le lot existe pour faire — la donnee etait calculee,
//      envoyee, et jetee.
//   2. 🔒 Republier ne perd AUCUNE reponse. C'est le temoin qui compte.
//   3. Un joueur hors app n'a AUCUN statut, pas meme « en attente ».
//   4. Le diff SORT / ENTRE se calcule avec ce que l'app a DEJA en main.

/** Un pack publie minimal : 2 titulaires, 1 remplacant. */
const packPublie = {
  manualPlayers: [],
  reservePlayerIds: ['p3'],
  snapshotPlayers: [
    {
      documentId: 'p1', firstname: 'Karim', lastname: 'Sylla', number: 9,
    },
    {
      documentId: 'p2', firstname: 'Yanis', lastname: 'Bertrand', number: 4,
    },
    {
      documentId: 'p3', firstname: 'Malik', lastname: 'Cisse', number: 7,
    },
  ],
  teams: [{
    id: 'team_1',
    placements: [
      { playerId: 'p1', positionX: 50, positionY: 90 },
      { playerId: 'p2', positionX: 50, positionY: 60 },
    ],
  }],
  version: 1,
};

/** Ce que le serveur renvoie deja dans `responses`, et que personne ne lisait. */
const reponsesServeur = {
  byPlayerId: { p1: 'absent', p2: 'present', p3: 'pending' },
  counts: { absent: 1, pending: 1, present: 1 },
};

describe('C-B ecran 7 — le coach voit les reponses de ses convoques', () => {
  test('🥇 LE TEMOIN DU LOT : les 3 pastilles portent les chiffres du SERVEUR', () => {
    const roster = buildConvocationRoster({ published: packPublie, responses: reponsesServeur });

    expect(getConvocationCounts({ responses: reponsesServeur, roster })).toEqual({
      absent: 1, calledUp: 3, pending: 1, present: 1,
    });
  });

  test('chaque convoque porte SA reponse, et son role', () => {
    const roster = buildConvocationRoster({ published: packPublie, responses: reponsesServeur });

    expect(roster.map((row) => [row.playerId, row.role, row.response])).toEqual([
      ['p1', 'starter', 'absent'],
      ['p2', 'starter', 'present'],
      ['p3', 'substitute', 'pending'],
    ]);
  });

  test('le terrain vient AVANT le banc — c est l ordre que le pack dessine', () => {
    const roster = buildConvocationRoster({ published: packPublie, responses: reponsesServeur });

    expect(roster.map((row) => row.role)).toEqual(['starter', 'starter', 'substitute']);
  });

  test('le nom et le numero suivent, depuis la PHOTO du pack', () => {
    const [premier] = buildConvocationRoster({ published: packPublie, responses: reponsesServeur });

    expect(premier.player).toMatchObject({ firstname: 'Karim', lastname: 'Sylla', number: 9 });
  });

  test('🔒 un joueur hors app n a AUCUN statut — pas meme « en attente »', () => {
    const roster = buildConvocationRoster({
      published: {
        ...packPublie,
        manualPlayers: [{ documentId: 'm1', firstname: 'Sofiane', lastname: 'Dib' }],
        reservePlayerIds: ['p3', 'm1'],
      },
      responses: reponsesServeur,
    });

    expect(roster.find((row) => row.playerId === 'm1')).toMatchObject({
      isManual: true,
      response: null,
    });
  });

  test('sans compteurs serveur, on recompte plutot que d afficher un trou', () => {
    const roster = buildConvocationRoster({
      published: packPublie,
      responses: { byPlayerId: reponsesServeur.byPlayerId },
    });

    expect(getConvocationCounts({ responses: { byPlayerId: reponsesServeur.byPlayerId }, roster }))
      .toEqual({
        absent: 1, calledUp: 3, pending: 1, present: 1,
      });
  });

  test('aucune compo publiee : aucune rangee, aucun chiffre invente', () => {
    const roster = buildConvocationRoster({ published: null, responses: null });

    expect(roster).toEqual([]);
    expect(getConvocationCounts({ responses: null, roster })).toEqual({
      absent: 0, calledUp: 0, pending: 0, present: 0,
    });
  });

  test('un joueur pose deux fois ne compte qu une', () => {
    const roster = buildConvocationRoster({
      published: { ...packPublie, reservePlayerIds: ['p1', 'p3'] },
      responses: reponsesServeur,
    });

    expect(roster.filter((row) => row.playerId === 'p1')).toHaveLength(1);
  });
});

describe('🔒 C-B — REPUBLIER NE PERD AUCUNE REPONSE DEJA DONNEE', () => {
  // Le risque grave du lot. La regle tient PAR CONSTRUCTION cote serveur : la
  // reponse vit dans event.participations / event.missings, jamais dans le pack,
  // et publier n ecrit que event.composition. Ces 3 temoins verifient que l app
  // ne peut pas contourner cette construction.

  test('🥇 la charge republiee ne porte AUCUN champ de reponse', () => {
    const pack = buildMatchCompositionPack({
      basePack: packPublie,
      placements: [{ playerId: 'p1', positionX: 50, positionY: 90 }],
      players: [{ documentId: 'p1' }, { documentId: 'p3' }],
      sport: 'football',
      teamName: 'Senior 1',
    });

    const charge = JSON.stringify(pack);
    expect(charge).not.toContain('participations');
    expect(charge).not.toContain('missings');
    expect(charge).not.toContain('byPlayerId');
    expect(charge).not.toContain('responses');
    expect(charge).not.toContain('present');
    expect(charge).not.toContain('absent');
  });

  test('🔒 apres une republication qui CHANGE la compo, les reponses tiennent', () => {
    // Le coach sort p2 du terrain et fait monter p3. p2 avait repondu « present ».
    const packRepublie = buildMatchCompositionPack({
      basePack: packPublie,
      placements: [
        { playerId: 'p1', positionX: 50, positionY: 90 },
        { playerId: 'p3', positionX: 50, positionY: 60 },
      ],
      players: [{ documentId: 'p1' }, { documentId: 'p3' }, { documentId: 'p2' }],
      sport: 'football',
      teamName: 'Senior 1',
    });

    // Les reponses viennent du serveur, pas du pack : elles traversent la
    // republication intactes.
    const roster = buildConvocationRoster({
      published: packRepublie,
      responses: reponsesServeur,
    });

    expect(roster.find((row) => row.playerId === 'p2')?.response).toBe('present');
    expect(roster.find((row) => row.playerId === 'p1')?.response).toBe('absent');
    expect(roster.find((row) => row.playerId === 'p3')?.response).toBe('pending');
  });

  test('🔒 et le joueur qui ENTRE garde la sienne s il avait deja repondu', () => {
    const packRepublie = buildMatchCompositionPack({
      basePack: packPublie,
      placements: [{ playerId: 'p3', positionX: 50, positionY: 60 }],
      players: [{ documentId: 'p3' }],
      sport: 'football',
      teamName: 'Senior 1',
    });

    const roster = buildConvocationRoster({
      published: packRepublie,
      responses: { byPlayerId: { p3: 'present' }, counts: { absent: 0, pending: 0, present: 1 } },
    });

    expect(roster.find((row) => row.playerId === 'p3')?.response).toBe('present');
  });
});

describe('C-B ecran 8 — CE QUI CHANGE : qui sort, qui entre', () => {
  /** p2 sort du terrain, p3 monte du banc. */
  const packModifie = {
    ...packPublie,
    reservePlayerIds: ['p2'],
    teams: [{
      id: 'team_1',
      placements: [
        { playerId: 'p1', positionX: 50, positionY: 90 },
        { playerId: 'p3', positionX: 50, positionY: 60 },
      ],
    }],
  };

  test('🥇 le diff se calcule avec ce que l app a DEJA — 2 packs, rien de plus', () => {
    const { entering, leaving } = buildCompositionDiff({
      nextPack: packModifie,
      publishedPack: packPublie,
    });

    expect(leaving.map((row) => [row.playerId, row.fromRole, row.toRole]))
      .toEqual([['p2', 'starter', 'substitute']]);
    expect(entering.map((row) => [row.playerId, row.fromRole, row.toRole]))
      .toEqual([['p3', 'substitute', 'starter']]);
  });

  test('un joueur DECONVOQUE sort, et son nom vient de l ancien pack', () => {
    const { leaving } = buildCompositionDiff({
      nextPack: { ...packPublie, reservePlayerIds: [] },
      publishedPack: packPublie,
    });

    expect(leaving).toHaveLength(1);
    expect(leaving[0]).toMatchObject({ fromRole: 'substitute', playerId: 'p3', toRole: 'none' });
    expect(leaving[0].player).toMatchObject({ lastname: 'Cisse' });
  });

  test('un joueur JAMAIS convoque qui arrive sur le terrain ENTRE', () => {
    const { entering } = buildCompositionDiff({
      nextPack: {
        ...packPublie,
        teams: [{
          id: 'team_1',
          placements: [
            ...packPublie.teams[0].placements,
            { playerId: 'p9', positionX: 20, positionY: 20 },
          ],
        }],
      },
      publishedPack: packPublie,
    });

    expect(entering).toHaveLength(1);
    expect(entering[0]).toMatchObject({ fromRole: 'none', playerId: 'p9', toRole: 'starter' });
  });

  test('⛔ un joueur dont RIEN ne change n apparait pas', () => {
    const { entering, leaving } = buildCompositionDiff({
      nextPack: packPublie,
      publishedPack: packPublie,
    });

    expect(entering).toEqual([]);
    expect(leaving).toEqual([]);
  });

  test('le desistement se lit sur les titulaires qui ont repondu ABSENT', () => {
    const roster = buildConvocationRoster({ published: packPublie, responses: reponsesServeur });

    expect(getWithdrawnStarters(roster).map((row) => row.playerId)).toEqual(['p1']);
  });

  test('un REMPLACANT absent n est pas un desistement de titulaire', () => {
    const roster = buildConvocationRoster({
      published: packPublie,
      responses: { byPlayerId: { p3: 'absent' } },
    });

    expect(getWithdrawnStarters(roster)).toEqual([]);
  });

  test('le role se lit dans les 2 formes de pack, et « none » hors convocation', () => {
    expect(getPlayerRoleInPack(packPublie, 'p1')).toBe('starter');
    expect(getPlayerRoleInPack(packPublie, 'p3')).toBe('substitute');
    expect(getPlayerRoleInPack(packPublie, 'inconnu')).toBe('none');
    expect(getPlayerRoleInPack(null, 'p1')).toBe('none');
  });
});
