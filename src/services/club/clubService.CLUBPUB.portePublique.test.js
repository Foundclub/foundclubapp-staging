/**
 * CLUBPUB — DEUX PORTES POUR UNE FICHE DE CLUB, UNE PAR PUBLIC.
 *
 * DECISION D'ADEL DU 2026-09-07 : « oui, une fiche club doit etre visible sans
 * compte ».
 *
 * L'ETAT MESURE LE MEME JOUR, en anonyme sur la production :
 *   GET /api/clubs                 -> 200
 *   GET /api/clubs/<documentId>    -> 403   <-- le visiteur ne voyait RIEN
 *   GET /api/public-directory/clubs/<documentId> -> 200, sans une seule
 *                                   donnee personnelle dans la reponse
 *
 * Le role visiteur porte `club.find` (la liste) mais PAS `club.findOne` (la
 * fiche). Et `useGetClub` partait avec `enabled: !!id`, sans aucun plancher de
 * session : chaque visiteur qui touchait un club fabriquait un refus, et l'un
 * des refus qui alimentent les groupes Sentry REACT-NATIVE-1 et -2.
 *
 * ⛔ CE QU'ON N'A PAS FAIT, ET POURQUOI : accorder `club.findOne` au visiteur.
 * Cette porte renvoie `members` (avec avatar et role), `phoneNumber` et
 * `email`. Mesure en base de production le 2026-09-07 : 37 705 clubs portent un
 * telephone, dont 30 771 commencent par 06/07 — des mobiles PERSONNELS, pas des
 * standards — et 42 069 portent un e-mail. L'ouvrir publiait ~31 000 numeros
 * personnels dans une app que n'importe qui telecharge.
 *
 * 🔒 LE TEMOIN NON NEGOCIABLE EST T3 : meme si la reponse publique portait un
 * jour un telephone, un e-mail ou des membres, la traduction ne les laisse pas
 * passer. C'est la SECONDE ceinture — la premiere est le garde-fou de l'ecran
 * (`showsPrivateClubDetails`, ClubDetails.js). Une ceinture seule finit par
 * sauter.
 */

const mockGet = jest.fn();
const mockGetAuthTokens = jest.fn(() => null);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => mockGetAuthTokens(),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  })),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: mockGet, put: jest.fn() },
}));

// On retient les options passees a `useQuery` : c'est le seul moyen d'observer
// QUELLE porte le crochet a choisie, sans monter de composant.
/** @type {any[]} */
const optionsRetenues = [];
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn(),
  useQuery: (/** @type {any} */ options) => {
    optionsRetenues.push(options);
    return { data: null, isLoading: false };
  },
}));

const { useGetClub } = require('./clubQueries');
const { getPublicClubById } = require('./clubService');

