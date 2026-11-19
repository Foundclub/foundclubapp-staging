/* eslint-disable max-len -- titres de témoins en phrases */
import { ImageBackground } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => vide }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// IMPL-1B-PHOTO (19/11/2026, demande d'Adel du 18/11, écrans 6b, 6d, 9f, 11a) — LA PHOTO DU COMPLEXE
// EN BANDEAU DE LA FICHE DU TOURNOI. Le serveur (IMPL-5B) la rend sous `facility` : `photos` (le
// terrain), sinon `complexe.photos`. Sans photo, l'illustration du tournoi (card-tournoi.png) reste
// seule, comme avant. Les doubles sont ceux de EventHeader.IMPL-1.bandeau.test.js.

const media = (/** @type {string} */ nom, /** @type {any} */ extra = {}) => ({
  alternativeText: null,
  formats: { medium: { url: `https://cdn.test/medium_${nom}.jpg` }, small: { url: `https://cdn.test/small_${nom}.jpg` } },
  url: `https://cdn.test/${nom}.jpg`,
  ...extra,
});

const TOURNOI = (/** @type {any} */ facility) => ({
  club: { name: 'AR Soccer' },
  date: '2099-12-19T18:00:00.000Z',
  documentId: 'event-1',
  facility,
  location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
  name: 'FoundClub x AR Soccer',
  startTime: '19:00:00',
  type: { name: 'Tournoi' },
});

const COMPLEXE = (/** @type {any[]} */ liste) => ({
  documentId: 'cx1', name: 'AR Soccer', photos: liste, slug: 'ar-soccer',
});

const monter = (/** @type {any} */ event, /** @type {any} */ tournamentHero = { statusLabel: 'Inscriptions ouvertes' }) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={event} tournamentHero={tournamentHero} />);
  });
  const { root } = arbre;
  const resultat = {
    fonds: root.findAllByType(ImageBackground).length,
    photos: root.findAll((/** @type {any} */ n) => n.props?.testID === 'event-header-venue-photo' && typeof n.type === 'string')
      .map((/** @type {any} */ n) => ({ alt: n.props.accessibilityLabel, source: n.props.source })),
  };
  act(() => arbre.unmount());
  return resultat;
};

describe('IMPL-1B (6b, 6d, 9f, 11a) — la photo du complexe en bandeau', () => {
  test('🔴 la photo du complexe (taille medium) dans le bandeau, le nom du complexe pour texte alternatif', () => {
    const { fonds, photos } = monter(TOURNOI({ complexe: COMPLEXE([media('ballon')]), documentId: 'f1', photos: [] }));
    expect(photos).toEqual([{ alt: 'AR Soccer', source: { uri: 'https://cdn.test/medium_ballon.jpg' } }]);
    // Un seul bandeau : l'illustration reste dessous, la photo se pose dessus.
    expect(fonds).toBe(1);
  });

  test('🔴 la photo du terrain d abord, son texte alternatif s il en a un', () => {
    const { photos } = monter(TOURNOI({
      complexe: COMPLEXE([media('complexe')]), documentId: 'f1', photos: [media('terrain', { alternativeText: 'Le terrain couvert' })],
    }));
    expect(photos).toEqual([{ alt: 'Le terrain couvert', source: { uri: 'https://cdn.test/medium_terrain.jpg' } }]);
  });

  test('sans photo, complexe absent (suspendu) ou aucun lieu : l illustration seule, comme avant', () => {
    [
      TOURNOI({ complexe: COMPLEXE([]), documentId: 'f1', photos: [] }),
      TOURNOI({ documentId: 'f1', name: 'Terrain A' }),
      TOURNOI(null),
    ].forEach((event) => {
      const { fonds, photos } = monter(event);
      expect(photos).toEqual([]);
      expect(fonds).toBe(1);
    });
  });

  test('hors bandeau (autres écrans de l en-tête) : aucune photo ajoutée', () => {
    expect(monter(TOURNOI({ complexe: COMPLEXE([media('ballon')]), documentId: 'f1', photos: [] }), null).photos).toEqual([]);
  });
});
