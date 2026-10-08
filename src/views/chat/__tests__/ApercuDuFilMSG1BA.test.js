import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ApercuDuFil from '../ApercuDuFil';

// MSG1BA (§3.14) — LA CARTE DE L'APERÇU : le fil en lecture seule (les messages les plus
// recents, du plus ancien au plus recent), la pilule « Aperçu : reste non lu » quand il y a
// des non-lus, une notice de groupe en ligne discrete, et le menu dessous.

/** @type {any} */
let mockPages = { pages: [] };
const mockUseGetChatMessages = jest.fn();
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessages: (/** @type {any[]} */ ...args) => {
    mockUseGetChatMessages(...args);
    return { data: mockPages };
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (m, nom) => (repli?.[nom] !== undefined ? String(repli[nom]) : m),
      );
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/views/chat/AvatarDuFil', () => () => null);

const FIL = { documentId: 'chat-1', groupName: 'Les U13', type: 'group' };

/**
 * Rend la carte.
 * @param {Record<string, any>} [props]
 * @returns {{ arbre: any, onClose: jest.Mock, onOuvrir: jest.Mock, geste: jest.Mock }}
 */
const rendre = (props = {}) => {
  const onClose = jest.fn();
  const onOuvrir = jest.fn();
  const geste = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ApercuDuFil
        chat={FIL}
        entrees={[{
          cle: 'marquer-lu', icone: 'checkDouble', libelle: 'Marquer comme lu', onPress: geste,
        }]}
        meId="moi"
        nonLu={props.nonLu ?? true}
        onClose={onClose}
        onOuvrir={onOuvrir}
        titre="Les U13"
        visible={props.visible ?? true}
      />,
    );
  });
  return {
    arbre, geste, onClose, onOuvrir,
  };
};

/**
 * Les textes affiches, a la suite.
 * @param {any} arbre
 * @returns {string}
 */
const textes = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' | ');

/**
 * L'element touchable qui porte ce testID.
 * @param {any} arbre
 * @param {string} id
 * @returns {any}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
)[0];

beforeEach(() => {
  mockUseGetChatMessages.mockClear();
  mockPages = {
    pages: [{
      data: [
        {
          createdAt: '2026-10-07T10:05:00.000Z',
          documentId: 'm3',
          message: 'Ok pour moi',
          sender: { documentId: 'moi', firstname: 'Adel' },
        },
        {
          createdAt: '2026-10-07T10:02:00.000Z',
          documentId: 'n1',
          message: 'Karim a renommé le groupe en « Les U13 ».',
          sender: null,
        },
        {
          createdAt: '2026-10-07T10:00:00.000Z',
          documentId: 'm1',
          message: 'Rappel : 19h30',
          sender: { documentId: 'karim', firstname: 'Karim' },
        },
      ],
    }],
  };
});

describe('ApercuDuFil (§3.14)', () => {
  test('AF1 — lecture seule, du plus ancien au plus recent, avec le nom en groupe', () => {
    const { arbre } = rendre();
    const vu = textes(arbre);
    expect(vu).toContain('Les U13');
    expect(vu.indexOf('Rappel : 19h30')).toBeLessThan(vu.indexOf('Ok pour moi'));
    expect(vu).toContain('Karim | Rappel : 19h30');
    // Mes messages ne portent pas mon nom.
    expect(vu).not.toContain('Adel');
    // Une notice de groupe (sans expediteur) : sa phrase, en ligne discrete.
    expect(vu).toContain('Karim a renommé le groupe en « Les U13 ».');
  });

  test('AF2 — non lu : la pilule « Aperçu : reste non lu » ; lu : pas de pilule', () => {
    expect(textes(rendre({ nonLu: true }).arbre)).toContain('Aperçu : reste non lu');
    expect(textes(rendre({ nonLu: false }).arbre)).not.toContain('Aperçu : reste non lu');
  });

  test('AF3 — toucher la carte ouvre la conversation ; une entree ferme puis agit', () => {
    const {
      arbre, geste, onClose, onOuvrir,
    } = rendre();
    act(() => {
      parId(arbre, 'apercu-du-fil-carte').props.onPress();
    });
    expect(onOuvrir).toHaveBeenCalled();
    act(() => {
      parId(arbre, 'apercu-du-fil-marquer-lu').props.onPress();
    });
    expect(onClose).toHaveBeenCalled();
    expect(geste).toHaveBeenCalled();
  });

  test('AF4 — les messages ne sont lus que la carte ouverte, sans rien ecrire', () => {
    rendre({ visible: false });
    expect(mockUseGetChatMessages).toHaveBeenLastCalledWith(
      { chatId: 'chat-1' },
      { enabled: false },
    );
  });
});

describe('ApercuDuFil (§3.17)', () => {
  test('AF5 — une notice de groupe s y lit aussi pour moi : « Vous avez… »', () => {
    mockPages = {
      pages: [{
        data: [{
          createdAt: '2026-10-07T10:02:00.000Z',
          documentId: 'n1',
          message: 'Adel a changé la photo du groupe.',
          sender: null,
          systemNotice: {
            actor: { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
            kind: 'group_photo_changed',
            targets: [],
            version: 1,
          },
        }],
      }],
    };
    expect(textes(rendre().arbre)).toContain('Vous avez changé la photo du groupe.');
  });
});
