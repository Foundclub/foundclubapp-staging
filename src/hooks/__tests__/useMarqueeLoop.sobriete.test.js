import { AccessibilityInfo, Animated } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText, { getActiveMarqueeCount } from '@/components/atoms/marqueeText/MarqueeText';

import { MAX_CONCURRENT_MARQUEES } from '../useMarqueeLoop';

// MARQUEE (27/08) — LA SOBRIÉTÉ, quand le défilement n'est plus sur UNE carte.
//
// Adel a tranché : le nom défile EN BOUCLE, sans fin, tant qu'il est visible.
// Ce choix ne rend pas les garde-fous optionnels, il les rend OBLIGATOIRES —
// une animation qui ne s'arrête jamais tourne en permanence sur chaque nom long
// affiché.
//
// CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE CE FICHIER : le registre des boucles
// SAVAIT compter, mais rien ne le bornait, et AUCUN appelant ne passait
// `paused` (ni ClubCard, ni la liste qui la rend). Une liste pleine de 15 noms
// longs = 15 boucles simultanées, à l'infini.
//
// Les trois garde-fous prouvés ici :
//   D4 — un PLAFOND, et une place rendue profite à la carte suivante ;
//   D5 — « réduire les animations » coupe le défilement et rend la troncature ;
//   §7.3 — la boucle marque une pause entre deux passages (elle reste une boucle).

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

const NOM_FLEUVE = 'Association Sportive et Culturelle de Villeneuve-sur-Lot Football';

/**
 * Monte un texte défilant et joue les DEUX mesures de largeur.
 * @param {{ debordant?: boolean }} [options] - Faux pour un nom qui tient.
 * @returns {any} - Arbre rendu.
 */
const monterUnNom = ({ debordant = true } = {}) => {
  let tree;
  act(() => {
    tree = renderer.create(<MarqueeText text={NOM_FLEUVE} />);
  });
  const enveloppe = tree.root.find(
    (/** @type {any} */ n) => n.type === 'View' && typeof n.props?.onLayout === 'function',
  );
  const sonde = tree.root.find(
    (/** @type {any} */ n) => n.type === 'Text' && typeof n.props?.onLayout === 'function',
  );
  act(() => {
    enveloppe.props.onLayout({ nativeEvent: { layout: { width: 200 } } });
    sonde.props.onLayout({ nativeEvent: { layout: { width: debordant ? 480 : 140 } } });
  });
  return tree;
};

/**
 * Lignes rendues avec la troncature « … » d'origine.
 * @param {any} tree - Arbre rendu.
 * @returns {any[]} - Noeuds Text repliés.
 */
const lignesTronquees = (tree) => tree.root.findAll(
  (/** @type {any} */ n) => n.type === 'Text' && n.props?.ellipsizeMode === 'tail',
);

describe('MARQUEE D4 — le plafond de boucles simultanées', () => {
  it('le plafond est un nombre NOMMÉ, pas un effet de bord', () => {
    expect(MAX_CONCURRENT_MARQUEES).toBe(6);
  });

  it('une liste PLEINE de 15 noms longs ne fait pas tourner 15 boucles', () => {
    const trees = Array.from({ length: 15 }, () => monterUnNom());

    // AVANT ce lot, ce nombre valait 15 : un par carte montée, sans borne.
    expect(getActiveMarqueeCount()).toBe(MAX_CONCURRENT_MARQUEES);
    expect(getActiveMarqueeCount()).toBeLessThan(trees.length);

    act(() => { trees.forEach((tree) => tree.unmount()); });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('les cartes AU-DELÀ du plafond retombent sur la troncature « … »', () => {
    const trees = Array.from({ length: 15 }, () => monterUnNom());

    // Ce qui compte pour l'utilisateur : une carte qui n'a pas eu de place ne
    // reste pas coupée net au bord — elle rend EXACTEMENT ce qu'elle rendait
    // avant le défilement.
    const repliees = trees.filter((tree) => lignesTronquees(tree).length > 0);
    expect(repliees).toHaveLength(trees.length - MAX_CONCURRENT_MARQUEES);

    act(() => { trees.forEach((tree) => tree.unmount()); });
  });

  it('une carte qui rend sa place la LIBÈRE pour une autre (défilement de liste)', () => {
    const trees = Array.from({ length: 8 }, () => monterUnNom());
    expect(getActiveMarqueeCount()).toBe(MAX_CONCURRENT_MARQUEES);

    // La première carte sort de l'écran : sa place ne doit pas rester morte,
    // sinon les cartes du bas ne défileraient plus jamais.
    act(() => { trees[0].unmount(); });
    expect(getActiveMarqueeCount()).toBe(MAX_CONCURRENT_MARQUEES);

    act(() => { trees.slice(1).forEach((tree) => tree.unmount()); });
    expect(getActiveMarqueeCount()).toBe(0);
  });

  it('un nom qui TIENT ne consomme aucune place du plafond', () => {
    const courts = Array.from({ length: 10 }, () => monterUnNom({ debordant: false }));
    expect(getActiveMarqueeCount()).toBe(0);

    const long = monterUnNom();
    expect(getActiveMarqueeCount()).toBe(1);

    act(() => { [...courts, long].forEach((tree) => tree.unmount()); });
  });
});

describe('MARQUEE D5 — « réduire les animations » est respecté', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('système réglé sur moins de mouvement : rien ne défile, « … » reprend', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const tree = monterUnNom();
    // Le réglage arrive de façon asynchrone : on laisse la promesse retomber.
    await act(async () => {});

    expect(getActiveMarqueeCount()).toBe(0);
    expect(lignesTronquees(tree).length).toBeGreaterThan(0);

    act(() => { tree.unmount(); });
  });

  it('témoin positif : sans ce réglage, le même nom défile', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const tree = monterUnNom();
    await act(async () => {});

    expect(getActiveMarqueeCount()).toBe(1);

    act(() => { tree.unmount(); });
  });
});

describe('MARQUEE §7.3 — une boucle, avec une respiration entre deux passages', () => {
  it('le nom marque une pause avant de repartir, et RESTE une boucle', () => {
    const espionBoucle = jest.spyOn(Animated, 'loop');
    const espionTiming = jest.spyOn(Animated, 'timing');

    const tree = monterUnNom();

    // Une boucle, jamais un passage unique (décision d'Adel du 27/08).
    expect(espionBoucle).toHaveBeenCalled();
    expect(espionTiming).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ delay: expect.any(Number), useNativeDriver: true }),
    );
    const [, reglages] = espionTiming.mock.calls[espionTiming.mock.calls.length - 1];
    expect(reglages.delay).toBeGreaterThan(0);

    espionBoucle.mockRestore();
    espionTiming.mockRestore();
    act(() => { tree.unmount(); });
  });
});
