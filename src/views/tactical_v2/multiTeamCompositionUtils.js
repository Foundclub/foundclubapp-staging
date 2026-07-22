// @ts-nocheck
/* eslint-disable no-nested-ternary */
const MAX_COMPOSITION_TEAMS = 8;

const repairCommonMojibake = (value) => String(value || '')
  .replace(/Ã‰/g, 'E')
  .replace(/Ã©/g, 'e')
  .replace(/Ã¨/g, 'e')
  .replace(/Ãª/g, 'e')
  .replace(/Ã«/g, 'e')
  .replace(/Ã€/g, 'A')
  .replace(/Ã /g, 'a')
  .replace(/Ã¢/g, 'a')
  .replace(/Ã¹/g, 'u')
  .replace(/Ã»/g, 'u')
  .replace(/Ã´/g, 'o')
  .replace(/Ã®/g, 'i')
  .replace(/Ã¯/g, 'i')
  .replace(/â€™/g, "'")
  .replace(/â€œ/g, '"')
  .replace(/â€\x9d/g, '"')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Mode de placement du pack : 'free' = positions libres conservées telles quelles ;
// 'slots' = les joueurs sont accrochés aux postes de la formation. Défaut 'slots'
// (compatible avec les anciens packs). Aligné sur le backend event-composition.
const normalizePlacementMode = (value) => (
  String(value || '').trim().toLowerCase() === 'free' ? 'free' : 'slots'
);

export const sanitizeCompositionText = (value) => repairCommonMojibake(value).trim();

const normalizeText = (value) => sanitizeCompositionText(value);

const uniqueIds = (values = []) => Array.from(
  new Set(values.map((value) => normalizeText(value)).filter(Boolean)),
);

export const getCompositionPlayerId = (player) => normalizeText(player?.documentId || player?.id || '');

export const getCompositionPlayerLabel = (player) => (
  `${normalizeText(player?.firstname)} ${normalizeText(player?.lastname)}`.trim()
  || normalizeText(player?.name)
  || 'Joueur'
);

export const getCompositionPlayerInitials = (player) => {
  const label = getCompositionPlayerLabel(player);
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
};

export const normalizeAvailablePresets = (presets = []) => (
  Array.isArray(presets)
    ? presets
      .map((preset, presetIndex) => {
        const key = normalizeText(preset?.key || preset?.presetKey || `preset_${presetIndex + 1}`);
        if (!key) return null;
        const label = normalizeText(preset?.label || key) || key;
        const slots = Array.isArray(preset?.slots)
          ? preset.slots.map((slot, slotIndex) => ({
            fallbackFamily: normalizeText(slot?.fallbackFamily) || null,
            key: normalizeText(slot?.key || slot?.slotKey || `slot_${slotIndex + 1}`) || `slot_${slotIndex + 1}`,
            label: normalizeText(slot?.label || `Poste ${slotIndex + 1}`) || `Poste ${slotIndex + 1}`,
            positionX: toNumber(slot?.positionX, 50),
            positionY: toNumber(slot?.positionY, Math.min(88, 18 + (slotIndex * 9))),
            preferredPositions: Array.isArray(slot?.preferredPositions)
              ? slot.preferredPositions.map((value) => normalizeText(value)).filter(Boolean)
              : [],
          }))
          : [];

        return {
          key,
          label,
          maxPlayers: toNumber(preset?.maxPlayers, slots.length),
          slotCount: toNumber(preset?.slotCount, slots.length),
          slots,
        };
      })
      .filter(Boolean)
    : []
);

const buildLegacySlots = (placements = [], teamEntryId = 'team_1') => (
  placements.map((placement, index) => ({
    fallbackFamily: null,
    key: `legacy_${index + 1}`,
    label: `Placement ${index + 1}`,
    positionX: toNumber(placement?.positionX, 50),
    positionY: toNumber(placement?.positionY, Math.min(88, 18 + (index * 9))),
    preferredPositions: [],
    slotId: `${teamEntryId}:legacy_${index + 1}`,
    slotKey: `legacy_${index + 1}`,
  }))
);

const clonePresetSlots = (preset, teamEntryId) => (
  Array.isArray(preset?.slots)
    ? preset.slots.map((slot, slotIndex) => ({
      fallbackFamily: normalizeText(slot?.fallbackFamily) || null,
      label: normalizeText(slot?.label || `Poste ${slotIndex + 1}`) || `Poste ${slotIndex + 1}`,
      positionX: toNumber(slot?.positionX, 50),
      positionY: toNumber(slot?.positionY, Math.min(88, 18 + (slotIndex * 9))),
      preferredPositions: Array.isArray(slot?.preferredPositions)
        ? slot.preferredPositions.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      slotId: `${teamEntryId}:${normalizeText(slot?.key || slot?.slotKey || `slot_${slotIndex + 1}`) || `slot_${slotIndex + 1}`}`,
      slotKey: normalizeText(slot?.key || slot?.slotKey || `slot_${slotIndex + 1}`) || `slot_${slotIndex + 1}`,
    }))
    : []
);

