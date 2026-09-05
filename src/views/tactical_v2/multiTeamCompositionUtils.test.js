import {
  buildDraftPayloadFromPack,
  buildEmptyMultiTeamPack,
  buildPublishedBranchesFromPack,
  getReservePlayersForPack,
  inferIsMultiTeamComposition,
  normalizeMultiTeamPack,
  shouldOpenMultiTeamBoard,
} from './multiTeamCompositionUtils';

describe('multiTeamCompositionUtils', () => {
  const presets = [{
    key: '4-4-2',
    label: '4-4-2',
    slots: [
      {
        key: 'gk',
        label: 'GB',
        positionX: 50,
        positionY: 12,
        preferredPositions: ['gardien'],
      },
      {
        key: 'st',
        label: 'BU',
        positionX: 50,
        positionY: 84,
        preferredPositions: ['attaquant'],
      },
    ],
  }];

  test('creates a default v3 pack from presets', () => {
    const pack = buildEmptyMultiTeamPack({
      availablePresets: presets,
      sportContext: 'football',
      teamCount: 2,
    });

    expect(pack.schemaVersion).toBe(3);
    expect(pack.teams).toHaveLength(2);
    expect(pack.teams[0].slots).toHaveLength(2);
    expect(pack.teams[0].presetKey).toBe('4-4-2');
  });

  test('normalizes a legacy mono-composition into one team', () => {
    const pack = normalizeMultiTeamPack({
      manualPlayers: [],
      placements: [
        { playerId: 'player-1', positionX: 50, positionY: 12 },
      ],
    }, {
      availablePresets: presets,
      sportContext: 'football',
    });

    expect(pack.schemaVersion).toBe(3);
    expect(pack.teams).toHaveLength(1);
    expect(pack.teams[0].placements[0].playerId).toBe('player-1');
  });

  test('derives reserve players and payload reserve ids from unassigned players', () => {
    const players = [
      { documentId: 'player-1', firstname: 'Alice', lastname: 'Gardien' },
      { documentId: 'player-2', firstname: 'Bob', lastname: 'Attaquant' },
    ];
    const pack = normalizeMultiTeamPack({
      mode: 'manual',
      teams: [{
        id: 'team_1',
        name: 'Équipe 1',
        placements: [{
          playerId: 'player-1', positionX: 50, positionY: 12, slotId: 'team_1:gk',
        }],
        presetKey: '4-4-2',
        slots: [
          {
            key: 'gk',
            label: 'GB',
            positionX: 50,
            positionY: 12,
            preferredPositions: ['gardien'],
            slotId: 'team_1:gk',
          },
          {
            key: 'st',
            label: 'BU',
            positionX: 50,
            positionY: 84,
            preferredPositions: ['attaquant'],
            slotId: 'team_1:st',
          },
        ],
      }],
    }, {
      availablePresets: presets,
      sportContext: 'football',
    });

    const reservePlayers = getReservePlayersForPack(pack, players);
    const payload = buildDraftPayloadFromPack(pack, players);

    expect(reservePlayers).toHaveLength(1);
    expect(reservePlayers[0].documentId).toBe('player-2');
    expect(payload.reservePlayerIds).toEqual(['player-2']);
  });

  test('buildEmptyMultiTeamPack defaults placementMode to slots and accepts free', () => {
    expect(buildEmptyMultiTeamPack({
      availablePresets: presets, sportContext: 'football',
    }).placementMode).toBe('slots');
    expect(buildEmptyMultiTeamPack({
      availablePresets: presets, placementMode: 'free', sportContext: 'football',
    }).placementMode).toBe('free');
  });

  test('preserves a free placement (no slot) at its own x/y and carries placementMode', () => {
    const pack = normalizeMultiTeamPack({
      placementMode: 'free',
      teams: [{
        id: 'team_1',
        placements: [{
          playerId: 'p1', positionX: 33, positionY: 44, slotId: null,
        }],
        presetKey: '4-4-2',
      }],
    }, { availablePresets: presets, sportContext: 'football' });

    expect(pack.placementMode).toBe('free');
    const placement = pack.teams[0].placements[0];
    expect(placement.playerId).toBe('p1');
    expect(placement.positionX).toBe(33);
    expect(placement.positionY).toBe(44);
    expect(placement.slotId).toBeNull();
  });

  test('buildDraftPayloadFromPack keeps free placement x/y and placementMode', () => {
    const players = [{ documentId: 'p1', firstname: 'A', lastname: 'B' }];
    const pack = normalizeMultiTeamPack({
      placementMode: 'free',
      teams: [{
        id: 'team_1',
        placements: [{
          playerId: 'p1', positionX: 20, positionY: 70, slotId: null,
        }],
        presetKey: '4-4-2',
      }],
    }, { availablePresets: presets, sportContext: 'football' });

    const payload = buildDraftPayloadFromPack(pack, players);
    expect(payload.placementMode).toBe('free');
    const pl = payload.teams[0].placements[0];
    expect(pl.positionX).toBe(20);
    expect(pl.positionY).toBe(70);
    expect(pl.slotId).toBeNull();
  });

  test('detects v3 multi-team payloads', () => {
    expect(inferIsMultiTeamComposition({
      existingComposition: {
        schemaVersion: 3,
        teams: [],
      },
    })).toBe(true);
    expect(inferIsMultiTeamComposition({
      existingComposition: {
        placements: [],
      },
    })).toBe(false);
  });

  // D27 — le nom "multiTeam" laissait croire que ce board ne savait faire que du
  // multi-equipes. Ces trois tests prouvent le contraire AVANT qu'on y envoie
  // les compositions neuves : parti de rien, il rend UNE equipe jouable.
  test('a partir de RIEN, le pack rendu a exactement une equipe', () => {
    const pack = normalizeMultiTeamPack(null, {
      availablePresets: presets,
      sportContext: 'football',
    });

    expect(pack.schemaVersion).toBe(3);
    expect(pack.teams).toHaveLength(1);
    expect(pack.teams[0].placements).toEqual([]);
  });

  test('a partir de rien, l\'equipe porte les postes de la formation', () => {
    const pack = normalizeMultiTeamPack(undefined, {
      availablePresets: presets,
      sportContext: 'football',
    });

    expect(pack.teams[0].presetKey).toBe('4-4-2');
    expect(pack.teams[0].slots).toHaveLength(2);
    expect(pack.teams[0].slots[0].slotId).toBe('team_1:gk');
  });

  test('sans aucune formation connue, il rend quand meme une equipe', () => {
    const pack = normalizeMultiTeamPack(null, {
      availablePresets: [],
      sportContext: null,
    });

    expect(pack.teams).toHaveLength(1);
    expect(pack.teams[0].slots).toEqual([]);
  });
});

