/**
 * T11 — filet E6 : UN club sans adresse ne doit pas tuer TOUTE la liste.
 *
 * Recette Adel du 2026-08-17, onglet « Rechercher » → Club : la liste ne
 * s'affiche pas et l'ecran rend `"data[0].address" must be of type object`.
 *
 * CAUSE : la reponse etait validee EN BLOC. `Joi.object().optional()` accepte que
 * la CLE soit absente mais REFUSE la valeur `null` — or `address` est
 * `required: false` cote serveur (admin, club/schema.json) et vaut donc `null`
 * pour 3 clubs en PRODUCTION (mesure du 2026-08-17 : 222 346 clubs, 3 sans
 * adresse ; staging 86 881 / 3). Une seule ligne abimee faisait tomber les 7
 * autres clubs de la page.
 *
 * Meme defaut et meme correctif que S01 (`327cb34`) sur les demandes d'adhesion :
 * validation LIGNE PAR LIGNE, la ligne illisible est ECARTEE et NOMMEE, et
 * l'ENVELOPPE (meta/pagination) reste une erreur — on ne devine pas une pagination.
 */

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockLoggerWarn = jest.fn();

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
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: mockLoggerWarn,
  })),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    put: mockPut,
  },
}));

const { getClubById, getClubs, updateClubInfo } = require('./clubService');

const PAGINATION = {
  page: 1, pageCount: 1, pageSize: 7, total: 2,
};

const CLUB_SAIN = {
  address: { city: 'Marseille', label: '1 rue du Stade' },
  clubPartner: false,
  documentId: 'club-sain',
  id: 1,
  maxTeamNumber: 3,
  name: 'SMUC Football',
};

// Les 3 clubs reellement en cause en production, nommes le 2026-08-17 :
// ASSOCIATION SPORTIVE DU COLLEGE PABLO NERUDA DE PIERREFITTE, BOXING CLUB
// PIERREFITTE, EARL DU BIEF. Un import SIRENE sans adresse est un club NORMAL.
const CLUB_SANS_ADRESSE = {
  address: null,
  clubPartner: false,
  documentId: 'l24m8eivaioc6qg245kyg6gg',
  id: 86500,
  maxTeamNumber: 0,
  name: 'EARL DU BIEF',
};

/**
 * Reponse /clubs prete a servir.
 * @param {any[]} data - Les clubs renvoyes par le serveur.
 * @param {any} [meta] - L'enveloppe, pagination comprise.
 * @returns {{ data: { data: any[], meta: any } }} - La reponse axios simulee.
 */
const listResponse = (data, meta = { pagination: PAGINATION }) => ({
  data: { data, meta },
});

