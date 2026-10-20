import { readFileSync } from 'fs';
import { join } from 'path';

import { Platform, useWindowDimensions } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BasculeComplexe from '@/views/complexe/components/BasculeComplexe';
import EntreeComplexe from '@/views/complexe/components/EntreeComplexe';
import TonMode from '@/views/complexe/components/TonMode';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  parRepere,
  pressable,
  textes,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — planche RB et E-G01 état 1 (AT-01 « bascule ok ») : UN compte, une
// bascule « mode complexe / mode joueur » en tête de l'accueil, et l'entrée « Je gère un complexe »
// dans « Mon compte ». Le tout CACHÉ par `COMPLEXES_GERANT` (éteint). RESA-BASCULE (20/10/2026,
// planche RB-3 validée par Adel, « parent-gérant A ») : un compte qui gère un complexe et a deux
// modes ou plus lit « Ton mode » à la place des états 2 et 3 de RB (ces deux témoins sont réécrits
// sur la planche validée) ; un compte à un seul mode garde RB.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: mockNavigate }),
}));
/* eslint-disable global-require */
jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
jest.mock('react-native-gesture-handler', () => (
  require('@/testSupport/animationDouble').gestureHandler()
));
/* eslint-enable global-require */
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fontScale: 1, height: 844, scale: 3, width: 390,
  })),
}));
// La feuille « Tu pratiques aussi un sport ? » (son témoin est le sien) : son contrat seulement.
let mockFeuille = /** @type {any} */ (null);
jest.mock('@/views/home/FeuillePratiqueAussi', () => function FausseFeuille(/** @type {any} */ p) {
  mockFeuille = p;
  return null;
});

let mockMes = /** @type {any} */ ({ data: [], isLoading: false });
jest.mock('@/services/complexe/complexeQueries', () => ({
  useMesComplexes: () => mockMes,
}));

const mockValeurs = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockValeurs.delete(cle),
    getString: (/** @type {string} */ cle) => mockValeurs.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockValeurs.set(cle, valeur),
  },
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte un élément.
 * @param {import('react').ReactElement} element - L'élément.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

const plateformeDOrigine = Platform.OS;
beforeEach(() => {
  mockNavigate.mockClear();
  mockValeurs.clear();
  mockMes = { data: [], isLoading: false };
  mockFeuille = null;
  /** @type {any} */ (useWindowDimensions).mockReturnValue({
    fontScale: 1, height: 844, scale: 3, width: 390,
  });
});
afterEach(() => {
  Platform.OS = plateformeDOrigine;
});

/**
 * Attend le tour suivant (la bascule vers le complexe part après avoir peint la position cyan).
 * @returns {Promise<void>} Fini.
 */
const tourSuivant = async () => {
  await act(async () => {
    await new Promise((fin) => { setTimeout(fin, 0); });
  });
};

