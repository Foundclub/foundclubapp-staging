import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationPopup from '../NotificationPopup';

// FIN-COLLECTIVITES 3 (02/11, point 114, contre-recette) — la page Notifications dit « Ville » ou
// « Club » quand un compte reçoit les deux ; l'aperçu de la cloche, l'entrée par défaut à 390
// depuis l'espace Ville, ne le disait pas. Même règle que la page (casquette.js).

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

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn() }));

jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  const themeFige = Object.freeze({
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
    Colors,
    Fonts: jest.requireActual('@/theme/fonts').default(Colors),
    Images: { bell: 1 },
    Spaces: jest.requireActual('@/theme/spaces').default,
  });
  return { __esModule: true, default: () => themeFige };
});

const DE_LA_VILLE = {
  body: 'Une demande de créneau',
  createdAt: '2026-11-02T08:00:00.000Z',
  data: {},
  documentId: 'v1',
  read: false,
  title: 'Nouvelle demande',
  type: 'collectiviteSlotRequest',
};
const DU_CLUB = {
  body: 'Match samedi',
  createdAt: '2026-11-02T07:00:00.000Z',
  data: {},
  documentId: 'c1',
  read: true,
  title: 'Convocation',
  type: 'eventInvitation',
};

const monter = async (/** @type {any[]} */ notifications) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <NotificationPopup isVisible notifications={notifications} onClose={() => {}} />,
    );
  });
  return arbre;
};
const compter = (/** @type {any} */ arbre, /** @type {string} */ texte) => arbre.root
  .findAllByType(Text)
  .filter((/** @type {any} */ noeud) => [].concat(noeud.props.children).join('') === texte)
  .length;

describe('FIN-COLLECTIVITES 3 — les étiquettes dans l’aperçu de la cloche', () => {
  it('Ville et club mêlés : chacun porte la sienne', async () => {
    const arbre = await monter([DE_LA_VILLE, DU_CLUB]);
    expect(compter(arbre, 'Ville')).toBe(1);
    expect(compter(arbre, 'Club')).toBe(1);
  });

  it('jumeau : une seule casquette, aucune étiquette', async () => {
    const arbre = await monter([DU_CLUB]);
    expect(compter(arbre, 'Club')).toBe(0);
    expect(compter(arbre, 'Ville')).toBe(0);
  });
});
