import { ScrollView, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// PETITSBUGS-2 (presentation Coach, affiche SMUC) — « Ton événement est en ligne » passait
// SOUS l heure de la barre d etat (« Tom3:4événement »). La barre d etat etait reservee DANS
// le defilement (paddingTop du contenu) : des qu on fait defiler, le titre remonte sous
// l heure, quelle que soit sa longueur. La reserve passe HORS du defilement.

const BARRE_ETAT = 59;

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: BARRE_ETAT,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: { hitSlop: makeRamp() },
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/platform/visualRender', () => ({
  downloadAndShareRender: jest.fn(() => Promise.resolve({ opened: true, outcome: 'shareSheet' })),
  fetchRenderBase64: jest.fn(() => Promise.resolve({ base64: 'QUJD', contentType: 'image/png' })),
}));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
  share: jest.fn(),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: { data: null } })) },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: () => 'https://api.test.foundclub/api',
  getPublicApiOrigin: () => 'https://test.foundclub',
}));

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() {
  return null;
});

jest.setTimeout(20000);

describe('PETITSBUGS-2 — le titre ne passe jamais sous la barre d etat', () => {
  test('ROUGE-AVANT — la barre d etat est reservee hors du defilement', async () => {
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <EventPublishedShowcase
          navigation={/** @type {any} */ ({ goBack: jest.fn(), navigate: jest.fn() })}
          route={/** @type {any} */ ({ params: { eventId: 'evt-1' } })}
        />,
      );
    });

    const defilement = arbre.root.findByType(ScrollView);
    const contenu = StyleSheet.flatten(defilement.props.contentContainerStyle);
    // Le contenu qui defile ne porte plus la barre d etat…
    expect(contenu.paddingTop).toBeLessThan(BARRE_ETAT);
    // …c est un parent IMMOBILE du defilement qui la reserve.
    let { parent } = defilement;
    let reserve = 0;
    while (parent) {
      const style = StyleSheet.flatten(parent.props?.style) || {};
      if (typeof style.paddingTop === 'number') reserve = Math.max(reserve, style.paddingTop);
      ({ parent } = parent);
    }
    expect(reserve).toBeGreaterThanOrEqual(BARRE_ETAT);
  });
});
