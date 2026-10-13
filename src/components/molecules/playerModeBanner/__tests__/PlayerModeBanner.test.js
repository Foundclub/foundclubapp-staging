import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerModeBanner from '../PlayerModeBanner';

// LOT RÔLES (2026-09-28) — écran 3 : le bandeau du mode joueur, en tête de
// l'accueil. Deux états : l'OFFRE (« Voir l'app en joueur ») pour un dirigeant
// qui joue, et le RETOUR (« Revenir en mode dirigeant ») quand le mode est
// actif — « l'option de revenir en arrière », en un geste. Écrit ROUGE.
//
// PAR-L12 (13/10, design parent §2 bis / E25, décision D6 A d'Adel du 12/10) — TROIS états :
// le rôle du compte, le mode joueur, le MODE PARENT. Le bandeau reçoit le mode actif
// (`displayMode`) et rend le mode choisi (`onChange('player' | 'parent' | null)`) ; les
// témoins du lot RÔLES sont gardés, réécrits dans cette forme (`true` → `'player'`, `false` →
// `null`). Il s'affiche pour tout parent : le compte Parent, et un sportif qui a des enfants.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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

/**
 * Monte le bandeau.
 * @param {any} props - Ce que l'accueil lui passe.
 * @returns {any} - L'arbre rendu.
 */
