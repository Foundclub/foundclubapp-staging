import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText, { getActiveMarqueeCount } from '@/components/atoms/marqueeText/MarqueeText';

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

// MARQUEE (27/08) — « ça doit être PARTOUT ». Cette rangée est la SECONDE carte
// de club de l'app (celle servie aux wizards) : elle coupait encore les noms
// longs alors que la carte de recherche, elle, les faisait défiler depuis U01.
describe('ClubSearchResultCard — MARQUEE : le nom du club défile', () => {
  const NOM_FLEUVE = 'Association Sportive et Culturelle de Villeneuve-sur-Lot Football';

  it('le nom passe par la mécanique partagée, et par elle seule', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    const marquees = tree.root.findAllByType(MarqueeText);

    expect(marquees).toHaveLength(1);
    expect(marquees[0].props.text).toBe(NOM_FLEUVE);
    act(() => { tree.unmount(); });
  });

  it('la PLACE reste à l\'enveloppe : la colonne du nom ne s\'effondre pas', () => {
    const tree = renderCard({ item: baseClub });
    const marquee = tree.root.findByType(MarqueeText);

    // Le `flex: 1` de l'ancien <Text> doit habiller l'enveloppe, pas la copie
    // intérieure — sinon le nom cesse de pousser le badge vers la droite.
    expect(StyleSheet.flatten(marquee.props.containerStyle)).toMatchObject({ flex: 1 });
    act(() => { tree.unmount(); });
  });

  it('sans mesure de largeur, la carte rend la troncature « … » d\'avant', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    const tronquees = tree.root.findAll(
      (node) => node.type === 'Text' && node.props?.ellipsizeMode === 'tail',
    );

    expect(tronquees.length).toBeGreaterThan(0);
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => { tree.unmount(); });
  });
});
