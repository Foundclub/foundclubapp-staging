import renderer, { act } from 'react-test-renderer';

import SponsorMarquee, { getActiveMarqueeCount } from '../SponsorMarquee';

// Preuve de la contrainte de performance L03 : une Animated.loop par carte,
// suspendue dès que la carte n'est pas visible (paused, écran non focus,
// démontage). Le registre getActiveMarqueeCount compte les boucles réelles.

const mockIsFocused = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused(),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

const SPONSORS = [
  { documentId: 'sp-1', logo: {}, title: 'Boulangerie Paul' },
  { documentId: 'sp-2', logo: {}, title: 'Garage Central' },
];

// Déclenche la mesure de largeur (onLayout de la première copie) sans
// laquelle la boucle ne démarre pas — en environnement de test il n'y a
// pas de layout réel.
const fireCopyLayout = (tree, width = 240) => {
  const measured = tree.root.findAll(
    (node) => typeof node.props?.onLayout === 'function',
  );
  act(() => {
    measured.forEach((node) => {
      node.props.onLayout({ nativeEvent: { layout: { width } } });
    });
  });
};

const renderMarquee = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<SponsorMarquee sponsors={SPONSORS} {...props} />);
  });
  return tree;
};

describe('SponsorMarquee — rendu', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('sans sponsor : la section est masquée', () => {
    const tree = renderMarquee({ sponsors: [] });
    expect(tree.toJSON()).toBeNull();
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });

  it('affiche les noms des sponsors, dupliqués pour la boucle continue', () => {
    const tree = renderMarquee({});
    const json = JSON.stringify(tree.toJSON());
    const occurrences = json.split('Boulangerie Paul').length - 1;
    // 2 sponsors répétés jusqu'à >= 4 éléments, puis x2 copies -> 4 occurrences.
    expect(occurrences).toBe(4);
    act(() => {
      tree.unmount();
    });
  });

  it('dès 1 sponsor : la boucle démarre après la mesure de largeur', () => {
    const tree = renderMarquee({ sponsors: [SPONSORS[0]] });
    expect(getActiveMarqueeCount()).toBe(0);
    fireCopyLayout(tree);
    expect(getActiveMarqueeCount()).toBe(1);
    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });
});

describe('SponsorMarquee — suspension hors écran', () => {
  beforeEach(() => {
    mockIsFocused.mockReturnValue(true);
  });

  it('10 cartes montées, 3 visibles (7 paused) -> 3 animations actives', () => {
    const trees = Array.from({ length: 10 }, (_unused, index) => renderMarquee({
      paused: index >= 3,
    }));
    trees.forEach((tree) => fireCopyLayout(tree));

    expect(getActiveMarqueeCount()).toBe(3);

    act(() => {
      trees.forEach((tree) => tree.unmount());
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('écran non focus -> aucune animation, retour au focus -> reprise', () => {
    mockIsFocused.mockReturnValue(false);
    const tree = renderMarquee({});
    fireCopyLayout(tree);
    expect(getActiveMarqueeCount()).toBe(0);

    mockIsFocused.mockReturnValue(true);
    act(() => {
      tree.update(<SponsorMarquee sponsors={SPONSORS} />);
    });
    fireCopyLayout(tree);
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });
});
