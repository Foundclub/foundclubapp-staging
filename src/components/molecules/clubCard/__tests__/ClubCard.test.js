import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import ClubCard from '../ClubCard';

// Carte club 5a du handoff « Cartes Rechercher ». Preuves demandées par le
// brief L03 : le LOGO du club s'affiche quand l'URL existe (les initiales ne
// sont qu'un repli — sur staging aucun club n'a de logo, ce test force donc
// une URL en dur), et chaque bloc optionnel n'apparaît qu'avec sa donnée.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
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
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
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

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<ClubCard {...props} />);
  });
  return tree;
};

const textsOf = (tree) => collectTexts(tree.toJSON()).join('\n');

const baseClub = {
  _type: 'club',
  addressDetails: '12 rue du Sport, 13008 Marseille',
  documentId: 'club-1',
  name: 'FC Marseille Nord',
};

describe('ClubCard — en-tête et logo', () => {
  it('avec une URL de logo : affiche le LOGO (pas les initiales)', () => {
    const tree = renderCard({
      item: { ...baseClub, logo: { url: 'https://exemple.test/ecusson.png' } },
    });
    const avatars = tree.root.findAllByType(ProfileAvatar);
    expect(avatars).toHaveLength(1);
    expect(avatars[0].props.imageUrl).toBe('https://exemple.test/ecusson.png');
  });

  it('sans logo : repli sur les initiales du club', () => {
    const tree = renderCard({ item: baseClub });
    expect(tree.root.findAllByType(ProfileAvatar)).toHaveLength(0);
    // TeamShield rend les initiales calculées par getClubInitials.
    expect(textsOf(tree)).toMatch(/FMN|FM/);
  });

  it('affiche nom + adresse courte, et la distance quand la recherche la donne', () => {
    const tree = renderCard({
      item: { ...baseClub, __search: { distanceKm: 2.4 } },
    });
    const texts = textsOf(tree);
    expect(texts).toContain('FC Marseille Nord');
    expect(texts).toContain('13008 Marseille');
    expect(texts).toContain('à 2,4 km');
  });

  it('badge OMNISPORT + chip sections pour un club multisport', () => {
    const tree = renderCard({
      item: { ...baseClub, _type: 'multisport', sectionsCount: 3 },
    });
    const texts = textsOf(tree);
    expect(texts).toContain('OMNISPORT');
    expect(texts).toContain('3 sections');
  });
});

describe('ClubCard — blocs conditionnels (5a)', () => {
  it('badge RECRUTE seulement avec une annonce ouverte', () => {
    const without = renderCard({ item: baseClub });
    expect(textsOf(without)).not.toContain('RECRUTE');

    const withAds = renderCard({
      item: { ...baseClub, recruitmentAds: [{ documentId: 'ad-1' }] },
    });
    expect(textsOf(withAds)).toContain('RECRUTE');
  });

  it('bandeau stats seulement quand des compteurs existent, annonces en accent', () => {
    const without = renderCard({ item: baseClub });
    expect(textsOf(without)).not.toContain('Membres');

    const withStats = renderCard({
      item: {
        ...baseClub,
        membersCount: 120,
        recruitmentAds: [{ documentId: 'ad-1' }, { documentId: 'ad-2' }],
        teamsCount: 6,
      },
    });
    const texts = textsOf(withStats);
    expect(texts).toContain('Équipes');
    expect(texts).toContain('6');
    expect(texts).toContain('Membres');
    expect(texts).toContain('120');
    expect(texts).toContain('Annonces');
    expect(texts).toContain('2');
  });

  it('chips sections depuis les activités du club quand elles sont chargées', () => {
    const tree = renderCard({
      item: {
        ...baseClub,
        activites: [{ name: 'Football' }, { name: 'Basket' }],
      },
    });
    const texts = textsOf(tree);
    expect(texts).toContain('Football');
    expect(texts).toContain('Basket');
  });

  it('marquee sponsors présent avec sponsor, absent sinon', () => {
    const without = renderCard({ item: baseClub });
    expect(textsOf(without)).not.toContain('Boulangerie Paul');

    const withSponsor = renderCard({
      item: { ...baseClub, sponsor: [{ documentId: 'sp-1', logo: {}, title: 'Boulangerie Paul' }] },
    });
    expect(textsOf(withSponsor)).toContain('Boulangerie Paul');
  });

  it('appuie sur la carte -> onPress', () => {
    const onPress = jest.fn();
    const tree = renderCard({ item: baseClub, onPress });
    const pressable = tree.root.findAllByType(TouchableOpacity)[0];
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalled();
  });
});
