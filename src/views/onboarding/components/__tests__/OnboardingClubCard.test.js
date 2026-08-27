import { Children } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SponsorMarquee, {
  getActiveMarqueeCount,
} from '@/components/molecules/sponsorMarquee/SponsorMarquee';

import { formatClubDistanceLabel } from '@/utils/location';

import OnboardingClubCard from '../OnboardingClubCard';

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

  // D56 — ce cas disait « pas de marquee sponsors, même avec des sponsors »,
  // et mesurait l'absence du NOM. Le pack d'inscription du 05/08 tranche
  // l'inverse sur le fond : « ⚠️ SPONSORS — à ne pas oublier : ajoute le
  // sponsor du club sur les cartes club des écrans Trouve ton club (3
  // parcours) et Quel ancien club ? — les maquettes ne le montrent pas, mais
  // il doit y figurer ». Ce qui reste vrai, et que les deux cas ci-dessous
  // séparent enfin : le sponsor s'affiche, mais SANS la ligne défilante.
  it('affiche le sponsor du club — logo et nom', () => {
    const tree = renderCard({
      item: {
        ...baseClub,
        sponsor: [{ documentId: 'sp-1', logo: { url: 'https://cdn/sp.png' }, name: 'Sponsor A' }],
      },
    });
    expect(textsOf(tree)).toContain('Sponsor A');
  });

  it('sans sponsor, aucune rangée sponsor', () => {
    expect(textsOf(renderCard({ item: baseClub }))).not.toContain('Sponsor A');
  });

  it('⛔ mais JAMAIS le marquee : la carte compacte ne fait rien défiler', () => {
    const tree = renderCard({
      item: { ...baseClub, sponsor: [{ documentId: 'sp-1', name: 'Sponsor A' }] },
    });
    expect(tree.root.findAllByType(SponsorMarquee)).toHaveLength(0);
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('toute la carte est cliquable, sans bouton dédié', () => {
    const onPress = jest.fn();
    const tree = renderCard({ item: baseClub, onPress });
    const touchable = tree.root.findAll((node) => typeof node.props?.onPress === 'function')[0];
    act(() => { touchable.props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// Le formateur vit désormais dans `@/utils/location`, partagé avec la carte de
// recherche (L23). Ces cas restent ici parce qu'ils décrivent ce que CETTE carte
// promet ; la preuve que les deux cartes tirent du même puits est dans
// `src/utils/clubDistanceLabel.test.js`.
describe('formatClubDistanceLabel — vu depuis la carte d\'inscription', () => {
  it('arrondit au mètre en dessous du kilomètre', () => {
    expect(formatClubDistanceLabel(0.42)).toBe('à 400 m');
    expect(formatClubDistanceLabel(0.01)).toBe('à 50 m');
  });

  it('garde une décimale sous 10 km, arrondit au-dessus', () => {
    expect(formatClubDistanceLabel(2.44)).toBe('à 2,4 km');
    expect(formatClubDistanceLabel(12.6)).toBe('à 13 km');
  });

  it('rend une chaîne vide pour une distance inconnue', () => {
    expect(formatClubDistanceLabel(null)).toBe('');
    expect(formatClubDistanceLabel(undefined)).toBe('');
    expect(formatClubDistanceLabel(-3)).toBe('');
  });
});

// R18 / D1 — l'enveloppe visuelle, motif déjà prouvé sur la carte de recherche
// (correction R07, build 2.6.1 (821) du 2026-08-01) et jamais recopié ici.
describe('OnboardingClubCard — enveloppe visuelle (R18)', () => {
  /**
   * Conteneurs qui découpent leur contenu aux coins arrondis.
   * @param {any} tree - Arbre rendu par react-test-renderer.
   * @returns {any[]} - Nœuds hôtes portant `overflow: 'hidden'`.
   */
  const clippedContainers = (tree) => tree.root.findAll((node) => (
    typeof node.type === 'string'
    && StyleSheet.flatten(node.props?.style)?.overflow === 'hidden'
  ));

  it('le dégradé est un FOND : il n\'enveloppe plus le contenu de la carte', () => {
    const tree = renderCard({ item: baseClub });
    const gradients = tree.root.findAllByType('LinearGradient');
    expect(gradients).toHaveLength(1);

    // LA ligne qui porte tout : un dégradé sans enfant ne se dimensionne plus
    // sur eux, il ne peut donc plus trancher la carte en plein milieu.
    expect(Children.count(gradients[0].props.children)).toBe(0);
    expect(StyleSheet.flatten(gradients[0].props.style)).toMatchObject({ position: 'absolute' });
    expect(gradients[0].props.pointerEvents).toBe('none');
  });

  it('un conteneur ordinaire porte la taille et découpe les coins arrondis', () => {
    const tree = renderCard({ item: baseClub });
    const clipped = clippedContainers(tree);

    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped[0].type).toBe('View');
    // La hauteur de la carte vient de ce conteneur, donc de ses enfants réels.
    expect(clipped[0].findAllByType('LinearGradient')).toHaveLength(1);
  });

  it('le contenu grandit dans le conteneur, pas dans le dégradé', () => {
    /**
     * Nombre de blocs rendus SOUS le conteneur qui porte la taille.
     * @param {any} item - Club à rendre.
     * @returns {number} - Vues descendantes du conteneur découpé.
     */
    const blocsDansLeConteneur = (item) => {
      const tree = renderCard({ item });
      return clippedContainers(tree)[0].findAllByType('View').length;
    };

    const maigre = blocsDansLeConteneur(baseClub);
    const garni = blocsDansLeConteneur({
      ...baseClub,
      activites: [{ name: 'Judo' }, { name: 'Karaté' }],
      membersCount: 120,
      teamsCount: 6,
    });

    // Les blocs en plus atterrissent DANS le conteneur qui porte la taille ; le
    // dégradé, lui, reste vide (vérifié par le premier test de ce bloc). C'est
    // ce qui fait que la hauteur de la carte suit son contenu.
    expect(garni).toBeGreaterThan(maigre);
  });
});

// MARQUEE (27/08) — « trouver mon club » coupait encore les noms longs à « … ».
// Cause : cette carte est la JUMELLE de ClubCard et n'avait jamais été reliée à
// la mécanique partagée par U01.
//
// ⚠️ Le cas « ⛔ mais JAMAIS le marquee » plus haut reste vrai et n'est pas
// contredit : il parle du PIED SPONSORS, qui ne défile toujours pas dans la
// carte compacte. Ce bloc-ci parle du NOM DU CLUB, qui lui doit défiler.
describe('OnboardingClubCard — MARQUEE : un nom trop long DÉFILE', () => {
  const NOM_FLEUVE = 'Association Sportive et Culturelle de Villeneuve-sur-Lot Football';

  /**
   * Joue les DEUX mesures que le moteur de mise en page ne fait pas en test.
   * @param {any} tree - Arbre rendu.
   * @param {{ largeurTexte: number, largeurVisible: number }} mesures - Largeurs simulées.
   * @returns {void}
   */
  const mesurerLeNom = (tree, { largeurTexte, largeurVisible }) => {
    const marquee = tree.root.findByType(MarqueeText);
    const mesurable = (/** @type {string} */ type) => (/** @type {any} */ node) => (
      node.type === type && typeof node.props?.onLayout === 'function'
    );
    const enveloppe = marquee.find(mesurable('View'));
    const sonde = marquee.find(mesurable('Text'));
    act(() => {
      enveloppe.props.onLayout({ nativeEvent: { layout: { width: largeurVisible } } });
      sonde.props.onLayout({ nativeEvent: { layout: { width: largeurTexte } } });
    });
  };

  it('le nom passe par la mécanique PARTAGÉE, jamais par une seconde', () => {
    const tree = renderCard({ item: baseClub });
    const marquees = tree.root.findAllByType(MarqueeText);

    expect(marquees).toHaveLength(1);
    expect(marquees[0].props.text).toBe('FC Marseille Nord');
    act(() => { tree.unmount(); });
  });

  it('nom trop long pour la carte : il défile, et il est rendu EN ENTIER', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    expect(getActiveMarqueeCount()).toBe(0);

    mesurerLeNom(tree, { largeurTexte: 480, largeurVisible: 210 });

    expect(getActiveMarqueeCount()).toBe(1);
    expect(textsOf(tree)).toContain(NOM_FLEUVE);
    act(() => { tree.unmount(); });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('nom qui tient dans la carte : strictement immobile (D6)', () => {
    const tree = renderCard({ item: baseClub });
    mesurerLeNom(tree, { largeurTexte: 140, largeurVisible: 210 });

    expect(getActiveMarqueeCount()).toBe(0);
    act(() => { tree.unmount(); });
  });

  it('sans mesure : la carte retombe sur la troncature « … » d\'avant', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    const tronquees = tree.root.findAll(
      (/** @type {any} */ node) => node.type === 'Text' && node.props?.ellipsizeMode === 'tail',
    );

    expect(tronquees.length).toBeGreaterThan(0);
    expect(getActiveMarqueeCount()).toBe(0);
    act(() => { tree.unmount(); });
  });

  it('liste recyclée : le nouveau nom ne prend PAS la mesure du précédent', () => {
    const tree = renderCard({ item: { ...baseClub, name: NOM_FLEUVE } });
    mesurerLeNom(tree, { largeurTexte: 480, largeurVisible: 210 });
    expect(getActiveMarqueeCount()).toBe(1);

    // La même carte est recyclée pour un club au nom court : la largeur de
    // l'ancien nom ne doit surtout pas s'appliquer au nouveau.
    act(() => {
      tree.update(<OnboardingClubCard item={{ ...baseClub, name: 'FC Lyon' }} />);
    });

    expect(getActiveMarqueeCount()).toBe(0);
    act(() => { tree.unmount(); });
  });
});