describe('shouldOpenMultiTeamBoard', () => {
  // D27 — l'aiguillage lui-meme est teste a l'ecran dans
  // TacticalBoardEntry.test.js. Ici on ne fige que l'invariant de composition :
  // le nouveau predicat n'a le droit de dire que OUI la ou l'ancien disait OUI.
  const casQuiDisaientOui = [
    { aggregateBranches: [{}] },
    { multiTeamComposition: true },
    { existingComposition: { schemaVersion: 3 } },
    { existingComposition: { teams: [] } },
    { existingComposition: { reservePlayerIds: [] } },
    { teamComposition: { draft: { teams: [] } } },
    { teamComposition: { published: { teams: [] } } },
  ];

  test('aucune porte existante ne se referme', () => {
    casQuiDisaientOui.forEach((params) => {
      expect(inferIsMultiTeamComposition(params)).toBe(true);
      expect(shouldOpenMultiTeamBoard(params)).toBe(true);
    });
  });

  test('les memes portes tiennent aussi en lecture seule', () => {
    casQuiDisaientOui.forEach((params) => {
      expect(shouldOpenMultiTeamBoard({ ...params, readOnly: true })).toBe(true);
    });
  });

  test('une composition neuve d\'evenement ouvre le nouveau board', () => {
    expect(shouldOpenMultiTeamBoard({
      editorMode: 'event',
      eventId: 'event-1',
      teamId: 'team-1',
    })).toBe(true);
  });

  test('le mode team-default ne bascule jamais', () => {
    expect(shouldOpenMultiTeamBoard({
      editorMode: 'team-default',
      eventId: 'event-1',
      teamId: 'team-1',
    })).toBe(false);
  });
});

