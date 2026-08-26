import { Children } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText, { getActiveMarqueeCount } from '@/components/atoms/marqueeText/MarqueeText';
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

// L23 — la distance INCONNUE. `Number(null)` vaut 0, pas NaN : sans garde, le
// 0 franchissait les contrôles et `Math.max(50, 0)` collait « à 50 m » sur
// TOUTES les cartes dès que la recherche ne pouvait pas calculer de distance.
// Le serveur envoie bien `null` dans ce cas (admin `search.ts:439`).
describe('ClubCard — distance inconnue', () => {
  it.each([
    ['nulle', null],
    ['absente', undefined],
    ['chaîne vide', ''],
  ])('distance %s : aucun libellé de distance', (_libelle, distanceKm) => {
    const texts = textsOf(renderCard({ item: { ...baseClub, __search: { distanceKm } } }));
    expect(texts).toContain('13008 Marseille');
    expect(texts).not.toMatch(/à \d/);
  });

  it('TÉMOIN POSITIF : une vraie distance s\'affiche toujours', () => {
    expect(textsOf(renderCard({ item: { ...baseClub, __search: { distanceKm: 2.4 } } })))
      .toContain('à 2,4 km');
    expect(textsOf(renderCard({ item: { ...baseClub, __search: { distanceKm: 0.3 } } })))
      .toContain('à 300 m');
  });
});

// R07 gelé : cette carte a DÉJÀ été corrigée une fois. Le test existe pour que
// la correction ne reparte pas au prochain redesign (§ L23 : les deux cartes
// ont divergé dans les deux sens, faute d'invariant écrit).
describe('ClubCard — enveloppe visuelle (R07 gelé)', () => {
  it('le dégradé est un FOND, jamais le conteneur', () => {
    const tree = renderCard({ item: baseClub });
    const gradients = tree.root.findAllByType('LinearGradient');
    expect(gradients).toHaveLength(1);

    expect(Children.count(gradients[0].props.children)).toBe(0);
    expect(StyleSheet.flatten(gradients[0].props.style)).toMatchObject({ position: 'absolute' });
    expect(gradients[0].props.pointerEvents).toBe('none');
  });

  it('un conteneur ordinaire porte la taille et découpe les coins arrondis', () => {
    const clipped = renderCard({ item: baseClub }).root.findAll((node) => (
      typeof node.type === 'string'
      && StyleSheet.flatten(node.props?.style)?.overflow === 'hidden'
    ));
    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped[0].type).toBe('View');
  });
});

// U01 — LE DÉFAUT VU PAR ADEL LE 26/08 : « quand un nom de club est trop long
// on doit cliquer pour le voir en entier ». Le nom était rendu avec
// `numberOfLines={1}` + `ellipsizeMode="tail"` : la carte le coupait par « … »
// et le nom complet n'existait plus qu'au fond de la fiche.
//
// La correction ne fabrique PAS une animation de plus : elle réutilise la
// mécanique du pied sponsors, déjà présente dans cette même carte (registre des
// boucles compris). Ces témoins gèlent les deux bords du comportement.
describe('ClubCard — U01 : un nom trop long DÉFILE', () => {
  const mesurerLeNom = (tree, { largeurTexte, largeurVisible }) => {
    const marquee = tree.root.findByType(MarqueeText);
    const enveloppe = marquee.find(
      (node) => node.type === 'View' && typeof node.props?.onLayout === 'function',
    );
    const sonde = marquee.find(
      (node) => node.type === 'Text' && typeof node.props?.onLayout === 'function',
    );
    act(() => {
      enveloppe.props.onLayout({ nativeEvent: { layout: { width: largeurVisible } } });
      sonde.props.onLayout({ nativeEvent: { layout: { width: largeurTexte } } });
    });
  };

  const NOM_FLEUVE = 'Association Sportive et Culturelle de Villeneuve-sur-Lot Football';

  it('le nom passe par la mécanique PARTAGÉE, jamais par une seconde', () => {
    const tree = renderCard({ item: baseClub });
    const marquees = tree.root.findAllByType(MarqueeText);

    expect(marquees).toHaveLength(1);
    expect(marquees[0].props.text).toBe('FC Marseille Nord');
    act(() => {
      tree.unmount();
    });
  });

  it('nom trop long pour la carte : il défile', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    expect(getActiveMarqueeCount()).toBe(0);

    mesurerLeNom(tree, { largeurTexte: 480, largeurVisible: 210 });

    expect(getActiveMarqueeCount()).toBe(1);
    expect(textsOf(tree)).toContain(NOM_FLEUVE);
    act(() => {
      tree.unmount();
    });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('nom qui tient dans la carte : strictement immobile', () => {
    const tree = renderCard({ item: baseClub });
    mesurerLeNom(tree, { largeurTexte: 140, largeurVisible: 210 });

    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });

  it('D5 — sans mesure de largeur : la carte retombe sur la troncature « … »', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    const tronquees = tree.root.findAll(
      (node) => node.type === 'Text' && node.props?.ellipsizeMode === 'tail',
    );

    expect(tronquees).toHaveLength(1);
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => {
      tree.unmount();
    });
  });

  it('D4 — le nom COMPLET reste porté par le libellé d\'accessibilité de la carte', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    const carte = tree.root.findAllByType(TouchableOpacity)[0];

    expect(carte.props.accessibilityLabel).toBe(`${NOM_FLEUVE}, 13008 Marseille`);
    mesurerLeNom(tree, { largeurTexte: 480, largeurVisible: 210 });
    expect(carte.props.accessibilityLabel).toBe(`${NOM_FLEUVE}, 13008 Marseille`);

    act(() => {
      tree.unmount();
    });
  });
});
