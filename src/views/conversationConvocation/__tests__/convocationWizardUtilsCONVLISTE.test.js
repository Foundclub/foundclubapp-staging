import {
  buildLineupUpdateNotice,
  CONVOCATION_STEPS_LIST,
  findLastConvocationFormat,
} from '../convocationWizardUtils';

// 📋 CONVLISTE (26/10) — la regle « aucun joueur place = liste » (Q3 = C du chef), lue sur les
// cartes `lineup_share` deja chargees du fil : la reprise du dernier choix (planche A1) et la
// notice « passee en composition » (planche C4). Aucun serveur.

const TEAM = 'equipe';
const HUGO = { documentId: 'hugo', firstname: 'Hugo', lastname: 'Martin' };
const SAMI = { documentId: 'sami', firstname: 'Sami', lastname: 'Diallo' };

const carte = (/** @type {any} */ extra) => ({
  composition: {
    eventId: 'match',
    publishedAt: '2026-10-20T10:00:00.000Z',
    publishedVersion: 1,
    schemaVersion: 3,
    teamId: TEAM,
    type: 'lineup_share',
    ...extra,
  },
});

const enListe = (/** @type {any} */ extra = {}) => carte({
  reservePlayers: [HUGO, SAMI], snapshotPlayers: [], teams: [{ placements: [] }], ...extra,
});
const enComposition = (/** @type {any} */ extra = {}) => carte({
  reservePlayers: [SAMI],
  snapshotPlayers: [HUGO],
  teams: [{ placements: [{ playerId: 'hugo', positionX: 50, positionY: 80 }] }],
  ...extra,
});

describe('CONVLISTE · les etapes de la liste', () => {
  test('trois etapes : Evenement, Joueurs, Details', () => {
    expect(CONVOCATION_STEPS_LIST).toEqual(['event', 'players', 'details']);
  });
});

describe('CONVLISTE · le dernier choix de l equipe', () => {
  test('la carte la plus recente de l equipe decide ; sans carte, aucun choix', () => {
    expect(findLastConvocationFormat({ messages: [], teamId: TEAM })).toBe('');
    expect(findLastConvocationFormat({
      messages: [
        enComposition({ publishedAt: '2026-10-01T10:00:00.000Z' }),
        enListe({ eventId: 'autre', publishedAt: '2026-10-15T10:00:00.000Z' }),
      ],
      teamId: TEAM,
    })).toBe('list');
    expect(findLastConvocationFormat({
      messages: [enListe(), enComposition({ eventId: 'b', publishedAt: '2026-10-25T10:00:00Z' })],
      teamId: TEAM,
    })).toBe('pitch');
    // La carte d une AUTRE equipe ne compte pas.
    expect(findLastConvocationFormat({ messages: [enListe()], teamId: 'autre-equipe' })).toBe('');
  });
});

describe('CONVLISTE · la notice d une convocation qui change de mode', () => {
  test('liste (v1) → composition (v2), memes joueurs : « passee en composition »', () => {
    const v2 = enComposition({ publishedVersion: 2, reservePlayers: [SAMI] });
    const notice = buildLineupUpdateNotice({
      composition: v2.composition,
      messages: [enListe(), v2],
    });
    expect(notice).toEqual(expect.objectContaining({
      formatChange: 'toPitch', kind: 'changed', version: 2,
    }));
  });

  test('composition (v1) → liste (v2) : « passee en liste »', () => {
    const v2 = enListe({ publishedVersion: 2 });
    const notice = buildLineupUpdateNotice({
      composition: v2.composition,
      messages: [enComposition(), v2],
    });
    expect(notice?.formatChange).toBe('toList');
  });

  test('🔒 sans changement de mode, la notice d hier ne bouge pas', () => {
    const v2 = enComposition({ publishedVersion: 2 });
    const notice = buildLineupUpdateNotice({
      composition: v2.composition,
      messages: [enComposition(), v2],
    });
    expect(notice).toEqual(expect.objectContaining({ formatChange: '', kind: 'updated' }));
  });
});