// ============================================================================
// D47 — la charge envoyee au serveur dit QUI est convoque.
//
// FILET (E6) d'abord : `buildDraftPayloadFromPack` est le seul point d'entree
// des deux boutons (Sauvegarder, Publier). Avant d'y ajouter un champ, on fige
// la forme exacte de ce qui part aujourd'hui — c'est ce qui prouvera qu'on a
// ajoute UNE cle et deplace RIEN d'autre.
// ============================================================================

describe('D47 — la charge envoyee au serveur', () => {
  const presets = [{
    key: '4-4-2',
    label: '4-4-2',
    slots: [
      {
        key: 'gk', label: 'GB', positionX: 50, positionY: 12, preferredPositions: [],
      },
      {
        key: 'st', label: 'BU', positionX: 50, positionY: 84, preferredPositions: [],
      },
    ],
  }];

  const packAvecUnPlace = () => normalizeMultiTeamPack({
    mode: 'manual',
    teams: [{
      id: 'team_1',
      name: 'Équipe 1',
      placements: [{
        playerId: 'p1', positionX: 50, positionY: 12, slotId: 'team_1:gk',
      }],
      presetKey: '4-4-2',
    }],
  }, { availablePresets: presets, sportContext: 'football' });

  const CONVOQUES = [
    { documentId: 'p1', firstname: 'Ana', lastname: 'Bern' },
    { documentId: 'p2', firstname: 'Chloe', lastname: 'Diaz' },
  ];

  test('FILET — la charge porte exactement ces cles, ni plus ni moins', () => {
    const payload = buildDraftPayloadFromPack(packAvecUnPlace(), CONVOQUES);

    // Cette liste est le contrat avec le serveur (admin, sanitizeTeamPack). Une
    // cle qui apparait ou disparait ici se voit, au lieu de partir en silence.
    expect(Object.keys(payload).sort()).toEqual([
      'manualPlayers',
      'mode',
      'placementMode',
      'reservePlayerIds',
      'schemaVersion',
      'selectedPlayerIds',
      'sportContext',
      'teams',
    ]);
  });

  test('FILET — les cles historiques gardent leur valeur d\'avant D47', () => {
    const payload = buildDraftPayloadFromPack(packAvecUnPlace(), CONVOQUES);

    expect(payload.schemaVersion).toBe(3);
    expect(payload.mode).toBe('manual');
    expect(payload.placementMode).toBe('slots');
    expect(payload.sportContext).toBe('football');
    expect(payload.manualPlayers).toEqual([]);
    // p1 est sur le terrain, p2 reste en reserve : inchange par D47.
    expect(payload.reservePlayerIds).toEqual(['p2']);
    expect(payload.teams).toHaveLength(1);
    expect(payload.teams[0].placements[0].playerId).toBe('p1');
  });

  test('TEMOIN — la liste des convoques part au serveur, place ou non', () => {
    const payload = buildDraftPayloadFromPack(packAvecUnPlace(), CONVOQUES);

    // p1 est sur le terrain, p2 sur le banc : les DEUX sont convoques.
    expect(payload.selectedPlayerIds).toEqual(['p1', 'p2']);
  });

  test('TEMOIN — le champ vit a la RACINE du pack, jamais dans une equipe', () => {
    // C'est le niveau que lit le serveur : `readSelectedPlayerIds(source)` dans
    // admin/src/api/event/services/event-composition.ts, sur la racine du pack,
    // exactement comme `manualPlayers` et `reservePlayerIds`. Avec plusieurs
    // equipes (detection), la convocation reste UNE liste pour tout le pack.
    const packDeuxEquipes = normalizeMultiTeamPack({
      mode: 'manual',
      teams: [
        { id: 'team_1', name: 'Équipe 1', placements: [], presetKey: '4-4-2' },
        { id: 'team_2', name: 'Équipe 2', placements: [], presetKey: '4-4-2' },
      ],
    }, { availablePresets: presets, sportContext: 'football' });

    const payload = buildDraftPayloadFromPack(packDeuxEquipes, CONVOQUES);

    expect(payload.selectedPlayerIds).toEqual(['p1', 'p2']);
    expect(payload.teams).toHaveLength(2);
    payload.teams.forEach((team) => {
      expect(team.selectedPlayerIds).toBeUndefined();
    });
  });

  test('TEMOIN — personne de convoque : un tableau VIDE part, jamais rien', () => {
    // ⛔ Le coeur du lot. Cote serveur, ABSENT veut dire « composition anterieure
    // a D43 : tout le monde est convoque » alors que VIDE veut dire « personne ».
    // Sauter le champ ici rappellerait tout l'effectif.
    const payload = buildDraftPayloadFromPack(packAvecUnPlace(), []);

    expect(Object.prototype.hasOwnProperty.call(payload, 'selectedPlayerIds')).toBe(true);
    expect(payload.selectedPlayerIds).toEqual([]);
  });

  test('TEMOIN — un joueur saisi a la main est dans la liste, pas a part', () => {
    const packAvecManuel = normalizeMultiTeamPack({
      manualPlayers: [{
        documentId: 'manual_1754700000000',
        firstname: 'Zoe',
        id: 'manual_1754700000000',
        isManual: true,
        lastname: 'Roux',
      }],
      mode: 'manual',
      teams: [{
        id: 'team_1', name: 'Équipe 1', placements: [], presetKey: '4-4-2',
      }],
    }, { availablePresets: presets, sportContext: 'football' });

    const payload = buildDraftPayloadFromPack(packAvecManuel, CONVOQUES);

    expect(payload.selectedPlayerIds).toContain('manual_1754700000000');
    expect(payload.selectedPlayerIds).toEqual(['p1', 'p2', 'manual_1754700000000']);
  });
});

