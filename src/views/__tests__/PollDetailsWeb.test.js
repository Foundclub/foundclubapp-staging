import renderer, { act } from 'react-test-renderer';

// D49 (E6) : PollDetails.web.js n'avait AUCUN test, et ce n'etait pas un oubli.
//
// `src/utils/imageUrl.js` n'exposait que l'export NOMME `getImageUrl` ; seul son
// jumeau `.web.js` portait un export par defaut. Vite resout bien la variante
// web en production — le site marche —, mais Jest (preset react-native) prend le
// `.js`, et tout rendu d'un ecran `.web.js` important ce module en DEFAUT
// mourait sur « (0, _imageUrl.default) is not a function ». Le message ne nomme
// pas la cause, et c'est pour ca que le mur est reste debout. Mesure D49 : il
// bloquait les 2 ecrans qui importent ce module en DEFAUT — celui-ci et
// `event/EventDetails.web.js`. Les 38 autres `.web.js` n'ont pas cette excuse.
//
// Ce fichier EST la preuve que le mur est tombe : il ne double pas
// `@/utils/imageUrl`, il charge le vrai module. S'il redevient rouge sur cette
// erreur, c'est que l'export par defaut a ete retire de `src/utils/imageUrl.js`.
//
// La couture choisie est le TEXTE VISIBLE, pas la forme de l'arbre : le site
// rend de vrais elements hotes (`button`, `img`, `aside`), et un redessin ne
// doit pas casser ces temoins.

const mockChatQuery = { data: null };
const mockMessagesQuery = { data: null, isLoading: false };
const mockUseAuth = jest.fn();
const mockVotePoll = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueriesData: jest.fn(),
  }),
}));

// Le VRAI catalogue, pas une identite : l'ecran demande deux libelles a la
// traduction — « Membre » et le repli numerote « Option {{index}} ». Un `t` qui
// rendrait la cle ferait passer un test qui devrait tomber.
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const trouve = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let gabarit = cle;
        if (typeof trouve === 'string') gabarit = trouve;
        else if (typeof options === 'string') gabarit = options;
        else if (typeof options?.defaultValue === 'string') gabarit = options.defaultValue;
        if (!options || typeof options === 'string') return gabarit;
        return gabarit.replace(
          /{{(\w+)}}/g,
          (/** @type {any} */ _entier, /** @type {string} */ nom) => String(options[nom] ?? ''),
        );
      },
    }),
  };
});

