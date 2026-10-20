import { epinglesDesComplexes } from './reserverTerrain';

// RESA-CARTE (20/10/2026) — E-P01, VUE CARTE (plan E-P01 point 6, planche EP01 état 2) : une
// épingle par complexe proposé, avec sur l'épingle le nombre de ses créneaux libres, ou « Tél. »
// si tous ses terrains se réservent par téléphone (A-G24).
// La recherche du serveur (GET /public-complexes) ne rend PAS la position d'un complexe (liste
// fermée : slug, nom, ville, logo, distance, sports, créneaux) ; sa page publique, si
// (`address: { label, lat, lng }`). Si la recherche la rend un jour (`address` sur la carte),
// c'est elle qui sert, sans lire la page.

const carte = (/** @type {Record<string, any>} */ champs = {}) => ({
  city: 'Montrivage',
  distanceKm: 2.4,
  freeSlotsCount: 3,
  logo: 'https://cdn.exemple/five.png',
  name: 'Le Five de Montrivage',
  phoneOnly: false,
  slots: [{ from: '18:00' }, { from: '19:00' }, { from: '20:30' }],
  slug: 'le-five-de-montrivage',
  sports: ['Foot à 5', 'Padel'],
  ...champs,
});

const PAGES = {
  'le-five-de-montrivage': { address: { label: '3 rue du Stade', lat: 48.83, lng: 1.48 } },
  'padel-club-valbrune': { address: { label: '1 allée des Pins', lat: 48.9, lng: 1.5 } },
};

describe('RESA-CARTE — une épingle par complexe proposé', () => {
  it('à la position de sa page publique, avec le nombre de ses créneaux libres', () => {
    const [epingle] = epinglesDesComplexes([carte()], PAGES, 'Tél.');
    expect(epingle).toEqual(expect.objectContaining({
      id: 'le-five-de-montrivage',
      imageUrl: 'https://cdn.exemple/five.png',
      lat: 48.83,
      lng: 1.48,
      markerLabel: '3',
      title: 'Le Five de Montrivage',
      type: 'complexes',
    }));
    expect(epingle.raw).toEqual(carte());
  });

  it('« Tél. » quand tous ses terrains se réservent par téléphone', () => {
    const [epingle] = epinglesDesComplexes(
      [carte({ phoneOnly: true, slug: 'padel-club-valbrune' })],
      PAGES,
      'Tél.',
    );
    expect(epingle.markerLabel).toBe('Tél.');
  });

  it('sans compteur du serveur, les créneaux rendus', () => {
    const [epingle] = epinglesDesComplexes(
      [carte({ freeSlotsCount: undefined, slots: [{ from: '21:00' }] })],
      PAGES,
      'Tél.',
    );
    expect(epingle.markerLabel).toBe('1');
  });

  it('sans position lisible, pas d’épingle (page non lue, sans adresse, coordonnées vides)', () => {
    expect(epinglesDesComplexes([
      carte({ slug: 'jamais-lu' }),
      carte({ slug: 'sans-adresse' }),
      carte({ slug: 'coordonnees-vides' }),
      carte({ slug: 'coordonnees-zero-par-null' }),
    ], {
      'coordonnees-vides': { address: { label: 'x', lat: '', lng: '' } },
      'coordonnees-zero-par-null': { address: { label: 'x', lat: null, lng: null } },
      'sans-adresse': { address: null },
    }, 'Tél.')).toEqual([]);
  });

  it('la position rendue par la recherche, si elle l’est un jour, passe avant la page', () => {
    const [epingle] = epinglesDesComplexes(
      [carte({ address: { lat: 45.1, lng: 4.2 } })],
      PAGES,
      'Tél.',
    );
    expect([epingle.lat, epingle.lng]).toEqual([45.1, 4.2]);
  });

  it('une liste vide ou absente : aucune épingle', () => {
    expect(epinglesDesComplexes([], PAGES, 'Tél.')).toEqual([]);
    expect(epinglesDesComplexes(/** @type {any} */ (null), PAGES, 'Tél.')).toEqual([]);
  });
});
