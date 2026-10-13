import { readFileSync } from 'fs';
import { join } from 'path';

import renderer, { act } from 'react-test-renderer';

import BasculeComplexe from '@/views/complexe/components/BasculeComplexe';
import EntreeComplexe from '@/views/complexe/components/EntreeComplexe';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  parRepere,
  pressable,
  textes,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — planche RB et E-G01 état 1 (AT-01 « bascule ok ») : UN compte, une
// bascule « mode complexe / mode joueur » en tête de l'accueil, et l'entrée « Je gère un
// complexe » dans « Mon compte ». Le tout CACHÉ par `COMPLEXES_GERANT` (éteint).

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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

beforeEach(() => {
  mockNavigate.mockClear();
  mockValeurs.clear();
  mockMes = { data: [], isLoading: false };
});

describe('RESA-L5A1 RB — la bascule en tête de l’accueil', () => {
  it('sans complexe : le bandeau du mode joueur, inchangé', async () => {
    const onChange = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        isPlayerMode={false}
        onChange={onChange}
      />,
    );
    expect(parRepere(arbre, 'player-mode-offer')).not.toBeNull();
    expect(textes(arbre)).toEqual(['Tu joues aussi dans une équipe.', 'Voir l\'app en joueur']);
  });

  it('un joueur qui gère un complexe : « Mode joueur » et le retour (état 2)', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="player"
        canUsePlayerMode={false}
        compteId="u-1"
        isPlayerMode={false}
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

  it('un entraîneur qui joue et gère un complexe : les deux autres modes (état 3)', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const onChange = jest.fn();
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        isPlayerMode={false}
        onChange={onChange}
      />,
    );
    expect(textes(arbre)).toEqual([
      'Tu joues aussi, et tu gères Le Five de Montrivage.',
      'Mode joueur',
      'Mode complexe',
    ]);
    await appuyer(arbre, 'Mode joueur');
    expect(onChange).toHaveBeenCalledWith(true);
    await appuyer(arbre, 'Mode complexe');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeEspace, { complexeId: 'cx-five' });
  });

  it('en mode joueur, l’entraîneur garde son retour « Revenir en mode entraîneur »', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="coach"
        canUsePlayerMode
        compteId="u-1"
        isPlayerMode
        onChange={jest.fn()}
      />,
    );
    expect(parRepere(arbre, 'player-mode-active')).not.toBeNull();
    expect(textes(arbre)).toContain('Revenir en mode entraîneur');
  });

  it('un dirigeant sans équipe : « Tu gères … » et « Mode complexe »', async () => {
    mockMes = { data: [COMPLEXE_FIVE], isLoading: false };
    const arbre = await monter(
      <BasculeComplexe
        accountRoleKey="president"
        canUsePlayerMode={false}
        compteId="u-1"
        isPlayerMode={false}
        onChange={jest.fn()}
      />,
    );
    expect(textes(arbre)).toEqual(['Tu gères Le Five de Montrivage.', 'Mode complexe']);
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
