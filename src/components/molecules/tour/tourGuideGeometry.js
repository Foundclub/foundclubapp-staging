/**
 * Géométrie pure de la couche du guide (TUTOE) : découpes, bloqueurs de
 * touches, placement de la bulle. Sans React, testable seule.
 */

const CUTOUT_MARGIN = 6;
const BUBBLE_WIDTH = 304;
const BUBBLE_GAP = 14;

/**
 * Découpe d'une cible : marge de 6, bornée à 2 du bord de l'écran.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @param {number} screenWidth - Largeur de l'écran.
 * @param {number} screenHeight - Hauteur de l'écran.
 * @returns {{ height: number; width: number; x: number; y: number }} Découpe.
 */
export const toCutout = (rect, screenWidth, screenHeight) => {
  const x = Math.max(2, rect.x - CUTOUT_MARGIN);
  const y = Math.max(2, rect.y - CUTOUT_MARGIN);
  return {
    height: Math.min(screenHeight - 2, rect.y + rect.height + CUTOUT_MARGIN) - y,
    width: Math.min(screenWidth - 2, rect.x + rect.width + CUTOUT_MARGIN) - x,
    x,
    y,
  };
};

/**
 * Rectangles qui couvrent l'écran SAUF les découpes : ils absorbent les
 * touches hors cible (règle 4 « un geste à la fois »). Bandes horizontales
 * entre les bords des découpes, trous retirés dans chaque bande.
 * @param {Array<{ height: number; width: number; x: number; y: number }>} cutouts - Découpes.
 * @param {number} width - Largeur de l'écran.
 * @param {number} height - Hauteur de l'écran.
 * @returns {Array<{ height: number; width: number; x: number; y: number }>} Bloqueurs.
 */
export const computeBlockers = (cutouts, width, height) => {
  const edges = [...new Set([0, height, ...cutouts.flatMap((c) => [c.y, c.y + c.height])])]
    .filter((edge) => edge >= 0 && edge <= height)
    .sort((a, b) => a - b);
  const blockers = [];
  for (let band = 0; band < edges.length - 1; band += 1) {
    const top = edges[band];
    const bottom = edges[band + 1];
    const holes = cutouts
      .filter((c) => c.y <= top && c.y + c.height >= bottom)
      .map((c) => [c.x, c.x + c.width])
      .sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    holes.forEach(([start, end]) => {
      if (start > cursor) {
        blockers.push({
          height: bottom - top, width: start - cursor, x: cursor, y: top,
        });
      }
      cursor = Math.max(cursor, end);
    });
    if (cursor < width) {
      blockers.push({
        height: bottom - top, width: width - cursor, x: cursor, y: top,
      });
    }
  }
  return blockers.filter((blocker) => blocker.width > 0 && blocker.height > 0);
};

/**
 * Place la bulle (04_COUCHE_VISUELLE §2, « Placement ») : en haut, au centre
 * d'une très grande cible, ou du côté de la cible où il reste le plus de place.
 * @param {object} args - Mesures.
 * @param {{ height: number; width: number; x: number; y: number } | null} args.primary - Découpe.
 * @param {boolean} args.top - Étape « bulle en haut ».
 * @param {number} args.bubbleHeight - Hauteur mesurée de la bulle.
 * @param {number} args.width - Largeur de l'écran.
 * @param {number} args.height - Hauteur de l'écran.
 * @param {number} args.insetTop - Encoche.
 * @returns {{ arrow: 'down' | 'none' | 'up'; arrowX: number; left: number; top: number;
 *   width: number }} Position.
 */
export const placeBubble = ({
  bubbleHeight, height, insetTop, primary, top, width,
}) => {
  if (top || !primary) {
    return {
      arrow: 'none', arrowX: 0, left: 14, top: insetTop + 4, width: width - 28,
    };
  }
  const bubbleWidth = Math.min(BUBBLE_WIDTH, width - 28);
  const centerX = primary.x + (primary.width / 2);
  const left = Math.min(Math.max(14, centerX - (bubbleWidth / 2)), width - 14 - bubbleWidth);
  const arrowX = Math.min(Math.max(18, centerX - left - 7), bubbleWidth - 32);
  const touchesTopAndBottom = primary.y < 120 && primary.y + primary.height > height - 120;
  if (primary.height > height * 0.4 && touchesTopAndBottom) {
    return {
      arrow: 'none',
      arrowX,
      left,
      top: primary.y + ((primary.height - bubbleHeight) / 2),
      width: bubbleWidth,
    };
  }
  const spaceAbove = primary.y - insetTop;
  const spaceBelow = height - (primary.y + primary.height);
  if (spaceAbove >= spaceBelow) {
    return {
      arrow: 'down',
      arrowX,
      left,
      top: Math.max(insetTop + 4, primary.y - BUBBLE_GAP - bubbleHeight),
      width: bubbleWidth,
    };
  }
  return {
    arrow: 'up', arrowX, left, top: primary.y + primary.height + BUBBLE_GAP, width: bubbleWidth,
  };
};
