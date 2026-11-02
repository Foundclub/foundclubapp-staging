import { categoriesDeSonAge, versLesNomsDuServeur } from '@/domains/category/ageEtCategorie';

import { getLevels } from '@/services/level/levelService';

// REPRISE-INSCRIPTION p17 (01/11) — la revue de la recette : dans « Modifier mon profil », les
// niveaux restaient par ordre alphabétique, un adulte se voyait proposer U6 à U21, et « Senior »
// (ancienne liste de l'inscription) côtoyait « Sénior (+18 ans) ». Les niveaux se rangent à la
// source (getLevels) ; les catégories proposées suivent l'âge ; les anciennes valeurs prennent le
// nom du serveur. Listes relevées sur la recette le 30/10 (GET /levels, GET /categories).

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

const CATEGORIES = ['U6 (6 ans)', 'U10 (10 ans)', 'U11 (11 ans)', 'U15 (15 ans)', 'U16 (16 ans)',
  'U17 (17 ans)', 'U21 (21 ans)', 'Sénior (+18 ans)'].map((name) => ({ name }));
const noms = (/** @type {any[] | undefined} */ liste) => (liste || []).map((c) => c.name);
const LE_31_OCTOBRE = new Date(2026, 9, 31);

describe('REPRISE-INSCRIPTION p17 — les niveaux à la source', () => {
  it('getLevels rend les niveaux du plus bas au plus haut', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: ['Départemental 1', 'Départemental 3', 'National', 'National 2', 'Pré-régional',
          'Régional 1', 'Ligue professionnelle'].map((name, i) => ({ documentId: `l${i}`, name })),
      },
    });
    expect(noms(await getLevels())).toEqual(['Départemental 3', 'Départemental 1', 'Pré-régional',
      'Régional 1', 'National', 'National 2', 'Ligue professionnelle']);
  });
});

describe('REPRISE-INSCRIPTION p17 — les catégories de son âge', () => {
  it('un adulte de 28 ans : Sénior seulement', () => {
    expect(noms(categoriesDeSonAge(CATEGORIES, '1998-03-12', '', LE_31_OCTOBRE)))
      .toEqual(['Sénior (+18 ans)']);
  });

  it('un joueur né en 2012 (U15) : U15 et au-dessus, sans Sénior', () => {
    expect(noms(categoriesDeSonAge(CATEGORIES, '15/04/2012', '', LE_31_OCTOBRE)))
      .toEqual(['U15 (15 ans)', 'U16 (16 ans)', 'U17 (17 ans)', 'U21 (21 ans)']);
  });

  it('dès U17, Sénior est proposé ; une catégorie déjà choisie reste proposée', () => {
    expect(noms(categoriesDeSonAge(CATEGORIES, '2010-01-01', 'U10', LE_31_OCTOBRE)))
      .toEqual(['U10 (10 ans)', 'U17 (17 ans)', 'U21 (21 ans)', 'Sénior (+18 ans)']);
  });

  it('sans date lisible : toutes', () => {
    expect(categoriesDeSonAge(CATEGORIES, '', '', LE_31_OCTOBRE)).toBe(CATEGORIES);
  });

  it('« Senior » et « U11 » prennent le nom du serveur, sans doublon', () => {
    expect(versLesNomsDuServeur('Senior, U11, Sénior (+18 ans), Loisir', CATEGORIES))
      .toBe('Sénior (+18 ans), U11 (11 ans), Loisir');
  });
});
