import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// MSGLIVE — LA BULLE À TROIS POINTS, ET SON GARDE-FOU D'ACCESSIBILITÉ.
//
// L'écran est mesuré ailleurs (`ConversationMSGLIVE.frappe.test.js` prouve que
// l'événement serveur fait bien apparaître la bulle). Ce fichier-ci ne mesure
// qu'une chose, mais c'est celle qu'on oublie toujours :
//
// ♿ QUAND LE SYSTÈME DEMANDE « RÉDUIRE LES ANIMATIONS », LES POINTS S'ARRÊTENT
//    — ET LA PHRASE, ELLE, NE BOUGE PAS D'UN PIXEL.
//
// C'est le contrat : l'animation est un SECOND signal, jamais le seul. Quelqu'un
// qui a coupé les animations, ou qui écoute son écran au lecteur vocal, doit
// lire exactement la même information que les autres. Sans ce témoin, une
// future « optimisation » qui remplacerait le texte par les seuls points
// passerait sans que rien ne rougisse.

let mockReduireLesAnimations = false;

// Une variable préfixée `mock` est la SEULE que Jest autorise dans une fabrique
// de doublure : elles sont hissées avant tout le fichier, et toute autre
// variable serait encore indéfinie au moment où la fabrique s'exécute.
jest.mock('@/hooks/useReduceMotion', () => ({
  __esModule: true,
  default: () => mockReduireLesAnimations,
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments, Colors, Fonts: generateFonts(Colors), Spaces,
    }),
  };
});

/**
 * Monte la bulle.
 * @param {string} phrase - La phrase déjà traduite.
 * @returns {any} L'arbre monté.
 */
const monterBulle = (phrase) => {
  // eslint-disable-next-line global-require
  const TypingIndicator = require('../TypingIndicator').default;
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(TypingIndicator, { label: phrase }));
  });
  return /** @type {any} */ (arbre);
};

/**
 * Les nœuds natifs portant un testID.
 * @param {any} arbre - L'arbre monté.
 * @param {string} testID - L'identifiant cherché.
 * @returns {any[]} Les nœuds.
 */
const noeuds = (arbre, testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID && typeof noeud.type === 'string',
  { deep: true },
);

describe('MSGLIVE — la bulle « untel écrit »', () => {
  beforeEach(() => { mockReduireLesAnimations = false; });

  it('1. TROIS POINTS, ET LA PHRASE', () => {
    const arbre = monterBulle('Marc Durand écrit…');

    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);
    expect(noeuds(arbre, 'conversation-typing-dot')).toHaveLength(3);
    expect(JSON.stringify(arbre.toJSON())).toContain('Marc Durand écrit…');
  });

  it('2. ♿ ANIMATIONS RÉDUITES : les points se figent, la phrase RESTE', () => {
    mockReduireLesAnimations = true;
    const arbre = monterBulle('Marc Durand écrit…');

    // La bulle est toujours là, avec ses trois points — ils ne bougent plus,
    // mais ils ne disparaissent pas : la forme reste reconnaissable.
    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(1);
    expect(noeuds(arbre, 'conversation-typing-dot')).toHaveLength(3);
    // 🎯 L'ESSENTIEL : l'information est intacte, en toutes lettres.
    expect(JSON.stringify(arbre.toJSON())).toContain('Marc Durand écrit…');
  });

  it('3. LE LECTEUR D\'ÉCRAN ENTEND LA PHRASE, PAS TROIS CASES VIDES', () => {
    const arbre = monterBulle('Marc Durand écrit…');

    const bulle = noeuds(arbre, 'conversation-typing-indicator')[0];
    expect(bulle.props.accessibilityLabel).toBe('Marc Durand écrit…');
    // Les points sont masqués : ils ne racontent rien de plus que la phrase.
    const pointsMasques = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityElementsHidden === true,
      { deep: true },
    );
    expect(pointsMasques.length).toBeGreaterThan(0);
  });

  it('4. SANS PHRASE, PAS DE BULLE — on n\'affiche jamais des points tout seuls', () => {
    const arbre = monterBulle('');

    expect(noeuds(arbre, 'conversation-typing-indicator')).toHaveLength(0);
  });
  it('5. ♿ ET L\'ANIMATION S\'ARRÊTE VRAIMENT — pas seulement à l\'œil', () => {
    // ⚠️ SANS CE TÉMOIN, LE N°4 NE PROUVE RIEN DU MOUVEMENT : il vérifie que
    // le texte et les points restent, ce qui serait vrai même si les boucles
    // tournaient toujours. On compte donc les boucles RÉELLEMENT lancées.
    // eslint-disable-next-line global-require
    const { Animated } = require('react-native');
    const boucles = jest.spyOn(Animated, 'loop');

    try {
      boucles.mockClear();
      mockReduireLesAnimations = false;
      monterBulle('Marc Durand écrit…');
      // Une boucle par point : c'est le décalage entre les trois qui fait la vague.
      expect(boucles).toHaveBeenCalledTimes(3);

      boucles.mockClear();
      mockReduireLesAnimations = true;
      monterBulle('Marc Durand écrit…');
      // Le système a demandé moins de mouvement : AUCUNE boucle ne démarre.
      expect(boucles).not.toHaveBeenCalled();
    } finally {
      boucles.mockRestore();
    }
  });
});
