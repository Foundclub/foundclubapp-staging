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
// Un élément posé contre l'en-tête peut le chevaucher de quelques points sans être passé dessous.
const HEADER_OVERLAP_ALLOWED = 4;

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
// T3-GUIDE-SITE : au-delà, la bulle sans flèche reste une bulle, centrée, pas un bandeau.
const WIDE_BUBBLE_MAX = 520;

/**
 * Cadre d'une bulle sans flèche : toute la largeur sur un téléphone, centrée sur un grand écran.
 * @param {number} width - Largeur de la couche.
 * @returns {{ left: number; width: number }} Cadre horizontal.
 */
export const wideBubbleFrame = (width) => {
  const bubbleWidth = Math.min(width - 28, WIDE_BUBBLE_MAX);
  return { left: (width - bubbleWidth) / 2, width: bubbleWidth };
};

/**
 * Haut de la barre d'onglets, si elle est en bas de l'écran. T3-GUIDE-SITE : à 1440, les onglets du
 * site sont à gauche, en haut de page ; les prendre pour une barre du bas coupait tout l'écran.
 * @param {{ y: number }[]} dockRects - Mesures des onglets.
 * @param {number} screenHeight - Hauteur de la couche.
 * @returns {{ height: number; width: number; x: number; y: number } | null} La barre, ou rien.
 */
export const dockBarOf = (dockRects, screenHeight) => {
  const bar = dockRects.filter((rect) => rect.y > screenHeight / 2);
  return bar.length ? {
    height: 1, width: 1, x: 0, y: Math.min(...bar.map((rect) => rect.y)),
  } : null;
};

/**
 * Ce qui reste visible d'une cible au-dessus de la barre d'onglets du bas.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @param {{ y: number } | null} dock - Barre d'onglets du bas (`dockBarOf`), ou rien.
 * @returns {{ height: number; width: number; x: number; y: number } | null} Partie visible.
 */
export const clipAboveDock = (rect, dock) => {
  if (!dock || rect.y + rect.height <= dock.y) return rect;
  const height = dock.y - rect.y;
  return height >= Math.min(rect.height, MIN_TOUCH) ? { ...rect, height } : null;
};

/**
 * G93 : la cible est-elle passée sous l'en-tête fixe ? Une liste qui défile passe dessous : la
 * mesure reste « à l'écran », et le cadre se dessinait sur le titre, sans plus rien de touchable.
 * @param {{ y: number }} rect - Mesure.
 * @param {number | null} headerBottom - Bas de l'en-tête fixe (`headerBottomOf`), ou rien.
 * @returns {boolean} Sous l'en-tête ?
 */
export const isUnderHeader = (rect, headerBottom) => (
  headerBottom !== null && rect.y < headerBottom - HEADER_OVERLAP_ALLOWED
);

/**
 * Ce qui reste visible d'une cible sous l'en-tête fixe, même règle que `clipAboveDock`.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @param {number | null} headerBottom - Bas de l'en-tête fixe, ou rien.
 * @returns {{ height: number; width: number; x: number; y: number } | null} Partie visible.
 */
export const clipBelowHeader = (rect, headerBottom) => {
  if (!isUnderHeader(rect, headerBottom)) return rect;
  const height = rect.y + rect.height - /** @type {number} */ (headerBottom);
  return height >= Math.min(rect.height, MIN_TOUCH)
    ? { ...rect, height, y: /** @type {number} */ (headerBottom) }
    : null;
};

/**
 * Découpe d'une cible : marge de 6, bornée à 2 du bord de l'écran.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @param {number} screenWidth - Largeur de l'écran.
 * @param {number} screenHeight - Hauteur de l'écran.
 * @returns {{ height: number; width: number; x: number; y: number }} Découpe.
 */
