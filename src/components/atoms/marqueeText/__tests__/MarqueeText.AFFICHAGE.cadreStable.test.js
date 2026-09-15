import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText from '../MarqueeText';

// AFFICHAGE (15/09, signalement d'Adel, iPhone build 1311) — dans l'en-tête de
// la fiche d'équipe, un nom long « clignote et défile bizarrement » : deux
// copies du nom visibles en même temps, coupées aux deux bords de l'écran.
//
// LA CAUSE, et elle est dans ce composant, pas dans l'écran :
// l'enveloppe n'a pas de largeur à elle — elle prend celle de ce qu'elle
// CONTIENT. Or ce contenu changeait selon la décision « ça dépasse ? » :
//   · repli tronqué : une ligne qui se RÉTRÉCIT à la place disponible ;
//   · défilement    : une piste RIGIDE de deux copies, ~2× la largeur du nom.
// Dans une colonne centrée (l'en-tête), l'enveloppe s'élargissait donc à la
// piste, sa nouvelle mesure disait « ça tient », on revenait au repli, elle
// rétrécissait, « ça dépasse »… et on recommençait : le clignotement.
//
// L'INVARIANT qui casse cette boucle : la taille du cadre ne dépend JAMAIS de
// ce qu'il affiche. La ligne du repli reste dans le flux dans les deux états
// (elle tient la place), et la piste passe hors flux (elle ne pousse rien).
//
// ⚠️ react-test-renderer ne calcule aucune mise en page : ces témoins sont
// STRUCTURELS. Ils mesurent la seule chose qui sépare un cadre stable d'un
// cadre qui oscille — ce qui, dans l'enveloppe, participe à sa taille.

const mockIsFocused = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused(),
}));

const NOM_LONG = 'AIX-PERD EN BUVETTE — ÉQUIPE SENIOR DU DIMANCHE MATIN';

const enveloppeDe = (tree) => tree.root.find(
  (node) => node.type === 'View' && typeof node.props?.onLayout === 'function',
);

const sondeDe = (tree) => tree.root.find(
  (node) => node.type === 'Text' && typeof node.props?.onLayout === 'function',
);

/**
 * Les enfants de l'enveloppe qui participent à sa taille : tout ce qui n'est
 * pas `position: 'absolute'`.
 * @param {any} tree
 * @returns {Array<{ type: string, texte: string }>}
 */
const ligneDuRepli = (tree) => tree.root.find(
  (node) => node.type === 'Text' && node.props?.ellipsizeMode === 'tail',
);

const enfantsDansLeFlux = (tree) => {
  const json = tree.toJSON();
  const enfants = json.children || [];
  return enfants
    .filter((enfant) => StyleSheet.flatten(enfant.props?.style)?.position !== 'absolute')
    .map((enfant) => ({
      texte: JSON.stringify(enfant.children),
      type: enfant.type,
    }));
};

describe('AFFICHAGE — le cadre du texte défilant garde la même taille dans les deux états', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('ce qui tient la place est IDENTIQUE avant et après le départ du défilement', () => {
    let tree;
    act(() => {
      tree = renderer.create(<MarqueeText text={NOM_LONG} />);
    });
    const avant = enfantsDansLeFlux(tree);

    act(() => {
      enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 270 } } });
      sondeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 610 } } });
    });
    // Le défilement a bien démarré : la piste est là.
    expect(tree.root.findAll((node) => node.type === 'View'
      && StyleSheet.flatten(node.props?.style)?.flexDirection === 'row')).toHaveLength(1);

    expect(enfantsDansLeFlux(tree)).toEqual(avant);

    act(() => { tree.unmount(); });
  });

  it('la piste de deux copies est HORS FLUX : elle ne peut pas élargir le cadre', () => {
    let tree;
    act(() => {
      tree = renderer.create(<MarqueeText text={NOM_LONG} />);
    });
    act(() => {
      enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 270 } } });
      sondeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 610 } } });
    });

    const piste = tree.root.find((node) => node.type === 'View'
      && StyleSheet.flatten(node.props?.style)?.flexDirection === 'row');
    expect(StyleSheet.flatten(piste.props.style))
      .toMatchObject({ left: 0, position: 'absolute', top: 0 });

    act(() => { tree.unmount(); });
  });

  it('pendant le défilement, la ligne qui tient la place est INVISIBLE (pas de doublon)', () => {
    let tree;
    act(() => {
      tree = renderer.create(<MarqueeText text={NOM_LONG} />);
    });
    act(() => {
      enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 270 } } });
      sondeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 610 } } });
    });

    const repli = ligneDuRepli(tree);
    expect(StyleSheet.flatten(repli.props.style)).toMatchObject({ opacity: 0 });

    act(() => { tree.unmount(); });
  });

  it('un nom qui tient : la ligne reste VISIBLE, rien d\'autre ne change', () => {
    let tree;
    act(() => {
      tree = renderer.create(<MarqueeText text="FC LYON" />);
    });
    act(() => {
      enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 270 } } });
      sondeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 80 } } });
    });

    const repli = ligneDuRepli(tree);
    expect(StyleSheet.flatten(repli.props.style)?.opacity).toBeUndefined();

    act(() => { tree.unmount(); });
  });
});
