/* eslint-disable max-len -- les témoins se lisent en entier. */
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationPopup from '../NotificationPopup';

// FIN-CLOCHE (02/11/2026, point 64, Adel « recommandation A ») — UN SEUL COMPTEUR.
//
// Mesuré sur la recette : Hugo a 376 non lues, la cloche dit « 99+ », le panneau disait « 12 ».
// Le panneau comptait les non lues parmi les 20 notifications CHARGÉES : un autre chiffre, sur
// les 5 comptes relevés (12 / 376, 13 / 43, 20 / 482, 15 / 19, 20 / 45). Il dit maintenant le
// chiffre du serveur que la cloche affiche, écrit de la même façon.
// Ce fichier est aussi le filet E6 : le panneau n'avait aucun test.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn(() => true) }));
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => '' }));
jest.mock('@/utils/notifications/notificationNavigation', () => ({
  resolveNotificationDestination: () => null,
}));
jest.mock('@/utils/notifications/notificationPresentation', () => ({
  formatNotificationRelativeTime: () => 'Il y a 1 h',
  getNotificationIcon: () => 'bell',
  getNotificationTone: () => ({}),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const echelle = () => new Proxy({}, { get: () => ({}) });
  const themeFige = Object.freeze({
    ApplicationStyle: { hitSlop: { min44From24: undefined } },
    Colors: couleurs,
    Fonts: echelle(),
    Spaces: echelle(),
  });
  return { __esModule: true, default: () => themeFige };
});

/**
 * Des notifications de test.
 * @param {number} combien - Le nombre de lignes chargées.
 * @param {number} nonLues - Combien, parmi elles, ne sont pas lues.
 * @returns {any[]} Les notifications.
 */
const chargees = (combien, nonLues) => Array.from({ length: combien }, (_, index) => ({
  body: `Corps ${index}`,
  createdAt: '2026-11-02T10:00:00.000Z',
  documentId: `n${index}`,
  read: index >= nonLues,
  title: `Titre ${index}`,
  type: 'eventPublished',
}));

/** @type {renderer.ReactTestRenderer[]} */
const montes = [];

/**
 * Monte le panneau ouvert et rend les textes affichés.
 * @param {any} props - Les chiffres du cas.
 * @returns {string[]} Tous les textes du panneau.
 */
const textes = (props) => {
  /** @type {renderer.ReactTestRenderer | undefined} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(NotificationPopup, {
      isLoading: false,
      isVisible: true,
      onClose: jest.fn(),
      onMarkAllAsRead: jest.fn(),
      onMarkAsRead: jest.fn(),
      ...props,
    }));
  });
  const monte = /** @type {renderer.ReactTestRenderer} */ (arbre);
  montes.push(monte);
  return monte.root.findAllByType(Text)
    .map((noeud) => [].concat(noeud.props.children).join(''));
};

afterEach(() => {
  while (montes.length) {
    const monte = montes.pop();
    act(() => monte?.unmount());
  }
});

describe('FIN-CLOCHE : le panneau dit le chiffre de la cloche', () => {
  test('376 non lues dont 12 chargées : « 99+ », comme la cloche, pas « 12 »', () => {
    const lus = textes({ notifications: chargees(20, 12), unreadCount: 376 });
    expect(lus).toContain('99+');
    expect(lus).not.toContain('12');
  });

  test('43 non lues dont 13 chargées : « 43 », pas « 13 »', () => {
    const lus = textes({ notifications: chargees(20, 13), unreadCount: 43 });
    expect(lus).toContain('43');
    expect(lus).not.toContain('13');
  });

  test('les 20 dernières sont lues mais 5 plus anciennes ne le sont pas : le chiffre et « Tout lire » restent', () => {
    const lus = textes({ notifications: chargees(20, 0), unreadCount: 5 });
    expect(lus).toContain('5');
    expect(lus).toContain('Tout lire');
  });

  test('plus rien à lire : ni chiffre, ni « Tout lire », même si la liste en cache est en retard', () => {
    const lus = textes({ notifications: chargees(20, 3), unreadCount: 0 });
    expect(lus).not.toContain('3');
    expect(lus).not.toContain('Tout lire');
  });
});

describe('ce qui ne bouge pas', () => {
  test('le panneau montre les 8 plus récentes et son lien vers toutes', () => {
    const lus = textes({ notifications: chargees(20, 12), unreadCount: 12 });
    expect(lus).toContain('Titre 7');
    expect(lus).not.toContain('Titre 8');
    expect(lus).toContain('Voir toutes les notifications');
  });

  test('fermé, il ne dessine rien', () => {
    expect(textes({ isVisible: false, notifications: chargees(3, 1), unreadCount: 1 })).toEqual([]);
  });
});