export const toCutout = (rect, screenWidth, screenHeight) => {
  // GUIDE-STORES : une ancre plus petite que le bouton qu'elle marque (les 3 points de ⋮) laissait
  // un trou de 16 pt : à côté, le doigt tombait sur le voile.
  const marginX = Math.max(CUTOUT_MARGIN, (MIN_TOUCH - rect.width) / 2);
  const marginY = Math.max(CUTOUT_MARGIN, (MIN_TOUCH - rect.height) / 2);
  const x = Math.max(2, rect.x - marginX);
  const y = Math.max(2, rect.y - marginY);
  return {
    height: Math.min(screenHeight - 2, rect.y + rect.height + marginY) - y,
    width: Math.min(screenWidth - 2, rect.x + rect.width + marginX) - x,
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

// Hauteur visible au-dessus du clavier sous laquelle la bulle réduite prendrait la place du champ
// (barre d'état + en-tête + bulle + champ + « Suivant »). Mesuré à l'émulateur : 340 en 360×640
// coupe encore le champ ; 407 sur un iPhone 8, 352 sur le plus petit iPhone, sans bulle.
const MIN_VISIBLE_FOR_BUBBLE = 400;

/**
 * FIN-GUIDE, point 3 : la bulle réduite tient-elle au-dessus du clavier avec le champ ? Sinon le
 * champ passe d'abord : elle revient quand le clavier se ferme.
 * @param {number} keyboardTop - Haut du clavier, repère de la fenêtre.
 * @returns {boolean} Elle tient ?
 */
export const compactBubbleFits = (keyboardTop) => keyboardTop >= MIN_VISIBLE_FOR_BUBBLE;

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
 * @param {boolean} [args.compact] - Clavier ouvert dans un tunnel : toujours sous l'en-tête, le
 *   champ remonte de lui-même sous la bulle (FIN-GUIDE, point 3).
 * @returns {{ arrow: 'down' | 'none' | 'up'; arrowX: number; left: number; top: number;
 *   width: number }} Position.
 */
export const placeBubble = ({
  bottomLimit, bubbleHeight, compact = false, headerBottom = null, height, insetTop, primary, top,
  width,
}) => {
  const bottom = bottomLimit ?? height;
  if (compact) {
    return {
      arrow: 'none',
      arrowX: 0,
      ...wideBubbleFrame(width),
      top: Math.max(insetTop + 4, (headerBottom ?? 0) + HEADER_GAP),
    };
  }
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
      arrow: 'none', arrowX: 0, ...wideBubbleFrame(width), top: bubbleTop,
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

/**
 * Haut de la bulle posée dans la place réservée par l'écran (`TourBubbleSlot`). Recette L11
 * (l11-b1e3) : plus haute que la place (titre de mission sur deux lignes), elle remonte sur le
 * titre de l'écran, bas calé sur celui de la place, si elle tient entière sous l'en-tête ; son
 * pied reste visible. Sinon elle reste dans la place et défile (GUIDE-PETIT-ECRAN, décision A).
 * @param {{ height: number; y: number }} slot - Place réservée.
 * @param {number} bubbleHeight - Hauteur voulue par la bulle.
 * @param {number} insetTop - Encoche.
 * @param {number | null} headerBottom - Bas de l'en-tête ancré.
 * @returns {number} Haut de la bulle.
 */
export const slotBubbleTop = (slot, bubbleHeight, insetTop, headerBottom) => {
  const raised = slot.y + slot.height - bubbleHeight;
  const fits = raised >= Math.max(insetTop + 4, (headerBottom ?? 0) + HEADER_GAP);
  return fits ? Math.min(slot.y, raised) : slot.y;
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
  if (slot) return slot.y + slot.height - position.top;
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

// Marge gardée autour d'une cible ramenée à l'écran sur le site (même valeur que la couche).
const SITE_REVEAL_MARGIN = 12;

/**
 * GUIDES-SITE-CORR (tournée du site du 09/11) : sur le site, ce que le défilement automatique doit
 * ramener, et vers quel bord. Avant, chaque cible coupée allait AU MILIEU de l'écran : une longue
 * liste montrait son milieu (sports, niveaux, équipes : S10, S11, S19), et dans un tunnel la place
 * de la bulle passait au-dessus de l'écran, la bulle se posant alors sur les choix (S26, S31).
 * Règles, cible par cible, dans l'ordre donné (la place de la bulle d'abord) :
 * - entière dans la zone utile : rien ;
 * - plus haute que la zone : rien si son HAUT est visible, sinon son haut sous l'en-tête (`start`) ;
 * - sinon : ramenée au plus court, juste au bord (`nearest`) : « Suivant » sous le bas (S14) ;
 * - jamais au prix d'une cible déjà visible qui sortirait de l'écran.
 * @param {{ box: { height: number; y: number }; id: string }[]} entries - Mesures entières, dans le
 *   repère de la couche, par ordre de priorité.
 * @param {number} areaTop - Haut utile (sous l'en-tête fixe).
 * @param {number} areaBottom - Bas utile (au-dessus de la barre d'onglets).
 * @returns {{ block: 'nearest' | 'start'; id: string } | null} Ce qu'il faut ramener, ou rien.
 */
export const planSiteReveal = (entries, areaTop, areaBottom) => {
  const room = areaBottom - areaTop - (2 * SITE_REVEAL_MARGIN);
  const isTall = (/** @type {{ height: number }} */ box) => box.height > room;
  const isSeen = (/** @type {{ height: number; y: number }} */ box, shift = 0) => {
    const y = box.y - shift;
    if (isTall(box)) return y >= areaTop - 1 && y <= areaBottom - MIN_TOUCH;
    return y >= areaTop - 1 && y + box.height <= areaBottom + 1;
  };
  /** @type {{ height: number; y: number }[]} */
  const seen = [];
  for (let index = 0; index < entries.length; index += 1) {
    const { box, id } = entries[index];
    if (isSeen(box)) {
      seen.push(box);
    } else {
      const fromTop = isTall(box) || box.y < areaTop;
      const shift = fromTop
        ? box.y - areaTop - SITE_REVEAL_MARGIN
        : box.y + box.height - areaBottom + SITE_REVEAL_MARGIN;
      if (seen.every((done) => isSeen(done, shift))) {
        return { block: isTall(box) ? 'start' : 'nearest', id };
      }
    }
  }
  return null;
};

// Hauteur sous laquelle un trou entre les cibles ne peut plus recevoir la bulle (en-tête + une
// ligne serrés) : clavier ouvert, la bulle attend qu'il se ferme plutôt que de couvrir le champ.
const MIN_GAP_ROOM = 56;

/**
 * GUIDE-D-CORR-2 (retour d'Adel du 08/11, « Ajouter un partenaire ») : une bulle ne recouvre
 * jamais une cible de l'étape, ni le bouton qu'elle demande de toucher. Si la place donnée par
 * `placeBubble` croise une cible, la bulle va dans le trou libre (entre l'en-tête, les cibles et le
 * bas utile) : celui qui touche la cible principale s'il la tient, sinon un autre qui la tient,
 * sinon le plus grand, où son contenu défile.
 * @param {object} args - Mesures, dans le repère de la couche.
 * @param {number} args.bottomLimit - Bas utile (barre d'onglets, clavier, bas sûr).
 * @param {number} args.bubbleHeight - Hauteur voulue par la bulle.
 * @param {number} args.maxHeight - Hauteur que la bulle prendra à sa place actuelle.
 * @param {{ height: number; width: number; x: number; y: number }[]} args.obstacles - Découpes.
 * @param {{ arrow: string; left: number; top: number; width: number }} args.position - Place.
 * @param {{ height: number; y: number } | null} args.primary - Cible principale.
 * @param {number} args.topLimit - Haut utile (sous l'en-tête ancré).
 * @returns {{ maxHeight: number | null; position: any } | null} Place retenue (`maxHeight` null :
 *   inchangée) ; null s'il n'y a nulle part où la poser sans couvrir une cible.
 */
export const avoidTargets = ({
  bottomLimit, bubbleHeight, maxHeight, obstacles, position, primary, topLimit,
}) => {
  const crosses = (/** @type {number} */ top, /** @type {number} */ size) => obstacles
    .some((rect) => top < rect.y + rect.height && top + size > rect.y);
  if (!obstacles.length || !crosses(position.top, Math.min(bubbleHeight, maxHeight))) {
    return { maxHeight: null, position };
  }
  const busy = obstacles
    .map((rect) => [rect.y - HEADER_GAP, rect.y + rect.height + HEADER_GAP])
    .sort((a, b) => a[0] - b[0]);
  /** @type {{ end: number; start: number }[]} */
  const gaps = [];
  let cursor = topLimit;
  busy.forEach(([start, end]) => {
    if (start > cursor) gaps.push({ end: Math.min(start, bottomLimit), start: cursor });
    cursor = Math.max(cursor, end);
  });
  if (bottomLimit > cursor) gaps.push({ end: bottomLimit, start: cursor });
  const open = gaps.filter((gap) => gap.end - gap.start > 0);
  if (!open.length) return null;
  const size = (/** @type {{ end: number; start: number }} */ gap) => gap.end - gap.start;
  const below = primary
    ? open.find((gap) => Math.abs(gap.start - (primary.y + primary.height + HEADER_GAP)) < 2)
    : null;
  const above = primary
    ? open.find((gap) => Math.abs(gap.end - (primary.y - HEADER_GAP)) < 2)
    : null;
  const fitting = open.filter((gap) => size(gap) >= bubbleHeight);
  let gap = null;
  if (below && size(below) >= bubbleHeight) gap = below;
  else if (above && size(above) >= bubbleHeight) gap = above;
  else if (fitting.length) {
    const center = primary ? primary.y + (primary.height / 2) : topLimit;
    gap = fitting.reduce((best, candidate) => (
      Math.abs(candidate.start - center) < Math.abs(best.start - center) ? candidate : best
    ));
  } else {
    gap = open.reduce((best, candidate) => (size(candidate) > size(best) ? candidate : best));
    if (size(gap) < MIN_GAP_ROOM) return null;
  }
  const fits = size(gap) >= bubbleHeight;
  const top = gap === above && fits ? gap.end - bubbleHeight : gap.start;
  let arrow = 'none';
  if (gap === below) arrow = 'up';
  else if (gap === above && fits) arrow = 'down';
  return {
    maxHeight: Math.min(size(gap), gap.end - top),
    position: { ...position, arrow: position.arrow === 'none' ? 'none' : arrow, top },
  };
};
