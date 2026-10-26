// CARTECODE (26/10/2026) — les règles de la carte joueur v2 (planche validée par Adel le 26/10,
// « 4- ok pour tout »), une par une, rouges avant le code.
import { canShowCardOnProfile, getCardConsentState } from '../cardConsent';
import {
  buildDeclaredChildCardProps, buildPlayerCardModel, CARD_FILL_TOTAL, CARD_SPORTS_WITH_POSITIONS,
  computeCardRarity, countCardFill,
} from '../cardModel';

const NOW = new Date('2026-10-26T12:00:00');
const COMPLET = {
  address: JSON.stringify({ city: 'Aix-en-Provence', postcode: '13090' }),
  avatar: { url: '/a.jpg' },
  bestLevel: 'Départemental 2',
  birthdate: '2000-03-14',
  category: 'Sénior',
  documentId: 'u162',
  firstname: 'Adel',
  height: 178,
  jerseyNumber: 9,
  lastname: 'Ferchichi',
  nationality: 'France',
  position: 'Attaquant',
  preferredSport: 'Football',
  section: { name: 'Masculine' },
  weight: 74,
};

describe('CARTECODE — le numéro n’est plus jamais fabriqué', () => {
  test('sans numéro enregistré, la carte n’en porte aucun', () => {
    const user = { documentId: 'u1', firstname: 'Samir' };
    const model = buildPlayerCardModel({ now: NOW, user });
    expect(model.number).toBeNull();
    expect(model.hasCustomNumber).toBe(false);
  });
  test('le 0 est un numéro', () => {
    expect(buildPlayerCardModel({ now: NOW, user: { jerseyNumber: 0 } }).number).toBe(0);
  });
});

describe('CARTECODE Q3 A — la bande du club', () => {
  test('le club du compte, son logo, et l’équipe dessous', () => {
    const user = {
      club: { documentId: 'c1', logo: { url: '/logo-aix.png' }, name: 'Aix-Perd en Buvette' },
      myTeams: [{ club: { documentId: 'c1', name: 'Aix-Perd en Buvette' }, name: 'Séniors B' }],
    };
    expect(buildPlayerCardModel({ now: NOW, user }).club).toEqual({
      logoUrl: '/logo-aix.png', name: 'Aix-Perd en Buvette', teamName: 'Séniors B',
    });
  });
  test('club vide : pris de l’équipe principale', () => {
    const user = { myTeams: [{ club: { logo: null, name: 'FC Fuveau' }, name: 'U17' }] };
    expect(buildPlayerCardModel({ now: NOW, user }).club)
      .toEqual({ logoUrl: null, name: 'FC Fuveau', teamName: 'U17' });
  });
  test('ni club ni équipe : pas de bande', () => {
    expect(buildPlayerCardModel({ now: NOW, user: {} }).club).toBeNull();
  });
});

describe('CARTECODE Q4 A — l’historique garde les logos', () => {
  test('un club enregistré garde son logo ; un club tapé à la main n’en a pas', () => {
    const histories = [
      {
        club: { logo: { url: '/smuc.png' }, name: 'SMUC' },
        isCurrentlyActive: true,
        startYear: 2024,
      },
      { customClubName: 'SC Montredon', endYear: 2022, startYear: 2020 },
      {
        endYear: 2019,
        multisport_club: { logo: { url: '/fuv.png' }, name: 'FC Fuveau' },
        startYear: 2009,
      },
    ];
    const groupes = buildPlayerCardModel({ histories, now: NOW, user: {} }).historyGroups;
    expect(groupes.map((g) => g.clubLogoUrl)).toEqual(['/smuc.png', null, '/fuv.png']);
  });
});

