/* eslint-disable max-len -- témoin : les doublures et les assertions se lisent mieux sur une ligne */
import { Platform, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AssignCoachTeams from '../AssignCoachTeams';

// DEFILEMENT-LOT2 (11/11/2026, décision d'Adel « 244- A », relevé D03b ligne 1). Sur iPhone,
// la carte de titre restait figée en haut (~134 px) et, en bas, le compteur, « Assigner » et
// « Créer une équipe » plus la marge du cadre (~210 px) : 43 % de l'écran ne défilait pas.
// Règle C : le haut défile avec la liste. Règle B : seul « Assigner aux équipes sélectionnées »
// (l'action que l'écran sert à faire) reste visible, dans un pied flottant ; le compteur et
// « Créer une équipe » viennent au bout de la liste. Règle A : le cadre ne garde rien en bas.
// Sur le site (REPRISE-PLACE, 01/11), le pied vient au bout du défilement.

/** @type {any[]} */
const mockCadres = [];

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

// La doublure rend l'en-tête, les rangées, le vide et le pied de liste DANS une même vue :
// « dans le défilement » veut dire « descendant de cette vue ».
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      const donnees = props.data || [];
      return reactActuel.createElement(
        VueRN,
        { contentContainerStyle: props.contentContainerStyle, testID: 'defilement' },
        props.ListHeaderComponent || null,
        donnees.map((/** @type {any} */ e, /** @type {number} */ i) => reactActuel.createElement(
          VueRN,
          { key: e?.documentId || i },
          props.renderItem({ item: e }),
        )),
        donnees.length === 0 && props.ListEmptyComponent ? props.ListEmptyComponent : null,
        props.ListFooterComponent || null,
      );
    },
  };
});
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
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
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({
    data: { pages: [{ data: [{ documentId: 't-1', name: 'U15 Filles', trainers: [] }] }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/services/auth/authQueries', () => ({ useGetUserById: () => ({ data: undefined }) }));
jest.mock('@/services/team/teamService', () => ({ updateTeam: jest.fn() }));
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title || ''));
  };
});
jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() { return null; });
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() { return null; });
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock(/** @type {any} */ props) { return props.children; },
);
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(/** @type {any} */ props) {
  mockCadres.push(props);
  return props.children;
});
// iPhone : barre du téléphone 34 + marge 12.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({ __esModule: true, default: () => 46 }));
jest.mock('@/views/club/components/ClubStateView', () => function ClubStateViewMock() { return null; });

const TITRE = 'Assigner un entraîneur';
const ASSIGNER = 'Assigner aux équipes sélectionnées';
const CREER = 'Créer une équipe';
const COMPTEUR = 'Aucune équipe sélectionnée';

const texteDe = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(texteDe).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  return String(enfants);
};
const parTexte = (/** @type {any} */ racine, /** @type {string} */ texte) => racine
  .findAll((/** @type {any} */ n) => n.type === Text && texteDe(n.props.children) === texte)[0];
// Un composant et sa vue portent le même testID : on garde le plus profond (la vue).
const parId = (/** @type {any} */ racine, /** @type {string} */ id) => racine
  .findAll((/** @type {any} */ n) => n.props?.testID === id).at(-1);
const sous = (/** @type {any} */ noeud, /** @type {any} */ parent) => {
  if (!noeud || !parent) throw new Error('élément introuvable à l écran');
  let n = noeud?.parent;
  while (n) {
    if (n === parent) return true;
    n = n.parent;
  }
  return false;
};

const monter = () => {
  mockCadres.length = 0;
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <AssignCoachTeams
        navigation={/** @type {any} */ ({ navigate: jest.fn(), setOptions: jest.fn() })}
        route={/** @type {any} */ ({ params: { clubId: 'club-1', trainerId: 'coach-7', trainerName: 'Lina' } })}
      />,
    );
  });
  const racine = arbre.root;
  return {
    arbre,
    defilement: parId(racine, 'defilement'),
    racine,
  };
};

describe('DEFILEMENT-LOT2 — AssignCoachTeams : tout défile, sauf « Assigner »', () => {
  const osAvant = Platform.OS;
  afterEach(() => { Platform.OS = osAvant; });

  test('C : la carte de titre défile avec la liste', () => {
    const { defilement, racine } = monter();
    expect(sous(parTexte(racine, TITRE), defilement)).toBe(true);
    expect(sous(parTexte(racine, 'Lina'), defilement)).toBe(true);
  });

  test('B : « Assigner » flotte dans le pied, hors du défilement, au bord bas de l écran', () => {
    const { defilement, racine } = monter();
    const pied = parId(racine, 'assign-coach-teams-pied');
    expect(sous(parTexte(racine, ASSIGNER), pied)).toBe(true);
    expect(sous(pied, defilement)).toBe(false);
    const style = StyleSheet.flatten(pied.props.style);
    expect(style).toEqual(expect.objectContaining({ bottom: 0, position: 'absolute' }));
    expect(style.paddingBottom).toBeGreaterThanOrEqual(46);
  });

  test('rien ne disparaît : le compteur et « Créer une équipe » viennent au bout de la liste', () => {
    const { defilement, racine } = monter();
    expect(sous(parTexte(racine, COMPTEUR), defilement)).toBe(true);
    expect(sous(parTexte(racine, CREER), defilement)).toBe(true);
  });

  test('A : le cadre ne garde rien en bas ; la fin de la liste laisse la place du pied', () => {
    const { arbre, racine } = monter();
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    const pied = parId(racine, 'assign-coach-teams-pied');
    act(() => {
      pied.props.onLayout({ nativeEvent: { layout: { height: 106 } } });
    });
    const fin = StyleSheet.flatten(parId(arbre.root, 'defilement').props.contentContainerStyle);
    expect(fin.paddingBottom).toBeGreaterThanOrEqual(106 + 12);
  });

  test('site : le pied vient au bout du défilement (REPRISE-PLACE)', () => {
    Platform.OS = 'web';
    const { defilement, racine } = monter();
    const pied = parId(racine, 'assign-coach-teams-pied');
    expect(sous(pied, defilement)).toBe(true);
    expect(sous(parTexte(racine, ASSIGNER), defilement)).toBe(true);
  });
});
