import { Text, Vibration } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationBadge from '../NotificationBadge';

// NOTIFS-COMPTEUR (audit V1, A04, 30/09) — LA CLOCHE NE VIBRE PLUS QUAND ON LA TOUCHE.
//
// Filet E6 : ce composant n'avait AUCUN test. Il est dans l'en-tete de l'accueil, de la
// recherche et du profil. Deux etages : ce qui ne doit pas bouger (libelle, pastille,
// ouverture du panneau), puis ce que le lot change.
//
// La vibration GARDEE, volontairement : quand une notification ARRIVE pendant qu'on regarde
// l'ecran (le compteur monte), la cloche tremble et vibre une fois. Ce n'est pas un geste de
// l'utilisateur, c'est le signal d'arrivee qui accompagne l'animation.

const mockEtat = { unreadCount: 0 };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => {
  const sessionFigee = Object.freeze({
    isBootstrapResolved: true,
    userData: { documentId: 'moi' },
  });
  return { __esModule: true, default: () => sessionFigee };
});

// Le VRAI theme : un Proxy rendrait les echecs illisibles. Seules les images sont doublees.
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const themeFige = Object.freeze({ Colors: couleurs, Images: { bell: 1 } });
  return { __esModule: true, default: () => themeFige };
});

jest.mock('@/utils/webRuntime', () => ({
  getWebUnreadBadgeDelayMs: () => 0,
  getWebUnreadPollMs: () => undefined,
}));

jest.mock('@/hooks/useNotificationController', () => {
  const marquerTout = jest.fn();
  const marquerUne = jest.fn();
  const aucune = Object.freeze([]);
  return {
    useNotificationController: () => ({
      isLoading: false,
      markAllAsRead: marquerTout,
      markAsRead: marquerUne,
      notifications: aucune,
      unreadCount: mockEtat.unreadCount,
    }),
  };
});

jest.mock('@/components/organisms/notificationPopup/NotificationPopup', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function PanneauMock(/** @type {any} */ props) {
    return props.isVisible ? reactActuel.createElement(TexteRN, null, 'temoin-panneau-ouvert') : null;
  };
});

/** @type {renderer.ReactTestRenderer[]} */
const arbresMontes = [];

/**
 * @param {any} [props]
 * @returns {renderer.ReactTestRenderer}
 */
const monter = (props = {}) => {
  /** @type {renderer.ReactTestRenderer | undefined} */
  let arbre;
  act(() => {
    arbre = renderer.create(<NotificationBadge {...props} />);
  });
  const monte = /** @type {renderer.ReactTestRenderer} */ (arbre);
  arbresMontes.push(monte);
  return monte;
};

/**
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {string[]}
 */
const textes = (arbre) => arbre.root
  .findAllByType(Text)
  .flatMap((noeud) => [].concat(noeud.props.children))
  .map(String);

/**
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {void}
 */
const toucherLaCloche = (arbre) => {
  const cloche = arbre.root.findAll((noeud) => (
    noeud.props?.accessibilityLabel === 'Notifications' && typeof noeud.props?.onPress === 'function'
  ))[0];
  act(() => {
    cloche.props.onPress();
  });
};

/** @type {jest.SpyInstance} */
let vibrer;

beforeEach(() => {
  mockEtat.unreadCount = 0;
  vibrer = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});

afterEach(() => {
  arbresMontes.splice(0).forEach((arbre) => {
    act(() => {
      arbre.unmount();
    });
  });
  vibrer.mockRestore();
});

describe('NotificationBadge — ce qui ne doit pas bouger', () => {
  it('annonce la cloche et affiche le nombre de non-lues, plafonne a 99+', () => {
    mockEtat.unreadCount = 3;
    const avecTrois = monter();
    expect(avecTrois.root.findAll((noeud) => noeud.props?.accessibilityLabel === 'Notifications').length)
      .toBeGreaterThan(0);
    expect(textes(avecTrois)).toContain('3');

    mockEtat.unreadCount = 150;
    expect(textes(monter())).toContain('99+');

    mockEtat.unreadCount = 0;
    const sansNonLue = monter();
    expect(textes(sansNonLue)).not.toContain('0');
  });

  it('sans onPress, toucher la cloche ouvre le panneau des notifications', () => {
    const arbre = monter();
    expect(textes(arbre)).not.toContain('temoin-panneau-ouvert');
    toucherLaCloche(arbre);
    expect(textes(arbre)).toContain('temoin-panneau-ouvert');
  });

  it('avec onPress, toucher la cloche appelle onPress et n ouvre pas de panneau', () => {
    const onPress = jest.fn();
    const arbre = monter({ onPress });
    toucherLaCloche(arbre);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(textes(arbre)).not.toContain('temoin-panneau-ouvert');
  });

  it('une notification qui ARRIVE (compteur qui monte) fait vibrer une fois — vibration gardee', () => {
    mockEtat.unreadCount = 2;
    const arbre = monter();
    expect(vibrer).not.toHaveBeenCalled();

    mockEtat.unreadCount = 3;
    act(() => {
      arbre.update(<NotificationBadge />);
    });
    expect(vibrer).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationBadge — A04 : toucher la cloche ne vibre plus', () => {
  it('ouvrir le panneau ne fait pas vibrer', () => {
    mockEtat.unreadCount = 5;
    const arbre = monter();
    toucherLaCloche(arbre);
    expect(vibrer).not.toHaveBeenCalled();
  });

  it('avec onPress, toucher la cloche ne fait pas vibrer non plus', () => {
    const arbre = monter({ onPress: jest.fn() });
    toucherLaCloche(arbre);
    expect(vibrer).not.toHaveBeenCalled();
  });
});