const normalizePlacement = (placement, slotMap) => {
  const playerId = normalizeText(placement?.playerId);
  if (!playerId) return null;
  const slotId = normalizeText(placement?.slotId);
  const matchedSlot = slotId ? (slotMap.get(slotId) || null) : null;
  // Modèle hybride : la position envoyée fait foi (placement libre) ; à défaut,
  // celle du poste si connu, sinon le centre. On ne colle plus au premier slot libre
  // (fini le forçage des placements libres sur la formation).
  return {
    playerId,
    positionX: toNumber(placement?.positionX, matchedSlot ? toNumber(matchedSlot.positionX, 50) : 50),
    positionY: toNumber(placement?.positionY, matchedSlot ? toNumber(matchedSlot.positionY, 50) : 50),
    slotId: matchedSlot ? (matchedSlot.slotId || slotId) : null,
  };
};

export const buildTeamEntryFromPreset = (preset, index, sportContext, teamName = null, teamId = null) => {
  const teamEntryId = normalizeText(teamId || `team_${index + 1}`) || `team_${index + 1}`;
  return {
    id: teamEntryId,
    name: normalizeText(teamName || `Équipe ${index + 1}`) || `Équipe ${index + 1}`,
    placements: [],
    presetKey: normalizeText(preset?.key) || null,
    presetLabel: normalizeText(preset?.label) || null,
    slots: clonePresetSlots(preset, teamEntryId),
    sportContext: normalizeText(sportContext) || null,
  };
};

const normalizeTeamEntry = (team, index, presets, sportContext) => {
  const teamEntryId = normalizeText(team?.id) || `team_${index + 1}`;
  const preset = presets.find((entry) => entry.key === normalizeText(team?.presetKey))
    || presets.find((entry) => entry.label === normalizeText(team?.presetLabel))
    || presets[index]
    || presets[0]
    || null;
  const presetSlots = clonePresetSlots(preset, teamEntryId);
  const incomingSlots = Array.isArray(team?.slots) && team.slots.length > 0
    ? team.slots.map((slot, slotIndex) => ({
      fallbackFamily: normalizeText(slot?.fallbackFamily) || null,
      label: normalizeText(slot?.label || `Poste ${slotIndex + 1}`) || `Poste ${slotIndex + 1}`,
      positionX: toNumber(slot?.positionX, 50),
      positionY: toNumber(slot?.positionY, Math.min(88, 18 + (slotIndex * 9))),
      preferredPositions: Array.isArray(slot?.preferredPositions)
        ? slot.preferredPositions.map((value) => normalizeText(value)).filter(Boolean)
        : [],
      slotId: normalizeText(slot?.slotId || `${teamEntryId}:${slot?.slotKey || slot?.key || `slot_${slotIndex + 1}`}`),
      slotKey: normalizeText(slot?.slotKey || slot?.key || `slot_${slotIndex + 1}`) || `slot_${slotIndex + 1}`,
    }))
    : [];
  const legacyPlacements = Array.isArray(team?.placements) ? team.placements : [];
  const slots = incomingSlots.length > 0
    ? incomingSlots
    : (presetSlots.length > 0 ? presetSlots : buildLegacySlots(legacyPlacements, teamEntryId));
  const slotMap = new Map(slots.map((slot) => [slot.slotId, slot]));
  const placements = legacyPlacements
    .map((placement) => normalizePlacement(placement, slotMap))
    .filter(Boolean);

  return {
    id: teamEntryId,
    name: normalizeText(team?.name || `Équipe ${index + 1}`) || `Équipe ${index + 1}`,
    placements,
    presetKey: normalizeText(team?.presetKey || preset?.key) || null,
    presetLabel: normalizeText(team?.presetLabel || preset?.label) || null,
    slots,
    sportContext: normalizeText(team?.sportContext || sportContext) || null,
  };
};

