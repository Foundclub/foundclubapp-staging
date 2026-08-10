import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { updateTeam } from '@/services/team/teamService';

import AssignCoachTeams from '../AssignCoachTeams';

// D62 (E6) : `AssignCoachTeams.js` n'avait AUCUN test. C'est l'ecran qui
// rattache un entraineur aux equipes d'un club, et D62 y remplace l'ecusson
// dessine a la main par le composant partage `ClubLogoMark` — celui qui montre
// le VRAI logo du club quand il y en a un, et retombe sur les initiales sinon.
//
// Ce filet fige ce que l'ecran FAIT — qui est liste, ce qui se coche, ce qui
// part vraiment sur le reseau — et, pour le seul point que D62 touche, PAR QUEL
// composant l'ecusson passe. Il doit passer inchange avant et apres.

/** @type {any} */
let mockTeamsQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// FlashList ne rend rien sous `react-test-renderer` : la doublure deroule
// vraiment `data` par `renderItem`, sinon aucune rangee n'existerait a observer.
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      return reactActuel.createElement(
        VueRN,
        null,
        (props.data || []).map((/** @type {any} */ element, /** @type {number} */ index) => (
          reactActuel.createElement(
            VueRN,
            { key: element?.documentId || index },
            props.renderItem({ item: element }),
          )
        )),
        (props.data || []).length === 0 && props.ListEmptyComponent
          ? props.ListEmptyComponent
          : null,
      );
    },
  };
});

// `mutate` appelle vraiment la `mutationFn` : c'est ce qui fait du service
// double le point d'observation reseau de ce filet.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: () => {
      Promise.resolve(options?.mutationFn?.())
        .then((donnees) => options?.onSuccess?.(donnees))
        .catch((erreur) => options?.onError?.(erreur));
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => mockTeamsQuery,
}));

// Service double ENTIEREMENT : il importe le client HTTP, qui refuse de se
// charger sans `API_URL`.
jest.mock('@/services/team/teamService', () => ({
  updateTeam: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title || ''),
    );
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock(
  '@/views/club/components/ClubStateView',
  () => function ClubStateViewMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, props.title);
  },
);

const EQUIPES = [
  {
    activities: [{ name: 'Handball' }],
    club: { documentId: 'club-1', logo: { url: '/uploads/smuc.png' }, name: 'Stade Marseillais' },
    documentId: 't-1',
    name: 'U15 Filles',
    trainers: [],
  },
  {
    activities: [{ name: 'Handball' }],
    club: { documentId: 'club-1', name: 'Stade Marseillais' },
    documentId: 't-2',
    name: 'Seniors A',
    trainers: [{ documentId: 'coach-7' }],
  },
];

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @returns {any} L'arbre monte.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <AssignCoachTeams
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ (mockRoute)}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Trouve le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} Le noeud, ou undefined.
 */
const pressableAvecTexte = (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  return candidats[candidats.length - 1];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTeamsQuery = {
    data: { pages: [{ data: EQUIPES }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockRoute = { params: { clubId: 'club-1', trainerId: 'coach-7', trainerName: 'Nadia Berger' } };
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('AssignCoachTeams — ce que l ecran fait (fige par D62)', () => {
  it('liste chaque equipe du club, avec son sport et le nom du coach a assigner', () => {
    const textes = texteDe(monter().root);

    expect(textes).toContain('U15 Filles');
    expect(textes).toContain('Seniors A');
    expect(textes).toContain('Nadia Berger');
  });

  it('marque « Déjà assigné » l equipe que ce coach entraine deja', () => {
    expect(texteDe(monter().root)).toContain('Déjà assigné');
  });

  it('refuse d ouvrir sans club, et le dit au lieu de lister', () => {
    mockRoute = { params: { trainerId: 'coach-7' } };

    const textes = texteDe(monter().root);

    expect(textes).toContain('Club introuvable');
    expect(textes).not.toContain('U15 Filles');
  });

  it('ne rattache QUE l equipe cochee, et jamais celle deja assignee', async () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'U15 Filles').props.onPress();
    });

    expect(texteDe(arbre.root)).toContain('1 équipe sélectionnée');

    await act(async () => {
      pressableAvecTexte(arbre, 'Assigner').props.onPress();
      await Promise.resolve();
    });

    expect(updateTeam).toHaveBeenCalledTimes(1);
    expect(updateTeam).toHaveBeenCalledWith({
      documentId: 't-1',
      trainers: { connect: [{ documentId: 'coach-7' }] },
    });
  });

  // Le seul point que D62 change : l'ecusson passe par le composant partage,
  // celui qui affiche le VRAI logo du club quand il existe. Avant, l'ecran
  // dessinait `TeamShield` en direct — donc des initiales, toujours.
  it('rend l ecusson de chaque equipe par le composant partage, avec son club', () => {
    const ecussons = monter().root.findAllByType(ClubLogoMark);

    expect(ecussons).toHaveLength(EQUIPES.length);
    expect(ecussons[0].props.club?.logo?.url).toBe('/uploads/smuc.png');
    expect(ecussons[0].props.name).toBe('Stade Marseillais');
  });
});
