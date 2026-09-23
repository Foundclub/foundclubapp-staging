import {
  buildPublishedBoardTarget,
  findPublishedBranchForTeam,
  formatConvocationDay,
  resolveConvocationNote,
} from '../playerConvocationUtils';

// COMPOMSG — les trois recettes partagées par la carte du fil, « Tu es
// convoqué » et le plein écran. Une recette écrite trois fois finit toujours
// par rendre trois résultats.

const pack = (/** @type {any} */ extra = {}) => ({
  manualPlayers: [{ firstname: 'Jules', id: 'manual_1', isManual: true }],
  reservePlayerIds: ['j3'],
  reserveSnapshotPlayers: [{ documentId: 'j3', firstname: 'Paul', lastname: 'Veuillet' }],
  snapshotPlayers: [
    {
      avatar: { url: '/uploads/a.jpg' }, documentId: 'j1', firstname: 'Adel', lastname: 'Ferchichi',
    },
    { documentId: 'j2', firstname: 'Amin', lastname: 'Hsino' },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    placements: [
      { playerId: 'j1', positionX: 50, positionY: 20 },
      { playerId: 'manual_1', positionX: 80, positionY: 70 },
      { playerId: 'fantome', positionX: 10, positionY: 10 },
    ],
  }],
  version: 2,
  ...extra,
});

describe('COMPOMSG — buildPublishedBoardTarget', () => {
  test('🥇 titulaires (manuels compris) PUIS banc, placements appariés, version lue', () => {
    const cible = buildPublishedBoardTarget(pack(), { teamName: ' Senior 1 ' });

    expect(cible?.startPlacements.map((/** @type {any} */ p) => p.playerId))
      .toEqual(['j1', 'manual_1']);
    expect(cible?.selectedPlayers.map((/** @type {any} */ p) => p.documentId || p.id))
      .toEqual(['j1', 'manual_1', 'j3']);
    expect(cible?.selectedPlayers[0].avatar).toEqual({ url: '/uploads/a.jpg' });
    expect(cible?.publishedVersion).toBe(2);
    expect(cible?.sport).toBe('football');
    expect(cible?.teamName).toBe('Senior 1');
  });

  test('🔒 sans joueur placé : null — un terrain vide ferait croire à une compo perdue', () => {
    expect(buildPublishedBoardTarget(pack({ teams: [{ id: 't', placements: [] }] }))).toBeNull();
  });

  test('🔒 plusieurs équipes : null — le plateau n’en dessinerait qu’une', () => {
    const deux = pack();
    deux.teams = [...deux.teams, { id: 'team_2', placements: [] }];

    expect(buildPublishedBoardTarget(deux)).toBeNull();
  });

  test('🔒 une charge absente ou cassée ne lève jamais', () => {
    expect(buildPublishedBoardTarget(null)).toBeNull();
    expect(buildPublishedBoardTarget('texte')).toBeNull();
  });
});

describe('COMPOMSG — findPublishedBranchForTeam', () => {
  const brancheA = { published: pack(), team: { documentId: 'A' } };
  const brancheB = { published: pack({ version: 5 }), team: { documentId: 'B' } };

  test('🥇 la branche de l’équipe demandée, même si le lecteur n’y figure pas', () => {
    expect(findPublishedBranchForTeam({ branches: [brancheA, brancheB] }, 'B')).toBe(brancheB);
  });

  test('une seule branche : c’est elle, même sans équipe demandée', () => {
    expect(findPublishedBranchForTeam({ branches: [brancheA] }, '')).toBe(brancheA);
  });

  test('🔒 plusieurs branches et aucune équipe : on ne devine pas', () => {
    expect(findPublishedBranchForTeam({ branches: [brancheA, brancheB] }, '')).toBeNull();
  });

  test('la forme à plat est lue aussi', () => {
    const plat = { published: pack(), team: { documentId: 'A' } };

    expect(findPublishedBranchForTeam(plat, 'A')?.published).toBe(plat.published);
  });
});

describe('COMPOMSG — resolveConvocationNote', () => {
  test('🥇 le texte de l’entraîneur est rendu tel quel', () => {
    expect(resolveConvocationNote({ description: ' RDV 19h30 au stade ' }))
      .toBe('RDV 19h30 au stade');
  });

  test('🔒 rien, ou un texte déjà à l’écran : chaîne vide', () => {
    expect(resolveConvocationNote({})).toBe('');
    expect(resolveConvocationNote(null)).toBe('');
    expect(resolveConvocationNote({ description: 'Match vs US Pelican' }, ['match vs us pelican']))
      .toBe('');
  });
});

describe('COMPOMSG — formatConvocationDay', () => {
  test('🥇 le jour et la date, pas seulement l’heure', () => {
    const jour = formatConvocationDay('2026-09-28T16:00:00.000Z');

    expect(jour).toContain('28/09/2026');
    expect(jour).toMatch(/^lun\.?/);
  });

  test('🔒 une date absente ou illisible rend une chaîne vide', () => {
    expect(formatConvocationDay(null)).toBe('');
    expect(formatConvocationDay('pas une date')).toBe('');
  });
});
