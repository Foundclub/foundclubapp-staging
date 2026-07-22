import {
  buildDraftPayloadFromPack,
  buildEmptyMultiTeamPack,
  getReservePlayersForPack,
  inferIsMultiTeamComposition,
  normalizeMultiTeamPack,
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
});
