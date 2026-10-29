/**
 * RECETTE-WEB-DIRIGEANT (29/10) — SUR LE SITE, LE LOGO D'UN PARTENAIRE OU DU CLUB N'ARRIVAIT PAS.
 *
 * Constaté sur le site local branché sur la recette (Karim B, AS Montrivage) : « Ajouter le
 * partenaire » répond 200, mais la fiche affiche « ? » à la place du logo. Le choix d'image du
 * site (`SelectAvatar.web.js`) rend le VRAI fichier du navigateur dans `file` ; le service
 * envoyait la forme du téléphone `{ uri, name, type }`, que le `FormData` du navigateur écrit
 * « [object Object] » : aucun fichier ne partait.
 *
 * Au téléphone, rien ne change : pas de `file`, la forme `{ uri, name, type }` part comme avant.
 */

const mockPut = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  })),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { put: mockPut },
}));

const { updateClub, uploadFile } = require('./clubService');

/** Un FormData qui note ce qu'on lui confie, sans rien transformer. */
class FormDataNote {
  constructor() {
    /** @type {Array<[string, any]>} */
    this.parties = [];
  }

  /**
   * Garde la valeur telle quelle.
   * @param {string} nom
   * @param {any} valeur
   */
  append(nom, valeur) {
    this.parties.push([nom, valeur]);
  }
}

/**
 * La valeur confiée sous ce nom à ce FormData.
 * @param {any} formData
 * @param {string} nom
 * @returns {any} La valeur.
 */
const partie = (formData, nom) => formData.parties.find(([n]) => n === nom)?.[1];

const fichierDuSite = () => {
  const file = new File(['png'], 'logo.png', { type: 'image/png' });
  return {
    file, filename: 'logo.png', mime: 'image/png', path: 'blob:http://localhost:5303/abc',
  };
};

// Même club que clubService.SPONSRV.dernierPartenaire.test.js (la réponse est validée).
const CLUB = {
  address: { city: 'Marseille', label: '1 rue du Stade' },
  clubPartner: false,
  documentId: 'club-1',
  id: 1,
  maxTeamNumber: 3,
  name: 'AS Exemple',
};

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = /** @type {any} */ (FormDataNote);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockPut.mockResolvedValue({ data: { data: CLUB } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('logos envoyés depuis le site (RWDIRIG)', () => {
  it('🔴 partenaire : le fichier du navigateur part tel quel', async () => {
    const logo = fichierDuSite();
    await updateClub({ ...CLUB, sponsor: [{ logo, title: 'Garage Durand' }] });

    const [, formData] = mockPut.mock.calls[0];
    expect(partie(formData, 'sponsor[0][logo]')).toBe(logo.file);
  });

  it('🔴 logo du club (fiche complète) : le fichier du navigateur part tel quel', async () => {
    const logo = fichierDuSite();
    await updateClub({ ...CLUB, logo });

    const [, formData] = mockPut.mock.calls[0];
    expect(partie(formData, 'files.logo')).toBe(logo.file);
  });

  it('🔴 logo du club (Modifier le club) : le téléversement porte le fichier', async () => {
    const logo = fichierDuSite();
    global.fetch = /** @type {any} */ (jest.fn(async () => ({
      json: async () => [{ id: 7 }], ok: true, status: 200, text: async () => '[{"id":7}]',
    })));

    await uploadFile(/** @type {any} */ (logo)).catch(() => {});

    const [, init] = /** @type {any} */ (global.fetch).mock.calls[0];
    expect(partie(init.body, 'files')).toBe(logo.file);
  });

  it('🔒 téléphone (sans `file`) : la forme { uri, name, type } part comme avant', async () => {
    await updateClub({
      ...CLUB,
      sponsor: [{ logo: { filename: 'l.jpg', mime: 'image/jpeg', path: 'file:///tmp/l.jpg' }, title: 'G' }],
    });

    const [, formData] = mockPut.mock.calls[0];
    expect(partie(formData, 'sponsor[0][logo]')).toEqual({
      name: 'l.jpg', type: 'image/jpeg', uri: '/tmp/l.jpg',
    });
  });
});
