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
const { getClubAssociation, getPublicClubById } = require('./clubService');

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

  // Sans cette traduction, l ecran s affiche VIDE sans que rien ne casse ni ne rougisse.
  it('« sports » devient « activites »', async () => {
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
  it('ni telephone ni e-mail ni membres ne sortent', async () => {
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

// ---------------------------------------------------------------------------
// ANNUAIRE-E1 (29/09) — « À propos » et les installations, pour la fiche de l'app
// ---------------------------------------------------------------------------
// Décision d'Adel du 29/09 (« À propos : A ») : le texte officiel de l'association (répertoire
// national des associations) est AJOUTÉ à la fiche de l'app, donc sur le téléphone ET sur le site.
// Il vient de la porte publique, qui le RENETTOIE à l'affichage (aucune donnée personnelle sous la
// mention « source : RNA »). Les installations du club, elles, y sont déjà : un visiteur les voit.
describe('ANNUAIRE-E1 · T5 — « À propos » et installations traversent la traduction', () => {
  const REPONSE_AVEC_RNA = {
    data: {
      data: {
        ...REPONSE_PUBLIQUE.data.data,
        club: {
          ...REPONSE_PUBLIQUE.data.data.club,
          association: {
            createdYear: 1923,
            dissolved: false,
            formerNames: [],
            objectText: 'Organiser la pratique du sport.',
            sourceNote: 'Objet déclaré au Journal officiel — source : RNA',
            websiteUrl: null,
          },
          facilities: [{
            addressLabel: '15 avenue du Parc, 13008 Marseille',
            documentId: 'inst-1',
            isBookable: false,
            maxSlots: 2,
            name: 'Stade Jean Bouin',
            type: 'Terrain',
          }],
        },
      },
    },
  };

  it('le texte de l association arrive tel que la porte publique le rend', async () => {
    mockGet.mockResolvedValue(REPONSE_AVEC_RNA);
    const fiche = await getPublicClubById('club-1');
    expect(fiche.association).toEqual(REPONSE_AVEC_RNA.data.data.club.association);
  });

  it('les installations arrivent dans la forme que lit l écran', async () => {
    mockGet.mockResolvedValue(REPONSE_AVEC_RNA);
    const fiche = await getPublicClubById('club-1');
    expect(fiche.publicFacilities).toEqual([{
      address: '15 avenue du Parc, 13008 Marseille',
      documentId: 'inst-1',
      isShared: false,
      maxSlots: 2,
      name: 'Stade Jean Bouin',
      ownerType: 'club',
      type: 'Terrain',
    }]);
  });

  it('📌 sans texte ni installation : null et liste vide, jamais undefined', async () => {
    const fiche = await getPublicClubById('club-1');
    expect(fiche.association).toBeNull();
    expect(fiche.publicFacilities).toEqual([]);
  });

  it('connecté : la fiche privée reçoit AUSSI « À propos », lu à la porte publique', async () => {
    mockGetAuthTokens.mockReturnValue({ token: 'jeton-valide' });
    mockGet.mockImplementation((/** @type {string} */ adresse) => (
      adresse === '/public-directory/clubs/club-1'
        ? Promise.resolve(REPONSE_AVEC_RNA)
        : Promise.reject(new Error('fiche privee hors sujet ici'))
    ));

    await expect(getClubAssociation('club-1'))
      .resolves.toEqual(REPONSE_AVEC_RNA.data.data.club.association);
    useGetClub('club-1');
    await optionsRetenues[0].queryFn().catch(() => null);
    expect(mockGet).toHaveBeenCalledWith('/public-directory/clubs/club-1');
  });

  it('📌 la porte publique en panne : pas d « À propos », jamais d erreur', async () => {
    mockGet.mockRejectedValue(new Error('404'));
    await expect(getClubAssociation('club-1')).resolves.toBeNull();
  });
});
