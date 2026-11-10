import { formatEventPlaceLine } from '../eventInfoLines';

// ACCUEIL-JOUEUR (09/11/2026, point 3, mots d'Adel relayés par le chef vers 18:00) — « on
// n'affiche que la ville ou le code postal, c'est pas bien ». Le lieu d'un événement se lit
// désormais en ADRESSE PRÉCISE (rue, ville) partout où la fiche le résume : téléphone, site et
// carte « Ma semaine » de l'accueil. Sans adresse précise connue : ce qui existe aujourd'hui
// (« Lyon (69001) », sinon rien). Remplace, pour le lieu, la planche ST-VUES3-ORDI du 03/10.
// Écrit ROUGE : `formatEventPlaceLine` n'existait pas.

describe('ACCUEIL-JOUEUR — le lieu, en adresse précise', () => {
  test('adresse connue : la rue et la ville', () => {
    expect(formatEventPlaceLine({
      locationDetails: JSON.stringify({
        address: { city: 'Lyon', label: '12 rue X, 69001 Lyon', postcode: '69001' },
      }),
    })).toBe('12 rue X, 69001 Lyon');
  });

  test('un lieu saisi en texte libre : tel quel, sans « France » au bout', () => {
    expect(formatEventPlaceLine({
      locationDetails: JSON.stringify({ address: 'Stade de Pélissanne, 13330 Pélissanne, France' }),
    })).toBe('Stade de Pélissanne, 13330 Pélissanne');
    expect(formatEventPlaceLine({ location: '4 avenue du Stade, 13100 Aix-en-Provence' }))
      .toBe('4 avenue du Stade, 13100 Aix-en-Provence');
  });

  test('seulement la ville connue : ce qui existe aujourd hui', () => {
    expect(formatEventPlaceLine({ location: { city: 'Lyon' } })).toBe('Lyon');
    expect(formatEventPlaceLine({
      locationDetails: JSON.stringify({
        address: { city: 'Lyon', label: 'Lyon', postcode: '69001' },
      }),
    })).toBe('Lyon (69001)');
    expect(formatEventPlaceLine({ locationDetails: JSON.stringify({ address: '69001 Lyon' }) }))
      .toBe('Lyon (69001)');
  });

  test('rien de sûr : rien', () => {
    expect(formatEventPlaceLine({
      location: { properties: { context: '69, Rhône, Auvergne-Rhône-Alpes' } },
    })).toBe('');
    expect(formatEventPlaceLine({})).toBe('');
    expect(formatEventPlaceLine(null)).toBe('');
  });
});

// ACCUEIL-JOUEUR (point 4, sur le site) — la fiche du site n'ouvrait aucun GPS. Sa ligne
// « Ouvrir dans le GPS » ouvre le lieu par la même aide (`openExternalMap`, nouvel onglet sur le
// site) ; la cible se calcule ici, une fois. Écrit ROUGE : `eventMapTarget` n'existait pas.
describe('ACCUEIL-JOUEUR — la cible du GPS et la fiche du site', () => {
  // eslint-disable-next-line global-require
  const { eventMapTarget } = require('../eventInfoLines');

  test('le lieu et ses coordonnées quand elles sont connues', () => {
    expect(eventMapTarget({
      locationDetails: JSON.stringify({
        address: {
          city: 'Lyon', label: '12 rue X, 69001 Lyon', lat: 45.76, lng: 4.83, postcode: '69001',
        },
      }),
    })).toEqual({ label: '12 rue X, 69001 Lyon', latitude: 45.76, longitude: 4.83 });
  });

  test('sans lieu : rien à ouvrir', () => {
    expect(eventMapTarget({})).toBeNull();
  });

  test('la fiche du site pose la ligne d action, avec cette cible', () => {
    // eslint-disable-next-line global-require
    const source = require('fs').readFileSync(require.resolve('../EventDetails.web.js'), 'utf8');
    expect(source).toContain('formatEventPlaceLine(event)');
    expect(source).toContain('onPress={() => openExternalMap(eventMapTarget(event))}');
    expect(source).toContain('<OuvrirDansLeGps');
  });
});
