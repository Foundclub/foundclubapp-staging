/**
 * 🐞 T19-RESTES (08/10, T19-bis, recette) — LE CLUB NEUF « T19 Club essai » : son onglet
 * Équipes affichait « Failed to fetch teams: Internal Server Error » sur le SITE.
 *
 * Mesuré (GET avec une session de recette) :
 *   /teams?filters[club][documentId]=<documentId>  ⇒ 200, 0 équipe
 *   /teams?filters[club][id]=<documentId>          ⇒ 500 (un identifiant numérique attendu)
 *   /teams?filters[club][id]=999999999             ⇒ 200, 0 équipe
 *
 * `getTeams` retente avec l'ancien identifiant NUMÉRIQUE quand la page est vide. Au téléphone,
 * ce repli ne part jamais : le vrai Joi change la liste vide en `undefined` (voir
 * `teamService.mesEquipes.test.js`). Sur le SITE, Joi est une doublure qui rend la valeur telle
 * quelle (`web/src/shims/joi.ts`) : la liste vide reste une liste ⇒ le repli part, avec un
 * `documentId` dans un filtre d'identifiant numérique ⇒ 500. Tout club sans équipe y passe.
 *
 * Ce témoin rejoue la doublure du site. ROUGE avant le lot (2 appels, le second en 500).
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

// La doublure de Joi du SITE (`web/src/shims/joi.ts`) : tout schéma valide, la valeur est
// rendue telle quelle (une liste vide reste une liste vide).
jest.mock('joi', () => {
  const schema = new Proxy({}, {
    get: (_cible, clef) => (clef === 'validateAsync'
      ? (/** @type {any} */ valeur) => Promise.resolve(valeur)
      : () => schema),
  });
  return { __esModule: true, default: schema };
});

const { getTeams } = require('../teamService');

const pageDe = (/** @type {any[]} */ data) => ({
  data: {
    data,
    meta: {
      pagination: {
        page: 1, pageCount: 1, pageSize: 10, total: data.length,
      },
    },
  },
});
const pageVide = () => pageDe([]);

describe('T19R — getTeams sur le site : un club sans équipe ne part pas en 500', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  test('club désigné par son documentId, 0 équipe : UNE requête, aucun filtre `id`', async () => {
    mockGet.mockResolvedValue(pageVide());

    const resultat = await getTeams({ clubId: 'ot27v6kkke9zm4z55mz30d7h' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][1].params.filters.club)
      .toEqual({ documentId: 'ot27v6kkke9zm4z55mz30d7h' });
    expect(resultat.data).toEqual([]);
  });

  test('un ancien identifiant NUMÉRIQUE garde son repli (il peut encore servir)', async () => {
    mockGet
      .mockResolvedValueOnce(pageVide())
      .mockResolvedValueOnce(pageDe([{ documentId: 't-1', name: 'U15' }]));

    const resultat = await getTeams({ clubId: '42' });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[1][1].params.filters.club).toEqual({ id: 42 });
    expect(resultat.data.map((/** @type {any} */ equipe) => equipe.documentId)).toEqual(['t-1']);
  });
});
