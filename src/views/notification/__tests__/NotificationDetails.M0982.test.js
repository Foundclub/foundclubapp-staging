import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationDetails from '../NotificationDetails';

/**
 * RETOURS-TESTEUR (06/11, M0982 capture 2) — « la page notif est mal agencée avec le bouton retour
 * en haut ». Sur iPhone, un titre long (« Réponse du club (Yolaine Bard) ») passait sur deux lignes
 * À CÔTÉ du retour, serré dans une boîte de 48 px qui l'écrasait en ovale. Comme « Demandes », le
 * retour se pose seul en haut et le titre dessous, sur toute la largeur.
 */

const mockRoute = { params: {} };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => mockRoute,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/theme/themeContext', () => {
  const ramp = () => new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      // Le seul style lu ici : la ligne (le reste n'a pas d'effet sur ce témoin).
      Alignments: new Proxy({}, {
        get: (_cible, cle) => (cle === 'row' ? { flexDirection: 'row' } : {}),
      }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: ramp(),
      Spaces: ramp(),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (cle, repli) => (typeof repli === 'string' ? repli : cle) }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function RetourDouble() {
    return react.createElement(rn.View, { testID: 'retour' });
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.Text, { onPress: props.onPress }, props.title);
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/services/notification/notificationService', () => ({
  getNotificationById: jest.fn(),
  markAsRead: jest.fn(async () => undefined),
}));

const TITRE = 'Réponse du club (Yolaine Bard)';

/**
 * Le texte d'un nœud et de ses descendants.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join('')).join(' ');

describe('M0982 — le titre de la fiche ne se serre pas à côté du retour', () => {
  test('le retour et le titre ne sont pas sur la même ligne', () => {
    mockRoute.params = {
      notification: {
        body: 'Réponse concernant FoundClub : Merci pour ton intérêt.',
        createdAt: '2026-11-04T17:42:00.000Z',
        documentId: 'n-m0982',
        read: true,
        title: TITRE,
        type: 'clubInterestResponse',
      },
    };
    /** @type {any} */
    let arbre;
    act(() => { arbre = renderer.create(<NotificationDetails />); });

    const [retour] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'retour');
    let { parent } = retour;
    while (parent && !texteDe(parent).includes(TITRE)) parent = parent.parent;

    expect(parent).toBeTruthy();
    expect(StyleSheet.flatten(parent.props.style || {}).flexDirection).not.toBe('row');
    act(() => arbre.unmount());
  });
});
