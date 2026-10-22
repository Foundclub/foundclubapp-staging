import { Image, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationList from '../NotificationList';

// COLL-C3B-BIS (03/10) — planche 35 (P6-notifs, états 3 à 7 ; liste du plan, ligne 35) : la liste
// « Notifications » d'une demande de créneau. ROUGE avant : un calendrier blanc pour toutes,
// rien ne disait « Refusée » en rouge, et la cloche vide était grise au lieu du bleu de la planche.
// Harnais repris de NotificationListCOACH1.test.js (couleurs nommées « couleur-<jeton> »).

const mockNotifications = { list: [] };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SwipeableDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('react-native-reanimated', () => {
  const rn = jest.requireActual('react-native');
  const chain = { delay: () => chain, duration: () => chain };
  return { __esModule: true, default: { View: rn.View }, FadeInDown: chain };
});

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: makeRamp(),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn() }));

jest.mock('@/services/client', () => ({ __esModule: true, default: { post: jest.fn() } }));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    deleteNotification: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    loadMore: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    notifications: mockNotifications.list,
    refreshNotifications: jest.fn(),
    unreadCount: 1,
  }),
}));

const notification = (
  /** @type {string} */ documentId,
  /** @type {any} */ donnees,
  titre = '',
) => ({
  body: 'U15 · jeu. 8 oct., 19:00 – 20:30 · Gymnase des Tilleuls.',
  createdAt: new Date().toISOString(),
  data: { type: 'overbookingRequest', ...donnees },
  documentId,
  read: false,
  title: titre,
  type: 'overbookingRequest',
});

const VILLE = { collectiviteName: 'Ville de Montrivage' };

const monter = () => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<NotificationList />);
  });
  return arbre;
};

// L'icône d'une ligne : l'image teintée (SvgIcon) dans la pastille ronde, dans l'ordre de la liste.
const icones = (/** @type {any} */ arbre) => arbre.root.findAllByType(Image)
  .map((/** @type {any} */ image) => [image.props.style].flat(Infinity).filter(Boolean)
    .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...s }), {}).tintColor);

const textesEnCouleur = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => ({
    couleur: [noeud.props.style].flat(Infinity).filter(Boolean)
      .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...s }), {}).color,
    texte: [noeud.props.children].flat().join(''),
  }));

beforeEach(() => {
  mockNotifications.list = [];
});

// eslint-disable-next-line max-len
test('C3B-BIS/N1 — acceptée : la coche verte ; refusée : la croix rouge et « Refusée » en rouge', () => {
  mockNotifications.list = [
    notification('n-ok', { ...VILLE, decision: 'approved' }, 'La Ville de Montrivage a accepté'),
    notification('n-non', { ...VILLE, decision: 'refused' }, 'La Ville de Montrivage a refusé'),
  ];
  const arbre = monter();
  const teintes = icones(arbre);
  expect(teintes).toEqual(expect.arrayContaining(['couleur-success500', 'couleur-error300']));
  const refusee = textesEnCouleur(arbre).find((ligne) => ligne.texte === 'Refusée');
  expect(refusee).toEqual({ couleur: 'couleur-error500', texte: 'Refusée' });
  // Une seule fois : l'acceptée ne le dit pas.
  expect(textesEnCouleur(arbre).filter((ligne) => ligne.texte === 'Refusée')).toHaveLength(1);
});

// eslint-disable-next-line max-len
test('C3B-BIS/N2 — la cloche vide : la cloche du système de design, en bleu (planche, état 7)', () => {
  const arbre = monter();
  expect(icones(arbre)).toEqual(['couleur-primary200']);
});

// RESA-FIN-APP (20/10/2026) — tournée 2 : dans la cloche du JOUEUR, « Réservation annulée » (par le complexe) et
// « Complexe fermé » portaient la pastille rouge « Refusée » : une annulation n'est pas un refus. La pastille
// reste rouge, mais dit ce qui est arrivé (les mots des pastilles de « Mes réservations », E-P10).
const notificationDuJoueur = (/** @type {string} */ documentId, /** @type {string} */ change) => ({
  body: 'Le Five de Montrivage · Terrain 1 · jeu. 22/10, 20 h.',
  createdAt: new Date().toISOString(),
  data: { change, reservationId: `r-${documentId}`, type: 'complexeReservationJoueur' },
  documentId,
  read: false,
  title: 'Réservation',
  type: 'complexeReservationJoueur',
});

test('RESA-FIN-APP (2) — annulée ou fermeture : « Annulée par le complexe » ; refusée : « Refusée »', () => {
  mockNotifications.list = [
    notificationDuJoueur('n-annulee', 'annulee'),
    notificationDuJoueur('n-fermeture', 'fermeture'),
    notificationDuJoueur('n-refusee', 'refusee'),
    notificationDuJoueur('n-sans', 'sans-reponse'),
  ];
  const rouges = textesEnCouleur(monter())
    .filter((ligne) => ligne.couleur === 'couleur-error500')
    .map((ligne) => ligne.texte);
  expect(rouges).toEqual(['Annulée par le complexe', 'Annulée par le complexe', 'Refusée', 'Sans réponse']);
});

// RESA-FIN-APP-2 (22/10/2026) — T13, tournée 2 : « Complexe de nouve… », le titre d'une
// notification tenait sur UNE ligne à côté de l'heure. Il passe sur deux lignes avant de couper.
test('RESA-FIN-APP-2 (T13) — le titre a deux lignes avant de couper', () => {
  mockNotifications.list = [{
    ...notificationDuJoueur('n-retabli', 'retabli'),
    title: 'Complexe de nouveau visible',
  }];
  const [titre] = monter().root.findAllByType(Text)
    .filter((/** @type {any} */ noeud) => noeud.props.children === 'Complexe de nouveau visible');
  expect(titre.props.numberOfLines).toBe(2);
});
