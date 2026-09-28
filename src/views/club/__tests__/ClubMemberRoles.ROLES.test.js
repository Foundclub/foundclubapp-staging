import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubMemberRoles from '../ClubMemberRoles';

// LOT RÔLES (demande d'Adel du 2026-09-28) — écran 1 : la liste des membres du
// club, et attribuer / retirer un rôle (joueur ou entraîneur d'une équipe,
// co-dirigeant). Écrit ROUGE (l'écran n'existait pas), puis vert.
//
// Points d'observation stables : le TEXTE visible, les cases (rôle + étiquette
// d'accessibilité) et ce qui part vers le serveur (`mutate`). Aucun pixel.

const TEAMS = [
  { documentId: 'team-u15', name: 'U15' },
  { documentId: 'team-seniors', name: 'Seniors' },
];

const MEMBERS = [
  {
    avatarUrl: null,
    documentId: 'coach-doc',
    firstname: 'Camille',
    isManager: false,
    isSelf: false,
    lastname: 'Bernard',
    playerTeamIds: [],
    roleKey: 'coach',
    trainerTeamIds: ['team-u15'],
  },
  {
    avatarUrl: null,
    documentId: 'dir-doc',
    firstname: 'Adel',
    isManager: true,
    isSelf: true,
    lastname: 'Dirigeant',
    playerTeamIds: [],
    roleKey: 'president',
    trainerTeamIds: ['team-seniors'],
  },
  {
    avatarUrl: null,
    documentId: 'p1-doc',
    firstname: 'Élodie',
    isManager: false,
    isSelf: false,
    lastname: 'Joueuse',
    playerTeamIds: ['team-u15'],
    roleKey: 'player',
    trainerTeamIds: [],
  },
  {
    avatarUrl: null,
    documentId: 'p2-doc',
    firstname: 'Paul',
    isManager: false,
    isSelf: false,
    lastname: 'Nouveau',
    playerTeamIds: [],
    roleKey: 'player',
    trainerTeamIds: [],
  },
  {
    avatarUrl: null,
    documentId: 'parent-doc',
    firstname: 'Mona',
    isManager: false,
    isSelf: false,
    lastname: 'Parent',
    playerTeamIds: [],
    roleKey: 'parent',
    trainerTeamIds: [],
  },
];

// Enveloppes construites UNE fois : une doublure qui rend un objet neuf à chaque
// appel fait boucler les effets (piège R03).
const mockRolesQuery = {
  data: { club: { documentId: 'club-1', name: 'AS Test' }, members: MEMBERS, teams: TEAMS },
  error: null,
  isLoading: false,
  refetch: jest.fn(),
};
const mockMutation = { isPending: false, mutate: jest.fn() };

jest.mock('@/services/club/clubMemberRolesQueries', () => ({
  useClubMemberRoles: () => mockRolesQuery,
  useUpdateClubMemberRole: () => mockMutation,
}));

jest.mock('@/utils/errors/displayError', () => ({
  displayErrorAlert: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(valeurs?.[nom] ?? ''));
    },
  }),
}));

// Le VRAI thème, jamais un Proxy : un Proxy rend les échecs Jest illisibles.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };

  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});

jest.mock('@/components/molecules/searchBar/SearchBar', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput } = jest.requireActual('react-native');
  return function SearchBarMock(/** @type {any} */ props) {
    return reactActuel.createElement(TextInput, {
      onChangeText: props.onChangeText,
      placeholder: props.placeholder,
      testID: 'member-search',
      value: props.value,
    });
  };
});

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

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ params = { clubId: 'club-1' }) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ClubMemberRoles navigation={{}} route={{ params }} />);
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === testID && typeof noeud.props?.onPress === 'function'
  ))[0];

const ouvrir = (/** @type {any} */ arbre, /** @type {string} */ documentId) => {
  act(() => {
    parTestId(arbre, `member-row-${documentId}`).props.onPress();
  });
};

