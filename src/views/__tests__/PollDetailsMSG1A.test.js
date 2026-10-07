import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// MSG1A (§3.4) — E6 : LE DETAIL DU SONDAGE (telephone), CE QUI DOIT SURVIVRE AU RESTYLE.
//
// Le fichier n'avait aucun temoin natif (seule sa version site en a un). Ce temoin passe sur
// la version d'AVANT MSG1A (verifie en remettant l'ancien fichier) et sur la nouvelle :
// la question, chaque option, les NOMS des votants (lus par `resolveVoterName` et la fiche
// des participants, que ce lot ne touche pas), le compte total, et rien de nominatif pour un
// sondage anonyme.

const mockVotePoll = jest.fn(() => Promise.resolve());
let mockMessages = [];

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34,
    left: 0,
    right: 0,
    top: 47,
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

// SONDAGE-NOMS — le crochet qui lit les noms au serveur est double : ce temoin ne parle qu'a
// la bulle ; les profils rendus par le serveur se reglent par `mockProfils`.
const mockProfils = new Map();
jest.mock('@/domains/messaging/usePollVoterProfiles', () => ({
  __esModule: true,
  default: () => mockProfils,
  nameOfPollVoter: (/** @type {any} */ profil) => (
    `${String(profil?.firstname || '').trim()} ${String(profil?.lastname || '').trim()}`.trim()
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli === 'object') {
        const forme = repli.count === 1 ? repli.defaultValue_one : repli.defaultValue_other;
        const texte = forme || repli.defaultValue || cle;
        return texte.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ m, /** @type {string} */ nom) => (
            repli[nom] !== undefined ? String(repli[nom]) : m
          ),
        );
      }
      return cle;
    },
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueriesData: jest.fn() }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', firstname: 'Adel', lastname: 'F' } }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ votePoll: mockVotePoll }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: {
      participants: [
        { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
        { documentId: 'lea', firstname: 'Lea', lastname: 'Morel' },
      ],
    },
  }),
  useGetChatMessages: () => ({ data: { pages: [{ data: mockMessages }] }, isLoading: false }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);

const sondage = (extra = {}) => ({
  allowMultipleVotes: false,
  createdBy: 'karim',
  isAnonymous: false,
  options: [
    { id: 'o1', label: 'Mardi 19h', voters: ['karim', 'lea'] },
    { id: 'o2', label: 'Jeudi 20h', voters: [] },
  ],
  question: 'Quel creneau ?',
  type: 'poll',
  ...extra,
});

/**
 * Aide du temoin : `monter`.
 * @returns {any} L'arbre rendu.
 */
const monter = () => {
  // eslint-disable-next-line global-require
  const PollDetails = require('../PollDetails').default;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PollDetails
        navigation={{ goBack: jest.fn() }}
        route={{ params: { chatId: 'chat-1', messageId: 'm-sondage' } }}
      />,
    );
  });
  return arbre;
};

const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));

describe('MSG1A — PollDetails (telephone)', () => {
  test('D1 — la question, les options et les NOMS des votants', () => {
    mockMessages = [{ composition: sondage(), documentId: 'm-sondage' }];
    const arbre = monter();
    const lu = textes(arbre);

    expect(lu).toEqual(expect.arrayContaining(['Quel creneau ?', 'Mardi 19h', 'Jeudi 20h']));
    expect(lu).toEqual(expect.arrayContaining(['Karim Benali', 'Lea Morel']));
    expect(lu).toContain('Aucun vote pour cette option.');
  });

  test('D2 — un sondage anonyme ne nomme personne', () => {
    mockMessages = [{ composition: sondage({ isAnonymous: true }), documentId: 'm-sondage' }];
    const arbre = monter();

    expect(textes(arbre).join(' ')).not.toContain('Lea Morel');
  });

  test('D3 — les informations : createur et nombre total de votes', () => {
    mockMessages = [{ composition: sondage(), documentId: 'm-sondage' }];
    const lu = textes(monter());

    expect(lu).toContain('Karim Benali');
    expect(lu).toContain('2');
  });
});
