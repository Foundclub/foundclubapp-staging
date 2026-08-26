import { Animated, AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText, { getActiveMarqueeCount } from '../MarqueeText';

// U01 — un nom de club trop long doit DÉFILER, au lieu d'être coupé par « … »
// et d'obliger à ouvrir la fiche pour le lire en entier.
//
// Ce fichier prouve les quatre invariants qui vont avec, dans l'ordre où ils
// comptent :
//   D1 — ça ne défile QUE si ça dépasse, et c'est la MESURE qui le dit : la
//        longueur en caractères ne dit rien de la largeur réelle ;
//   D3 — le budget d'animation reste tenu : le registre partagé compte 0 dès
//        que la carte n'est pas vue (motif repris de SponsorMarquee.test.js) ;
//   D4 — le lecteur d'écran ne lit jamais un texte qui bouge ;
//   D5 — sans mesure (web, premier rendu), on retombe sur la troncature.

const mockIsFocused = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused(),
}));

const NOM_LONG = 'Association Sportive et Culturelle de Villeneuve-sur-Lot Football';
const NOM_COURT = 'FC Lyon';

const renderMarquee = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<MarqueeText text={NOM_LONG} {...props} />);
  });
  return tree;
};

const enveloppeDe = (tree) => tree.root.find(
  (node) => node.type === 'View' && typeof node.props?.onLayout === 'function',
);

const sondeDe = (tree) => tree.root.find(
  (node) => node.type === 'Text' && typeof node.props?.onLayout === 'function',
);

// Sans moteur de mise en page, aucune largeur n'arrive jamais : les témoins
// déclenchent eux-mêmes les DEUX mesures — la place disponible (l'enveloppe)
// et la largeur naturelle du texte (la sonde hors flux).
const mesurer = (tree, { largeurTexte, largeurVisible }) => {
  act(() => {
    enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: largeurVisible } } });
    sondeDe(tree).props.onLayout({ nativeEvent: { layout: { width: largeurTexte } } });
  });
};

// La ligne du repli : une seule ligne, coupée par « … ». C'est EXACTEMENT ce
// que la carte affichait avant U01.
const lignesTronquees = (tree) => tree.root.findAll(
  (node) => node.type === 'Text' && node.props?.ellipsizeMode === 'tail',
);

describe('MarqueeText — D1 : ça ne défile QUE si ça dépasse', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('un nom qui TIENT reste strictement immobile : aucune boucle', () => {
    const tree = renderMarquee({ text: NOM_COURT });
    mesurer(tree, { largeurTexte: 80, largeurVisible: 200 });

    expect(getActiveMarqueeCount()).toBe(0);
    expect(lignesTronquees(tree)).toHaveLength(1);
    act(() => {
      tree.unmount();
    });
  });

  it('un nom qui DÉPASSE défile : une boucle, le texte rendu en entier', () => {
    const tree = renderMarquee({});
    expect(getActiveMarqueeCount()).toBe(0);

    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });

    expect(getActiveMarqueeCount()).toBe(1);
    // La sonde + les deux copies de la boucle : 3 occurrences, et plus aucune
    // ligne tronquée — le nom entier est lisible sans ouvrir la fiche.
    const json = JSON.stringify(tree.toJSON());
    expect(json.split(NOM_LONG).length - 1).toBe(3);
    expect(lignesTronquees(tree)).toHaveLength(0);

    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('recyclage de liste : le nouveau nom ne prend PAS la mesure de l\'ancien', () => {
    // La liste des clubs est virtualisée : la même carte resservira pour un
    // autre club. Si la largeur mesurée survivait au changement de nom, un nom
    // court hériterait du défilement du précédent.
    const tree = renderMarquee({});
    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => {
      tree.update(<MarqueeText text={NOM_COURT} />);
    });

    expect(getActiveMarqueeCount()).toBe(0);
    expect(lignesTronquees(tree)).toHaveLength(1);

    mesurer(tree, { largeurTexte: 80, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(0);

    act(() => {
      tree.unmount();
    });
  });

  it('un nom qui tient PILE reste immobile (pas de tremblement sous-pixel)', () => {
    const tree = renderMarquee({});
    mesurer(tree, { largeurTexte: 200, largeurVisible: 200 });

    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });

  it('la LONGUEUR en caractères ne décide rien : seule la place disponible', () => {
    // Le même texte, deux largeurs de carte : il défile dans la carte étroite,
    // il ne bouge pas dans la carte large.
    const etroite = renderMarquee({});
    mesurer(etroite, { largeurTexte: 420, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(1);
    act(() => {
      etroite.unmount();
    });

    const large = renderMarquee({});
    mesurer(large, { largeurTexte: 420, largeurVisible: 600 });
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      large.unmount();
    });
  });
});

