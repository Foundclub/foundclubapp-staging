import { getRecruitmentAds } from '../recruitmentService';

// REPRISE-CHEMINS (02/11, point 58, revue « modifier ») : la contre-recette voyait encore deux
// cartes « Annonce expirée » avec « Postuler ». La recherche du serveur les retire déjà
// (CORR-ROBUSTESSE, search.ts) ; mais la liste SIMPLE (aucun filtre ni texte) passe par
// GET /recruitment-ads, qui ne les retirait pas. Même règle que le serveur et la carte : sans
// événement, expirée une fois passée ; une annonce liée à un événement garde sa règle.
const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

describe('REPRISE-CHEMINS 58 — la liste simple ne demande plus les annonces expirées', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: { data: [], meta: {} } });
  });

  it('🔴 la requête porte la règle d échéance du serveur', async () => {
    await getRecruitmentAds({ isActive: true, page: 1, pageSize: 10 });
    const [chemin, { params }] = mockGet.mock.calls[0];
    expect(chemin).toBe('/recruitment-ads');
    expect(params.filters.isActive).toBe(true);
    const ou = params.filters.$or;
    expect(ou).toEqual(expect.arrayContaining([
      { expirationDate: { $null: true } },
      { event: { id: { $notNull: true } } },
    ]));
    const borne = ou.find((/** @type {any} */ f) => f.expirationDate?.$gte)?.expirationDate.$gte;
    expect(Date.parse(borne)).toBeGreaterThan(Date.now() - 60_000);
  });
});
