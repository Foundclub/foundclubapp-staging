/**
 * Filet AA03 (E6), volet « ET APRES ? » — UNE EQUIPE SANS NIVEAU RESSORT QUAND
 * MEME DANS LA RECHERCHE.
 *
 * Depuis AA03, l'etape 6/8 du tunnel equipe peut etre passee sans rien choisir :
 * des equipes sans niveau vont exister. Deux facons de les faire DISPARAITRE
 * sans que personne ne s'en apercoive, et ce fichier ferme les deux :
 *
 *  1. UN FILTRE POSE TOUT SEUL. Si la liste envoyait un `filters[level]` meme
 *     quand personne n'a choisi de niveau, toute equipe sans niveau serait
 *     exclue de la recherche — silencieusement.
 *
 *  2. LA VALIDATION EN BLOC, qui est le vrai piege et qui a deja coute trois
 *     ecrans sur ce projet : la reponse entiere passe par UN schema Joi
 *     (`Joi.array().items(teamSchema)`). Une seule equipe refusee fait jeter la
 *     PAGE COMPLETE — les equipes qui ont un niveau disparaissent avec celle qui
 *     n'en a pas. Et Strapi envoie `null` pour une relation absente, jamais
 *     `undefined` : un `Joi.object().optional()` REFUSE `null`.
 *
 * Point d'observation : les parametres reellement envoyes sur le reseau, et ce
 * que le service rend a l'ecran.
 */

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

const { getTeams } = require('../teamService');

/** L'equipe qui a tout : la reference. */
const AVEC_NIVEAU = {
  activities: [{ documentId: 'act-1', name: 'Football' }],
  category: { documentId: 'cat-1', name: 'U15' },
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-avec',
  level: { documentId: 'niv-1', name: 'Departemental' },
  name: 'Equipe Avec',
  section: { documentId: 'sec-1', name: 'Masculin' },
};

/** La meme, telle que Strapi la renvoie sans niveau : `null`, pas `undefined`. */
const SANS_NIVEAU = {
  ...AVEC_NIVEAU,
  documentId: 'equipe-sans',
  level: null,
  name: 'Equipe Sans',
};

/**
 * Une reponse de liste conforme a ce que le serveur renvoie.
 * @param {any[]} data Les equipes renvoyees.
 * @returns {any} La reponse axios simulee.
 */
const reponse = (data) => ({
  data: {
    data,
    meta: {
      pagination: {
        page: 1,
        pageCount: 1,
        pageSize: 10,
        total: data.length,
      },
    },
  },
});

/**
 * Les `filters` d'un appel HTTP.
 * @param {number} [rang] Le rang de l'appel (0 = le premier).
 * @returns {any} L'objet `filters` envoye.
 */
const filtresEnvoyes = (rang = 0) => mockGet.mock.calls[rang][1].params.filters;

beforeEach(() => {
  mockGet.mockReset();
});

describe('AA03 - temoin 6 : une equipe sans niveau ressort dans la recherche', () => {
  test('sans niveau choisi, AUCUN filtre de niveau ne part sur le reseau', async () => {
    mockGet.mockResolvedValue(reponse([AVEC_NIVEAU, SANS_NIVEAU]));

    await getTeams({ clubId: 'club-1' });

    expect(filtresEnvoyes().level).toBeUndefined();
  });

  test('elle est bien RENDUE, a cote de celle qui a un niveau', async () => {
    mockGet.mockResolvedValue(reponse([AVEC_NIVEAU, SANS_NIVEAU]));

    const resultat = await getTeams({ clubId: 'club-1' });

    expect(resultat.data.map((/** @type {any} */ equipe) => equipe.name))
      .toEqual(['Equipe Avec', 'Equipe Sans']);
  });

  test('une equipe sans niveau ne fait PAS tomber la page entiere', async () => {
    // Le piege de la validation en bloc : si `level` etait refuse, ce ne serait
    // pas « Equipe Sans » qui manquerait, ce serait TOUT.
    mockGet.mockResolvedValue(reponse([SANS_NIVEAU]));

    const resultat = await getTeams({ clubId: 'club-1' });

    expect(resultat.data).toHaveLength(1);
    expect(resultat.data[0].level).toBeNull();
  });

  test('quand un niveau EST choisi, le filtre part (non-regression)', async () => {
    mockGet.mockResolvedValue(reponse([AVEC_NIVEAU]));

    await getTeams({ clubId: 'club-1', level: ['niv-1'] });

    expect(filtresEnvoyes().level).toEqual({ documentId: { $in: ['niv-1'] } });
  });
});
