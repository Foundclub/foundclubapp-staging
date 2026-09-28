import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerModeBanner from '../PlayerModeBanner';

// LOT RÔLES (2026-09-28) — écran 3 : le bandeau du mode joueur, en tête de
// l'accueil. Deux états : l'OFFRE (« Voir l'app en joueur ») pour un dirigeant
// qui joue, et le RETOUR (« Revenir en mode dirigeant ») quand le mode est
// actif — « l'option de revenir en arrière », en un geste. Écrit ROUGE.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(valeurs?.[nom] ?? ''));
    },
  }),
}));

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

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PlayerModeBanner
        accountRoleKey={props.accountRoleKey}
        canUsePlayerMode={props.canUsePlayerMode}
        isPlayerMode={props.isPlayerMode}
        onChange={props.onChange}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const bouton = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === testID && typeof noeud.props?.onPress === 'function'
  ))[0];

afterEach(() => {
  while (montes.length) {
    const arbre = montes.pop();
    act(() => arbre.unmount());
  }
});

describe('RÔLES — le bandeau du mode joueur', () => {
  it('propose au dirigeant qui joue de voir l\'app en joueur', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'president', canUsePlayerMode: true, isPlayerMode: false, onChange,
    });

    expect(textes(arbre)).toContain('Tu joues aussi dans une équipe.');
    act(() => bouton(arbre, 'player-mode-enter').props.onPress());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(bouton(arbre, 'player-mode-exit')).toBeUndefined();
  });

  it('en mode joueur : il le dit, et le RETOUR se fait en un geste', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'president', canUsePlayerMode: true, isPlayerMode: true, onChange,
    });

    expect(textes(arbre)).toContain('Mode joueur');
    const retour = bouton(arbre, 'player-mode-exit');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode dirigeant');
    act(() => retour.props.onPress());
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('un entraîneur revient en mode entraîneur', () => {
    const arbre = monter({
      accountRoleKey: 'coach', canUsePlayerMode: true, isPlayerMode: true, onChange: jest.fn(),
    });
    const retour = bouton(arbre, 'player-mode-exit');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode entraîneur');
  });

  it('rien à proposer : rien n\'est affiché', () => {
    const arbre = monter({
      accountRoleKey: 'player', canUsePlayerMode: false, isPlayerMode: false, onChange: jest.fn(),
    });
    expect(arbre.toJSON()).toBeNull();
  });
});