describe('MarqueeText — D5 : le repli honnête', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('aucune mesure : une ligne coupée par « … », aucune animation', () => {
    const tree = renderMarquee({});

    expect(getActiveMarqueeCount()).toBe(0);
    const [ligne] = lignesTronquees(tree);
    expect(ligne.props.numberOfLines).toBe(1);
    expect(ligne.props.ellipsizeMode).toBe('tail');

    act(() => {
      tree.unmount();
    });
  });

  it('la place est mesurée mais pas le texte : on reste sur la troncature', () => {
    const tree = renderMarquee({});
    act(() => {
      enveloppeDe(tree).props.onLayout({ nativeEvent: { layout: { width: 200 } } });
    });

    expect(lignesTronquees(tree)).toHaveLength(1);
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });

  it('un événement de mesure vide ne casse rien et ne lance rien', () => {
    const tree = renderMarquee({});
    act(() => {
      enveloppeDe(tree).props.onLayout({});
      sondeDe(tree).props.onLayout(undefined);
    });

    expect(lignesTronquees(tree)).toHaveLength(1);
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });
});

describe('MarqueeText — D3 : le budget d\'animation reste tenu', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('10 cartes montées, 3 visibles (7 paused) -> 3 boucles actives', () => {
    const trees = Array.from({ length: 10 }, (_unused, index) => renderMarquee({
      paused: index >= 3,
    }));
    trees.forEach((tree) => mesurer(tree, { largeurTexte: 420, largeurVisible: 200 }));

    expect(getActiveMarqueeCount()).toBe(3);

    act(() => {
      trees.forEach((tree) => tree.unmount());
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('écran non focus -> aucune animation, retour au focus -> reprise', () => {
    mockIsFocused.mockReturnValue(false);
    const tree = renderMarquee({});
    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(0);

    mockIsFocused.mockReturnValue(true);
    act(() => {
      tree.update(<MarqueeText text={NOM_LONG} />);
    });
    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('app passée en arrière-plan -> aucune animation, retour -> reprise', () => {
    const auditeurs = [];
    const espion = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      auditeurs.push(handler);
      return { remove: jest.fn() };
    });

    const tree = renderMarquee({});
    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => {
      auditeurs.forEach((handler) => handler('background'));
    });
    expect(getActiveMarqueeCount()).toBe(0);

    act(() => {
      auditeurs.forEach((handler) => handler('active'));
    });
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
    espion.mockRestore();
  });

  it('sur téléphone, l\'animation ne traverse pas le fil JS', () => {
    const espion = jest.spyOn(Animated, 'timing');
    const tree = renderMarquee({});
    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });

    expect(espion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ useNativeDriver: true }),
    );

    espion.mockRestore();
    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });
});

describe('MarqueeText — D4 : le lecteur d\'écran ne lit pas un texte qui bouge', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('le bloc défilant est masqué au lecteur d\'écran, dans les deux états', () => {
    const tree = renderMarquee({});
    const attendu = {
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    };

    expect(enveloppeDe(tree).props).toMatchObject(attendu);

    mesurer(tree, { largeurTexte: 420, largeurVisible: 200 });
    expect(enveloppeDe(tree).props).toMatchObject(attendu);

    act(() => {
      tree.unmount();
    });
  });
});
