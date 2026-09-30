import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyParentLink from '../MyParentLink';

/**
 * PARENT-LIEN — « MON PARENT » : L'ÉCRAN DE L'ENFANT.
 *
 * C'est ici que le lien se décide : l'enfant ACCEPTE ou REFUSE la demande, voit qui est relié
 * à son compte, et peut RETIRER le lien. L'écran dit ce que le parent verra (les retours du
 * coach) et ce qu'il ne verra jamais (les messages).
 */

/** @type {any} */
let mockVue;
const mockAccepter = jest.fn();
const mockRefuser = jest.fn();
const mockRetirer = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') {
          const source = (repli && typeof repli === 'object' ? repli : options) || {};
          return valeur.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ _t, /** @type {string} */ c) => String(source[c] ?? ''));
        }
        return `CLE_ABSENTE:${cle}`;
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Presse } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <Presse disabled={props.disabled} onPress={props.onPress} testID={props.testID}>
        <TexteRN>{props.title}</TexteRN>
      </Presse>
    ),
  };
});

jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useAcceptParentLink: () => ({ isPending: false, mutate: mockAccepter }),
  useParentLinksAsChild: () => ({ data: mockVue, error: undefined, isLoading: false }),
  useRefuseParentLink: () => ({ isPending: false, mutate: mockRefuser }),
  useUnlinkParent: () => ({ isPending: false, mutate: mockRetirer }),
}));

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const texte = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((n) => aplatir(n.props.children))
  .join(' | ');
const bouton = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && n.type === TouchableOpacity,
)[0];

const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<MyParentLink />); });
  return arbre;
};

const NADIA = {
  avatar: null, documentId: 'parent-1', firstname: 'Nadia', lastname: 'Martin',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVue = { eligible: true, parent: null, requests: [] };
});

// ① — et aucune clef de traduction ne manque.
test('MON-PARENT ① sans rien : l écran le dit, et dit ce que verrait un parent', async () => {
  const affiche = texte(await rendre());
  expect(affiche).toContain('Aucun parent n’est relié à ton compte.');
  expect(affiche).toContain('Il ne voit jamais tes messages.');
  expect(affiche).not.toContain('CLE_ABSENTE');
});

test('MON-PARENT ② la demande nomme QUI la fait ; l ado accepte ou refuse', async () => {
  mockVue = { eligible: true, parent: null, requests: [{ documentId: 'dem-1', parent: NADIA }] };
  const arbre = await rendre();
  expect(texte(arbre))
    .toContain('Nadia Martin demande à relier ton compte au sien, comme ton parent.');

  await act(async () => { bouton(arbre, 'parent-link-accept-dem-1').props.onPress(); });
  expect(mockAccepter).toHaveBeenCalledWith('dem-1');
  await act(async () => { bouton(arbre, 'parent-link-refuse-dem-1').props.onPress(); });
  expect(mockRefuser).toHaveBeenCalledWith('dem-1');
});

test('MON-PARENT ③ relié : l ado VOIT à qui, et RETIRE le lien après confirmation', async () => {
  mockVue = { eligible: true, parent: NADIA, requests: [] };
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const arbre = await rendre();
  expect(texte(arbre)).toContain('Ton compte est relié à');
  expect(texte(arbre)).toContain('Nadia Martin');

  await act(async () => { bouton(arbre, 'parent-link-unlink').props.onPress(); });
  expect(mockRetirer).not.toHaveBeenCalled();
  const [, , actions] = alerte.mock.calls[0];
  await act(async () => { actions.find((a) => a.style === 'destructive').onPress(); });
  expect(mockRetirer).toHaveBeenCalledTimes(1);
  alerte.mockRestore();
});