const monter = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PlayerModeBanner
        accountRoleKey={props.accountRoleKey}
        canUseParentMode={props.canUseParentMode === true}
        canUsePlayerMode={props.canUsePlayerMode === true}
        displayMode={props.displayMode ?? null}
        onChange={props.onChange || jest.fn()}
        onPratiqueAussi={props.onPratiqueAussi || jest.fn()}
        prenoms={props.prenoms || []}
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
    const arbre = monter({ accountRoleKey: 'president', canUsePlayerMode: true, onChange });

    expect(textes(arbre)).toContain('Tu joues aussi dans une équipe.');
    act(() => bouton(arbre, 'player-mode-enter').props.onPress());
    expect(onChange).toHaveBeenCalledWith('player');
    expect(bouton(arbre, 'player-mode-exit')).toBeUndefined();
  });

  it('en mode joueur : il le dit, et le RETOUR se fait en un geste', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'president', canUsePlayerMode: true, displayMode: 'player', onChange,
    });

    expect(textes(arbre)).toContain('Mode joueur');
    const retour = bouton(arbre, 'player-mode-exit');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode dirigeant');
    act(() => retour.props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('un entraîneur revient en mode entraîneur', () => {
    const arbre = monter({
      accountRoleKey: 'coach', canUsePlayerMode: true, displayMode: 'player',
    });
    const retour = bouton(arbre, 'player-mode-exit');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode entraîneur');
  });

  it('rien à proposer : rien n\'est affiché', () => {
    const arbre = monter({ accountRoleKey: 'player' });
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('PAR-L12 — le mode parent (E25)', () => {
  it('compte PARENT : « Tu pratiques aussi un sport ? », le 1er appui ouvre la feuille', () => {
    const onChange = jest.fn();
    const onPratiqueAussi = jest.fn();
    const arbre = monter({ accountRoleKey: 'parent', onChange, onPratiqueAussi });

    expect(textes(arbre)).toContain('Tu pratiques aussi un sport ?');
    const entrer = bouton(arbre, 'player-mode-enter');
    expect(entrer.props.accessibilityLabel).toBe('Basculer en mode joueur');
    act(() => entrer.props.onPress());
    expect(onPratiqueAussi).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('JOUEUR qui a des enfants, en mode joueur : qui l attend, et le retour en un geste', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'player', canUseParentMode: true, onChange, prenoms: ['Anissa', 'Martin'],
    });

    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Mode joueur',
      'Tu vois l’app comme un joueur. Anissa et Martin t’attendent dans le mode parent.',
    ]));
    const retour = bouton(arbre, 'parent-mode-enter');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode parent');
    act(() => retour.props.onPress());
    expect(onChange).toHaveBeenCalledWith('parent');
  });

  it('JOUEUR en mode parent : « Tu joues aussi dans une équipe. » et la bascule immédiate', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'player', canUseParentMode: true, displayMode: 'parent', onChange,
    });

    expect(textes(arbre)).toContain('Tu joues aussi dans une équipe.');
    const entrer = bouton(arbre, 'player-mode-enter');
    expect(entrer.props.accessibilityLabel).toBe('Basculer en mode joueur');
    act(() => entrer.props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('un enfant : « Anissa t’attend » ; trois ou plus, ou rien de lu : « Tes enfants »', () => {
    const un = monter({ accountRoleKey: 'player', canUseParentMode: true, prenoms: ['Anissa'] });
    const trois = monter({
      accountRoleKey: 'player', canUseParentMode: true, prenoms: ['Anissa', 'Martin', 'Léa'],
    });

    expect(textes(un)).toContain(
      'Tu vois l’app comme un joueur. Anissa t’attend dans le mode parent.',
    );
    expect(textes(trois)).toContain(
      'Tu vois l’app comme un joueur. Tes enfants t’attendent dans le mode parent.',
    );
  });

  it('DIRIGEANT qui joue et a des enfants : « Mode joueur » et « Mode parent »', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'president', canUseParentMode: true, canUsePlayerMode: true, onChange,
    });

    expect(bouton(arbre, 'player-mode-enter').props.accessibilityLabel).toBe('Mode joueur');
    expect(bouton(arbre, 'parent-mode-enter').props.accessibilityLabel).toBe('Mode parent');
    act(() => bouton(arbre, 'parent-mode-enter').props.onPress());
    expect(onChange).toHaveBeenCalledWith('parent');
  });

  it('DIRIGEANT en mode parent : il le dit, et revient en mode dirigeant en un geste', () => {
    const onChange = jest.fn();
    const arbre = monter({
      accountRoleKey: 'president', canUseParentMode: true, displayMode: 'parent', onChange,
    });

    expect(textes(arbre)).toContain('Mode parent');
    const retour = bouton(arbre, 'parent-mode-exit');
    expect(retour.props.accessibilityLabel).toBe('Revenir en mode dirigeant');
    act(() => retour.props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('ENTRAÎNEUR qui ne joue pas mais a des enfants : la seule porte est le mode parent', () => {
    const arbre = monter({ accountRoleKey: 'coach', canUseParentMode: true });

    expect(bouton(arbre, 'player-mode-enter')).toBeUndefined();
    expect(bouton(arbre, 'parent-mode-enter').props.accessibilityLabel)
      .toBe('Basculer en mode parent');
  });

  it('un compte sans enfant n a aucune bascule « Parent »', () => {
    const arbre = monter({ accountRoleKey: 'president', canUsePlayerMode: true });
    expect(bouton(arbre, 'parent-mode-enter')).toBeUndefined();
  });
});

// ✂️ FINITIONS3 (29/09, tournee 5, defaut 4) — « Voir l'app en » : le mot « joueur »
// coupe sous Android 16. Le bouton centrait son libelle (`alignItems: 'center'`), donc
// la boite du texte epousait sa largeur MESUREE : un texte GRAS de plusieurs mots y perd
// son dernier mot (piege connu, parade du bouton partage : la boite s etire, le texte
// est centre). Ce temoin tient la STRUCTURE de TOUS les libelles du bandeau, dans ses
// etats : Jest ne calcule aucune mise en page, seul l ecran prouvera le mot entier.
// ROUGE avant : « Voir l'app en joueur » et « Revenir en mode dirigeant ».
// PAR-L12 : les etats du mode parent sont tenus par la MEME regle.
describe('FINITIONS3 — aucun libellé du bandeau n épouse sa largeur mesurée', () => {
  /**
   * La boite du texte s etire-t-elle sur toute la largeur de son parent ?
   * @param {any} noeud - Un `Text` de l arbre rendu.
   * @returns {boolean} - Vrai si la boite s etire.
   */
  const boiteEtiree = (noeud) => {
    const style = StyleSheet.flatten(noeud.props.style) || {};
    if (style.alignSelf && style.alignSelf !== 'auto') return style.alignSelf === 'stretch';
    const parent = StyleSheet.flatten(noeud.parent.props.style) || {};
    return !parent.alignItems || parent.alignItems === 'stretch';
  };

  it.each([
    ['l offre', { accountRoleKey: 'president', canUsePlayerMode: true }, "Voir l'app en joueur"],
    ['le retour', {
      accountRoleKey: 'president', canUsePlayerMode: true, displayMode: 'player',
    }, 'Revenir en mode dirigeant'],
    ['les deux portes', {
      accountRoleKey: 'president', canUseParentMode: true, canUsePlayerMode: true,
    }, 'Mode parent'],
    ['le compte parent', { accountRoleKey: 'parent' }, 'Basculer en mode joueur'],
    ['le joueur parent', {
      accountRoleKey: 'player', canUseParentMode: true,
    }, 'Revenir en mode parent'],
  ])('%s : chaque texte s étire, et le libellé du bouton reste centré', (_, props, libelle) => {
    const arbre = monter(props);
    const noeuds = arbre.root.findAllByType(Text);
    const texte = (/** @type {any} */ noeud) => [].concat(noeud.props.children).join('');

    expect(noeuds.filter((noeud) => !boiteEtiree(noeud)).map(texte)).toEqual([]);
    const libelleDuBouton = noeuds.find((noeud) => texte(noeud) === libelle);
    expect(StyleSheet.flatten(libelleDuBouton.props.style).textAlign).toBe('center');
  });
});
