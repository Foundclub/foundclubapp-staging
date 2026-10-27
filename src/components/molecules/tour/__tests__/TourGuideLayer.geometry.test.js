import { computeBlockers, placeBubble } from '../tourGuideGeometry';

// TUTOE (27/10) — règle 4 du pack tutoriels : « un geste à la fois ». Les
// bloqueurs couvrent tout l'écran SAUF les découpes ; la bulle se place sans
// cacher la cible (04_COUCHE_VISUELLE §2).

const W = 390;
const H = 844;

/**
 * Vrai si le point est couvert par au moins un bloqueur.
 * @param {Array<{ height: number; width: number; x: number; y: number }>} blockers - Bloqueurs.
 * @param {number} x - Abscisse.
 * @param {number} y - Ordonnée.
 * @returns {boolean} Couvert ?
 */
const isBlocked = (blockers, x, y) => blockers.some((b) => (
  x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height
));

describe('computeBlockers', () => {
  it('sans découpe, tout l’écran est bloqué', () => {
    expect(computeBlockers([], W, H)).toEqual([{
      height: H, width: W, x: 0, y: 0,
    }]);
  });

  it('une découpe laisse passer ses touches et bloque tout autour', () => {
    const cutout = {
      height: 60, width: 200, x: 100, y: 300,
    };
    const blockers = computeBlockers([cutout], W, H);
    expect(isBlocked(blockers, 150, 330)).toBe(false);
    [[50, 330], [350, 330], [150, 200], [150, 500], [5, 5], [385, 840]]
      .forEach(([x, y]) => expect(isBlocked(blockers, x, y)).toBe(true));
  });

  it('deux découpes (champ + Suivant) restent toutes les deux actives', () => {
    const field = {
      height: 300, width: 360, x: 15, y: 150,
    };
    const next = {
      height: 56, width: 360, x: 15, y: 740,
    };
    const blockers = computeBlockers([field, next], W, H);
    expect(isBlocked(blockers, 200, 300)).toBe(false);
    expect(isBlocked(blockers, 200, 760)).toBe(false);
    expect(isBlocked(blockers, 200, 600)).toBe(true);
    expect(isBlocked(blockers, 5, 300)).toBe(true);
  });
});

describe('placeBubble', () => {
  it('« en haut » : sous l’encoche, pleine largeur moins 28, sans flèche', () => {
    expect(placeBubble({
      bubbleHeight: 100,
      height: H,
      insetTop: 47,
      primary: {
        height: 56, width: 360, x: 15, y: 740,
      },
      top: true,
      width: W,
    })).toEqual({
      arrow: 'none', arrowX: 0, left: 14, top: 51, width: 362,
    });
  });

  it('une cible en bas (onglet du dock) : bulle au-dessus, flèche vers le bas', () => {
    const primary = {
      height: 60, width: 80, x: 155, y: 760,
    };
    const position = placeBubble({
      bubbleHeight: 100, height: H, insetTop: 47, primary, top: false, width: W,
    });
    expect(position.arrow).toBe('down');
    expect(position.top + 100).toBeLessThanOrEqual(primary.y);
    expect(position.width).toBe(304);
  });

  it('une cible en haut : bulle en dessous, flèche vers le haut', () => {
    const primary = {
      height: 44, width: 44, x: 330, y: 60,
    };
    const position = placeBubble({
      bubbleHeight: 100, height: H, insetTop: 47, primary, top: false, width: W,
    });
    expect(position.arrow).toBe('up');
    expect(position.top).toBeGreaterThanOrEqual(primary.y + primary.height);
    expect(position.left + position.width).toBeLessThanOrEqual(W - 14);
  });
});

// TUTOE-CALIBRAGE (27/10) — émulateur, M3 sur l'accueil : la hauteur mesurée de
// la bulle oscillait 103,2 ↔ 103,6 pt selon l'arrondi au pixel de sa position,
// qui dépend de sa hauteur : boucle de rendus sans fin (2 347 lignes de journal,
// interface jamais au repos). Une variation de moins d'un point est ignorée.
describe('stableHeight', () => {
  it('ignore une variation de moins d’un point, garde une vraie variation', () => {
    // eslint-disable-next-line global-require
    const { stableHeight } = require('../tourGuideGeometry');
    expect(stableHeight(103.2, 103.6)).toBe(103.2);
    expect(stableHeight(103.6, 103.2)).toBe(103.6);
    expect(stableHeight(103.2, 130)).toBe(130);
  });
});
