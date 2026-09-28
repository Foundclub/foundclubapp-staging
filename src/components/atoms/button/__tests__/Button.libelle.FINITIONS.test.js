import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '../Button';

// FINITIONS (recette émulateur du 2026-09-28, Android 16, tournée 3) —
// « Voir la convocation et les » : le bouton partagé perdait encore son DERNIER
// MOT, malgré ROLES2 (police qui rétrécit). La capture le montre en police minuscule
// ET coupé : rétrécir ne suffit pas.
//
// 🔎 LA RÈGLE QUE LES CAPTURES DONNENT (T2 et T3) : un texte en GRAS de plusieurs mots,
// dans une boîte qui ÉPOUSE sa largeur mesurée, perd son dernier mot sous Android 16.
// Le même texte dans une boîte plus large que lui s'affiche entier (« Voir les
// résultats », ROLES2, `alignSelf: 'stretch'` — vu entier en tournée 2).
// ⇒ Le libellé du bouton prend désormais TOUTE la largeur du bouton, centré, au lieu
// d'être rétréci à sa largeur mesurée. Écrit ROUGE.
//
// ⚠️ Jest ne calcule aucune mise en page : ce témoin tient la STRUCTURE (la boîte du
// texte s'étire), pas le rendu. Seul l'écran d'un Android 16 prouvera le mot entier.

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
    Images: { check: 1 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

const LIBELLE = 'Voir la convocation et les réponses';

/**
 * Monte un bouton et rend son libellé et la boîte qui le porte.
 * @param {{ icon?: any, textStyle?: any }} options - L'icône et le style de libellé.
 * @returns {{ arbre: any, boite: any, libelle: any }} - L'arbre et les deux styles aplatis.
 */
const monter = (options) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <Button
        icon={options.icon}
        onPress={() => {}}
        textStyle={options.textStyle}
        title={LIBELLE}
        variant="Secondary"
      />,
    );
  });
  const libelle = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ noeud) => noeud.props.children === LIBELLE);
  return {
    arbre,
    boite: StyleSheet.flatten(libelle.parent.props.style) || {},
    libelle: StyleSheet.flatten(libelle.props.style) || {},
  };
};

describe('FINITIONS — le libellé du bouton partagé n est plus rétréci à sa largeur mesurée', () => {
  it('sans icône : la boîte s étire sur tout le bouton, le texte la remplit, centré', () => {
    const { arbre, boite, libelle } = monter({});

    expect({ alignSelf: boite.alignSelf, justifyContent: boite.justifyContent })
      .toEqual({ alignSelf: 'stretch', justifyContent: 'center' });
    // ⛔ `flexGrow`, jamais `flex: 1` : `flex: 1` pose une base nulle, et un bouton
    // dimensionné par son contenu (sans largeur donnée) retomberait à ZÉRO pixel.
    expect({
      flex: libelle.flex,
      flexBasis: libelle.flexBasis,
      flexGrow: libelle.flexGrow,
      textAlign: libelle.textAlign,
    }).toEqual({
      flex: undefined, flexBasis: undefined, flexGrow: 1, textAlign: 'center',
    });
    act(() => arbre.unmount());
  });

  it('avec icône : texte et icône restent groupés au centre', () => {
    const { arbre, boite, libelle } = monter({ icon: 'check' });

    expect(boite.justifyContent).toBe('center');
    expect(libelle.flexGrow).toBeUndefined();
    act(() => arbre.unmount());
  });

  it('ROLES2 reste acquis : une ligne, la police s adapte', () => {
    const { arbre } = monter({});
    const noeud = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ n) => n.props.children === LIBELLE);

    expect(noeud.props.numberOfLines).toBe(1);
    expect(noeud.props.adjustsFontSizeToFit).toBe(true);
    act(() => arbre.unmount());
  });

  it('un alignement de texte passé par l appelant l emporte toujours', () => {
    const { arbre, libelle } = monter({ textStyle: { textAlign: 'left' } });

    expect(libelle.textAlign).toBe('left');
    act(() => arbre.unmount());
  });
});
