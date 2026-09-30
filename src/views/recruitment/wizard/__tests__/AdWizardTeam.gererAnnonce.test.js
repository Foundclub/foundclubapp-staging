// I18N-4 : l'etape lit ses textes par i18next (pluriel) ; ce temoin initialise
// le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';
import renderer, { act } from 'react-test-renderer';

import AdWizardTeam from '../AdWizardTeam';

// GERER-ANNONCE (audit V1, A15/A16 — 2026-09-30).
//
// E6 : `AdWizardTeam.js` n'avait aucun test. Le premier bloc CARACTERISE ce qui
// ne bouge pas ; le second decrit « je ne publie que pour une equipe que je
// GERE » : la liste lisait `myTeams` (equipes ou l'on JOUE), et le serveur
// refusait ensuite la publication (`can-manage-recruitment-ad-create.ts:18-22`,
// `canManageTeam`).

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

// Le brouillon du tunnel : `dispatch` ecrit VRAIMENT l'equipe retenue, sinon
// l'auto-selection d'une equipe unique se relancerait a chaque rendu.
const mockBrouillon = {
  actions: /** @type {any[]} */ ([]),
  state: /** @type {any} */ ({ team: null }),
};
jest.mock('../AdWizardContext', () => ({
  useAdWizard: () => ({
    dispatch: (/** @type {any} */ action) => {
      mockBrouillon.actions.push(action);
      if (action.type === 'SET_TEAM') mockBrouillon.state.team = action.payload;
    },
    state: mockBrouillon.state,
  }),
}));

const mockGetTeamById = jest.fn();
jest.mock('@/services/team/teamService', () => ({
  getTeamById: (/** @type {any} */ id) => mockGetTeamById(id),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  // eslint-disable-next-line global-require
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View>
        <Text>{props.title}</Text>
        <Text>{props.subtitle}</Text>
        {props.children}
      </View>
    ),
  };
});

// La carte d'equipe a son propre filet : ici, un passe-plat pressable suffit.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <TouchableOpacity accessibilityLabel={props.team?.name} onPress={props.onPress}>
        <Text>{props.team?.name || ''}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _t, /** @type {any} */ key) => String(key),
      }),
      Fonts: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const U15 = { club: { documentId: 'club-a', name: 'Club A' }, documentId: 'team-u15', name: 'U15' };
const U17 = { club: { documentId: 'club-a', name: 'Club A' }, documentId: 'team-u17', name: 'U17' };
const SENIORS_AILLEURS = {
  club: { documentId: 'club-b', name: 'Club B' }, documentId: 'team-seniors', name: 'Seniors',
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any[]} */
let montes = [];

/**
 * Monte l'etape « Pour quelle equipe ? » pour un compte donne.
 * @param {any} userData Le compte connecte.
 * @returns {Promise<any>} L'arbre rendu.
 */
const renderFor = async (userData) => {
  mockUseAuth.mockReturnValue({ userData });
  let tree;
  await act(async () => {
    tree = renderer.create(<AdWizardTeam navigation={navigation} route={{ params: undefined }} />);
  });
  montes.push(tree);
  return tree;
};

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node Un noeud du JSON rendu.
 * @returns {string[]} Les textes.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible, en une chaine cherchable.
 * @param {any} tree L'arbre rendu.
 * @returns {string} Le texte.
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  mockBrouillon.actions = [];
  mockBrouillon.state.team = null;
  mockGetTeamById.mockImplementation(
    async (/** @type {string} */ id) => ({ documentId: id, full: true }),
  );
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

describe('AdWizardTeam — caracterisation (ce qui ne bouge pas)', () => {
  it('liste les equipes entrainees et les compte', async () => {
    const tree = await renderFor({
      documentId: 'u-coach', role: { name: 'Entraineur' }, trainedTeams: [U15, U17],
    });
    const rendu = allText(tree);

    expect(rendu).toContain('Pour quelle équipe ?');
    expect(rendu).toContain('U15');
    expect(rendu).toContain('U17');
    expect(rendu).toContain('2 équipes disponibles');
  });

  it('choisir une equipe la recharge entiere, la retient et enchaine', async () => {
    const tree = await renderFor({
      documentId: 'u-coach', role: { name: 'Entraineur' }, trainedTeams: [U15, U17],
    });

    const carte = tree.root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityLabel === 'U17'
        && typeof node.props?.onPress === 'function',
    )[0];
    await act(async () => { await carte.props.onPress(); });

    expect(mockGetTeamById).toHaveBeenCalledWith('team-u17');
    expect(mockBrouillon.actions).toContainEqual({
      payload: { documentId: 'team-u17', full: true },
      type: 'SET_TEAM',
    });
    expect(navigation.navigate).toHaveBeenCalledWith('AdWizardPositions');
  });

  it('une equipe unique est choisie d office', async () => {
    await renderFor({ documentId: 'u-coach', role: { name: 'Entraineur' }, trainedTeams: [U15] });

    expect(mockGetTeamById).toHaveBeenCalledWith('team-u15');
    expect(navigation.navigate).toHaveBeenCalledWith('AdWizardPositions');
  });

  it('sans equipe, elle explique au lieu de montrer une liste vide', async () => {
    const tree = await renderFor({
      documentId: 'u-coach', role: { name: 'Entraineur' }, trainedTeams: [],
    });

    expect(allText(tree))
      .toContain('Tu dois être associé à une équipe pour créer une annonce de recrutement.');
  });
});

describe('AdWizardTeam — GERER-ANNONCE : on ne publie que pour une equipe que l on GERE', () => {
  it('une equipe ou l on ne fait que JOUER n est pas proposee', async () => {
    const tree = await renderFor({
      documentId: 'u-coach',
      myTeams: [SENIORS_AILLEURS],
      role: { name: 'Entraineur' },
      trainedTeams: [U15, U17],
    });
    const rendu = allText(tree);

    expect(rendu).not.toContain('Seniors');
    expect(rendu).toContain('2 équipes disponibles');
  });

  it('un dirigeant qui JOUE dans une equipe de SON club peut publier pour elle', async () => {
    const tree = await renderFor({
      club: { documentId: 'club-a' },
      documentId: 'u-dirigeant',
      myTeams: [U15, SENIORS_AILLEURS],
      role: { name: 'Dirigeant' },
      trainedTeams: [U17],
    });
    const rendu = allText(tree);

    expect(rendu).toContain('U15');
    expect(rendu).toContain('U17');
    expect(rendu).not.toContain('Seniors');
  });
});
