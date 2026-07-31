import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubSearchResultCard from '../ClubSearchResultCard';

// Filet L03 (E6) : la rangée club de la recherche n'avait AUCUN test.
// Caractérise les DONNÉES affichées et la commande onPress. La refonte 5a
// remplace cette rangée dans ClubListContent par une nouvelle carte, mais ce
// composant reste servi tel quel aux wizards (EventWizardInvites,
// HistoryWizard*) : ce test protège ces écrans-là.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
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
    tree = renderer.create(<ClubSearchResultCard {...props} />);
  });
  return tree;
};

const baseClub = {
  _type: 'club',
  addressDetails: '12 rue du Sport, 13008 Marseille',
  documentId: 'club-1',
  name: 'FC Marseille Nord',
};

describe('ClubSearchResultCard — données affichées (caractérisation)', () => {
  it('affiche le nom du club et son adresse courte', () => {
    const tree = renderCard({ item: baseClub });
    const texts = collectTexts(tree.toJSON()).join('\n');
    expect(texts).toContain('FC Marseille Nord');
    expect(texts).toContain('13008 Marseille');
  });

  it('affiche le badge OMNISPORT pour un club multisport', () => {
    const tree = renderCard({
      item: { ...baseClub, _type: 'multisport', sectionsCount: 3 },
    });
    const texts = collectTexts(tree.toJSON()).join('\n');
    expect(texts).toContain('OMNISPORT');
    expect(texts).toContain('3 sections');
  });

  it('rend le footer fourni par le parent', () => {
    const footer = <Text>pied-sponsors-test</Text>;
    const tree = renderCard({ footer, item: baseClub });
    expect(collectTexts(tree.toJSON()).join('\n')).toContain('pied-sponsors-test');
  });

  it('appuie sur la carte -> onPress', () => {
    const onPress = jest.fn();
    const tree = renderCard({ item: baseClub, onPress });
    const pressable = tree.root.findAll(
      (node) => typeof node.props?.onPress === 'function',
    )[0];
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalled();
  });
});
