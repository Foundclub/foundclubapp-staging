import { chercherCommune } from '../placesService';

// R17-ADRESSE (REC17-008, 19/10) — « votre point n'est pas répertorié, veuillez le placer sur la
// carte, en essayant de le placer avec les infos qu'on a » (Adel, 17/10). La carte s'ouvre sur la
// commune que le texte tapé NOMME : par son code postal, sinon par son nom.
//
// Ce que la BAN rend vraiment (mesuré le 19/10 sur data.geopf.fr, recherche `type=municipality`) :
//   « 13008 »                          ⇒ Marseille 8e Arrondissement (13008)
//   « Gymnase Toto Aix-en-Provence »   ⇒ RIEN (la commune est noyée dans le nom du lieu)
//   « Aix-en-Provence »                ⇒ Aix-en-Provence (13080)
// D'où les essais successifs : le code postal, le texte entier, puis les mots de la fin et du
// début. Et la garde : une commune n'est retenue que si elle est ÉCRITE dans le texte — la
// recherche approchée rend toujours « quelque chose ».

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

const commune = (
  /** @type {string} */ nom,
  /** @type {string} */ codePostal,
  /** @type {[number, number]} */ point,
) => ({
  geometry: { coordinates: point },
  properties: {
    city: nom, label: nom, postcode: codePostal, type: 'municipality',
  },
});

const AIX = commune('Aix-en-Provence', '13080', [5.4474, 43.5297]);
const MARSEILLE_8 = commune('Marseille 8e Arrondissement', '13008', [5.374045, 43.247182]);
const AIX_EN_PEVELE = commune('Aix-en-Pévèle', '59310', [3.2861, 50.4797]);

/**
 * La BAN doublée : une réponse par texte cherché (le reste : rien).
 * @param {Record<string, any[]>} reponses - Texte cherché ⇒ communes rendues.
 */
const banRend = (reponses) => {
  mockGet.mockImplementation((/** @type {string} */ _chemin, /** @type {any} */ options) => (
    Promise.resolve({ data: { features: reponses[options?.params?.q] || [] } })
  ));
};

const textesCherches = () => mockGet.mock.calls.map((appel) => appel[1]?.params?.q);

describe('R17-ADRESSE — la commune que le texte tapé nomme', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('① un code postal tapé ⇒ sa commune, par la recherche de commune de la BAN', async () => {
    banRend({ 13008: [MARSEILLE_8] });

    await expect(chercherCommune('Stade du Moulin 13008')).resolves.toEqual({
      label: 'Marseille 8e Arrondissement', lat: 43.247182, lng: 5.374045,
    });
    expect(mockGet.mock.calls[0][1].params).toEqual(expect.objectContaining({
      q: '13008', type: 'municipality',
    }));
  });

  it('② la commune noyée dans le nom du lieu ⇒ trouvée par les mots de la fin', async () => {
    banRend({ 'Aix-en-Provence': [AIX, AIX_EN_PEVELE] });

    await expect(chercherCommune('Gymnase Toto Aix-en-Provence')).resolves.toEqual({
      label: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474,
    });
    expect(textesCherches()).toContain('Aix-en-Provence');
  });

  it('③ une commune rendue mais PAS écrite dans le texte n est jamais retenue', async () => {
    // La recherche approchée propose Aix-en-Pévèle pour « Gymnase Toto » : faux.
    banRend({ Gymnase: [AIX_EN_PEVELE], 'Gymnase Toto': [AIX_EN_PEVELE] });

    await expect(chercherCommune('Gymnase Toto')).resolves.toBeNull();
  });

  it('④ rien de reconnu ⇒ null, en peu d essais (jamais plus de 8 requêtes)', async () => {
    banRend({});

    const texte = 'Le petit terrain derrière la salle des fêtes';
    await expect(chercherCommune(texte)).resolves.toBeNull();
    expect(mockGet.mock.calls.length).toBeGreaterThan(0);
    expect(mockGet.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('⑤ une panne de la BAN ⇒ null (la carte s ouvre quand même, ailleurs)', async () => {
    mockGet.mockRejectedValue(new Error('réseau'));

    await expect(chercherCommune('Gymnase Toto Aix-en-Provence')).resolves.toBeNull();
  });

  it('⑥ texte vide ⇒ null, sans requête', async () => {
    await expect(chercherCommune('   ')).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
