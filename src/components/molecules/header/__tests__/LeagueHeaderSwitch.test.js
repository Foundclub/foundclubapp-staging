import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

// 📌 PREMIER FILET de `LeagueHeaderSwitch.js` — le logo en haut à gauche de
// l'accueil, de la recherche et de 9 autres écrans (AUCUN témoin jusqu'ici :
// les 4 suites qui le croisent le DOUBLENT). Posé par le lot ACCUEIL (audit V1,
// A01), en application de E6.

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
  mockMode.isGold = false;
});

/**
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => {
  if (typeof noeud === 'string') return noeud;
  return (noeud?.children || []).map(texteDe).join('');
};

/**
 * @param {Record<string, any>} [props]
 * @returns {renderer.ReactTestRenderer}
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<LeagueHeaderSwitch {...props} />); });
  arbres.push(arbre);
  return arbre;
};

/**
 * Le seul bouton du composant (nœud hôte qui porte l'appui).
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {any}
 */
const bouton = (arbre) => arbre.root.find((n) => typeof n.type === 'string' && typeof n.props.onClick === 'function');

/**
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {void}
 */
const appuyer = (arbre) => act(() => { bouton(arbre).props.onClick(); });

describe('E6 — le logo AUJOURD HUI : un interrupteur FoundClub / League', () => {
  it('il affiche le logo ET le mot « LEAGUE »', () => {
    const arbre = monter();

    expect(texteDe(arbre.toJSON())).toContain('LEAGUE');
    expect(arbre.root.findAll((n) => n.props.source?.testUri === 'logo').length).toBeGreaterThan(0);
  });

  it('en mode FoundClub, un appui bascule et ouvre la League', () => {
    mockNavigation.getState.mockReturnValue({ routeNames: [RouteNames.Search] });
    const parent = { getState: () => ({ routeNames: [RouteNames.HomeTab, RouteNames.LeagueHomeTab] }), navigate: jest.fn() };
    mockNavigation.getParent.mockReturnValue(parent);
    const arbre = monter();

    appuyer(arbre);

    expect(mockMode.toggleMode).toHaveBeenCalledTimes(1);
    expect(parent.navigate).toHaveBeenCalledWith(RouteNames.LeagueHomeTab);
  });

  it('en mode League, un appui bascule et revient à l accueil', () => {
    mockMode.isGold = true;
    mockNavigation.getState.mockReturnValue({ routeNames: [RouteNames.HomeTab, RouteNames.LeagueHomeTab] });
    const arbre = monter();

    appuyer(arbre);

    expect(mockMode.toggleMode).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(RouteNames.HomeTab);
  });
});