// ==========================================================================
// COMPOLECT-2 — 🔴 « TOUS LES POSTES AFFICHENT LIBRE », capture d Adel du 27/08.
//
// 🗣️ Sa compo de recette ne porte QU UN joueur place (Josan Micheal) sur 5
// postes — « c est mon test », ce n est PAS un defaut. Le defaut, c est que
// meme CE joueur-la s affiche « Libre » : celui qui EXISTE n apparait pas.
//
// 🧨 CAUSE MESUREE : `normalizeMultiTeamPack` ne RECOPIE PAS `snapshotPlayers`.
// Le champ arrive du serveur, traverse le normaliseur, et disparait. Or l ecran
// construit son index de personnes sur `branch.published.snapshotPlayers`
// (`MultiTeamCompositionBoard.js:1164`) : index vide ⇒ aucun placement ne
// retrouve sa personne ⇒ TOUS les postes tombent sur « Libre », placements
// intacts pourtant.
//
// 🔒 ET VOICI POURQUOI LA CORRECTION EST SANS DANGER : ce normaliseur est un
// objet d ENTREE. Ce qui part au serveur est bati champ par champ par
// `buildDraftPayloadFromPack`, qui ne recopie JAMAIS le pack en bloc et
// n emporte pas `snapshotPlayers`. Le dernier temoin ci-dessous le fige : sans
// lui, ajouter ce champ risquerait d envoyer au serveur un instantane fabrique
// par le client, alors que le serveur en est la seule autorite.
// ==========================================================================
describe('COMPOLECT-2 — un pack publie garde ses PERSONNES, pas seulement ses placements', () => {
  const JOSAN = { documentId: 'josan-1', firstname: 'Josan', lastname: 'Micheal' };

  const packPublieUnSeulPlace = {
    manualPlayers: [],
    reservePlayerIds: [],
    schemaVersion: 3,
    snapshotPlayers: [JOSAN],
    sportContext: 'handball',
    teams: [{
      id: 'team_1',
      name: 'U18 RM1',
      placements: [{
        playerId: 'josan-1', positionX: 50, positionY: 12, slotId: 'team_1:slot_1',
      }],
    }],
  };

  test('🥇 LE TEMOIN D ARRET : la personne du SEUL joueur place survit au normaliseur', () => {
    const normalise = normalizeMultiTeamPack(packPublieUnSeulPlace, {
      availablePresets: [],
      sportContext: 'handball',
    });

    expect(normalise.snapshotPlayers).toEqual([JOSAN]);
  });

  test('🥇 et elle survit jusqu a la branche que lit l ecran de lecture seule', () => {
    const [branche] = buildPublishedBranchesFromPack(packPublieUnSeulPlace, 'U18 RM1');

    // C'est EXACTEMENT la lecture que fait `MultiTeamCompositionBoard:1164`.
    const index = new Map(
      (branche?.published?.snapshotPlayers || []).map((p) => [p.documentId, p]),
    );
    const placement = branche.published.teams[0].placements[0];

    expect(index.get(placement.playerId)).toEqual(JOSAN);
  });

  test('🔒 le placement lui-meme n a jamais bouge — ce n est pas lui qui manquait', () => {
    const [branche] = buildPublishedBranchesFromPack(packPublieUnSeulPlace, 'U18 RM1');

    expect(branche.published.teams[0].placements).toHaveLength(1);
    expect(branche.published.teams[0].placements[0].playerId).toBe('josan-1');
  });

  test('🔒 LE GARDE-FOU : la charge envoyee au serveur n emporte PAS snapshotPlayers', () => {
    // ⛔ Le serveur est la SEULE autorite sur l instantane (`buildSnapshotPlayer`).
    // Si un jour cette charge se mettait a le porter, le client ecraserait la
    // photo des personnes prise a la publication.
    const charge = buildDraftPayloadFromPack(packPublieUnSeulPlace, [JOSAN]);

    expect(charge.snapshotPlayers).toBeUndefined();
  });
});

