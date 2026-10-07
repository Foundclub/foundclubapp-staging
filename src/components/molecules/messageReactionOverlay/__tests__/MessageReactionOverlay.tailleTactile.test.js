import renderer, { act } from 'react-test-renderer';

import MessageReactionOverlay from '../MessageReactionOverlay';

// Doublures reprises de MessageReactionOverlay.sortieAccessible.test.js (meme calque).

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    // 🎨 AUCUN HEXADECIMAL ICI, et ce n est pas un detail de style : le contrat
    // de theme compte les couleurs ecrites en dur dans TOUT le depot, fichiers de
    // test compris. Six hex de doublure suffisaient a faire passer le compteur
    // de 12 a 13 et a faire rougir la porte. Des libelles font le meme travail :
    // ce banc ne regarde aucune couleur, il regarde des props d accessibilite.
    Colors: {
      error500: 'couleur-erreur',
      neutral00: 'couleur-texte',
      neutral600: 'couleur-bordure',
      neutral700: 'couleur-fond-bouton',
      neutral800: 'couleur-fond-panneau',
      primary700: 'couleur-selection',
      transparent: 'transparent',
    },
  }),
}));

const ANCRE = {
  height: 60, width: 220, x: 16, y: 300,
};

/**
 * Rend le calque et rend son arbre.
 * @param {() => void} [onClose] Ce qu'on veut observer a la fermeture.
 * @returns {any} L'arbre rendu.
 */
const rendre = (onClose = () => {}) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <MessageReactionOverlay
        anchor={ANCRE}
        canCopy
        canEdit
        isMine
        myEmoji=""
        onAction={() => {}}
        onClose={onClose}
        onSelect={() => {}}
        visible
      />,
    );
  });
  return arbre;
};

// MSG1A — LA TAILLE TACTILE DE LA PILULE, DES LA PREMIERE IMAGE.
//
// 🔴 Rouge trouve a la recolte 3a (porte du site, whatsapp2-menu.spec.ts:124) : les boutons de la
// pilule mesuraient 40,4 px au lieu de 44. Ils declarent bien 44, mais la pilule « poussait »
// (agrandissement anime de 0,6 a 1) et la mesure tombait pendant l'animation. Une cible tactile
// doit faire 44 des qu'elle est la : la pilule apparait en FONDU seul ; le menu garde son effet.

/**
 * Le style a plat d'un noeud.
 * @param {any} noeud
 * @returns {Record<string, any>}
 */
const aPlat = (noeud) => [noeud.props.style].flat(Infinity)
  .reduce((acc, s) => ({ ...acc, ...(s || {}) }), {});

describe('MSG1A — la pilule de l appui long, a la taille tactile', () => {
  it('TT1 — la pilule ne s agrandit pas a l apparition : seulement l opacite', () => {
    const arbre = rendre();
    const pilule = arbre.root.findAll((n) => n.props?.testID === 'WHATSAPP-pilule')[0];
    const style = aPlat(pilule);
    expect(style.transform).toBeUndefined();
  });

  it('TT2 — ses sept boutons mesurent 44 x 44', () => {
    const arbre = rendre();
    const pilule = arbre.root.findAll((n) => n.props?.testID === 'WHATSAPP-pilule')[0];
    const boutons = pilule.findAll((n) => n.props?.accessibilityRole === 'button'
      && typeof n.props?.onPress === 'function');
    const tailles = boutons.map((b) => aPlat(b)).filter((s) => s.height !== undefined);
    expect(tailles.length).toBeGreaterThanOrEqual(7);
    tailles.forEach((s) => {
      expect(s.height).toBeGreaterThanOrEqual(44);
      expect(s.width).toBeGreaterThanOrEqual(44);
    });
  });
});