// Le theme est monte avec les VRAIS modules : un mock en Proxy rend les echecs
// Jest illisibles (piege paye au lot paywall).
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ votePoll: mockVotePoll }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: mockChatQuery.data }),
  useGetChatMessages: () => ({
    data: mockMessagesQuery.data,
    isLoading: mockMessagesQuery.isLoading,
  }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// ⛔ AUCUNE doublure de `@/utils/imageUrl` ici, et c'est deliberé : ce module
// est le sujet du lot. Le doubler rendrait ce fichier vert meme si le mur etait
// toujours debout.

// eslint-disable-next-line import/first
import PollDetailsWeb from '../PollDetails.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CHAT_ID = 'chat-1';
const MESSAGE_ID = 'message-1';

const PARTICIPANTS = [
  {
    avatar: { url: '/uploads/leo.png' },
    documentId: 'user-2',
    firstname: 'Leo',
    lastname: 'Martin',
  },
  { documentId: 'user-3', firstname: 'Sam', lastname: 'Petit' },
];

const buildPoll = (/** @type {any} */ overrides = {}) => ({
  allowMultipleVotes: false,
  createdAt: '2026-03-14T09:30:00.000Z',
  createdBy: 'user-2',
  isAnonymous: false,
  options: [
    { id: 'opt-1', label: 'Samedi 14h', voters: ['user-2', 'user-3'] },
    { id: 'opt-2', label: 'Dimanche 10h', voters: ['user-1'] },
  ],
  pollId: 'poll-1',
  question: 'Quel creneau pour le match ?',
  type: 'poll',
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { participants = PARTICIPANTS, poll } = {}) => {
  const composition = poll === undefined ? buildPoll() : poll;
  mockChatQuery.data = participants ? { participants } : null;
  mockMessagesQuery.data = {
    pages: [{ data: composition ? [{ composition, documentId: MESSAGE_ID }] : [] }],
  };
  mockUseAuth.mockReturnValue({
    userData: { documentId: 'user-1', firstname: 'Adel', lastname: 'F' },
  });

  act(() => {
    mounted = renderer.create(
      <PollDetailsWeb
        navigation={{ goBack: jest.fn() }}
        route={{ params: { chatId: CHAT_ID, messageId: MESSAGE_ID } }}
      />,
    );
  });

  return mounted.root;
};

// Descend par `.children` de l'arbre RENDU, pas par `props.children` : la racine
// est le composant lui-meme, dont les props sont `navigation` et `route`. Un
// parcours par les props y trouve zero enfant et rend la chaine vide — un test
// qui passerait alors ne prouverait rien.
//
// Concatene SANS separateur, comme le navigateur colle des noeuds texte voisins.
// `{count}{' '}vote{'s'}` s'affiche « 2 votes » ; un join(' ') rendrait
// « 2 vote s » et le temoin de pluriel serait faux.
const textOf = (/** @type {any} */ node) => {
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    (child.children || []).forEach(walk);
  };
  walk(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
};

/**
 * Le bouton du site qui PORTE ce libelle. Le rendu web emet de vrais `<button>`,
 * donc on les cherche par type hote, pas par composant.
 * @param {any} root - Racine du rendu.
 * @param {string} label - Le libelle porte par le bouton.
 * @returns {any} - Le bouton, ou undefined.
 */
const buttonWithText = (/** @type {any} */ root, /** @type {string} */ label) => root
  .findAllByType('button')
  .find((/** @type {any} */ node) => textOf(node).includes(label));

const click = async (/** @type {any} */ root, /** @type {string} */ label) => {
  const node = buttonWithText(root, label);
  if (!node) throw new Error(`Aucun bouton ne porte le libelle « ${label} »`);
  await act(async () => {
    await node.props.onClick();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockChatQuery.data = null;
  mockMessagesQuery.data = null;
  mockMessagesQuery.isLoading = false;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('le site rend le detail d un sondage', () => {
  test('sans sondage, le site le dit au lieu de rendre une page vide', () => {
    const root = mountScreen({ poll: null });

    expect(textOf(root)).toContain('Sondage introuvable');
  });

  test('la question et les libelles des options sont affiches', () => {
    const root = mountScreen();

    const rendu = textOf(root);
    expect(rendu).toContain('Quel creneau pour le match ?');
    expect(rendu).toContain('Samedi 14h');
    expect(rendu).toContain('Dimanche 10h');
  });

  test('le compte de voix accorde son pluriel', () => {
    const root = mountScreen();

    const rendu = textOf(root);
    expect(rendu).toContain('2 votes');
    expect(rendu).toContain('1 vote');
    expect(rendu).not.toContain('1 votes');
  });

  test('le panneau lateral totalise les voix et nomme l auteur', () => {
    const root = mountScreen();

    const aside = textOf(root.findByType('aside'));
    expect(aside).toContain('Total votes3');
    expect(aside).toContain('Leo Martin');
  });

  // Ce test est celui qui traverse `getImageUrl` de bout en bout : c'est lui qui
  // tombait sur « _imageUrl.default is not a function ».
  test('un votant avec photo rend une image, un votant sans photo ses initiales', () => {
    const root = mountScreen();

    const images = root.findAllByType('img');
    const photoDeLeo = images.find((/** @type {any} */ node) => node.props.alt === 'Leo Martin');
    expect(photoDeLeo).toBeTruthy();
    expect(photoDeLeo.props.src).toContain('/uploads/leo.png');
    expect(root.findAllByType('span').map(textOf)).toContain('SP');
  });

  test('un sondage anonyme cache la liste des votants', () => {
    const root = mountScreen({ poll: buildPoll({ isAnonymous: true }) });

    const rendu = textOf(root);
    expect(rendu).toContain('Votes anonymes');
    expect(rendu).not.toContain('Sam Petit');
    expect(root.findAllByType('img')).toHaveLength(0);
  });

  test('voter transmet au service le message et l option choisis', async () => {
    const root = mountScreen();

    await click(root, 'Voter');

    expect(mockVotePoll).toHaveBeenCalledWith(MESSAGE_ID, 'opt-1');
  });

  test('l option deja choisie porte « Vote enregistre » au lieu de « Voter »', () => {
    const root = mountScreen();

    expect(buttonWithText(root, 'Vote enregistre')).toBeTruthy();
  });

  test('une option sans libelle retombe sur le repli numerote du catalogue', () => {
    const root = mountScreen({ poll: buildPoll({ options: [{ id: 'opt-1', voters: [] }] }) });

    expect(textOf(root)).toContain('Option 1');
  });
});
