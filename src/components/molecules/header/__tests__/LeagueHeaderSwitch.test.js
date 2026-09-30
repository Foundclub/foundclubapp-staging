import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

// 📌 PREMIER FILET de `LeagueHeaderSwitch.js` — le logo en haut à gauche de
// l'accueil, de la recherche et de 9 autres écrans (AUCUN témoin jusqu'ici :
// les 4 suites qui le croisent le DOUBLENT). Posé par le lot ACCUEIL (audit V1,
// A01), en application de E6.
//
// 🔀 Deux blocs : le comportement d'AVANT (interrupteur `LEAGUE_SUR_ACCUEIL`
// rallumé — il doit continuer de marcher le jour où on le rallume) et celui que
// demande A01 (interrupteur éteint : un simple logo qui ramène à l'accueil).

const mockInterrupteurs = { LEAGUE_SUR_ACCUEIL: true };
jest.mock('@/config/fonctionsMasquees', () => mockInterrupteurs);

const mockMode = { isGold: false, setMode: jest.fn(), toggleMode: jest.fn() };
const mockNavigation = {
  getParent: jest.fn(),
  getState: jest.fn(),
  navigate: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => mockMode }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

// Le VRAI thème ; seul le logo est un marqueur (pas de résolution de fichier).
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  const theme = {
    Colors,
    Fonts: jest.requireActual('@/theme/fonts').default(Colors),
    Images: { logo: { testUri: 'logo' } },
  };
  return { __esModule: true, default: () => theme };
});

const LeagueHeaderSwitch = require('../LeagueHeaderSwitch').default;

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockMode.isGold = false;
});

/**
 * Le texte d'un nœud rendu, descendu par `.children`.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => {
  if (typeof noeud === 'string') return noeud;
  return (noeud?.children || []).map(texteDe).join('');
};

/**
 * Monte le logo avec ces props.
 * @param {{ onPress?: () => void }} [props]
 * @returns {renderer.ReactTestRenderer}
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<LeagueHeaderSwitch onPress={props.onPress} />); });
  arbres.push(arbre);
  return arbre;
};

/**
 * Le seul bouton du composant (nœud hôte qui porte l'appui).
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {any}
 */
const bouton = (arbre) => arbre.root.find((n) => (
  typeof n.type === 'string' && typeof n.props.onClick === 'function'
));

/**
 * Appuie sur le logo.
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {void}
 */
const appuyer = (arbre) => act(() => { bouton(arbre).props.onClick(); });

describe('E6 — le logo AUJOURD HUI : un interrupteur FoundClub / League', () => {
  beforeEach(() => { mockInterrupteurs.LEAGUE_SUR_ACCUEIL = true; });

  it('il affiche le logo ET le mot « LEAGUE »', () => {
    const arbre = monter();

    expect(texteDe(arbre.toJSON())).toContain('LEAGUE');
    expect(arbre.root.findAll((n) => n.props.source?.testUri === 'logo').length).toBeGreaterThan(0);
  });

  it('en mode FoundClub, un appui bascule et ouvre la League', () => {
    mockNavigation.getState.mockReturnValue({ routeNames: [RouteNames.Search] });
    const parent = {
      getState: () => ({ routeNames: [RouteNames.HomeTab, RouteNames.LeagueHomeTab] }),
      navigate: jest.fn(),
    };
    mockNavigation.getParent.mockReturnValue(parent);
    const arbre = monter();

    appuyer(arbre);

    expect(mockMode.toggleMode).toHaveBeenCalledTimes(1);
    expect(parent.navigate).toHaveBeenCalledWith(RouteNames.LeagueHomeTab);
  });

  it('en mode League, un appui bascule et revient à l accueil', () => {
    mockMode.isGold = true;
    mockNavigation.getState.mockReturnValue({
      routeNames: [RouteNames.HomeTab, RouteNames.LeagueHomeTab],
    });
    const arbre = monter();

    appuyer(arbre);

    expect(mockMode.toggleMode).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab);
  });
});

// A01 + A02 (décision d'Adel du 30/09, option A) : « le logo ramène à l'accueil —
// le même logo, la même police ». La League n'a plus de porte sur l'accueil.
describe('A01 — League masquée : le logo est un simple logo qui ramène à l accueil', () => {
  beforeEach(() => { mockInterrupteurs.LEAGUE_SUR_ACCUEIL = false; });

  /** La navigation qui ramène à la RACINE de l'onglet Accueil, sans empiler. */
  const VERS_LA_RACINE_DE_L_ACCUEIL = [
    RouteNames.HomeTab,
    { params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
    { pop: true },
  ];

  it('LE TEMOIN : le logo seul, sans « LEAGUE » ni pastilles de mode', () => {
    const arbre = monter();

    expect(texteDe(arbre.toJSON())).not.toContain('LEAGUE');
    const logos = arbre.root.findAll((n) => (
      typeof n.type === 'string' && n.props.source?.testUri === 'logo'
    ));
    expect(logos).toHaveLength(1);
  });

  it('c est un bouton nommé « Accueil » pour les lecteurs d écran', () => {
    const arbre = monter();

    expect(bouton(arbre).props.accessibilityRole).toBe('button');
    expect(bouton(arbre).props.accessibilityLabel).toBe('Accueil');
  });

  it('sur l accueil, un appui remonte en haut de la page (geste fourni par l écran)', () => {
    const remonter = jest.fn();
    const arbre = monter({ onPress: remonter });

    appuyer(arbre);

    expect(remonter).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(mockMode.toggleMode).not.toHaveBeenCalled();
  });

  it('ailleurs, un appui ramène à la racine de l accueil SANS empiler une 2e copie', () => {
    const arbre = monter();

    appuyer(arbre);

    expect(mockNavigation.navigate.mock.calls).toEqual([VERS_LA_RACINE_DE_L_ACCUEIL]);
    expect(mockMode.toggleMode).not.toHaveBeenCalled();
    expect(mockMode.setMode).not.toHaveBeenCalled();
  });

  it('depuis un écran de la League (mode mémorisé), un appui en sort pour de bon', () => {
    mockMode.isGold = true;
    const arbre = monter();

    appuyer(arbre);

    expect(mockMode.setMode).toHaveBeenCalledWith('classic');
    expect(mockMode.toggleMode).not.toHaveBeenCalled();
    expect(mockNavigation.navigate.mock.calls).toEqual([VERS_LA_RACINE_DE_L_ACCUEIL]);
  });

  it('sur le site, un appui ouvre l accueil « / » (pas de pile à dépiler)', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const arbre = monter();

    appuyer(arbre);

    expect(mockNavigation.navigate.mock.calls).toEqual([[RouteNames.HomeTab]]);
  });
});
