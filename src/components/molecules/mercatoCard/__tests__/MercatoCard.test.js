import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MercatoCard from '../MercatoCard';

// Filet L03 (E6) : la carte annonce/profil mercato n'avait AUCUN test.
// Caractérise les DONNÉES affichées et la commande onPress — doit rester
// vert après la refonte visuelle 5b du handoff « Cartes Rechercher ».

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

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

const collectTexts = (node, acc = []) => {
  if (node === null || node === undefined) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<MercatoCard {...props} />);
  });
  return tree;
};

const baseUser = {
  category: 'Sénior',
  club: { name: 'AS Cannes' },
  documentId: 'user-1',
  firstname: 'Jean',
  lastname: 'Dupont',
  position: 'Avant-centre',
  preferredSport: 'Football',
};

describe('MercatoCard — données affichées (caractérisation)', () => {
  it('affiche le nom, le club, le poste, la catégorie et le sport', () => {
    const tree = renderCard({ user: baseUser });
    const texts = collectTexts(tree.toJSON()).join('\n');

    expect(texts).toContain('Jean');
    expect(texts).toContain('Dupont');
    expect(texts).toContain('AS Cannes');
    expect(texts).toMatch(/Avant-centre/i);
    expect(texts).toContain('Sénior');
    expect(texts).toContain('Football');
  });

  it('sans club : affiche « Ouvert au recrutement » et le poste par défaut', () => {
    const tree = renderCard({
      user: {
        ...baseUser, club: null, position: null,
      },
    });
    const texts = collectTexts(tree.toJSON()).join('\n');
    expect(texts).toContain('Ouvert au recrutement');
    expect(texts).toMatch(/Joueur/i);
  });

  it('avec une URL d avatar : affiche la photo du profil', () => {
    const { Image } = jest.requireActual('react-native');
    const tree = renderCard({
      user: { ...baseUser, avatar: { url: 'https://exemple.test/photo.png' } },
    });
    const avatar = tree.root
      .findAllByType(Image)
      .find((node) => node.props.source?.uri === 'https://exemple.test/photo.png');
    expect(avatar).toBeTruthy();
  });

  it('appuie sur la carte -> onPress(user)', () => {
    const onPress = jest.fn();
    const tree = renderCard({ onPress, user: baseUser });
    const pressable = tree.root.findAllByType(TouchableOpacity)[0];
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledWith(baseUser);
  });
});
