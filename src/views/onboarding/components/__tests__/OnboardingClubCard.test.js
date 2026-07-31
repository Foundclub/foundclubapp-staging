import renderer, { act } from 'react-test-renderer';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import OnboardingClubCard, { formatOnboardingDistance } from '../OnboardingClubCard';

// Carte club compacte du handoff onboarding 6b.
//
// ⚠️ Sur STAGING, aucun club n'a d'écusson (mesuré le 2026-07-31 : staging 0,
// production 5 863). Une recette visuelle sur staging ne montrera donc QUE le
// repli en initiales, quoi que fasse le code. Ce test force une URL de logo en
// dur : c'est la seule preuve possible que le chemin « logo réel » existe.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

const collectTexts = (/** @type {any} */ node, /** @type {string[]} */ acc = []) => {
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

const renderCard = (/** @type {any} */ props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<OnboardingClubCard {...props} />);
  });
  return tree;
};

const textsOf = (/** @type {any} */ tree) => collectTexts(tree.toJSON()).join('\n');

const baseClub = {
  addressDetails: '12 rue du Sport, 13008 Marseille',
  documentId: 'club-1',
  name: 'FC Marseille Nord',
};

describe('OnboardingClubCard — logo et en-tête', () => {
  it('avec une URL de logo : affiche le LOGO RÉEL, pas les initiales', () => {
    const tree = renderCard({
      item: { ...baseClub, logo: { url: 'https://exemple.test/ecusson.png' } },
    });
    const avatars = tree.root.findAllByType(ProfileAvatar);
    expect(avatars).toHaveLength(1);
    expect(avatars[0].props.imageUrl).toBe('https://exemple.test/ecusson.png');
  });

  it('sans logo : repli sur les initiales (le cas de staging)', () => {
    const tree = renderCard({ item: baseClub });
    expect(tree.root.findAllByType(ProfileAvatar)).toHaveLength(0);
    expect(textsOf(tree)).toMatch(/FMN|FM/);
  });

  it('affiche le nom et la ville extraite de l\'adresse', () => {
    const texts = textsOf(renderCard({ item: baseClub }));
    expect(texts).toContain('FC Marseille Nord');
    expect(texts).toContain('13008 Marseille');
  });

  it('affiche « à x km » quand la distance est calculée, rien sinon', () => {
    expect(textsOf(renderCard({ distanceKm: 2.4, item: baseClub }))).toContain('à 2,4 km');
    expect(textsOf(renderCard({ item: baseClub }))).not.toContain('à ');
  });
});

describe('OnboardingClubCard — blocs conditionnels', () => {
  it('badge RECRUTE seulement avec une annonce ouverte', () => {
    expect(textsOf(renderCard({ item: baseClub }))).not.toContain('RECRUTE');
    expect(textsOf(renderCard({
      item: { ...baseClub, recruitmentAds: [{ documentId: 'ad-1' }] },
    }))).toContain('RECRUTE');
  });

  it('chips sections seulement quand les sections sont chargées', () => {
    expect(textsOf(renderCard({ item: baseClub }))).not.toContain('Judo');
    expect(textsOf(renderCard({
      item: { ...baseClub, activites: [{ name: 'Judo' }, { name: 'Karaté' }] },
    }))).toContain('Judo');
  });

  it('bandeau stats seulement quand des compteurs existent', () => {
    expect(textsOf(renderCard({ item: baseClub }))).not.toContain('Membres');

    const texts = textsOf(renderCard({
      item: {
        ...baseClub,
        membersCount: 120,
        recruitmentAds: [{ documentId: 'ad-1' }],
        teamsCount: 6,
      },
    }));
    expect(texts).toContain('Équipes');
    expect(texts).toContain('120');
    expect(texts).toContain('Annonces');
  });

  it('pas de marquee sponsors dans ce contexte, même avec des sponsors', () => {
    const tree = renderCard({
      item: { ...baseClub, sponsor: [{ documentId: 'sp-1', name: 'Sponsor A' }] },
    });
    expect(textsOf(tree)).not.toContain('Sponsor A');
  });

  it('toute la carte est cliquable, sans bouton dédié', () => {
    const onPress = jest.fn();
    const tree = renderCard({ item: baseClub, onPress });
    const touchable = tree.root.findAll((node) => typeof node.props?.onPress === 'function')[0];
    act(() => { touchable.props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('formatOnboardingDistance', () => {
  it('arrondit au mètre en dessous du kilomètre', () => {
    expect(formatOnboardingDistance(0.42)).toBe('à 400 m');
    expect(formatOnboardingDistance(0.01)).toBe('à 50 m');
  });

  it('garde une décimale sous 10 km, arrondit au-dessus', () => {
    expect(formatOnboardingDistance(2.44)).toBe('à 2,4 km');
    expect(formatOnboardingDistance(12.6)).toBe('à 13 km');
  });

  it('rend une chaîne vide pour une distance inconnue', () => {
    expect(formatOnboardingDistance(null)).toBe('');
    expect(formatOnboardingDistance(undefined)).toBe('');
    expect(formatOnboardingDistance(-3)).toBe('');
  });
});
