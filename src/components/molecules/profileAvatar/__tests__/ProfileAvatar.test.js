import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileAvatar from '../ProfileAvatar';

// Lot L14 « identite visuelle ». Regle tranchee par Adel le 2026-08-02 :
//   PERSONNES        -> sans photo : LES INITIALES
//   CLUBS / EQUIPES  -> sans logo  : L'ECUSSON (TeamShield, via ClubLogoMark)
//
// Ce fichier est ne AVANT la correction (E6 : ProfileAvatar n'avait aucun test).
// Il porte deux choses qui ne doivent JAMAIS bouger ensemble :
//   - les TEMOINS POSITIFS : une image reelle reste une image reelle, et
//     variant="logo" garde exactement le comportement d'avant. Sans eux, un
//     composant qui n'afficherait plus jamais d'image passerait pour corrige.
//   - le repli « pas de photo », qui lui change : dessin generique -> initiales.

const REPLI_GENERIQUE = 'source-repli-generique-roundAvatar';

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url || undefined,
}));

jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => () => null,
);

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
      // Sentinelle : le dessin generique que le repli ne doit plus servir.
      Images: { roundAvatar: 'source-repli-generique-roundAvatar' },
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

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

const render = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<ProfileAvatar {...props} />);
  });
  return tree;
};

const sourcesOf = (tree) => tree.root.findAllByType(Image).map((node) => node.props.source);
const textsOf = (tree) => collectTexts(tree.toJSON()).join('\n');

describe('ProfileAvatar — temoins positifs : une image reelle reste une image', () => {
  it('avec une photo : rend l\'image, et jamais le repli generique', () => {
    const tree = render({ imageUrl: 'https://exemple.test/photo.jpg' });
    const sources = sourcesOf(tree);
    expect(sources).toContainEqual({ uri: 'https://exemple.test/photo.jpg' });
    expect(sources).not.toContain(REPLI_GENERIQUE);
  });

  it('variant="logo" AVEC logo : rend le logo en resizeMode contain', () => {
    const tree = render({
      imageUrl: 'https://exemple.test/ecusson.png',
      variant: 'logo',
    });
    const images = tree.root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://exemple.test/ecusson.png' });
    expect(images[0].props.resizeMode).toBe('contain');
  });

  it('avec une photo : la vignette reste ouvrable (apercu plein ecran)', () => {
    const tree = render({ imageUrl: 'https://exemple.test/photo.jpg' });
    const touchable = tree.root.findAllByProps({ accessibilityRole: 'imagebutton' });
    expect(touchable.length).toBeGreaterThan(0);
  });
});

describe('ProfileAvatar — variant="logo" : comportement fige, la correction ne le touche pas', () => {
  it('variant="logo" SANS logo : garde le repli d\'origine (ClubLogoMark ne l\'atteint jamais)', () => {
    const tree = render({ variant: 'logo' });
    expect(sourcesOf(tree)).toContain(REPLI_GENERIQUE);
  });
});

describe('ProfileAvatar — repli « pas de photo » : les INITIALES de la personne', () => {
  it('sans photo mais avec un nom : rend les initiales et PLUS le dessin generique', () => {
    const tree = render({ name: 'Jean Dupont' });
    expect(textsOf(tree)).toContain('JD');
    expect(sourcesOf(tree)).not.toContain(REPLI_GENERIQUE);
  });

  it('un seul mot : une seule initiale', () => {
    const tree = render({ name: 'Zidane' });
    expect(textsOf(tree)).toContain('Z');
  });

  it('sans photo ET sans nom : repli neutre, pas de plantage, pas de « undefined »', () => {
    const tree = render({});
    const texts = textsOf(tree);
    expect(texts).not.toContain('undefined');
    expect(texts).not.toContain('NaN');
    expect(sourcesOf(tree)).not.toContain(REPLI_GENERIQUE);
    expect(tree.toJSON()).not.toBeNull();
  });

  it('nom fait uniquement d\'espaces : traite comme absent, pas d\'initiale fantome', () => {
    const tree = render({ name: '   ' });
    expect(textsOf(tree)).not.toContain('undefined');
    expect(tree.toJSON()).not.toBeNull();
  });

  it('sans photo : la vignette n\'est pas ouvrable (rien a agrandir)', () => {
    const tree = render({ name: 'Jean Dupont' });
    expect(tree.root.findAllByProps({ accessibilityRole: 'imagebutton' })).toHaveLength(0);
  });
});
