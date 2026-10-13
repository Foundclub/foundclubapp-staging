import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import EventCardNew from '../EventCardNew';

// AMICAUX-CORRECTIFS 68 (13/10) — L EQUIPE QUI SE DEPLACE SE VOYAIT EN ADVERSAIRE.
//
// Constat des captures de la campagne (`fc-social/posts/amicaux/captures/constats/
// planning_valbrune_vs_son_propre_nom.png`) : chez Valbrune, la carte « Mon planning » titrait
// « Valbrune U13 » et l encart disait « vs Valbrune U13 ».
//
// 🔎 Le serveur ne peut ecrire qu UN nom pour les deux equipes : « Match amical vs <invitee> »,
// juste pour l equipe qui RECOIT (`event.team`). La carte, elle, sait qui regarde (`useAuth`) :
// quand je suis dans une equipe INVITEE et pas dans l equipe qui organise, l adversaire est
// l equipe qui organise. Les cartes de « Mon planning » viennent de `useGetEvents` (charge
// compacte) : ni `matchContext` ni `opponentName`, et le club d une invitee n a pas de nom.

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// I18N-2 : les libellés passent par t() avec {{jetons}} et pluriels — la doublure rend le
// français de l app (fr.js, sinon le repli, jetons remplacés).
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: () => false,
  }),
}));

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

/**
 * Toutes les chaines rendues par un `Text`, dans l ordre de l ecran.
 * @param {any} tree Arbre rendu.
 * @returns {string[]} Les chaines, dans l ordre.
 */
const lignesDe = (tree) => tree.root.findAllByType(Text)
  .map((noeud) => {
    const enfants = noeud.props.children;
    return typeof enfants === 'string' ? enfants : '';
  })
  .filter((valeur) => valeur.trim().length > 0);

const MONTRIVAGE_U13 = {
  category: { name: 'U13' },
  club: { documentId: 'club-mo', name: 'Montrivage Olympique' },
  documentId: 'team-mo',
  name: 'U13',
};
// Telle que la charge compacte la donne : le club d une invitee n a pas de nom.
const VALBRUNE_U13 = {
  club: { documentId: 'club-vb' }, documentId: 'team-vb', name: 'Valbrune U13',
};

const matchAmical = (/** @type {any} */ surcharges = {}) => ({
  date: '2099-10-24T12:00:00.000Z',
  documentId: 'evt-amical',
  invitedTeams: [VALBRUNE_U13],
  missings: [],
  name: 'Match amical vs Valbrune U13',
  participations: [],
  startTime: '14:00:00',
  team: MONTRIVAGE_U13,
  type: { name: 'Match amical' },
  ...surcharges,
});

const vuPar = (/** @type {string[]} */ mesEquipes, /** @type {any} */ props = {}) => {
  mockUserData.mockReturnValue({
    documentId: 'moi',
    myTeams: mesEquipes.map((documentId) => ({ documentId })),
    role: { name: USER_ROLES.player },
    trainedTeams: [],
  });
  return lignesDe(renderCard({ displayProfile: 'teamFocused', item: matchAmical(), ...props }));
};

describe('AMIC-68 — la carte du planning de l equipe qui SE DEPLACE', () => {
  test('68 — le titre est l equipe qui RECOIT (club + equipe), pas mon propre nom', () => {
    const lignes = vuPar(['team-vb']);
    expect(lignes).toContain('Montrivage Olympique U13');
    expect(lignes).not.toContain('Valbrune U13 • Montrivage Olympique');
  });

  test('68 — l encart dit « vs <qui recoit> », plus « vs Valbrune U13 »', () => {
    const lignes = vuPar(['team-vb']);
    expect(lignes).toContain('vs Montrivage Olympique U13');
    expect(lignes).not.toContain('vs Valbrune U13');
  });

  test('68 — le sous-titre est MON equipe', () => {
    const lignes = vuPar(['team-vb']);
    const rangTitre = lignes.indexOf('Montrivage Olympique U13');
    expect(lignes[rangTitre + 1]).toBe('Valbrune U13');
  });

  test('68 — la carte PAR DEFAUT dit aussi « VS <qui recoit> »', () => {
    const lignes = vuPar(['team-vb'], { displayProfile: undefined });
    expect(lignes).toContain('VS Montrivage Olympique U13');
  });

  // -- PROTEGE : ce qui ne doit pas bouger ------------------------------------------------------
  test('PROTEGE — l equipe qui RECOIT garde « Valbrune U13 » en titre et sa ligne a elle', () => {
    const lignes = vuPar(['team-mo']);
    expect(lignes).toContain('Valbrune U13');
    expect(lignes).toContain('U13 • Montrivage Olympique');
    expect(lignes).toContain('vs Valbrune U13');
  });

  test('PROTEGE — membre des DEUX equipes : on ne choisit pas, rien ne change', () => {
    expect(vuPar(['team-mo', 'team-vb'])).toContain('U13 • Montrivage Olympique');
  });

  test('PROTEGE — aucune de ses equipes (parent, ancien parc) : rien ne change', () => {
    expect(vuPar([])).toContain('U13 • Montrivage Olympique');
  });

  test('PROTEGE — un club dans le nom de l equipe qui recoit ne se double pas', () => {
    const lignes = vuPar(['team-vb'], {
      item: matchAmical({ team: { ...MONTRIVAGE_U13, name: 'Montrivage Olympique U13' } }),
    });
    expect(lignes).toContain('Montrivage Olympique U13');
    expect(lignes).not.toContain('Montrivage Olympique Montrivage Olympique U13');
  });
});
