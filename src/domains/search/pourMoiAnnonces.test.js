import { criteresPourMoi, requetePourMoi, totalDuServeur } from './pourMoiAnnonces';

// LISTE-ANNONCES (A08) — ce que « Pour moi » demande au serveur.

const CATEGORIES = [
  { documentId: 'cat-u15', name: 'U15' },
  { documentId: 'cat-u17', name: 'U17' },
  { documentId: 'cat-senior', name: 'Senior' },
];

describe('criteresPourMoi', () => {
  it('sans sport au profil, il n y a pas de critères', () => {
    expect(criteresPourMoi({ category: 'U15' }, CATEGORIES)).toBeNull();
    expect(criteresPourMoi({ preferredSport: '   ' }, CATEGORIES)).toBeNull();
    expect(criteresPourMoi(null, CATEGORIES)).toBeNull();
  });

  it('les catégories du profil (texte, « U15, U17 ») deviennent des identifiants', () => {
    // `UserCategory.js` range plusieurs catégories en « U15, U17 ».
    expect(criteresPourMoi(
      { category: 'u15, U17', preferredSport: 'Football', section: { name: 'Masculine' } },
      CATEGORIES,
    )).toEqual({
      categories: [
        { documentId: 'cat-u15', name: 'U15' },
        { documentId: 'cat-u17', name: 'U17' },
      ],
      section: 'Masculine',
      sport: 'Football',
    });
  });

  it('une catégorie inconnue est ignorée, sans rien casser', () => {
    expect(criteresPourMoi({ category: 'Vétérans', preferredSport: 'Rugby' }, undefined)).toEqual({
      categories: [],
      section: '',
      sport: 'Rugby',
    });
  });
});

describe('requetePourMoi', () => {
  const CRITERES = {
    categories: [{ documentId: 'cat-u15', name: 'U15' }],
    section: 'Masculine',
    sport: 'Football',
  };

  it('sans filtre, le profil donne sport, catégorie et section — et les écrit', () => {
    expect(requetePourMoi({}, CRITERES)).toEqual({
      libelles: ['Football', 'U15', 'Masculine'],
      params: { category: ['cat-u15'], section: 'Masculine', sport: 'Football' },
    });
  });

  it('un filtre posé par l utilisateur gagne sur le profil, et n est pas réécrit', () => {
    expect(requetePourMoi({ category: [], city: 'Lyon', sport: 'Basketball' }, CRITERES)).toEqual({
      libelles: ['U15', 'Masculine'],
      params: {
        category: ['cat-u15'], city: 'Lyon', section: 'Masculine', sport: 'Basketball',
      },
    });
  });
});

describe('totalDuServeur', () => {
  it('lit `meta.pagination.total`, sinon garde le repli', () => {
    expect(totalDuServeur({ pagination: { total: 38 } }, 10)).toBe(38);
    expect(totalDuServeur({ pagination: { total: 0 } }, 10)).toBe(0);
    expect(totalDuServeur({}, 10)).toBe(10);
    expect(totalDuServeur(undefined, 4)).toBe(4);
  });
});
