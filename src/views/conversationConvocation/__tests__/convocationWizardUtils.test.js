import {
  buildAnswerGroups,
  buildConvocationPack,
  buildConvocationRows,
  buildDetailsMessageText,
  buildEventSummary,
  buildLineupUpdateNotice,
  buildPitchPlacements,
  buildSelectionFromPack,
  canConvokeFromChat,
  clampPitchPercent,
  filterTeamEvents,
  findLastPublishedManualPlayers,
  isConvocableEvent,
  isLatestLineupComposition,
  selectWholeSquad,
  toggleConvocationSelection,
} from '../convocationWizardUtils';

// MESSAGERIE-1C — les regles de la convocation depuis le groupe d'equipe.
//
// Trois temoins portent le lot (prompt 1C, « temoins d'abord ») :
//   · un non-entraineur ne voit pas l'entree « Convocation » ;
//   · les joueurs a la main sont repris de la DERNIERE convocation publiee (« manuels B ») ;
//   · le pack publie porte les positions du terrain (`positionX` / `positionY`).

const TEAM = 'equipe-seniors';
const teamChat = { team: { documentId: TEAM }, type: 'team' };

const player = (documentId, firstname, lastname) => ({ documentId, firstname, lastname });
const manual = (documentId, firstname, lastname) => ({
  documentId, firstname, id: documentId, isManual: true, lastname,
});

const hugo = player('hugo', 'Hugo', 'Martin');
const sami = player('sami', 'Sami', 'Diallo');
const theo = player('theo', 'Théo', 'Garcia');
const rayan = player('rayan', 'Rayan', 'Delmaure');
const kevin = manual('manual_1', 'Kévin', 'Sans-Compte');
const leo = manual('manual_2', 'Léo', 'Hors-App');

describe('MESSAGERIE-1C · qui voit l entree « Convocation »', () => {
  test('un joueur (ni entraineur de l equipe, ni super-admin) ne la voit pas', () => {
    expect(canConvokeFromChat({
      chat: teamChat,
      user: { documentId: 'u1', role: { name: 'Joueur' }, trainedTeams: [] },
    })).toBe(false);
  });

  test('un entraineur d une AUTRE equipe ne la voit pas', () => {
    expect(canConvokeFromChat({
      chat: teamChat,
      user: { role: { name: 'Entraineur' }, trainedTeams: [{ documentId: 'autre-equipe' }] },
    })).toBe(false);
  });

  test('un dirigeant qui n entraine pas l equipe ne la voit pas (le serveur le refuserait)', () => {
    expect(canConvokeFromChat({
      chat: teamChat,
      user: { role: { name: 'Dirigeant' }, trainedTeams: [] },
    })).toBe(false);
  });

  test('un entraineur de l equipe la voit', () => {
    expect(canConvokeFromChat({
      chat: teamChat,
      user: { role: { name: 'Entraineur' }, trainedTeams: [{ documentId: TEAM }] },
    })).toBe(true);
  });

  test('le super-admin la voit', () => {
    expect(canConvokeFromChat({
      chat: teamChat,
      user: { role: { type: 'superadmin' }, trainedTeams: [] },
    })).toBe(true);
  });

  test('hors d un fil d equipe (groupe, prive), personne ne la voit', () => {
    const coach = { role: { name: 'Entraineur' }, trainedTeams: [{ documentId: TEAM }] };
    expect(canConvokeFromChat({ chat: { team: { documentId: TEAM }, type: 'group' }, user: coach }))
      .toBe(false);
    expect(canConvokeFromChat({ chat: { type: 'whisper' }, user: coach })).toBe(false);
  });
});

