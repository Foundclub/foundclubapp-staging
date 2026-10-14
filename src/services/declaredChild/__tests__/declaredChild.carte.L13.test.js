/**
 * PAR-L13 (13/10) — LA CARTE DE L ENFANT : ce qui part au serveur.
 *
 * ① La charge de la carte (maillot, poste, ville, nationalite) : ce qui n est pas saisi ne part
 *    pas ; vider un champ que l ecran MONTRAIT l efface (`null`), comme E09 (PAR-L5L6).
 * ② La photo part comme FICHIER, en multipart, par `PUT /declared-children/:id` (champ `photo`) :
 *    le serveur n accepte jamais un identifiant de fichier (admin PAR-L13, temoin ③).
 *    `fetch` natif, jeton en en-tete, sans `Content-Type` (motif de la photo d un groupe).
 */
import { buildChildCardPayload } from '../declaredChildRules';
import { setDeclaredChildPhoto } from '../declaredChildService';

jest.mock('../../client', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'https://api.test/api/' },
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => ({ token: 'jeton-du-parent' }),
}));

// La FormData de React Native (celle de l'appareil) : ses parties portent `fieldName` et `uri`.
const FormDataNative = jest.requireActual('react-native/Libraries/Network/FormData').default;
const FormDataDOrigine = global.FormData;

beforeEach(() => {
  jest.clearAllMocks();
  global.FormData = /** @type {any} */ (FormDataNative);
});

afterAll(() => {
  global.FormData = FormDataDOrigine;
});

describe('PAR-L13 — la charge de la carte', () => {
  test('🔴 maillot, poste, ville et nationalite saisis partent, propres', () => {
    expect(buildChildCardPayload({
      city: ' Marseille ', nationality: 'Française', number: '7', position: 'Meneuse',
    })).toEqual({
      city: 'Marseille', nationality: 'Française', number: 7, position: 'Meneuse',
    });
  });

  test('🔴 rien de saisi, rien d affiche : la charge est vide', () => {
    expect(buildChildCardPayload({
      city: '', nationality: '', number: '', position: '',
    }, {})).toEqual({});
  });

  test('🔴 vider un champ que l ecran MONTRAIT l efface (`null`)', () => {
    expect(buildChildCardPayload(
      {
        city: '', nationality: '', number: '', position: 'Meneuse',
      },
      {
        city: 'Marseille', nationality: 'Française', number: 7, position: 'Meneuse',
      },
    )).toEqual({
      city: null, nationality: null, number: null, position: 'Meneuse',
    });
  });

  test('un maillot n° 0 part en 0, pas en vide', () => {
    expect(buildChildCardPayload({ number: '0' })).toEqual({ number: 0 });
  });
});

describe('PAR-L13 — la photo part comme FICHIER', () => {
  test('🔴 PUT multipart, champ `photo`, jeton en en-tete, sans Content-Type', async () => {
    const fichier = { name: 'anissa.jpg', type: 'image/jpeg', uri: 'file:///tmp/anissa.jpg' };
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: { documentId: 'anissa', photo: { url: '/uploads/a.jpg' } } }),
      ok: true,
      status: 200,
    });

    const fiche = await setDeclaredChildPhoto('anissa', fichier);

    const [adresse, requete] = global.fetch.mock.calls[0];
    expect(adresse).toBe('https://api.test/api/declared-children/anissa');
    expect(requete.method).toBe('PUT');
    expect(requete.headers).toEqual({ Authorization: 'Bearer jeton-du-parent' });
    const parties = requete.body.getParts();
    expect(parties).toHaveLength(1);
    expect(parties[0]).toMatchObject({ fieldName: 'photo', uri: 'file:///tmp/anissa.jpg' });
    expect(fiche).toEqual({ documentId: 'anissa', photo: { url: '/uploads/a.jpg' } });
  });

  test('🔴 un refus du serveur garde son statut (la carte dit « Réessaie »)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ error: { message: 'Invalid file type' } }),
      ok: false,
      status: 400,
    });

    await expect(setDeclaredChildPhoto('anissa', { uri: 'x' })).rejects.toMatchObject({
      message: 'Invalid file type',
      response: { status: 400 },
    });
  });
});
