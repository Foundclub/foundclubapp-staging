import renderer, { act } from 'react-test-renderer';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import ClubLogoMark from '../ClubLogoMark';

// Lot L14. Cote CLUBS et EQUIPES, la regle etait deja appliquee ici : vrai logo
// s'il existe, sinon l'ECUSSON. Ce fichier est un filet de NON-REGRESSION : la
// correction du repli « personne » ne doit rien changer a ce chemin, et surtout
// ClubLogoMark ne doit JAMAIS laisser passer un club vers le repli de personne.

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
      Images: { roundAvatar: 'source-repli-generique-roundAvatar', shield: 'source-ecusson' },
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
    tree = renderer.create(<ClubLogoMark {...props} />);
  });
  return tree;
};

const textsOf = (tree) => collectTexts(tree.toJSON()).join('\n');

describe('ClubLogoMark — sans logo : l\'ECUSSON, jamais le repli de personne', () => {
  it('club sans logo : rend TeamShield avec les initiales du club', () => {
    const tree = render({ club: { name: 'Olympique de Marseille' } });
    expect(tree.root.findAllByType(TeamShield)).toHaveLength(1);
    expect(tree.root.findAllByType(ProfileAvatar)).toHaveLength(0);
    expect(textsOf(tree)).toContain('OM');
  });

  it('equipe sans logo : ecusson aussi (meme famille que les clubs)', () => {
    const tree = render({ name: 'U15 Feminines' });
    expect(tree.root.findAllByType(TeamShield)).toHaveLength(1);
    expect(textsOf(tree)).toContain('UF');
  });

  it('aucun nom : ecusson avec le repli « FC », pas de plantage', () => {
    const tree = render({});
    expect(tree.root.findAllByType(TeamShield)).toHaveLength(1);
    expect(textsOf(tree)).toContain('FC');
    expect(textsOf(tree)).not.toContain('undefined');
  });
});

describe('ClubLogoMark — avec logo : le vrai logo, en variant logo', () => {
  it.each([
    ['logoUrl direct', { logoUrl: 'https://exemple.test/a.png' }, 'https://exemple.test/a.png'],
    ['club.logo.url', { club: { logo: { url: 'https://exemple.test/b.png' }, name: 'FC B' } }, 'https://exemple.test/b.png'],
    ['club.logoUrl', { club: { logoUrl: 'https://exemple.test/c.png', name: 'FC C' } }, 'https://exemple.test/c.png'],
    ['club.club.logo.url', { club: { club: { logo: { url: 'https://exemple.test/d.png' } } } }, 'https://exemple.test/d.png'],
    ['club.club.logoUrl', { club: { club: { logoUrl: 'https://exemple.test/e.png' } } }, 'https://exemple.test/e.png'],
  ])('%s : rend le logo et aucun ecusson', (_label, props, expectedUrl) => {
    const tree = render(props);
    const avatars = tree.root.findAllByType(ProfileAvatar);
    expect(avatars).toHaveLength(1);
    expect(avatars[0].props.imageUrl).toBe(expectedUrl);
    expect(avatars[0].props.variant).toBe('logo');
    expect(tree.root.findAllByType(TeamShield)).toHaveLength(0);
  });

  it('le chemin logo ne passe JAMAIS par le repli « personne » de ProfileAvatar', () => {
    const tree = render({ club: { logo: { url: 'https://exemple.test/f.png' }, name: 'FC F' } });
    expect(textsOf(tree)).not.toContain('·');
  });
});