describe('MESSAGERIE-1C · « manuels B » : les joueurs a la main de la derniere convocation', () => {
  const lineup = (overrides) => ({
    composition: {
      eventId: 'match-1',
      manualPlayers: [],
      publishedAt: '2026-10-01T10:00:00.000Z',
      publishedVersion: 1,
      teamId: TEAM,
      type: 'lineup_share',
      ...overrides,
    },
  });

  test('repris du DERNIER message lineup_share du fil, pas d un plus ancien', () => {
    const messages = [
      lineup({ manualPlayers: [leo], publishedAt: '2026-09-20T10:00:00.000Z' }),
      { composition: null, message: 'Salut' },
      lineup({ manualPlayers: [kevin], publishedAt: '2026-10-01T10:00:00.000Z' }),
    ];
    expect(findLastPublishedManualPlayers({ messages, teamId: TEAM }).map((p) => p.documentId))
      .toEqual(['manual_1']);
  });

  test('une composition d une autre equipe n est jamais reprise', () => {
    const messages = [lineup({ manualPlayers: [leo], teamId: 'autre-equipe' })];
    expect(findLastPublishedManualPlayers({ messages, teamId: TEAM })).toEqual([]);
  });

  test('sans message charge : le « dernier match » que le serveur joint deja', () => {
    expect(findLastPublishedManualPlayers({
      bootstrap: { composition: { manualPlayers: [kevin] }, source: 'last_match' },
      messages: [],
      teamId: TEAM,
    }).map((p) => p.documentId)).toEqual(['manual_1']);
    expect(findLastPublishedManualPlayers({
      bootstrap: {
        composition: { manualPlayers: [] },
        lastMatch: { composition: { manualPlayers: [leo] }, source: 'last_match' },
        source: 'draft',
      },
      teamId: TEAM,
    }).map((p) => p.documentId)).toEqual(['manual_2']);
  });

  test('les reproposes arrivent DECOCHES, et « Retirer de la liste » les fait disparaitre', () => {
    const rows = buildConvocationRows({
      eligiblePlayers: [hugo, sami],
      removedIds: ['manual_2'],
      reproposedManualPlayers: [kevin, leo],
    });
    expect(rows.map((row) => row.id)).toEqual(['hugo', 'sami', 'manual_1']);
    expect(rows.find((row) => row.id === 'manual_1')?.isManual).toBe(true);
    expect(buildSelectionFromPack(null)).toEqual({});
  });

  test('« Tout l effectif » coche l effectif, jamais les joueurs a la main', () => {
    const rows = buildConvocationRows({
      eligiblePlayers: [hugo, sami], reproposedManualPlayers: [kevin],
    });
    expect(selectWholeSquad({}, rows)).toEqual({ hugo: 'pitch', sami: 'pitch' });
  });
});

describe('MESSAGERIE-1C · le pack publie', () => {
  test('les positions envoyees sont celles du terrain de l assistant', () => {
    const rows = buildConvocationRows({ eligiblePlayers: [hugo, sami, theo] });
    const pack = buildConvocationPack({
      placements: [
        { playerId: 'hugo', positionX: 22.5, positionY: 31 },
        { playerId: 'sami', positionX: 70, positionY: 64.4 },
      ],
      rows,
      selection: { hugo: 'pitch', sami: 'pitch', theo: 'bench' },
      sport: 'Football',
      teamName: 'Seniors',
    });

    expect(pack.teams[0].placements).toEqual([
      {
        playerId: 'hugo', positionX: 22.5, positionY: 31, slotId: null,
      },
      {
        playerId: 'sami', positionX: 70, positionY: 64.4, slotId: null,
      },
    ]);
    expect(pack.reservePlayerIds).toEqual(['theo']);
    expect(pack.selectedPlayerIds).toEqual(['hugo', 'sami', 'theo']);
    expect(pack.visibility).toBe('team');
    expect(pack.schemaVersion).toBe(3);
  });

  test('seuls les manuels COCHES partent (un decoche serait mis au banc par le serveur)', () => {
    const rows = buildConvocationRows({
      eligiblePlayers: [hugo], reproposedManualPlayers: [kevin, leo],
    });
    const pack = buildConvocationPack({
      rows,
      selection: { hugo: 'pitch', manual_1: 'bench' },
      sport: 'football',
    });
    expect(pack.manualPlayers.map((p) => p.documentId)).toEqual(['manual_1']);
    expect(pack.reservePlayerIds).toEqual(['manual_1']);
    expect(pack.selectedPlayerIds).not.toContain('manual_2');
  });

  test('« Demander Present / Absent » coupe part a false', () => {
    const rows = buildConvocationRows({ eligiblePlayers: [hugo] });
    expect(buildConvocationPack({
      requireResponse: false, rows, selection: { hugo: 'bench' }, sport: 'football',
    }).requireResponse).toBe(false);
  });

  test('un titulaire sans pastille posee prend un poste du 4-3-3, jamais le banc', () => {
    const rows = buildConvocationRows({ eligiblePlayers: [hugo] });
    const pack = buildConvocationPack({ rows, selection: { hugo: 'pitch' }, sport: 'football' });
    expect(pack.teams[0].placements).toEqual([{
      playerId: 'hugo', positionX: 50, positionY: 93, slotId: null,
    }]);
    expect(pack.reservePlayerIds).toEqual([]);
  });
});