const appuyer = (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  act(() => {
    parTestId(arbre, testID).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  while (montes.length) {
    const arbre = montes.pop();
    act(() => arbre.unmount());
  }
  jest.restoreAllMocks();
});

describe('RÔLES — écran 1 : la liste des membres du club', () => {
  it('montre tous les membres, le lecteur EN TÊTE avec « (toi) », et leurs rôles', () => {
    const arbre = monter();
    const lus = textes(arbre);

    const lignes = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.testID === 'string'
      && noeud.props.testID.startsWith('member-row-')
      && typeof noeud.props?.onPress === 'function'
    )).map((/** @type {any} */ noeud) => noeud.props.testID);
    expect([...new Set(lignes)]).toEqual([
      'member-row-dir-doc',
      'member-row-coach-doc',
      'member-row-p1-doc',
      'member-row-p2-doc',
      'member-row-parent-doc',
    ]);

    expect(lus).toContain('Adel Dirigeant (toi)');
    expect(lus).toContain('Dirigeant  ·  Entraîneur · Seniors');
    expect(lus).toContain('Joueur · U15');
    expect(lus).toContain('Aucun rôle d\'équipe');
  });

  it('mettre un membre JOUEUR d\'une équipe part tout de suite, sans confirmation', () => {
    const arbre = monter();
    ouvrir(arbre, 'p2-doc');
    appuyer(arbre, 'member-role-p2-doc-player-team-u15');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockMutation.mutate).toHaveBeenCalledTimes(1);
    expect(mockMutation.mutate.mock.calls[0][0]).toEqual({
      action: 'add', role: 'player', teamDocumentId: 'team-u15', userDocumentId: 'p2-doc',
    });
  });

  it('la case dit ce qu\'elle est : « Joueur de U15 », cochée quand le membre y joue', () => {
    const arbre = monter();
    ouvrir(arbre, 'p1-doc');
    const caseU15 = parTestId(arbre, 'member-role-p1-doc-player-team-u15');
    const caseSeniors = parTestId(arbre, 'member-role-p1-doc-player-team-seniors');

    expect(caseU15.props.accessibilityRole).toBe('checkbox');
    expect(caseU15.props.accessibilityLabel).toBe('Joueur de U15');
    expect(caseU15.props.accessibilityState.checked).toBe(true);
    expect(caseSeniors.props.accessibilityState.checked).toBe(false);
  });

  it('RETIRER un joueur se confirme, et ne part qu\'après « Confirmer »', () => {
    const arbre = monter();
    ouvrir(arbre, 'p1-doc');
    appuyer(arbre, 'member-role-p1-doc-player-team-u15');

    expect(mockMutation.mutate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [titre, message, boutons] = /** @type {any} */ (Alert.alert).mock.calls[0];
    expect(titre).toBe('Retirer le joueur ?');
    expect(message).toBe(
      'Élodie Joueuse ne sera plus joueur de U15. Son compte et son historique restent.',
    );
    expect(boutons).toHaveLength(2);

    act(() => boutons[1].onPress());
    expect(mockMutation.mutate.mock.calls[0][0]).toEqual({
      action: 'remove', role: 'player', teamDocumentId: 'team-u15', userDocumentId: 'p1-doc',
    });
  });

  it('nommer co-dirigeant ou entraîneur (une PROMOTION) se confirme aussi', () => {
    const arbre = monter();
    ouvrir(arbre, 'p2-doc');

    appuyer(arbre, 'member-role-p2-doc-manager');
    expect(Alert.alert.mock.calls[0][0]).toBe('Nommer co-dirigeant ?');
    act(() => Alert.alert.mock.calls[0][2][1].onPress());
    expect(mockMutation.mutate.mock.calls[0][0]).toEqual({
      action: 'add', role: 'manager', userDocumentId: 'p2-doc',
    });

    appuyer(arbre, 'member-role-p2-doc-coach-team-seniors');
    expect(Alert.alert.mock.calls[1][0]).toBe('Nommer entraîneur ?');
  });

  it('un Parent ne se voit proposer que la place de joueur', () => {
    const arbre = monter();
    ouvrir(arbre, 'parent-doc');

    expect(parTestId(arbre, 'member-role-parent-doc-player-team-u15')).toBeDefined();
    expect(parTestId(arbre, 'member-role-parent-doc-coach-team-u15')).toBeUndefined();
    expect(parTestId(arbre, 'member-role-parent-doc-manager')).toBeUndefined();
  });

  it('le dirigeant ne peut pas se retirer lui-même la direction (le serveur le refuserait)', () => {
    const arbre = monter();
    ouvrir(arbre, 'dir-doc');

    expect(parTestId(arbre, 'member-role-dir-doc-manager')).toBeUndefined();
    expect(parTestId(arbre, 'member-role-dir-doc-player-team-u15')).toBeDefined();
  });

  it('la recherche trouve un membre sans tenir compte des accents', () => {
    const arbre = monter();
    act(() => {
      arbre.root.findByProps({ testID: 'member-search' }).props.onChangeText('elodie');
    });

    expect(parTestId(arbre, 'member-row-p1-doc')).toBeDefined();
    expect(parTestId(arbre, 'member-row-p2-doc')).toBeUndefined();
  });

  it('sans club valide : un état clair, aucune liste', () => {
    const arbre = monter({ clubId: ':clubId' });
    expect(textes(arbre)).toContain('Club introuvable');
  });
});

