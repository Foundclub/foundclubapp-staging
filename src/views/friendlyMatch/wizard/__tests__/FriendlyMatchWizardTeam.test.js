import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardTeam from '../FriendlyMatchWizardTeam';

// Filet D24 (E6) — l'etape 1/7 n'avait aucun test. Elle porte deux choses : le
// choix de l'equipe, et — depuis D24 — le RELEVE DE L'ORIGINE du tunnel.
//
// 🧨 Ce dernier est le maillon invisible du defaut ⑤ : c'est le seul endroit
// ou l'information « c'est le tunnel Evenement qui m'a ouvert » entre dans le
// brouillon. Le recapitulatif, lui, est 6 ecrans plus loin. Retirer l'effet
// ci-dessous rouvrirait le defaut sans qu'aucune autre porte de `app` le voie.

/** @type {any[]} */
const mockPropsDuGabarit = [];
/** @type {any[]} */
const mockActions = [];
/** @type {any} */
let mockUtilisateur = null;

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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

// La carte d'equipe a son propre filet : ici, un passe-plat pressable suffit.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteMock(
  /** @type {any} */ props,
) {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return creer(
    TouchableOpacity,
    { onPress: props.onPress },
    creer(Text, null, props.team?.name || ''),
  );
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  // eslint-disable-next-line no-use-before-define
  default: () => ({ userData: mockUtilisateur }),
}));

jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockActions.push(action),
    state: { team: null },
  }),
}));

/**
 * Monte l'etape 1 avec les parametres de route donnes.
 * @param {any} [params] Les parametres de route.
 * @returns {any} L'arbre et sa navigation espionnee.
 */
const rendre = (params = undefined) => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      FriendlyMatchWizardTeam,
      { navigation, route: { params } },
    ));
  });
  return { arbre, navigation };
};

/** Les actions de type SET_ENTRY_ORIGIN envoyees au brouillon. */
const originesPosees = () => mockActions
  .filter((action) => action.type === 'SET_ENTRY_ORIGIN')
  .map((action) => action.payload);

beforeEach(() => {
  mockPropsDuGabarit.length = 0;
  mockActions.length = 0;
  mockUtilisateur = { myTeams: [{ documentId: 'team-1', name: 'U15' }] };
});

describe('Etape 1/7 « Publier une annonce »', () => {
  it('est la 1re etape sur 7 et liste les equipes encadrees', () => {
    const { arbre } = rendre();
    const gabarit = mockPropsDuGabarit[mockPropsDuGabarit.length - 1];

    expect(gabarit.stepIndex).toBe(1);
    expect(gabarit.stepCount).toBe(7);
    expect(JSON.stringify(arbre.toJSON())).toContain('U15');
  });

  it('choisir une equipe la retient et enchaine sur l etape 2', () => {
    const { arbre, navigation } = rendre();
    const carte = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    )[0];

    act(() => carte.props.onPress());

    expect(mockActions).toContainEqual({
      payload: { documentId: 'team-1', name: 'U15' },
      type: 'SET_TEAM',
    });
    expect(navigation.navigate).toHaveBeenCalledWith('FriendlyMatchWizardHosting');
  });

  it('sans equipe encadree, elle explique au lieu de montrer une liste vide', () => {
    mockUtilisateur = { myTeams: [], trainedTeams: [] };
    const { arbre } = rendre();

    expect(JSON.stringify(arbre.toJSON())).toContain('Il faut encadrer une équipe');
  });
});

describe('Etape 1/7 — ⑤ le releve de l origine du tunnel', () => {
  it('retient le tunnel qui a ouvert la porte', () => {
    rendre({ entryOrigin: 'EventStack' });

    expect(originesPosees()).toEqual(['EventStack']);
  });

  // Toujours ecrite, meme absente : sur le web le brouillon survit dans
  // `sessionStorage`, et une origine gardee d'une ouverture PRECEDENTE ferait
  // effacer un tunnel qui n'a jamais ete ouvert cette fois-ci.
  it('efface l origine quand on entre directement, au lieu de la laisser trainer', () => {
    rendre();

    expect(originesPosees()).toEqual([undefined]);
  });
});
