/* eslint-disable max-len -- titres de témoins en phrases */
import renderer, { act } from 'react-test-renderer';

import EventCardNew from '../EventCardNew';

// IMPL-1B-PHOTO (19/11/2026, demande d'Adel du 18/11, écrans 6a et 7a) — LA PHOTO DU COMPLEXE AU
// FOND DE LA CARTE DU TOURNOI (Rechercher, accueil). Le serveur (IMPL-5B) la rend sous `facility` :
// `photos` (le terrain), sinon `complexe.photos`. Sans photo, l'illustration du type reste seule.
// Les doubles sont ceux de EventCardNew.IMPL-1.tournoi.test.js.

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
  alternativeText: null,
  formats: { small: { url: `https://cdn.test/small_${nom}.jpg` } },
  url: `https://cdn.test/${nom}.jpg`,
});

const TOURNOI = (/** @type {any} */ facility) => ({
  date: '2099-12-19T18:00:00',
  documentId: 'tournoi-1912',
  facility,
  location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
  name: 'FoundClub x AR Soccer',
  sessionStatus: 'open',
  type: { name: 'Tournoi' },
});

const COMPLEXE = (/** @type {any[]} */ liste) => ({
  documentId: 'cx1', name: 'AR Soccer', photos: liste, slug: 'ar-soccer',
});

describe('IMPL-1B · 6a / 7a — la photo du complexe sur la carte du tournoi', () => {
  test('🔴 la photo du complexe (taille small) au fond, avec le nom du complexe pour texte alternatif', () => {
    const tree = renderCard({ item: TOURNOI({ complexe: COMPLEXE([media('ballon')]), documentId: 'f1', photos: [] }) });
    const [photo] = photos(tree);
    expect(photo).toBeDefined();
    expect(photo.props.source).toEqual({ uri: 'https://cdn.test/small_ballon.jpg' });
    expect(photo.props.accessibilityLabel).toBe('AR Soccer');
    // L'illustration du type reste dessous : elle couvre une photo qui ne charge pas.
    expect(JSON.stringify(tree.toJSON())).toContain('image-eventCardTournament');
  });

  test('🔴 la photo du terrain passe avant celle du complexe', () => {
    const tree = renderCard({
      item: TOURNOI({ complexe: COMPLEXE([media('complexe')]), documentId: 'f1', photos: [media('terrain')] }),
    });
    expect(photos(tree)[0].props.source).toEqual({ uri: 'https://cdn.test/small_terrain.jpg' });
  });

  test('sans photo, ou complexe absent (suspendu), l illustration du tournoi reste seule', () => {
    [
      TOURNOI({ complexe: COMPLEXE([]), documentId: 'f1', photos: [] }),
      TOURNOI({ documentId: 'f1', name: 'Terrain A' }),
      TOURNOI(null),
    ].forEach((item) => {
      const tree = renderCard({ item });
      expect(photos(tree)).toHaveLength(0);
      expect(JSON.stringify(tree.toJSON())).toContain('image-eventCardTournament');
    });
  });

  test('un entraînement au même complexe garde son illustration (seul le tournoi est demandé)', () => {
    const tree = renderCard({
      item: {
        ...TOURNOI({ complexe: COMPLEXE([media('ballon')]), documentId: 'f1', photos: [] }),
        type: { name: 'Entraînement' },
      },
    });
    expect(photos(tree)).toHaveLength(0);
  });
});
