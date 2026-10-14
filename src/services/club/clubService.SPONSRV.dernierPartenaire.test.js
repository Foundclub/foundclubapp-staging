/**
 * SPONSOR-SERVEUR (14/10) — RETIRER LE DERNIER PARTENAIRE SE DIT, IL NE SE DEVINE PLUS.
 *
 * Le serveur (admin `fix/SPONSRV-admin`) garde desormais les partenaires d'un club quand le
 * corps de PUT /clubs/:id/custom n'a pas de cle `sponsor` : avant, une cle absente les
 * effacait TOUS, sans meme passer par le controle d'abonnement `sponsor.manage`.
 *
 * Or c'est par cet effet de bord que l'app retirait le DERNIER partenaire : une liste vide
 * ne s'ecrit pas en multipart (aucun champ `sponsor[0][...]`). Il faut donc la DIRE : quand
 * l'appelant annonce `clearSponsors`, `updateClub` envoie `sponsor` present et VIDE.
 *
 * Et seulement dans ce cas : modifier les sports d'un club sans partenaire passe aussi une
 * liste vide (`...club`). L'envoyer comme « tout retirer » ferait demander `sponsor.manage`
 * a ces clubs (refus pour un club sans offre) — et, si la fiche est perimee, retirerait un
 * partenaire ajoute entre-temps par un autre dirigeant.
 */

const mockPut = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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

const { updateClub } = require('./clubService');

// La FormData de React Native (celle de l'appareil), pas celle de Node.
const FormDataNative = jest.requireActual('react-native/Libraries/Network/FormData').default;

const CLUB = {
  address: { city: 'Marseille', label: '1 rue du Stade' },
  clubPartner: false,
  documentId: 'club-1',
  id: 1,
  maxTeamNumber: 3,
  name: 'AS Exemple',
};

/**
 * Les champs envoyes au serveur par le dernier appel.
 * @returns {Array<[string, any]>} Les couples nom / valeur, dans l'ordre d'envoi.
 */
const champsEnvoyes = () => {
  const [, formData] = mockPut.mock.calls[mockPut.mock.calls.length - 1];
  return /** @type {any} */ (formData).getParts().map((/** @type {any} */ partie) => {
    const nom = /name="([^"]+)"/.exec(partie.headers['content-disposition'])?.[1];
    return [nom, partie.string ?? partie.uri];
  });
};

/**
 * Les noms des champs envoyes qui parlent des partenaires.
 * @returns {Array<[string, any]>} Les champs `sponsor` et `sponsor[...]`.
 */
const champsDesPartenaires = () => champsEnvoyes()
  .filter(([nom]) => nom === 'sponsor' || nom.startsWith('sponsor['));

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = /** @type {any} */ (FormDataNative);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockPut.mockResolvedValue({ data: { data: CLUB } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('updateClub — retirer le DERNIER partenaire (SPONSRV)', () => {
  it('🔴 retirer le dernier : `sponsor` part present et VIDE', async () => {
    await updateClub({ ...CLUB, clearSponsors: true, sponsor: [] });

    expect(champsDesPartenaires()).toEqual([['sponsor', '']]);
  });

  it('🔴 l intention ne part jamais comme un champ du club', async () => {
    await updateClub({ ...CLUB, clearSponsors: true, sponsor: [] });
    await updateClub({ ...CLUB, clearSponsors: false, sponsor: [] });

    mockPut.mock.calls.forEach(([, formData]) => {
      const noms = /** @type {any} */ (formData).getParts()
        .map((/** @type {any} */ partie) => partie.headers['content-disposition']);
      expect(noms.join(' ')).not.toContain('clearSponsors');
    });
  });

  it('🔒 une liste vide SANS intention (modifier les sports) ne parle pas des partenaires', async () => {
    await updateClub({ ...CLUB, activites: ['sport-1'], sponsor: [] });

    expect(champsDesPartenaires()).toEqual([]);
  });

  it('🔒 une liste non vide part comme avant, sans valeur vide en plus', async () => {
    await updateClub({
      ...CLUB,
      clearSponsors: true,
      sponsor: [{ id: 12, link: null, title: 'Garage Durand' }],
    });

    expect(champsDesPartenaires()).toEqual([
      ['sponsor[0][title]', 'Garage Durand'],
      ['sponsor[0][id]', '12'],
    ]);
  });
});