describe('MESSAGERIE-1C · le terrain', () => {
  test('4-3-3 par defaut au football : le gardien en bas, puis les defenseurs', () => {
    const placements = buildPitchPlacements({ sport: 'football', starterIds: ['a', 'b', 'c'] });
    expect(placements.map((p) => [p.positionX, p.positionY]))
      .toEqual([[50, 93], [86, 76], [62, 79]]);
  });

  test('une pastille deja posee garde sa place, et son poste n est pas redonne', () => {
    const placements = buildPitchPlacements({
      placements: [{ playerId: 'a', positionX: 50, positionY: 93 }],
      sport: 'football',
      starterIds: ['a', 'b'],
    });
    expect(placements).toEqual([
      {
        playerId: 'a', positionX: 50, positionY: 93, slotId: null,
      },
      {
        playerId: 'b', positionX: 86, positionY: 76, slotId: null,
      },
    ]);
  });

  test('un sport sans terrain a postes : une rangee au milieu, jamais hors du terrain', () => {
    const placements = buildPitchPlacements({ sport: 'judo', starterIds: ['a', 'b'] });
    expect(placements.map((p) => [p.positionX, p.positionY])).toEqual([[14, 44], [32, 44]]);
    expect(clampPitchPercent(140)).toBe(95);
    expect(clampPitchPercent(-3)).toBe(5);
  });

  test('cocher puis decocher', () => {
    const once = toggleConvocationSelection({}, 'hugo');
    expect(once).toEqual({ hugo: 'pitch' });
    expect(toggleConvocationSelection(once, 'hugo')).toEqual({});
  });
});

describe('MESSAGERIE-1C · modifier une convocation publiee', () => {
  const published = {
    manualPlayers: [kevin],
    reservePlayerIds: ['theo', 'manual_1'],
    snapshotPlayers: [hugo, sami, theo, player('parti', 'Ancien', 'Joueur')],
    teams: [{
      placements: [
        { playerId: 'hugo', positionX: 50, positionY: 93 },
        { playerId: 'parti', positionX: 30, positionY: 50 },
      ],
    }],
  };

  test('la selection reprend le terrain et le banc publies', () => {
    expect(buildSelectionFromPack(published)).toEqual({
      hugo: 'pitch', manual_1: 'bench', parti: 'pitch', theo: 'bench',
    });
  });

  test('un convoque que l effectif ne connait plus reste dans la liste (sinon : retire)', () => {
    const rows = buildConvocationRows({
      eligiblePlayers: [hugo, sami, theo], publishedPack: published,
    });
    expect(rows.map((row) => row.id)).toEqual(['hugo', 'sami', 'theo', 'parti', 'manual_1']);
  });
});

describe('MESSAGERIE-1C · bloc « Reponses » : les joueurs a la main comptes presents', () => {
  test('un joueur a la main est dans « Presents », jamais dans « Sans reponse »', () => {
    const groups = buildAnswerGroups({
      published: {
        manualPlayers: [kevin],
        reservePlayerIds: ['manual_1'],
        snapshotPlayers: [hugo, sami, theo],
        teams: [{ placements: [{ playerId: 'hugo' }, { playerId: 'sami' }, { playerId: 'theo' }] }],
      },
      responses: { byPlayerId: { hugo: 'present', sami: 'absent', theo: 'pending' } },
    });
    expect(groups).toEqual({
      absent: ['Sami Diallo'],
      pending: ['Théo Garcia'],
      present: ['Hugo Martin', 'Kévin Sans-Compte'],
    });
  });
});

