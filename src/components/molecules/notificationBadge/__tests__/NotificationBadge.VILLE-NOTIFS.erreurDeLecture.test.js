import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationBadge from '../NotificationBadge';

// VILLE-NOTIFS (T18, point 2 — 07/10) : « LA CLOCHE DIT 4, LE PANNEAU DIT AUCUNE NOTIFICATION ».
//
// 🔴 Constate en recette (captures G53_cloche_ville, G53b) : pour le compte « Recette Mairie »,
// `count-unread` repond 4 mais `GET /notifications` repond 400. Le panneau de la cloche affichait
// « Aucune notification » : une ERREUR de lecture deguisee en liste vide. La cause du 400 est
// serveur (admin, VILLE-NOTIFS 1) ; ici, ce que l'app doit dire quand une lecture echoue, quelle
// qu'en soit la cause : « Impossible de charger les notifications » et « Reessayer ».
//
// Chaine VRAIE de bout en bout : la cloche, le vrai hook (react-query), le vrai panneau. Seul le
// service reseau est double — il echoue comme le serveur de la recette, puis repond.

// Le premier test paie le chargement du vrai panneau et du vrai hook :
// 5 s ne suffisent pas a froid.
jest.setTimeout(30000);

const mockReseau = {
  compteur: jest.fn(async () => ({ count: 4 })),
  liste: jest.fn(),
};

jest.mock('@/services/notification/notificationService', () => ({
  deleteNotification: jest.fn(),
  getNotifications: (/** @type {any} */ params) => mockReseau.liste(params),
  getUnreadCount: () => mockReseau.compteur(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn() }));

jest.mock('@/domains/auth/useAuth', () => {
  const sessionFigee = Object.freeze({
    isBootstrapResolved: true,
    userData: { documentId: 'mairie' },
  });
  return { __esModule: true, default: () => sessionFigee };
});

// Le VRAI theme (couleurs, polices, styles d'application), sans le fournisseur de l'app.
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  const themeFige = Object.freeze({
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
    Colors,
    Fonts: jest.requireActual('@/theme/fonts').default(Colors),
    Images: { bell: 1 },
    Spaces: jest.requireActual('@/theme/spaces').default,
  });
  return { __esModule: true, default: () => themeFige };
});

jest.mock('@/utils/webRuntime', () => ({
  getWebUnreadBadgeDelayMs: () => 0,
  getWebUnreadPollMs: () => undefined,
}));

const ERREUR_400 = Object.assign(new Error('Request failed with status code 400'), {
  response: {
    data: { error: { message: 'Invalid key user', name: 'ValidationError' } },
    status: 400,
  },
});

const page = (/** @type {number} */ nombre) => ({
  data: Array.from({ length: nombre }, (_v, i) => ({
    body: `Demande de creneau ${i + 1}`,
    createdAt: new Date().toISOString(),
    data: {},
    documentId: `n-${i + 1}`,
    read: false,
    title: `Nouvelle demande ${i + 1}`,
    type: 'overbookingRequest',
  })),
  meta: {
    pagination: {
      page: 1, pageCount: 1, pageSize: 20, total: nombre,
    },
  },
});

/** @type {renderer.ReactTestRenderer[]} */
const arbresMontes = [];

const monter = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  /** @type {renderer.ReactTestRenderer | undefined} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      createElement(QueryClientProvider, { client }, createElement(NotificationBadge)),
    );
  });
  const monte = /** @type {renderer.ReactTestRenderer} */ (arbre);
  arbresMontes.push(monte);
  return monte;
};

const textes = (/** @type {renderer.ReactTestRenderer} */ arbre) => arbre.root
  .findAllByType(Text)
  .flatMap((noeud) => [].concat(noeud.props.children))
  .filter((valeur) => valeur !== null && valeur !== undefined && valeur !== false)
  .map(String);

/**
 * Appuie sur ce qui porte ce libelle d'accessibilite.
 * @param {renderer.ReactTestRenderer} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const toucher = async (arbre, libelle) => {
  const cible = arbre.root.findAll((noeud) => (
    noeud.props?.accessibilityLabel === libelle && typeof noeud.props?.onPress === 'function'
  ))[0];
  if (!cible) {
    throw new Error(`rien a toucher pour « ${libelle} » ; textes : ${textes(arbre).join(' | ')}`);
  }
  await act(async () => {
    await cible.props.onPress();
  });
};

// Laisse react-query et les effets aller au bout (requetes, InteractionManager).
const laisserFiler = async () => {
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
  }
};

beforeEach(() => {
  mockReseau.compteur.mockClear();
  mockReseau.liste.mockReset();
});

afterEach(() => {
  arbresMontes.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
});

// eslint-disable-next-line max-len
test('VILLE-NOTIFS/A1 — la lecture echoue : le panneau dit l erreur et propose « Reessayer », jamais « Aucune notification »', async () => {
  mockReseau.liste.mockRejectedValue(ERREUR_400);
  const arbre = monter();
  await laisserFiler();
  await toucher(arbre, 'Notifications');
  await laisserFiler();

  expect(mockReseau.liste).toHaveBeenCalled();
  const affiches = textes(arbre);
  expect(affiches).toContain('Impossible de charger les notifications.');
  expect(affiches).toContain('Réessayer');
  expect(affiches).not.toContain('Aucune notification');
});

// eslint-disable-next-line max-len
test('VILLE-NOTIFS/A2 — « Reessayer » relit la liste, et la liste s affiche quand le serveur repond', async () => {
  mockReseau.liste.mockRejectedValueOnce(ERREUR_400).mockResolvedValue(page(4));
  const arbre = monter();
  await laisserFiler();
  await toucher(arbre, 'Notifications');
  await laisserFiler();
  const appelsAvant = mockReseau.liste.mock.calls.length;

  await toucher(arbre, 'Réessayer');
  await laisserFiler();

  expect(mockReseau.liste.mock.calls.length).toBe(appelsAvant + 1);
  const affiches = textes(arbre);
  expect(affiches).toEqual(expect.arrayContaining(['Nouvelle demande 1', 'Nouvelle demande 4']));
  expect(affiches).not.toContain('Impossible de charger les notifications.');
});

// eslint-disable-next-line max-len
test('VILLE-NOTIFS/A3 — caracterise : une liste vraiment vide dit toujours « Aucune notification »', async () => {
  mockReseau.liste.mockResolvedValue(page(0));
  const arbre = monter();
  await laisserFiler();
  await toucher(arbre, 'Notifications');
  await laisserFiler();

  const affiches = textes(arbre);
  expect(affiches).toContain('Aucune notification');
  expect(affiches).not.toContain('Impossible de charger les notifications.');
});
