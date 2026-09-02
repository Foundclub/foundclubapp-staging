// LOT ENFANTS — B7-A, MOITIE BASSE : `updateMe` JETAIT LA RAISON DU REFUS.
//
// ---------------------------------------------------------------------------
// ☠️ LE DEFAUT, MESURE LE 2026-09-02
// ---------------------------------------------------------------------------
//
// L ecran « Qui es-tu ? » envoie prenom + nom + date de naissance en UN SEUL
// appel. Pour un mineur de moins de 15 ans, le serveur repond 400 en disant
// PRECISEMENT pourquoi, dans `error.details.details.scope` :
// `minor_parental_declaration`. C est la seule chose qui distingue ce refus
// d une panne — le commentaire serveur (`firebase-auth.ts:1152-1154`) affirmait
// d ailleurs que « l app se cale sur details.scope ».
//
// Or `updateMe` faisait `throw new Error(message)` : le corps de la reponse
// etait lu, puis JETE. L ecran ne recevait qu un texte, affichait « Erreur », et
// AUCUN enfant de moins de 15 ans ne pouvait finir son inscription.
//
// ⇒ Ce temoin ne teste pas un ecran : il teste que la RAISON voyage.

const mockGet = jest.fn();
const mockPut = jest.fn();

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
    get: mockGet,
    put: mockPut,
  },
}));

const { updateMe } = require('./authService');

// jest.requireActual, et pas un require nu : les deux regles de tri des
// imports de ce depot se contredisent sur ces deux lignes (import/order veut
// l alias avant le chemin relatif, perfectionist/sort-imports l inverse), et
// aucun ordre ne rend zero erreur. Un appel de fonction echappe aux deux --
// et le temoin garde ce qui compte : il lit la VRAIE constante, jamais une
// chaine recopiee qui survivrait a un renommage.
const {
  MINOR_PARENTAL_DECLARATION_SCOPE,
} = jest.requireActual('@/constants/parentalDeclaration');

// Le corps EXACT que Strapi renvoie pour ce refus : `ctx.badRequest(message,
// { code, details, error })` range son second argument dans `error.details`.
// La portee est donc DEUX crans plus bas, et c est precisement ce qui rend un
// `new Error(message)` incapable de la voir.
const CORPS_DU_REFUS_400 = {
  data: null,
  error: {
    details: {
      code: 'VALIDATION_ERROR',
      details: {
        requiredUnderAge: 15,
        scope: 'minor_parental_declaration',
      },
      error: 'Parental declaration is required for users under 15 years old',
    },
    message: 'Parental declaration is required for users under 15 years old',
    name: 'BadRequestError',
    status: 400,
  },
};

beforeAll(() => {
  if (typeof global.FormData === 'undefined') {
    global.FormData = class FormDataDeTest {
      constructor() { this.entrees = []; }

      append(cle, valeur) { this.entrees.push([cle, valeur]); }
    };
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateMe — la raison du refus voyage jusqu a l ecran (B7-A)', () => {
  it('un 400 « declaration parentale » arrive avec sa portee lisible', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => CORPS_DU_REFUS_400,
      ok: false,
      status: 400,
    }));

    const erreur = await updateMe({
      birthdate: '2012-06-12',
      firstname: 'Lea',
      lastname: 'Martin',
    }).then(
      () => null,
      (e) => e,
    );

    expect(erreur).toBeTruthy();
    // C EST LA LIGNE QUI COMPTE : sans elle, l ecran ne peut pas distinguer ce
    // refus d une panne reseau, et il affiche « Erreur ».
    expect(erreur?.details?.details?.scope).toBe(MINOR_PARENTAL_DECLARATION_SCOPE);
    expect(erreur?.status).toBe(400);
  });

  it('le message affichable ne change pas : ce lot AJOUTE, il ne retire rien', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => CORPS_DU_REFUS_400,
      ok: false,
      status: 400,
    }));

    const erreur = await updateMe({ firstname: 'Lea' }).then(() => null, (e) => e);

    expect(String(erreur?.message)).toBe(
      'Failed to update user data: Parental declaration is required for users under 15 years old',
    );
  });

  it('une reponse sans corps JSON reste une erreur lisible, sans raison inventee', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => { throw new Error('pas de JSON'); },
      ok: false,
      status: 500,
    }));

    const erreur = await updateMe({ firstname: 'Lea' }).then(() => null, (e) => e);

    expect(String(erreur?.message)).toBe('Failed to update user data: HTTP error 500');
    expect(erreur?.details?.details?.scope).toBeUndefined();
  });
});
