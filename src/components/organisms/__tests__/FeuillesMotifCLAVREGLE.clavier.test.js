import { createElement } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import renderer, { act } from 'react-test-renderer';

import ChatMessageActionModal from '@/components/organisms/chatMessageActionModal/ChatMessageActionModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';

// ⌨️ CLAVREGLE (23/10) — trois feuilles à motif ajoutaient ELLES-MÊMES, sous leur champ, un vide
// de la hauteur du clavier : c'était leur façon de rester visibles, la feuille ne remontant pas.
// Depuis la règle de BottomModal (la feuille déclare le champ touché, la bibliothèque la remonte
// au-dessus du clavier : __tests__/BottomModalCLAVREGLE.clavier.test.js), ce vide compterait le
// clavier DEUX fois : la feuille monte, et un trou de la taille du clavier pousse le champ vers
// le haut de l'écran. Rouge avant : le bas du contenu suivait le clavier (336, ou 336 + 24).

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {any} */ defaut) => (typeof defaut === 'string' ? defaut : cle) }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => props.children,
}));

jest.mock('@/components/atoms/button/Button', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/** @type {Record<string, Function[]>} */
let ecouteurs = {};

beforeEach(() => {
  ecouteurs = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((/** @type {any} */ nom, /** @type {any} */ rappel) => {
    (ecouteurs[nom] = ecouteurs[nom] || []).push(rappel);
    return /** @type {any} */ ({ remove: () => {} });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const basDuContenu = (/** @type {any} */ arbre) => StyleSheet.flatten(
  arbre.root.findByType(ScrollView).props.contentContainerStyle,
).paddingBottom ?? 0;

describe.each([
  ['ChatMessageActionModal', ChatMessageActionModal],
  ['RefuseParticipationModal', RefuseParticipationModal],
  ['ReportEventModal', ReportEventModal],
])('CLAVREGLE — %s ne compte plus le clavier sous son champ', (_nom, Feuille) => {
  it('clavier ouvert : le bas du contenu ne bouge pas (la feuille remonte déjà)', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(/** @type {any} */ (Feuille), {
        isVisible: true, onClose: () => {}, onSubmit: () => {},
      }));
    });
    const ferme = basDuContenu(arbre);
    act(() => {
      (ecouteurs.keyboardDidShow || []).forEach((rappel) => rappel({ endCoordinates: { height: 336 } }));
    });
    expect(basDuContenu(arbre)).toBe(ferme);
    act(() => arbre.unmount());
  });
});
