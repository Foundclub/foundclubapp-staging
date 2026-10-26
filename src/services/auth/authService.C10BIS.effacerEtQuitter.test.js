// C10BIS (BUGHUNT P2) — P11-01, P11-05, P11-02 : ce que `updateMe` et `leaveClub` envoient.
//
// P11-01 : vider un champ du profil ne partait jamais (`updateMe` retirait toute cle
//          `null` ou `''`). On ne renvoie PAS pour autant tous les vides : 15 appelants,
//          dont certains renvoient `null` ou `''` pour un champ que la personne n a pas
//          touche (geohash, e-mail, poste...). L effacement est donc EXPLICITE : l ecran
//          nomme les champs que la personne a vides (`clearFields`), et eux seuls partent
//          en `''` (le serveur les met a `null`).
// P11-05 : « Supprimer la photo » : `clearFields: ['avatar']` envoie `avatar: ''`.
// P11-02 : « Quitter le club » nomme le club affiche (`clubId`).

const mockPost = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:1337'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => ({ token: 'jeton-de-test' })),
}));

jest.mock('@/platform/auth', () => ({
  confirmOtp: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendOtp: jest.fn(),
}));

jest.mock('@/platform/device', () => ({
  getAppVersion: jest.fn(() => '1.0.0'),
  getDeviceId: jest.fn(() => 'device-id'),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'http://127.0.0.1:1337' },
    get: jest.fn(),
    post: mockPost,
    put: jest.fn(),
  },
}));

const { leaveClub, updateMe } = require('./authService');

class FormDataDeTest {
  constructor() { this.entrees = []; }

  append(cle, valeur) { this.entrees.push([cle, valeur]); }
}

let corpsEnvoye = null;

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = FormDataDeTest;
  corpsEnvoye = null;
  global.fetch = jest.fn(async (url, options) => {
    corpsEnvoye = options.body;
    return {
      json: async () => ({
        data: {
          documentId: 'user-42',
          firstname: 'Ada',
          id: 42,
          lastname: 'L',
          phoneNumber: '+33600000000',
        },
      }),
      ok: true,
      status: 200,
    };
  });
});

const envoye = () => Object.fromEntries(corpsEnvoye.entrees);

describe('updateMe — effacer un champ (P11-01)', () => {
  it('un champ vide par la personne (clearFields) part en « » : le serveur l efface', async () => {
    await updateMe({
      clearFields: ['nationality', 'position', 'weight', 'jerseyNumber'],
      firstname: 'Ada',
      jerseyNumber: null,
      nationality: '',
      position: null,
      weight: '',
    });

    const corps = envoye();
    expect(corps.nationality).toBe('');
    expect(corps.position).toBe('');
    expect(corps.weight).toBe('');
    expect(corps.jerseyNumber).toBe('');
    expect('clearFields' in corps).toBe(false);
  });

  it('un vide NON nomme reste retire : rien d intouche n est efface', async () => {
    await updateMe({
      email: '',
      firstname: 'Ada',
      geohash: null,
      position: null,
    });

    const corps = envoye();
    expect('email' in corps).toBe(false);
    expect('geohash' in corps).toBe(false);
    expect('position' in corps).toBe(false);
    expect(corps.firstname).toBe('Ada');
  });

  it('un champ nomme mais rempli part avec sa valeur', async () => {
    await updateMe({ clearFields: ['position'], position: 'Pivot' });

    expect(envoye().position).toBe('Pivot');
  });
});

describe('updateMe — supprimer la photo (P11-05)', () => {
  it('clearFields avatar sans nouvelle photo envoie avatar « »', async () => {
    await updateMe({
      avatar: undefined,
      clearFields: ['avatar'],
      firstname: 'Ada',
    });

    expect(envoye().avatar).toBe('');
  });

  it('une nouvelle photo choisie gagne : le fichier part, pas l effacement', async () => {
    await updateMe({
      avatar: { mime: 'image/jpeg', path: 'file:///tmp/a.jpg' },
      clearFields: ['avatar'],
    });

    const avatars = corpsEnvoye.entrees.filter(([cle]) => cle === 'avatar');
    expect(avatars).toHaveLength(1);
    expect(typeof avatars[0][1]).toBe('object');
  });

  it('sans clearFields, la photo existante n est jamais retiree', async () => {
    await updateMe({ avatar: { url: '/uploads/a.jpg' }, firstname: 'Ada' });

    expect('avatar' in envoye()).toBe(false);
  });
});

describe('leaveClub — le club affiche (P11-02)', () => {
  it('nomme le club qu on quitte', async () => {
    mockPost.mockResolvedValue({ data: { message: 'ok' } });

    await leaveClub('club-B');

    expect(mockPost).toHaveBeenCalledWith('/firebase-auth/me/leave-club', { clubId: 'club-B' });
  });

  it('sans club, la requete reste celle d avant (le serveur prend le club actif)', async () => {
    mockPost.mockResolvedValue({ data: { message: 'ok' } });

    await leaveClub();

    expect(mockPost).toHaveBeenCalledWith('/firebase-auth/me/leave-club', {});
  });
});