/** La forme REELLE rendue par l'annuaire public, relevee en production le 2026-09-07. */
const REPONSE_PUBLIQUE = {
  data: {
    data: {
      breadcrumbs: [],
      club: {
        addressLabel: '21 Rue fortia 13001 Marseille',
        city: 'Marseille',
        clubVerified: false,
        documentId: 'h4k58gjpspivqlrhqjlqx7ib',
        logoUrl: null,
        name: 'Fayabana',
        sponsors: [],
        sports: [{ documentId: 't26r62iikd8peayq92q1ct1m', name: 'BMX', slug: 'bmx' }],
        teams: [{
          category: 'Sénior (+18 ans)',
          documentId: 'swpyokvht90722dhpn6yvyep',
          level: 'Pré-National',
          memberCount: 0,
          name: 'Futsal 1',
        }],
      },
      relatedClubs: [],
      seo: {},
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  optionsRetenues.length = 0;
  mockGetAuthTokens.mockReturnValue(null);
  mockGet.mockResolvedValue(REPONSE_PUBLIQUE);
});

// ---------------------------------------------------------------------------
// T1 — LA PORTE APPELEE
// ---------------------------------------------------------------------------

describe('CLUBPUB · T1 — la porte publique est bien celle de l’annuaire', () => {
  it('l’adresse appelee est /public-directory/clubs/<id>, jamais /clubs/<id>', async () => {
    await getPublicClubById('club-1');

    expect(mockGet).toHaveBeenCalledWith('/public-directory/clubs/club-1');
  });
});

// ---------------------------------------------------------------------------
// T2 — LA TRADUCTION : les deux vocabulaires se rencontrent ici, et nulle part ailleurs
// ---------------------------------------------------------------------------

describe('CLUBPUB · T2 — la fiche publique arrive dans le vocabulaire de l’écran', () => {
  it('le nom, l’adresse et les équipes traversent la traduction', async () => {
    const fiche = await getPublicClubById('club-1');

    expect(fiche.name).toBe('Fayabana');
    expect(fiche.addressDetails).toBe('21 Rue fortia 13001 Marseille');
    expect(fiche.teams).toHaveLength(1);
    expect(fiche.teams[0].name).toBe('Futsal 1');
  });

  it('« sports » devient « activites » — sinon l’écran s’affiche vide sans rien casser', async () => {
    const fiche = await getPublicClubById('club-1');

    expect(fiche.activites).toHaveLength(1);
    expect(fiche.activites[0].name).toBe('BMX');
  });

  it('un club introuvable rend null, il ne jette pas', async () => {
    mockGet.mockResolvedValue({ data: { data: {} } });

    await expect(getPublicClubById('club-inconnu')).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 🔒 T3 — LE TEMOIN NON NEGOCIABLE : la seconde ceinture
// ---------------------------------------------------------------------------

describe('CLUBPUB · T3 — aucune donnée personnelle ne franchit la traduction', () => {
  it('même si la réponse publique en portait, ni téléphone ni e-mail ni membres ne sortent', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          club: {
            ...REPONSE_PUBLIQUE.data.data.club,
            email: 'president.dupont@gmail.com',
            members: [{ firstname: 'Killian', lastname: 'Mercier' }],
            phoneNumber: '0612345678',
          },
        },
      },
    });

    const fiche = await getPublicClubById('club-1');

    expect(fiche.phoneNumber).toBeUndefined();
    expect(fiche.email).toBeUndefined();
    expect(fiche.members).toEqual([]);
    expect(fiche.membersCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T4 — L’AIGUILLAGE : quelle porte pour quel public
// ---------------------------------------------------------------------------

describe('CLUBPUB · T4 — le crochet choisit la porte selon la session', () => {
  it('sans jeton, la clé de cache dit « public »', () => {
    mockGetAuthTokens.mockReturnValue(null);

    useGetClub('club-1');

    expect(optionsRetenues[0].queryKey).toEqual(['club', 'club-1', 'public']);
  });

  it('avec un jeton, la clé de cache dit « prive »', () => {
    mockGetAuthTokens.mockReturnValue({ token: 'jeton-valide' });

    useGetClub('club-1');

    expect(optionsRetenues[0].queryKey).toEqual(['club', 'club-1', 'prive']);
  });

  // Sans cette séparation, une fiche COMPLETE mise en cache avant une
  // déconnexion serait resservie au visiteur, téléphone compris.
  it('les deux publics n’ont PAS la même clé de cache', () => {
    mockGetAuthTokens.mockReturnValue(null);
    useGetClub('club-1');
    mockGetAuthTokens.mockReturnValue({ token: 'jeton-valide' });
    useGetClub('club-1');

    expect(optionsRetenues[0].queryKey).not.toEqual(optionsRetenues[1].queryKey);
  });

  it('sans jeton, la requête lancée est bien celle de l’annuaire public', async () => {
    mockGetAuthTokens.mockReturnValue(null);

    useGetClub('club-1');
    await optionsRetenues[0].queryFn();

    expect(mockGet).toHaveBeenCalledWith('/public-directory/clubs/club-1');
  });
});
