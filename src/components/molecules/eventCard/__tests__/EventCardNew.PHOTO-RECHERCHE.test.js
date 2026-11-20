/* eslint-disable max-len -- titres de témoins en phrases */
import renderer, { act } from 'react-test-renderer';

import { mapSearchPayload } from '@/services/search/searchService';

import EventCardNew from '../EventCardNew';

// PHOTO-RECHERCHE (19/11/2026, décision d'Adel : la photo du complexe aussi sur la recherche
// publique) — L'APP N'A RIEN À CODER, CE TÉMOIN LE PROUVE. Le serveur rattache désormais
// `facility.photos` et `facility.complexe` aux cartes de `/search/events` et
// `/search/events/map` (admin `controllers/search.ts`, forme de la carte d'IMPL-5B : le logo et
// UNE photo). Le chemin de l'app : la page de réponse → `mapSearchPayload` (searchService.js,
// étale `entry.payload` tel quel) → `EventListContent.renderItem` → `EventCardNew` →
// `photoDuLieu(item, 'small')`. Ce témoin y fait passer une réponse de la forme EXACTE que rend
// le serveur à un visiteur sans compte (facility = documentId, id, name, photos, complexe).
// Doubles : ceux de EventCardNew.IMPL-1B.photo.test.js.

jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Le marquee sponsors suspend son animation hors focus : hors navigateur
// (tests), l'écran est considéré comme focus.
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  // Jetons opaques : le contrat de thème interdit les littéraux hex, et un
  // mock n'a pas besoin de vraies couleurs. `couleur-<jeton>` rend chaque
  // usage assertable (ex. la couleur du chip par type d'événement).
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      // `image-<clé>` : rend le fond illustré par type assertable.
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  // La chaîne d'import réelle passe par @/theme/strings qui initialise i18next.
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

const mockUserData = jest.fn();
// T-PAGES-4 : l'organisateur du tournoi (canManageEvent) garde la jauge du vrai nombre.
const mockCanManageEvent = jest.fn(() => false);
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageEvent: mockCanManageEvent, userData: mockUserData() }),
}));

const mockHaveIAlreadyJoined = jest.fn();
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: (args) => mockHaveIAlreadyJoined(args),
  }),
}));

const renderCard = (/** @type {any} */ props) => {
  /** @type {any} */
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

const photos = (/** @type {any} */ tree) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'event-card-venue-photo' && typeof n.type === 'string',
);

const media = (/** @type {string} */ nom) => ({
  alternativeText: `Texte de ${nom}`,
  formats: {
    large: { height: 563, url: `https://cdn.test/large_${nom}.jpg`, width: 1000 },
    medium: { height: 422, url: `https://cdn.test/medium_${nom}.jpg`, width: 750 },
    small: { height: 281, url: `https://cdn.test/small_${nom}.jpg`, width: 500 },
    thumbnail: { height: 138, url: `https://cdn.test/thumbnail_${nom}.jpg`, width: 245 },
  },
  height: 900,
  url: `https://cdn.test/${nom}.jpg`,
  width: 1600,
});

// Une page de `/search/events/map?view=list` sans compte, telle que le serveur la rend.
const PAGE = (/** @type {any} */ facility, typeName = 'Tournoi') => ({
  data: [{
    distanceKm: 1.2,
    documentId: 'tournoi-1912',
    entityType: 'event',
    highlights: { subtitle: 'Montpellier', title: 'FoundClub x AR Soccer' },
    matchReasons: [],
    payload: {
      date: '2099-12-19T18:00:00.000Z',
      documentId: 'tournoi-1912',
      facility,
      id: 3442,
      location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
      name: 'FoundClub x AR Soccer',
      sessionStatus: 'open',
      status: 'confirmed',
      type: { documentId: 'type-tournoi', id: 5, name: typeName },
    },
  }],
  meta: {
    pagination: {
      page: 1, pageCount: 1, pageSize: 20, total: 1,
    },
  },
});

const LIEU = (/** @type {any} */ extra) => ({
  complexe: {
    documentId: 'cx1', logo: media('logo'), name: 'AR Soccer', photos: [], slug: 'ar-soccer',
  },
  documentId: 'f1',
  id: 31,
  name: 'Terrain A',
  photos: [media('terrain')],
  ...extra,
});

describe('PHOTO-RECHERCHE — la carte d un tournoi venue de la recherche porte la photo du lieu', () => {
  test('mapSearchPayload laisse le terrain INTACT (photos et complexe compris)', () => {
    const [item] = mapSearchPayload(PAGE(LIEU()));
    expect(item.facility).toEqual(LIEU());
  });

  test('la photo du terrain, en taille small, au fond de la carte', () => {
    const [item] = mapSearchPayload(PAGE(LIEU()));
    const [photo] = photos(renderCard({ item }));
    expect(photo).toBeDefined();
    expect(photo.props.source).toEqual({ uri: 'https://cdn.test/small_terrain.jpg' });
    expect(photo.props.accessibilityLabel).toBe('Texte de terrain');
  });

  test('terrain retiré (photos []) : la photo du complexe prend sa place', () => {
    const [item] = mapSearchPayload(PAGE(LIEU({
      complexe: {
        documentId: 'cx1', logo: null, name: 'AR Soccer', photos: [media('complexe')], slug: 'ar-soccer',
      },
      photos: [],
    })));
    expect(photos(renderCard({ item }))[0].props.source).toEqual({ uri: 'https://cdn.test/small_complexe.jpg' });
  });

  test('complexe suspendu (clés absentes) : l illustration du tournoi reste seule', () => {
    const [item] = mapSearchPayload(PAGE({ documentId: 'f1', id: 31, name: 'Terrain A' }));
    const tree = renderCard({ item });
    expect(photos(tree)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('image-eventCardTournament');
  });

  test('une carte d entraînement venue de la recherche garde son illustration (photo sur les tournois seulement)', () => {
    const [item] = mapSearchPayload(PAGE(LIEU(), 'Entraînement'));
    expect(photos(renderCard({ item }))).toHaveLength(0);
  });
});