// 👥 LOT COMPO (2026-09-05) — LE BANC NE COMPTE PAS DEUX FOIS LA MEME PERSONNE.
//
// 🚨 CE QUE J'AI VU EN CHEMIN, en lisant `getReservePlayersForPack` pour le
// defaut du poste occupe : la liste du banc part de `reservePlayerIds` TEL QUEL,
// puis y ajoute les non-affectes. Or `reservePlayerIds` est ecrit a
// l'ENREGISTREMENT et n'est jamais nettoye quand un jeton part sur le terrain.
// ⇒ On rouvre une compo enregistree, on glisse un remplacant sur un poste, et il
// reste AUSSI affiche au banc. Le coach voit 12 noms au banc pour 11 personnes,
// et il ne peut pas savoir laquelle est en double.
//
// C'est le meme symptome que le defaut principal vu par l'autre bout : le
// compteur du banc ment.
describe('COMPO — pose sur le terrain, il quitte le banc meme s il etait en reserve', () => {
  const AVEC_RESERVE_PERIMEE = {
    manualPlayers: [],
    mode: 'manual',
    placementMode: 'slots',
    // Ce que l'enregistrement precedent avait fige : les 2 etaient au banc.
    reservePlayerIds: ['player-1', 'player-2'],
    reserveSnapshotPlayers: [],
    schemaVersion: 3,
    sportContext: 'football',
    teams: [{
      id: 'team_1',
      name: 'Equipe 1',
      // ... et depuis, player-1 a ete pose sur un poste.
      placements: [{
        playerId: 'player-1', positionX: 50, positionY: 12, slotId: 'team_1:gk',
      }],
      presetKey: '4-4-2',
      presetLabel: '4-4-2',
      slots: [],
    }],
  };
  const JOUEURS = [
    { documentId: 'player-1', firstname: 'Ana', lastname: 'Bern' },
    { documentId: 'player-2', firstname: 'Chloe', lastname: 'Diaz' },
  ];

  test('le banc ne montre QUE les joueurs qui ne sont pas sur le terrain', () => {
    expect(getReservePlayersForPack(AVEC_RESERVE_PERIMEE, JOUEURS).map((p) => p.documentId))
      .toEqual(['player-2']);
  });

  test('et la charge envoyee au serveur ne le range pas au banc non plus', () => {
    expect(buildDraftPayloadFromPack(AVEC_RESERVE_PERIMEE, JOUEURS).reservePlayerIds)
      .toEqual(['player-2']);
  });
});
