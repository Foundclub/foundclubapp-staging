/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors } from '@/theme/colors';

import HomeHeadBanner from '../HomeHeadBanner';

// 🕒 MARQUE-MAIRIE (14/10/2026) — COL-003, « D3- B » puis « 3- ok go » d'Adel : le bandeau de
// l'accueil nomme le prochain événement ; s'il attend la mairie, il le DIT (« En attente de la
// mairie »), au ton orange de la grille du planning (COLL-R-A4). Le serveur pose `pendingDecider`
// sur `prochainEvenement` / `prochaineSeance` (admin MARQUE-MAIRIE) ; l'accueil passe la phrase au
// bandeau (`notice`, variante « événement » ; `line.notice`, variante « liste » du dirigeant).
//
// ROUGE avant le lot : le bandeau n'avait aucune place pour cette phrase.

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: vraiesCouleurs,
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (/** @type {any} */ _t, /** @type {any} */ k) => `image-${String(k)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <RNText onPress={onPress}>{title}</RNText>,
  };
});

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    arbre = renderer.create(<HomeHeadBanner {...props} />);
  });
  montes.push(arbre);
  return arbre;
};
const phrase = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.type === Text && n.props.testID === 'bandeau-seance-en-attente');

afterEach(async () => {
  await act(async () => {
    while (montes.length) montes.pop().unmount();
  });
});

describe('MARQUE-MAIRIE — le bandeau de l accueil dit que le prochain événement attend', () => {
  it('variante « événement » (joueur, entraîneur) : la phrase sous l échéance, au ton orange de la grille', async () => {
    const arbre = await monter({
      label: 'Ma semaine',
      notice: 'En attente de la mairie',
      subtitle: 'Entrainement · U13',
      title: 'Samedi 15 · 15:00',
      variant: 'event',
    });
    const [ligne] = phrase(arbre);
    expect(ligne?.props.children).toBe('En attente de la mairie');
    expect(StyleSheet.flatten(ligne.props.style).color).toBe(colors.warning400);
  });

  it('variante « liste » (dirigeant) : la ligne du prochain événement porte la phrase', async () => {
    const arbre = await monter({
      label: 'Demain',
      lines: [
        {
          icon: 'bell', key: 'demandes', label: 'Demandes en attente', value: '2',
        },
        {
          icon: 'calendar', key: 'prochainEvenement', label: 'Entrainement · U13', notice: 'En attente de la mairie', value: 'sam. 15:00',
        },
      ],
      variant: 'list',
    });
    const lignes = phrase(arbre);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].props.children).toBe('En attente de la mairie');
  });

  it('sans phrase : le bandeau est celui d avant', async () => {
    const evenement = await monter({
      label: 'Ma semaine', subtitle: 'Entrainement · U13', title: 'Samedi 15 · 15:00', variant: 'event',
    });
    expect(phrase(evenement)).toHaveLength(0);
    const liste = await monter({
      label: 'Demain',
      lines: [{
        icon: 'calendar', key: 'prochainEvenement', label: 'Entrainement · U13', value: 'sam. 15:00',
      }],
      variant: 'list',
    });
    expect(phrase(liste)).toHaveLength(0);
  });
});