describe('T11 — un club sans adresse ne tue plus la liste de recherche', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 temoin 1 — UN club sans adresse laisse les autres s afficher', async () => {
    mockGet.mockResolvedValueOnce(listResponse([CLUB_SANS_ADRESSE, CLUB_SAIN]));

    const result = await getClubs({ includeMultisport: false });

    expect(result.data.map((/** @type {any} */ club) => club.name))
      .toEqual(['EARL DU BIEF', 'SMUC Football']);
  });

  test('🔴 temoin 2 — une ligne illisible est ecartee ET NOMMEE', async () => {
    // `name` est `required: true` cote serveur : un club sans nom est une vraie
    // anomalie, celle-la doit bien etre ecartee — mais seule.
    mockGet.mockResolvedValueOnce(listResponse([
      CLUB_SAIN,
      {
        ...CLUB_SAIN, documentId: 'club-casse', id: 2, name: null,
      },
    ]));

    const result = await getClubs({ includeMultisport: false });

    expect(result.data.map((/** @type {any} */ club) => club.documentId)).toEqual(['club-sain']);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        clubs: ['club-casse'],
        rejected: 1,
      }),
    );
  });

  test('🔴 temoin 3 — la fiche d un club sans adresse ne plante pas non plus', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: CLUB_SANS_ADRESSE } });

    await expect(getClubById('l24m8eivaioc6qg245kyg6gg'))
      .resolves.toMatchObject({ address: null, name: 'EARL DU BIEF' });
  });

  test('🔒 temoin 4 — un club avec adresse s affiche exactement comme avant', async () => {
    mockGet.mockResolvedValueOnce(listResponse([CLUB_SAIN]));

    const result = await getClubs({ includeMultisport: false });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      address: { city: 'Marseille', label: '1 rue du Stade' },
      clubPartner: false,
      documentId: 'club-sain',
      id: 1,
      name: 'SMUC Football',
    });
    expect(result.meta.pagination).toEqual(PAGINATION);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  // On ne devine pas une pagination : l enveloppe reste stricte.
  test('🔒 temoin 5 — une ENVELOPPE cassee reste une erreur', async () => {
    mockGet.mockResolvedValueOnce(listResponse([CLUB_SAIN], {}));

    await expect(getClubs({ includeMultisport: false })).rejects.toThrow();
  });

  // Le serveur trie clubPartner desc puis name asc, et les clubs multisport
  // sont ajoutes en tete : rejouer l ordre du serveur n est pas negociable.
  test('🔒 temoin 6 — l ORDRE de la liste est conserve', async () => {
    const clubs = Array.from({ length: 7 }, (_, index) => ({
      ...CLUB_SAIN,
      address: index === 3 ? null : CLUB_SAIN.address,
      documentId: `club-${index}`,
      id: index + 1,
      name: `Club ${index}`,
    }));
    mockGet.mockResolvedValueOnce(listResponse(clubs));

    const result = await getClubs({ includeMultisport: false });

    expect(result.data.map((/** @type {any} */ club) => club.documentId)).toEqual([
      'club-0', 'club-1', 'club-2', 'club-3', 'club-4', 'club-5', 'club-6',
    ]);
  });

  test('🔒 temoin 7 — une liste vide reste une liste vide', async () => {
    mockGet.mockResolvedValueOnce(listResponse([]));

    const result = await getClubs({ includeMultisport: false });

    // `.empty(Joi.array().length(0))` rend `undefined` : comportement d origine,
    // preserve tel quel pour ne rien casser chez les appelants.
    expect(result.data).toBeUndefined();
  });

  test('🔒 temoin 8 — un `data` qui n est pas un tableau reste une erreur', async () => {
    mockGet.mockResolvedValueOnce(listResponse(/** @type {any} */ ('pas-un-tableau')));

    await expect(getClubs({ includeMultisport: false })).rejects.toThrow();
  });
});

describe('T11 — la meme famille : les autres champs qui refusaient `null` a tort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 temoin 9 — un sponsor SANS LIEN ne tue pas la fiche du club', async () => {
    // `sponsor.link` est `required: false` cote serveur (composant sponsor.sponsor)
    // et vaut donc `null` des qu un club saisit un sponsor sans site web.
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          ...CLUB_SAIN,
          sponsor: [{ link: null, logo: { url: '/uploads/x.png' }, title: 'Boucherie du coin' }],
        },
      },
    });

    await expect(getClubById('club-sain')).resolves.toMatchObject({ name: 'SMUC Football' });
  });

  test('🔴 temoin 10 — une gouvernance NULL ne casse plus une sauvegarde', async () => {
    // 86 689 clubs de production ont `clubMembersPublicVisibility` et
    // `membershipRequestManagementMode` a NULL (mesure du 2026-08-17). Le
    // controleur ne les normalise PAS sur `PUT /clubs/:id/update-info` : l app
    // recevait donc `null`, jetait la reponse, et affichait une erreur alors que
    // l enregistrement avait REUSSI.
    mockPut.mockResolvedValueOnce({
      data: {
        data: {
          ...CLUB_SAIN,
          clubMembersPublicVisibility: null,
          membershipRequestManagementMode: null,
        },
      },
    });

    const result = await updateClubInfo({ documentId: 'club-sain', name: 'SMUC Football' });

    expect(result).toMatchObject({
      clubMembersPublicVisibility: true,
      membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
    });
  });

  test('🔴 temoin 11 — un club de la LISTE avec `maxTeamNumber` a null passe', async () => {
    mockGet.mockResolvedValueOnce(listResponse([{ ...CLUB_SAIN, maxTeamNumber: null }]));

    const result = await getClubs({ includeMultisport: false });

    expect(result.data).toHaveLength(1);
  });
});
