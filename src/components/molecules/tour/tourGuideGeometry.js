/**
 * Géométrie pure de la couche du guide (TUTOE) : découpes, bloqueurs de
 * touches, placement de la bulle. Sans React, testable seule.
 */

const CUTOUT_MARGIN = 6;
const BUBBLE_WIDTH = 304;
const BUBBLE_GAP = 14;
// Écart entre le bas de l'en-tête et une bulle « en haut ».
const HEADER_GAP = 6;

/**
 * Mesure d'une cible ramenée dans le repère de la couche. Les deux viennent de
 * `measureInWindow` : sur Android il retire la barre d'état (edge-to-edge),
 * mais la couche, plein écran, commence à 0 ; retrancher l'origine de la
 * couche, mesurée de la même façon, annule l'écart quel qu'il soit (barre
 * d'état, encoche, fenêtre réduite).
 * @param {{ height: number; width: number; x: number; y: number } | null} rect - Mesure.
 * @param {{ x: number; y: number }} origin - Origine de la couche, même mesure.
 * @returns {{ height: number; width: number; x: number; y: number } | null} Mesure.
 */
export const toLayerFrame = (rect, origin) => (rect ? {
  height: rect.height, width: rect.width, x: rect.x - origin.x, y: rect.y - origin.y,
} : null);

/**
 * Style absolu d'un rectangle `{ x, y }` : `x`/`y` ne sont PAS des clés de
 * style (ignorées en silence ⇒ tout s'empile en haut à gauche).
 * @param {{ height: number; width: number; x: number; y: number }} rect - Rectangle.
 * @returns {{ height: number; left: number; position: 'absolute'; top: number;
 *   width: number }} Style.
 */
export const toAbsoluteStyle = (rect) => ({
  height: rect.height, left: rect.x, position: 'absolute', top: rect.y, width: rect.width,
});

/**
 * Hauteur de bulle retenue : une variation de moins d'un point (arrondi au
 * pixel, qui dépend de la position, qui dépend de la hauteur) est ignorée,
 * sinon la bulle oscille et l'interface ne se pose jamais.
 * @param {number} previous - Hauteur retenue.
 * @param {number} next - Hauteur mesurée.
 * @returns {number} Hauteur à retenir.
 */
export const stableHeight = (previous, next) => (Math.abs(next - previous) < 1 ? previous : next);

// Hauteur minimale d'un toucher (accessibilité).
const MIN_TOUCH = 44;

/**
 * La cible est-elle à l'écran ? Une cible hors écran donnait une découpe de
 * hauteur négative et une bulle hors écran. GUIDE-REPRISE N5 (rejeu du 28/10,
 * captures 40-41) : avec `minVisible`, une lamelle qui dépasse du bord ne compte
 * pas, sinon le voile s'allume dessus, bloque le défilement qui la ferait entrer,
 * et « Fais défiler » ne s'affiche pas (même règle que `clipAboveDock`).
 * ponytail: on ne fait pas défiler l'écran jusqu'à la cible (pack 04 §2,
 * point 5) : bulle en haut et écran libre ; la re-mesure la découpe dès que la
 * personne la fait entrer à l'écran. Sortie : un `scrollTo` par écran ancré.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @param {number} screenWidth - Largeur de la couche.
 * @param {number} screenHeight - Hauteur de la couche.
 * @param {number} [minVisible] - Hauteur visible exigée (bornée à celle de la cible).
 * @returns {boolean} À l'écran ?
 */
export const isOnScreen = (rect, screenWidth, screenHeight, minVisible = 0) => {
  const visible = Math.min(rect.y + rect.height, screenHeight - 2) - Math.max(rect.y, 2);
  return visible > 0 && visible >= Math.min(rect.height, minVisible)
    && rect.x < screenWidth - 2 && rect.x + rect.width > 2;
};

/**
 * Coupe une cible au-dessus de la barre d'onglets flottante, qui recouvre le
 * contenu : sinon la découpe déborde sur les onglets et un toucher au centre
 * du trou tombe sur un onglet. Entièrement dessous, ou moins d'un toucher
 * (44 pt) au-dessus : la cible ne compte pas encore (sinon le voile s'allume
 * sur une lamelle et bloque le défilement qui la ferait monter).
 * @param {{ height: number; width: number; x: number; y: number }} rect - Cible.
 * @param {{ height: number; width: number; x: number; y: number } | null} dock - Barre.
 * @returns {{ height: number; width: number; x: number; y: number } | null} Cible.
 */
export const clipAboveDock = (rect, dock) => {
  if (!dock || rect.y + rect.height <= dock.y) return rect;
  const height = dock.y - rect.y;
  return height >= Math.min(rect.height, MIN_TOUCH) ? { ...rect, height } : null;
};

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
 * Bas de l'en-tête de l'écran (flèche Retour, avatar, « Exemple · contre… ») :
 * le plus bas des en-têtes ancrés visibles dans le tiers haut de l'écran, ou
 * null (écran sans en-tête ancré).
 * @param {Array<{ height: number; width: number; x: number; y: number } | null>} rects - Mesures.
 * @param {number} screenHeight - Hauteur de la couche.
 * @returns {number | null} Ordonnée du bas de l'en-tête.
 */
export const headerBottomOf = (rects, screenHeight) => {
  const bottoms = rects
    .filter((rect) => rect && rect.y + rect.height > 2 && rect.y < screenHeight / 3)
    .map((rect) => /** @type {any} */ (rect).y + /** @type {any} */ (rect).height);
  return bottoms.length ? Math.max(...bottoms) : null;
};

