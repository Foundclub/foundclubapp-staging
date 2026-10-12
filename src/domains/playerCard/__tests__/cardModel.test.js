// Port jest du harnais pur (perimetre identique a cardLogic.harness.mjs).
// A executer dans le projet app : `yarn jest cardModel`.
import {
  buildPlayerCardModel, computeAge, computeCompleteness, computeRarity, countHistoryClubs,
  evaluateMinorGuard, extractCity, groupHistory, pickTopHistory, RARITY, resolveJerseyNumber,
} from '../cardModel';

const NOW = new Date('2026-07-11T12:00:00Z');

describe('cardModel - logique pure carte joueur', () => {
  test('computeAge', () => {
    expect(computeAge('2000-07-11', NOW)).toBe(26);
    expect(computeAge('2000-07-12', NOW)).toBe(25);
    expect(computeAge(null, NOW)).toBeNull();
    expect(computeAge('pas-une-date', NOW)).toBeNull();
  });

  test('extractCity', () => {
    expect(extractCity({ city: 'Lyon' })).toBe('Lyon');
    expect(extractCity('{"town":"Bron"}')).toBe('Bron');
    expect(extractCity(null)).toBe('');
    expect(extractCity('texte-libre')).toBe('');
  });

  test('pickTopHistory tri actif->recent, limite 3', () => {
    const hs = [
      { club: { name: 'A' }, endYear: 2020, startYear: 2018 },
      {
        customClubName: 'B', isCurrentlyActive: true, level: { name: 'National' }, startYear: 2022,
      },
      { endYear: 2022, multisport_club: { name: 'C' }, startYear: 2021 },
      { customClubName: 'D', endYear: 2012, startYear: 2010 },
    ];
    const top = pickTopHistory(hs, 3);
    expect(top).toHaveLength(3);
    expect(top[0].clubName).toBe('B');
    expect(top[0].isCurrentlyActive).toBe(true);
    expect(top[1].clubName).toBe('C');
    expect(top[2].clubName).toBe('A');
  });

  test('computeCompleteness 0..100', () => {
    expect(computeCompleteness({}, [])).toBe(0);
    expect(computeCompleteness({
      address: { city: 'Lyon' },
      avatar: { url: 'x' },
      bestLevel: 'National',
      birthdate: '2000-01-01',
      firstname: 'A',
      lastname: 'B',
      nationality: 'FR',
      position: 'Ailier',
      preferredSport: 'Football',
    }, [{}, {}, {}])).toBe(100);
  });

  test('computeRarity paliers', () => {
    expect(computeRarity({ completeness: 0 }).rarity).toBe(RARITY.COMMON);
    const high = computeRarity({
      bestLevel: 'Professionnel',
      completeness: 100,
      topHistory: [{ level: 'National' }, { level: 'Regional' }, { level: 'National' }],
    });
    expect(high.rarity).toBe(RARITY.LEGENDARY);
    expect(high.score).toBeGreaterThanOrEqual(85);
  });

  test('evaluateMinorGuard', () => {
    expect(evaluateMinorGuard({ birthdate: '2000-01-01' }, NOW).canPublish).toBe(true);
    const child = evaluateMinorGuard({ birthdate: '2015-01-01' }, NOW);
    expect(child.requiresConsent).toBe(true);
    expect(child.canPublish).toBe(false);
    expect(evaluateMinorGuard({ birthdate: '2015-01-01', parentalDeclarationAccepted: true }, NOW).canPublish).toBe(true);
    expect(evaluateMinorGuard({ birthdate: '2015-01-01', cardConsentAcceptedAt: '2026-01-01' }, NOW).canPublish).toBe(true);
    const teen = evaluateMinorGuard({ birthdate: '2009-01-01' }, NOW);
    expect(teen.isMinor).toBe(true);
    expect(teen.requiresConsent).toBe(false);
    expect(teen.canPublish).toBe(true);
  });

  test('resolveJerseyNumber deterministe + explicite', () => {
    const n1 = resolveJerseyNumber({ documentId: 'abc123' });
    expect(n1).toBe(resolveJerseyNumber({ documentId: 'abc123' }));
    expect(n1).toBeGreaterThanOrEqual(1);
    expect(n1).toBeLessThanOrEqual(99);
    expect(resolveJerseyNumber({ jerseyNumber: 10 })).toBe(10);
  });

  test('buildPlayerCardModel SANS CLUB + dispo', () => {
    const model = buildPlayerCardModel({
      histories: [{
        customClubName: 'OL', isCurrentlyActive: true, level: { name: 'National' }, startYear: 2023,
      }],
      now: NOW,
      qrUrl: 'https://foundclub.app/install.html?source=card',
      user: {
        address: { city: 'Lyon' },
        birthdate: '2005-03-01',
        club: null,
        documentId: 'u1',
        firstname: 'Sofia',
        isLookingForClub: true,
        lastname: 'martin',
        nationality: 'FR',
        position: 'Milieu',
        preferredSport: 'Football',
      },
    });
    expect(model.lastname).toBe('MARTIN');
    expect(model.hasClub).toBe(false);
    expect(model.isAvailable).toBe(true);
    expect(model.age).toBe(21);
    expect(model.history).toHaveLength(1);
    expect(Object.values(RARITY)).toContain(model.rarity);
  });

  test('mineur <15 sans consentement => photo masquee (fallback dos)', () => {
    const model = buildPlayerCardModel({
      now: NOW,
      user: {
        avatar: { url: 'https://cdn/leo.jpg' },
        birthdate: '2015-01-01',
        documentId: 'kid',
        firstname: 'Leo',
        lastname: 'petit',
      },
    });
    expect(model.guard.canPublish).toBe(false);
    expect(model.hasPhoto).toBe(false);
    expect(model.photoUrl).toBeNull();
  });

  test('mineur <15 avec consentement => photo autorisee', () => {
    const model = buildPlayerCardModel({
      now: NOW,
      user: {
        avatar: { url: 'https://cdn/leo.jpg' },
        birthdate: '2015-01-01',
        documentId: 'kid',
        firstname: 'Leo',
        lastname: 'petit',
        parentalDeclarationAccepted: true,
      },
    });
    expect(model.hasPhoto).toBe(true);
    expect(model.photoUrl).toBe('https://cdn/leo.jpg');
  });
});