describe('RESA-L5A1 RB — la bascule en tête de l’accueil', () => {
  it('sans complexe : le bandeau du mode joueur, inchangé', async () => {
    const onChange = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        displayMode={null}
        onChange={onChange}
      />,
    );
    expect(parRepere(arbre, 'player-mode-offer')).not.toBeNull();
    expect(textes(arbre)).toEqual(['Tu joues aussi dans une équipe.', 'Voir l\'app en joueur']);
  });

  it('RB-3 1b · un joueur qui gère un complexe : « Ton mode », Complexe · Joueur', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="player"
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
      />,
    );
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Joueur', 'Tu vois l’app comme un joueur.',
    ]);
    await appuyer(arbre, 'Complexe, 1 sur 2');
    await tourSuivant();
    expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeEspace, { complexeId: 'cx-five' });
  });

  it('RB-3 4b · un coach qui joue : Complexe · Coach · Joueur ; Joueur sur place', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const onChange = jest.fn();
    const onMonter = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        displayMode={null}
        onChange={onChange}
        onMonter={onMonter}
      />,
    );
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Coach', 'Joueur', 'Tu vois l’app comme un coach.',
    ]);
    await appuyer(arbre, 'Joueur, 3 sur 3');
    expect(onChange).toHaveBeenCalledWith('player');
    expect(onMonter).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('RB-3 4b · en mode joueur, « Coach » remplace « Revenir en mode entraîneur »', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const onChange = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        displayMode="player"
        onChange={onChange}
      />,
    );
    expect(parRepere(arbre, 'player-mode-active')).toBeNull();
    expect(textes(arbre)).not.toContain('Revenir en mode entraîneur');
    await appuyer(arbre, 'Coach, 2 sur 3');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('RB-3 · mode parent : « Dirigeant » remplace « Revenir en mode dirigeant »', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const onChange = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="president"
        canUseParentMode
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode="parent"
        onChange={onChange}
        prenoms={['Anissa']}
      />,
    );
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Dirigeant', 'Parent', 'Tu vois l’app comme un parent.',
    ]);
    await appuyer(arbre, 'Dirigeant, 2 sur 3');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('RB-3 · un dirigeant sans équipe ni enfant : Complexe · Dirigeant', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="president"
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
      />,
    );
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Dirigeant', 'Tu vois l’app comme un dirigeant.',
    ]);
  });

  it('RB-3 2a-2c · un compte Parent : l offre, SA feuille, puis le message', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const onPasseEnJoueur = jest.fn();
    const onPratiqueAussi = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="parent"
        canUseParentMode={false}
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
        onPasseEnJoueur={onPasseEnJoueur}
        onPratiqueAussi={onPratiqueAussi}
        prenoms={['Léa']}
      />,
    );
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Parent', 'Tu vois l’app comme un parent.',
      'Tu pratiques aussi un sport ?', 'Basculer en mode joueur',
    ]);
    expect(mockFeuille.isVisible).toBe(false);
    expect(mockFeuille.gereUnComplexe).toBe(true);
    expect(mockFeuille.prenoms).toEqual(['Léa']);
    await appuyer(arbre, 'Basculer en mode joueur');
    expect(mockFeuille.isVisible).toBe(true);
    // La feuille de l'accueil (celle des parents sans complexe) n'est pas ouverte.
    expect(onPratiqueAussi).not.toHaveBeenCalled();
    await act(async () => {
      mockFeuille.onDone();
    });
    expect(mockFeuille.isVisible).toBe(false);
    expect(onPasseEnJoueur).toHaveBeenCalledTimes(1);
  });

  it('un seul mode (compte né « pour un complexe ») : les états de RB, inchangés', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="new"
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
      />,
    );
    expect(textes(arbre)).toEqual([
      'Mode joueur',
      'Tu vois l\'app comme un joueur. Ton complexe et tes droits de gestionnaire sont intacts.',
      'Revenir en mode complexe',
    ]);
    await appuyer(arbre, 'Revenir en mode complexe');
    expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeEspace, { complexeId: 'cx-five' });
  });

  it('site, 1 360 px : un dirigeant l a dans le menu du club, pas à l accueil', async () => {
    Platform.OS = 'web';
    /** @type {any} */ (useWindowDimensions).mockReturnValue({
      fontScale: 1, height: 900, scale: 1, width: 1360,
    });
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="president"
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
      />,
    );
    expect(arbre.toJSON()).toBeNull();
  });

  it('site, 1 360 px : un joueur la garde en tête de l accueil, sur une ligne (O2)', async () => {
    Platform.OS = 'web';
    /** @type {any} */ (useWindowDimensions).mockReturnValue({
      fontScale: 1, height: 900, scale: 1, width: 1360,
    });
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="player"
        canUseParentMode
        canUsePlayerMode={false}
        compteId="u-1"
        displayMode={null}
        onChange={jest.fn()}
        prenoms={['Léa']}
      />,
    );
    expect(arbre.root.findByType(TonMode).props.disposition).toBe('ligne');
    expect(textes(arbre).slice(0, 2)).toEqual([
      'TON MODE', 'Tu vois l’app comme un joueur. Léa t’attend dans le mode parent.',
    ]);
  });
});

describe('RESA-L5A1 RB — « Je gère un complexe » dans « Mon compte » (E-G01, état 1)', () => {
  it('sans complexe : l’entrée ouvre le tunnel', async () => {
    const arbre = await monter(<EntreeComplexe compteId="u-1" />);
    expect(textes(arbre)).toEqual([
      'Je gère un complexe',
      'Foot à 5, padel, tennis… Sur ce même compte.',
    ]);
    await appuyer(arbre, 'Je gère un complexe');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeDevenirGerant);
  });

  it('avec son complexe : « Mon complexe » passe en mode complexe', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(<EntreeComplexe compteId="u-1" />);
    expect(textes(arbre)).toEqual(['Mon complexe', 'Le Five de Montrivage']);
    await appuyer(arbre, 'Mon complexe');
    expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeEspace, { complexeId: 'cx-five' });
  });

  it('pendant la lecture : rien (pas de « Je gère » pour qui en gère déjà un)', async () => {
    mockMes = { data: undefined, isLoading: true };
    expect((await monter(<EntreeComplexe compteId="u-1" />)).toJSON()).toBeNull();
  });
});

describe('RESA-L5A1 RB — l’interrupteur COMPLEXES_GERANT cache tout', () => {
  const lire = (/** @type {string[]} */ ...morceaux) => readFileSync(
    join(__dirname, '..', '..', '..', '..', ...morceaux),
    'utf8',
  );

  it('il est ÉTEINT', () => {
    const { COMPLEXES_GERANT } = jest.requireActual('@/config/fonctionsMasquees');
    expect(COMPLEXES_GERANT).toBe(false);
  });

  it('« Mon compte » ne montre l’entrée que s’il est allumé', () => {
    expect(lire('views', 'profile', 'Profile.js'))
      .toContain('{COMPLEXES_GERANT ? <EntreeComplexe');
  });

  it('l’accueil : la bascule si allumé, sinon le bandeau du mode joueur', () => {
    const source = lire('views', 'home', 'HomeHub.js');
    const interrupteur = source.indexOf('{COMPLEXES_GERANT ? (');
    const bascule = source.indexOf('<BasculeComplexe');
    const bandeau = source.indexOf('<PlayerModeBanner');
    expect(interrupteur).toBeGreaterThan(-1);
    expect(bascule).toBeGreaterThan(interrupteur);
    expect(bandeau).toBeGreaterThan(bascule);
  });
});