export const buildEmptyMultiTeamPack = ({
  availablePresets = [],
  mode = 'manual',
  placementMode = 'slots',
  sportContext = null,
  teamCount = 1,
}) => {
  const presets = normalizeAvailablePresets(availablePresets);
  const normalizedTeamCount = Math.max(1, Math.min(MAX_COMPOSITION_TEAMS, Number(teamCount) || 1));
  return {
    manualPlayers: [],
    mode: mode === 'auto' ? 'auto' : 'manual',
    placementMode: normalizePlacementMode(placementMode),
    reservePlayerIds: [],
    reserveSnapshotPlayers: [],
    schemaVersion: 3,
    sportContext: normalizeText(sportContext) || null,
    teams: Array.from({ length: normalizedTeamCount }, (_, index) => buildTeamEntryFromPreset(
      presets[index] || presets[0] || null,
      index,
      sportContext,
    )),
    updatedAt: null,
    updatedBy: null,
  };
};

export const normalizeMultiTeamPack = (source, options = {}) => {
  const { availablePresets = [], sportContext = null } = options;
  const presets = normalizeAvailablePresets(availablePresets);
  if (!source || typeof source !== 'object') {
    return buildEmptyMultiTeamPack({ availablePresets: presets, sportContext });
  }

  const teamsSource = Array.isArray(source?.teams)
    ? source.teams
    : [];

  const legacySource = !teamsSource.length && Array.isArray(source?.placements)
    ? {
      mode: 'manual',
      teams: [{
        id: 'team_1',
        name: 'Équipe 1',
        placements: source.placements,
        presetKey: presets[0]?.key || null,
        presetLabel: presets[0]?.label || null,
        slots: [],
      }],
    }
    : source;

  const teams = (Array.isArray(legacySource?.teams) && legacySource.teams.length > 0
    ? legacySource.teams
    : buildEmptyMultiTeamPack({ availablePresets: presets, sportContext }).teams
  ).map((team, index) => normalizeTeamEntry(team, index, presets, sportContext));

  return {
    manualPlayers: Array.isArray(legacySource?.manualPlayers)
      ? legacySource.manualPlayers.map((player) => ({
        ...player,
        documentId: getCompositionPlayerId(player),
        id: getCompositionPlayerId(player),
        isManual: true,
      })).filter((player) => Boolean(player.id))
      : [],
    mode: legacySource?.mode === 'auto' ? 'auto' : 'manual',
    placementMode: normalizePlacementMode(legacySource?.placementMode),
    reservePlayerIds: uniqueIds(legacySource?.reservePlayerIds || []),
    reserveSnapshotPlayers: Array.isArray(legacySource?.reserveSnapshotPlayers)
      ? legacySource.reserveSnapshotPlayers
      : [],
    schemaVersion: 3,
    sportContext: normalizeText(legacySource?.sportContext || sportContext) || null,
    teams,
    updatedAt: legacySource?.updatedAt || null,
    updatedBy: legacySource?.updatedBy || null,
  };
};

export const buildCompositionPlayerMap = (players = []) => {
  const byId = new Map();
  (Array.isArray(players) ? players : []).forEach((player) => {
    const playerId = getCompositionPlayerId(player);
    if (!playerId || byId.has(playerId)) return;
    byId.set(playerId, {
      ...player,
      documentId: playerId,
      id: playerId,
    });
  });
  return byId;
};

export const getAssignedPlayerIdsFromPack = (pack) => uniqueIds(
  (Array.isArray(pack?.teams) ? pack.teams : [])
    .flatMap((team) => (Array.isArray(team?.placements) ? team.placements : []))
    .map((placement) => placement?.playerId),
);

export const getReservePlayersForPack = (pack, players = []) => {
  const playerMap = buildCompositionPlayerMap([
    ...(Array.isArray(players) ? players : []),
    ...(Array.isArray(pack?.manualPlayers) ? pack.manualPlayers : []),
    ...(Array.isArray(pack?.reserveSnapshotPlayers) ? pack.reserveSnapshotPlayers : []),
  ]);
  const assignedIds = new Set(getAssignedPlayerIdsFromPack(pack));
  const orderedIds = uniqueIds([
    ...(Array.isArray(pack?.reservePlayerIds) ? pack.reservePlayerIds : []),
    ...Array.from(playerMap.keys()).filter((playerId) => !assignedIds.has(playerId)),
  ]);

  return orderedIds
    .map((playerId) => playerMap.get(playerId))
    .filter(Boolean);
};