describe('MESSAGERIE-1C · notice « Composition modifiee »', () => {
  const version = (publishedVersion, starters, bench = []) => ({
    composition: {
      eventId: 'match-1',
      manualPlayers: [],
      placements: starters.map((p) => ({ playerId: p.documentId })),
      publishedVersion,
      reservePlayers: bench,
      snapshotPlayers: starters,
      teamId: TEAM,
      teams: [{ placements: starters.map((p) => ({ playerId: p.documentId })) }],
      type: 'lineup_share',
    },
  });

  test('« Rayan Delmaure remplace Sami Diallo »', () => {
    const v2 = version(2, [hugo, sami]);
    const v3 = version(3, [hugo, rayan]);
    expect(buildLineupUpdateNotice({ composition: v3.composition, messages: [v2, v3] })).toEqual({
      added: 1,
      entering: 'Rayan Delmaure',
      kind: 'replaced',
      leaving: 'Sami Diallo',
      removed: 1,
      version: 3,
    });
  });

  test('plusieurs changements : des comptes ; aucun : « mise a jour »', () => {
    const v1 = version(1, [hugo]);
    const v2 = version(2, [hugo, sami, theo]);
    expect(buildLineupUpdateNotice({ composition: v2.composition, messages: [v1, v2] }))
      .toMatchObject({ added: 2, kind: 'changed', removed: 0 });
    const v3 = version(3, [hugo, sami, theo]);
    expect(buildLineupUpdateNotice({ composition: v3.composition, messages: [v2, v3] }))
      .toMatchObject({ kind: 'updated', version: 3 });
  });

  test('une seule notice par composition : rien sur une version depassee, rien en v1', () => {
    const v2 = version(2, [hugo, sami]);
    const v3 = version(3, [hugo, rayan]);
    expect(buildLineupUpdateNotice({ composition: v2.composition, messages: [v2, v3] })).toBeNull();
    expect(isLatestLineupComposition({ composition: v2.composition, messages: [v2, v3] }))
      .toBe(false);
    expect(isLatestLineupComposition({ composition: v3.composition, messages: [v2, v3] }))
      .toBe(true);
    expect(buildLineupUpdateNotice({ composition: version(1, [hugo]).composition })).toBeNull();
  });
});

describe('MESSAGERIE-1C · le reste', () => {
  test('evenements de l equipe : organisatrice ou invitee, sans doublon, du plus proche', () => {
    const events = [
      { date: '2026-10-20T10:00:00Z', documentId: 'b', team: { documentId: TEAM } },
      { date: '2026-10-10T10:00:00Z', documentId: 'a', invitedTeams: [{ documentId: TEAM }] },
      { date: '2026-10-11T10:00:00Z', documentId: 'x', team: { documentId: 'autre' } },
      { date: '2026-10-20T10:00:00Z', documentId: 'b', team: { documentId: TEAM } },
    ];
    expect(filterTeamEvents(events, TEAM).map((event) => event.documentId)).toEqual(['a', 'b']);
  });

  test('le message « Rendez-vous / Infos » ne dit que ce qui est rempli', () => {
    expect(buildDetailsMessageText({ infos: ' maillot bleu ', meetingPoint: '13h30 au club' }))
      .toBe('Rendez-vous : 13h30 au club\nInfos : maillot bleu');
    expect(buildDetailsMessageText({ infos: '', meetingPoint: '  ' })).toBe('');
  });

  test('ni detection (pas de carte au fil), ni reservation, ni tournoi, ni stage parent', () => {
    expect(isConvocableEvent({ type: { name: 'Match' } })).toBe(true);
    expect(isConvocableEvent({ type: { name: 'Entraînement' } })).toBe(true);
    expect(isConvocableEvent({ type: { name: 'Détection' } })).toBe(false);
    expect(isConvocableEvent({ type: { name: 'Réservation' } })).toBe(false);
    expect(isConvocableEvent({ type: { name: 'Tournoi' } })).toBe(false);
    expect(isConvocableEvent({ eventFormat: 'stage_parent', type: { name: 'Stage' } })).toBe(false);
  });

  test('le rappel se lit sur une carte d evenement comme sur une convocation publiee', () => {
    expect(buildEventSummary({
      facility: { name: 'Stade Bonal' }, name: 'Match vs US Pelican', type: { name: 'Match' },
    })).toMatchObject({
      place: 'Stade Bonal', title: 'Match vs US Pelican', typeKey: 'match', typeLabel: 'Match',
    });
    expect(buildEventSummary({
      eventAddress: '12 rue du Stade', eventDisplayName: 'Entraînement', typeName: 'Entraînement',
    })).toMatchObject({ place: '12 rue du Stade', title: 'Entraînement', typeKey: 'training' });
  });
});