describe('CARTECODE Q5 B — la rareté', () => {
  test('les 13 cases d’une carte complète', () => {
    expect(CARD_FILL_TOTAL).toBe(13);
    expect(countCardFill(COMPLET)).toBe(13);
    expect(countCardFill({})).toBe(0);
  });
  test('la liste des sports à postes de la carte est celle de l’app', () => {
    expect(CARD_SPORTS_WITH_POSITIONS)
      .toEqual(jest.requireActual('@/constants/positions').SPORTS_WITH_POSITIONS);
  });
  test('un sport sans poste compte la case du poste comme remplie', () => {
    const tennis = { ...COMPLET, position: '', preferredSport: 'Tennis' };
    expect(countCardFill(tennis)).toBe(13);
    expect(countCardFill({ ...COMPLET, position: '' })).toBe(12);
  });
  test('barème : remplissage 50, parcours 15, vie dans FoundClub 35', () => {
    expect(computeCardRarity({ fill: 13 }).score).toBe(50);
    expect(computeCardRarity({ clubCount: 3, fill: 13 }).score).toBe(65);
    expect(computeCardRarity({ clubCount: 9, fill: 13 }).score).toBe(65);
    expect(computeCardRarity({ clubCount: 1, fill: 0 }).score).toBe(5);
    expect(computeCardRarity({ fill: 0, isTeamMember: true }).score).toBe(10);
    expect(computeCardRarity({ fill: 0, matchCount: 5 }).score).toBe(10);
    expect(computeCardRarity({ fill: 0, matchCount: 20 }).score).toBe(25);
    expect(computeCardRarity({
      clubCount: 3, fill: 13, isTeamMember: true, matchCount: 20,
    }).score).toBe(100);
  });
  test('paliers : <40 commune, 40-64 rare, 65-84 épique, ≥85 légendaire', () => {
    const palier = (fill, extra = {}) => computeCardRarity({ fill, ...extra }).rarity;
    expect(palier(10)).toBe('common'); // 38
    expect(palier(11)).toBe('rare'); // 42
    expect(palier(13, { clubCount: 3 })).toBe('epic'); // 65
    expect(palier(13, { clubCount: 3, isTeamMember: true, matchCount: 5 })).toBe('legendary'); // 85
  });
  test('le modèle de la carte suit le barème (membre d’une équipe, matchs)', () => {
    const model = buildPlayerCardModel({
      matchCount: 20, now: NOW, user: { ...COMPLET, myTeams: [{ name: 'Séniors' }] },
    });
    expect(model.rarityScore).toBe(50 + 10 + 25);
    expect(model.rarity).toBe('legendary');
  });
});

describe('CARTECODE Q6 B — âge inconnu : la date d’abord', () => {
  test('sans date, « Partager » demande d’abord la date', () => {
    expect(getCardConsentState({}, NOW).mustAskBirthdate).toBe(true);
    expect(getCardConsentState({ birthdate: '2000-03-14' }, NOW).mustAskBirthdate).toBe(false);
  });
});

describe('CARTECODE Q2 B — la carte sur le profil d’un autre', () => {
  const lecteur = { documentId: 'moi' };
  const voit = (profile, viewer = lecteur) => canShowCardOnProfile({ profile, viewer });
  test('majeur, compte non privé, membre connecté : oui', () => {
    expect(voit({ age: 26, documentId: 'x' })).toBe(true);
  });
  test('jamais pour un mineur, un âge inconnu, un compte privé ou sans connexion', () => {
    expect(voit({ age: 17, documentId: 'x' })).toBe(false);
    expect(voit({ age: null, documentId: 'x' })).toBe(false);
    expect(voit({ age: 26, documentId: 'x', isProfileVisible: false })).toBe(false);
    expect(voit({ age: 26, documentId: 'x' }, null)).toBe(false);
  });
});

describe('CARTECODE Q7 B — la carte d’un enfant reçoit les cases de son équipe', () => {
  test('sport, catégorie, niveau, section ; ni taille ni poids', () => {
    const props = buildDeclaredChildCardProps({
      enfant: {
        age: 10,
        firstname: 'Lina',
        team: {
          category: 'U11',
          level: 'Départemental',
          name: 'U11 F',
          section: 'Féminine',
          sport: 'Football',
        },
      },
    });
    expect(props).toEqual(expect.objectContaining({
      categorie: 'U11', niveau: 'Départemental', section: 'Féminine', sport: 'Football',
    }));
    expect('taille' in props).toBe(false);
    expect('poids' in props).toBe(false);
  });
});