export const buildDraftPayloadFromPack = (pack, players = []) => {
  const playerMap = buildCompositionPlayerMap([
    ...(Array.isArray(players) ? players : []),
    ...(Array.isArray(pack?.manualPlayers) ? pack.manualPlayers : []),
  ]);
  const assignedIds = new Set(getAssignedPlayerIdsFromPack(pack));
  const reservePlayerIds = uniqueIds([
    ...(Array.isArray(pack?.reservePlayerIds) ? pack.reservePlayerIds : []),
    ...Array.from(playerMap.keys()).filter((playerId) => !assignedIds.has(playerId)),
  ]);

  return {
    manualPlayers: Array.from(playerMap.values()).filter((player) => Boolean(player?.isManual)),
    mode: pack?.mode === 'auto' ? 'auto' : 'manual',
    placementMode: normalizePlacementMode(pack?.placementMode),
    reservePlayerIds,
    schemaVersion: 3,
    sportContext: normalizeText(pack?.sportContext) || null,
    teams: (Array.isArray(pack?.teams) ? pack.teams : []).map((team, index) => ({
      id: normalizeText(team?.id) || `team_${index + 1}`,
      name: normalizeText(team?.name || `Équipe ${index + 1}`) || `Équipe ${index + 1}`,
      placements: (Array.isArray(team?.placements) ? team.placements : [])
        .map((placement) => {
          const playerId = normalizeText(placement?.playerId);
          if (!playerId) return null;
          const slotId = normalizeText(placement?.slotId);
          const slot = (Array.isArray(team?.slots) ? team.slots : []).find((entry) => normalizeText(entry?.slotId) === slotId) || null;
          return {
            playerId,
            positionX: slot ? toNumber(slot.positionX, 50) : toNumber(placement?.positionX, 50),
            positionY: slot ? toNumber(slot.positionY, 50) : toNumber(placement?.positionY, 50),
            slotId: slotId || null,
          };
        })
        .filter(Boolean),
      presetKey: normalizeText(team?.presetKey) || null,
      presetLabel: normalizeText(team?.presetLabel) || null,
      slots: (Array.isArray(team?.slots) ? team.slots : []).map((slot, slotIndex) => ({
        fallbackFamily: normalizeText(slot?.fallbackFamily) || null,
        label: normalizeText(slot?.label || `Poste ${slotIndex + 1}`) || `Poste ${slotIndex + 1}`,
        positionX: toNumber(slot?.positionX, 50),
        positionY: toNumber(slot?.positionY, Math.min(88, 18 + (slotIndex * 9))),
        preferredPositions: Array.isArray(slot?.preferredPositions)
          ? slot.preferredPositions.map((value) => normalizeText(value)).filter(Boolean)
          : [],
        slotId: normalizeText(slot?.slotId || `${team?.id || `team_${index + 1}`}:slot_${slotIndex + 1}`),
        slotKey: normalizeText(slot?.slotKey || slot?.key || `slot_${slotIndex + 1}`) || `slot_${slotIndex + 1}`,
      })),
    })),
  };
};

export const buildPublishedBranchesFromPack = (pack, teamName = null) => [{
  published: normalizeMultiTeamPack(pack, {
    availablePresets: [],
    sportContext: pack?.sportContext || null,
  }),
  team: {
    documentId: null,
    name: normalizeText(teamName || 'Equipe') || 'Equipe',
  },
  viewer: {
    inReserve: false,
    teamEntryIds: [],
  },
}];

export const replaceTeamPreset = (team, preset) => {
  const nextSlots = clonePresetSlots(preset, normalizeText(team?.id) || 'team_1');
  const currentPlacements = Array.isArray(team?.placements) ? team.placements : [];
  const nextPlacements = nextSlots.map((slot, index) => {
    const playerId = normalizeText(currentPlacements[index]?.playerId);
    if (!playerId) return null;
    return {
      playerId,
      positionX: toNumber(slot.positionX, 50),
      positionY: toNumber(slot.positionY, 50),
      slotId: slot.slotId,
    };
  }).filter(Boolean);

  return {
    ...team,
    placements: nextPlacements,
    presetKey: normalizeText(preset?.key) || null,
    presetLabel: normalizeText(preset?.label) || null,
    slots: nextSlots,
  };
};

export const inferIsMultiTeamComposition = (params = {}) => {
  if (Array.isArray(params?.aggregateBranches) && params.aggregateBranches.length > 0) {
    return true;
  }

  const composition = params?.existingComposition;
  return Boolean(
    params?.multiTeamComposition
      || Number(composition?.schemaVersion) === 3
      || Array.isArray(composition?.teams)
      || Array.isArray(composition?.reservePlayerIds)
      || Array.isArray(params?.teamComposition?.draft?.teams)
      || Array.isArray(params?.teamComposition?.published?.teams),
  );
};

export { MAX_COMPOSITION_TEAMS };