/**
 * Place la bulle (04_COUCHE_VISUELLE §2, « Placement ») : en haut, au centre
 * d'une très grande cible, ou du côté de la cible où il reste le plus de place.
 * GUIDE-ENTETE (décision d'Adel 4- A, 28/10) : « en haut » veut dire SOUS
 * l'en-tête ancré, pour que la flèche Retour reste visible et touchable ; sans
 * en-tête ancré, sous l'encoche comme avant.
 * @param {object} args - Mesures.
 * @param {{ height: number; width: number; x: number; y: number } | null} args.primary - Découpe.
 * @param {boolean} args.top - Étape « bulle en haut ».
 * @param {number} args.bubbleHeight - Hauteur mesurée de la bulle.
 * @param {number} args.width - Largeur de l'écran.
 * @param {number} args.height - Hauteur de l'écran.
 * @param {number} args.insetTop - Encoche.
 * @param {number | null} [args.headerBottom] - Bas de l'en-tête ancré (`headerBottomOf`).
 * @param {number} [args.bottomLimit] - Bas utile (barre d'onglets, bas sûr) ; défaut : `height`.
 * @returns {{ arrow: 'down' | 'none' | 'up'; arrowX: number; left: number; top: number;
 *   width: number }} Position.
 */
export const placeBubble = ({
  bottomLimit, bubbleHeight, headerBottom = null, height, insetTop, primary, top, width,
}) => {
  const bottom = bottomLimit ?? height;
  if (top || !primary) {
    let bubbleTop = Math.max(insetTop + 4, (headerBottom ?? 0) + HEADER_GAP);
    // Jamais sur la cible (champ du tunnel, bouton ⋮ ou onglets sous l'en-tête) :
    // dessous si la place y est, sinon au-dessus, quitte à remonter sur
    // l'en-tête (grand champ de tunnel). Une cible qui commence plus haut
    // (tout l'écran) ne compte pas.
    if (primary && primary.y >= bubbleTop && bubbleTop + bubbleHeight > primary.y - HEADER_GAP) {
      const below = primary.y + primary.height + BUBBLE_GAP;
      bubbleTop = below + bubbleHeight <= bottom
        ? below
        : Math.max(insetTop + 4, primary.y - HEADER_GAP - bubbleHeight);
    }
    return {
      arrow: 'none', arrowX: 0, left: 14, top: bubbleTop, width: width - 28,
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
  const spaceAbove = primary.y - BUBBLE_GAP - (insetTop + 4);
  const spaceBelow = bottom - (primary.y + primary.height + BUBBLE_GAP);
  // GUIDE-PETIT-ECRAN (rejeu 3, R3-05) : dessous dès que la bulle y tient (sous
  // la barre d'onglets), sinon au-dessus si elle y tient, sinon le plus grand
  // côté. Avant : le plus grand côté, barre d'onglets comprise ⇒ la bulle de
  // rv-m1 couvrait la carte EN ATTENTE au-dessus de « Nouvelle équipe ».
  const goesAbove = bubbleHeight > spaceBelow
    && (bubbleHeight <= spaceAbove || spaceAbove > spaceBelow);
  if (goesAbove) {
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

// Hauteur sous laquelle une bulle n'a plus de sens (titre + une ligne) : en
// deçà, on la laisse déborder plutôt que de montrer une bande vide.
const MIN_BUBBLE_ROOM = 88;

/**
 * Hauteur maximale de la bulle à la place que `placeBubble` lui a donnée
 * (GUIDE-PETIT-ECRAN, décision A du chef 29/10) : jusqu'à la cible si elle est
 * dessous, sinon jusqu'au bas utile. Au-delà, le contenu défile DANS la bulle.
 * Rejeu 3 (720×1280, texte 1,3) : la bulle de b2-where dépassait l'écran, celle
 * de b2-start sa place réservée de 75 px.
 * @param {object} args - Mesures.
 * @param {{ arrow: string; top: number }} args.position - Sortie de `placeBubble`.
 * @param {{ height: number; width: number; x: number; y: number } | null} args.primary - Découpe.
 * @param {number} args.bottomLimit - Bas utile (barre d'onglets, bas sûr).
 * @param {number} args.insetTop - Encoche.
 * @param {number | null} [args.headerBottom] - Bas de l'en-tête ancré.
 * @param {{ height: number; y: number } | null} [args.slot] - Place réservée par l'écran.
 * @returns {number} Hauteur maximale.
 */
export const bubbleRoom = ({
  bottomLimit, headerBottom = null, insetTop, position, primary, slot = null,
}) => {
  if (slot) return slot.height;
  const base = Math.max(insetTop + 4, (headerBottom ?? 0) + HEADER_GAP);
  let room = bottomLimit - position.top;
  if (position.arrow === 'down' && primary) {
    room = primary.y - BUBBLE_GAP - (insetTop + 4);
  } else if (position.arrow === 'none' && primary && primary.y >= base
    && primary.y > position.top) {
    // « En haut », cible dessous : entre l'en-tête et la cible (même repli que
    // `placeBubble`, qui la remonte sur l'en-tête quand elle ne tient pas).
    room = primary.y - HEADER_GAP - Math.min(base, position.top);
  }
  return Math.max(MIN_BUBBLE_ROOM, room);
};