// PAR-L14 — une ligne par club et par saison ; le compteur compte des clubs.
describe('cardModel - historique regroupe (PAR-L14)', () => {
  const SPORTING = { name: 'Sporting Club Montredon Bonneveine' };
  const R1 = { name: 'Régional 1' };

  test('groupHistory reunit les categories d un meme club et d une meme saison', () => {
    const groupes = groupHistory([
      {
        category: { name: 'Seniors' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
      {
        category: { name: 'U20' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
      {
        category: { name: 'U17' }, club: SPORTING, endYear: 2019, startYear: 2017,
      },
    ]);
    expect(groupes).toEqual([
      {
        categories: ['Seniors', 'U20'],
        clubName: 'Sporting Club Montredon Bonneveine',
        endYear: 2022,
        isCurrentlyActive: false,
        levels: ['Régional 1'],
        startYear: 2020,
      },
      expect.objectContaining({ categories: ['U17'], levels: [], startYear: 2017 }),
    ]);
  });

  test('groupHistory : un nom saisi a la main avec une autre casse reste le meme club', () => {
    const groupes = groupHistory([
      { customClubName: 'AS Pennes ', endYear: 2016, startYear: 2014 },
      { customClubName: 'as pennes', endYear: 2016, startYear: 2014 },
    ]);
    expect(groupes).toHaveLength(1);
  });

  test('groupHistory : un club en cours n est pas confondu avec la meme saison terminee', () => {
    const groupes = groupHistory([
      { club: SPORTING, isCurrentlyActive: true, startYear: 2024 },
      { club: SPORTING, endYear: 2025, startYear: 2024 },
    ]);
    expect(groupes.map((g) => g.isCurrentlyActive)).toEqual([true, false]);
  });

  test('countHistoryClubs compte les clubs distincts, toutes saisons confondues', () => {
    expect(countHistoryClubs([
      { club: SPORTING, endYear: 2019, startYear: 2018 },
      { club: SPORTING, endYear: 2022, startYear: 2020 },
      { customClubName: 'ES Pennes', endYear: 2016, startYear: 2014 },
      { endYear: 2012, startYear: 2010 },
    ])).toBe(2);
    expect(countHistoryClubs(null)).toBe(0);
  });

  test('la rarete garde ses 3 lignes BRUTES : le regroupement ne change que l affichage', () => {
    const histories = [
      {
        category: { name: 'Seniors' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
      {
        category: { name: 'U20' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
    ];
    const model = buildPlayerCardModel({ histories, now: NOW, user: { documentId: 'x' } });
    expect(model.history).toHaveLength(2);
    expect(model.historyGroups).toHaveLength(1);
    expect(model.historyClubCount).toBe(1);
  });
});
