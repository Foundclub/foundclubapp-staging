/**
 * WHATSAPP — OU SE POSE LA PILULE DE REACTIONS, en coordonnees d ecran.
 *
 * 🎈 CE QUE CE CALCUL REMPLACE. Jusqu au 23/09, l appui long ouvrait une feuille
 * qui montait du bas et recouvrait la conversation : on choisissait une reaction
 * sans plus voir a quoi on reagissait. Sur WhatsApp, la rangee sort JUSTE
 * AU-DESSUS du message vise, qui reste lisible dessous. C est ce que fait ce
 * module, et il ne fait que ca.
 *
 * 🪤 IL EST PUR, ET CE N EST PAS UN GOUT DE STYLE : la geometrie de `BottomModal`
 * ment (elle annonce une hauteur qu elle n a pas encore). Aucune mesure de
 * feuille n entre donc ici — seulement la bulle mesuree a l ecran
 * (`measureInWindow`), la taille de la fenetre et les encoches. Pur veut aussi
 * dire testable sans emulateur, et c est la seule facon de prouver la bascule
 * haut/bas autrement qu a l oeil.
 */

/** L air entre la bulle et la pilule, en pixels. Assez pour les separer, assez peu pour les lier. */
export const REACTION_PILL_GAP = 8;

/** La marge minimale entre la pilule et le bord de l ecran. */
export const REACTION_PILL_SCREEN_MARGIN = 8;

/**
 * @param {unknown} value Une valeur quelconque.
 * @param {number} [defaut] Ce qu on prend si elle n est pas un nombre.
 * @returns {number} Un nombre utilisable, toujours.
 */
const nombre = (value, defaut = 0) => {
  const brut = Number(value);
  return Number.isFinite(brut) ? brut : defaut;
};

/**
 * Ramene une valeur entre deux bornes, meme quand elles sont croisees.
 *
 * 🧯 `max < min` ARRIVE POUR DE VRAI : une pilule plus large que la fenetre (un
 * tres petit ecran, ou une police systeme agrandie) inverse les bornes. On
 * prefere alors coller au minimum plutot que de rendre un `NaN` qui ferait
 * disparaitre la pilule sans rien dire.
 * @param {number} valeur La valeur a borner.
 * @param {number} min La borne basse.
 * @param {number} max La borne haute.
 * @returns {number} La valeur bornee.
 */
const borner = (valeur, min, max) => {
  if (max < min) return min;
  return Math.min(Math.max(valeur, min), max);
};

/**
 * @param {object} [params] Les mesures.
 * @param {boolean} [params.alignEnd] Vrai pour MON message (bulle a droite).
 * @param {{height?: number, width?: number, x?: number, y?: number} | null} [params.anchor]
 *   La bulle, mesuree a l ecran — `null` tant qu elle ne l a pas ete.
 * @param {number} [params.gap] L air entre la bulle et la pilule.
 * @param {{bottom?: number, top?: number}} [params.insets] Les encoches.
 * @param {number} [params.margin] La marge aux bords de l ecran.
 * @param {{height?: number, width?: number}} [params.pill] La taille de la pilule.
 * @param {{height?: number, width?: number}} [params.window] La fenetre.
 * @returns {{left: number, placedAbove: boolean, top: number}} Sa place, et de quel cote elle a pris.
 */
export const computeReactionPillPlacement = ({
  alignEnd = false,
  anchor,
  gap = REACTION_PILL_GAP,
  insets,
  margin = REACTION_PILL_SCREEN_MARGIN,
  pill,
  window: fenetre,
} = {}) => {
  const bulleX = nombre(anchor?.x);
  const bulleY = nombre(anchor?.y);
  const bulleLargeur = nombre(anchor?.width);
  const bulleHauteur = nombre(anchor?.height);

  const pilLargeur = nombre(pill?.width);
  const pilHauteur = nombre(pill?.height);

  const ecranLargeur = nombre(fenetre?.width);
  const ecranHauteur = nombre(fenetre?.height);

  const hautSur = nombre(insets?.top);
  const basSur = nombre(insets?.bottom);

  // ⬆️⬇️ LA BASCULE. Au-dessus par defaut, comme WhatsApp ; en dessous seulement
  // quand le haut de l ecran est trop proche — sinon la pilule passerait sous
  // l encoche ou sous l en-tete de la conversation.
  const hautSiAuDessus = bulleY - gap - pilHauteur;
  const placedAbove = hautSiAuDessus >= hautSur;
  const hautVoulu = placedAbove ? hautSiAuDessus : bulleY + bulleHauteur + gap;

  // ↔️ ELLE SE RANGE SUR LE BORD DE LA BULLE, du cote ou elle est : a gauche pour
  // un message recu, a droite pour les miens. C est ce qui la fait « appartenir »
  // au message plutot que flotter au milieu.
  const gaucheVoulue = alignEnd
    ? bulleX + bulleLargeur - pilLargeur
    : bulleX;

  return {
    left: borner(gaucheVoulue, margin, ecranLargeur - pilLargeur - margin),
    placedAbove,
    top: borner(hautVoulu, hautSur, ecranHauteur - basSur - pilHauteur),
  };
};