// ÉCRAN 2 — « Imaginons que je suis dirigeant et que d'un coup j'ai envie de me
// mettre joueur dans une équipe : il faut que je puisse le faire » (Adel, 28/09).
// Une carte dédiée, en tête, pour le dirigeant lui-même.
describe('RÔLES — écran 2 : se mettre soi-même joueur d\'une équipe', () => {
  const donneesDOrigine = mockRolesQuery.data;

  afterEach(() => {
    mockRolesQuery.data = donneesDOrigine;
  });

  it('le dirigeant voit « Tu joues aussi ? », une case par équipe, et s\'y met d\'un appui', () => {
    const arbre = monter();

    expect(textes(arbre)).toContain('Tu joues aussi ?');
    const caseU15 = parTestId(arbre, 'self-player-team-u15');
    expect(caseU15.props.accessibilityLabel).toBe('Je joue en U15');
    expect(caseU15.props.accessibilityState.checked).toBe(false);
    expect(parTestId(arbre, 'self-player-team-seniors')).toBeDefined();

    appuyer(arbre, 'self-player-team-u15');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockMutation.mutate.mock.calls[0][0]).toEqual({
      action: 'add', role: 'player', teamDocumentId: 'team-u15', userDocumentId: 'dir-doc',
    });
  });

  it('déjà joueur : la case est cochée, et arrêter de jouer se confirme en le tutoyant', () => {
    mockRolesQuery.data = {
      ...donneesDOrigine,
      members: donneesDOrigine.members.map((membre) => (
        membre.isSelf ? { ...membre, playerTeamIds: ['team-u15'] } : membre
      )),
    };
    const arbre = monter();

    expect(parTestId(arbre, 'self-player-team-u15').props.accessibilityState.checked).toBe(true);
    appuyer(arbre, 'self-player-team-u15');
    const [titre, message] = /** @type {any} */ (Alert.alert).mock.calls[0];
    expect(titre).toBe('Ne plus jouer ?');
    expect(message).toBe('Tu ne seras plus joueur de U15. Ton historique reste.');
  });

  it('un lecteur qui n\'encadre rien ne voit pas la carte', () => {
    mockRolesQuery.data = {
      ...donneesDOrigine,
      members: donneesDOrigine.members.map((membre) => (
        membre.isSelf ? { ...membre, isManager: false, roleKey: 'player' } : membre
      )),
    };
    const arbre = monter();

    expect(textes(arbre)).not.toContain('Tu joues aussi ?');
    expect(parTestId(arbre, 'self-player-team-u15')).toBeUndefined();
  });
});
